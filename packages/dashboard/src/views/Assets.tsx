/**
 * Static assets browser.
 *
 * Every tile previews the real file, streamed from its path in the codebase by
 * `atlas serve` — nothing is copied into the dashboard or embedded in the data
 * payload. A preview that can't load (hosted export, deleted file) degrades to
 * a typed placeholder rather than a broken image.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ArrowSquareOut,
  BezierCurve,
  CheckCircle,
  Code,
  FileText,
  FilmStrip,
  FunnelSimple,
  Image,
  MusicNotes,
  TextAa,
  Warning,
  WarningCircle,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useData } from '../data';
import type { StaticAsset, StaticAssetKind } from '../types';
import { FilterCount, SearchField, EditorLink, useSearch } from '../ui';
import { editorHref } from '../lib/editor';
import { fileUrl, formatBytes, formatDimensions, isPreviewable } from '../lib/assetFile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<StaticAssetKind, PhosphorIcon> = {
  image: Image,
  vector: BezierCurve,
  font: TextAa,
  video: FilmStrip,
  audio: MusicNotes,
  document: FileText,
};

/** Identity dot per kind — always beside the kind's name, never alone. */
const KIND_HUE: Record<StaticAssetKind, string> = {
  image: 'var(--color-t-component)',
  vector: 'var(--color-t-utility)',
  font: 'var(--color-t-hook)',
  video: 'var(--color-t-route)',
  audio: 'var(--color-t-store)',
  document: 'var(--color-t-context)',
};

const KIND_LABEL: Record<StaticAssetKind, string> = {
  image: 'Images',
  vector: 'Vectors',
  font: 'Fonts',
  video: 'Video',
  audio: 'Audio',
  document: 'Documents',
};

const KIND_ORDER: StaticAssetKind[] = ['image', 'vector', 'font', 'video', 'audio', 'document'];

/**
 * Transparency checkerboard from theme tokens: two offset 45° gradients of the
 * soft hairline over the canvas. Callers add `background-size` / `-position`.
 */
const CHECKER =
  'bg-canvas [background-image:linear-gradient(45deg,var(--color-hairline-soft)_25%,transparent_25%,transparent_75%,var(--color-hairline-soft)_75%),linear-gradient(45deg,var(--color-hairline-soft)_25%,transparent_25%,transparent_75%,var(--color-hairline-soft)_75%)]';

type Sort = 'name' | 'size' | 'usage';

const SEARCH_KEYS = ['name'];

const UNREFERENCED_HINT = 'Never referenced from code, styles or markup';

