import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import type { Theme } from '../types';

const ThemeContext = createContext<Theme>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme['theme']>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('freshissue-theme') as Theme['theme']) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('freshissue-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext value={{ theme, toggleTheme }}>{children}</ThemeContext>
  );
}

export function useTheme(): Theme {
  // React 19: `use()` reads context at render time and works in sync paths.
  return use(ThemeContext);
}
