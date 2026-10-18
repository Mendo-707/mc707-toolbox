// The ZenCore sound being edited: a tone (4 partials) or a drum kit (88 keys), as a flat map of
// parameter values, and how each value goes to and from the MC-707 (addresses, bytes, whole-sound
// reads and writes).
//
// Reads: ZC_BLOCKS.
import { ZC_BLOCKS } from './zc-data.js';
import { zxFlush, zxRead, zxWrite } from './zc-sysex.js';

/* Each sound is made of blocks: [key, block, offset from the slot (linear bytes), count, stride]. */
const L = n => ((n >> 8) << 7) | (n & 0x7f); /* packed 2-byte offset (0x2000) to linear */
export const LAYOUT = {
  tone: [
    ['CMN', 'CMN', 0, 1, 0],
    ['MFX', 'MFX', L(0x100), 1, 0],
    ['PMT', 'PMT', L(0x1000), 1, 0],
    ['PTL', 'PTL', L(0x2000), 4, 128],
    ['PENV', 'PENV', L(0x2400), 4, 128],
    ['FENV', 'FENV', L(0x2800), 4, 128],
    ['AENV', 'AENV', L(0x2c00), 4, 128],
    ['LFO', 'LFO', L(0x3000), 4, 256],
    ['EQ', 'EQ', L(0x3800), 4, 128],
    ['SCMN', 'SCMN', L(0x3c00), 1, 0],
    ['SPMT', 'SPMT', L(0x3d00), 1, 0],
    ['SPTL', 'SPTL', L(0x3e00), 4, 128]
  ],
  kit: [
    ['KCMN', 'KCMN', 0, 1, 0],
    ['MFX', 'MFX', L(0x100), 1, 0],
    ['KCMP', 'KCMP', L(0x1000), 6, 128],
    ['KPTL', 'KPTL', L(0x1600), 88, 128],
    ['KEQ', 'EQ', L(0x6e00), 88, 128]
  ]
};
/** The first key of a drum kit's 88 (A0, MIDI note 21). */
export const KIT_LOW = 21;

/** Parameter key for block key, instance and id: 'PTL2.CUTOFF' (instance 0-based), 'CMN.LEVEL'. */
export const pk = (key, i, id) => key + (i == null ? '' : i) + '.' + id;
const DEF = {};
for (const b in ZC_BLOCKS) DEF[b] = Object.fromEntries(ZC_BLOCKS[b].p.map(p => [p[0], p]));
/** Every parameter of a sound: [key, def, offset from the slot]. Cached per kind. */
const ALL = {};
export function allParams(kind) {
  if (ALL[kind]) return ALL[kind];
  const out = [];
  for (const [key, blk, base, n, stride] of LAYOUT[kind])
    for (let i = 0; i < n; i++)
      for (const p of ZC_BLOCKS[blk].p) out.push([pk(key, n > 1 ? i : null, p[0]), p, base + i * stride + p[1]]);
  return (ALL[kind] = out);
}
const INDEX = {};
/** [def, offset] for a parameter key. */
export function paramOf(kind, key) {
  if (!INDEX[kind]) INDEX[kind] = Object.fromEntries(allParams(kind).map(([k, p, o]) => [k, [p, o]]));
  return INDEX[kind][key];
}
export const defOf = (blk, id) => DEF[blk][id];

/** A new sound with Roland's initial values. */
export function newSound(kind) {
  const v = {};
  for (const [k, p] of allParams(kind)) v[k] = p[8] && p[8].ascii ? 'INIT ' + (kind === 'kit' ? 'KIT' : 'TONE') : p[5];
  return { kind, v, known: new Set(Object.keys(v)) };
}

/** The bytes for one value. */
export function encode(p, val) {
  if (p[8] && p[8].ascii) {
    const s = String(val || '').slice(0, p[2]);
    return Array.from({ length: p[2] }, (_, i) => {
      const c = s.charCodeAt(i);
      return c >= 32 && c < 127 ? c : 32;
    });
  }
  const raw = Math.round(Math.max(p[3], Math.min(p[4], val))) + p[6];
  if (p[2] === 1) return [raw & 0x7f];
  const out = [];
  for (let i = p[2] - 1; i >= 0; i--) out.push((raw >> (4 * i)) & 15);
  return out;
}
/** The value from its bytes (null when out of range, so a bad read is not taken). */
export function decode(p, bytes) {
  if (p[8] && p[8].ascii) return String.fromCharCode(...bytes.map(b => (b >= 32 && b < 127 ? b : 32))).trimEnd();
  let raw = 0;
  if (p[2] === 1) raw = bytes[0] & 0x7f;
  else for (const b of bytes) raw = (raw << 4) | (b & 15);
  const v = raw - p[6];
  return v < p[3] || v > p[4] ? null : v;
}

/** Set one value in the sound and send it to the slot at linear address base (when base != null). */
export function setVal(snd, key, val, base) {
  const [p, off] = paramOf(snd.kind, key);
  snd.v[key] = val;
  snd.known.add(key);
  if (base != null) zxWrite(base + off, encode(p, val));
}

/* Runs: parameters that sit next to each other, read or written in one message (at most 64 bytes).
   A run never crosses from one block into the next (one partial into the next, say): the MC-707 answers
   such a request in two packets. It only ever returns whole parameters, so runs start and end on them. */
