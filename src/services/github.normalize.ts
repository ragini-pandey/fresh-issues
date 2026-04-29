import type {
  GraphQLIssueNode,
  Issue,
  RestIssue,
  SearchFilters,
} from '../types';

/**
 * Build the GitHub search query string from a filters object.
 */
export function buildSearchQuery(filters: SearchFilters): string {
  const parts: string[] = ['is:issue', 'is:open'];

  // Stars filter is skipped when scoping to a specific repo
  if (!filters.repo && (filters.minStars ?? 0) > 0) {
    parts.push(`stars:>=${filters.minStars}`);
  }
  if ((filters.minComments ?? 0) > 0) {
    parts.push(`comments:>=${filters.minComments}`);
  }

  filters.labels?.forEach((label) => parts.push(`label:"${label}"`));

  if (filters.language) parts.push(`language:${filters.language}`);
  if (filters.createdAfter) parts.push(`created:>${filters.createdAfter}`);
  if (filters.keyword) parts.push(filters.keyword);
  if (filters.repo) parts.push(`repo:${filters.repo}`);
  if (filters.noAssignee) parts.push('no:assignee');

  return parts.join(' ');
}

/**
 * Normalize a raw GitHub REST API issue into the flat shape used by the UI.
 */
export function normalizeIssue(issue: RestIssue): Issue {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    repoUrl: issue.repository_url,
    repoFullName: issue.repository_url.replace(
      'https://api.github.com/repos/',
      '',
    ),
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
    reactions: issue.reactions?.total_count ?? 0,
  };
}

/**
 * Normalize a GitHub GraphQL issue node into the same flat shape as normalizeIssue.
 */
export function normalizeGraphQLIssue(node: GraphQLIssueNode): Issue {
  return {
    id: node.databaseId,
    number: node.number,
    title: node.title,
    url: node.url,
    repoUrl: `https://api.github.com/repos/${node.repository.nameWithOwner}`,
    repoFullName: node.repository.nameWithOwner,
    labels: (node.labels?.nodes ?? []).map((l) => ({
      name: l.name,
      color: l.color,
    })),
    user: {
      login: node.author?.login ?? 'ghost',
      avatar: node.author?.avatarUrl ?? '',
      url: node.author?.url ?? '',
    },
    comments: node.comments?.totalCount ?? 0,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    body: node.bodyText ? node.bodyText.slice(0, 300) : '',
    state: node.state?.toLowerCase() ?? 'open',
    assignee: node.assignees?.nodes?.[0] ?? null,
    reactions: node.reactions?.totalCount ?? 0,
  };
}

/**
 * Get the ISO date string representing `minutes` ago from now.
 */
export function getTimeAgo(minutes: number): string {
  const d = new Date(Date.now() - minutes * 60 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
