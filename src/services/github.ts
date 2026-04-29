/**
 * github.ts – public entry-point for the GitHub service layer.
 */
import { GITHUB_API } from './github.constants';
import { GitHubAPIError } from './github.error';
import { setRetryAfterUntil, getRetryAfterUntil } from './github.throttle';
import { getCached, type MakeRequestResult } from './github.cache';
import { buildSearchQuery, normalizeIssue } from './github.normalize';
import {
  fetchIssuesGraphQL,
  fetchIssuesForReposGraphQL,
} from './github.graphql';
import type {
  FetchIssuesForReposResult,
  FetchIssuesResult,
  Issue,
  RepoFetchError,
  RestIssue,
  SearchFilters,
  SortBy,
} from '../types';

// ─── Re-exports ───────────────────────────────────────────────────────────────
export { getTimeAgo } from './github.normalize';
export {
  POPULAR_LABELS,
  LANGUAGES,
  TIME_WINDOWS,
  STAR_PRESETS,
  SORT_OPTIONS,
  COMMENT_PRESETS,
} from './github.constants';

interface RestErrorBody {
  message?: string;
  documentation_url?: string;
}

interface RestSearchResponse {
  total_count: number;
  items: RestIssue[];
}

// ─── fetchIssues ──────────────────────────────────────────────────────────────

