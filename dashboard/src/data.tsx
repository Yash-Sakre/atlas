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
      <div className="atlas-splash">
        <p style={{ color: 'var(--ink)' }}>Couldn’t load analysis data.</p>
        <p>
          Tried <span className="mono">{dataUrl()}</span> — {error}
        </p>
        <p style={{ fontSize: 13 }}>
          Run <span className="mono">atlas serve</span> or pass{' '}
          <span className="mono">?data=&lt;url&gt;</span>.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="atlas-splash">
        <div className="atlas-spinner" />
        <p>Loading analysis…</p>
      </div>
    );
  }

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