const blockOf = k => k.slice(0, k.indexOf('.'));
export function runs(kind, keys) {
  const ps = allParams(kind)
    .filter(([k]) => !keys || keys.has(k))
    .sort((a, b) => a[2] - b[2]);
  const out = [];
  for (const it of ps) {
    const r = out[out.length - 1];
    if (r && r.end === it[2] && r.blk === blockOf(it[0]) && it[2] + it[1][2] - r.start <= 64) {
      r.items.push(it);
      r.end = it[2] + it[1][2];
    } else out.push({ start: it[2], end: it[2] + it[1][2], blk: blockOf(it[0]), items: [it] });
  }
  return out;
}
function writeRuns(snd, base, keys) {
  for (const r of runs(snd.kind, keys)) {
    const data = [];
    for (const [k, p] of r.items) data.push(...encode(p, snd.v[k]));
    zxWrite(base + r.start, data);
  }
}
/* The MC-707 resets an effect's 32 settings to 0 shortly AFTER its type changes over MIDI (seen on a real
   unit), wiping settings sent with the type. So when the type is sent, the settings follow once the
   reset is done, and are read back and sent once more if they did not stick. */
const MFX_TYPE = 'MFX.mfxType';
export const MFX_PARAMS = Array.from({ length: 32 }, (_, i) => 'MFX.param_' + (i + 1));
export const MFX_RESET_MS = 300;
const pause = ms => new Promise(r => setTimeout(r, ms));
/* the latest pending job per slot address: a newer send to the same clip replaces an older one */
const mfxJob = new Map();
async function mfxAfterReset(snd, base, ks) {
  const job = (mfxJob.get(base) || 0) + 1;
  mfxJob.set(base, job);
  for (let tryN = 0; tryN < 2; tryN++) {
    await zxFlush();
    await pause(MFX_RESET_MS);
    if (job !== mfxJob.get(base)) return;
    writeRuns(snd, base, new Set(ks));
    /* read them back into a copy, and compare */
    const copy = { kind: snd.kind, v: { ...snd.v }, known: new Set() };
    const r = await readSound(copy, base, new Set(ks));
    if (job !== mfxJob.get(base)) return;
    if (!r.ok || ks.every(k => copy.v[k] === snd.v[k])) return;
  }
}
/**
 * Send the whole sound (or the keys given) to the slot. When the effect type is among them, the 32
 * effect settings go a moment later (see above). Resolves when everything has been sent and checked.
 * @returns {Promise<void>}
 */
export function sendSound(snd, base, keys) {
  const has = k => !keys || keys.has(k);
  if (!has(MFX_TYPE)) {
    writeRuns(snd, base, keys);
    return Promise.resolve();
  }
  const later = MFX_PARAMS.filter(has);
  writeRuns(
    snd,
    base,
    new Set(
      allParams(snd.kind)
        .map(x => x[0])
        .filter(k => has(k) && !later.includes(k))
    )
  );
  return later.length ? mfxAfterReset(snd, base, later) : Promise.resolve();
}
/**
 * Read the sound (or the keys given) from the slot. Values that read cleanly replace the sound's;
 * the others stay as they were and drop out of snd.known. progress(done, total) is called as it goes.
 * @returns {Promise<{ok: number, bad: number}>}
 */
export async function readSound(snd, base, keys, progress) {
  const rs = runs(snd.kind, keys);
  let ok = 0,
    bad = 0,
    done = 0,
    silent = 0;
  const take = (it, bytes) => {
    const v = decode(it[1], bytes);
    if (v == null) return false;
    snd.v[it[0]] = v;
    snd.known.add(it[0]);
    return true;
  };
  for (const r of rs) {
    const data = await zxRead(base + r.start, r.end - r.start);
    if (data === undefined && ok === 0 && ++silent >= 3) {
      /* nothing answers: stop rather than wait out every request */
      for (const it of rs.flatMap(x => x.items)) snd.known.delete(it[0]);
      return { ok, bad: rs.reduce((a, x) => a + x.items.length, 0), silent: true };
    }
    if (data) {
      for (const it of r.items) {
        const o = it[2] - r.start;
        if (take(it, data.slice(o, o + it[1][2]))) ok++;
        else bad++;
      }
    } else if (data === null && r.items.length > 1) {
      /* the run did not come back whole: ask for each parameter on its own */
      for (const it of r.items) {
        const d = await zxRead(base + it[2], it[1][2]);
        if (d && take(it, d)) ok++;
        else {
          snd.known.delete(it[0]);
          bad++;
        }
      }
    } else
      for (const it of r.items) {
        snd.known.delete(it[0]);
        bad++;
      }
    if (progress) progress(++done, rs.length);
  }
  return { ok, bad, total: ok + bad };
}

/* ---- saving sounds: plain JSON with the values by key ---- */
export const soundJSON = (snd, name) => ({
  app: 'mc707-toolbox',
  zencore: 1,
  kind: snd.kind,
  name: name || snd.v['CMN.NAME'] || snd.v['KCMN.NAME'] || '',
  v: snd.v
});
/** A sound from saved JSON (unknown keys are ignored, missing ones keep the initial values). */
export function soundFrom(o) {
  if (!o || o.zencore !== 1 || (o.kind !== 'tone' && o.kind !== 'kit') || typeof o.v !== 'object') return null;
  const snd = newSound(o.kind);
  for (const k in snd.v)
    if (k in o.v) {
      const [p] = paramOf(o.kind, k);
      const x = o.v[k];
      if (p[8] && p[8].ascii ? typeof x === 'string' : Number.isFinite(x) && x >= p[3] && x <= p[4]) snd.v[k] = x;
    }
  return snd;
}
export const copySound = snd => ({ kind: snd.kind, v: { ...snd.v }, known: new Set(snd.known) });
