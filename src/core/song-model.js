import { FAC } from '../library/factory.js';
import { S, UI } from './state.js';
import { scheduleUI } from '../song/arrangement.js';
import { loopLen, q16, wrapOff } from '../song/layout.js';

/* ---------- pattern + clip helpers ---------- */
const IDX = new WeakMap();
export function patIndex(p) {
  let m = IDX.get(p);
  if (!m) {
    m = new Map();
    for (const n of p.notes) {
      const k = Math.round(n.s * 2);
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
export function touch(p) {
  IDX.delete(p);
  p.mod = true;
  scheduleUI();
}
export const getClip = id => S.clips.find(c => c.id === id);
export const curClip = () => (UI.sel ? getClip(UI.sel) : null);
export const patOf = c => S.patterns[c.pat];
export const curPat = () => {
  const c = curClip();
  return c ? patOf(c) : null;
};
export function clipAt(t, bar) {
  for (const c of S.clips) if (c.t === t && bar >= c.start && bar < c.start + c.len) return c;
  return null;
}
export function songEnd() {
  let e = 1;
  for (const c of S.clips) e = Math.max(e, c.start + c.len);
  return e;
}
export const MAXBARS = 512;
export function ensureBars(end) {
  if (end + 4 > S.bars) S.bars = Math.min(MAXBARS, Math.ceil((end + 4) / 8) * 8);
}
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
export function placeClip(t, start, pid, len) {
  carve(t, start, start + len);
  const c = { id: 'c' + S.nextId++, t, start, len, off: 0, pat: pid };
  S.clips.push(c);
  ensureBars(start + len);
  return c;
}
export const metaOf = src => (src.kind === 'fac' ? FAC.find(f => f.id === src.id) : S.patterns[src.id]);
