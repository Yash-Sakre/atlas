/** Minimal dependency-free static server for the dashboard bundle.
 *  Serves the built assets and exposes the analysis JSON at `/data.json`,
 *  with an SPA fallback to index.html for client-side (hash) routing. */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
  // Static assets served from the scanned project (see FILE_PREFIX below).
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.pdf': 'application/pdf',
};

/** Route prefix under which original project files are streamed from disk. */
export const FILE_PREFIX = '/__file/';

export interface ServeOptions {
  distDir: string;
  /** Returns the current analysis payload as a JSON string. */
  getData: () => string;
  port: number;
  host?: string;
  /** Absolute root of the scanned project — the base for `/__file/` requests. */
  projectRoot?: string;
  /**
   * Root-relative paths that `/__file/` may serve. Only files Atlas actually
   * discovered are readable; anything else in the project stays private.
   */
  servableFiles?: Iterable<string>;
}

export interface RunningServer {
  url: string;
  port: number;
  close: () => void;
}

export function startServer(opts: ServeOptions): Promise<RunningServer> {
  const host = opts.host ?? '127.0.0.1';
  const distDir = path.resolve(opts.distDir);
  const projectRoot = opts.projectRoot ? path.resolve(opts.projectRoot) : undefined;
  const servable = opts.servableFiles ? new Set(opts.servableFiles) : undefined;

  /**
   * Stream one file of the scanned project. Three gates, all required: the
   * server must know a project root, the path must be one Atlas discovered,
   * and it must still resolve inside the root after normalization.
   */
  function serveProjectFile(relPath: string, res: http.ServerResponse): void {
    const clean = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!projectRoot || !clean || (servable && !servable.has(clean))) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const abs = path.resolve(projectRoot, path.normalize(clean));
    if (!abs.startsWith(projectRoot + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let size: number;
    try {
      const stat = fs.statSync(abs);
      if (!stat.isFile()) throw new Error('not a file');
      size = stat.size;
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'content-length': size,
      // The file lives outside the bundle and can change under us — never cache.
      'cache-control': 'no-cache',
    });
    const stream = fs.createReadStream(abs);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  const server = http.createServer((req, res) => {
    // Malformed percent-escapes (e.g. `/%`) make decodeURIComponent throw;
    // reject those instead of letting the exception crash the server.
    let url: string;
    try {
      url = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    if (url === '/data.json') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(opts.getData());
      return;
    }

    // Original project files (images, fonts, media) streamed straight from
    // their path on disk — nothing is ever copied into the dashboard bundle.
    if (url.startsWith(FILE_PREFIX)) {
      serveProjectFile(url.slice(FILE_PREFIX.length), res);
      return;
    }

    const rel = url === '/' ? '/index.html' : url;
    let filePath = path.join(distDir, path.normalize(rel));

    // Guard against path traversal: the resolved path must be distDir itself or
    // sit beneath it (a bare `startsWith` would also accept `<distDir>-evil`).
    if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    // SPA fallback: unknown paths serve index.html.
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    fs.readFile(filePath, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(buf);
    });
  });

  return new Promise((resolve, reject) => {
    let attemptedFallback = false;
    server.on('error', (err: NodeJS.ErrnoException) => {
      // Preferred port busy → let the OS pick a free one.
      if (err.code === 'EADDRINUSE' && !attemptedFallback) {
        attemptedFallback = true;
        server.listen(0, host);
      } else {
        reject(err);
      }
    });
    server.listen(opts.port, host, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : opts.port;
      resolve({ url: `http://localhost:${port}`, port, close: () => server.close() });
    });
  });
}

/** Best-effort open the URL in the default browser. */
export function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { spawn } = require('child_process') as typeof import('child_process');
    const child = spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: platform === 'win32' });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* ignore — the user still has the printed link */
  }
}
