/**
 * Static assets browser.
 *
 * Every tile previews the real file, streamed from its path in the codebase by
 * `atlas serve` — nothing is copied into the dashboard or embedded in the data
 * payload. A preview that can't load (hosted export, deleted file) degrades to
 * a typed placeholder rather than a broken image.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FiImage,
  FiInbox,
  FiType,
  FiFilm,
  FiMusic,
  FiFileText,
  FiX,
  FiExternalLink,
  FiAlertCircle,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useData } from '../data';
import type { StaticAsset, StaticAssetKind } from '../types';
import { EditorLink, SearchField, useFuzzy } from '../ui';
import { fileUrl, formatBytes, formatDimensions, isPreviewable } from '../lib/assetFile';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const KIND_ICON: Record<StaticAssetKind, IconType> = {
  image: FiImage,
  vector: FiImage,
  font: FiType,
  video: FiFilm,
  audio: FiMusic,
  document: FiFileText,
};

const KIND_COLOR: Record<StaticAssetKind, string> = {
  image: 'var(--color-t-component)',
  vector: 'var(--color-t-utility)',
  font: 'var(--color-t-hook)',
  video: 'var(--color-t-route)',
  audio: 'var(--color-t-store)',
  document: 'var(--color-t-context)',
};

const KIND_ORDER: StaticAssetKind[] = ['image', 'vector', 'font', 'video', 'audio', 'document'];

type Sort = 'name' | 'size' | 'usage';

const SORTS: Array<[Sort, string]> = [
  ['name', 'name'],
  ['size', 'size'],
  ['usage', 'usage'],
];

const SEARCH_KEYS = ['name', 'path', 'ext'];

export default function Assets() {
  const data = useData();
  const report = data.staticAssets;
  const assets = useMemo<StaticAsset[]>(() => report?.assets || [], [report]);

  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('name');
  const [active, setActive] = useState<StaticAsset | null>(null);

  const fuzzy = useFuzzy(assets, SEARCH_KEYS);

  const kindsPresent = useMemo(
    () => KIND_ORDER.filter((k) => assets.some((a) => a.kind === k)),
    [assets],
  );

  const rows = useMemo(() => {
    let base = fuzzy(query);
    if (kinds.length) base = base.filter((a) => kinds.includes(a.kind));
    if (flags.includes('unused')) base = base.filter((a) => !(a.usageCount || 0));
    if (flags.includes('public')) base = base.filter((a) => a.isPublic);
    const sorted = base.slice();
    if (sort === 'size') sorted.sort((a, b) => b.size - a.size);
    else if (sort === 'usage') sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kinds, flags, sort, assets]);

  if (!report || assets.length === 0) {
    return (
      <>
        <Head bytes={0} count={0} />
        <div className="flex items-center gap-4 rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
          <FiImage size={26} className="text-ink-faint" />
          <div>
            <h2 className="m-0 mb-1 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
              No static assets found
            </h2>
            <p className="text-ink-faint">
              Atlas didn’t find any images, vectors, fonts or media in this project. If you added
              some since the last scan, refresh with{' '}
              <span className="font-mono tracking-normal">atlas serve --reanalyze</span>.
            </p>
          </div>
        </div>
      </>
    );
  }

  const c = report.counts;
  const kpis: Array<{ label: string; n: string | number; hue: string }> = [
    { label: 'Files', n: c.total, hue: 'var(--color-t-component)' },
    { label: 'Images', n: (c.byKind.image || 0) + (c.byKind.vector || 0), hue: KIND_COLOR.vector },
    { label: 'Fonts', n: c.byKind.font || 0, hue: KIND_COLOR.font },
    { label: 'Media', n: (c.byKind.video || 0) + (c.byKind.audio || 0), hue: KIND_COLOR.video },
    { label: 'On disk', n: formatBytes(c.totalBytes), hue: 'var(--color-ink-muted)' },
    { label: 'Unreferenced', n: c.unused, hue: 'var(--color-warn)' },
  ];

  return (
    <>
      <Head bytes={c.totalBytes} count={c.total} />

      <div className="mb-4 grid grid-cols-6 gap-4 max-[1320px]:grid-cols-3 max-[620px]:grid-cols-2">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="relative flex cursor-default flex-col gap-3 rounded-2xl bg-surface-1 px-4.5 pt-4.5 pb-4.25 shadow-card"
          >
            <div className="flex items-center gap-1.75">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: k.hue }} />
              <span className="text-[12.5px] tracking-[-0.01em] text-ink-muted">{k.label}</span>
            </div>
            <div className="font-display text-[34px] leading-[0.9] font-semibold tracking-[-0.04em] tabular-nums text-ink">
              {k.n}
            </div>
          </div>
        ))}
      </div>

      <section className="flex min-h-0 flex-auto flex-col rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search assets by name or path…" />
          {kindsPresent.length > 1 && (
            <ToggleGroup type="multiple" value={kinds} onValueChange={setKinds} className="flex flex-wrap gap-1.5">
              {kindsPresent.map((k) => (
                <ToggleGroupItem key={k} value={k} title={`Show only ${k} files`}>
                  {k}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <ToggleGroup type="multiple" value={flags} onValueChange={setFlags} className="flex flex-wrap gap-1.5">
            <ToggleGroupItem value="unused" title="Never referenced from code, styles or markup">
              unreferenced
            </ToggleGroupItem>
            <ToggleGroupItem value="public" title="Served verbatim from public/ or static/">
              public
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={sort}
            onValueChange={(v) => v && setSort(v as Sort)}
            className="flex flex-wrap gap-1.5"
          >
            {SORTS.map(([key, label]) => (
              <ToggleGroupItem key={key} value={key} title={`Sort by ${label}`}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="shrink-0 text-[12.5px] whitespace-nowrap tabular-nums text-ink-faint">
            <b className="font-semibold text-ink-muted">{rows.length}</b> / {assets.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center text-[13.5px] text-ink-faint">
            <FiInbox size={24} strokeWidth={1.6} />
            <p>No assets match your filters.</p>
          </div>
        ) : (
          <div className="-mx-1 min-h-0 flex-auto overflow-y-auto overscroll-contain px-1 pb-1">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5">
              {rows.map((a) => (
                <button
                  key={a.id}
                  className="relative flex cursor-pointer flex-col gap-2.5 rounded-lg bg-surface-2 p-2.5 text-left transition-[background-color,transform] duration-120 hover:-translate-y-px hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring"
                  onClick={() => setActive(a)}
                  title={a.path}
                >
                  <span className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-[#100f0e] [background-image:linear-gradient(45deg,rgba(255,255,255,0.035)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.035)_75%),linear-gradient(45deg,rgba(255,255,255,0.035)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.035)_75%)] [background-position:0_0,7px_7px] [background-size:14px_14px]">
                    <Preview asset={a} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-[12.5px] tracking-normal text-ink">
                      {a.name}
                    </span>
                    <span className="truncate text-[11.5px] tabular-nums text-ink-faint">
                      {formatBytes(a.size)}
                      {a.dimensions ? ` · ${formatDimensions(a)}` : ''}
                      {a.usageCount ? ` · ${a.usageCount}×` : ''}
                    </span>
                  </span>
                  {!a.usageCount && (
                    <span
                      className="absolute top-4 right-4 rounded-full bg-[rgba(241,178,75,0.16)] px-1.75 py-0.5 text-[10px] text-warn backdrop-blur-[3px]"
                      title="Never referenced from code, styles or markup"
                    >
                      unreferenced
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {active && <Lightbox asset={active} root={data.meta.root} onClose={() => setActive(null)} />}
    </>
  );
}

/* -------------------------------- Previews ------------------------------- */

