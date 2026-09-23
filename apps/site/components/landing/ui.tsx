import type { ReactNode } from 'react';

/*
 * Shared Tailwind class strings for the landing page. Anything used once lives
 * inline in its component; these are the styles repeated across sections.
 * Colours come straight from Tailwind's palette — stone for the warm dark
 * surfaces the docs also use, neutral for ink, blue for the accent.
 */

export const WRAP = 'mx-auto max-w-6xl px-6';

export const INK = 'text-neutral-900 dark:text-neutral-50';
export const MUTED = 'text-neutral-500 dark:text-neutral-400';
export const FAINT = 'text-neutral-400 dark:text-neutral-600';
export const LINE = 'border-black/8 dark:border-white/8';

/** Section rhythm: base band and the alternate (grey) band. */
export const BAND = 'scroll-mt-10 py-24 md:py-36';
export const BAND_ALT = `${BAND} bg-neutral-100 dark:bg-stone-900/40`;

/** Cards sit on a band; each band has a card colour that contrasts with it. */
export const CARD = 'rounded-3xl bg-neutral-100 dark:bg-stone-900';
export const CARD_ON_ALT = 'rounded-3xl bg-white dark:bg-stone-900';
/** A panel nested inside a card (code samples, tables). */
export const INSET = 'rounded-2xl bg-white dark:bg-stone-950';

export const EYEBROW = 'text-base font-semibold text-blue-600 dark:text-blue-400';
export const H2 = `mt-2.5 mb-4 text-4xl leading-[1.05] font-bold tracking-tighter text-balance md:text-5xl lg:text-6xl ${INK}`;
/** Headline for two-column sections, where the full size would stack three lines deep. */
export const H2_SPLIT = `mt-2.5 mb-4 text-4xl leading-[1.05] font-bold tracking-tighter text-balance md:text-5xl ${INK}`;
export const LEAD = `max-w-[58ch] text-lg leading-relaxed text-pretty md:text-xl ${MUTED}`;
export const H3 = `mb-2.5 text-2xl leading-tight font-bold tracking-tight ${INK}`;

export const GRAD_TEXT =
  'bg-linear-to-r from-blue-500 via-violet-500 to-pink-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-violet-400 dark:to-pink-400';

export const LINK_ARROW =
  'group inline-flex items-center gap-0.5 text-lg font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400';
export const ARROW_NUDGE = 'transition-transform group-hover:translate-x-0.5';

export const BADGE_NEW =
  'rounded-full bg-blue-600/10 px-2.5 py-1 text-xs leading-none font-semibold tracking-wide text-blue-600 uppercase dark:bg-blue-400/15 dark:text-blue-400';

export const CARD_HOVER = 'transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10';

/** The six asset kinds, with the hue each one wears across the site. */
export type Kind = 'component' | 'hook' | 'utility' | 'context' | 'store' | 'route';

export const KIND_TEXT: Record<Kind, string> = {
  component: 'text-sky-600 dark:text-sky-300',
  hook: 'text-violet-600 dark:text-violet-300',
  utility: 'text-emerald-600 dark:text-emerald-300',
  context: 'text-amber-600 dark:text-amber-300',
  store: 'text-orange-600 dark:text-orange-300',
  route: 'text-fuchsia-600 dark:text-fuchsia-300',
};

export const KIND_DOT: Record<Kind, string> = {
  component: 'bg-sky-600 dark:bg-sky-300',
  hook: 'bg-violet-600 dark:bg-violet-300',
  utility: 'bg-emerald-600 dark:bg-emerald-300',
  context: 'bg-amber-600 dark:bg-amber-300',
  store: 'bg-orange-600 dark:bg-orange-300',
  route: 'bg-fuchsia-600 dark:bg-fuchsia-300',
};

/** Inline code inside running text. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-black/6 px-1.5 py-px font-mono text-[0.88em] text-neutral-900 dark:bg-white/10 dark:text-neutral-100">
      {children}
    </code>
  );
}

/** Renders `backticked` spans of a plain-text description as inline code. */
export function withCode(text: string) {
  return text.split('`').map((part, i) => (i % 2 ? <Code key={i}>{part}</Code> : part));
}
