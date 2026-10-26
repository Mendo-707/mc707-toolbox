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
import { DEV, devNum } from '../core/device.js';

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
/** The device's own track index (0-7, or 0-3 on the MC-101) for app track t. The MC-101's four
   tracks are the app's tracks 1, 4, 5 and 7, so they are renumbered here. */
export const devTrack = t => (DEV === '101' ? Math.max(0, devNum(t) - 1) : t);
/**
 * Where a tone or drum kit lives: app track t (0-7), clip k (0-15), or k = 16 for the track's own sound
 * (used when the track's Sound Source is TRACK).
 * @returns {number} linear address of the block's start
 */
export function slotAddr(kind, t, k) {
  const i = devTrack(t) * 17 + k;
  return kind === 'kit' ? KIT0 + i * KIT_SLOT : TONE0 + i * TONE_SLOT;
}
/** A track's settings: Sound Source (+4: 0 TRACK, 1 CLIP) and type (+0x14: 0 tone, 1 drum, 127 off). */
export const trackSetAddr = t => TRK_SET + devTrack(t) * lin(0x200);

/** Roland checksum over address and data bytes. */
export function checksum(bytes) {
  const s = bytes.reduce((a, b) => a + (b & 0x7f), 0) & 0x7f;
  return (128 - s) & 0x7f;
}
/* Roland's model byte: 0x5D on the MC-707 and 0x5E expected on the MC-101. Neither is documented, so
   the one the device answers to is learnt from its replies (ZX.model) and used from then on. */
const MODELS = [0x5d, 0x5e];
const known = () => (ZX.model && ZX.modelFor === DEV + ':' + (ZX.out && ZX.out.name) ? ZX.model : 0);
export const modelId = () => known() || (DEV === '101' ? 0x5e : 0x5d);
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
  log: [] /* the last messages, for the editor's details view */,
  model: 0 /* the model byte the device answered to (0 = not known yet) */,
  modelFor: '' /* the device setting and port it was learnt for */,
  onIdle: null /* called each time the write queue empties */,
  pace: 0 /* ms between queued writes when set (the clip notes write slower), else PACE */
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
  /* a send that throws (the port closing mid-write) must not stop the queue: zxFlush would wait forever */
  try {
    rawSend(dt1(l, data));
  } catch (e) {}
  if (ZX.q.size) ZX.timer = setTimeout(pump, ZX.pace || PACE);
  else if (ZX.onIdle) ZX.onIdle();
}
/** Resolves once every queued write has gone out. */
export function zxFlush() {
  return new Promise(res => {
    const chk = () => {
      if (!ZX.q.size && !ZX.timer) return res();
      /* writes waiting with nothing sending them: start the queue again */
      if (ZX.q.size && !ZX.timer) ZX.timer = setTimeout(pump, 0);
      setTimeout(chk, 10);
    };
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
  if (!MODELS.includes(d[6])) return;
  const a = [...d.slice(8, 12)],
    data = [...d.slice(12, d.length - 2)];
  /* a reply can come in more than one packet: each must carry the address where the last one ended.
     Anything else is a stray (a late reply to an earlier request) and is set aside. */
  /* the tone and kit areas answer with the masked form; the plain form is accepted too. A loose read
     (the clip notes, zc-seq.js, as Ada Locriana's tools read them) takes the first reply whatever its
     address, and keeps the address it came with */
  const want = replyBytes(w.l + w.buf.length),
    plain = addrBytes(w.l + w.buf.length);
  if (!a.every((b, i) => b === want[i]) && !a.every((b, i) => b === plain[i])) {
    if (!(w.loose && !w.buf.length)) {
      w.stray++;
      return;
    }
    w.from = a;
  }
  /* a loose read takes a reply shorter than asked for (the clip step settings are 3 bytes; some steps
     answer for half their slots): once the packets stop coming, it is done */
  if (w.loose) {
    clearTimeout(w.idle);
    w.idle = setTimeout(w.done, 60);
  }
  ZX.model = d[6];
  ZX.modelFor = DEV + ':' + (ZX.out && ZX.out.name);
  w.buf.push(...data);
  if (w.buf.length >= w.n) w.done();
}
/* send a request and gather its reply: {buf, stray} once n bytes are in, or whatever came by the timeout */
function askRq(msg, l, n, ms, loose) {
  return new Promise(res => {
    const w = {
      kind: 'rq',
      l,
      n,
      loose,
      buf: [],
      stray: 0,
      done: () => {
        clearTimeout(t);
        clearTimeout(w.idle);
        ZX.wait = null;
        res({ buf: w.buf, stray: w.stray });
      }
    };
    const t = setTimeout(w.done, ms);
    ZX.wait = w;
    if (!rawSend(msg)) w.done();
  });
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
const pause = ms => new Promise(r => setTimeout(r, ms));
let chain = Promise.resolve();
/* one request at a time, after the queued writes */
const serial = fn => (chain = chain.then(() => zxFlush()).then(fn, fn));
/**
 * Read n bytes at linear address l. Resolves to the bytes; null when a reply came but not exactly
 * for this address and length (see the module header); undefined when nothing answered.
 * After a reply it waits a moment, so a late packet cannot be taken as the answer to the next request
 * (partials 1 and 2, and 3 and 4, answer with the same address).
 * With loose, the first reply counts whatever address it carries (for areas whose replies are not
 * mapped yet), and a shorter reply than asked for is returned as it came.
 * @returns {Promise<number[]|null|undefined>}
 */
export function zxRead(l, n, ms = 450, loose = false) {
  return serial(async () => {
    if (!ZX.inp) return undefined;
    for (let tries = 0; tries < 3; tries++) {
      /* the last try, while the model byte is still unknown, asks with the other model's byte */
      const guess = !known() && tries === 2 ? MODELS.find(m => m !== modelId()) : 0;
      if (tries === 2 && !guess) break;
      const msg = rq1(l, n);
      if (guess) msg[6] = guess;
      const r = await askRq(msg, l, n, ms, loose);
      if (!r.buf.length && !r.stray) continue;
      await pause(SETTLE);
      return r.buf.length === n || (loose && r.buf.length) ? r.buf : null;
    }
    return undefined;
  });
}
/**
 * Read n bytes at l from the 128-byte block that holds them: a loose read of the whole block, as the
 * scan pages read the project area. Small exact reads there go unanswered on an MC-707; whole blocks
 * answer (cut short where the block's data ends). Resolves to the bytes, or null.
 */
export async function zxReadIn(l, n) {
  const from = l - (l & 127),
    at = l & 127;
  const b = await zxRead(from, 128, 600, true);
  return Array.isArray(b) && b.length >= at + n ? b.slice(at, at + n) : null;
}
/* how long to wait after each reply for stray packets (ms) */
const SETTLE = 30;
/** Ask the device who it is (Universal Identity Request). Resolves to the model byte or null. */
export function zxIdentify() {
  return serial(async () => {
    const r = await ask([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7], 'id', 800);
    return r ? r[6] : null;
  });
}
