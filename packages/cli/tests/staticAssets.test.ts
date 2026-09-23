import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadConfig } from '../src/core/config';
import { loadProject } from '../src/core/project';
import { analyzeStaticAssets } from '../src/analysis/staticAssets';
import type { StaticAsset, StaticAssetReport } from '../src/core/types';

/* ------------------------- synthetic asset files -------------------------- */

/** Minimal PNG: signature + an IHDR chunk carrying the size. */
function png(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

/** GIF89a header (width/height are little-endian at offsets 6 and 8). */
function gif(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

/** JPEG with one filler segment before the SOF0 frame header. */
function jpeg(width: number, height: number): Buffer {
  const filler = Buffer.alloc(20);
  filler.writeUInt16BE(0xffe0, 0); // APP0
  filler.writeUInt16BE(18, 2); // segment length (excludes the marker)
  const sof = Buffer.alloc(11);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof.writeUInt8(8, 4);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), filler, sof]);
}

/** Lossless WebP: 14 bits of (width-1) then 14 bits of (height-1) from byte 21. */
function webp(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0, 'ascii');
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8L', 12, 'ascii');
  buf.writeUInt8(0x2f, 20);
  buf.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return buf;
}

describe('analyzeStaticAssets', () => {
  let root: string;
  let report: StaticAssetReport;
  let byPath: Map<string, StaticAsset>;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'atlas-assets-'));
    const write = (rel: string, data: string | Buffer) => {
      const abs = join(root, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, data);
    };

    write('package.json', JSON.stringify({ name: 'fixture', dependencies: { react: '^19.0.0' } }));

    // Bundler-processed asset, imported from code.
    write('src/assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"></svg>');
    // public/ assets: one referenced by URL from JSX, one only from CSS.
    write('public/hero.png', png(1440, 900));
    write('public/bg.gif', gif(120, 60));
    // Never referenced anywhere.
    write('public/fonts/Inter.woff2', Buffer.from('wOF2 not-a-real-font'));
    write('src/assets/photo.jpg', jpeg(800, 600));
    write('src/assets/tile.webp', webp(64, 32));
    // Ignored: build output must never be reported as a project asset.
    write('dist/hero.png', png(10, 10));
    write('node_modules/pkg/icon.svg', '<svg viewBox="0 0 1 1"></svg>');

    write(
      'src/App.tsx',
      `import logo from './assets/logo.svg';
import photo from './assets/photo.jpg';

export default function App() {
  return (
    <div>
      <img src={logo} alt="" />
      <img src={photo} alt="" />
      <img src="/hero.png" alt="" />
    </div>
  );
}
`,
    );
    write('src/styles.css', `body { background: url(/bg.gif) no-repeat; }`);

    const config = loadConfig(root, { noCache: true });
    const { ctx } = loadProject(config);
    report = analyzeStaticAssets(ctx, config);
    byPath = new Map(report.assets.map((a) => [a.path, a]));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('finds every static file and ignores build output and node_modules', () => {
    expect([...byPath.keys()].sort()).toEqual([
      'public/bg.gif',
      'public/fonts/Inter.woff2',
      'public/hero.png',
      'src/assets/logo.svg',
      'src/assets/photo.jpg',
      'src/assets/tile.webp',
    ]);
    expect(report.counts.total).toBe(6);
  });

  it('categorizes by extension', () => {
    expect(byPath.get('public/hero.png')!.kind).toBe('image');
    expect(byPath.get('src/assets/logo.svg')!.kind).toBe('vector');
    expect(byPath.get('public/fonts/Inter.woff2')!.kind).toBe('font');
    expect(report.counts.byKind.image).toBe(4); // png, gif, jpg, webp
    expect(report.counts.byKind.vector).toBe(1);
    expect(report.counts.byKind.font).toBe(1);
  });

  it('reads intrinsic dimensions from file headers', () => {
    expect(byPath.get('public/hero.png')!.dimensions).toEqual({ width: 1440, height: 900 });
    expect(byPath.get('public/bg.gif')!.dimensions).toEqual({ width: 120, height: 60 });
    expect(byPath.get('src/assets/photo.jpg')!.dimensions).toEqual({ width: 800, height: 600 });
    expect(byPath.get('src/assets/tile.webp')!.dimensions).toEqual({ width: 64, height: 32 });
    // SVG has no width/height attributes — the viewBox supplies the size.
    expect(byPath.get('src/assets/logo.svg')!.dimensions).toEqual({ width: 48, height: 24 });
  });

  it('records size and mtime without reading the whole file', () => {
    const hero = byPath.get('public/hero.png')!;
    expect(hero.size).toBe(24);
    expect(Number.isNaN(Date.parse(hero.modified))).toBe(false);
  });

  it('marks public/ files with the URL they are served at', () => {
    expect(byPath.get('public/hero.png')!.isPublic).toBe(true);
    expect(byPath.get('public/hero.png')!.publicUrl).toBe('/hero.png');
    expect(byPath.get('public/fonts/Inter.woff2')!.publicUrl).toBe('/fonts/Inter.woff2');
    // Bundled assets have no stable public URL.
    expect(byPath.get('src/assets/logo.svg')!.isPublic).toBe(false);
    expect(byPath.get('src/assets/logo.svg')!.publicUrl).toBeUndefined();
  });

  it('finds references from imports, JSX urls and stylesheets', () => {
    const logo = byPath.get('src/assets/logo.svg')!;
    expect(logo.usageCount).toBe(1);
    expect(logo.usedIn[0]).toMatchObject({ filePath: 'src/App.tsx', line: 1, kind: 'import' });

    // A plain "/hero.png" string is a reference, not an import.
    const hero = byPath.get('public/hero.png')!;
    expect(hero.usedIn).toEqual([{ filePath: 'src/App.tsx', line: 9, kind: 'reference' }]);

    // CSS url() counts too.
    expect(byPath.get('public/bg.gif')!.usedIn).toEqual([
      { filePath: 'src/styles.css', line: 1, kind: 'reference' },
    ]);
  });

  it('flags files nothing references', () => {
    expect(byPath.get('public/fonts/Inter.woff2')!.usageCount).toBe(0);
    expect(byPath.get('src/assets/tile.webp')!.usageCount).toBe(0);
    expect(report.counts.unused).toBe(2);
  });

  it('totals the bytes on disk', () => {
    const sum = report.assets.reduce((n, a) => n + a.size, 0);
    expect(report.counts.totalBytes).toBe(sum);
  });
});

