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
import { Sun, Moon, Menu, X } from 'lucide-react';

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
  const { repos, addRepo, removeRepo, updateRepo, clearRepos } = useRepos();
  const {
    issues,
    loading,
    error,
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
    autoRefresh,
    setAutoRefresh,
    sound,
    setSound,
    newIds,
  } = useIssues(repos);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="h-full flex justify-center">
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
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          sound={sound}
          setSound={setSound}
          view={view}
          setView={(v) => { setView(v); closeSidebar(); }}
          repoCount={repos.length}
          mobileOpen={sidebarOpen}
          onMobileClose={closeSidebar}
        />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <div className="w-full flex items-center justify-between px-4 md:px-6 py-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 md:hidden text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={18} />
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                {view === 'issues' ? (repos.length > 0 ? `Tracking ${repos.length} repo${repos.length === 1 ? '' : 's'}` : 'Fresh Issue') : 'My Repos'}
              </span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <ThemeToggle />
              {view === 'issues' && (
                <StatusBar
                  rateLimit={rateLimit}
                  lastRefresh={lastRefresh}
                  autoRefresh={autoRefresh}
                  newCount={newIds.size}
                  onRefresh={refresh}
                  loading={loading}
                />
              )}
            </div>
          </div>
        </header>

        {view === 'issues' ? (
          <IssueList
            issues={issues}
            loading={loading}
            error={error}
            totalCount={totalCount}
            loadMore={loadMore}
            newIds={newIds}
          />
        ) : (
          <RepoManager
            repos={repos}
            addRepo={addRepo}
            removeRepo={removeRepo}
            updateRepo={updateRepo}
            clearRepos={clearRepos}
          />
        )}
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