/** Thumbnail for a card. Falls back to a kind glyph when the file can't load. */
function Preview({ asset }: { asset: StaticAsset }) {
  const [failed, setFailed] = useState(false);
  const Icon = KIND_ICON[asset.kind];

  if (failed || !isPreviewable(asset.kind)) {
    return (
      <span
        className="flex flex-col items-center gap-1.5"
        style={{ color: KIND_COLOR[asset.kind] }}
      >
        <Icon size={22} strokeWidth={1.6} />
        <span className="font-mono text-[10.5px] tracking-normal text-ink-faint uppercase">
          {asset.ext}
        </span>
      </span>
    );
  }

  if (asset.kind === 'font') return <FontPreview asset={asset} sample="Ag" onFail={() => setFailed(true)} />;

  if (asset.kind === 'video') {
    return (
      <video
        className="max-h-full max-w-full object-contain"
        src={fileUrl(asset.path)}
        preload="metadata"
        muted
        playsInline
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      className="max-h-full max-w-full object-contain"
      src={fileUrl(asset.path)}
      alt={asset.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Renders sample text in the actual font file by registering an `@font-face`
 * that points at the file's path. `document.fonts.load` tells us whether the
 * browser could really parse it, so an unreachable file falls back instead of
 * silently rendering in the UI font.
 */
function FontPreview({
  asset,
  sample,
  onFail,
}: {
  asset: StaticAsset;
  sample: string;
  onFail: () => void;
}) {
  const family = useMemo(() => `atlas-font-${slug(asset.path)}`, [asset.path]);
  const css = `@font-face{font-family:"${family}";src:url("${fileUrl(asset.path)}");font-display:block;}`;

  useEffect(() => {
    let cancelled = false;
    document.fonts?.load(`16px "${family}"`).then(
      (faces) => {
        if (!cancelled && faces.length === 0) onFail();
      },
      () => {
        if (!cancelled) onFail();
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  return (
    <>
      <style>{css}</style>
      <span
        className="text-[42px] leading-none text-ink"
        style={{ fontFamily: `"${family}", var(--font-display)` }}
      >
        {sample}
      </span>
    </>
  );
}

/* -------------------------------- Lightbox ------------------------------- */

function Lightbox({
  asset,
  root,
  onClose,
}: {
  asset: StaticAsset;
  root?: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = KIND_ICON[asset.kind];
  const url = fileUrl(asset.path);
  const refs = asset.usedIn || [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const meta: Array<[string, ReactNode]> = [
    ['Path', <span className="font-mono tracking-normal">{asset.path}</span>],
    ['Kind', `${asset.kind} · ${asset.ext}`],
    ['Size', formatBytes(asset.size)],
    ['Dimensions', formatDimensions(asset)],
    ['Modified', asset.modified ? new Date(asset.modified).toLocaleString() : '—'],
    [
      'Served at',
      asset.publicUrl ? (
        <span className="font-mono tracking-normal">{asset.publicUrl}</span>
      ) : (
        'bundled'
      ),
    ],
  ];
  if (asset.workspace) meta.push(['Workspace', asset.workspace]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,5,0.72)] px-[4vw] py-[4vh] backdrop-blur-[4px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-[min(920px,100%)] min-h-0 flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-hairline-soft py-3.5 pr-4 pl-5">
          <div className="flex min-w-0 items-center gap-2.5 text-[13.5px] text-ink">
            <Badge withDot style={{ color: KIND_COLOR[asset.kind] }}>{asset.kind}</Badge>
            <span className="truncate font-mono tracking-normal">{asset.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3.5 text-[12.5px]">
            <EditorLink root={root} path={asset.path}>open in editor</EditorLink>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex max-w-full min-w-0 items-center gap-1.25 rounded-sm text-inherit no-underline transition-colors duration-120 hover:text-accent"
            >
              open file
              <FiExternalLink
                className="h-3 w-3 shrink-0 text-accent opacity-0 transition-opacity duration-120 group-hover:opacity-100"
                aria-hidden="true"
              />
            </a>
            <button
              type="button"
              className="inline-flex cursor-pointer text-ink-faint transition-colors duration-120 hover:text-ink"
              onClick={onClose}
              aria-label="Close"
            >
              <FiX size={17} />
            </button>
          </div>
        </header>

        <div className="flex max-h-[46vh] min-h-[180px] items-center justify-center bg-[#0e0d0c] p-5 [background-image:linear-gradient(45deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.03)_75%),linear-gradient(45deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.03)_75%)] [background-position:0_0,9px_9px] [background-size:18px_18px] [&_img]:max-h-[calc(46vh-40px)] [&_img]:max-w-full [&_img]:object-contain [&_video]:max-h-[calc(46vh-40px)] [&_video]:max-w-full [&_video]:object-contain">
          {/* Audio has no thumbnail worth showing in the grid, but it plays fine here. */}
          {failed || (!isPreviewable(asset.kind) && asset.kind !== 'audio') ? (
            <div className="flex max-w-[420px] flex-col items-center gap-2.5 text-center [&_p]:m-0 [&_p]:text-[12.5px]">
              <Icon size={34} strokeWidth={1.4} style={{ color: KIND_COLOR[asset.kind] }} />
              <p className="text-ink-faint">
                {failed ? (
                  <>
                    <FiAlertCircle size={13} className="mr-1.25 align-[-2px] inline" />
                    Couldn’t read this file from disk — previews need a local{' '}
                    <span className="font-mono tracking-normal">atlas serve</span>.
                  </>
                ) : (
                  <>No inline preview for {asset.ext} files — use “open file”.</>
                )}
              </p>
            </div>
          ) : asset.kind === 'font' ? (
            <div className="[&>span]:block [&>span]:text-center [&>span]:text-[40px] [&>span]:wrap-break-word">
              <FontPreview asset={asset} sample="AaBbCcDdEe 0123456789" onFail={() => setFailed(true)} />
            </div>
          ) : asset.kind === 'video' ? (
            <video src={url} controls preload="metadata" onError={() => setFailed(true)} />
          ) : asset.kind === 'audio' ? (
            <div className="flex flex-col items-center gap-3.5">
              <Icon size={30} strokeWidth={1.4} style={{ color: KIND_COLOR.audio }} />
              <audio
                src={url}
                controls
                preload="metadata"
                className="w-[min(420px,70vw)]"
                onError={() => setFailed(true)}
              />
            </div>
          ) : (
            <img src={url} alt={asset.name} onError={() => setFailed(true)} />
          )}
        </div>

        <div className="min-h-0 flex-auto overflow-y-auto px-5 pt-4.5 pb-5.5">
          <dl className="m-0 mb-5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-5 gap-y-3 [&_dd]:mt-0.75 [&_dd]:mb-0 [&_dd]:text-[12.5px] [&_dd]:break-all [&_dd]:text-ink-muted [&_dt]:text-[11px] [&_dt]:tracking-[0.05em] [&_dt]:text-ink-faint [&_dt]:uppercase">
            {meta.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="[&_ul]:max-h-[240px] [&_ul]:overflow-y-auto">
            <p className="m-0 mb-2.25 text-[11px] font-semibold tracking-[0.05em] text-ink-faint uppercase">
              Referenced in {refs.length ? `(${refs.length})` : ''}
            </p>
            {refs.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-faint">
                No reference found in code, styles or markup — this file may be dead weight, or
                loaded through a path Atlas can’t see (a runtime-built URL, a CMS).
              </p>
            ) : (
              <ul className="flex max-h-[240px] flex-col gap-px overflow-y-auto">
                {refs.slice(0, 40).map((r, i) => (
                  <li
                    key={`${r.filePath}:${r.line}:${i}`}
                    className="flex min-w-0 items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-surface-2"
                  >
                    <EditorLink
                      root={root}
                      path={r.filePath}
                      line={r.line}
                      className="min-w-0 flex-1 truncate font-mono text-[12.5px] tracking-normal text-ink-muted"
                    >
                      {r.filePath}
                    </EditorLink>
                    <span className="shrink-0 font-mono text-[12.5px] tracking-normal text-ink-faint">
                      :{r.line}
                    </span>
                    <span className="shrink-0 rounded-sm bg-surface-2 px-1.5 py-px font-mono text-[10.5px] tracking-normal text-ink-faint">
                      {r.kind}
                    </span>
                  </li>
                ))}
                {refs.length > 40 && (
                  <p className="mt-2 pl-2 text-xs text-ink-faint">+{refs.length - 40} more</p>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Utils --------------------------------- */

/** CSS-identifier-safe token derived from a path (for @font-face families). */
function slug(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i += 1) h = (h * 31 + path.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function Head({ bytes, count }: { bytes: number; count: number }) {
  return (
    <div className="mb-5.5 flex flex-wrap items-end justify-between gap-5 border-b border-hairline-soft pb-4.5">
      <div className="min-w-0">
        <h1 className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
          Assets
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          Static files this project ships — images, vectors, fonts, media and documents. Each
          preview is the real file, read from its path on disk; nothing is copied or bundled.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.75 py-1 text-xs font-medium tabular-nums text-ink-muted">
          {count} file{count === 1 ? '' : 's'} · {formatBytes(bytes)}
        </span>
      </div>
    </div>
  );
}
