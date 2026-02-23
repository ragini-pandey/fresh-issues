import {
  GITHUB_GRAPHQL,
  GQL_BATCH_SIZE,
  SORT_QUALIFIER,
  GQL_ISSUE_FIELDS,
  SEARCH_ISSUES_QUERY,
  CACHE_DURATION,
} from './github.constants.js';
import { GitHubAPIError }                            from './github.error.js';
import { queueRequest, setRetryAfterUntil, getRetryAfterUntil } from './github.throttle.js';
import { CACHE, CURSOR_MAP }                         from './github.cache.js';
import { normalizeGraphQLIssue, buildSearchQuery }   from './github.normalize.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Parse and apply the Retry-After header value to the queue back-off. */
function applyRetryAfterHeader(res) {
  const val     = res.headers.get('retry-after');
  const waitSec = parseInt(val, 10);
  if (val && !isNaN(waitSec) && waitSec > 0) {
    setRetryAfterUntil(Date.now() + waitSec * 1_000);
  }
}

/** Apply a 60-second default back-off if no Retry-After header was received. */
function ensureDefaultBackoff() {
  if (getRetryAfterUntil() <= Date.now()) setRetryAfterUntil(Date.now() + 60_000);
}

// ─── Core GraphQL transport ───────────────────────────────────────────────────

/**
 * Send a GraphQL request to GitHub through the throttle queue.
 *
 * Handles:
 *  - HTTP-level errors (403 secondary RL, 429, 5xx)
 *  - GraphQL-level errors (HTTP 200 but `errors[]` present)
 *  - Retry-After header → feeds setRetryAfterUntil() so the whole queue pauses
 *
 * GitHub GraphQL requires authentication; always pass a Bearer token.
 *
 * @param {string} queryStr  - GraphQL query or mutation string.
 * @param {Object} variables - GraphQL variables object.
 * @param {string} token     - GitHub personal access token.
 * @returns {Promise<{ data: Object, rateLimitRemaining: number, rateLimitReset: number }>}
 */
export async function graphqlRequest(queryStr, variables, token) {
  const makeReq = async () => {
    let res;
    try {
      res = await fetch(GITHUB_GRAPHQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept:         'application/vnd.github+json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ query: queryStr, variables }),
      });
    } catch (err) {
      throw new GitHubAPIError(
        'Network error: Unable to connect to GitHub API. Please check your internet connection.',
        0, null, { originalError: err.message },
      );
    }

    // Always parse Retry-After before anything else
    applyRetryAfterHeader(res);

    if (!res.ok) {
      let errorData = {};
      try { errorData = await res.json(); } catch { /* ignore parse error */ }

      const isSecondaryRL =
        res.status === 403 &&
        (errorData.message?.includes('secondary rate limit') ||
         errorData.documentation_url?.includes('secondary-rate-limits'));

      if (isSecondaryRL) ensureDefaultBackoff();

      throw new GitHubAPIError(
        isSecondaryRL
          ? 'You\'re making requests too quickly. The app will slow down automatically.'
          : (errorData.message || `GitHub API error: ${res.status}`),
        res.status, errorData, { isSecondaryRateLimit: isSecondaryRL },
      );
    }

    const json = await res.json();

    // GraphQL-level errors arrive with HTTP 200 but carry an `errors` array
    if (json.errors?.length) {
      const first = json.errors[0];
      const isRL  = first.type === 'RATE_LIMITED' ||
                    first.message?.toLowerCase().includes('rate limit');
      if (isRL) ensureDefaultBackoff();

      throw new GitHubAPIError(
        isRL
          ? 'API rate limit exceeded. The app will slow down automatically.'
          : (first.message || 'GraphQL query error.'),
        isRL ? 403 : 422, json, { isSecondaryRateLimit: isRL },
      );
    }

    return {
      data:               json.data,
      rateLimitRemaining: parseInt(res.headers.get('x-ratelimit-remaining') || '0', 10),
      rateLimitReset:     parseInt(res.headers.get('x-ratelimit-reset')     || '0', 10),
    };
  };

  return queueRequest(makeReq);
}

// ─── Single-search fetch ──────────────────────────────────────────────────────

/**
 * GraphQL-powered single-search fetch with cursor-based pagination and TTL cache.
 * One network request per page regardless of filter complexity.
 *
 * @param {string} query      - Pre-built GitHub search query string.
 * @param {string} sortParam  - One of: reactions | comments | created | updated
 * @param {string} token      - GitHub personal access token.
 * @param {number} page       - 1-based page number.
 * @param {number} perPage    - Results per page.
 * @returns {Promise<{ totalCount, items, rateLimitRemaining, rateLimitReset }>}
 */
