import { useCallback, useState } from 'react';
import type { TrackedRepo } from '../types';

const STORAGE_KEY = 'freshissue-repos';

function loadRepos(): TrackedRepo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackedRepo[]) : [];
  } catch {
    return [];
  }
}

function saveRepos(repos: TrackedRepo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
}

export interface UseReposResult {
  repos: TrackedRepo[];
  addRepo: (fullName: string) => boolean;
  removeRepo: (id: string) => void;
  updateRepo: (id: string, newFullName: string) => boolean;
  clearRepos: () => void;
  toggleRepo: (id: string) => void;
  reorderRepos: (oldIndex: number, newIndex: number) => void;
}

/**
 * Hook to manage a list of GitHub repos persisted in localStorage.
 */
export function useRepos(): UseReposResult {
  const [repos, setRepos] = useState<TrackedRepo[]>(loadRepos);

  const addRepo = useCallback((fullName: string): boolean => {
    const trimmed = fullName.trim();
    if (!trimmed || !trimmed.includes('/')) return false;
    setRepos((prev) => {
      if (prev.some((r) => r.fullName.toLowerCase() === trimmed.toLowerCase()))
        return prev;
      const next: TrackedRepo[] = [
        ...prev,
        {
          id: Date.now().toString(),
          fullName: trimmed,
          addedAt: new Date().toISOString(),
          disabled: false,
        },
      ];
      saveRepos(next);
      return next;
    });
    return true;
  }, []);

  const toggleRepo = useCallback((id: string) => {
    setRepos((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, disabled: !r.disabled } : r,
      );
      saveRepos(next);
      return next;
    });
  }, []);

  const removeRepo = useCallback((id: string) => {
    setRepos((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRepos(next);
      return next;
    });
  }, []);

  const updateRepo = useCallback((id: string, newFullName: string): boolean => {
    const trimmed = newFullName.trim();
    if (!trimmed || !trimmed.includes('/')) return false;
    setRepos((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, fullName: trimmed } : r,
      );
      saveRepos(next);
      return next;
    });
    return true;
  }, []);

  const reorderRepos = useCallback((oldIndex: number, newIndex: number) => {
    setRepos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      saveRepos(next);
      return next;
    });
  }, []);

  const clearRepos = useCallback(() => {
    setRepos([]);
    saveRepos([]);
  }, []);

  return {
    repos,
    addRepo,
    removeRepo,
    updateRepo,
    clearRepos,
    toggleRepo,
    reorderRepos,
  };
}
