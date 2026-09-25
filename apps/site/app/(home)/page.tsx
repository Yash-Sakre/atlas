import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Brain,
  ChevronRight,
  Cpu,
  FolderTree,
  Landmark,
  Lock,
  Network,
  Package,
  Sparkles,
  Zap,
} from 'lucide-react';
import CommandBox from '@/components/landing/CommandBox';
import DashboardPreview from '@/components/landing/DashboardPreview';
import DashboardTour from '@/components/landing/DashboardTour';
import GitHubButton from '@/components/landing/GitHubButton';
import Terminal, { TerminalWindow } from '@/components/landing/Terminal';
import {
  ARROW_NUDGE,
  BADGE_NEW,
  BAND,
  BAND_ALT,
  CARD,
  CARD_HOVER,
  CARD_ON_ALT,
  Code,
  EYEBROW,
  FAINT,
  GRAD_TEXT,
  H2,
  H2_SPLIT,
  H3,
  INK,
  INSET,
  KIND_DOT,
  KIND_TEXT,
  LEAD,
  LINE,
  LINK_ARROW,
  MUTED,
  WRAP,
  withCode,
} from '@/components/landing/ui';
import { INSTALL_CMD, LICENSE_URL, NPM_URL, siteUrl } from '@/lib/shared';
import { version } from '../../../../packages/cli/package.json';
import { COMMANDS } from '@/lib/data/commands';
import { DASHBOARD_VIEWS, OUTPUT_FILES } from '@/lib/data/features';

const TITLE = 'Atlas: Find Reusable React Components, Hooks & Dead Code';
const DESCRIPTION =
  'Free, open-source CLI that maps every component, hook, utility, store and route in your React, Next.js or Vite codebase — plus dead code, npm dependencies and architecture. One command, zero config.';

/** Social card: public/og.png, the dark Overview screenshot under the tagline. */
const OG_IMAGE = { url: `${siteUrl}/og.png`, width: 1200, height: 630, alt: 'The Atlas dashboard Overview' };

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    'React component inventory',
    'find unused code',
    'dead code detection',
    'unused exports',
    'dependency graph',
    'codebase visualization',
    'Next.js',
    'Vite',
    'TypeScript',
    'monorepo',
    'static analysis CLI',
    'frontend architecture',
  ],
  alternates: { canonical: `${siteUrl}/` },
  openGraph: { type: 'website', url: `${siteUrl}/`, title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};

/** schema.org description of the tool, so search engines can show it as software. */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Atlas',
  alternateName: 'codebase-atlas',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Linux, Windows (Node.js 20+)',
  description: DESCRIPTION,
  url: `${siteUrl}/`,
  downloadUrl: NPM_URL,
  softwareVersion: version,
  license: LICENSE_URL,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const KINDS = [
  ['Components', 'component'],
  ['Hooks', 'hook'],
  ['Utilities', 'utility'],
  ['Contexts', 'context'],
  ['Stores', 'store'],
  ['Routes', 'route'],
] as const;

const STATS = [
  { value: String(KINDS.length), label: 'asset kinds, found automatically' },
  { value: String(DASHBOARD_VIEWS.length), label: 'dashboard views, one snapshot' },
  { value: String(OUTPUT_FILES.length), label: 'JSON files for CI and tooling' },
  { value: '0', label: 'config files. Really.' },
];

const DEPS = [
  { name: 'react', version: '19.3.0', files: 38, status: 'Up to date', tone: 'text-emerald-600 bg-emerald-600/12 dark:text-emerald-300 dark:bg-emerald-300/12' },
  { name: 'zustand', version: '4.5.2', files: 6, status: '→ 5.0.1', tone: 'text-blue-600 bg-blue-600/10 dark:text-blue-400 dark:bg-blue-400/15' },
  { name: '@acme/ui', version: 'workspace:*', files: 21, status: 'Local', tone: 'text-violet-600 bg-violet-600/12 dark:text-violet-300 dark:bg-violet-300/12' },
  { name: 'lodash', version: '4.17.21', files: 0, status: 'Unused', tone: 'text-orange-600 bg-orange-600/12 dark:text-orange-300 dark:bg-orange-300/12' },
];

