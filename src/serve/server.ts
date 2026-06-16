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
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

export interface ServeOptions {
  distDir: string;
  /** Returns the current analysis payload as a JSON string. */
  getData: () => string;
  port: number;
  host?: string;
}

export interface RunningServer {
  url: string;
  port: number;
  close: () => void;
}

export function startServer(opts: ServeOptions): Promise<RunningServer> {
  const host = opts.host ?? '127.0.0.1';
  const distDir = path.resolve(opts.distDir);

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);

    if (url === '/data.json') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(opts.getData());
      return;
    }

    const rel = url === '/' ? '/index.html' : url;
    let filePath = path.join(distDir, path.normalize(rel));

    // Guard against path traversal.
    if (!filePath.startsWith(distDir)) {
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
