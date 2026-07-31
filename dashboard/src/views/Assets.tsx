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
  image: 'var(--t-component)',
  vector: 'var(--t-utility)',
  font: 'var(--t-hook)',
  video: 'var(--t-route)',
  audio: 'var(--t-store)',
  document: 'var(--t-context)',
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
        <div className="atlas-panel atlas-deadclear">
          <FiImage size={26} style={{ color: 'var(--ink-faint)' }} />
          <div>
            <h2 className="atlas-section-title" style={{ marginBottom: 4 }}>No static assets found</h2>
            <p className="atlas-faint">
              Atlas didn’t find any images, vectors, fonts or media in this project. If you added
              some since the last scan, refresh with{' '}
              <span className="mono">atlas serve --reanalyze</span>.
            </p>
          </div>
        </div>
      </>
    );
  }

  const c = report.counts;
  const kpis: Array<{ label: string; n: string | number; hue: string }> = [
    { label: 'Files', n: c.total, hue: 'var(--t-component)' },
    { label: 'Images', n: (c.byKind.image || 0) + (c.byKind.vector || 0), hue: KIND_COLOR.vector },
    { label: 'Fonts', n: c.byKind.font || 0, hue: KIND_COLOR.font },
    { label: 'Media', n: (c.byKind.video || 0) + (c.byKind.audio || 0), hue: KIND_COLOR.video },
    { label: 'On disk', n: formatBytes(c.totalBytes), hue: 'var(--ink-muted)' },
    { label: 'Unreferenced', n: c.unused, hue: 'var(--warn)' },
  ];

  return (
    <>
      <Head bytes={c.totalBytes} count={c.total} />

      <div className="atlas-kpis atlas-kpis--six" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} className="atlas-kpi" style={{ cursor: 'default' }}>
            <div className="atlas-kpi-top">
              <span className="atlas-kpi-dot" style={{ background: k.hue }} />
              <span className="atlas-kpi-label">{k.label}</span>
            </div>
            <div className="atlas-kpi-num">{k.n}</div>
          </div>
        ))}
      </div>

      <section className="atlas-panel atlas-assetpanel">
        <div className="atlas-deadfilters">
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
          <span className="atlas-filter-count">
            <b>{rows.length}</b> / {assets.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="atlas-empty">
            <FiInbox size={24} strokeWidth={1.6} />
            <p>No assets match your filters.</p>
          </div>
        ) : (
          <div className="atlas-assetscroll">
            <div className="atlas-assetgrid">
              {rows.map((a) => (
                <button key={a.id} className="atlas-assetcard" onClick={() => setActive(a)} title={a.path}>
                  <span className="atlas-assetthumb">
                    <Preview asset={a} />
                  </span>
                  <span className="atlas-assetinfo">
                    <span className="mono atlas-assetname atlas-trunc">{a.name}</span>
                    <span className="atlas-assetsub atlas-trunc">
                      {formatBytes(a.size)}
                      {a.dimensions ? ` · ${formatDimensions(a)}` : ''}
                      {a.usageCount ? ` · ${a.usageCount}×` : ''}
                    </span>
                  </span>
                  {!a.usageCount && (
                    <span className="atlas-assetflag" title="Never referenced from code, styles or markup">
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
      <span className="atlas-assetglyph" style={{ color: KIND_COLOR[asset.kind] }}>
        <Icon size={22} strokeWidth={1.6} />
        <span className="mono">{asset.ext}</span>
      </span>
    );
  }

  if (asset.kind === 'font') return <FontPreview asset={asset} sample="Ag" onFail={() => setFailed(true)} />;

  if (asset.kind === 'video') {
    return (
      <video
        className="atlas-assetimg"
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
      className="atlas-assetimg"
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
      <span className="atlas-assetfont" style={{ fontFamily: `"${family}", var(--font-display)` }}>
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
    ['Path', <span className="mono">{asset.path}</span>],
    ['Kind', `${asset.kind} · ${asset.ext}`],
    ['Size', formatBytes(asset.size)],
    ['Dimensions', formatDimensions(asset)],
    ['Modified', asset.modified ? new Date(asset.modified).toLocaleString() : '—'],
    ['Served at', asset.publicUrl ? <span className="mono">{asset.publicUrl}</span> : 'bundled'],
  ];
  if (asset.workspace) meta.push(['Workspace', asset.workspace]);

  return (
    <div className="atlas-lightbox" onClick={onClose} role="presentation">
      <div className="atlas-lightbox-panel" onClick={(e) => e.stopPropagation()}>
        <header className="atlas-lightbox-head">
          <div className="atlas-lightbox-title">
            <Badge withDot style={{ color: KIND_COLOR[asset.kind] }}>{asset.kind}</Badge>
            <span className="mono atlas-trunc">{asset.name}</span>
          </div>
          <div className="atlas-lightbox-actions">
            <EditorLink root={root} path={asset.path}>open in editor</EditorLink>
            <a href={url} target="_blank" rel="noreferrer" className="atlas-editorlink">
              open file
              <FiExternalLink className="atlas-editorlink-glyph" aria-hidden="true" />
            </a>
            <button type="button" className="atlas-lightbox-close" onClick={onClose} aria-label="Close">
              <FiX size={17} />
            </button>
          </div>
        </header>

        <div className="atlas-lightbox-stage">
          {/* Audio has no thumbnail worth showing in the grid, but it plays fine here. */}
          {failed || (!isPreviewable(asset.kind) && asset.kind !== 'audio') ? (
            <div className="atlas-lightbox-fallback">
              <Icon size={34} strokeWidth={1.4} style={{ color: KIND_COLOR[asset.kind] }} />
              <p className="atlas-faint">
                {failed ? (
                  <>
                    <FiAlertCircle size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                    Couldn’t read this file from disk — previews need a local{' '}
                    <span className="mono">atlas serve</span>.
                  </>
                ) : (
                  <>No inline preview for {asset.ext} files — use “open file”.</>
                )}
              </p>
            </div>
          ) : asset.kind === 'font' ? (
            <div className="atlas-lightbox-fontstage">
              <FontPreview asset={asset} sample="AaBbCcDdEe 0123456789" onFail={() => setFailed(true)} />
            </div>
          ) : asset.kind === 'video' ? (
            <video src={url} controls preload="metadata" onError={() => setFailed(true)} />
          ) : asset.kind === 'audio' ? (
            <div className="atlas-lightbox-audio">
              <Icon size={30} strokeWidth={1.4} style={{ color: KIND_COLOR.audio }} />
              <audio src={url} controls preload="metadata" onError={() => setFailed(true)} />
            </div>
          ) : (
            <img src={url} alt={asset.name} onError={() => setFailed(true)} />
          )}
        </div>

        <div className="atlas-lightbox-body">
          <dl className="atlas-lightbox-meta">
            {meta.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="atlas-lightbox-refs">
            <p className="atlas-subhead">
              Referenced in {refs.length ? `(${refs.length})` : ''}
            </p>
            {refs.length === 0 ? (
              <p className="atlas-faint" style={{ fontSize: 12.5, margin: 0 }}>
                No reference found in code, styles or markup — this file may be dead weight, or
                loaded through a path Atlas can’t see (a runtime-built URL, a CMS).
              </p>
            ) : (
              <div className="atlas-usagelist">
                {refs.slice(0, 40).map((r, i) => (
                  <div key={`${r.filePath}:${r.line}:${i}`} className="atlas-usagerow">
                    <EditorLink
                      root={root}
                      path={r.filePath}
                      line={r.line}
                      className="atlas-usagerow-loc mono atlas-trunc"
                    >
                      {r.filePath}
                    </EditorLink>
                    <span className="atlas-usagerow-line mono">:{r.line}</span>
                    <span className="atlas-usagerow-kind">{r.kind}</span>
                  </div>
                ))}
                {refs.length > 40 && (
                  <p className="atlas-usagelist-more atlas-faint">+{refs.length - 40} more</p>
                )}
              </div>
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
    <div className="atlas-pagehead">
      <div className="atlas-pagehead-main">
        <h1 className="atlas-pagehead-title">Assets</h1>
        <p className="atlas-pagehead-sub">
          Static files this project ships — images, vectors, fonts, media and documents. Each
          preview is the real file, read from its path on disk; nothing is copied or bundled.
        </p>
      </div>
      <div className="atlas-pagehead-side">
        <span className="atlas-pill tnum">
          {count} file{count === 1 ? '' : 's'} · {formatBytes(bytes)}
        </span>
      </div>
    </div>
  );
}
