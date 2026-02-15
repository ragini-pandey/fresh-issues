import { useState, useEffect, useRef } from 'react';
import IssueCard from './IssueCard';
import { Loader2, ArrowUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="px-5 py-3 border-t border-border/60 bg-background/30 rounded-b-xl flex gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  );
}

export default function IssueList({ issues, loading, error, warnings = [], totalCount, loadMore, newIds, onRetry }) {
  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => setShowScrollTop(el.scrollTop > 400);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (error) {
    const isRateLimitError = error.includes('rate limit') || error.includes('Rate limit');
    const isAuthError = error.includes('Authentication') || error.includes('token');
    const isNetworkError = error.includes('Network error') || error.includes('connect');

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col gap-3.5 bg-destructive/10 border border-destructive/20 rounded-xl p-6 max-w-lg text-left animate-fade-in-up">
          <div className="flex gap-3.5 items-start">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <strong className="text-destructive block mb-1">Error fetching issues</strong>
              <p className="text-sm text-foreground/80 leading-relaxed">{error}</p>
              
              {isRateLimitError && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    💡 <strong>Tip:</strong> Add a GitHub Personal Access Token in Settings to increase your rate limit from 60 to 5,000 requests per hour.
                  </p>
                </div>
              )}
              
              {isAuthError && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    💡 <strong>Tip:</strong> Check your GitHub token in Settings and ensure it has the correct permissions.
                  </p>
                </div>
              )}
              
              {isNetworkError && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    💡 <strong>Tip:</strong> Check your internet connection and try again.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="w-full mt-2"
            >
              <RefreshCw size={14} className="mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (loading && issues.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-5 space-y-3">
          <Skeleton className="h-4 w-32 mb-4" />
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground animate-fade-in-up">
        <div className="size-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
          <span className="text-3xl opacity-50">🔍</span>
        </div>
        <p className="text-sm font-medium text-foreground/70">No issues found</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs text-center">Try a wider time window or fewer label filters to discover more issues.</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-5">
        {/* Warnings banner for partial failures */}
        {warnings.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg animate-fade-in-up">
            <div className="flex gap-2 items-start">
              <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-1">
                  Some repositories failed to load
                </p>
                <div className="text-xs text-yellow-700 dark:text-yellow-500 space-y-1">
                  {warnings.slice(0, 3).map((warning, idx) => (
                    <p key={idx} className="font-mono">{warning}</p>
                  ))}
                  {warnings.length > 3 && (
                    <p className="italic">...and {warnings.length - 3} more</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{totalCount.toLocaleString()} issues</span>
            {loading && <Loader2 size={13} className="animate-spin text-primary" />}
          </div>
        </div>
        <div className="space-y-3">
          {issues.map((issue, i) => (
            <div key={issue.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
              <IssueCard issue={issue} isNew={newIds.has(issue.id)} index={i} />
            </div>
          ))}
        </div>
        {issues.length < totalCount && (
          <div className="flex justify-center pt-6 pb-2">
            <Button
              onClick={loadMore}
              disabled={loading}
              variant="outline"
              className="px-8 py-2.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 cursor-pointer"
            >
              {loading ? 'Loading…' : 'Load More'}
            </Button>
          </div>
        )}
      </div>

      {/* Scroll to top */}
      <Button
        onClick={scrollToTop}
        variant="outline"
        size="icon"
        className={`fixed bottom-6 right-6 rounded-full shadow-lg transition-all cursor-pointer text-muted-foreground hover:text-primary hover:border-primary/40 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        title="Scroll to top"
      >
        <ArrowUp size={16} />
      </Button>
    </div>
  );
}
