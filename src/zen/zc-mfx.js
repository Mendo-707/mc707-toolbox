// MFX types for the editor: the parameters a type puts in the 32 MFX slots, and how a slot's stored
// value (-20000 to +20000) turns into what you see (list entries from 0, whole numbers as they are,
// decimals scaled: 0.05-10.00 Hz is stored as 5-1000).
//
// Reads: MFX_TYPES.
import { MFX_TYPES } from './zc-mfx-data.js';

export const NOTES =
  '1/64T 1/64 1/32T 1/32 1/16T 1/32. 1/16 1/8T 1/16. 1/8 1/4T 1/8. 1/4 1/2T 1/4. 1/2 1/1T 1/2. 1/1 2/1T 1/1. 2/1'.split(
    ' '
  );
/** The MFX type names, 0-90. */
export const mfxNames = () => MFX_TYPES.map(t => t[0]);
/**
 * The parameters of an MFX type, each as {name, kind, lo, hi, dec, unit, list}, in slot order.
 * Every parameter's lo/hi is in display units; stored() and shown() convert.
 */
export function mfxParams(type) {
  const t = MFX_TYPES[type] || MFX_TYPES[0];
  return t[1].map(([name, kind, a, b, c, d]) => {
    if (kind === 'S') return { name, kind: 'L', list: ['OFF', 'ON'], lo: 0, hi: 1 };
    if (kind === 'N') return { name, kind: 'L', list: NOTES, lo: 0, hi: NOTES.length - 1 };
    if (kind === 'L') return { name, kind, list: a, unit: b || '', lo: 0, hi: a.length - 1 };
    if (kind === 'D') return { name, kind, lo: a, hi: b, dec: c, unit: d || '' };
    return { name, kind: 'R', lo: a, hi: b, unit: c || '' };
  });
}
/** The stored slot value for a shown value. */
export const stored = (sp, v) => (sp.kind === 'D' ? Math.round(v * 10 ** sp.dec) : Math.round(v));
/** The shown value for a stored slot value (kept inside the parameter's range). */
export function shown(sp, s) {
  const v = sp.kind === 'D' ? s / 10 ** sp.dec : s;
  return Math.max(sp.lo, Math.min(sp.hi, v));
}
/** Text for a shown value. */
export function mfxText(sp, v) {
  if (sp.kind === 'L') return (sp.list[v] ?? String(v)) + (sp.unit && /\d$/.test(sp.list[v]) ? ' ' + sp.unit : '');
  if (sp.unit === 'pan') return v === 0 ? 'C' : v < 0 ? 'L' + -v : v + 'R';
  if (sp.unit === 'bal') return 'D' + (100 - v) + ':' + v + 'W';
  const n = sp.kind === 'D' ? v.toFixed(sp.dec) : String(v);
  return n + (sp.unit ? ' ' + sp.unit : '');
}
/** Sensible starting values for a type, as stored slot values (32 of them). */
export function mfxDefaults(type) {
  const out = new Array(32).fill(0);
  mfxParams(type).forEach((sp, i) => {
    let v = sp.lo;
    if (/^Level$|Level$/.test(sp.name) && sp.kind === 'R' && sp.hi === 127) v = 127;
    else if (sp.unit === 'dB' && sp.lo < 0) v = 0;
    else if (sp.unit === 'pan' || sp.unit === 'cent' || sp.unit === 'semi' || sp.unit === '%') v = Math.max(sp.lo, 0);
    else if (sp.unit === 'bal') v = 50;
    else if (sp.kind === 'R' && sp.hi === 127) v = 64;
    else if (sp.kind === 'D' && sp.unit === 'Hz') v = Math.max(sp.lo, 1);
    else if (sp.kind === 'R' && /msec/.test(sp.unit)) v = Math.min(sp.hi, 300);
    else if (sp.kind === 'L' && sp.list === NOTES) v = 12;
    else if (sp.kind === 'L' && sp.list[sp.list.length - 1] === 'BYPASS') v = sp.list.length - 1;
    out[i] = stored(sp, v);
  });
  return out;
}
