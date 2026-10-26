// The Master FX panels' settings: the master level, the reverb's and the chorus/delay's parameters for
// their type, the master Multi FX's parameters, and the master EQ and compressor. Read from and written
// to the MC-707's project (docs/MC707-SYSEX.md):
//
//   master level       10 00 00 14, one byte (confirmed)
//   reverb             10 00 27 00: on, type, level, then 20 parameters from +03, four half-bytes each
//                      (value + 8000 hex), in the type's order (the Integra reverb's 9 read back as the
//                      manual lists them)
//   chorus/delay       10 00 26 00: on, type, level, reverb send, then 20 parameters from +04
//   master Multi FX    10 00 20 00: the same layout as a tone's MFX block
//   master EQ          10 00 39 00: 15 bytes; compressor 10 00 3A 00: 24 bytes (Roland's MV-1 map;
//                      gains kept as 64 + value, as the default bytes read back)
//
// Owns: TV (what was last read or set). Reads: FXN (the types chosen).
import { lin, zxConnect, zxFlush, zxRead, zxReadIn, zxWrite } from './zc-sysex.js';
import { MFX_PARAMS, allParams, decode, sendSound } from './zc-tone.js';
import { NOTES, mfxParams } from './zc-mfx.js';
import { FXN } from './zc-fx.js';
import { CHO_PARAMS, MASTER_COMP, MASTER_EQ, REV_PARAMS } from './zc-total-data.js';

const AT = {
  level: lin(0x10000014),
  rev: lin(0x10002700) + 3,
  cho: lin(0x10002600) + 4,
  mfx: lin(0x10002000),
  eq: lin(0x10003900),
  comp: lin(0x10003a00)
};
/* the project Multi FX block has a tone's MFX layout; a tone's MFX block sits at +80 (linear) */
const MFX_AT = 0x80;

/** What each panel last read or set: {level: n, rev: [..], cho: [..], mfx: [..], eq: [..], comp: [..]}. */
export const TV = {};

const panText = v => (v === 0 ? 'C' : v < 0 ? 'L' + -v : v + 'R');
/* a parameter written MFX-style, as a control in stored units */
function slotControl(p, i) {
  const [name, kind, a, b, c, d] = p;
  const base = { key: i, name };
  if (kind === 'S') return { ...base, min: 0, max: 1, list: ['OFF', 'ON'] };
  if (kind === 'N') return { ...base, min: 0, max: NOTES.length - 1, list: NOTES };
  if (kind === 'L') return { ...base, min: 0, max: a.length - 1, list: a, unit: b || '' };
  if (kind === 'D') {
    const f = 10 ** c;
    return {
      ...base,
      min: Math.round(a * f),
      max: Math.round(b * f),
      text: v => (v / f).toFixed(c) + (d ? ' ' + d : '')
    };
  }
  return { ...base, min: a, max: b, text: v => (c === 'pan' ? panText(v) : v + (c ? ' ' + c : '')) };
}
/* the master Multi FX's parameters, from the MFX type tables */
function mfxControls(type) {
  return mfxParams(type).map((sp, i) => {
    if (sp.kind === 'L')
      return { key: i, name: sp.name, min: 0, max: sp.list.length - 1, list: sp.list, unit: sp.unit };
    if (sp.kind === 'D') {
      const f = 10 ** sp.dec;
      return {
        key: i,
        name: sp.name,
        min: Math.round(sp.lo * f),
        max: Math.round(sp.hi * f),
        text: v => (v / f).toFixed(sp.dec) + (sp.unit ? ' ' + sp.unit : '')
      };
    }
    return {
      key: i,
      name: sp.name,
      min: sp.lo,
      max: sp.hi,
      text: v =>
        sp.unit === 'pan'
          ? panText(v)
          : sp.unit === 'bal'
            ? 'D' + (100 - v) + ':' + v + 'W'
            : v + (sp.unit ? ' ' + sp.unit : '')
    };
  });
}
/* a master EQ or compressor byte, as a control */
function byteControl([name, at, kind, a, b, c]) {
  const base = { key: at, name };
  if (kind === 'S') return { ...base, min: 0, max: 1, list: ['OFF', 'ON'] };
  if (kind === 'L') return { ...base, min: 0, max: a.length - 1, list: a, unit: b || '' };
  if (kind === 'G') return { ...base, min: a, max: b, off: 64, text: v => (v > 0 ? '+' : '') + v + ' dB' };
  if (kind === 'H')
    return { ...base, min: a, max: b, off: 64, text: v => (v > 0 ? '+' : '') + (v / 2).toFixed(1) + ' dB' };
  if (kind === 'M') return { ...base, min: 0, max: 99, text: v => 10 + v * 10 + ' ms' };
  return { ...base, min: a, max: b, text: v => v + (c ? ' ' + c : '') };
}

const typeOf = sec => {
  const m = FXN.master || {};
  if (sec === 'rev') return m.rev && m.rev.sw !== 0 ? m.rev.type : 0;
  if (sec === 'cho') return m.cho && m.cho.sw !== 0 ? m.cho.type : 0;
  if (sec === 'mfx') return m.mfx ? m.mfx.type : null;
  return null;
};
/**
 * A panel: its title, a note, and its controls with their values (null until read or set).
 * @param {'rev'|'cho'|'mfx'|'eq'|'comp'} sec
 */
