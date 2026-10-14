// Development server: serves src/ as it is, so the browser loads the ES modules directly.
// Edit a file in src/ and reload the page; there is no build step while developing.
//
//   node scripts/dev.mjs            then open http://localhost:8707
//
// Use Chrome or Edge (Web MIDI). Run "npm run build" before committing, so index.html matches src/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const PORT = Number(process.env.PORT) || 8707;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(SRC, url === '/' ? 'index.html' : url);
    if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log('MC-707 Toolbox (source) at http://localhost:' + PORT));
