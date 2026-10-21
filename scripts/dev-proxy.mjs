#!/usr/bin/env node
/**
 * Serve the web build (dist/, from `npx expo export --platform web`) and pass
 * /api/* (and /s2/*, the live streams' gate) on to a Workbench server, so the web build can be tried against any
 * server without that server allowing it by CORS. In the app, enter this
 * proxy's address (http://localhost:8090) as the server.
 *
 *   TARGET=https://workbench.example.com node scripts/dev-proxy.mjs
 *   MOCK=1 node scripts/dev-proxy.mjs          # a made-up server (scripts/mock-api.mjs)
 *
 * PORT (default 8090), DIST (default ./dist). No dependencies.
 * Responses are streamed through as they come (answers are server-sent
 * events); Set-Cookie loses its Domain= so the browser keeps it for the proxy.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8090);
const DIST = path.resolve(process.env.DIST || path.join(here, '..', 'dist'));
const TARGET = process.env.TARGET ? new URL(process.env.TARGET) : null;
const MOCK = process.env.MOCK === '1';

if (!TARGET && !MOCK) {
  console.error('Set TARGET=https://your.workbench.server, or MOCK=1 for a made-up one.');
  process.exit(1);
}
const mock = MOCK ? (await import('./mock-api.mjs')).handle : null;
const mockS2 = MOCK ? (await import('./mock-s2.mjs')).handleS2 : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // SPA fallback
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

function proxy(req, res) {
  const lib = TARGET.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: TARGET.host };
  delete headers.origin;
  delete headers.referer;
  const up = lib.request(
    {
      protocol: TARGET.protocol,
      hostname: TARGET.hostname,
      port: TARGET.port || (TARGET.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers,
    },
    (r) => {
      const out = { ...r.headers };
      if (out['set-cookie']) {
        out['set-cookie'] = out['set-cookie'].map((c) => c.replace(/;\s*Domain=[^;]*/i, ''));
      }
      res.writeHead(r.statusCode || 502, out);
      res.flushHeaders();
      r.on('data', (chunk) => res.write(chunk)); // piece by piece: answers stream
      r.on('end', () => res.end());
    },
  );
  up.on('error', (e) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: `proxy: ${e.message}` }));
  });
  req.pipe(up);
}

http
  .createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      if (mock) mock(req, res);
      else proxy(req, res);
    } else if (req.url.startsWith('/s2/')) {
      // The live streams (the server's s2 gate), as the review site's nginx passes them on.
      if (mockS2) mockS2(req, res);
      else proxy(req, res);
    } else serveStatic(req, res);
  })
  .listen(PORT, () => {
    console.log(`Web build on http://localhost:${PORT} -> ${MOCK ? 'mock API' : TARGET.origin}`);
  });