export default function Assets() {
  const data = useData();
  const report = data.staticAssets;
  const assets = useMemo<StaticAsset[]>(() => report?.assets || [], [report]);

  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('name');
  const [active, setActive] = useState<StaticAsset | null>(null);

  const search = useSearch(assets, SEARCH_KEYS);

  const kindsPresent = useMemo(
    () => KIND_ORDER.filter((k) => assets.some((a) => a.kind === k)),
    [assets],
  );

  const rows = useMemo(() => {
    let base = search(query);
    if (kinds.length) base = base.filter((a) => kinds.includes(a.kind));
    if (flags.includes('unused')) base = base.filter((a) => !(a.usageCount || 0));
    if (flags.includes('public')) base = base.filter((a) => a.isPublic);
    if (sort === 'size') base.sort((a, b) => b.size - a.size);
    else if (sort === 'usage') base.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    else base.sort((a, b) => a.name.localeCompare(b.name));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kinds, flags, sort, assets]);

  const filtered = !!query || kinds.length > 0 || flags.length > 0;
  const clearFilters = () => {
    setQuery('');
    setKinds([]);
    setFlags([]);
  };

  if (!report || assets.length === 0) {
    return (
      <>
        <PageHeader title="Assets" description="Static files this project ships." />
        <Card>
          <EmptyState icon={<Image size={20} />} title="No static assets found">
            Atlas didn’t find any images, vectors, fonts or media in this project. If you added some
            since the last scan, refresh with <span className="font-mono">atlas serve --reanalyze</span>.
          </EmptyState>
        </Card>
      </>
    );
  }

  const c = report.counts;
  const k = (kind: StaticAssetKind) => c.byKind?.[kind] || 0;
  const images = k('image') + k('vector');
  const media = k('font') + k('video') + k('audio');

  return (
    <>
      <PageHeader
        title="Assets"
        description="Images, vectors, fonts, media and documents this project ships. Each preview is the real file, read from disk — nothing is copied or bundled."
        actions={
          c.unused ? (
            <Badge variant="warn">
              <Warning size={11} weight="fill" />
              {c.unused} unreferenced
            </Badge>
          ) : (
            <Badge variant="success">
              <CheckCircle size={11} weight="fill" />
              All referenced
            </Badge>
          )
        }
      />

      <div className="mb-4 grid shrink-0 grid-cols-5 gap-4 max-[1180px]:grid-cols-3 max-[640px]:grid-cols-2">
        <StatCard label="Files" value={c.total} hint={`${kindsPresent.length} kind${kindsPresent.length === 1 ? '' : 's'}`} />
        <StatCard label="Images" value={images} hint={`${k('image')} raster · ${k('vector')} vector`} />
        <StatCard
          label="Fonts & media"
          value={media}
          hint={`${k('font')} font${k('font') === 1 ? '' : 's'} · ${k('video') + k('audio')} a/v`}
        />
        <StatCard
          label="On disk"
          value={formatBytes(c.totalBytes)}
          hint={c.total ? `~${formatBytes(Math.round(c.totalBytes / c.total))} each` : undefined}
          info="Combined size of every static file on disk — before any build-time optimisation."
        />
        <StatCard
          label="Unreferenced"
          value={c.unused}
          hint={c.unused ? formatBytes(assets.filter((a) => !(a.usageCount || 0)).reduce((s, a) => s + a.size, 0)) : 'none'}
          info="No reference found in code, styles or markup. It may be dead weight — or loaded through a path Atlas can’t see, like a runtime-built URL or a CMS."
          badge={
            c.unused
              ? { text: 'Review', tone: 'warn', icon: <Warning size={11} weight="fill" /> }
              : { text: 'Clear', tone: 'success', icon: <CheckCircle size={11} weight="fill" /> }
          }
        />
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden max-[900px]:overflow-visible">
        <CardHeader className="flex-wrap justify-start gap-x-3 gap-y-2.5 pb-3.5">
          <SearchField value={query} onChange={setQuery} placeholder="Search assets by name…" className="max-w-xs min-w-48" />
          {kindsPresent.length > 1 && (
            <ToggleGroup type="multiple" value={kinds} onValueChange={setKinds} aria-label="Filter by kind">
              {kindsPresent.map((kind) => (
                <ToggleGroupItem key={kind} value={kind} title={`Show only ${kind} files`}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_HUE[kind] }} aria-hidden="true" />
                  {KIND_LABEL[kind]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <ToggleGroup type="multiple" value={flags} onValueChange={setFlags} aria-label="Filter by status">
            <ToggleGroupItem value="unused" title={UNREFERENCED_HINT}>
              <Warning size={12} />
              Unreferenced
            </ToggleGroupItem>
            <ToggleGroupItem value="public" title="Served verbatim from public/ or static/">
              Public
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="ml-auto flex items-center gap-3">
            <FilterCount shown={rows.length} total={assets.length} />
            <Tabs value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <TabsList aria-label="Sort by">
                <TabsTrigger value="name">Name</TabsTrigger>
                <TabsTrigger value="size">Size</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FunnelSimple size={20} />}
            title="No assets match your filters"
            action={
              filtered && (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-5 max-[900px]:overflow-visible">
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3 p-0">
              {rows.map((a, i) => (
                <li key={a.id} className="min-w-0">
                  <Tile asset={a} index={i} onOpen={() => setActive(a)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[92vh]">
          {active && <Lightbox key={active.id} asset={active} root={data.meta.root} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────────────── Tiles ─────────────────────────────── */

function Tile({ asset: a, index, onOpen }: { asset: StaticAsset; index: number; onOpen: () => void }) {
  const unreferenced = !(a.usageCount || 0);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      title={a.path}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: Math.min(index, 20) * 0.02 } }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group flex w-full cursor-pointer flex-col gap-2.5 rounded-lg bg-surface-2/40 p-2 text-left shadow-[inset_0_0_0_1px_var(--color-hairline-soft)] transition-[background-color,box-shadow] duration-150 hover:bg-surface-2 hover:shadow-(--elevation-card) focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          CHECKER,
          'relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-position-[0_0,7px_7px] bg-size-[14px_14px]',
        )}
      >
        <Preview asset={a} />
        {unreferenced && (
          <Badge variant="warn" className="absolute top-1.5 right-1.5 bg-surface-1 shadow-(--elevation-card)" title={UNREFERENCED_HINT}>
            <Warning size={11} weight="fill" />
            Unreferenced
          </Badge>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-0.5 pb-0.5">
        <span className="truncate font-mono text-[12.5px] text-ink">{a.name}</span>
        <span className="truncate text-[11.5px] text-ink-faint tabular-nums">
          {formatBytes(a.size)}
          {a.dimensions ? ` · ${formatDimensions(a)}` : ''}
          {a.usageCount ? ` · ${a.usageCount} ref${a.usageCount === 1 ? '' : 's'}` : ''}
        </span>
      </span>
    </motion.button>
  );
}

/** Kind glyph + extension — the fallback when a file has no inline preview. */
function KindGlyph({ asset, size = 22 }: { asset: StaticAsset; size?: number }) {
  const Icon = KIND_ICON[asset.kind];
  return (
    <span className="flex flex-col items-center gap-1.5 text-ink-faint">
      <Icon size={size} />
      <span className="font-mono text-[10.5px] uppercase">{asset.ext}</span>
    </span>
  );
}

/** Thumbnail for a tile. Falls back to a kind glyph when the file can't load. */
function Preview({ asset }: { asset: StaticAsset }) {
  const [failed, setFailed] = useState(false);

  if (failed || !isPreviewable(asset.kind)) return <KindGlyph asset={asset} />;

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
  className,
}: {
  asset: StaticAsset;
  sample: string;
  onFail: () => void;
  className?: string;
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
        className={cn('text-[42px] leading-none text-ink', className)}
        style={{ fontFamily: `"${family}", var(--font-display)` }}
      >
        {sample}
      </span>
    </>
  );
}

/* ────────────────────────────── Lightbox ────────────────────────────── */

/** Dialog body for one asset. Keyed by asset id, so preview state resets. */
function Lightbox({ asset, root }: { asset: StaticAsset; root?: string }) {
  const [failed, setFailed] = useState(false);
  const url = fileUrl(asset.path);
  const refs = asset.usedIn || [];
  const editor = editorHref(root, asset.path);
  const Icon = KIND_ICON[asset.kind];

  const meta: Array<[string, ReactNode]> = [
    ['Path', <span className="font-mono">{asset.path}</span>],
    ['Kind', `${asset.kind} · ${asset.ext}`],
    ['Size', formatBytes(asset.size)],
    ['Dimensions', formatDimensions(asset)],
    ['Modified', asset.modified ? new Date(asset.modified).toLocaleString() : '—'],
    ['Served at', asset.publicUrl ? <span className="font-mono">{asset.publicUrl}</span> : 'bundled'],
  ];
  if (asset.workspace) meta.push(['Workspace', asset.workspace]);

  const noPreview = failed || (!isPreviewable(asset.kind) && asset.kind !== 'audio');

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline-soft py-3 pr-3 pl-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Badge dot={KIND_HUE[asset.kind]}>{asset.kind}</Badge>
          <div className="min-w-0">
            <DialogTitle className="m-0 truncate font-mono text-[13.5px] font-medium text-ink">{asset.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Preview, metadata and references for {asset.path}
            </DialogDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editor && (
            <Button asChild variant="ghost" size="sm">
              <a href={editor}>
                <Code size={14} />
                Open in editor
              </a>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <a href={url} target="_blank" rel="noreferrer">
              <ArrowSquareOut size={14} />
              Open file
            </a>
          </Button>
          <Tooltip content="Close (Esc)">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X size={16} />
              </Button>
            </DialogClose>
          </Tooltip>
        </div>
      </header>

      <div
        className={cn(
          CHECKER,
          'flex max-h-[46vh] min-h-45 shrink-0 items-center justify-center p-5 bg-position-[0_0,9px_9px] bg-size-[18px_18px]',
          '[&_img]:max-h-[calc(46vh-40px)] [&_img]:max-w-full [&_img]:object-contain [&_video]:max-h-[calc(46vh-40px)] [&_video]:max-w-full [&_video]:object-contain',
        )}
      >
        {/* Audio has no thumbnail worth showing in the grid, but it plays fine here. */}
        {noPreview ? (
          <div className="flex max-w-105 flex-col items-center gap-2.5 text-center">
            <Icon size={32} className="text-ink-faint" />
            <p className="m-0 text-[12.5px] text-ink-faint">
              {failed ? (
                <>
                  <WarningCircle size={13} className="mr-1 inline align-[-2px]" />
                  Couldn’t read this file from disk — previews need a local{' '}
                  <span className="font-mono">atlas serve</span>.
                </>
              ) : (
                <>No inline preview for {asset.ext} files — use “Open file”.</>
              )}
            </p>
          </div>
        ) : asset.kind === 'font' ? (
          <FontPreview
            asset={asset}
            sample="AaBbCcDdEe 0123456789"
            onFail={() => setFailed(true)}
            className="block text-center text-[40px] wrap-break-word"
          />
        ) : asset.kind === 'video' ? (
          <video src={url} controls preload="metadata" onError={() => setFailed(true)} />
        ) : asset.kind === 'audio' ? (
          <div className="flex flex-col items-center gap-3.5">
            <Icon size={30} className="text-ink-faint" />
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4.5 pb-5">
        <dl className="m-0 mb-5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-5 gap-y-3.5">
          {meta.map(([key, v]) => (
            <div key={key} className="min-w-0">
              <dt className="text-[12px] text-ink-faint">{key}</dt>
              <dd className="m-0 mt-0.5 text-[12.5px] break-all text-ink-muted tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        <h3 className="m-0 mb-2 flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
          Referenced in
          {refs.length > 0 && <span className="text-ink-faint tabular-nums">{refs.length}</span>}
        </h3>
        {refs.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3.5 py-3 text-[12.5px] text-ink-muted">
            <Warning size={15} weight="fill" className="mt-px shrink-0 text-warn" />
            <p className="m-0">
              <span className="font-medium text-ink">Unreferenced.</span> No reference found in code,
              styles or markup — this file may be dead weight, or loaded through a path Atlas can’t
              see (a runtime-built URL, a CMS).
            </p>
          </div>
        ) : (
          <ul className="m-0 flex max-h-60 list-none flex-col overflow-y-auto rounded-lg p-0 shadow-[inset_0_0_0_1px_var(--color-hairline-soft)]">
            {refs.slice(0, 40).map((r, i) => (
              <li
                key={`${r.filePath}:${r.line}:${i}`}
                className="flex h-9 min-w-0 shrink-0 items-center gap-2.5 border-b border-hairline-soft px-3 last:border-b-0 hover:bg-surface-2/50"
              >
                <EditorLink
                  root={root}
                  path={r.filePath}
                  line={r.line}
                  className="min-w-0 flex-1 font-mono text-[12.5px] text-ink-muted"
                >
                  <span className="min-w-0 truncate">
                    {r.filePath}
                    <span className="text-ink-faint">:{r.line}</span>
                  </span>
                </EditorLink>
                <Badge variant="tag">{r.kind}</Badge>
              </li>
            ))}
            {refs.length > 40 && (
              <li className="px-3 py-2 text-[12px] text-ink-faint">+{refs.length - 40} more</li>
            )}
          </ul>
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────── Utils ──────────────────────────────── */

/** CSS-identifier-safe token derived from a path (for @font-face families). */
function slug(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i += 1) h = (h * 31 + path.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
