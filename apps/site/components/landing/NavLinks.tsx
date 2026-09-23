'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { INK, MUTED } from './ui';

const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'how', label: 'How it works' },
  { id: 'ai', label: 'AI' },
];

const LINK = 'rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors hover:text-neutral-900 dark:hover:text-neutral-50';

/** Section links that highlight whichever section is currently in view. */
export default function NavLinks() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;

    // A section counts as current while it crosses a thin band a third of the way down the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else if (e.boundingClientRect.top > 0) setActive((cur) => (cur === e.target.id ? null : cur));
        }
      },
      { rootMargin: '-33% 0px -66% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="hidden gap-0.5 lg:flex">
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`${LINK} ${active === s.id ? `bg-neutral-900/8 dark:bg-white/10 ${INK}` : MUTED}`}
        >
          {s.label}
        </a>
      ))}
      <Link href="/docs" className={`${LINK} ${MUTED}`}>
        Docs
      </Link>
    </div>
  );
}
