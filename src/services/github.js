const GITHUB_API = 'https://api.github.com';

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

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `GitHub API error: ${res.status}`);
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
    return { totalCount: 0, items: [], rateLimitRemaining: null, rateLimitReset: null };
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

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems = allItems.concat(result.value.items);
      totalCount += result.value.totalCount;
      if (rateLimitRemaining === null || result.value.rateLimitRemaining < rateLimitRemaining) {
        rateLimitRemaining = result.value.rateLimitRemaining;
      }
      if (result.value.rateLimitReset) {
        rateLimitReset = result.value.rateLimitReset;
      }
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

  return { totalCount, items: unique, rateLimitRemaining, rateLimitReset };
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
