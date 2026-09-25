import { basePath } from '@/lib/shared';
import { LINE, MUTED } from './ui';

/*
 * The hero's dashboard: real screenshots of `atlas serve` run on this repo,
 * one per theme, inside browser-window chrome. Regenerate the images in
 * public/screenshots/ whenever the dashboard's look changes, and keep the
 * terminal copy (Terminal.tsx) in step with the numbers they show.
 */

/** Intrinsic size of every file in public/screenshots/ (a 1440×900 viewport at 1.5×). */
export const SHOT_WIDTH = 2160;
export const SHOT_HEIGHT = 1350;

export function shotSrc(view: string, scheme: 'light' | 'dark'): string {
  return `${basePath}/screenshots/${view}-${scheme}.webp`;
}

/** A light + dark pair of one view; the page theme picks which one shows. */
export function Screenshot({ view, alt, priority }: { view: string; alt: string; priority?: boolean }) {
  const common = {
    width: SHOT_WIDTH,
    height: SHOT_HEIGHT,
    decoding: 'async' as const,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    fetchPriority: priority ? ('high' as const) : undefined,
    className: 'block h-auto w-full',
  };
  return (
    <>
      <img {...common} src={shotSrc(view, 'light')} alt={alt} className={`${common.className} dark:hidden`} />
      <img {...common} src={shotSrc(view, 'dark')} alt={alt} className={`${common.className} hidden dark:block`} />
    </>
  );
}

/** Browser-window chrome around its children. */
export function BrowserFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative z-1 overflow-hidden rounded-2xl border border-black/14 bg-white text-left shadow-2xl shadow-black/25 dark:border-white/14 dark:bg-stone-950 dark:shadow-black/80 ${className}`}
    >
      <div className={`relative flex h-9.5 items-center gap-1.75 border-b ${LINE} bg-neutral-100 px-3.5 dark:bg-stone-900`}>
        <span className="size-2.75 rounded-full bg-red-400" />
        <span className="size-2.75 rounded-full bg-amber-400" />
        <span className="size-2.75 rounded-full bg-green-500" />
        <span
          className={`absolute left-1/2 -translate-x-1/2 rounded-md bg-white px-4.5 py-0.75 text-[11.5px] sm:px-10 dark:bg-stone-950 ${MUTED}`}
        >
          localhost:4321
        </span>
      </div>
      {children}
    </div>
  );
}

export default function DashboardPreview() {
  return (
    <BrowserFrame className="tilt-in">
      <Screenshot
        view="overview"
        priority
        alt="The Atlas dashboard's Overview: 504 code assets across 147 files, a 44% reuse rate, 43 dead-code findings and 44 dependencies, above a chart of how often each asset is referenced."
      />
    </BrowserFrame>
  );
}
