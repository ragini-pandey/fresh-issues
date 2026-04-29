// Shared domain types for the GitHub service + UI layers.

export interface IssueLabel {
  name: string;
  color: string;
}

export interface IssueUser {
  login: string;
  avatar: string;
  url: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  url: string;
  repoUrl: string;
  repoFullName: string;
  labels: IssueLabel[];
  user: IssueUser;
  comments: number;
  createdAt: string;
  updatedAt: string;
  body: string;
  state: string;
  assignee: { login: string } | null;
  reactions: number;
}

export interface SearchFilters {
  labels?: string[];
  language?: string;
  timeWindow?: number;
  createdAfter?: string;
  keyword?: string;
  repo?: string;
  noAssignee?: boolean;
  minStars?: number;
  minComments?: number;
  sortBy?: SortBy;
}

export type SortBy =
  | 'reactions'
  | 'comments'
  | 'created'
  | 'updated'
  | 'repo-order';

export interface RepoFetchError {
  repo: string;
  error: string;
  status?: number;
}

export interface FetchIssuesResult {
  totalCount: number;
  items: Issue[];
  rateLimitRemaining: number | null;
  rateLimitReset: number | Date | null;
}

export interface FetchIssuesForReposResult extends FetchIssuesResult {
  errors: RepoFetchError[];
}

export interface TrackedRepo {
  id: string;
  fullName: string;
  addedAt: string;
  disabled: boolean;
}

export interface Theme {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

// ─── Raw GitHub REST shapes (only the subset we consume) ──────────────────────

export interface RestIssueLabel {
  name: string;
  color: string;
}

export interface RestIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  labels: RestIssueLabel[];
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  comments: number;
  created_at: string;
  updated_at: string;
  body: string | null;
  state: string;
  assignee: { login: string } | null;
  reactions?: { total_count: number };
}

// ─── Raw GitHub GraphQL shapes ────────────────────────────────────────────────

export interface GraphQLIssueNode {
  databaseId: number;
  number: number;
  title: string;
  url: string;
  bodyText: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
  comments?: { totalCount: number };
  reactions?: { totalCount: number };
  labels?: { nodes: IssueLabel[] };
  author?: {
    login: string;
    avatarUrl: string;
    url: string;
  } | null;
  assignees?: { nodes: { login: string }[] };
  repository: { nameWithOwner: string; url: string };
}

export interface RateLimitInfo {
  remaining: number | null;
  reset: number | Date | null;
}
