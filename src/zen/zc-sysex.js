// Talking to the MC-707 (or MC-101) with Roland SysEx, for the ZenCore editor: where each clip's tone
// and drum kit lives, writing parameters (DT1) and reading them back (RQ1).
//
// The MC-707 answers DT1 and RQ1 like other ZEN-Core instruments but Roland never documented it.
// Writes are reliable. Reads are quirky: the reply's address is the data's linear address with each
// byte masked to 7 bits, and the device may answer a different (later) run or fewer bytes. So a read
// is only trusted when the reply is for exactly the address asked and exactly as long.
//
// Owns: ZX (the SysEx link: ports, queue, status).
// Reads: MIDI, DEV.
import { MIDI } from '../services/midi.js';
import { DEV } from '../core/device.js';

/* ---- addresses: four 7-bit bytes on the wire, plain (linear) numbers in the code ---- */
/** A packed address (as Roland writes it, 0x30000000) as a linear byte number. */
export const lin = a =>
  (((a >>> 24) & 0x7f) << 21) | (((a >>> 16) & 0x7f) << 14) | (((a >>> 8) & 0x7f) << 7) | (a & 0x7f);
/** The four address bytes for a linear byte number. */
export const addrBytes = l => [(l >>> 21) & 0x7f, (l >>> 14) & 0x7f, (l >>> 7) & 0x7f, l & 0x7f];
/** The four bytes a DT1 reply carries for data at linear address l (the linear value, each byte masked). */
export const replyBytes = l => [(l >>> 24) & 0x7f, (l >>> 16) & 0x7f, (l >>> 8) & 0x7f, l & 0x7f];
/** "30 22 00 00" for a linear address, for messages. */
export const hexAddr = l =>
  addrBytes(l)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

const TONE0 = lin(0x30000000),
  KIT0 = lin(0x32100000),
  TONE_SLOT = lin(0x20000),
  KIT_SLOT = lin(0x30000),
  TRK_SET = lin(0x10000800);
/**
 * Where a tone or drum kit lives: track t (0-7), clip k (0-15), or k = 16 for the track's own sound
 * (used when the track's Sound Source is TRACK).
 * @returns {number} linear address of the block's start
 */
export function slotAddr(kind, t, k) {
  const i = t * 17 + k;
  return kind === 'kit' ? KIT0 + i * KIT_SLOT : TONE0 + i * TONE_SLOT;
}
/** A track's settings: Sound Source (+4: 0 TRACK, 1 CLIP) and type (+0x14: 0 tone, 1 drum, 127 off). */
export const trackSetAddr = t => TRK_SET + t * lin(0x200);