export async function fetchIssues(
  filters: SearchFilters = {},
  token = '',
  page = 1,
  perPage = 30,
): Promise<FetchIssuesResult> {
  const query = buildSearchQuery(filters);
  const sortParam: SortBy = filters.sortBy ?? 'reactions';

  if (token) return fetchIssuesGraphQL(query, sortParam, token, page, perPage);

  const url = `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&sort=${sortParam}&order=desc&page=${page}&per_page=${perPage}`;
  const cacheKey = `issues:${query}:${sortParam}:${page}:${perPage}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };

  const makeRequest = async (
    etag: string | null = null,
  ): Promise<MakeRequestResult<FetchIssuesResult>> => {
    const reqHeaders = { ...headers };
    if (etag) reqHeaders['If-None-Match'] = etag;

    let res: Response;
    try {
      res = await fetch(url, { headers: reqHeaders });
    } catch (err) {
      throw new GitHubAPIError(
        'Network error: Unable to connect to GitHub API. Please check your internet connection.',
        0,
        null,
        { originalError: err instanceof Error ? err.message : String(err) },
      );
    }

    if (res.status === 304) return { notModified: true, data: null, etag: null };

    if (!res.ok) {
      let errorData: RestErrorBody = {};
      try {
        errorData = (await res.json()) as RestErrorBody;
      } catch {
        /* ignore */
      }

      const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
      const rateLimitReset = res.headers.get('x-ratelimit-reset');
      const resetDate = rateLimitReset
        ? new Date(parseInt(rateLimitReset, 10) * 1000)
        : null;

      const retryAfterHeader = res.headers.get('retry-after');
      if (retryAfterHeader) {
        const waitSec = parseInt(retryAfterHeader, 10);
        if (!isNaN(waitSec) && waitSec > 0) {
          setRetryAfterUntil(Date.now() + waitSec * 1_000);
        }
      }

      let errorMessage: string;
      let userMessage: string;

      switch (res.status) {
        case 401:
          errorMessage = 'Authentication failed: Invalid or expired GitHub token.';
          userMessage =
            'Your GitHub token is invalid or has expired. Please update it in Settings.';
          break;

        case 403: {
          const isSecondaryRateLimit =
            errorData.message?.includes('secondary rate limit') === true ||
            errorData.documentation_url?.includes('secondary-rate-limits') === true;
          const isPrimaryRateLimit =
            errorData.message?.includes('rate limit') === true ||
            rateLimitRemaining === '0';

          if (isSecondaryRateLimit) {
            errorMessage = 'Secondary rate limit exceeded.';
            userMessage =
              "You're making requests too quickly. The app will automatically slow down. Please wait 2-5 minutes before trying again.";
            if (getRetryAfterUntil() <= Date.now()) {
              setRetryAfterUntil(Date.now() + 60_000);
            }
          } else if (isPrimaryRateLimit) {
            const resetTime = resetDate ? resetDate.toLocaleTimeString() : 'soon';
            errorMessage = `Rate limit exceeded. Resets at ${resetTime}.`;
            userMessage = `API rate limit exceeded without authentication. Add a GitHub token in Settings for 5,000 requests/hour (resets at ${resetTime}).`;
          } else if (errorData.message?.includes('abuse')) {
            errorMessage = 'GitHub abuse detection triggered.';
            userMessage =
              'Too many requests detected. Please wait a few minutes before trying again.';
          } else {
            errorMessage = errorData.message ?? 'Access forbidden.';
            userMessage =
              'Access denied by GitHub API. This may be due to authentication issues or repository access restrictions.';
          }
          break;
        }

        case 404:
          errorMessage = 'Repository or resource not found.';
          userMessage =
            'The requested repository or resource could not be found. Please check the repository name.';
          break;

        case 422:
          errorMessage = errorData.message ?? 'Invalid request parameters.';
          userMessage = `Invalid search query: ${errorData.message ?? 'Please check your filters and try again.'}`;
          break;

        case 429: {
          const resetTime = resetDate ? resetDate.toLocaleTimeString() : 'soon';
          errorMessage = 'Rate limit exceeded (429 Too Many Requests).';
          userMessage = `GitHub API rate limit exceeded. Add a GitHub token in Settings to get 5,000 requests/hour (resets at ${resetTime}).`;
          if (getRetryAfterUntil() <= Date.now()) {
            setRetryAfterUntil(Date.now() + 60_000);
          }
          break;
        }

        case 503:
          errorMessage = 'GitHub service unavailable.';
          userMessage =
            'GitHub is temporarily unavailable. Please try again in a few moments.';
          break;

        default:
          errorMessage = errorData.message ?? `GitHub API error: ${res.status}`;
          userMessage = `An error occurred while fetching issues (${res.status}). ${errorData.message ?? 'Please try again.'}`;
      }

      throw new GitHubAPIError(userMessage, res.status, errorData, {
        technicalMessage: errorMessage,
        rateLimitRemaining,
        rateLimitReset: resetDate,
        documentationUrl: errorData.documentation_url,
        isSecondaryRateLimit:
          res.status === 403 &&
          (errorData.message?.includes('secondary rate limit') === true ||
            errorData.documentation_url?.includes('secondary-rate-limits') === true),
      });
    }

    const data = (await res.json()) as RestSearchResponse;
    const responseEtag = res.headers.get('etag');

    return {
      notModified: false,
      etag: responseEtag,
      data: {
        totalCount: data.total_count,
        items: data.items.map(normalizeIssue),
        rateLimitRemaining: parseInt(
          res.headers.get('x-ratelimit-remaining') ?? '0',
          10,
        ),
        rateLimitReset: parseInt(
          res.headers.get('x-ratelimit-reset') ?? '0',
          10,
        ),
      },
    };
  };

  return getCached(cacheKey, makeRequest);
}

// ─── fetchIssuesForRepos ──────────────────────────────────────────────────────

export async function fetchIssuesForRepos(
  repoNames: string[],
  filters: SearchFilters = {},
  token = '',
  page = 1,
  perPage = 10,
): Promise<FetchIssuesForReposResult> {
  if (!repoNames?.length) {
    return {
      totalCount: 0,
      items: [],
      rateLimitRemaining: null,
      rateLimitReset: null,
      errors: [],
    };
  }

  if (token) {
    return fetchIssuesForReposGraphQL(repoNames, filters, token, page, perPage);
  }

  let allItems: Issue[] = [];
  let totalCount = 0;
  let rateLimitRemaining: number | null = null;
  let rateLimitReset: number | Date | null = null;
  const errors: RepoFetchError[] = [];

  for (const repo of repoNames) {
    try {
      const result = await fetchIssues(
        { ...filters, repo, minStars: 0 },
        token,
        page,
        perPage,
      );
      allItems = allItems.concat(result.items);
      totalCount += result.totalCount;
      if (
        result.rateLimitRemaining !== null &&
        (rateLimitRemaining === null ||
          result.rateLimitRemaining < rateLimitRemaining)
      ) {
        rateLimitRemaining = result.rateLimitRemaining;
      }
      if (result.rateLimitReset) rateLimitReset = result.rateLimitReset;
    } catch (err) {
      const error = err as GitHubAPIError | Error;
      errors.push({
        repo,
        error: error?.message ?? String(err),
        status: (error as GitHubAPIError)?.status,
      });
      if (
        (error as GitHubAPIError)?.isRateLimit ||
        (error as GitHubAPIError)?.status === 429
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

  const sortParam: SortBy = filters.sortBy ?? 'reactions';
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
