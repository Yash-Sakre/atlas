/**
 * Discovers the static (non-code) files a frontend ships — images, vectors,
 * fonts, media clips and documents — and works out where each one is referenced.
 *
 * Nothing is copied, inlined or transcoded: an asset is recorded as a path
 * relative to the project root, and the dashboard streams the original file
 * from that path through `atlas serve`. Intrinsic image dimensions are read
 * straight from the file header (a few KB), never by decoding the image.
 *
 * References are found by collecting the string literals of every scanned
 * source file plus the `url(...)`/attribute values of the project's stylesheets
 * and markup, then matching them back to a discovered file. That catches
 * bundler imports (`import logo from './logo.svg'`), plain `public/` URLs
 * ("/logo.svg") and CSS `url()`s alike — the three ways a frontend actually
 * reaches for a static file.
 */
import { closeSync, openSync, readFileSync, readSync, statSync } from 'fs';
import { join } from 'path';
import fg from 'fast-glob';
import type {
  ExtractionContext,
  ResolvedConfig,
  StaticAsset,
  StaticAssetKind,
  StaticAssetReport,
  UsageReference,
} from '../core/types';

/** Extension → category. Also defines *which* files count as static assets. */
const KIND_BY_EXT: Record<string, StaticAssetKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  avif: 'image', bmp: 'image', ico: 'image', tif: 'image', tiff: 'image',
  svg: 'vector',
  woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
  mp4: 'video', webm: 'video', mov: 'video', ogv: 'video', m4v: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio',
  pdf: 'document',
};

const KIND_ORDER: StaticAssetKind[] = ['image', 'vector', 'font', 'video', 'audio', 'document'];

/**
 * Non-source files that can still reference an asset (styles, markup, MDX
 * pages). Plain `.md` is left out: a README or audit note mentioning a file
 * doesn't ship it, and counting it would hide genuinely unreferenced assets.
 */
const REFERENCING_GLOB = '**/*.{css,scss,sass,less,styl,html,htm,vue,svelte,astro,mdx,webmanifest}';

/** Directories that are never part of a project's own asset set. */
const ALWAYS_IGNORE = ['**/node_modules/**', '**/.git/**'];

/** Cap per referencing file — a stray minified bundle shouldn't dominate the scan. */
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

