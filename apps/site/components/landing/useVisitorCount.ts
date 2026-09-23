'use client';

/**
 * Live visitor count, backed by CounterAPI's keyless v1 endpoints.
 *
 * A browser is counted once: the first visit calls `/up` and records a flag in
 * localStorage, every later visit just reads the current total. The count is
 * decoration — any failure (offline, rate limited, storage blocked, service
 * down) resolves to `null` so the caller can render nothing at all.
 */
import { useEffect, useState } from 'react';
import { COUNTER_NAME, COUNTER_NAMESPACE } from '@/lib/shared';

const BASE = `https://api.counterapi.dev/v1/${COUNTER_NAMESPACE}/${COUNTER_NAME}`;
const SEEN_KEY = 'atlas.visitor.counted';

/**
 * React StrictMode mounts effects twice in development. Without a module-level
 * latch that would fire two requests — and on a first visit, count twice.
 */
let inFlight: Promise<number | null> | null = null;

function hasVisited(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Storage blocked (private mode, cookie settings) — read-only, never bump,
    // so a locked-down browser can't inflate the total on every page load.
    return true;
  }
}

function markVisited(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

async function fetchCount(): Promise<number | null> {
  const firstVisit = !hasVisited();
  try {
    const res = await fetch(firstVisit ? `${BASE}/up` : `${BASE}/`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const count = (data as { count?: unknown })?.count;
    if (typeof count !== 'number' || !Number.isFinite(count)) return null;
    if (firstVisit) markVisited();
    return count;
  } catch {
    return null;
  }
}

export function useVisitorCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    inFlight = inFlight ?? fetchCount();
    inFlight.then((n) => {
      if (alive) setCount(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  return count;
}
