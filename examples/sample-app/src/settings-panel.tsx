import React from 'react';

export interface SettingsPanelProps {
  /** Currently selected theme. */
  theme: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

/**
 * SettingsPanel — code-split screen. Only ever reached through
 * `React.lazy(() => import('./settings-panel'))` in routes.tsx, so it exercises
 * dynamic-import usage resolution (a static-import-only scan would call it dead).
 */
export default function SettingsPanel({ theme, onThemeChange }: SettingsPanelProps) {
  return (
    <section className="settings-panel">
      <h2>Settings</h2>
      <button onClick={() => onThemeChange?.(theme === 'light' ? 'dark' : 'light')}>
        Switch to {theme === 'light' ? 'dark' : 'light'} mode
      </button>
    </section>
  );
}
