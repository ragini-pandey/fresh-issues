import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import IssueCard from './IssueCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import type { Issue } from '@/types';

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 rounded-md" />
        <Skeleton className="h-3.5 w-36" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3.5 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-3 pt-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  );
}

export interface IssueListProps {
  issues: Issue[];
  loading: boolean;
  error: string | null;
  warnings?: string[];
  totalCount: number;
  loadMore: () => void;
  newIds: Set<number>;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export default function IssueList({
  issues,
  loading,
  error,
  warnings = [],
  totalCount,
  loadMore,
  newIds,
  onRetry,
  onOpenSettings,
}: IssueListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Deferred issues lets the list lag slightly behind rapid prop changes,
  // keeping the input/scroll responsive on large result sets.
  const deferredIssues = useDeferredValue(issues);
  const isStale = deferredIssues !== issues;

  const visibleIssues = useMemo(() => deferredIssues, [deferredIssues]);

  const groupedIssues = useMemo(() => {
    const groups = new Map<string, Issue[]>();
    for (const issue of visibleIssues) {
      const list = groups.get(issue.repoFullName);
      if (list) {
        list.push(issue);
      } else {
        groups.set(issue.repoFullName, [issue]);
      }
    }
    return Array.from(groups.entries());
  }, [visibleIssues]);

  const [collapsedRepos, setCollapsedRepos] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleRepo(repo: string, open: boolean) {
    setCollapsedRepos((prev) => {
      const next = new Set(prev);
      if (open) {
        next.delete(repo);
      } else {
        next.add(repo);
      }
      return next;
    });
  }

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
    const isRateLimitError =
      error.includes('rate limit') || error.includes('Rate limit');
    const isAuthError =
      error.includes('Authentication') ||
      error.includes('token') ||
      error.includes('Bad credentials');
    const isNetworkError =
      error.includes('Network error') || error.includes('connect');

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col gap-3.5 bg-destructive/10 border border-destructive/20 rounded-xl p-6 max-w-lg text-left animate-scale-in">
          <div className="flex gap-3.5 items-start">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <strong className="text-destructive block mb-1.5 text-base">
                Error fetching issues
              </strong>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {error}
              </p>

              {isRateLimitError && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    💡 <strong>Tip:</strong> Add a GitHub Personal Access Token
                    in Settings to increase your rate limit from 60 to 5,000
                    requests per hour.
                  </p>
                  {onOpenSettings && (
                    <Button
                      onClick={onOpenSettings}
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                    >
                      <Settings size={14} className="mr-2" />
                      Open Settings to add token
                    </Button>
                  )}
                </div>
              )}

              {isAuthError && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    💡 <strong>Tip:</strong> Check your GitHub token in
                    Settings and ensure it has the correct permissions.
                  </p>
                </div>
              )}

              {isNetworkError && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    💡 <strong>Tip:</strong> Check your internet connection
                    and try again.
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

  if (loading && visibleIssues.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-5 space-y-3">
          <Skeleton className="h-4 w-32 mb-4" />
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (visibleIssues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground animate-scale-in">
        <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Search size={22} className="text-muted-foreground/40" />
        </div>
        <p className="text-base font-medium text-foreground/70">
          No issues found
        </p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs text-center leading-relaxed">
          Try a wider time window or fewer label filters to discover more
          issues.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-5">
        {warnings.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg animate-fade-in-up">
            <div className="flex gap-2 items-start">
              <AlertTriangle
                size={16}
                className="text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-1">
                  Some repositories failed to load
                </p>
                <div className="text-sm text-yellow-700 dark:text-yellow-500 space-y-1">
                  {warnings.slice(0, 3).map((warning) => (
                    <p key={warning} className="font-mono">
                      {warning}
                    </p>
                  ))}
                  {warnings.length > 3 && (
                    <p className="italic">
                      ...and {warnings.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {totalCount.toLocaleString()} issues
            </span>
            {(loading || isStale) && (
              <Loader2 size={13} className="animate-spin text-primary/70" />
            )}
          </div>
        </div>
        <div
          className="space-y-3"
          style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 150ms' }}
        >
          {groupedIssues.map(([repoFullName, repoIssues]) => {
            const owner = repoFullName.split('/')[0];
            const isOpen = !collapsedRepos.has(repoFullName);
            return (
              <Collapsible
                key={repoFullName}
                open={isOpen}
                onOpenChange={(open) => toggleRepo(repoFullName, open)}
                className="rounded-xl border border-border bg-card/40 overflow-hidden"
              >
                <CollapsibleTrigger
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left
                    hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <ChevronDown
                    size={16}
                    className="text-muted-foreground shrink-0 transition-transform duration-200
                      group-data-[state=closed]:-rotate-90"
                  />
                  <Avatar className="size-6 rounded-md shrink-0">
                    <AvatarImage
                      src={`https://github.com/${owner}.png?size=32`}
                    />
                    <AvatarFallback className="rounded-md text-[11px] font-medium">
                      {owner.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate flex-1">
                    {repoFullName}
                  </span>
                  <span
                    className="text-xs font-medium text-muted-foreground bg-muted/60
                      rounded-full px-2 py-0.5 shrink-0"
                  >
                    {repoIssues.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent
                  className="overflow-hidden
                    data-[state=open]:animate-collapsible-down
                    data-[state=closed]:animate-collapsible-up"
                >
                  <div className="space-y-3 px-3 pb-3 pt-1">
                    {repoIssues.map((issue, i) => (
                      <div
                        key={issue.id}
                        className="animate-fade-in-up"
                        style={{
                          animationDelay: `${Math.min(i * 40, 400)}ms`,
                        }}
                      >
                        <IssueCard
                          issue={issue}
                          isNew={newIds.has(issue.id)}
                          index={i}
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
        {visibleIssues.length < totalCount && (
          <div className="flex justify-center pt-6 pb-2">
            <Button
              onClick={loadMore}
              disabled={loading}
              variant="outline"
              className="px-8 py-2.5 border-border hover:border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer transition-all"
            >
              {loading ? 'Loading…' : 'Load More'}
            </Button>
          </div>
        )}
      </div>

      <Button
        onClick={scrollToTop}
        variant="outline"
        size="icon"
        className={`fixed bottom-6 right-6 rounded-full shadow-lg transition-all cursor-pointer text-muted-foreground hover:text-primary hover:border-primary/40 ${
          showScrollTop
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        title="Scroll to top"
      >
        <ArrowUp size={16} />
      </Button>
    </div>
  );
}
