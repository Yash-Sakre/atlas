'use client';

import { type KeyboardEvent, useRef, useState } from 'react';
import { DASHBOARD_VIEWS } from '@/lib/data/features';
import { BrowserFrame, Screenshot } from './DashboardPreview';
import { BADGE_NEW, INK, MUTED } from './ui';

/**
 * Tabbed walk through the dashboard: pick a view, see the real screenshot and
 * what it's for. Follows the WAI-ARIA tabs pattern (arrow keys, Home / End).
 */
export default function DashboardTour() {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const view = DASHBOARD_VIEWS[active];

  const focusTab = (i: number) => {
    const next = (i + DASHBOARD_VIEWS.length) % DASHBOARD_VIEWS.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowDown: active + 1,
      ArrowLeft: active - 1,
      ArrowUp: active - 1,
      Home: 0,
      End: DASHBOARD_VIEWS.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      focusTab(moves[e.key]);
    }
  };

  return (
    <div className="mt-16 grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-10">
      <div
        role="tablist"
        aria-label="Dashboard views"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {DASHBOARD_VIEWS.map(({ id, name, icon: Icon, isNew }, i) => {
          const selected = i === active;
          return (
            <button
              key={id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`tour-tab-${id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="tour-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`flex flex-none snap-start items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                selected
                  ? `bg-white shadow-sm dark:bg-stone-900 ${INK}`
                  : `${MUTED} hover:bg-white/60 hover:text-neutral-900 dark:hover:bg-stone-900/60 dark:hover:text-neutral-50`
              }`}
            >
              <Icon
                size={18}
                strokeWidth={1.8}
                className={selected ? 'text-blue-600 dark:text-blue-400' : undefined}
                aria-hidden
              />
              <span className="flex-1 whitespace-nowrap">{name}</span>
              {isNew && <span className={`${BADGE_NEW} hidden lg:inline-flex`}>New</span>}
            </button>
          );
        })}
      </div>

      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${view.id}`} className="min-w-0">
        <BrowserFrame>
          {/* Keyed so the new pair fades in instead of swapping mid-decode. */}
          <div key={view.id} className="motion-safe:animate-[landing-fade_300ms_ease-out]">
            <Screenshot view={view.shot} alt={`The ${view.name} view of the Atlas dashboard.`} />
          </div>
        </BrowserFrame>
        <p className={`mt-5 max-w-[68ch] text-[15.5px] leading-relaxed text-pretty ${MUTED}`}>
          <b className={`font-semibold ${INK}`}>{view.name}.</b> {view.desc}
        </p>
      </div>
    </div>
  );
}