/**
 * Two files of the same name in different folders — the common case in real
 * projects, where a `public/` copy shadows a bundled one. Crediting a reference
 * to the wrong copy marks the other falsely unreferenced, so the token's path
 * has to decide, including when it starts with a build alias.
 */
describe('analyzeStaticAssets — same-named files', () => {
  let root: string;
  let filesOf: (path: string) => string[];

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'atlas-assets-dup-'));
    const write = (rel: string, data: string) => {
      const abs = join(root, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, data);
    };
    const svg = '<svg viewBox="0 0 16 16"></svg>';

    write('package.json', JSON.stringify({ name: 'dup-fixture' }));
    write('jsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }));
    write('src/asseticons/logo.svg', svg);
    write('public/AlertIcons/logo.svg', svg);

    write('src/Aliased.tsx', `import logo from '@/asseticons/logo.svg';\nexport const A = () => <img src={logo} />;\n`);
    write('src/PublicUrl.tsx', `export const B = () => <img src="/AlertIcons/logo.svg" />;\n`);
    write('src/BareName.tsx', `export const NAME = 'logo.svg';\n`);

    const config = loadConfig(root, { noCache: true });
    const { ctx } = loadProject(config);
    const assets = analyzeStaticAssets(ctx, config).assets;
    const byPath = new Map(assets.map((a) => [a.path, a]));
    filesOf = (path) => (byPath.get(path)?.usedIn ?? []).map((r) => r.filePath).sort();
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('resolves an alias-prefixed import to the file it actually points at', () => {
    expect(filesOf('src/asseticons/logo.svg')).toContain('src/Aliased.tsx');
    expect(filesOf('public/AlertIcons/logo.svg')).not.toContain('src/Aliased.tsx');
  });

  it('resolves a public URL to the public copy', () => {
    expect(filesOf('public/AlertIcons/logo.svg')).toContain('src/PublicUrl.tsx');
    expect(filesOf('src/asseticons/logo.svg')).not.toContain('src/PublicUrl.tsx');
  });

  it('credits a bare file name to every candidate rather than guessing', () => {
    expect(filesOf('src/asseticons/logo.svg')).toContain('src/BareName.tsx');
    expect(filesOf('public/AlertIcons/logo.svg')).toContain('src/BareName.tsx');
  });
});
