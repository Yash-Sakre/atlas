'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/* Terminal palette — the window is dark in both themes. */
const P = 'text-blue-400'; // prompt, links
const DIM = 'text-stone-400';
const OK = 'text-green-400';
const WARN = 'text-amber-300';
const TAG = 'text-violet-300';

const ok = <span className={OK}>✓</span>;

/* Mirrors the real scan behind the hero screenshots (`atlas serve` on this repo). */
const LINES: ReactNode[] = [
  <>
    <span className={P}>$</span> <span className="text-white">npx codebase-atlas serve</span>
  </>,
  <span className={DIM}>Scanning project… (147 files)</span>,
  <>
    {ok} Components <span className={TAG}>171</span>   {ok} Hooks <span className={TAG}>14</span>   {ok} Utils{' '}
    <span className={TAG}>311</span>
  </>,
  <>
    {ok} Contexts <span className={TAG}>8</span>   {ok} Routes <span className={TAG}>25</span>
  </>,
  <>
    {ok} Dependencies <span className={TAG}>44</span> packages · <span className={TAG}>7</span> updates available
  </>,
  <>
    {ok} Static assets <span className={TAG}>2</span> files · <span className={TAG}>3.5 KB</span> on disk
  </>,
  <>
    <span className={WARN}>⚠</span> 7 unused exports · 3 orphan files · 33 duplicate candidates
  </>,
  <>
    <span className={DIM}>Most used:</span> cn <span className={TAG}>78×</span> · Badge <span className={TAG}>48×</span> · Card{' '}
    <span className={TAG}>32×</span>
  </>,
  <>
    <span className={DIM}>Wrote</span> .atlas/ <span className={DIM}>— 12 JSON files</span>
  </>,
  <>
    <span className={OK}>→</span> Dashboard ready at{' '}
    <span className={`${P} underline underline-offset-3`}>http://localhost:4321</span>
  </>,
];

/** macOS-style window chrome around dark terminal output. */
export function TerminalWindow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-stone-900 text-stone-300 shadow-2xl shadow-black/30">
      <div className="relative flex h-10 items-center gap-1.75 border-b border-white/6 bg-stone-800/60 px-4">
        <span className="size-2.75 rounded-full bg-red-400" />
        <span className="size-2.75 rounded-full bg-amber-400" />
        <span className="size-2.75 rounded-full bg-green-500" />
        <span className="absolute left-1/2 -translate-x-1/2 text-xs text-stone-500">{title}</span>
      </div>
      <div className="overflow-x-auto px-5.5 pt-5.5 pb-6.5 font-mono text-[13.5px] leading-[1.9] whitespace-pre">
        {children}
      </div>
    </div>
  );
}

/** Terminal that reveals its output line by line the first time it scrolls into view. */
export default function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(LINES.length);
      return;
    }
    const el = ref.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout>;
    const reveal = (i: number) => {
      if (i > LINES.length) return;
      setShown(i);
      timer = setTimeout(() => reveal(i + 1), i === 1 ? 500 : 340);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal(1);
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const fade = (visible: boolean) => `transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`;

  return (
    <TerminalWindow title="~/my-app — zsh">
      <div ref={ref} className="min-h-68">
        {LINES.map((content, i) => (
          <div key={i} className={fade(i < shown)}>
            {content}
          </div>
        ))}
        <div className={fade(shown >= LINES.length)}>
          <span className={P}>$</span> <span className="inline-block h-4 w-2 motion-safe:animate-blink bg-blue-400 align-[-3px]" />
        </div>
      </div>
    </TerminalWindow>
  );
}