const STEPS = [
  { n: '01', title: 'Scan', body: 'Run npx codebase-atlas serve. Every file is parsed with the TypeScript compiler, with path aliases and workspaces resolved.' },
  { n: '02', title: 'Classify', body: 'Each export is sorted by what it does — component, hook, util, context, store or route — never by the folder it lives in.' },
  { n: '03', title: 'Explore', body: 'A local dashboard opens in your browser, and the same snapshot lands in .atlas/ as JSON for CI and tooling.' },
];

/* Styles used by several tiles on this page only. */
const TILE = `${CARD} relative min-w-0 overflow-hidden p-6.5 sm:p-8.5`;
const TILE_TEXT = `leading-relaxed ${MUTED}`;
const TILE_ICON = `mb-5.5 grid size-11 place-items-center rounded-xl bg-white dark:bg-stone-950 ${INK}`;
const CODE_BLOCK = `${INSET} mt-6 overflow-x-auto px-5 py-4.5 font-mono text-[13px] leading-[1.85] whitespace-pre text-neutral-700 dark:text-neutral-300`;
const BADGE_CORNER = `${BADGE_NEW} absolute top-6.5 right-6.5`;
const DIM = 'text-neutral-400 dark:text-neutral-500';

export default function HomePage() {
  return (
    <main>
      <script
        type="application/ld+json"
        // Static, trusted data — serialised here so crawlers read it without running JS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ---------------------------------------------------------------- hero */}
      <header className="pt-16 text-center md:pt-28">
        <div className={WRAP}>
          <Link
            href="/docs/dashboard"
            className={`mb-7 inline-flex items-center gap-2 rounded-full border ${LINE} bg-neutral-100 py-1.25 pr-3 pl-1.25 text-[13.5px] font-medium whitespace-nowrap text-neutral-700 transition-colors hover:border-black/15 motion-safe:animate-rise dark:bg-stone-900 dark:text-neutral-300 dark:hover:border-white/15`}
          >
            <span className="rounded-full bg-blue-600 px-2.25 py-0.75 text-[11.5px] font-semibold text-white dark:bg-blue-500">
              New
            </span>
            Dependencies &amp; static assets
            <ChevronRight size={14} strokeWidth={2.2} className={MUTED} />
          </Link>
          <h1
            className={`text-4xl leading-[1.02] font-bold tracking-tighter text-balance motion-safe:animate-rise motion-safe:[animation-delay:60ms] sm:text-6xl md:text-7xl lg:text-8xl ${INK}`}
          >
            Stop rebuilding what
            <br />
            <span className={GRAD_TEXT}>you already built.</span>
          </h1>
          <p
            className={`mx-auto mt-6.5 mb-9.5 max-w-[44ch] text-lg leading-relaxed text-pretty motion-safe:animate-rise motion-safe:[animation-delay:120ms] md:text-xl ${MUTED}`}
          >
            Atlas maps every React component, hook, utility, store and route in your codebase — plus dead
            code, npm dependencies and architecture. One free command. No config, no sign-up.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3.5 motion-safe:animate-rise motion-safe:[animation-delay:180ms]">
            <CommandBox command={INSTALL_CMD} />
            <Link href="/docs" className={LINK_ARROW}>
              Read the docs <ChevronRight size={16} strokeWidth={2.2} className={ARROW_NUDGE} />
            </Link>
          </div>
        </div>
        <div className="relative mx-auto mt-14 max-w-[1180px] px-6 perspective-[2400px] motion-safe:animate-rise motion-safe:[animation-delay:250ms] md:mt-22">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[12%] top-[8%] h-[70%] bg-radial-[closest-side] from-blue-500/25 to-transparent blur-3xl"
          />
          <DashboardPreview />
        </div>
      </header>

      {/* --------------------------------------------------------------- stats */}
      <section className="pt-18 md:pt-28">
        <div className={WRAP}>
          <div className={`grid grid-cols-2 gap-px border-y ${LINE} bg-black/8 md:grid-cols-4 dark:bg-white/8`}>
            {STATS.map((s) => (
              <div key={s.label} className="reveal bg-white px-5 py-7 md:px-7 md:py-8 dark:bg-stone-950">
                <b className={`block text-5xl leading-none font-bold tracking-tighter lg:text-6xl ${INK}`}>{s.value}</b>
                <span className={`mt-2.5 block text-[15px] ${MUTED}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ features */}
      <section id="features" className={BAND}>
        <div className={WRAP}>
          <div className="reveal max-w-3xl">
            <span className={EYEBROW}>Codebase discovery</span>
            <h2 className={H2}>Your whole frontend, found in one scan.</h2>
            <p className={LEAD}>
              Think Storybook, Compodoc and Madge — generated for you. Atlas reads the TypeScript AST, so it works
              as well on a tidy design system as on a sprawling legacy monorepo.
            </p>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <article className={`${TILE} reveal sm:col-span-2 lg:col-span-4`}>
              <div className={TILE_ICON}><Brain size={20} /></div>
              <h3 className={H3}>Reads intent, not folders.</h3>
              <p className={TILE_TEXT}>
                Every export is classified by what the code <em className={`italic ${INK}`}>does</em>, using the
                TypeScript type checker. Move a file anywhere — a hook is still a hook.
              </p>
              <pre className={CODE_BLOCK}>
                <span className={DIM}>{'// src/cart-state.ts'}</span>
                {'\n'}
                <span className={KIND_TEXT.hook}>hook </span>   useCart       <span className={DIM}>→ returns {'{ items, add }'}</span>
                {'\n'}
                <span className={KIND_TEXT.utility}>util </span>   formatPrice   <span className={DIM}>→ pure · formatter</span>
                {'\n'}
                <span className={KIND_TEXT.store}>store</span>   cartStore     <span className={DIM}>→ zustand · create()</span>
              </pre>
            </article>

            <article className={`${TILE} reveal flex flex-col lg:col-span-2`}>
              <h3 className={H3}>Six kinds. One classifier.</h3>
              <ul className="mt-6.5 grid grid-cols-2 gap-x-3 gap-y-4.5">
                {KINDS.map(([label, kind]) => (
                  <li key={kind} className={`flex items-center gap-2.5 font-medium ${INK}`}>
                    <span className={`size-2.5 rounded-full ring-4 ring-current/18 ${KIND_DOT[kind]} ${KIND_TEXT[kind]}`} />
                    {label}
                  </li>
                ))}
              </ul>
              <p className={`mt-auto pt-6 text-[14.5px] ${MUTED}`}>
                Every reusable building block in your React app, detected the same way.
              </p>
            </article>

            <article className={`${TILE} reveal lg:col-span-2`}>
              <h3 className={H3}>Dead code, caught red-handed.</h3>
              <div className={`mt-3.5 mb-2 text-[104px] leading-none font-bold tracking-tighter ${KIND_TEXT.store}`}>3</div>
              <p className={TILE_TEXT}>unused exports, 2 orphan files and every duplicate — lined up for one clean-up PR.</p>
            </article>

            <article className={`${TILE} reveal sm:col-span-2 lg:col-span-4`}>
              <span className={BADGE_CORNER}>New</span>
              <div className={TILE_ICON}><Package size={20} /></div>
              <h3 className={H3}>Know every npm package you ship.</h3>
              <p className={TILE_TEXT}>
                Installed version, how many files import it, and a live check for updates. <Code>workspace:</Code>,{' '}
                <Code>file:</Code> and git installs are labelled — never guessed.
              </p>
              <div className={`${INSET} mt-6 divide-y divide-black/8 px-4.5 py-1.5 dark:divide-white/8`}>
                {DEPS.map((d) => (
                  <div key={d.name} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.75 text-[13.5px] sm:grid-cols-[1.2fr_1fr_0.7fr_auto]">
                    <code className={`font-mono text-[13px] font-semibold ${INK}`}>{d.name}</code>
                    <span className={`hidden font-mono text-[12.5px] sm:block ${MUTED}`}>{d.version}</span>
                    <span className={`hidden sm:block ${DIM}`}>{d.files} files</span>
                    <span className={`justify-self-end rounded-full px-2.5 py-0.75 text-xs font-semibold whitespace-nowrap ${d.tone}`}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article
              className={`${TILE} reveal flex min-h-85 flex-col justify-end bg-radial-[120%_90%_at_100%_0%] from-orange-500/20 via-fuchsia-500/8 to-transparent to-70% sm:col-span-2 lg:col-span-3`}
            >
              <span className={BADGE_CORNER}>New</span>
              <p className={`mb-2.5 text-sm font-semibold ${KIND_TEXT.store}`}>Static asset audit</p>
              <h3 className={`mb-3.5 text-[26px] leading-[1.12] font-bold tracking-tight lg:text-[32px] ${INK}`}>
                That 4&nbsp;MB hero image nobody uses? <span className={MUTED}>Found on the first scan.</span>
              </h3>
              <p className={TILE_TEXT}>
                Every image, font, video and PDF — with its size, dimensions and every reference from code, CSS
                and markup. Previews stream from disk, so nothing leaves your machine.
              </p>
            </article>

            <article className={`${TILE} reveal sm:col-span-2 lg:col-span-3`}>
              <div className={TILE_ICON}><Network size={20} /></div>
              <h3 className={H3}>See what depends on what.</h3>
              <pre className={CODE_BLOCK}>
{`Checkout
├─ Button
│  ├─ Icon
│  └─ Spinner ─ cn()
└─ useCart ─ cartStore`}
              </pre>
            </article>

            {[
              { icon: Landmark, title: 'Architecture that explains itself', body: <>Module boundaries, your shared layer and the imports that cross the line — each with a fix.</> },
              { icon: FolderTree, title: 'Built for monorepos', body: <>npm, Yarn and pnpm workspaces, Turborepo and Nx — detected automatically, aliases resolved per package.</> },
              { icon: Lock, title: 'Leaves no trace', body: <>Everything lives in one gitignorable <Code>.atlas/</Code> folder. Publish it as a static site with <Code>atlas export</Code>.</> },
            ].map(({ icon: Icon, title, body }) => (
              <article key={title} className={`${TILE} reveal lg:col-span-2`}>
                <div className={TILE_ICON}><Icon size={20} /></div>
                <h3 className={H3}>{title}</h3>
                <p className={TILE_TEXT}>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- dashboard */}
      <section id="dashboard" className={BAND_ALT}>
        <div className={WRAP}>
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className={EYEBROW}>The dashboard</span>
            <h2 className={H2}>A living map of your codebase.</h2>
            <p className={`${LEAD} mx-auto`}>
              Run <Code>atlas serve</Code> and a local dashboard opens in seconds — {DASHBOARD_VIEWS.length} views over
              one snapshot, so every number agrees with every other.
            </p>
          </div>
          <DashboardTour />
          <div className="reveal mt-12 text-center">
            <Link href="/docs/dashboard" className={LINK_ARROW}>
              Take the full tour in the docs <ChevronRight size={16} strokeWidth={2.2} className={ARROW_NUDGE} />
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section id="how" className={BAND}>
        <div className={`${WRAP} grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-20`}>
          <div className="reveal min-w-0">
            <span className={EYEBROW}>How it works</span>
            <h2 className={H2_SPLIT}>From npx to insight in one command.</h2>
            <ol className="mt-9">
              {STEPS.map((s) => (
                <li key={s.n} className={`flex gap-5.5 border-t ${LINE} py-5.5`}>
                  <span className="flex-none pt-1 font-mono text-[13px] font-semibold text-blue-600 dark:text-blue-400">{s.n}</span>
                  <div>
                    <h3 className={`mb-1 text-lg font-bold tracking-tight ${INK}`}>{s.title}</h3>
                    <p className={`text-[15.5px] leading-relaxed ${MUTED}`}>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="reveal min-w-0">
            <Terminal />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- outputs */}
      <section id="outputs" className={BAND_ALT}>
        <div className={`${WRAP} grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-22`}>
          <div className="reveal min-w-0 lg:sticky lg:top-28">
            <span className={EYEBROW}>Outputs</span>
            <h2 className={H2_SPLIT}>Your codebase, as clean JSON.</h2>
            <p className={`${LEAD} mb-5.5`}>
              Every scan writes a plain-JSON snapshot to <Code>.atlas/</Code>. Diff it in pull requests, fail CI
              on new dead code, or pipe it into your own tools.
            </p>
            <Link href="/docs/outputs" className={LINK_ARROW}>
              Output reference <ChevronRight size={16} strokeWidth={2.2} className={ARROW_NUDGE} />
            </Link>
          </div>
          <div className={`${CARD_ON_ALT} reveal min-w-0 divide-y divide-black/8 overflow-hidden dark:divide-white/8`}>
            {OUTPUT_FILES.map((f) => (
              <div key={f.file} className="px-6.5 py-5">
                <code className={`flex items-center gap-2.5 font-mono text-sm font-semibold ${INK}`}>
                  {f.file}
                  {f.isNew && <span className={`${BADGE_NEW} font-sans`}>New</span>}
                </code>
                <p className={`mt-1 text-[14.5px] ${MUTED}`}>{withCode(f.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ AI */}
      <section id="ai" className={BAND}>
        <div className={`${WRAP} grid items-center gap-10 lg:grid-cols-2 lg:gap-20`}>
          <div className="reveal min-w-0">
            <span className={EYEBROW}>AI, on your terms</span>
            <h2 className={H2_SPLIT}>Smart with AI. Complete without it.</h2>
            <p className={LEAD}>
              Atlas documents every asset offline — no API keys, no network calls, no code leaving your laptop.
              Want richer docs? Hand the same context to your AI agent.
            </p>
            <ul className="mt-8 grid gap-4.5">
              {[
                { icon: Cpu, title: 'Offline-first docs.', body: <>Built from real AST facts, so signatures are never hallucinated.</> },
                { icon: Sparkles, title: 'Optional AI pass.', body: <><Code>atlas ai</Code> has Claude Code, Codex or Cursor describe every asset.</> },
                { icon: Zap, title: 'Agent-ready context.', body: <>Give your coding agent a map of what exists, so it reuses instead of reinventing.</> },
              ].map(({ icon: Icon, title, body }) => (
                <li key={title} className={`flex gap-3.5 leading-relaxed ${MUTED}`}>
                  <Icon size={18} className="mt-0.5 flex-none text-blue-600 dark:text-blue-400" />
                  <span>
                    <b className={`font-semibold ${INK}`}>{title}</b> {body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal min-w-0">
            <TerminalWindow title="atlas ai">
              <span className="text-blue-400">$</span> <span className="text-white">atlas ai --agent claude --model haiku</span>
              {'\n'}
              <span className="text-stone-400">→ Handing 135 assets to Claude Code…</span>
              {'\n'}
              <span className="text-green-400">✓</span> Claude Code described 135/135 assets in 2m 41s
              {'\n'}
              <span className="text-green-400">✓</span> Button       <span className="text-stone-400">Renders a 4-variant button with a loading state</span>
              {'\n'}
              <span className="text-green-400">✓</span> useDebounce  <span className="text-stone-400">Delays a value by `delay` ms</span>
              {'\n'}
              <span className="text-amber-300">i</span> <span className="text-stone-400">Read-only agent, batched and resumable, no API keys</span>
            </TerminalWindow>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ commands */}
      <section id="commands" className={BAND_ALT}>
        <div className={WRAP}>
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className={EYEBROW}>The toolbox</span>
            <h2 className={H2}>{COMMANDS.length} commands. One toolbox.</h2>
            <p className={`${LEAD} mx-auto`}>
              Analyze, search, graph, export, watch — every command works on any React, Next.js or Vite project,
              with nothing to configure and nothing committed to your repo.
            </p>
          </div>
          <div className="mt-16 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {COMMANDS.map((c) => (
              <Link
                key={c.id}
                href={`/docs/cli/${c.id}`}
                className={`${CARD_ON_ALT} ${CARD_HOVER} reveal group relative rounded-[20px] px-6 pt-6 pb-6.5`}
              >
                <code className={`font-mono text-[14.5px] font-semibold ${INK}`}>{c.name}</code>
                <p className={`mt-2 pr-3 text-[14.5px] ${MUTED}`}>{c.tagline}</p>
                <ChevronRight
                  size={16}
                  className={`absolute top-6.5 right-5 transition duration-300 group-hover:translate-x-0.75 group-hover:text-blue-600 dark:group-hover:text-blue-400 ${FAINT}`}
                />
              </Link>
            ))}
          </div>
          <div className="reveal mx-auto mt-14 grid max-w-4xl items-center gap-8 md:grid-cols-[1fr_1.3fr]">
            <div>
              <h3 className={H3}>Or just run <Code>atlas</Code>.</h3>
              <p className={`leading-relaxed ${MUTED}`}>
                No flags to remember: in a terminal, Atlas opens a menu over every command and asks only for
                what the action needs — including an AI pass with the coding agent you already have.
              </p>
            </div>
            <TerminalWindow title="atlas">
              <span className="text-blue-400">$</span> <span className="text-white">atlas</span>
              {'\n'}
              <span className="text-stone-500">┌</span>  <span className="bg-cyan-400 px-1 text-stone-950">atlas</span> <span className="text-stone-500">v{version}</span>
              {'\n'}
              <span className="text-green-400">◇</span>  Project to scan <span className="text-stone-400">·</span> .
              {'\n'}
              <span className="text-cyan-400">◆</span>  What do you want to do?
              {'\n'}
              <span className="text-stone-500">│</span>  <span className="text-green-400">●</span> Open the dashboard <span className="text-stone-500">(analyze + browse)</span>
              {'\n'}
              <span className="text-stone-500">│</span>  <span className="text-stone-500">○</span> Describe assets with AI <span className="text-stone-500">(via Claude Code)</span>
              {'\n'}
              <span className="text-stone-500">│</span>  <span className="text-stone-500">○</span> Analyze · Search · Dead code · Graph…
              {'\n'}
              <span className="text-stone-500">└</span>
            </TerminalWindow>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- cta */}
      <section className="bg-radial-[60%_55%_at_50%_45%] from-blue-500/10 to-transparent to-70% py-28 text-center md:py-48">
        <div className={`${WRAP} reveal`}>
          <h2 className={`text-4xl leading-[1.02] font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl ${INK}`}>
            Stop rebuilding.
            <br />
            <span className={GRAD_TEXT}>Start reusing.</span>
          </h2>
          <p className={`${LEAD} mx-auto mt-5 mb-10`}>
            Free and open source under MIT. No config, no sign-up, nothing written to your repo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3.5">
            <CommandBox command={INSTALL_CMD} />
            <GitHubButton variant="primary" label="Star on GitHub" />
          </div>
        </div>
      </section>
    </main>
  );
}
