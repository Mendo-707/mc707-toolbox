// Builds the app into ONE self-contained file: index.html at the repo root.
//
//   node scripts/build.mjs           build index.html from src/
//   node scripts/build.mjs --check   fail if index.html is out of date with src/ (used in CI)
//
// How: esbuild bundles src/main.js (and everything it imports) into a single script, then the
// stylesheets linked from src/index.html and that script are written inline into a copy of
// src/index.html. The result works from a web server, from the Windows app, as a claude.ai page,
// and when double-clicked, because it needs no other files.
//
// esbuild is found through Node's normal module lookup (node_modules or NODE_PATH).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

let esbuild;
try {
  esbuild = require('esbuild');
} catch (e) {
  console.error('esbuild is not installed. Run: npm install --prefix .ci-tools esbuild@0.28.2');
  console.error('then: NODE_PATH=.ci-tools/node_modules node scripts/build.mjs');
  process.exit(2);
}

const BANNER = '<!-- GENERATED FILE. Do not edit: change the files in src/ and run "npm run build". See AGENTS.md. -->';

export async function build() {
  const js = await esbuild.build({
    entryPoints: [path.join(SRC, 'main.js')],
    bundle: true,
    format: 'iife',
    write: false,
    charset: 'utf8',
    legalComments: 'none',
    target: 'es2020',
    logLevel: 'warning'
  });
  const script = js.outputFiles[0].text;
  if (/<\/script/i.test(script))
    throw new Error('The bundled script contains "</script", which would end the inline tag.');

  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  // inline every local stylesheet: <link rel="stylesheet" href="./styles/x.css">
  html = html.replace(/<link rel="stylesheet" href="\.\/([^"]+)"\s*\/?>/g, (m, href) => {
    const css = fs.readFileSync(path.join(SRC, href), 'utf8');
    return '<style>\n' + css + '</style>';
  });
  // inline the bundled script in place of the module tag
  const tag = '<script type="module" src="./main.js"></script>';
  if (!html.includes(tag)) throw new Error('src/index.html must load the app with: ' + tag);
  html = html.replace(tag, () => '<script>\n' + script + '</script>');
  html = html.replace(/^<!doctype html>\n?/i, m => m.trimEnd() + '\n' + BANNER + '\n');
  return html;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const html = await build();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== html) {
      console.error('index.html is out of date. Run "npm run build" and commit the result.');
      process.exit(1);
    }
    console.log('index.html is up to date.');
  } else {
    fs.writeFileSync(OUT, html);
    console.log('Built index.html (' + Math.round(html.length / 1024) + ' KB)');
  }
}
