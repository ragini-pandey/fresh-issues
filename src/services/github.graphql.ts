import {
  GITHUB_GRAPHQL,
  GQL_BATCH_SIZE,
  SORT_QUALIFIER,
  GQL_ISSUE_FIELDS,
  SEARCH_ISSUES_QUERY,
  CACHE_DURATION,
} from './github.constants';
import { GitHubAPIError } from './github.error';
import {
  queueRequest,
  setRetryAfterUntil,
  getRetryAfterUntil,
} from './github.throttle';
import { CACHE, CURSOR_MAP } from './github.cache';
import { normalizeGraphQLIssue, buildSearchQuery } from './github.normalize';
import type {
  FetchIssuesForReposResult,
  FetchIssuesResult,
  GraphQLIssueNode,
  Issue,
  RepoFetchError,
  SearchFilters,
  SortBy,
} from '../types';

interface GraphQLErrorEntry {
  type?: string;
  message?: string;
}

interface GraphQLResponseBody {
  data?: Record<string, unknown>;
  errors?: GraphQLErrorEntry[];
  message?: string;
  documentation_url?: string;
}

interface GraphQLRequestResult {
  data: Record<string, unknown>;
  rateLimitRemaining: number;
  rateLimitReset: number;
}

interface SearchPayload {
  issueCount: number;
  pageInfo?: { endCursor: string | null; hasNextPage: boolean };
  nodes: (GraphQLIssueNode | null)[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function applyRetryAfterHeader(res: Response): void {
  const val = res.headers.get('retry-after');
  const waitSec = parseInt(val ?? '', 10);
  if (val && !isNaN(waitSec) && waitSec > 0) {
    setRetryAfterUntil(Date.now() + waitSec * 1_000);
  }
}

function ensureDefaultBackoff(): void {
  if (getRetryAfterUntil() <= Date.now()) {
    setRetryAfterUntil(Date.now() + 60_000);
  }
}

// ─── Core GraphQL transport ───────────────────────────────────────────────────

export async function graphqlRequest(
  queryStr: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<GraphQLRequestResult> {
  const makeReq = async (): Promise<GraphQLRequestResult> => {
    let res: Response;
    try {
      res = await fetch(GITHUB_GRAPHQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: queryStr, variables }),
      });
    } catch (err) {
      throw new GitHubAPIError(
        'Network error: Unable to connect to GitHub API. Please check your internet connection.',
        0,
        null,
        { originalError: err instanceof Error ? err.message : String(err) },
      );
    }

    applyRetryAfterHeader(res);

    if (!res.ok) {
      let errorData: GraphQLResponseBody = {};
      try {
        errorData = (await res.json()) as GraphQLResponseBody;
      } catch {
        /* ignore parse error */
      }

      const isSecondaryRL =
        res.status === 403 &&
        (errorData.message?.includes('secondary rate limit') === true ||
          errorData.documentation_url?.includes('secondary-rate-limits') ===
            true);

      if (isSecondaryRL) ensureDefaultBackoff();

      if (res.status === 429) {
        ensureDefaultBackoff();
        throw new GitHubAPIError(
          'GitHub API rate limit exceeded. Add a GitHub token in Settings to get 5,000 requests/hour.',
          429,
          errorData,
          {},
        );
      }

      if (res.status === 401) {
        throw new GitHubAPIError(
          'Your GitHub token is invalid or has expired. Please update it in Settings.',
          401,
          errorData,
          {
            technicalMessage:
              errorData.message ?? 'Authentication failed: Bad credentials.',
          },
        );
      }

      throw new GitHubAPIError(
        isSecondaryRL
          ? "You're making requests too quickly. The app will slow down automatically."
          : errorData.message || `GitHub API error: ${res.status}`,
        res.status,
        errorData,
        { isSecondaryRateLimit: isSecondaryRL },
      );
    }

    const json = (await res.json()) as GraphQLResponseBody;

    if (json.errors?.length) {
      const first = json.errors[0];
      const isRL =
        first.type === 'RATE_LIMITED' ||
        first.message?.toLowerCase().includes('rate limit') === true;
      if (isRL) ensureDefaultBackoff();

      throw new GitHubAPIError(
        isRL
          ? 'API rate limit exceeded. The app will slow down automatically.'
          : first.message || 'GraphQL query error.',
        isRL ? 403 : 422,
        json,
        { isSecondaryRateLimit: isRL },
      );
    }

    return {
      data: json.data ?? {},
      rateLimitRemaining: parseInt(
        res.headers.get('x-ratelimit-remaining') ?? '0',
        10,
      ),
      rateLimitReset: parseInt(
        res.headers.get('x-ratelimit-reset') ?? '0',
        10,
      ),
    };
  };

  return queueRequest(makeReq);
}

// ─── Single-search fetch ──────────────────────────────────────────────────────

