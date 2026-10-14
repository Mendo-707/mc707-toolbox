import { FAC } from '../library/factory.js';
import { DEV, devOn, oneKit } from '../core/device.js';
import { S } from '../core/state.js';
import { CT_POOL, cmFix, patType } from '../clips/clip-map.js';
import { hashStr, mulberry } from '../core/random.js';
import { FACMAP, TRACK_POOLS, facById } from '../library/index.js';
import { LV, lvStyle } from './state.js';
import { lvIsFlash } from './themes.js';
import { lvLoadScenes } from './scene-editor.js';
import { LV_TPL, LV_TPL101, LV_TPL1K } from './scene-templates.js';

/* ---- wide pattern pools: every library pattern of the style's genre, sub-style and tempo ---- */
const LV_POOLCACHE = {};
export function lvGenreOf(st) {
  if (st._genre) return st._genre;
  const c = {};
  Object.values(st.pools)
    .flat()
    .forEach(id => {
      const f = facById(id);
      if (f) c[f.genre] = (c[f.genre] || 0) + 1;
    });
  return (st._genre = Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'dnb');
}
/* ---- Full kits: kick, snare, hats and percussion on ONE drum track (MC-101, or to free Drums 2 and 3 on the MC-707) ---- */
const FULLKITS = {};
export function lvFullPool(st) {
  if (FULLKITS[st.id]) return FULLKITS[st.id];
  const ok = f => f && f.type === 'drum' && f.bars <= 4 && f.notes && f.notes.length;
  const kits = lvPool(st, 'kit').map(facById).filter(ok),
    hats = lvPool(st, 'hats').map(facById).filter(ok),
    perc = lvPool(st, 'perc').map(facById).filter(ok);
  const out = (FULLKITS[st.id] = []);
  if (!kits.length) return out;
  const r = mulberry(hashStr('full:' + st.id)),
    seen = new Set(),
    N = Math.min(28, kits.length * Math.max(1, hats.length)),
    short = x => x.name.split(':').pop().trim();
  for (let i = 0; i < N * 3 && out.length < N; i++) {
    const k = kits[i % kits.length],
      h = hats.length ? hats[Math.floor(r() * hats.length)] : null,
      p = perc.length && r() < 0.45 ? perc[Math.floor(r() * perc.length)] : null;
    const key = k.id + '|' + (h ? h.id : '') + '|' + (p ? p.id : '');
    if (seen.has(key)) continue;
    seen.add(key);
    const parts = [k, h, p].filter(Boolean),
      L = Math.max(...parts.map(x => x.bars));
    if (parts.some(x => L % x.bars)) continue;
    const kitLanes = new Set(k.notes.map(n => n.n)),
      m = new Map();
    parts.forEach((x, pi) => {
      for (let rep = 0; rep < L / x.bars; rep++)
        for (const n of x.notes) {
          if (pi > 0 && kitLanes.has(n.n)) continue;
          const s2 = n.s + rep * x.bars * 16,
            kk = s2 + ':' + n.n;
          if (!m.has(kk)) m.set(kk, { ...n, s: s2 });
        }
    });
    const e = {
      id: 'fk-' + st.id + '-' + out.length,
      name: 'Full Kit: ' + short(k) + (h ? ' + ' + short(h) : '') + (p ? ' + ' + short(p) : ''),
      type: 'drum',
      genre: k.genre,
      bpm: k.bpm,
      bars: L,
      notes: [...m.values()].sort((a, b) => a.s - b.s || a.n - b.n),
      key: null,
      keyName: null,
      role: 'Full kit',
      styles: [st.id],
      pool: 'full',
      lively: !!(k.lively || (h && h.lively))
    };
    FAC.push(e);
    FACMAP.set(e.id, e);
    out.push(e.id);
  }
  return out;
}
export function lvPool(st, pool) {
  if (pool === 'full') return lvFullPool(st);
  const key = st.id + ':' + pool;
  if (LV_POOLCACHE[key]) return LV_POOLCACHE[key];
  const g = lvGenreOf(st),
    bpm = st.bpm[2];
  const hand = [...(st.pools[pool] || []), ...((st.more && st.more[pool]) || [])];
  const lib = FAC.filter(
    f =>
      f.genre === g &&
      f.pool === pool &&
      (!f.styles || f.styles.includes(st.id)) &&
      (f.bpm == null || Math.abs(f.bpm - bpm) <= 24)
  ).map(f => f.id);
  return (LV_POOLCACHE[key] = [...new Set([...hand, ...lib])].filter(id => facById(id)));
}
/* How lively a pattern is (0-1): note density, syncopation, pitch variety; drums: density and ghost notes. */
function lvLively(f) {
  if (!f) return 0;
  if (f._lv !== undefined) return f._lv;
  const n = f.notes.length,
    bars = Math.max(1, f.bars);
  let sc;
  if (f.type === 'tone') {
    const pit = new Set(f.notes.map(x => x.n)).size,
      syn = n ? f.notes.filter(x => x.s % 4 !== 0).length / n : 0;
    sc = Math.min(1, n / bars / 12) * 0.4 + Math.min(1, pit / 8) * 0.3 + syn * 0.3;
    if (f.role === 'Pad') sc *= 0.5;
  } else {
    const gh = n ? f.notes.filter(x => x.v < 64).length / n : 0,
      nk = f.notes.filter(x => x.n !== 0).length;
    sc = Math.min(1, nk / bars / 24) * 0.65 + Math.min(1, gh * 3) * 0.35;
  }
  if (f.lively) sc = Math.min(1, sc + 0.3);
  return (f._lv = sc);
}
export function lvFlavor(ids, flavor) {
  if (flavor !== 'lively' && flavor !== 'classic') return ids;
  const s = ids
    .map(id => [id, lvLively(facById(id))])
    .sort((a, b) => (flavor === 'lively' ? b[1] - a[1] : a[1] - b[1]));
  return s.slice(0, Math.max(4, Math.ceil(ids.length * (flavor === 'lively' ? 0.45 : 0.6)))).map(x => x[0]);
}
/* chord progression named in a pattern (bass, chords, pads and arps built on the same one sit together) */
export const lvProg = f => {
  if (!f) return null;
  if (f._prog !== undefined) return f._prog;
  const m = /((?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3,}b?[ivIV]{1,3}[A-Za-z0-9]*)/.exec(f.name);
  return (f._prog = m ? m[1] : null);
};
export const lvModeFam = sc => (/major|mixolydian|lydian/.test(sc || '') ? 'major' : 'minor');
export function liveBuild() {
  const st = lvStyle();
  LV.style = st.id;
  if (!LV.mode) LV.mode = lvModeFam(st.scale);
  LV.fillIds = lvPool(st, 'fill');
  if (LV.custom && lvLoadScenes()) {
    if (LV.cur >= LV.scenes.length || lvIsFlash(LV.scenes[LV.cur])) LV.cur = 0;
    LV.ver++;
    return;
  }
  LV.custom = false;
  const r = mulberry(LV.seed ^ 0x5bd1e995),
    P = {},
    A = {},
    at = {};
  const shuf = a => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const take = (pool, pred) => {
    if (!P[pool]) {
      A[pool] = shuf(lvPool(st, pool));
      P[pool] = shuf(lvFlavor(A[pool], LV.flavor));
    }
    for (const arr of pred ? [P[pool], A[pool]] : [P[pool]]) {
      if (!arr.length) continue;
      at[pool] = at[pool] || 0;
      for (let k = 0; k < arr.length; k++) {
        const id = arr[(at[pool] + k) % arr.length];
        if (!pred || pred(facById(id))) {
          at[pool] = (at[pool] + k + 1) % arr.length;
          return id;
        }
      }
    }
    return null;
  };
  /* two matching sets of parts: bass, pad and pluck follow the chords' progression */
  const bassKeys = new Set(
    lvPool(st, 'bass')
      .map(facById)
      .filter(f => f && lvProg(f))
      .map(f => lvProg(f) + '|' + f.bars)
  );
  const mkSet = () => {
    const o = {};
    o[4] = take('chords', f => lvProg(f) && bassKeys.has(lvProg(f) + '|' + f.bars)) || take('chords');
    const cf = facById(o[4]),
      prog = cf && lvProg(cf),
      pb = cf && cf.bars;
    const fit = p => (prog && take(p, f => lvProg(f) === prog && f.bars === pb)) || take(p, f => !lvProg(f)) || take(p);
    o[3] = fit('bass');
    o[5] = fit('pad');
    o[7] = fit('pluck');
    o[6] = take('lead');
    o[0] = take('kit');
    o[1] = take('hats');
    o[2] = take('perc');
    if (oneKit()) {
      o[0] = take('full') || o[0];
      o[1] = o[2] = null;
    }
    if (DEV === '101') o[5] = o[7] = null;
    return o;
  };
  const sets = { A: mkSet(), B: mkSet() },
    scenes = [];
  const MOVE = ['h2', 'alt', 'rest', 'odd'];
  for (const [name, kind, bars, e, fx, parts] of DEV === '101' ? LV_TPL101 : oneKit() ? LV_TPL1K : LV_TPL) {
    const cells = {};
    for (const t in parts) {
      const [set, play0] = parts[t].split(':');
      let id,
        pool = TRACK_POOLS[t];
      if (set === 'R') {
        id = take('build', f => f.bars === bars) || take('build');
        pool = 'build';
      }
      if (+t === 0 && oneKit() && set !== 'R') pool = 'full';
      if (!id) id = sets[set === 'R' ? 'A' : set][t];
      if (!id || !facById(id)) continue;
      let play = play0;
      if (+t >= 3 && r() < 0.25) play = play ? (r() < 0.5 ? null : play) : MOVE[Math.floor(r() * MOVE.length)];
      cells[t] = { id, pool };
      if (play) cells[t].play = play;
    }
    if (!Object.keys(cells).length)
      [0, 1, 3].forEach(t => {
        if (sets.A[t]) cells[t] = { id: sets.A[t], pool: TRACK_POOLS[t] };
      });
    const sc = { kind, name, bars, e, cells };
    if (fx) sc.fx = fx;
    scenes.push(sc);
  }
  if (S.clipAuto) {
    /* a track with clips of another kind (e.g. a lead sound on the Chords track) switches to it in the B scenes, then back */
    for (const t of [3, 4, 5, 6, 7]) {
      if (!devOn(t)) continue;
      const mm = cmFix()[t],
        own = patType({ pool: TRACK_POOLS[t] });
      const alt = mm.types.slice(0, mm.n).find(ty => CT_POOL[ty] && ty !== own);
      if (!alt) continue;
      scenes.forEach(sc => {
        if (/ B$/.test(sc.name) && sc.cells[t]) {
          const id = take(CT_POOL[alt]);
          if (id) sc.cells[t] = { id, pool: CT_POOL[alt], play: sc.cells[t].play };
        }
      });
    }
  }
  LV.scenes = scenes;
  LV.fillIds = lvPool(st, 'fill');
  if (LV.cur >= scenes.length) LV.cur = 0;
  LV.ver++;
}
export function liveSwapIds(t) {
  const st = lvStyle(),
    pool = t === 0 && oneKit() ? 'full' : TRACK_POOLS[t];
  return lvFlavor(lvPool(st, pool), LV.flavor).filter(id => {
    const f = facById(id);
    return f && (t < 3 ? f.type === 'drum' : f.type === 'tone');
  });
}