export async function fetchIssuesGraphQL(query, sortParam, token, page, perPage) {
  const cacheKey = `gql:${query}:${sortParam}:${page}:${perPage}`;
  const cached   = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

  // Resolve the `after` cursor from the previous page for cursor-based pagination
  const baseKey     = `gql:${query}:${sortParam}:${perPage}`;
  const pageCursors = CURSOR_MAP.get(baseKey) ?? {};
  const afterCursor = page > 1 ? (pageCursors[page - 1] ?? null) : null;

  // GraphQL search doesn't accept a ?sort= param — embed it as a qualifier instead
  const gqlQuery = `${query} ${SORT_QUALIFIER[sortParam] ?? 'sort:reactions-desc'}`;

  const { data, rateLimitRemaining, rateLimitReset } = await graphqlRequest(
    SEARCH_ISSUES_QUERY,
    { query: gqlQuery, first: perPage, after: afterCursor },
    token,
  );

  // Persist end-cursor so the next "load more" can request the correct page
  if (data.search.pageInfo?.endCursor) {
    CURSOR_MAP.set(baseKey, { ...pageCursors, [page]: data.search.pageInfo.endCursor });
  }

  const result = {
    totalCount:         data.search.issueCount,
    items:              (data.search.nodes ?? []).filter(Boolean).map(normalizeGraphQLIssue),
    rateLimitRemaining,
    rateLimitReset,
  };

  CACHE.set(cacheKey, { data: result, timestamp: Date.now(), etag: null });
  return result;
}

// ─── Batched multi-repo fetch ─────────────────────────────────────────────────

/**
 * GraphQL-powered multi-repo fetch.
 *
 * Bundles up to GQL_BATCH_SIZE repos into a single GraphQL query using aliased
 * `search` fields.  N repos = ceil(N / GQL_BATCH_SIZE) requests instead of N.
 *
 * @param {string[]} repoNames - Array of "owner/repo" strings.
 * @param {Object}   filters   - Search filters (repo is overridden per alias).
 * @param {string}   token     - GitHub personal access token.
 * @param {number}   page      - Page number (passed through to per-repo queries).
 * @param {number}   perPage   - Results per repo.
 * @returns {Promise<{ totalCount, items, rateLimitRemaining, rateLimitReset, errors }>}
 */
export async function fetchIssuesForReposGraphQL(repoNames, filters, token, page, perPage) {
  const sortParam     = filters.sortBy || 'reactions';
  const sortQualifier = SORT_QUALIFIER[sortParam] ?? 'sort:reactions-desc';

  // Build one search string per repo using the shared query builder
  const repoQueries = repoNames.map((repo) =>
    `${buildSearchQuery({ ...filters, repo, minStars: 0 })} ${sortQualifier}`,
  );

  let allItems           = [];
  let totalCount         = 0;
  let rateLimitRemaining = null;
  let rateLimitReset     = null;
  const errors           = [];

  for (let start = 0; start < repoQueries.length; start += GQL_BATCH_SIZE) {
    const batchQueries = repoQueries.slice(start, start + GQL_BATCH_SIZE);
    const batchRepos   = repoNames.slice(start, start + GQL_BATCH_SIZE);

    // One aliased search field per repo → single round-trip for the whole batch
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

      batchRepos.forEach((repo, i) => {
        const repoData = data?.[`repo_${i}`];
        if (repoData) {
          allItems   = allItems.concat(
            (repoData.nodes ?? []).filter(Boolean).map(normalizeGraphQLIssue),
          );
          totalCount += repoData.issueCount;
        }
      });
    } catch (err) {
      batchRepos.forEach((repo) =>
        errors.push({ repo, error: err?.message ?? 'Unknown error', status: err?.status }),
      );
      // No point running remaining batches if GitHub is actively throttling
      if (err?.isRateLimit || err?.status === 429) break;
    }
  }

  // Deduplicate (same issue can appear in multiple repo results)
  const seen   = new Set();
  const unique = [];
  for (const item of allItems) {
    if (!seen.has(item.id)) { seen.add(item.id); unique.push(item); }
  }

  unique.sort((a, b) => {
    if (sortParam === 'comments') return b.comments - a.comments;
    if (sortParam === 'created')  return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortParam === 'updated')  return new Date(b.updatedAt) - new Date(a.updatedAt);
    return b.reactions - a.reactions || new Date(b.createdAt) - new Date(a.createdAt);
  });

  return { totalCount, items: unique, rateLimitRemaining, rateLimitReset, errors };
}
