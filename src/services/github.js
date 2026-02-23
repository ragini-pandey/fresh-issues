/**
 * github.js – public entry-point for the GitHub service layer.
 *
 * This file is intentionally thin: it wires together the focused sub-modules
 * and exposes the two public async functions plus all UI constants.
 *
 * Sub-modules (import from this file, not from individual sub-modules):
 *   github.constants.js  – API URLs, throttle/cache settings, GraphQL strings, UI presets
 *   github.error.js      – GitHubAPIError class
 *   github.throttle.js   – request queue, spacing, Retry-After back-off
 *   github.cache.js      – TTL + ETag in-memory cache
 *   github.normalize.js  – buildSearchQuery, normalizeIssue, normalizeGraphQLIssue, getTimeAgo
 *   github.graphql.js    – graphqlRequest, fetchIssuesGraphQL, fetchIssuesForReposGraphQL
 */
import { GITHUB_API }                                     from './github.constants.js';
import { GitHubAPIError }                                 from './github.error.js';
import { setRetryAfterUntil, getRetryAfterUntil }         from './github.throttle.js';
import { getCached }                                      from './github.cache.js';
import { buildSearchQuery, normalizeIssue }               from './github.normalize.js';
import { fetchIssuesGraphQL, fetchIssuesForReposGraphQL } from './github.graphql.js';

// ─── Re-exports ───────────────────────────────────────────────────────────────
// Consumers import from 'services/github' – no need to know about sub-modules.
export { getTimeAgo } from './github.normalize.js';
export {
  POPULAR_LABELS,
  LANGUAGES,
  TIME_WINDOWS,
  STAR_PRESETS,
  SORT_OPTIONS,
  COMMENT_PRESETS,
} from './github.constants.js';

// ─── fetchIssues ──────────────────────────────────────────────────────────────

/**
 * Fetch issues from GitHub.
 *
 * Strategy:
 *   • With token  → GraphQL (fewer requests, point-based quota, richer data)
 *   • No token    → REST Search API with ETag conditional GETs
 *
 * @param {Object} filters   - Search filters built by the caller.
 * @param {string} [token]   - GitHub personal access token.
 * @param {number} [page=1]
 * @param {number} [perPage=30]
 * @returns {Promise<{ totalCount, items, rateLimitRemaining, rateLimitReset }>}
 */
export async function fetchIssues(filters = {}, token = '', page = 1, perPage = 30) {
  const query     = buildSearchQuery(filters);
  const sortParam = filters.sortBy || 'reactions';

  // ── GraphQL path (token required) ─────────────────────────────────────────
  if (token) return fetchIssuesGraphQL(query, sortParam, token, page, perPage);

  // ── REST fallback (unauthenticated) ───────────────────────────────────────
  const url      = `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&sort=${sortParam}&order=desc&page=${page}&per_page=${perPage}`;
  const cacheKey = `issues:${query}:${sortParam}:${page}:${perPage}`;
  const headers  = { Accept: 'application/vnd.github+json' };

  const makeRequest = async (etag = null) => {
    const reqHeaders = { ...headers };
    if (etag) reqHeaders['If-None-Match'] = etag;

    let res;
    try {
      res = await fetch(url, { headers: reqHeaders });
    } catch (err) {
      throw new GitHubAPIError(
        'Network error: Unable to connect to GitHub API. Please check your internet connection.',
        0, null, { originalError: err.message },
      );
    }

    // 304 Not Modified – tell getCached to reuse the existing entry
    if (res.status === 304) return { notModified: true, data: null, etag: null };

    if (!res.ok) {
      let errorData = {};
      try { errorData = await res.json(); } catch { /* ignore */ }

      const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
      const rateLimitReset     = res.headers.get('x-ratelimit-reset');
      const resetDate          = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : null;

      // Respect Retry-After header (present on 429 and some 403 responses)
      const retryAfterHeader = res.headers.get('retry-after');
      if (retryAfterHeader) {
        const waitSec = parseInt(retryAfterHeader, 10);
        if (!isNaN(waitSec) && waitSec > 0) setRetryAfterUntil(Date.now() + waitSec * 1_000);
      }

      let errorMessage;
      let userMessage;

      switch (res.status) {
        case 401:
          errorMessage = 'Authentication failed: Invalid or expired GitHub token.';
          userMessage  = 'Your GitHub token is invalid or has expired. Please update it in Settings.';
          break;

        case 403: {
          const isSecondaryRateLimit =
            errorData.message?.includes('secondary rate limit') ||
            errorData.documentation_url?.includes('secondary-rate-limits');
          const isPrimaryRateLimit =
            errorData.message?.includes('rate limit') || rateLimitRemaining === '0';

          if (isSecondaryRateLimit) {
            errorMessage = 'Secondary rate limit exceeded.';
            userMessage  = 'You\'re making requests too quickly. The app will automatically slow down. Please wait 2-5 minutes before trying again.';
            if (getRetryAfterUntil() <= Date.now()) setRetryAfterUntil(Date.now() + 60_000);
          } else if (isPrimaryRateLimit) {
            const resetTime = resetDate ? resetDate.toLocaleTimeString() : 'soon';
            errorMessage = `Rate limit exceeded. Resets at ${resetTime}.`;
            userMessage  = `API rate limit exceeded without authentication. Add a GitHub token in Settings for 5,000 requests/hour (resets at ${resetTime}).`;
          } else if (errorData.message?.includes('abuse')) {
            errorMessage = 'GitHub abuse detection triggered.';
            userMessage  = 'Too many requests detected. Please wait a few minutes before trying again.';
          } else {
            errorMessage = errorData.message || 'Access forbidden.';
            userMessage  = 'Access denied by GitHub API. This may be due to authentication issues or repository access restrictions.';
          }
          break;
        }

        case 404:
          errorMessage = 'Repository or resource not found.';
          userMessage  = 'The requested repository or resource could not be found. Please check the repository name.';
          break;

        case 422:
          errorMessage = errorData.message || 'Invalid request parameters.';
          userMessage  = `Invalid search query: ${errorData.message || 'Please check your filters and try again.'}`;
          break;

        case 503:
          errorMessage = 'GitHub service unavailable.';
          userMessage  = 'GitHub is temporarily unavailable. Please try again in a few moments.';
          break;

        default:
          errorMessage = errorData.message || `GitHub API error: ${res.status}`;
          userMessage  = `An error occurred while fetching issues (${res.status}). ${errorData.message || 'Please try again.'}`;
      }

      throw new GitHubAPIError(userMessage, res.status, errorData, {
        technicalMessage: errorMessage,
        rateLimitRemaining,
        rateLimitReset: resetDate,
        documentationUrl: errorData.documentation_url,
        isSecondaryRateLimit:
          res.status === 403 &&
          (errorData.message?.includes('secondary rate limit') ||
           errorData.documentation_url?.includes('secondary-rate-limits')),
      });
    }

    const data         = await res.json();
    const responseEtag = res.headers.get('etag');

    return {
      notModified: false,
      etag: responseEtag,
      data: {
        totalCount:         data.total_count,
        items:              data.items.map(normalizeIssue),
        rateLimitRemaining: parseInt(res.headers.get('x-ratelimit-remaining') || '0', 10),
        rateLimitReset:     parseInt(res.headers.get('x-ratelimit-reset')     || '0', 10),
      },
    };
  };

  return getCached(cacheKey, makeRequest);
}

