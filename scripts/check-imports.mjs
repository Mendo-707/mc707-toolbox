// Checks how the modules in src/ import each other.
//
//   node scripts/check-imports.mjs            report cycles and imports that break the layer rules
//   node scripts/check-imports.mjs --strict   also exit with an error if there are any (used in CI)
//
// The layers, lowest first (see docs/ARCHITECTURE.md). A module may import from its own layer
// or any layer below it, never from a layer above:
//   core      plain helpers and state with no knowledge of any feature
//   library   the factory pattern library
//   services  MIDI, transport, sound, audio inputs, and the generic UI pieces (menus, dialogs)
//   clips     the MC-707 clips screen and clip chips, used by both Song and Live
//   features  song/ and live/
//   app       the shell that ties features together (menu bar, right-click menus, projects, main.js)
// Song and Live never import each other directly; anything they share lives lower down,
// and the app layer wires them together through core/hooks.js.
// Import cycles between folders fail the check. Modules inside one feature folder (live/, song/,
// ui/) may call each other; those cycles are listed for information only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const strict = process.argv.includes('--strict');

export const LAYERS = { core: 0, library: 1, services: 2, clips: 3, features: 4, app: 5 };
export function layerOf(rel) {
  if (rel === 'main.js') return 'app';
  const dir = rel.split('/')[0];
  if (dir === 'core') return 'core';
  if (dir === 'library') return 'library';
  if (dir === 'services') return 'services';
  if (dir === 'clips') return 'clips';
  if (dir === 'song' || dir === 'live') return 'features';
  if (dir === 'ui') return ['ui/dialogs.js', 'ui/menu.js', 'ui/fullscreen.js'].includes(rel) ? 'services' : 'app';
  return 'app';
}

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

export function graph() {
  const g = {};
  for (const f of walk(ROOT)) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const src = fs.readFileSync(f, 'utf8');
    const deps = new Set();
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s*'([^']+)'/gms)) {
      if (!m[1].startsWith('.')) continue;
      deps.add(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
    for (const m of src.matchAll(/^\s*import\s*'([^']+\.js)'/gm))
      deps.add(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    g[rel] = [...deps];
  }
  return g;
}

// Tarjan's strongly connected components: every group of more than one module is a cycle.
export function cycles(g) {
  let i = 0;
  const idx = {},
    low = {},
    on = new Set(),
    st = [],
    out = [];
  const visit = v => {
    idx[v] = low[v] = i++;
    st.push(v);
    on.add(v);
    for (const w of g[v] || []) {
      if (!(w in g)) continue;
      if (!(w in idx)) {
        visit(w);
        low[v] = Math.min(low[v], low[w]);
      } else if (on.has(w)) low[v] = Math.min(low[v], idx[w]);
    }
    if (low[v] === idx[v]) {
      const c = [];
      let w;
      do {
        w = st.pop();
        on.delete(w);
        c.push(w);
      } while (w !== v);
      if (c.length > 1) out.push(c.sort());
    }
  };
  for (const v of Object.keys(g)) if (!(v in idx)) visit(v);
  return out;
}

export function violations(g) {
  const bad = [];
  for (const [a, ds] of Object.entries(g))
    for (const b of ds) {
      const la = LAYERS[layerOf(a)],
        lb = LAYERS[layerOf(b)];
      const da = a.split('/')[0],
        db = b.split('/')[0];
      if (lb > la) bad.push([a, b, 'imports from a higher layer']);
      else if ((da === 'song' && db === 'live') || (da === 'live' && db === 'song'))
        bad.push([a, b, 'song and live import each other']);
    }
  return bad;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const g = graph();
  const cs = cycles(g),
    vs = violations(g);
  const across = cs.filter(c => new Set(c.map(f => f.split('/')[0])).size > 1);
  const inside = cs.filter(c => !across.includes(c));
  console.log(
    Object.keys(g).length + ' modules, ' + across.length + ' cycles between folders, ' + vs.length + ' layer problems'
  );
  across.forEach(c => console.log('  cycle between folders (' + c.length + ' modules): ' + c.join(', ')));
  vs.forEach(([a, b, why]) => console.log('  ' + a + ' -> ' + b + ': ' + why));
  if (inside.length)
    console.log(
      'For information: ' +
        inside.length +
        ' cycles inside one folder (' +
        inside.map(c => c[0].split('/')[0] + '/ ' + c.length + ' modules').join(', ') +
        ')'
    );
  if (strict && (across.length || vs.length)) process.exit(1);
}
