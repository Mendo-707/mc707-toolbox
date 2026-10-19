// Which patterns suit a style: pools by genre, sub-style and tempo, full kits for one drum track,
// and the Lively / Classic flavour filter. Used by Live Mode and the song wizard.
//
// Reads: FAC.
import { FAC } from './factory.js';
import { FACMAP, facById } from './index.js';
import { hashStr, mulberry } from '../core/random.js';
import { addHarmonyPack } from './harmony-pack.js';
import { addMelodicPack } from './melodic-pack.js';

/* ---- wide pattern pools: every library pattern of the style's genre, sub-style and tempo ---- */
const TONE_POOLS = ['bass', 'chords', 'pad', 'lead', 'pluck', 'acid'];
const LV_POOLCACHE = {};
/** The genre a style draws from ('dnb', 'house' …), worked out from its hand-picked patterns. */
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
/**
 * Finish the library at start-up: build every style's full kits, then add the harmony pack and the melodic
 * pack after them,
 * so the library keeps its order (new patterns always go at the end). Runs once.
 * @param {object[]} styles  STYLES
 */
export function finishLibrary(styles) {
  if (FAC._done) return;
  FAC._done = true;
  try {
    styles.forEach(st => lvFullPool(st));
  } catch (e) {}
  const n = FAC.length;
  addHarmonyPack();
  addMelodicPack();
  for (let i = n; i < FAC.length; i++) FACMAP.set(FAC[i].id, FAC[i]);
  for (const k in LV_POOLCACHE) delete LV_POOLCACHE[k];
}
/* ---- Full kits: kick, snare, hats and percussion on ONE drum track (MC-101, or to free Drums 2 and 3 on the MC-707) ---- */
const FULLKITS = {};
/** Full kits for a style: kick, snare, hats and percussion combined for one drum track. */
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
/**
 * Ids of the factory patterns that suit a style for one pool ('kit', 'bass', 'chords' …): the
 * style's hand-picked ones plus every library pattern of its genre, sub-style and tempo. Cached.
 * @param {object} st    a style from STYLES
 * @param {string} pool
 * @returns {string[]}
 */
export function lvPool(st, pool) {
  if (pool === 'full') return lvFullPool(st);
  const key = st.id + ':' + pool;
  if (LV_POOLCACHE[key]) return LV_POOLCACHE[key];
  const g = lvGenreOf(st),
    bpm = st.bpm[2];
  const hand = [...(st.pools[pool] || []), ...((st.more && st.more[pool]) || [])];
  /* acid techno's basslines include the acid lines */
  if (pool === 'bass' && st.id === 'acidtechno') hand.push(...lvPool(st, 'acid'));
  /* drums keep to their own sub-style (the feel is in the beat); tone parts may come from any sub-style of
     the genre at a nearby tempo, unless a pattern was marked as not for this style (notFor) */
  const tone = TONE_POOLS.includes(pool);
  const lib = FAC.filter(
    f =>
      f.genre === g &&
      f.pool === pool &&
      (!f.styles || f.styles.includes(st.id) || (tone && !(f.notFor && f.notFor.includes(st.id)))) &&
      (f.bpm == null || Math.abs(f.bpm - bpm) <= (tone ? 30 : 24)) &&
      /* harmony-pack patterns with the busier chord timings are for picking by hand, not for auto-picks */
      !f.busy
  ).map(f => f.id);
  return (LV_POOLCACHE[key] = [...new Set([...hand, ...lib])].filter(id => facById(id)));
}
/* How lively a pattern is (0-1): note density, syncopation, pitch variety; drums: density and ghost notes. */
export function lvLively(f) {
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
/** Narrow a pool by flavour: 'lively' keeps the busiest patterns, 'classic' the simplest, 'mixed' all. */
export function lvFlavor(ids, flavor) {
  if (flavor !== 'lively' && flavor !== 'classic') return ids;
  const s = ids
    .map(id => [id, lvLively(facById(id))])
    .sort((a, b) => (flavor === 'lively' ? b[1] - a[1] : a[1] - b[1]));
  return s.slice(0, Math.max(4, Math.ceil(ids.length * (flavor === 'lively' ? 0.6 : 0.7)))).map(x => x[0]);
}
/* chord progression named in a pattern (bass, chords, pads and arps built on the same one sit together) */
/** The chord progression in a pattern's name ('i-VI-III-VII'), or null. Patterns that share one fit together. */
export const lvProg = f => {
  if (!f) return null;
  if (f._prog !== undefined) return f._prog;
  const m = /((?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3,}b?[ivIV]{1,3}[A-Za-z0-9]*)/.exec(f.name);
  return (f._prog = m ? m[1] : null);
};
/** 'major' or 'minor' for a scale name. */
export const lvModeFam = sc => (/major|mixolydian|lydian/.test(sc || '') ? 'major' : 'minor');
