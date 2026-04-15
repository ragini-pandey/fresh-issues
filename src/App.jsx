import { useState } from 'react';
import { useIssues } from './hooks/useIssues';
import { useRepos } from './hooks/useRepos';
import { ThemeProvider, useTheme } from './hooks/useTheme.jsx';
import Sidebar from './components/Sidebar';
import IssueList from './components/IssueList';
import RepoManager from './components/RepoManager';
import StatusBar from './components/StatusBar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Menu, Zap, Globe } from 'lucide-react';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</p>
      </TooltipContent>
    </Tooltip>
  );
}

function AppContent() {
  const [view, setView] = useState('issues'); // 'issues' | 'repos'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { repos, addRepo, removeRepo, updateRepo, clearRepos, toggleRepo, reorderRepos } = useRepos();
  const {
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
    token,
    setToken,
    sound,
    setSound,
    newIds,
  } = useIssues(repos);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="h-full flex justify-center bg-background">
      <div className="flex h-full w-full md:w-[85%] lg:w-[60%] lg:min-w-[768px] md:border-x border-border relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={closeSidebar}
          />
        )}

        <Sidebar
          filters={filters}
          updateFilters={updateFilters}
          onSearch={(p) => { search(p); closeSidebar(); }}
          token={token}
          setToken={setToken}
          sound={sound}
          setSound={setSound}
          view={view}
          setView={(v) => { setView(v); closeSidebar(); }}
          repoCount={repos.length}
          mobileOpen={sidebarOpen}
          onMobileClose={closeSidebar}
        />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm shrink-0 animate-slide-in-down">
          <div className="w-full flex items-center justify-between px-4 md:px-6 py-2">
            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 md:hidden text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={18} />
              </Button>
              <div className="flex items-center gap-2">
                {view === 'issues' ? (
                  repos.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Zap size={12} className="text-primary" />
                      <span className="text-xs font-medium text-foreground/80">
                        {repos.filter(r => !r.disabled).length} <span className="text-muted-foreground">repo{repos.filter(r => !r.disabled).length === 1 ? '' : 's'}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Globe size={12} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Global</span>
                    </div>
                  )
                ) : (
                  <span className="text-xs font-semibold text-foreground">My Repos</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {view === 'issues' && (
                <StatusBar
                  rateLimit={rateLimit}
                  lastRefresh={lastRefresh}
                  newCount={newIds.size}
                  loading={loading}
                />
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div key={view} className="flex-1 flex flex-col overflow-hidden min-w-0 animate-fade-in-up">
          {view === 'issues' ? (
            <IssueList
              issues={issues}
              loading={loading}
              error={error}
              warnings={warnings}
              totalCount={totalCount}
              loadMore={loadMore}
              newIds={newIds}
              onRetry={refresh}
            />
          ) : (
            <RepoManager
              repos={repos}
              addRepo={addRepo}
              removeRepo={removeRepo}
              updateRepo={updateRepo}
              clearRepos={clearRepos}
              toggleRepo={toggleRepo}
              reorderRepos={reorderRepos}
            />
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
