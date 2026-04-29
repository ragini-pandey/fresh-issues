import type { SortBy } from '../types';

// ─── API endpoints ────────────────────────────────────────────────────────────
export const GITHUB_API = 'https://api.github.com';
export const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

// ─── Throttle ─────────────────────────────────────────────────────────────────
/** Minimum gap between consecutive HTTP requests (ms). Safe for GitHub's secondary rate limit. */
export const MIN_REQUEST_INTERVAL = 800;

// ─── Cache ────────────────────────────────────────────────────────────────────
/** TTL for in-memory cache entries (ms). ETags extend perceived freshness beyond this. */
export const CACHE_DURATION = 120_000; // 2 minutes

// ─── GraphQL ──────────────────────────────────────────────────────────────────
/** Maximum repos bundled into a single batched GraphQL query (keeps complexity in check). */
export const GQL_BATCH_SIZE = 10;

/** Maps sortBy values → GraphQL search sort qualifier strings. */
export const SORT_QUALIFIER: Record<string, string> = {
  reactions: 'sort:reactions-desc',
  comments: 'sort:comments-desc',
  created: 'sort:created-desc',
  updated: 'sort:updated-desc',
};

/**
 * Issue fields requested in every GraphQL query – single source of truth.
 * Used both in the paginated SEARCH_ISSUES_QUERY and in batched aliases.
 */
export const GQL_ISSUE_FIELDS = `
  databaseId number title url bodyText state createdAt updatedAt
  comments    { totalCount }
  reactions   { totalCount }
  labels(first: 10) { nodes { name color } }
  author      { login avatarUrl url }
  assignees(first: 1) { nodes { login } }
  repository  { nameWithOwner url }
`;

/** Reusable paginated issue-search query used by fetchIssuesGraphQL. */
export const SEARCH_ISSUES_QUERY = `
  query SearchIssues($query: String!, $first: Int!, $after: String) {
    rateLimit { remaining resetAt cost }
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      issueCount
      pageInfo { endCursor hasNextPage }
      nodes {
        ... on Issue {
          databaseId number title url bodyText state createdAt updatedAt
          comments    { totalCount }
          reactions   { totalCount }
          labels(first: 10) { nodes { name color } }
          author      { login avatarUrl url }
          assignees(first: 1) { nodes { login } }
          repository  { nameWithOwner url }
        }
      }
    }
  }
`;

// ─── UI presets (consumed by filter components) ───────────────────────────────

/** Predefined label sets that indicate beginner-friendly issues. */
export const POPULAR_LABELS: readonly string[] = [
  'good first issue',
  'help wanted',
  'bug',
  'enhancement',
] as const;

/** Popular languages for filtering. */
export const LANGUAGES: readonly string[] = [
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
] as const;

export interface LabeledOption<V = number> {
  label: string;
  value: V;
}

/** Time window presets (in minutes). */
export const TIME_WINDOWS: readonly LabeledOption<number>[] = [
  { label: 'Last 1 hour', value: 60 },
  { label: 'Last 8 hours', value: 480 },
  { label: 'Last 24 hours', value: 1440 },
  { label: 'Last 7 days', value: 10080 },
  { label: 'Any time', value: 0 },
];

/** Minimum star presets for filtering repos by popularity. */
export const STAR_PRESETS: readonly LabeledOption<number>[] = [
  { label: 'Any', value: 0 },
  { label: '100+', value: 100 },
  { label: '1k+', value: 1000 },
  { label: '5k+', value: 5000 },
  { label: '10k+', value: 10000 },
];

export interface SortOption extends LabeledOption<SortBy> {
  reposOnly?: boolean;
}

/** Sort options for issue results. */
export const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Repo order', value: 'repo-order', reposOnly: true },
  { label: 'Most reactions', value: 'reactions' },
  { label: 'Most comments', value: 'comments' },
  { label: 'Newest', value: 'created' },
  { label: 'Recently updated', value: 'updated' },
];

/** Minimum comments presets. */
export const COMMENT_PRESETS: readonly LabeledOption<number>[] = [
  { label: 'Any', value: 0 },
  { label: '1+', value: 1 },
  { label: '5+', value: 5 },
  { label: '10+', value: 10 },
  { label: '25+', value: 25 },
];
