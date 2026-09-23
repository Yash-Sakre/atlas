'use client';

import Link from 'next/link';
import AtlasMark from './AtlasMark';
import { GITHUB_URL, NPM_URL, ISSUES_URL, LICENSE_URL } from '@/lib/shared';
import { FAINT, LINE, MUTED, WRAP } from './ui';

type FooterLink = { label: string; href: string; external?: boolean; route?: boolean };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Dashboard', href: '#dashboard' },
      { label: 'How it works', href: '#how' },
      { label: 'Docs', href: '/docs', route: true },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Guides', href: '/docs/hosting', route: true },
      { label: 'npm package', href: NPM_URL, external: true },
      { label: 'README', href: `${GITHUB_URL}#readme`, external: true },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'GitHub', href: GITHUB_URL, external: true },
      { label: 'Issues', href: ISSUES_URL, external: true },
      { label: 'License', href: LICENSE_URL, external: true },
    ],
  },
];

const LINK = `block py-1 transition-colors hover:text-neutral-900 dark:hover:text-neutral-50 ${MUTED}`;

export default function Footer() {
  return (
    <footer className={`border-t ${LINE} bg-neutral-100 pt-14 pb-8 text-[13px] dark:bg-stone-900/40`}>
      <div className={WRAP}>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link className="mb-3 inline-flex items-center gap-2 text-lg font-extrabold tracking-tighter" href="/">
              <AtlasMark size={28} /> Atlas
            </Link>
            <p className={`max-w-[32ch] leading-relaxed ${MUTED}`}>
              The open-source map of your React codebase. See what already exists before you build it again.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 font-semibold">{col.title}</h4>
              {col.links.map((l) =>
                l.route ? (
                  <Link key={l.label} href={l.href} className={LINK}>
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
                    className={LINK}
                    {...(l.external ? { target: '_blank', rel: 'noopener' } : {})}
                  >
                    {l.label}
                  </a>
                ),
              )}
            </div>
          ))}
        </div>
        <div className={`mt-12 flex flex-wrap items-center justify-between gap-3 border-t ${LINE} pt-5 ${FAINT}`}>
          <span>© 2026 Atlas · MIT License</span>
          <span className="hidden md:inline">Built for developers who hate rebuilding the same button.</span>
        </div>
      </div>
    </footer>
  );
}
