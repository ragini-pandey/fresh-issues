import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSearchQuery,
  normalizeIssue,
  normalizeGraphQLIssue,
  getTimeAgo,
} from './github.normalize';

describe('buildSearchQuery', () => {
  it('always includes is:issue and is:open', () => {
    const q = buildSearchQuery({});
    expect(q).toContain('is:issue');
    expect(q).toContain('is:open');
  });

  it('appends stars filter when minStars > 0 and no repo scope', () => {
    expect(buildSearchQuery({ minStars: 100 })).toContain('stars:>=100');
  });

  it('omits stars filter when scoped to a repo', () => {
    const q = buildSearchQuery({ minStars: 100, repo: 'octocat/hello' });
    expect(q).not.toContain('stars:');
    expect(q).toContain('repo:octocat/hello');
  });

  it('appends comments filter when minComments > 0', () => {
    expect(buildSearchQuery({ minComments: 5 })).toContain('comments:>=5');
  });

  it('quotes labels and supports multiple', () => {
    const q = buildSearchQuery({ labels: ['good first issue', 'help wanted'] });
    expect(q).toContain('label:"good first issue"');
    expect(q).toContain('label:"help wanted"');
  });

  it('appends language, createdAfter, keyword, and noAssignee', () => {
    const q = buildSearchQuery({
      language: 'javascript',
      createdAfter: '2024-01-01',
      keyword: 'bug',
      noAssignee: true,
    });
    expect(q).toContain('language:javascript');
    expect(q).toContain('created:>2024-01-01');
    expect(q).toContain('bug');
    expect(q).toContain('no:assignee');
  });

  it('skips optional fields when not provided', () => {
    const q = buildSearchQuery({});
    expect(q).not.toContain('language:');
    expect(q).not.toContain('created:>');
    expect(q).not.toContain('no:assignee');
  });
});

describe('normalizeIssue', () => {
  const raw = {
    id: 1,
    number: 42,
    title: 'Hello',
    html_url: 'https://github.com/octocat/hello/issues/42',
    repository_url: 'https://api.github.com/repos/octocat/hello',
    labels: [{ name: 'bug', color: 'ff0000' }],
    user: {
      login: 'octocat',
      avatar_url: 'https://avatars/octocat.png',
      html_url: 'https://github.com/octocat',
    },
    comments: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    body: 'a'.repeat(500),
    state: 'open',
    assignee: null,
    reactions: { total_count: 7 },
  };

  it('flattens REST issue shape', () => {
    const n = normalizeIssue(raw);
    expect(n.id).toBe(1);
    expect(n.number).toBe(42);
    expect(n.title).toBe('Hello');
    expect(n.url).toBe(raw.html_url);
    expect(n.repoFullName).toBe('octocat/hello');
    expect(n.labels).toEqual([{ name: 'bug', color: 'ff0000' }]);
    expect(n.user).toEqual({
      login: 'octocat',
      avatar: raw.user.avatar_url,
      url: raw.user.html_url,
    });
    expect(n.comments).toBe(3);
    expect(n.reactions).toBe(7);
  });

  it('truncates body to 300 chars', () => {
    const n = normalizeIssue(raw);
    expect(n.body).toHaveLength(300);
  });

  it('handles missing body and reactions', () => {
    const n = normalizeIssue({ ...raw, body: null, reactions: undefined });
    expect(n.body).toBe('');
    expect(n.reactions).toBe(0);
  });
});

describe('normalizeGraphQLIssue', () => {
  const node = {
    databaseId: 100,
    number: 7,
    title: 'GQL issue',
    url: 'https://github.com/octocat/hello/issues/7',
    bodyText: 'b'.repeat(400),
    state: 'OPEN',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    comments: { totalCount: 2 },
    reactions: { totalCount: 5 },
    labels: { nodes: [{ name: 'enhancement', color: '00ff00' }] },
    author: {
      login: 'alice',
      avatarUrl: 'https://avatars/alice.png',
      url: 'https://github.com/alice',
    },
    assignees: { nodes: [{ login: 'bob' }] },
    repository: { nameWithOwner: 'octocat/hello', url: '' },
  };

  it('maps GraphQL node to normalized shape', () => {
    const n = normalizeGraphQLIssue(node);
    expect(n.id).toBe(100);
    expect(n.repoFullName).toBe('octocat/hello');
    expect(n.repoUrl).toBe('https://api.github.com/repos/octocat/hello');
    expect(n.labels).toEqual([{ name: 'enhancement', color: '00ff00' }]);
    expect(n.user.login).toBe('alice');
    expect(n.state).toBe('open');
    expect(n.assignee).toEqual({ login: 'bob' });
    expect(n.comments).toBe(2);
    expect(n.reactions).toBe(5);
  });

  it('truncates bodyText to 300 chars', () => {
    expect(normalizeGraphQLIssue(node).body).toHaveLength(300);
  });

  it('falls back to ghost author when author is null', () => {
    const n = normalizeGraphQLIssue({ ...node, author: null });
    expect(n.user.login).toBe('ghost');
    expect(n.user.avatar).toBe('');
    expect(n.user.url).toBe('');
  });

  it('returns null assignee when none', () => {
    const n = normalizeGraphQLIssue({ ...node, assignees: { nodes: [] } });
    expect(n.assignee).toBeNull();
  });

  it('handles missing optional collections', () => {
    const n = normalizeGraphQLIssue({
      ...node,
      labels: undefined,
      comments: undefined,
      reactions: undefined,
      assignees: undefined,
      bodyText: '',
      state: undefined,
    });
    expect(n.labels).toEqual([]);
    expect(n.comments).toBe(0);
    expect(n.reactions).toBe(0);
    expect(n.assignee).toBeNull();
    expect(n.body).toBe('');
    expect(n.state).toBe('open');
  });
});

describe('getTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns ISO without millisecond fractional part', () => {
    expect(getTimeAgo(60)).toBe('2024-06-01T11:00:00Z');
  });

  it('subtracts the given minutes', () => {
    expect(getTimeAgo(0)).toBe('2024-06-01T12:00:00Z');
    expect(getTimeAgo(1440)).toBe('2024-05-31T12:00:00Z');
  });
});
