'use client';

/**
 * The tab notched into the docs panel's top-right corner: the npm package and
 * its version, GitHub stars, the theme toggle and the author credit. Its shape — and the concave curves that
 * join it to the panel border — live in global.css (`.atlas-corner`).
 */
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { author, gitConfig, GITHUB_URL, NPM_URL } from '@/lib/shared';

const STARS_KEY = 'atlas.github.stars';
const STARS_TTL_MS = 60 * 60 * 1000;

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5Z" />
    </svg>
  );
}

function NpmMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
    </svg>
  );
}

function formatStars(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toLocaleString('en-US');
}

/**
 * The count baked in at build time, refreshed from the GitHub API in the
 * browser (cached for an hour per session, since unauthenticated calls are
 * rate limited). Any failure keeps whatever we already have.
 */
function useStars(initial: number | null): number | null {
  const [stars, setStars] = useState(initial);
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(STARS_KEY) ?? 'null') as { n: number; at: number } | null;
      if (cached && Date.now() - cached.at < STARS_TTL_MS) {
        setStars(cached.n);
        return;
      }
    } catch {
      /* storage blocked — just fetch */
    }
    let alive = true;
    fetch(`https://api.github.com/repos/${gitConfig.user}/${gitConfig.repo}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stargazers_count?: unknown } | null) => {
        const n = data?.stargazers_count;
        if (!alive || typeof n !== 'number') return;
        setStars(n);
        try {
          sessionStorage.setItem(STARS_KEY, JSON.stringify({ n, at: Date.now() }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return stars;
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known on the client; render a stable icon until then.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme === 'dark';

  return (
    <button
      type="button"
      className="atlas-corner-item"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function DocsCorner({ initialStars, version }: { initialStars: number | null; version: string }) {
  const stars = useStars(initialStars);

  return (
    <div className="atlas-corner">
      <a className="atlas-corner-item" href={NPM_URL} target="_blank" rel="noopener" aria-label={`codebase-atlas v${version} on npm`}>
        <NpmMark />
        <span className="tabular-nums">v{version}</span>
      </a>
      <span className="atlas-corner-sep" aria-hidden />
      <a className="atlas-corner-item" href={GITHUB_URL} target="_blank" rel="noopener" aria-label="Star Atlas on GitHub">
        <GitHubMark />
        <span className="tabular-nums">{stars === null ? 'Star' : formatStars(stars)}</span>
      </a>
      <span className="atlas-corner-sep" aria-hidden />
      <ThemeButton />
      <span className="atlas-corner-sep" aria-hidden />
      <a className="atlas-corner-item" href={author.url} target="_blank" rel="noopener">
        Built by <b>{author.name}</b>
      </a>
    </div>
  );
}
