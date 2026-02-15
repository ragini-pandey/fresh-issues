const GITHUB_API = 'https://api.github.com';

/**
 * Custom error class for GitHub API errors with detailed information.
 */
class GitHubAPIError extends Error {
  constructor(message, status, response, details = {}) {
    super(message);
    this.name = 'GitHubAPIError';
    this.status = status;
    this.response = response;
    this.details = details;
  }
}

/**
 * Build the GitHub search query string from filters.
 */
function buildSearchQuery(filters) {
  const parts = ['is:issue', 'is:open'];

  // Filter by minimum stars (skip when searching a specific repo)
  if (!filters.repo && filters.minStars > 0) {
    parts.push(`stars:>=${filters.minStars}`);
  }

  // Filter by minimum comments
  if (filters.minComments > 0) {
    parts.push(`comments:>=${filters.minComments}`);
  }

  if (filters.labels && filters.labels.length > 0) {
    filters.labels.forEach((label) => {
      parts.push(`label:"${label}"`);
    });
  }

  if (filters.language) {
    parts.push(`language:${filters.language}`);
  }

  if (filters.createdAfter) {
    parts.push(`created:>${filters.createdAfter}`);
  }

  if (filters.keyword) {
    parts.push(filters.keyword);
  }

  if (filters.repo) {
    parts.push(`repo:${filters.repo}`);
  }

  if (filters.noAssignee) {
    parts.push('no:assignee');
  }

  return parts.join(' ');
}

/**
 * Fetch issues from GitHub Search API, sorted by most popular repos (reactions as proxy).
 * @param {Object} filters - Search filters
 * @param {string} [token] - Optional GitHub personal access token for higher rate limits
 * @param {number} [page=1] - Page number
 * @param {number} [perPage=30] - Results per page
 */
export async function fetchIssues(filters = {}, token = '', page = 1, perPage = 30) {
  const query = buildSearchQuery(filters);
  const sortParam = filters.sortBy || 'reactions';
  const url = `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&sort=${sortParam}&order=desc&page=${page}&per_page=${perPage}`;

  const headers = {
    Accept: 'application/vnd.github+json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    throw new GitHubAPIError(
      'Network error: Unable to connect to GitHub API. Please check your internet connection.',
      0,
      null,
      { originalError: err.message }
    );
  }

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      errorData = {};
    }

    // Extract rate limit info if available
    const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
    const rateLimitReset = res.headers.get('x-ratelimit-reset');
    const resetDate = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : null;

    // Build detailed error message based on status code
    let errorMessage;
    let userMessage;

    switch (res.status) {
      case 401:
        errorMessage = 'Authentication failed: Invalid or expired GitHub token.';
        userMessage = 'Your GitHub token is invalid or has expired. Please update it in Settings.';
        break;

      case 403:
        if (errorData.message?.includes('rate limit') || rateLimitRemaining === '0') {
          const resetTime = resetDate ? resetDate.toLocaleTimeString() : 'soon';
          errorMessage = `Rate limit exceeded. Resets at ${resetTime}.`;
          userMessage = token
            ? `API rate limit exceeded. Your limit will reset at ${resetTime}. Try again later.`
            : `API rate limit exceeded without authentication. Add a GitHub token in Settings for 5,000 requests/hour (resets at ${resetTime}).`;
        } else if (errorData.message?.includes('abuse')) {
          errorMessage = 'GitHub abuse detection triggered.';
          userMessage = 'Too many requests detected. Please wait a few minutes before trying again.';
        } else {
          errorMessage = errorData.message || 'Access forbidden.';
          userMessage = 'Access denied by GitHub API. This may be due to authentication issues or repository access restrictions.';
        }
        break;

      case 404:
        errorMessage = 'Repository or resource not found.';
        userMessage = 'The requested repository or resource could not be found. Please check the repository name.';
        break;

      case 422:
        errorMessage = errorData.message || 'Invalid request parameters.';
        userMessage = `Invalid search query: ${errorData.message || 'Please check your filters and try again.'}`;
        break;

      case 503:
        errorMessage = 'GitHub service unavailable.';
        userMessage = 'GitHub is temporarily unavailable. Please try again in a few moments.';
        break;

      default:
        errorMessage = errorData.message || `GitHub API error: ${res.status}`;
        userMessage = `An error occurred while fetching issues (${res.status}). ${errorData.message || 'Please try again.'}`;
    }

    throw new GitHubAPIError(
      userMessage,
      res.status,
      errorData,
      {
        technicalMessage: errorMessage,
        rateLimitRemaining,
        rateLimitReset: resetDate,
        documentationUrl: errorData.documentation_url,
      }
    );
  }

  const data = await res.json();

  const items = data.items.map(normalizeIssue);

  return {
    totalCount: data.total_count,
    items,
    rateLimitRemaining: parseInt(res.headers.get('x-ratelimit-remaining') || '0', 10),
    rateLimitReset: parseInt(res.headers.get('x-ratelimit-reset') || '0', 10),
  };
}

