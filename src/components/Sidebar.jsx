import { useState } from 'react';
import { POPULAR_LABELS, LANGUAGES, TIME_WINDOWS, STAR_PRESETS, SORT_OPTIONS, COMMENT_PRESETS } from '../services/github';
import { Search, ChevronDown, ChevronRight, Settings, Zap, Star, MessageSquare, BookMarked, LayoutList, X, Clock, SlidersHorizontal, Key, Tag, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function Sidebar({ filters, updateFilters, onSearch, token, setToken, sound, setSound, view, setView, repoCount, mobileOpen, onMobileClose }) {
  const [repo, setRepo] = useState(filters.repo || '');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLanguage, setShowLanguage] = useState(true);

  function handleSearch(e) {
    e.preventDefault();
    updateFilters({ repo });
    setView('issues');
    setTimeout(() => onSearch(1), 0);
  }

  function toggleLabel(label) {
    const current = filters.labels || [];
    const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
    updateFilters({ labels: next });
  }

  const activeFilterCount = [
    filters.language ? 1 : 0,
    filters.minStars > 0 ? 1 : 0,
    filters.minComments > 0 ? 1 : 0,
    filters.sortBy !== 'created' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <aside className={`
      w-[320px] min-w-[320px] h-full bg-sidebar border-r border-border flex flex-col overflow-hidden
      fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
      md:static md:translate-x-0 md:z-auto
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 animate-slide-in-left">
            <div className="size-9 rounded-lg bg-secondary flex items-center justify-center">
              <Zap size={16} className="text-secondary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">Fresh Issues</span>
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
      </div>

      {/* Navigation tabs */}
      <div className="px-4 pb-3">
        <div className="flex bg-muted rounded-lg p-0.5">
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
              view === 'issues'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setView('issues')}
          >
            <LayoutList size={14} />
            Issues
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
              view === 'repos'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setView('repos')}
          >
            <BookMarked size={14} />
            Repos
            {repoCount > 0 && (
              <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-1.5 py-0 rounded-full">
                {repoCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5">
          {/* Search button */}
          <form onSubmit={handleSearch}>
            <Button type="submit" className="w-full cursor-pointer font-medium text-sm" size="default">
              <Search size={15} />
              Search Issues
            </Button>
          </form>

          {/* Time Window */}
          <FilterSection label="Time Window" icon={<Clock size={14} />}>
            <div className="flex flex-wrap gap-1.5">
              {TIME_WINDOWS.map((tw) => (
                <button
                  key={tw.value}
                  onClick={() => updateFilters({ timeWindow: tw.value })}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer ${
                    filters.timeWindow === tw.value
                      ? 'bg-secondary border-secondary text-secondary-foreground'
                      : 'border-border text-muted-foreground hover:border-border-light hover:text-foreground'
                  }`}
                >
                  {tw.label}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* Labels */}
          <Collapsible open={showLabels} onOpenChange={setShowLabels}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5">
              <span className="flex items-center gap-1.5">
                <Tag size={14} />
                Labels
                {(filters.labels || []).length > 0 && (
                  <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-1.5 rounded-full">
                    {filters.labels.length}
                  </span>
                )}
              </span>
              {showLabels ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-1.5 pt-3">
                {POPULAR_LABELS.map((label) => (
                  <button
                    key={label}
                    onClick={() => toggleLabel(label)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer ${
                      (filters.labels || []).includes(label)
                        ? 'bg-secondary border-secondary text-secondary-foreground'
                        : 'border-border text-muted-foreground hover:border-border-light hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Language */}
          <Collapsible open={showLanguage} onOpenChange={setShowLanguage}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5">
              <span className="flex items-center gap-1.5">
                <Languages size={14} />
                Language
                {filters.language && (
                  <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-1.5 rounded-full">
                    1
                  </span>
                )}
              </span>
              {showLanguage ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-1.5 pt-3">
                <button
                  onClick={() => updateFilters({ language: '' })}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer ${
                    !filters.language
                      ? 'bg-secondary border-secondary text-secondary-foreground'
                      : 'border-border text-muted-foreground hover:border-border-light hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => updateFilters({ language: lang })}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer ${
                      filters.language === lang
                        ? 'bg-secondary border-secondary text-secondary-foreground'
                        : 'border-border text-muted-foreground hover:border-border-light hover:text-foreground'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Advanced Filters */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal size={14} />
                More Filters
                {activeFilterCount > 0 && (
                  <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-1.5 rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-4 pt-3">
                {/* Sort By */}
                <FilterSection label="Sort By">
                  <div className="flex flex-wrap gap-1.5">
                    {SORT_OPTIONS.filter((opt) => !opt.reposOnly || repoCount > 0).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateFilters({ sortBy: opt.value })}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer ${
                          filters.sortBy === opt.value
                            ? 'bg-secondary border-secondary text-secondary-foreground'
                            : 'border-border text-muted-foreground hover:border-border-light hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FilterSection>

                {/* Min Stars */}
                <FilterSection label="Min Stars">
                  <div className="flex flex-wrap gap-1.5">
                    {STAR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => updateFilters({ minStars: preset.value })}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          filters.minStars === preset.value
                            ? 'bg-secondary border-secondary text-secondary-foreground'
                            : 'border-border text-muted-foreground hover:border-border-light hover:text-foreground'
                        }`}
                      >
                        {preset.value > 0 && <Star size={9} />}
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </FilterSection>

                {/* Min Comments */}
                <FilterSection label="Min Comments">
                  <div className="flex flex-wrap gap-1.5">
                    {COMMENT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => updateFilters({ minComments: preset.value })}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          filters.minComments === preset.value
                            ? 'bg-secondary border-secondary text-secondary-foreground'
                            : 'border-border text-muted-foreground hover:border-border-light hover:text-foreground'
                        }`}
                      >
                        {preset.value > 0 && <MessageSquare size={9} />}
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </FilterSection>

                {/* Toggles */}
                <div className="space-y-2.5 pt-1">
                  <SettingsToggle
                    checked={filters.noAssignee}
                    onCheckedChange={(v) => updateFilters({ noAssignee: v })}
                    label="Unassigned only"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Settings */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5">
              <span className="flex items-center gap-1.5">
                <Settings size={14} />
                Settings
              </span>
              {showSettings ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Key size={12} />
                    GitHub Token
                  </label>
                  <Input
                    type="password"
                    placeholder="ghp_xxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="h-9 text-sm font-mono bg-background"
                  />
                  <p className="text-xs text-muted-foreground/70">Increases rate limit to 30 req/min</p>
                </div>
                <SettingsToggle checked={sound} onCheckedChange={setSound} label="Sound alerts" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </aside>
  );
}

function FilterSection({ label, icon, children }) {
  return (
    <div className="space-y-2.5">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {children}
    </div>
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
