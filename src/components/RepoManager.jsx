import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, BookMarked, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function RepoManager({ repos, addRepo, removeRepo, updateRepo, clearRepos }) {
  const [newRepo, setNewRepo] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!newRepo.trim()) return;
    if (!newRepo.includes('/')) {
      setError('Format: owner/repo (e.g. facebook/react)');
      return;
    }
    if (repos.some((r) => r.fullName.toLowerCase() === newRepo.trim().toLowerCase())) {
      setError('Repo already added');
      return;
    }
    addRepo(newRepo.trim());
    setNewRepo('');
  }

  function startEdit(repo) {
    setEditingId(repo.id);
    setEditValue(repo.fullName);
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
    setError('');
  }

  function saveEdit(id) {
    setError('');
    if (!editValue.includes('/')) {
      setError('Format: owner/repo');
      return;
    }
    updateRepo(id, editValue.trim());
    setEditingId(null);
    setEditValue('');
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <BookMarked size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">My Repositories</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Add repos to track — only these will be searched for issues</p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Add Form */}
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-2">
          <div className="relative flex-1">
            <Github size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="owner/repo (e.g. facebook/react)"
              value={newRepo}
              onChange={(e) => { setNewRepo(e.target.value); setError(''); }}
              className="pl-9 bg-background"
            />
          </div>
          <Button type="submit" className="cursor-pointer shrink-0 w-full sm:w-auto">
            <Plus size={16} />
            Add Repo
          </Button>
        </form>
        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        {!error && <div className="mb-4" />}

        {/* Repo List */}
        {repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-fade-in-up">
            <div className="size-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
              <BookMarked size={28} className="opacity-40" />
            </div>
            <p className="text-sm font-medium text-foreground/70">No repos added yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs text-center">
              Add repositories above to track their open issues. When repos are saved, only those repos will be searched.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="outline" className="text-sm">
                {repos.length} {repos.length === 1 ? 'repo' : 'repos'} tracked
              </Badge>
              {repos.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRepos}
                  className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  <Trash2 size={12} />
                  Clear all
                </Button>
              )}
            </div>

            {repos.map((repo) => (
              <Card key={repo.id} className="group transition-all hover:border-border-light">
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar className="size-8 rounded-lg shrink-0">
                    <AvatarImage src={`https://github.com/${repo.fullName.split('/')[0]}.png?size=64`} />
                    <AvatarFallback className="rounded-lg text-xs">{repo.fullName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  {editingId === repo.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 text-sm bg-background"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(repo.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <Button size="icon" variant="ghost" className="size-7 text-primary cursor-pointer" onClick={() => saveEdit(repo.id)}>
                        <Check size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-muted-foreground cursor-pointer" onClick={cancelEdit}>
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <a
                          href={`https://github.com/${repo.fullName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors no-underline truncate block"
                        >
                          {repo.fullName}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(repo.addedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => startEdit(repo)} title="Edit">
                          <Pencil size={13} />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => removeRepo(repo.id)} title="Remove">
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
