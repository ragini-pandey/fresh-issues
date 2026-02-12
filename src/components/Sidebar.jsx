import { useState } from 'react';
import { POPULAR_LABELS, LANGUAGES, TIME_WINDOWS, STAR_PRESETS, SORT_OPTIONS, COMMENT_PRESETS } from '../services/github';
import { Search, ChevronDown, ChevronRight, Settings, Crosshair, Zap, Github, Star, ArrowUpDown, MessageSquare, BookMarked, LayoutList, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function Sidebar({ filters, updateFilters, onSearch, token, setToken, autoRefresh, setAutoRefresh, sound, setSound, view, setView, repoCount, mobileOpen, onMobileClose }) {
  const [repo, setRepo] = useState(filters.repo || '');
  const [showSettings, setShowSettings] = useState(false);
  const [sections, setSections] = useState({ time: true, lang: true, labels: true, stars: false, sort: false, comments: false });

  function handleSearch(e) {
    e.preventDefault();
    updateFilters({ repo });
    setTimeout(() => onSearch(1), 0);
  }

  function toggleLabel(label) {
    const current = filters.labels || [];
    const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
    updateFilters({ labels: next });
  }

  function toggleSection(key) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside className={`
      w-72 min-w-72 h-full bg-card border-r border-border flex flex-col overflow-hidden
      fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
      md:static md:translate-x-0 md:z-auto
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Zap size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground tracking-tight">Fresh Issue</p>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">Open source starter</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 md:hidden text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={onMobileClose}
          >
            <X size={16} />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex gap-1.5 mt-4">
          <Button
            variant={view === 'issues' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 cursor-pointer"
            onClick={() => setView('issues')}
          >
            <LayoutList size={14} />
            Issues
          </Button>
          <Button
            variant={view === 'repos' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 cursor-pointer"
            onClick={() => setView('repos')}
          >
            <BookMarked size={14} />
            Repos
            {repoCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] min-w-0">
                {repoCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4">
          {/* Search */}
          <form className="space-y-2" onSubmit={handleSearch}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="owner/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
            <Button type="submit" className="w-full cursor-pointer" size="default">
              <Crosshair size={14} />
              Hunt Issues
            </Button>
          </form>

          <Separator />

          {/* Time Window */}
          <SidebarSection title="Time Window" open={sections.time} onToggle={() => toggleSection('time')}>
            <div className="flex flex-col gap-0.5">
              {TIME_WINDOWS.map((tw) => (
                <button
                  key={tw.value}
                  onClick={() => updateFilters({ timeWindow: tw.value })}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 text-sm rounded-md transition-colors text-left cursor-pointer ${
                    filters.timeWindow === tw.value
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <span className={`size-1.5 rounded-full shrink-0 transition-colors ${
                    filters.timeWindow === tw.value ? 'bg-primary shadow-[0_0_6px_rgba(80,250,123,0.5)]' : 'bg-border-light'
                  }`} />
                  {tw.label}
                </button>
              ))}
            </div>
          </SidebarSection>

          {/* Language */}
          <SidebarSection title="Language" open={sections.lang} onToggle={() => toggleSection('lang')}>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge
                variant={!filters.language ? 'default' : 'outline'}
                className={`cursor-pointer ${!filters.language ? '' : 'hover:bg-secondary'}`}
                onClick={() => updateFilters({ language: '' })}
              >
                All
              </Badge>
              {LANGUAGES.map((lang) => (
                <Badge
                  key={lang}
                  variant={filters.language === lang ? 'default' : 'outline'}
                  className={`cursor-pointer ${filters.language === lang ? '' : 'hover:bg-secondary'}`}
                  onClick={() => updateFilters({ language: lang })}
                >
                  {lang}
                </Badge>
              ))}
            </div>
          </SidebarSection>

          {/* Labels */}
          <SidebarSection title="Labels" open={sections.labels} onToggle={() => toggleSection('labels')}>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {POPULAR_LABELS.map((label) => (
                <Badge
                  key={label}
                  variant={(filters.labels || []).includes(label) ? 'default' : 'outline'}
                  className={`cursor-pointer ${(filters.labels || []).includes(label) ? '' : 'hover:bg-secondary'}`}
                  onClick={() => toggleLabel(label)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </SidebarSection>

          {/* Min Stars */}
          <SidebarSection title="Min Stars" open={sections.stars} onToggle={() => toggleSection('stars')}>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {STAR_PRESETS.map((preset) => (
                <Badge
                  key={preset.value}
                  variant={filters.minStars === preset.value ? 'default' : 'outline'}
                  className={`cursor-pointer ${filters.minStars === preset.value ? '' : 'hover:bg-secondary'}`}
                  onClick={() => updateFilters({ minStars: preset.value })}
                >
                  {preset.value > 0 && <Star size={10} className="mr-0.5" />}
                  {preset.label}
                </Badge>
              ))}
            </div>
          </SidebarSection>

          {/* Sort By */}
          <SidebarSection title="Sort By" open={sections.sort} onToggle={() => toggleSection('sort')}>
            <div className="flex flex-col gap-0.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateFilters({ sortBy: opt.value })}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 text-sm rounded-md transition-colors text-left cursor-pointer ${
                    filters.sortBy === opt.value
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <span className={`size-1.5 rounded-full shrink-0 transition-colors ${
                    filters.sortBy === opt.value ? 'bg-primary shadow-[0_0_6px_rgba(80,250,123,0.5)]' : 'bg-border-light'
                  }`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </SidebarSection>

          {/* Min Comments */}
          <SidebarSection title="Min Comments" open={sections.comments} onToggle={() => toggleSection('comments')}>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMENT_PRESETS.map((preset) => (
                <Badge
                  key={preset.value}
                  variant={filters.minComments === preset.value ? 'default' : 'outline'}
                  className={`cursor-pointer ${filters.minComments === preset.value ? '' : 'hover:bg-secondary'}`}
                  onClick={() => updateFilters({ minComments: preset.value })}
                >
                  {preset.value > 0 && <MessageSquare size={10} className="mr-0.5" />}
                  {preset.label}
                </Badge>
              ))}
            </div>
          </SidebarSection>

          {/* Settings */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs font-bold uppercase tracking-widest text-primary/80 hover:text-primary transition-colors cursor-pointer">
              <span className="flex items-center gap-1.5"><Settings size={12} />Settings</span>
              {showSettings ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3.5 pt-2 pb-1">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">GitHub Token</label>
                  <Input
                    type="password"
                    placeholder="ghp_xxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="h-8 text-xs font-mono bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">Increases rate limit to 30 req/min</p>
                </div>
                <SettingsToggle checked={autoRefresh} onCheckedChange={setAutoRefresh} label="Auto-refresh (30s)" />
                <SettingsToggle checked={sound} onCheckedChange={setSound} label="Sound alerts" />
                <SettingsToggle checked={filters.noAssignee} onCheckedChange={(v) => updateFilters({ noAssignee: v })} label="Unassigned only" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          <Github size={12} />
          Powered by GitHub API
        </a>
      </div>
    </aside>
  );
}

function SidebarSection({ title, open, onToggle, children }) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs font-bold uppercase tracking-widest text-primary/80 hover:text-primary transition-colors cursor-pointer">
        <span>{title}</span>
        {open ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-1 pb-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SettingsToggle({ checked, onCheckedChange, label }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
