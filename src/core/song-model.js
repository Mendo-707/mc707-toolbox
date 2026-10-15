// Reading and editing the song's clips: find the clip at a bar, cut a gap into a track, place a
// clip, the song's length, and clip arithmetic (loop length, 16th-step rounding).
//
// Reads: S, UI.
// Calls up the layers through hooks (core/hooks.js).
import { S, UI, edClip, scheduleSave } from './state.js';
import { hooks } from './hooks.js';

/* ---------- pattern + clip helpers ---------- */
const IDX = new WeakMap();
/**
 * The notes of a pattern grouped by tick, for fast lookup while playing. Cached until touch(p).
 * @param {import('./types.js').Pattern} p
 * @returns {Map<number, import('./types.js').Note[]>}
 */
export function patIndex(p) {
  let m = IDX.get(p);
  if (!m) {
    m = new Map();
    for (const n of p.notes) {
      const k = Math.floor(n.s * 2 + 1e-6);
      if (k < 0 || k >= p.bars * 32) continue;
      let a = m.get(k);
      if (!a) {
        a = [];
        m.set(k, a);
      }
      a.push(n);
    }
    IDX.set(p, m);
  }
  return m;
}
/**
 * How far after its tick a note starts, in ticks (0 to <1). Notes on the 32nd grid give 0; triplets
 * and 64th rolls sit between ticks, so players add subTick(n) * tickDuration to the note's time.
 * @param {import('./types.js').Note} n
 */
export const subTick = n => Math.max(0, n.s * 2 - Math.floor(n.s * 2 + 1e-6));
/** Call after changing a pattern's notes: clears its cached index and redraws. @param {import('./types.js').Pattern} p */
export function touch(p) {
  IDX.delete(p);
  p.mod = true;
  const v = UI.view;
  if (v && v.p === p) adoptView(v, p);
  hooks.scheduleUI();
}
/* The first edit to a library pattern open in the editor keeps the edited copy in the song's patterns
   (unplaced), so it is saved and undo works. Until then the copy lives only in UI.view. */
function adoptView(v, p) {
  const id = 'p' + S.nextId++;
  p.id = id;
  S.patterns[id] = p;
  v.pat = id;
  v.p = JSON.parse(JSON.stringify(v.orig));
  scheduleSave();
}
/** The pattern a clip plays. A library view (UI.view) falls back to its unsaved copy. @param {import('./types.js').Clip} c */
export const patOf = c => (c.view ? (c.pat && S.patterns[c.pat]) || c.p : S.patterns[c.pat]);
/** The pattern in the editor (the selected clip's, or a library pattern's), or null. */
export const curPat = () => {
  const c = edClip();
  return c ? patOf(c) : null;
};
/** The clip on track t at a bar, or null. @param {number} t @param {number} bar @returns {import('./types.js').Clip|null} */
export function clipAt(t, bar) {
  for (const c of S.clips) if (c.t === t && bar >= c.start && bar < c.start + c.len) return c;
  return null;
}
/** The bar where the last clip ends (at least 1). */
export function songEnd() {
  let e = 1;
  for (const c of S.clips) e = Math.max(e, c.start + c.len);
  return e;
}
export const MAXBARS = 512;
/** Grow the arrangement so there are a few empty bars after `end`. */
export function ensureBars(end) {
  if (end + 4 > S.bars) S.bars = Math.min(MAXBARS, Math.ceil((end + 4) / 8) * 8);
}
/**
 * Clear bars [a, b) on track t: clips inside are removed, clips across the edges are shortened or
 * split. The clip with id exceptId is left alone.
 */
export function carve(t, a, b, exceptId) {
  for (const c of S.clips.slice()) {
    if (c.t !== t || c.id === exceptId) continue;
    const ca = c.start,
      cb = c.start + c.len;
    if (cb <= a + 1e-9 || ca >= b - 1e-9) continue;
    const pb = loopLen(c);
    if (ca >= a - 1e-9 && cb <= b + 1e-9) {
      S.clips.splice(S.clips.indexOf(c), 1);
      if (UI.sel === c.id) UI.sel = null;
    } else if (ca < a && cb > b) {
      S.clips.push({
        ...c,
        id: 'c' + S.nextId++,
        start: q16(b),
        len: q16(cb - b),
        off: wrapOff(c.off + (b - ca), pb)
      });
      c.len = q16(a - ca);
    } else if (ca < a) {
      c.len = q16(a - ca);
    } else {
      const d = b - ca;
      c.off = wrapOff(c.off + d, pb);
      c.start = q16(b);
      c.len = q16(cb - b);
    }
  }
}
/** Put pattern pid on track t at `start` for `len` bars, clearing what was there. @returns {import('./types.js').Clip} */
export function placeClip(t, start, pid, len) {
  carve(t, start, start + len);
  const c = { id: 'c' + S.nextId++, t, start, len, off: 0, pat: pid };
  S.clips.push(c);
  ensureBars(start + len);
  return c;
}

/** Round bars to the nearest 16th (one step). */
export const q16 = v => Math.round(v * 16) / 16;
/** How many bars of its pattern a clip loops (its own loop length, or the pattern's). */
export const loopLen = c => c.ll || S.patterns[c.pat].bars;
/** Wrap a pattern offset into [0, L). */
export const wrapOff = (o, L) => q16(((o % L) + L) % L);