/** Quoted string literals: import specifiers, JSX props, HTML attributes. */
const QUOTED_RE = /["'`]([^"'`\n\r]{2,300})["'`]/g;
/** CSS `url(...)`, including the unquoted form. */
const URL_RE = /url\(\s*["']?([^"')\n\r]{2,300})/g;

export function analyzeStaticAssets(ctx: ExtractionContext, config: ResolvedConfig): StaticAssetReport {
  const files = fg.sync(`**/*.{${Object.keys(KIND_BY_EXT).join(',')}}`, {
    cwd: config.root,
    ignore: [...config.exclude, ...ALWAYS_IGNORE],
    absolute: false,
    dot: false,
    caseSensitiveMatch: false,
    suppressErrors: true,
  });

  const assets: StaticAsset[] = [];
  for (const path of files) {
    const abs = join(config.root, path);
    let size = 0;
    let modified = '';
    try {
      const st = statSync(abs);
      if (!st.isFile()) continue;
      size = st.size;
      modified = st.mtime.toISOString();
    } catch {
      continue; // vanished between glob and stat
    }

    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    const kind = KIND_BY_EXT[ext];
    if (!kind) continue;
    const name = path.slice(path.lastIndexOf('/') + 1);
    const publicUrl = publicUrlOf(path);

    assets.push({
      id: path,
      name,
      path,
      ext,
      kind,
      size,
      modified,
      dimensions: kind === 'image' || kind === 'vector' ? readDimensions(abs, ext) : undefined,
      isPublic: publicUrl !== undefined,
      publicUrl,
      usedIn: [],
      usageCount: 0,
      workspace: ctx.workspaceOf(path),
    });
  }

  if (assets.length) attachReferences(assets, ctx, config);

  assets.sort((a, b) => a.path.localeCompare(b.path));

  const byKind = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<StaticAssetKind, number>;
  let totalBytes = 0;
  let unused = 0;
  for (const a of assets) {
    byKind[a.kind] += 1;
    totalBytes += a.size;
    if (a.usageCount === 0) unused += 1;
  }

  return { assets, counts: { total: assets.length, unused, totalBytes, byKind } };
}

/* ----------------------------- Public folders ---------------------------- */

/**
 * The URL a file is served at when it sits in a framework's static folder
 * (`public/` for Next/Vite/CRA, `static/` for SvelteKit/Nuxt). Returns
 * undefined for bundler-processed assets, which have no stable public URL.
 */
function publicUrlOf(path: string): string | undefined {
  const segments = path.split('/');
  const idx = segments.findIndex((s) => s === 'public' || s === 'static');
  if (idx === -1) return undefined;
  // Only a *root* static dir counts: `public/x.png` or `apps/web/public/x.png`,
  // never `src/components/public/x.png`.
  if (segments.slice(0, idx).some((s) => s === 'src' || s === 'app' || s === 'lib')) return undefined;
  return `/${segments.slice(idx + 1).join('/')}`;
}

/* ------------------------------- References ------------------------------ */

/**
 * Attach every reference to its asset. Tokens are matched by file name, then
 * disambiguated by path suffix when several assets share one (`icon.svg` in
 * three folders) — a token that names no unique file is credited to each
 * candidate rather than dropped, since a miss would read as "unused".
 */
function attachReferences(assets: StaticAsset[], ctx: ExtractionContext, config: ResolvedConfig): void {
  const byName = new Map<string, StaticAsset[]>();
  for (const a of assets) {
    const list = byName.get(a.name) ?? [];
    list.push(a);
    byName.set(a.name, list);
  }

  // Dedupe refs per (asset, file, line) — the same import is often re-read.
  const seen = new Set<string>();
  const record = (asset: StaticAsset, ref: UsageReference) => {
    const key = `${asset.path}|${ref.filePath}|${ref.line}`;
    if (seen.has(key)) return;
    seen.add(key);
    asset.usedIn.push(ref);
  };

  const scan = (filePath: string, text: string) => {
    if (!text) return;
    const lines = lineStarts(text);
    for (const re of [QUOTED_RE, URL_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const token = m[1];
        // Cheap reject: every asset name has a dot, most literals don't match one.
        const base = tokenBaseName(token);
        if (!base) continue;
        const candidates = byName.get(base);
        if (!candidates) continue;
        const matched = disambiguate(candidates, token);
        const line = lineOf(lines, m.index);
        const kind = isImportContext(text, m.index) ? 'import' : 'reference';
        for (const a of matched) record(a, { filePath, line, kind });
      }
    }
  };

  for (const file of ctx.sourceFiles) {
    scan(relative(config.root, file.getFilePath()), file.getFullText());
  }

  const textFiles = fg.sync(REFERENCING_GLOB, {
    cwd: config.root,
    ignore: [...config.exclude, ...ALWAYS_IGNORE],
    absolute: false,
    dot: false,
    suppressErrors: true,
  });
  for (const path of textFiles) {
    try {
      const abs = join(config.root, path);
      if (statSync(abs).size > MAX_TEXT_BYTES) continue;
      scan(path, readFileSync(abs, 'utf8'));
    } catch {
      /* unreadable → skip */
    }
  }

  for (const a of assets) {
    a.usedIn.sort((x, y) => x.filePath.localeCompare(y.filePath) || x.line - y.line);
    a.usageCount = a.usedIn.length;
  }
}

/** The file-name part of a reference token, or undefined if it can't be one. */
function tokenBaseName(token: string): string | undefined {
  // Drop Vite/webpack query suffixes and SVG fragment ids: "logo.svg?url#icon".
  const clean = token.split(/[?#]/)[0].replace(/\\/g, '/');
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  return base.includes('.') ? base : undefined;
}

/**
 * Narrow same-named candidates by how much of the token's path they match.
 *
 * The longest matching suffix wins, dropping one leading segment at a time.
 * That's what makes an aliased import resolve: `@/icons/a.svg` doesn't match any
 * real path, but `icons/a.svg` matches `src/icons/a.svg` — without the walk, an
 * alias would credit every same-named file. A token that only carries the file
 * name stays ambiguous and is credited to all of them, since guessing one would
 * mark the others falsely unreferenced.
 */
function disambiguate(candidates: StaticAsset[], token: string): StaticAsset[] {
  if (candidates.length === 1) return candidates;
  const parts = token
    .split(/[?#]/)[0]
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..');

  for (let i = 0; i < parts.length - 1; i += 1) {
    const tail = parts.slice(i).join('/');
    const exact = candidates.filter((a) => a.path === tail || a.path.endsWith(`/${tail}`));
    if (exact.length) return exact;
  }
  return candidates;
}

/** Whether the literal at `index` is the specifier of an import/require. */
function isImportContext(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index);
  return /\b(?:from|import|require)\s*\(?\s*$/.test(before);
}

/* --------------------------------- Lines --------------------------------- */

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

/** 1-based line number for a character offset (binary search over line starts). */
function lineOf(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function relative(root: string, abs: string): string {
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const a = abs.replace(/\\/g, '/');
  return a.startsWith(r + '/') ? a.slice(r.length + 1) : a;
}

/* ------------------------------ Dimensions ------------------------------- */

/**
 * Intrinsic pixel size, read from the file header only (no decoding). Formats
 * that don't carry one in a fixed-offset header simply return undefined —
 * a missing size is displayed as "—", never guessed.
 */
function readDimensions(abs: string, ext: string): { width: number; height: number } | undefined {
  try {
    if (ext === 'svg') return svgSize(readHead(abs, 4096).toString('utf8'));
    // JPEG stores its size behind a marker chain, so it needs a bigger window.
    const head = readHead(abs, ext === 'jpg' || ext === 'jpeg' ? 65536 : 64);
    switch (ext) {
      case 'png': return pngSize(head);
      case 'gif': return gifSize(head);
      case 'webp': return webpSize(head);
      case 'jpg':
      case 'jpeg': return jpegSize(head);
      default: return undefined;
    }
  } catch {
    return undefined;
  }
}

function readHead(abs: string, bytes: number): Buffer {
  const fd = openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

function pngSize(b: Buffer) {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return undefined;
  if (b.toString('ascii', 12, 16) !== 'IHDR') return undefined;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function gifSize(b: Buffer) {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'GIF') return undefined;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function webpSize(b: Buffer) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined;
  }
  const format = b.toString('ascii', 12, 16);
  if (format === 'VP8X') {
    return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  if (format === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (format === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

function jpegSize(b: Buffer) {
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return undefined;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    // SOF0–SOF15 carry the frame size; SOF4/8/12 are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    const segment = b.readUInt16BE(i + 2);
    if (segment < 2) return undefined;
    i += 2 + segment;
  }
  return undefined;
}

/** SVG size from explicit width/height attributes, falling back to the viewBox. */
function svgSize(text: string) {
  const svg = text.slice(text.indexOf('<svg'));
  const attr = (name: string): number | undefined => {
    const m = new RegExp(`\\b${name}\\s*=\\s*["']\\s*([\\d.]+)`, 'i').exec(svg);
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  };
  const width = attr('width');
  const height = attr('height');
  if (width && height) return { width, height };

  const vb = /\bviewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
  if (!vb) return undefined;
  const w = Math.round(Number(vb[3]));
  const h = Math.round(Number(vb[4]));
  return w > 0 && h > 0 ? { width: w, height: h } : undefined;
}