export function totalPanel(sec) {
  const t = typeOf(sec);
  let title = '',
    controls = [],
    note = '';
  if (sec === 'rev' || sec === 'cho') {
    const [name, ps] = (sec === 'rev' ? REV_PARAMS : CHO_PARAMS)[t] || ['', []];
    title = (sec === 'rev' ? 'Reverb' : 'Delay / chorus') + (t ? ': ' + name : '');
    controls = ps.map(slotControl);
    note = !t
      ? 'Choose a type on the strip first (or Read from MC-707).'
      : !ps.length
        ? 'This type’s settings are not mapped yet: shape it on the MC-707.'
        : 'New: the settings follow the manual’s order for this type. If one does not do what it says, tell us.';
  } else if (sec === 'mfx') {
    title = 'Multi FX' + (FXN.master && FXN.master.mfx && FXN.master.mfx.label ? ': ' + FXN.master.mfx.label : '');
    controls = t == null ? [] : mfxControls(t);
    note = t == null ? 'Choose a Multi FX on the strip first (or Read from MC-707).' : '';
  } else if (sec === 'eq') {
    title = 'Master EQ';
    controls = MASTER_EQ.map(byteControl);
  } else if (sec === 'comp') {
    title = 'Master compressor';
    controls = MASTER_COMP.map(byteControl);
    note = 'Three bands, split at the two frequencies.';
  }
  const vals = TV[sec] || [];
  return { title, note, controls: controls.map(c => ({ ...c, v: vals[c.key] ?? null })) };
}

const nib = v => {
  const x = (v + 0x8000) & 0xffff;
  return [(x >> 12) & 15, (x >> 8) & 15, (x >> 4) & 15, x & 15];
};
const unNib = b => (((b[0] & 15) << 12) | ((b[1] & 15) << 8) | ((b[2] & 15) << 4) | (b[3] & 15)) - 0x8000;

/** Read a panel's values from the MC-707. Resolves false when it does not answer. */
export async function totalRead(sec) {
  if (!(await zxConnect())) return false;
  if (sec === 'level') {
    const b = await zxReadIn(AT.level, 1);
    if (!Array.isArray(b)) return false;
    TV.level = b[0];
    return true;
  }
  if (sec === 'eq' || sec === 'comp') {
    const n = sec === 'eq' ? 15 : 24,
      b = await zxReadIn(AT[sec], n);
    if (!Array.isArray(b) || b.length < n) return false;
    const list = sec === 'eq' ? MASTER_EQ : MASTER_COMP,
      out = [];
    for (const p of list) {
      const c = byteControl(p);
      out[c.key] = b[c.key] - (c.off || 0);
    }
    TV[sec] = out;
    return true;
  }
  if (sec === 'mfx') {
    /* the block in two whole reads (it runs past 128 bytes), each parameter where a tone's MFX has it */
    const b = await zxRead(AT.mfx, 128, 600, true),
      c = Array.isArray(b) ? await zxRead(AT.mfx + 128, 128, 600, true) : null;
    if (!Array.isArray(b) || !Array.isArray(c)) return false;
    const blk = [...b, ...new Array(Math.max(0, 128 - b.length)).fill(0), ...c];
    const at = new Map(allParams('tone').map(([k, p, off]) => [k, [p, off - MFX_AT]]));
    TV.mfx = MFX_PARAMS.map(k => {
      const [p, off] = at.get(k);
      return decode(p, blk.slice(off, off + p[2])) ?? 0;
    });
    return true;
  }
  const n = totalPanel(sec).controls.length;
  if (!n) return true;
  const b = await zxReadIn(AT[sec], n * 4);
  if (!Array.isArray(b) || b.length < n * 4) return false;
  TV[sec] = Array.from({ length: n }, (_, i) => unNib(b.slice(i * 4, i * 4 + 4)));
  return true;
}
/** Set one value (in stored units: a list index, or the number as the control counts it). */
export async function totalSet(sec, key, v) {
  if (!(await zxConnect())) return false;
  if (sec === 'level') {
    TV.level = v;
    zxWrite(AT.level, [v]);
  } else if (sec === 'eq' || sec === 'comp') {
    const c = byteControl((sec === 'eq' ? MASTER_EQ : MASTER_COMP).find(p => p[1] === key));
    (TV[sec] = TV[sec] || [])[key] = v;
    zxWrite(AT[sec] + key, [(v + (c.off || 0)) & 0x7f]);
  } else if (sec === 'mfx') {
    (TV.mfx = TV.mfx || [])[key] = v;
    const k = MFX_PARAMS[key];
    await sendSound({ kind: 'tone', v: { [k]: v }, known: new Set() }, AT.mfx - MFX_AT, new Set([k]));
  } else {
    (TV[sec] = TV[sec] || [])[key] = v;
    zxWrite(AT[sec] + key * 4, nib(v));
  }
  return true;
}
/** Wait for the writes (the tests). */
export const totalFlush = () => zxFlush();
