import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchIssues,
  fetchIssuesForRepos,
  getTimeAgo,
} from '../services/github';
import type {
  FetchIssuesForReposResult,
  Issue,
  RateLimitInfo,
  SearchFilters,
  TrackedRepo,
} from '../types';
import { GitHubAPIError } from '../services/github.error';

export interface UseIssuesResult {
  issues: Issue[];
  loading: boolean;
  error: string | null;
  warnings: string[];
  totalCount: number;
  rateLimit: RateLimitInfo;
  lastRefresh: Date | null;
  filters: SearchFilters;
  updateFilters: (partial: Partial<SearchFilters>) => void;
  search: (pageNum?: number, append?: boolean) => Promise<void>;
  refresh: () => void;
  loadMore: () => void;
  page: number;
  token: string;
  setToken: (t: string) => void;
  sound: boolean;
  setSound: (b: boolean) => void;
  newIds: Set<number>;
  clearNewIds: () => void;
}

const DEFAULT_FILTERS: SearchFilters = {
  labels: [],
  language: '',
  timeWindow: 1440,
  keyword: '',
  repo: '',
  noAssignee: true,
  minStars: 0,
  sortBy: 'created',
  minComments: 0,
};

export function useIssues(savedRepos: TrackedRepo[] = []): UseIssuesResult {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({
    remaining: null,
    reset: null,
  });
  const [page, setPage] = useState(1);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  const [token, setToken] = useState<string>(
    () => localStorage.getItem('gh_token') ?? '',
  );
  const [sound, setSound] = useState(false);

  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (token) localStorage.setItem('gh_token', token);
    else localStorage.removeItem('gh_token');
  }, [token]);

  const search = useCallback(
    async (pageNum = 1, append = false): Promise<void> => {
      setLoading(true);
      setError(null);
      setWarnings([]);
      try {
        const searchFilters: SearchFilters = { ...filters };
        if ((filters.timeWindow ?? 0) > 0) {
          searchFilters.createdAfter = getTimeAgo(filters.timeWindow!);
        }
        delete searchFilters.timeWindow;

        const enabledRepos = savedRepos.filter((r) => !r.disabled);
        const result =
          enabledRepos.length > 0
            ? await fetchIssuesForRepos(
                enabledRepos.map((r) => r.fullName),
                searchFilters,
                token,
                pageNum,
              )
            : savedRepos.length > 0
              ? ({
                  items: [],
                  totalCount: 0,
                  rateLimitRemaining: null,
                  rateLimitReset: null,
                  errors: [],
                } satisfies FetchIssuesForReposResult)
              : await fetchIssues(searchFilters, token, pageNum);

        const items = result.items;

        const repoErrors =
          'errors' in result
            ? (result as FetchIssuesForReposResult).errors
            : [];
        if (repoErrors.length > 0) {
          const errorWarnings = repoErrors.map(
            (err) => `${err.repo}: ${err.error}`,
          );
          setWarnings(errorWarnings);

          if (items.length === 0 && savedRepos.length > 0) {
            // Promote auth failures so the UI shows the "update token" CTA
            // instead of a noisy per-repo "Bad credentials" message.
            const authError = repoErrors.find(
              (e) =>
                e.status === 401 ||
                /bad credentials/i.test(e.error) ||
                /token/i.test(e.error),
            );
            if (authError) {
              if (token) setToken('');
              throw new Error(
                'Your GitHub token is invalid or has expired. Please update it in Settings.',
              );
            }
            throw new Error(
              'Failed to fetch issues from all tracked repositories. ' +
                errorWarnings[0],
            );
          }
        }

        if (!isFirstLoad.current) {
          const currentNewIds = new Set<number>();
          items.forEach((issue) => {
            if (!seenIds.has(issue.id)) currentNewIds.add(issue.id);
          });
          if (currentNewIds.size > 0 && sound) playNotificationSound();
          setNewIds(currentNewIds);
        }

        const updatedSeen = new Set(seenIds);
        items.forEach((issue) => updatedSeen.add(issue.id));
        setSeenIds(updatedSeen);

        if (append) setIssues((prev) => [...prev, ...items]);
        else setIssues(items);

        setTotalCount(result.totalCount);
        setRateLimit({
          remaining: result.rateLimitRemaining,
          reset: result.rateLimitReset,
        });
        setLastRefresh(new Date());
        setPage(pageNum);
        isFirstLoad.current = false;
      } catch (err) {
        console.error('GitHub API Error:', err);

        const apiErr = err as GitHubAPIError;
        if (apiErr?.details?.rateLimitReset) {
          setRateLimit({
            remaining: 0,
            reset: apiErr.details.rateLimitReset,
          });
        }
        // If the stored token is rejected, drop it so subsequent requests
        // fall back to anonymous mode instead of looping on 401s.
        if (apiErr?.status === 401 && token) {
          setToken('');
        }
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while fetching issues.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [filters, token, seenIds, sound, savedRepos],
  );

  // Initial search
  useEffect(() => {
    void search(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    void search(page + 1, true);
  }, [search, page]);

  const refresh = useCallback(() => {
    isFirstLoad.current = false;
    void search(1);
  }, [search]);

  const updateFilters = useCallback((partial: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearNewIds = useCallback(() => {
    setNewIds(new Set());
  }, []);

  return {
    issues,
    loading,
    error,
    warnings,
    totalCount,
    rateLimit,
    lastRefresh,
    filters,
    updateFilters,
    search,
    refresh,
    loadMore,
    page,
    token,
    setToken,
    sound,
    setSound,
    newIds,
    clearNewIds,
  };
}

interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function playNotificationSound(): void {
  try {
    const w = window as AudioContextWindow;
    const Ctor = window.AudioContext || w.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore audio errors
  }
}
