import {
  Box,
  Database,
  GitBranch,
  Image,
  LayoutGrid,
  Package,
  Search,
  TriangleAlert,
  Wrench,
  Zap,
} from 'lucide-react';
import AtlasMark from './AtlasMark';
import { FAINT, INK, KIND_DOT, KIND_TEXT, type Kind, LINE, MUTED } from './ui';

/*
 * A static, hand-drawn rendition of the Atlas dashboard for the hero. The
 * sidebar mirrors the real one (packages/dashboard/src/Layout.tsx) and the
 * numbers match the sample scan the terminal prints further down the page.
 */

const NAV = [
  { label: 'Overview', icon: LayoutGrid, active: true },
  { label: 'Components', icon: Box, count: 9 },
  { label: 'Hooks', icon: Zap, count: 3 },
  { label: 'Utils', icon: Wrench, count: 4 },
  { label: 'Contexts', icon: Database, count: 2 },
  { label: 'Routes', icon: GitBranch, count: 2 },
  { label: 'Assets', icon: Image, count: 46 },
  { label: 'Dependencies', icon: Package, count: 31 },
  { label: 'Dead code', icon: TriangleAlert, count: 3 },
];

const STATS: Array<{ label: string; value: string; kind: Kind }> = [
  { label: 'Components', value: '9', kind: 'component' },
  { label: 'Hooks', value: '3', kind: 'hook' },
  { label: 'Utilities', value: '4', kind: 'utility' },
  { label: 'Unused exports', value: '3', kind: 'store' },
];

const MOST_USED = [
  { name: 'Button', uses: 5 },
  { name: 'TextInput', uses: 3 },
  { name: 'useCart', uses: 3 },
  { name: 'formatPrice', uses: 2 },
];

const ASSETS: Array<{ name: string; kind: Kind; file: string }> = [
  { name: 'Button', kind: 'component', file: 'src/widgets.tsx' },
  { name: 'useCart', kind: 'hook', file: 'src/cart-state.ts' },
  { name: 'formatPrice', kind: 'utility', file: 'src/misc-helpers.ts' },
  { name: 'AuthContext', kind: 'context', file: 'src/auth-bits.tsx' },
  { name: '/checkout', kind: 'route', file: 'src/routes.tsx' },
];

const PANEL = 'min-w-0 rounded-xl border border-black/8 p-4 dark:border-white/8';
const PANEL_TITLE = 'mb-3 text-xs font-semibold';

export default function DashboardPreview() {
  return (
    <div
      aria-hidden="true"
      className={`tilt-in relative z-1 overflow-hidden rounded-2xl border border-black/14 bg-white text-left text-[12.5px] shadow-2xl shadow-black/25 dark:border-white/14 dark:bg-stone-950 dark:shadow-black/80 ${INK}`}
    >
      {/* window chrome */}
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

      <div className="grid md:min-h-110 md:grid-cols-[200px_1fr]">
        <aside className={`hidden flex-col gap-0.5 border-r ${LINE} bg-neutral-100 px-2.5 py-4 md:flex dark:bg-stone-900`}>
          <div className="flex items-center gap-2 px-2.5 pt-0.5 pb-3.5 text-[13.5px] font-semibold">
            <AtlasMark size={18} /> Atlas
          </div>
          {NAV.map(({ label, icon: Icon, count, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2.25 rounded-lg px-2.5 py-1.75 ${
                active ? `bg-white font-medium shadow-xs dark:bg-stone-800 ${INK}` : MUTED
              }`}
            >
              <Icon size={13} strokeWidth={2} className={active ? 'text-blue-600 dark:text-blue-400' : undefined} />
              <span className="flex-1">{label}</span>
              {count !== undefined && <span className={`text-[11px] tabular-nums ${FAINT}`}>{count}</span>}
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-col gap-4.5 p-4 sm:px-6 sm:py-5.5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <b className="block text-[19px] tracking-tight">Overview</b>
              <span className={`text-xs ${MUTED}`}>sample-app · React + TypeScript · 509 files</span>
            </div>
            <div className={`hidden items-center gap-1.75 rounded-lg border ${LINE} px-2.5 py-1.75 whitespace-nowrap sm:flex ${FAINT}`}>
              <Search size={12} strokeWidth={2} /> Search assets
              <kbd className="ml-4 rounded bg-neutral-100 px-1.25 font-sans text-[10.5px] dark:bg-stone-900">⌘K</kbd>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl bg-neutral-100 px-4 py-3.5 dark:bg-stone-900">
                <span className={`block text-[11.5px] ${MUTED}`}>{s.label}</span>
                <b className={`mt-1 block text-[28px] font-semibold tracking-tighter ${KIND_TEXT[s.kind]}`}>{s.value}</b>
              </div>
            ))}
          </div>

          <div className="grid flex-1 gap-3 md:grid-cols-[1fr_1.3fr]">
            <div className={PANEL}>
              <h4 className={PANEL_TITLE}>Most used</h4>
              {MOST_USED.map((m) => (
                <div key={m.name} className="grid grid-cols-[78px_1fr_24px] items-center gap-2.5 py-1.5">
                  <span className="truncate text-neutral-700 dark:text-neutral-300">{m.name}</span>
                  <i
                    className="block h-1.5 rounded-full bg-linear-to-r from-blue-500 via-violet-500 to-pink-500 opacity-85"
                    style={{ width: `${(m.uses / 5) * 100}%` }}
                  />
                  <span className={`text-right tabular-nums ${MUTED}`}>{m.uses}×</span>
                </div>
              ))}
            </div>
            <div className={`${PANEL} hidden sm:block`}>
              <h4 className={PANEL_TITLE}>Recently discovered</h4>
              <div className="divide-y divide-black/8 dark:divide-white/8">
                {ASSETS.map((a) => (
                  <div key={a.name} className="flex items-center gap-2.5 py-1.5">
                    <span className={`size-2.25 flex-none rounded-full ${KIND_DOT[a.kind]}`} />
                    <b className="font-mono text-xs font-medium">{a.name}</b>
                    <span className={`ml-auto truncate font-mono text-[11px] ${FAINT}`}>{a.file}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
