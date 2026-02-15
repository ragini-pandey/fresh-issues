import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchIssues, fetchIssuesForRepos, getTimeAgo } from '../services/github';

const DEFAULT_POLL_INTERVAL = 60_000; // 60 seconds (reduced from 30)
const RATE_LIMITED_POLL_INTERVAL = 300_000; // 5 minutes when rate limited
const MAX_RETRY_DELAY = 300_000; // 5 minutes max
let currentRetryDelay = 0;

export function useIssues(savedRepos = []) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rateLimit, setRateLimit] = useState({ remaining: null, reset: null });
  const [page, setPage] = useState(1);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [seenIds, setSeenIds] = useState(new Set());
  const [newIds, setNewIds] = useState(new Set());

  const [filters, setFilters] = useState({
    labels: ['good first issue'],
    language: '',
    timeWindow: 1440, // default: last 24 hours
    keyword: '',
    repo: '',
    noAssignee: true,
    minStars: 0,
    sortBy: 'reactions',
    minComments: 0,
  });

  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sound, setSound] = useState(false);

  const intervalRef = useRef(null);
  const isFirstLoad = useRef(true);

  // Persist token
  useEffect(() => {
    if (token) localStorage.setItem('gh_token', token);
    else localStorage.removeItem('gh_token');
  }, [token]);

  const search = useCallback(
    async (pageNum = 1, append = false) => {
      setLoading(true);
      setError(null);
      setWarnings([]);
      try {
        const searchFilters = { ...filters };
        if (filters.timeWindow > 0) {
          searchFilters.createdAfter = getTimeAgo(filters.timeWindow);
        }
        delete searchFilters.timeWindow;

        const result = savedRepos.length > 0
          ? await fetchIssuesForRepos(
              savedRepos.map((r) => r.fullName),
              searchFilters,
              token,
              pageNum
            )
          : await fetchIssues(searchFilters, token, pageNum);
        const items = result.items;

        // Handle partial failures when fetching multiple repos
        if (result.errors && result.errors.length > 0) {
          const errorWarnings = result.errors.map(err => 
            `${err.repo}: ${err.error}`
          );
          setWarnings(errorWarnings);
          
          // If all repos failed, show it as an error
          if (items.length === 0 && savedRepos.length > 0) {
            throw new Error('Failed to fetch issues from all tracked repositories. ' + errorWarnings[0]);
          }
        }

        // Track new issues
        if (!isFirstLoad.current) {
          const currentNewIds = new Set();
          items.forEach((issue) => {
            if (!seenIds.has(issue.id)) {
              currentNewIds.add(issue.id);
            }
          });
          if (currentNewIds.size > 0 && sound) {
            playNotificationSound();
          }
          setNewIds(currentNewIds);
        }

        // Update seen IDs
        const updatedSeen = new Set(seenIds);
        items.forEach((issue) => updatedSeen.add(issue.id));
        setSeenIds(updatedSeen);

        if (append) {
          setIssues((prev) => [...prev, ...items]);
        } else {
          setIssues(items);
        }
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
        
        // Check if it's a rate limit error (primary or secondary)
        const isRateLimitError = err.isRateLimit || err.message?.includes('rate limit') || err.details?.isSecondaryRateLimit;
        
        if (isRateLimitError) {
          // Implement exponential backoff
          currentRetryDelay = currentRetryDelay === 0 ? 60_000 : Math.min(currentRetryDelay * 2, MAX_RETRY_DELAY);
          
          const waitMinutes = Math.round(currentRetryDelay / 60_000);
          setError(`${err.message || 'Rate limit exceeded.'} Auto-refresh paused for ${waitMinutes} minute(s).`);
          
          // Temporarily disable auto-refresh
          setAutoRefresh(false);
          
          // Re-enable after delay
          setTimeout(() => {
            setAutoRefresh(true);
            setError(null);
            currentRetryDelay = Math.max(0, currentRetryDelay / 2); // Gradually reduce delay
          }, currentRetryDelay);
          
          if (err.details?.rateLimitReset) {
            setRateLimit({
              remaining: 0,
              reset: err.details.rateLimitReset,
            });
          }
        } else {
          currentRetryDelay = 0; // Reset delay on non-rate-limit errors
          setError(err.message || 'An unexpected error occurred while fetching issues.');
        }
      } finally {
        setLoading(false);
      }
    },
    [filters, token, seenIds, sound, savedRepos]
  );

  // Initial search & auto-refresh
  useEffect(() => {
    search(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      // Use longer interval if we're low on rate limit or have errors
      const pollInterval = (rateLimit.remaining !== null && rateLimit.remaining < 10) || error
        ? RATE_LIMITED_POLL_INTERVAL
        : DEFAULT_POLL_INTERVAL;
      
      intervalRef.current = setInterval(() => search(1), pollInterval);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, search, rateLimit.remaining, error]);

  const loadMore = useCallback(() => {
    search(page + 1, true);
  }, [search, page]);

  const refresh = useCallback(() => {
    isFirstLoad.current = false;
    search(1);
  }, [search]);

  const updateFilters = useCallback((partial) => {
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
    autoRefresh,
    setAutoRefresh,
    sound,
    setSound,
    newIds,
    clearNewIds,
  };
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
