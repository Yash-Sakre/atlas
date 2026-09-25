/**
 * Theme state: a light / dark / system *mode*.
 *
 * Stamped on <html> (`data-theme`, plus a `.dark` class for registry
 * components that key off it) and persisted per viewer. Swaps cross-fade
 * through the View Transitions API where the browser has it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

export type ThemeMode = 'light' | 'dark' | 'system';

const MODE_KEY = 'atlas:theme';

interface ThemeValue {
  mode: ThemeMode;
  /** The mode actually painted — `system` resolved against the OS. */
  resolved: 'light' | 'dark';
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = window.localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — the choice just won't persist */
  }
}

function systemMode(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Run a DOM-affecting state update inside a view transition when available. */
function withTransition(update: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    read(MODE_KEY, ['light', 'dark', 'system'] as const, 'dark'),
  );
  const [system, setSystem] = useState<'light' | 'dark'>(systemMode);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => setSystem(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = mode === 'system' ? system : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    write(MODE_KEY, m);
    withTransition(() => setModeState(m));
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}