// ─── fetchIssuesForRepos ──────────────────────────────────────────────────────

/**
 * Fetch issues across multiple tracked repositories.
 *
 * Strategy:
 *   • With token  → batched GraphQL (N repos → ≤ ceil(N/10) requests)
 *   • No token    → sequential REST calls (one per repo, throttle-spaced)
 *
 * @param {string[]} repoNames - Array of "owner/repo" strings.
 * @param {Object}   [filters]
 * @param {string}   [token]
 * @param {number}   [page=1]
 * @param {number}   [perPage=10]
 * @returns {Promise<{ totalCount, items, rateLimitRemaining, rateLimitReset, errors }>}
 */
export async function fetchIssuesForRepos(repoNames, filters = {}, token = '', page = 1, perPage = 10) {
  if (!repoNames?.length) {
    return { totalCount: 0, items: [], rateLimitRemaining: null, rateLimitReset: null, errors: [] };
  }

  // ── GraphQL batched path ───────────────────────────────────────────────────
  if (token) return fetchIssuesForReposGraphQL(repoNames, filters, token, page, perPage);

  // ── REST sequential fallback ───────────────────────────────────────────────
  // Sequential, not Promise.all – avoids concurrent burst that triggers secondary RL.
  let allItems           = [];
  let totalCount         = 0;
  let rateLimitRemaining = null;
  let rateLimitReset     = null;
  const errors           = [];

  for (const repo of repoNames) {
    try {
      const result = await fetchIssues({ ...filters, repo, minStars: 0 }, token, page, perPage);
      allItems       = allItems.concat(result.items);
      totalCount    += result.totalCount;
      if (rateLimitRemaining === null || result.rateLimitRemaining < rateLimitRemaining) {
        rateLimitRemaining = result.rateLimitRemaining;
      }
      if (result.rateLimitReset) rateLimitReset = result.rateLimitReset;
    } catch (err) {
      errors.push({ repo, error: err?.message || String(err), status: err?.status });
      // Stop immediately if GitHub is rate-limiting – no point continuing
      if (err?.isRateLimit || err?.status === 429) break;
    }
  }

  // Deduplicate by issue id
  const seen   = new Set();
  const unique = [];
  for (const item of allItems) {
    if (!seen.has(item.id)) { seen.add(item.id); unique.push(item); }
  }

  const sortParam = filters.sortBy || 'reactions';
  unique.sort((a, b) => {
    if (sortParam === 'comments') return b.comments - a.comments;
    if (sortParam === 'created')  return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortParam === 'updated')  return new Date(b.updatedAt) - new Date(a.updatedAt);
    return b.reactions - a.reactions || new Date(b.createdAt) - new Date(a.createdAt);
  });

  return { totalCount, items: unique, rateLimitRemaining, rateLimitReset, errors };
}
