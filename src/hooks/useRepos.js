import { useState, useCallback } from 'react';

const STORAGE_KEY = 'freshissue-repos';

function loadRepos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRepos(repos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
}

/**
 * Hook to manage a list of GitHub repos (owner/name) persisted in localStorage.
 * Each repo is an object: { id, fullName, addedAt }
 */
export function useRepos() {
  const [repos, setRepos] = useState(loadRepos);

  const addRepo = useCallback((fullName) => {
    const trimmed = fullName.trim();
    if (!trimmed || !trimmed.includes('/')) return false;
    setRepos((prev) => {
      if (prev.some((r) => r.fullName.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, { id: Date.now().toString(), fullName: trimmed, addedAt: new Date().toISOString() }];
      saveRepos(next);
      return next;
    });
    return true;
  }, []);

  const removeRepo = useCallback((id) => {
    setRepos((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRepos(next);
      return next;
    });
  }, []);

  const updateRepo = useCallback((id, newFullName) => {
    const trimmed = newFullName.trim();
    if (!trimmed || !trimmed.includes('/')) return false;
    setRepos((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, fullName: trimmed } : r));
      saveRepos(next);
      return next;
    });
    return true;
  }, []);

  const clearRepos = useCallback(() => {
    setRepos([]);
    saveRepos([]);
  }, []);

  return { repos, addRepo, removeRepo, updateRepo, clearRepos };
}
