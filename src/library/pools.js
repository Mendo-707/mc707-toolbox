import { FAC } from './factory.js';
import { FACMAP, facById } from './index.js';
import { hashStr, mulberry } from '../core/random.js';

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