export async function fetchIssuesGraphQL(
  query: string,
  sortParam: SortBy,
  token: string,
  page: number,
  perPage: number,
): Promise<FetchIssuesResult> {
  const cacheKey = `gql:${query}:${sortParam}:${page}:${perPage}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as FetchIssuesResult;
  }

  const baseKey = `gql:${query}:${sortParam}:${perPage}`;
  const pageCursors = CURSOR_MAP.get(baseKey) ?? {};
  const afterCursor = page > 1 ? pageCursors[page - 1] ?? null : null;

  const gqlQuery = `${query} ${SORT_QUALIFIER[sortParam] ?? 'sort:reactions-desc'}`;

  const { data, rateLimitRemaining, rateLimitReset } = await graphqlRequest(
    SEARCH_ISSUES_QUERY,
    { query: gqlQuery, first: perPage, after: afterCursor },
    token,
  );

  const search = data.search as SearchPayload | undefined;
  if (!search) {
    return {
      totalCount: 0,
      items: [],
      rateLimitRemaining,
      rateLimitReset,
    };
  }

  if (search.pageInfo?.endCursor) {
    CURSOR_MAP.set(baseKey, {
      ...pageCursors,
      [page]: search.pageInfo.endCursor,
    });
  }

  const result: FetchIssuesResult = {
    totalCount: search.issueCount,
    items: (search.nodes ?? [])
      .filter((n): n is GraphQLIssueNode => Boolean(n))
      .map(normalizeGraphQLIssue),
    rateLimitRemaining,
    rateLimitReset,
  };

  CACHE.set(cacheKey, { data: result, timestamp: Date.now(), etag: null });
  return result;
}

// ─── Batched multi-repo fetch ─────────────────────────────────────────────────

export async function fetchIssuesForReposGraphQL(
  repoNames: string[],
  filters: SearchFilters,
  token: string,
  _page: number,
  perPage: number,
): Promise<FetchIssuesForReposResult> {
  void _page;
  const sortParam: SortBy = filters.sortBy ?? 'reactions';
  const sortQualifier = SORT_QUALIFIER[sortParam] ?? 'sort:reactions-desc';

  const repoQueries = repoNames.map(
    (repo) =>
      `${buildSearchQuery({ ...filters, repo, minStars: 0 })} ${sortQualifier}`,
  );

  let allItems: Issue[] = [];
  let totalCount = 0;
  let rateLimitRemaining: number | null = null;
  let rateLimitReset: number | Date | null = null;
  const errors: RepoFetchError[] = [];

  for (let start = 0; start < repoQueries.length; start += GQL_BATCH_SIZE) {
    const batchQueries = repoQueries.slice(start, start + GQL_BATCH_SIZE);
    const batchRepos = repoNames.slice(start, start + GQL_BATCH_SIZE);

    const aliases = batchQueries
      .map(
        (q, i) => `
      repo_${i}: search(query: ${JSON.stringify(q)}, type: ISSUE, first: ${perPage}) {
        issueCount
        nodes { ... on Issue { ${GQL_ISSUE_FIELDS} } }
      }`,
      )
      .join('\n');

    const batchGQL = `query { rateLimit { remaining resetAt } ${aliases} }`;

    try {
      const { data, rateLimitRemaining: rl, rateLimitReset: rr } =
        await graphqlRequest(batchGQL, {}, token);

      if (rl !== null && (rateLimitRemaining === null || rl < rateLimitRemaining)) {
        rateLimitRemaining = rl;
      }
      if (rr) rateLimitReset = rr;

      batchRepos.forEach((_repo, i) => {
        const repoData = data[`repo_${i}`] as SearchPayload | undefined;
        if (repoData) {
          allItems = allItems.concat(
            (repoData.nodes ?? [])
              .filter((n): n is GraphQLIssueNode => Boolean(n))
              .map(normalizeGraphQLIssue),
          );
          totalCount += repoData.issueCount;
        }
      });
    } catch (err) {
      const error = err as GitHubAPIError | Error;
      batchRepos.forEach((repo) =>
        errors.push({
          repo,
          error: error?.message ?? 'Unknown error',
          status: (error as GitHubAPIError)?.status,
        }),
      );
      if (
        (error as GitHubAPIError)?.isRateLimit ||
        (error as GitHubAPIError)?.status === 429 ||
        (error as GitHubAPIError)?.status === 401
      ) {
        break;
      }
    }
  }

  const seen = new Set<number>();
  const unique: Issue[] = [];
  for (const item of allItems) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }

  if (sortParam !== 'repo-order') {
    unique.sort((a, b) => {
      if (sortParam === 'comments') return b.comments - a.comments;
      if (sortParam === 'created')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortParam === 'updated')
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return (
        b.reactions - a.reactions ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }

  return { totalCount, items: unique, rateLimitRemaining, rateLimitReset, errors };
}
