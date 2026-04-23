import { useEffect, useState } from 'react';

export const THEMES = ['light', 'dark', 'high-contrast'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'sapientia.ui.theme';

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (THEMES as readonly string[]).includes(saved)) {
      return saved as Theme;
    }
  } catch {
    // private mode / SSR
  }
  return 'light';
}

/**
 * Tri-state theme: light / dark / high-contrast. Applies both:
 *   - `.dark` class on <html> (so Tailwind `dark:` utilities fire for dark
 *     AND high-contrast — both are dark-background themes),
 *   - `data-theme="dark" | "high-contrast"` attribute on <html> so
 *     index.css can override the palette per theme.
 * Persisted to localStorage.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
    } else {
      root.classList.add('dark');
      root.setAttribute('data-theme', theme);
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // private mode; ignore
    }
  }, [theme]);

  return [theme, setTheme];
}