/**
 * Fetch issues across multiple repos in parallel, merge and deduplicate results.
 * @param {string[]} repoNames - Array of "owner/repo" strings
 * @param {Object} filters - Search filters (repo field will be overridden per call)
 * @param {string} [token] - Optional GitHub token
 * @param {number} [page=1] - Page number
 * @param {number} [perPage=10] - Results per repo
 */
export async function fetchIssuesForRepos(repoNames, filters = {}, token = '', page = 1, perPage = 10) {
  if (!repoNames || repoNames.length === 0) {
    return { totalCount: 0, items: [], rateLimitRemaining: null, rateLimitReset: null, errors: [] };
  }

  const results = await Promise.allSettled(
    repoNames.map((repo) =>
      fetchIssues({ ...filters, repo, minStars: 0 }, token, page, perPage)
    )
  );

  let allItems = [];
  let totalCount = 0;
  let rateLimitRemaining = null;
  let rateLimitReset = null;
  const errors = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allItems = allItems.concat(result.value.items);
      totalCount += result.value.totalCount;
      if (rateLimitRemaining === null || result.value.rateLimitRemaining < rateLimitRemaining) {
        rateLimitRemaining = result.value.rateLimitRemaining;
      }
      if (result.value.rateLimitReset) {
        rateLimitReset = result.value.rateLimitReset;
      }
    } else {
      // Track errors for each failed repo
      errors.push({
        repo: repoNames[i],
        error: result.reason?.message || result.reason?.toString() || 'Unknown error',
        status: result.reason?.status,
      });
    }
  }

  // Deduplicate by issue id
  const seen = new Set();
  const unique = [];
  for (const item of allItems) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }

  // Sort by reactions descending, then newest
  const sortParam = filters.sortBy || 'reactions';
  unique.sort((a, b) => {
    if (sortParam === 'comments') return b.comments - a.comments;
    if (sortParam === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortParam === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt);
    return b.reactions - a.reactions || new Date(b.createdAt) - new Date(a.createdAt);
  });

  return { totalCount, items: unique, rateLimitRemaining, rateLimitReset, errors };
}

/**
 * Normalize a GitHub issue into a simpler shape.
 */
function normalizeIssue(issue) {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    repoUrl: issue.repository_url,
    repoFullName: issue.repository_url.replace('https://api.github.com/repos/', ''),
    labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
    user: {
      login: issue.user.login,
      avatar: issue.user.avatar_url,
      url: issue.user.html_url,
    },
    comments: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    body: issue.body ? issue.body.slice(0, 300) : '',
    state: issue.state,
    assignee: issue.assignee,
    reactions: issue.reactions?.total_count || 0,
  };
}

/**
 * Get the ISO date string for "time ago" filtering.
 */
export function getTimeAgo(minutes) {
  const d = new Date(Date.now() - minutes * 60 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Predefined label sets that indicate beginner-friendly issues.
 */
export const POPULAR_LABELS = [
  'good first issue',
  'help wanted',
  'beginner',
  'easy',
  'starter',
  'up-for-grabs',
  'first-timers-only',
  'contributions welcome',
];

/**
 * Popular languages for filtering.
 */
export const LANGUAGES = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C++',
  'C#',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'Dart',
  'Shell',
];

/**
 * Time window presets (in minutes).
 */
export const TIME_WINDOWS = [
  { label: 'Last 5 min', value: 5 },
  { label: 'Last 15 min', value: 15 },
  { label: 'Last 30 min', value: 30 },
  { label: 'Last 1 hour', value: 60 },
  { label: 'Last 6 hours', value: 360 },
  { label: 'Last 24 hours', value: 1440 },
  { label: 'Last 7 days', value: 10080 },
  { label: 'Any time', value: 0 },
];

/**
 * Minimum star presets for filtering repos by popularity.
 */
export const STAR_PRESETS = [
  { label: 'Any', value: 0 },
  { label: '10+', value: 10 },
  { label: '50+', value: 50 },
  { label: '100+', value: 100 },
  { label: '500+', value: 500 },
  { label: '1k+', value: 1000 },
  { label: '5k+', value: 5000 },
  { label: '10k+', value: 10000 },
];

/**
 * Sort options for issue results.
 */
export const SORT_OPTIONS = [
  { label: 'Most reactions', value: 'reactions' },
  { label: 'Most comments', value: 'comments' },
  { label: 'Newest', value: 'created' },
  { label: 'Recently updated', value: 'updated' },
];

/**
 * Minimum comments presets.
 */
export const COMMENT_PRESETS = [
  { label: 'Any', value: 0 },
  { label: '1+', value: 1 },
  { label: '5+', value: 5 },
  { label: '10+', value: 10 },
  { label: '25+', value: 25 },
];