/** Roland checksum over address and data bytes. */
export function checksum(bytes) {
  const s = bytes.reduce((a, b) => a + (b & 0x7f), 0) & 0x7f;
  return (128 - s) & 0x7f;
}
export const modelId = () => (DEV === 'mc101' ? 0x5e : 0x5d);
/** A DT1 (data set) message writing bytes at linear address l. */
export function dt1(l, data, dev = 0x10) {
  const body = [...addrBytes(l), ...data.map(b => b & 0x7f)];
  return [0xf0, 0x41, dev, 0, 0, 0, modelId(), 0x12, ...body, checksum(body), 0xf7];
}
/** An RQ1 (data request) message for n bytes at linear address l. */
export function rq1(l, n, dev = 0x10) {
  const body = [...addrBytes(l), (n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f];
  return [0xf0, 0x41, dev, 0, 0, 0, modelId(), 0x11, ...body, checksum(body), 0xf7];
}

/* ---- the link ---- */
export const ZX = {
  access: null,
  out: null,
  inp: null,
  state: 'off' /* off | asking | ready | blocked | noport */,
  q: new Map() /* pending writes by address, newest wins */,
  timer: 0,
  sent: 0,
  wait: null /* the read waiting for its reply */,
  onState: null,
  log: [] /* the last messages, for the editor's details view */
};
const setState = s => {
  ZX.state = s;
  if (ZX.onState) ZX.onState(s);
};
const isMc = n => /MC-?707|MC-?101/i.test(n || '');
/** Ask for SysEx MIDI access (the browser asks once), and find the MC-707's ports. */
export async function zxConnect() {
  if (ZX.state === 'ready' && ZX.out) return true;
  if (!navigator.requestMIDIAccess) {
    setState('blocked');
    return false;
  }
  setState('asking');
  try {
    ZX.access = ZX.access || (await navigator.requestMIDIAccess({ sysex: true }));
  } catch (e) {
    setState('blocked');
    return false;
  }
  ZX.access.onstatechange = () => pickPorts();
  return pickPorts();
}
function pickPorts() {
  const outs = [...ZX.access.outputs.values()],
    ins = [...ZX.access.inputs.values()];
  const want = MIDI.out && MIDI.out.name;
  ZX.out = outs.find(o => want && o.name === want && isMc(o.name)) || outs.find(o => isMc(o.name)) || null;
  const inp = ins.find(i => ZX.out && i.name === ZX.out.name) || ins.find(i => isMc(i.name)) || null;
  if (ZX.inp && ZX.inp !== inp) ZX.inp.removeEventListener('midimessage', onIn);
  if (inp && ZX.inp !== inp) inp.addEventListener('midimessage', onIn);
  ZX.inp = inp;
  setState(ZX.out ? 'ready' : 'noport');
  return !!ZX.out;
}
function logMsg(dir, bytes) {
  ZX.log.unshift(
    dir +
      ' ' +
      bytes
        .slice(0, 24)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ') +
      (bytes.length > 24 ? ' …' : '')
  );
  ZX.log.length = Math.min(ZX.log.length, 40);
}
function rawSend(bytes) {
  if (!ZX.out) return false;
  try {
    ZX.out.send(bytes);
    ZX.sent++;
    logMsg('→', bytes);
    return true;
  } catch (e) {
    return false;
  }
}

/* Writes go through a queue: one message every 6 ms, and a parameter dragged quickly sends only its
   latest value. */
const PACE = 6;
/** Write bytes at a linear address (queued). */
export function zxWrite(l, data) {
  ZX.q.delete(l);
  ZX.q.set(l, data);
  if (!ZX.timer) ZX.timer = setTimeout(pump, 0);
}
function pump() {
  ZX.timer = 0;
  const it = ZX.q.entries().next();
  if (it.done) return;
  const [l, data] = it.value;
  ZX.q.delete(l);
  rawSend(dt1(l, data));
  if (ZX.q.size) ZX.timer = setTimeout(pump, PACE);
}
/** Resolves once every queued write has gone out. */
export function zxFlush() {
  return new Promise(res => {
    const chk = () => (ZX.q.size || ZX.timer ? setTimeout(chk, 10) : res());
    chk();
  });
}
/** Play or stop a note on a MIDI channel (1-16), to hear the sound being edited. */
export function zxNote(ch, n, on) {
  rawSend(on ? [0x90 | (ch - 1), n, 100] : [0x80 | (ch - 1), n, 0]);
}

function onIn(e) {
  const d = e.data;
  if (!d || d[0] !== 0xf0) return;
  logMsg('←', [...d]);
  const w = ZX.wait;
  if (!w) return;
  if (d[1] === 0x7e && d[3] === 0x06 && d[4] === 0x02 && w.kind === 'id') return w.done([...d]);
  if (d[1] !== 0x41 || d[7] !== 0x12 || w.kind !== 'rq') return;
  const a = [...d.slice(8, 12)],
    data = [...d.slice(12, d.length - 2)];
  w.done({ a, data });
}
function ask(msg, kind, ms) {
  return new Promise(res => {
    const t = setTimeout(() => {
      ZX.wait = null;
      res(null);
    }, ms);
    ZX.wait = {
      kind,
      done: v => {
        clearTimeout(t);
        ZX.wait = null;
        res(v);
      }
    };
    if (!rawSend(msg)) ZX.wait.done(null);
  });
}
let chain = Promise.resolve();
/* one request at a time, after the queued writes */
const serial = fn => (chain = chain.then(() => zxFlush()).then(fn, fn));
/**
 * Read n bytes at linear address l. Resolves to the bytes; null when a reply came but not exactly
 * for this address and length (see the module header); undefined when nothing answered.
 * @returns {Promise<number[]|null|undefined>}
 */
export function zxRead(l, n, ms = 450) {
  return serial(async () => {
    if (!ZX.inp) return undefined;
    for (let tries = 0; tries < 2; tries++) {
      const r = await ask(rq1(l, n), 'rq', ms);
      if (!r) continue;
      const want = replyBytes(l);
      if (r.data.length === n && r.a.every((b, i) => b === want[i])) return r.data;
      return null;
    }
    return undefined;
  });
}
/** Ask the device who it is (Universal Identity Request). Resolves to the model byte or null. */
export function zxIdentify() {
  return serial(async () => {
    const r = await ask([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7], 'id', 800);
    return r ? r[6] : null;
  });
}
