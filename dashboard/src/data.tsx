/**
 * Data loading + access. The dashboard is data-source agnostic so the same
 * bundle works locally (CLI server) and hosted (static deploy):
 *
 *   1. `?data=<url>` query param wins (point a hosted app at any data file).
 *   2. a global `window.__ATLAS_DATA__` if one was inlined.
 *   3. otherwise fetch `./data.json` relative to the app.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AnalysisResult } from './types';

declare global {
  interface Window {
    __ATLAS_DATA__?: AnalysisResult;
  }
}

function dataUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('data') || './data.json';
}

const DataContext = createContext<AnalysisResult | null>(null);

export function useData(): AnalysisResult {
  const v = useContext(DataContext);
  if (!v) throw new Error('useData must be used inside <DataProvider>');
  return v;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AnalysisResult | null>(window.__ATLAS_DATA__ ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch(dataUrl(), { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: AnalysisResult) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || e));
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3.5 p-12 text-center text-ink-faint">
        <p className="text-ink">Couldn’t load analysis data.</p>
        <p>
          Tried <span className="font-mono tracking-normal">{dataUrl()}</span> — {error}
        </p>
        <p className="text-[13px]">
          Run <span className="font-mono tracking-normal">atlas serve</span> or pass{' '}
          <span className="font-mono tracking-normal">?data=&lt;url&gt;</span>.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3.5 p-12 text-center text-ink-faint">
        <div className="h-7.5 w-7.5 animate-spin rounded-full border-[2.5px] border-surface-2 border-t-accent" />
        <p>Loading analysis…</p>
      </div>
    );
  }

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
