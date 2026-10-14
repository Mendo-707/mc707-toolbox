import { $, toast } from '../core/dom.js';
import { devOn } from '../core/device.js';
import { S, scheduleSave } from '../core/state.js';
import { songEnd } from '../core/song-model.js';
import { AU, ensureAudio } from './synth.js';
import { REC, TR, startSong, stopAll, stopPlay } from './transport.js';
import { CRC_T } from '../core/crc.js';
import { hooks } from '../core/hooks.js';

/* ---------- audio recording: mix and stems to WAV or MP3 ---------- */
export const AUD = Object.assign(
  {
    mode: 'mc707',
    mixFrom: 'mc707',
    extIn: false,
    source: 'input',
    deviceId: '',
    range: 'song',
    tail: 2,
    trimMs: 0,
    mix: true,
    stems: 'none',
    format: 'wav',
    bits: 16,
    kbps: 192,
    mixPair: 0,
    stemPairs: [1, 2, 3, 4, 5, 6, 7, 8],
    mixDev: '',
    stemDev: '',
    stemTrimMs: 0
  },
  (() => {
    try {
      return JSON.parse(localStorage.getItem('mc707-audio') || '{}') || {};
    } catch (e) {
      return {};
    }
  })()
);
if (AUD.deviceId && !AUD.mixDev) AUD.mixDev = AUD.deviceId;
export const saveAud = () => {
  try {
    localStorage.setItem('mc707-audio', JSON.stringify(AUD));
  } catch (e) {}
};
export const AUDREC = {
  on: false,
  stop: false,
  caps: {},
  pv: { k: 'pv', peaks: [] },
  procs: [],
  perm: 'unknown',
  sinks: [],
  results: [],
  pass: 0,
  jobs: [],
  label: '',
  t0: 0,
  base: '',
  err: '',
  devices: [],
  busy: false
};
const PRE = 0.25;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (cond, every = 50) => {
  while (!cond()) await sleep(every);
};
const crcAdd = (c, u) => {
  for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8);
  return c;
};
export function wavEncoder(sr, bits) {
  const parts = [];
  let frames = 0;
  return {
    push(L, R, a, b) {
      const n = b - a;
      if (bits === 16) {
        const o = new Int16Array(n * 2);
        for (let i = 0; i < n; i++) {
          let x = L[a + i];
          x = x < -1 ? -1 : x > 1 ? 1 : x;
          o[2 * i] = x < 0 ? x * 32768 : x * 32767;
          x = R[a + i];
          x = x < -1 ? -1 : x > 1 ? 1 : x;
          o[2 * i + 1] = x < 0 ? x * 32768 : x * 32767;
        }
        parts.push(new Uint8Array(o.buffer));
      } else {
        const o = new Uint8Array(n * 6);
        let p = 0;
        for (let i = 0; i < n; i++) {
          for (const arr of [L, R]) {
            let x = arr[a + i];
            x = x < -1 ? -1 : x > 1 ? 1 : x;
            const v = Math.round(x < 0 ? x * 8388608 : x * 8388607);
            o[p++] = v & 255;
            o[p++] = (v >> 8) & 255;
            o[p++] = (v >> 16) & 255;
          }
        }
        parts.push(o);
      }
      frames += n;
    },
    finish() {
      const bytes = frames * 2 * (bits / 8);
      const h = new ArrayBuffer(44);
      const dv = new DataView(h);
      const w = (o, s) => {
        for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
      };
      w(0, 'RIFF');
      dv.setUint32(4, 36 + bytes, true);
      w(8, 'WAVE');
      w(12, 'fmt ');
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, 2, true);
      dv.setUint32(24, sr, true);
      dv.setUint32(28, sr * 2 * (bits / 8), true);
      dv.setUint16(32, 2 * (bits / 8), true);
      dv.setUint16(34, bits, true);
      w(36, 'data');
      dv.setUint32(40, bytes, true);
      const hb = new Uint8Array(h);
      let crc = crcAdd(0xffffffff, hb);
      parts.forEach(p => {
        crc = crcAdd(crc, p);
      });
      crc = (crc ^ 0xffffffff) >>> 0;
      return {
        blob: new Blob([hb, ...parts], { type: 'audio/wav' }),
        size: 44 + bytes,
        crc,
        ext: 'wav',
        frames
      };
    }
  };
}
function mp3Encoder(sr, kbps) {
  const e = new lamejs.Mp3Encoder(2, sr, kbps);
  const parts = [];
  let frames = 0;
  const keep = out => {
    if (out && out.length) {
      const u = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) u[i] = out[i];
      parts.push(u);
    }
  };
  return {
    push(L, R, a, b) {
      const n = b - a;
      const l = new Int16Array(n),
        r = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        let x = L[a + i];
        x = x < -1 ? -1 : x > 1 ? 1 : x;
        l[i] = x < 0 ? x * 32768 : x * 32767;
        x = R[a + i];
        x = x < -1 ? -1 : x > 1 ? 1 : x;
        r[i] = x < 0 ? x * 32768 : x * 32767;
      }
      keep(e.encodeBuffer(l, r));
      frames += n;
    },
    finish() {
      keep(e.flush());
      let size = 0,
        crc = 0xffffffff;
      parts.forEach(p => {
        size += p.length;
        crc = crcAdd(crc, p);
      });
      crc = (crc ^ 0xffffffff) >>> 0;
      return { blob: new Blob(parts, { type: 'audio/mpeg' }), size, crc, ext: 'mp3', frames };
    }
  };
}
let LAME_P = null;
function loadLame() {
  if (window.lamejs) return Promise.resolve();
  if (!LAME_P)
    LAME_P = new Promise((res, rej) => {
      const srcs = (window.toolbox && window.toolbox.isApp ? ['node_modules/lamejs/lame.min.js'] : []).concat([
        'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js'
      ]);
      const tryNext = i => {
        if (i >= srcs.length) {
          LAME_P = null;
          rej(new Error('Could not load the MP3 encoder (it needs an internet connection). Use WAV instead.'));
          return;
        }
        const s = document.createElement('script');
        s.src = srcs[i];
        s.onload = () => (window.lamejs ? res() : rej(new Error('The MP3 encoder did not start. Use WAV instead.')));
        s.onerror = () => {
          s.remove();
          tryNext(i + 1);
        };
        document.head.append(s);
      };
      tryNext(0);
    });
  return LAME_P;
}
export function makeZip2(entries) {
  const enc = new TextEncoder();
  const parts = [],
    central = [];
  let offset = 0;
  const d = new Date();
  const dt = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  const tm = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const w16 = (a, n) => a.push(n & 255, (n >> 8) & 255),
    w32 = (a, n) => a.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
  for (const f of entries) {
    const name = enc.encode(f.name);
    const lh = [];
    w32(lh, 0x04034b50);
    w16(lh, 20);
    w16(lh, 0x0800);
    w16(lh, 0);
    w16(lh, tm);
    w16(lh, dt);
    w32(lh, f.crc);
    w32(lh, f.size);
    w32(lh, f.size);
    w16(lh, name.length);
    w16(lh, 0);
    parts.push(new Uint8Array(lh), name, f.blob);
    const ch = [];
    w32(ch, 0x02014b50);
    w16(ch, 20);
    w16(ch, 20);
    w16(ch, 0x0800);
    w16(ch, 0);
    w16(ch, tm);
    w16(ch, dt);
    w32(ch, f.crc);
    w32(ch, f.size);
    w32(ch, f.size);
    w16(ch, name.length);
    w16(ch, 0);
    w16(ch, 0);
    w16(ch, 0);
    w16(ch, 0);
    w32(ch, 0);
    w32(ch, offset);
    central.push(new Uint8Array(ch), name);
    offset += lh.length + name.length + f.size;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = [];
  w32(end, 0x06054b50);
  w16(end, 0);
  w16(end, 0);
  w16(end, entries.length);
  w16(end, entries.length);
  w32(end, csize);
  w32(end, offset);
  w16(end, 0);
  return new Blob([...parts, ...central, new Uint8Array(end)], { type: 'application/zip' });
}
/* ---- input and capture (two independent inputs: mix and stems) ---- */
const capKey = role => (role === 'stem' && (!AUD.stemDev || AUD.stemDev === AUD.mixDev) ? 'mix' : role);
const capDevId = k => (k.startsWith('d:') ? k.slice(2) : k === 'stem' ? AUD.stemDev : AUD.mixDev);
function permMsg(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'Audio input access is blocked. Press “Allow audio inputs” and choose Allow. If you chose Block earlier, click the lock icon in the address bar, set Microphone to Allow and reload. If this page is shown inside another page, open it in its own browser tab or use the Windows app.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError')
    return 'That audio input was not found. Check the cable and power, then press Refresh devices.';
  if (n === 'NotReadableError' || n === 'AbortError')
    return 'The audio input is busy or unavailable. Close other programs that use it (a DAW, another tab) and try again.';
  return (e && e.message) || String(e);
}
export async function capPerm() {
  try {
    const r = await navigator.permissions.query({ name: 'microphone' });
    AUDREC.perm = r.state;
    r.onchange = () => {
      AUDREC.perm = r.state;
      hooks.audRender();
    };
  } catch (e) {}
}
export async function capListDevices(ask) {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices)
      throw new Error('This browser cannot list audio devices.');
    if (ask) {
      let st;
      try {
        st = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        throw new Error(permMsg(e));
      }
      st.getTracks().forEach(t => t.stop());
    }
    await capPerm();
    AUDREC.devices = (await navigator.mediaDevices.enumerateDevices()).filter(
      d => d.kind === 'audioinput' && d.deviceId !== 'communications'
    );
    if (AUDREC.devices.some(d => d.label)) {
      if (!AUD.stemDev) {
        const m = AUDREC.devices.find(d => /MC-?707/i.test(d.label));
        if (m) AUD.stemDev = m.deviceId;
      }
      saveAud();
    }
    AUDREC.err = '';
  } catch (e) {
    AUDREC.err = (e && e.message) || String(e);
  }
}
export async function capOpen(k) {
  capClose(k);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    throw new Error('This browser cannot record audio input.');
  const id = capDevId(k);
  const audio = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 20 }
  };
  if (id) audio.deviceId = { ideal: id };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio });
  } catch (e) {
    throw new Error(permMsg(e));
  }
  let tr = stream.getAudioTracks()[0];
  if (
    (k === 'stem' || k.startsWith('d:') || (audMode() === 'mc707' && AUD.mixFrom !== 'other')) &&
    (tr.getSettings().channelCount || 2) <= 2
  ) {
    /* some drivers only give stereo unless an exact channel count is requested: probe downwards */
    for (const n of [20, 18, 16, 12, 10, 8, 6, 4]) {
      try {
        const s2 = await navigator.mediaDevices.getUserMedia({
          audio: { ...audio, channelCount: { exact: n } }
        });
        if ((s2.getAudioTracks()[0].getSettings().channelCount || 2) > 2) {
          stream.getTracks().forEach(t => t.stop());
          stream = s2;
          tr = s2.getAudioTracks()[0];
          break;
        }
        s2.getTracks().forEach(t => t.stop());
      } catch (e) {}
    }
  }
  const c = {
    k,
    stream,
    ch: Math.max(1, tr.getSettings().channelCount || 2),
    peaks: [],
    max: [],
    label: tr.label || ''
  };
  AUDREC.caps[k] = c;
  return c;
}
function capProcess(e, c) {
  const buf = e.inputBuffer;
  const n = buf.length;
  const chans = [];
  for (let i = 0; i < buf.numberOfChannels; i++) chans.push(buf.getChannelData(i));
  for (let i = 0; i < chans.length; i++) {
    let m = 0;
    const d = chans[i];
    for (let k = 0; k < n; k += 8) {
      const a = d[k] < 0 ? -d[k] : d[k];
      if (a > m) m = a;
    }
    c.peaks[i] = Math.max(m, (c.peaks[i] || 0) * 0.85);
    if (c.max) c.max[i] = Math.max(c.max[i] || 0, m);
  }
  for (const sk of AUDREC.sinks)
    if (sk.cap === c.k) sk.feed(chans[sk.l] || chans[0], chans[sk.r] || chans[sk.l] || chans[0], n);
}
export function capAttachOne(k) {
  if (AUDREC.procs.some(p => p.k === k)) return;
  ensureAudio();
  const ctx = AU.ctx;
  let c, src, n;
  if (k === 'pv') {
    c = AUDREC.pv;
    src = AU.out;
    n = 2;
  } else {
    c = AUDREC.caps[k];
    if (!c) return;
    src = ctx.createMediaStreamSource(c.stream);
    n = c.ch;
  }
  const proc = ctx.createScriptProcessor(4096, n, n);
  proc.channelCount = n;
  proc.channelCountMode = 'explicit';
  proc.channelInterpretation = 'discrete';
  proc.onaudioprocess = e => capProcess(e, c);
  src.connect(proc);
  proc.connect(ctx.destination);
  AUDREC.procs.push({ k, proc, src });
}
function capAttach() {
  capDetach();
  if (AUD.source === 'preview') {
    capAttachOne('pv');
    return;
  }
  new Set(AUDREC.sinks.map(s => s.cap)).forEach(capAttachOne);
}
export function capDetach(k) {
  AUDREC.procs = AUDREC.procs.filter(p => {
    if (k && p.k !== k) return true;
    try {
      p.src.disconnect(p.proc);
    } catch (e) {}
    try {
      p.proc.disconnect();
    } catch (e) {}
    p.proc.onaudioprocess = null;
    return false;
  });
}
function capClose(k) {
  capDetach(k);
  const c = AUDREC.caps[k];
  if (c) {
    c.stream.getTracks().forEach(t => t.stop());
    delete AUDREC.caps[k];
  }
}
export function capCloseAll() {
  capDetach();
  Object.keys(AUDREC.caps).forEach(capClose);
}
/* ---- recording passes ---- */
function mkSink(def, sr) {
  const enc = AUD.format === 'mp3' ? mp3Encoder(sr, AUD.kbps) : wavEncoder(sr, AUD.bits);
  const sk = {
    name: def.name,
    key: def.key,
    track: def.track,
    cap: def.cap,
    l: def.l,
    r: def.r,
    enc,
    skip: Math.max(0, Math.round((PRE + (AUD.trimMs + (def.cap === 'stem' ? AUD.stemTrimMs : 0)) / 1000) * sr)),
    feed(L, R, n) {
      let a = 0;
      if (sk.skip > 0) {
        const d = Math.min(sk.skip, n);
        sk.skip -= d;
        a = d;
        if (a >= n) return;
      }
      enc.push(L, R, a, n);
    }
  };
  return sk;
}
export function playRange() {
  const end = Math.max(1, Math.ceil(songEnd()));
  if (AUD.range === 'loop') return [S.loop.start, S.loop.end * 32];
  if (AUD.range === 'playhead') return [Math.floor(S.cursor), end * 32];
  return [0, end * 32];
}
/* ---- per-track inputs: Windows often lists the MC-707's USB audio as separate stereo inputs
   (Mix, Track 1 … Track 8) instead of one 20-channel input, so each track can pick its own input and channels. ---- */
export const RT_KEYS = ['mix', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 'ext'];
export const rtDefPair = k =>
  k === 'mix' ? 0 : k === 'ext' ? 9 : AUD.stemPairs[+k.slice(1)] >= 0 ? AUD.stemPairs[+k.slice(1)] : +k.slice(1) + 1;
export const rtLabel = k =>
  k === 'mix' ? 'Mix' : k === 'ext' ? 'Ext In' : +k.slice(1) + 1 + '. ' + S.tracks[+k.slice(1)].name;
export function rtGet(k) {
  const r = (AUD.route || {})[k];
  return { dev: (r && r.dev) || '', pair: r && Number.isFinite(r.pair) ? r.pair : rtDefPair(k) };
}
export function rtSet(k, v) {
  AUD.route = AUD.route || {};
  AUD.route[k] = { ...rtGet(k), ...v };
  saveAud();
}
export const rtCap = k => 'd:' + (rtGet(k).dev || AUD.stemDev || '');
export const rtMulti = () => new Set(RT_KEYS.map(rtCap)).size > 1;
export const rtMcDevs = () => AUDREC.devices.filter(d => /MC-?707|MC-?101/i.test(d.label));
export function rtAutoMatch() {
  let n = 0;
  const set = (k, dev) => {
    rtSet(k, { dev, pair: 0 });
    n++;
  };
  for (const d of rtMcDevs()) {
    const L = d.label;
    let m;
    if ((m = /track\s*(\d)/i.exec(L))) set('t' + (+m[1] - 1), d.deviceId);
    else if (/\b(mix|master|main)\b/i.test(L)) set('mix', d.deviceId);
    else if (/\bext/i.test(L)) set('ext', d.deviceId);
    else if ((m = /(\d{1,2})\s*[-–]\s*(\d{1,2})/.exec(L))) {
      const p = (+m[1] - 1) >> 1;
      const k = p === 0 ? 'mix' : p === 9 ? 'ext' : p <= 8 ? 't' + (p - 1) : null;
      if (k) set(k, d.deviceId);
    }
  }
  return n;
}
export function audioJobs() {
  const pv = AUD.source === 'preview';
  const chN = k => {
    const c = AUDREC.caps[k];
    return c ? c.ch : audMode() === 'mc707' && (k === capKey('stem') || k.startsWith('d:')) ? 20 : 2;
  };
  const pairIdx = (k, p) => {
    const N = chN(k);
    return { l: Math.min(p * 2, N - 1), r: Math.min(p * 2 + 1, N - 1) };
  };
  const withClips = S.tracks.map((t, i) => i).filter(i => S.clips.some(c => c.t === i));
  const mixDef = () => {
    if (pv) return { name: 'Mix', key: 'mix', cap: 'pv', l: 0, r: 1 };
    if (audMode() === 'mc707' && AUD.mixFrom !== 'other') {
      const k = rtCap('mix'),
        p = pairIdx(k, rtGet('mix').pair);
      return { name: 'Mix', key: 'mix', cap: k, l: p.l, r: p.r };
    }
    const p = pairIdx('mix', Math.min(AUD.mixPair, Math.max(0, Math.ceil(chN('mix') / 2) - 1)));
    return { name: 'Mix', key: 'mix', cap: 'mix', l: p.l, r: p.r };
  };
  const jobs = [];
  if (AUD.stems === 'channels' && !pv) {
    const sinks = [];
    if (AUD.mix) sinks.push(mixDef());
    S.tracks.forEach((t, i) => {
      if (AUD.stemPairs[i] < 0 || !devOn(i)) return;
      const k = 't' + i,
        cap = rtCap(k),
        pr = rtGet(k).pair;
      if (pr >= Math.ceil(chN(cap) / 2)) return;
      const p = pairIdx(cap, pr);
      sinks.push({ name: t.name, key: k, track: i, cap, l: p.l, r: p.r });
    });
    if (AUD.extIn) {
      const cap = rtCap('ext'),
        pr = rtGet('ext').pair;
      if (pr < Math.ceil(chN(cap) / 2)) {
        const p = pairIdx(cap, pr);
        sinks.push({ name: 'Ext In', key: 'ext', cap, l: p.l, r: p.r });
      }
    }
    if (sinks.length) jobs.push({ label: 'All channels at once', sinks });
  } else {
    if (AUD.mix) jobs.push({ label: 'Full mix', sinks: [mixDef()] });
    if (AUD.stems === 'passes')
      withClips.forEach(i =>
        jobs.push({
          label: 'Stem: ' + S.tracks[i].name,
          solo: i,
          sinks: [{ ...mixDef(), name: S.tracks[i].name, key: 't' + i, track: i }]
        })
      );
  }
  return jobs;
}
async function runPass(job, sr) {
  const sinks = job.sinks.map(d => mkSink(d, sr));
  AUDREC.sinks = sinks;
  capAttach();
  const [startBar, endTick] = playRange();
  if (job.solo != null)
    S.tracks.forEach((t, i) => {
      t.solo = i === job.solo;
      if (i === job.solo) t.mute = false;
    });
  await sleep(PRE * 1000);
  S.loop.on = false;
  S.cursor = startBar;
  startSong({ endTick });
  await waitFor(() => !TR.playing || AUDREC.stop);
  if (TR.playing) stopPlay();
  await sleep(AUDREC.stop ? 350 : Math.round(AUD.tail * 1000));
  capDetach();
  AUDREC.sinks = [];
  for (const sk of sinks) {
    const r = sk.enc.finish();
    AUDREC.results.push({ ...r, key: sk.key, label: sk.name, track: sk.track });
  }
}
export const pad2 = n => String(n).padStart(2, '0');
export function audioFileName(r) {
  const nm =
    String(r.label)
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'track';
  if (r.key === 'ext') return AUDREC.base + '-ext-in.' + r.ext;
  return r.key === 'mix'
    ? AUDREC.base + '-mix.' + r.ext
    : AUDREC.base + '-stem-' + pad2((r.track || 0) + 1) + '-' + nm + '.' + r.ext;
}
export async function audioRecord() {
  if (AUDREC.on || AUDREC.busy) return;
  AUDREC.busy = true;
  AUDREC.err = '';
  hooks.audRender();
  let saved = null;
  try {
    ensureAudio();
    const sr = AU.ctx.sampleRate;
    if (AUD.format === 'mp3') {
      await loadLame();
      if (![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(sr))
        throw new Error('MP3 does not support this device’s ' + sr + ' Hz sample rate. Use WAV instead.');
    }
    if (AUD.source === 'input') {
      const need = new Set(
        audioJobs()
          .flatMap(j => j.sinks.map(x => x.cap))
          .filter(k => k !== 'pv')
      );
      for (const k of need) if (!AUDREC.caps[k]) await capOpen(k);
    }
    const jobs = audioJobs();
    if (!jobs.length) throw new Error('Nothing to record. Turn on the full mix or stems.');
    const [sb, et] = playRange();
    if (et <= sb * 32 || !S.clips.length) throw new Error('There is nothing to play in that range.');
    stopAll();
    if (REC.on) hooks.recStop();
    saved = {
      preview: S.preview,
      metro: S.metro,
      loop: { ...S.loop },
      cursor: S.cursor,
      flags: S.tracks.map(t => ({ mute: t.mute, solo: t.solo }))
    };
    S.metro = false;
    S.preview = AUD.source === 'preview' ? true : false;
    hooks.syncControls();
    const d = new Date();
    AUDREC.base =
      'mc707-song-' +
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      '-' +
      pad2(d.getHours()) +
      pad2(d.getMinutes());
    AUDREC.on = true;
    AUDREC.busy = false;
    AUDREC.stop = false;
    AUDREC.results = [];
    AUDREC.t0 = performance.now();
    AUDREC.jobs = jobs;
    for (let j = 0; j < jobs.length && !AUDREC.stop; j++) {
      AUDREC.pass = j;
      AUDREC.label = jobs[j].label;
      hooks.audRender();
      await runPass(jobs[j], sr);
      for (const [i, f] of saved.flags.entries()) {
        S.tracks[i].mute = f.mute;
        S.tracks[i].solo = f.solo;
      }
    }
  } catch (err) {
    AUDREC.err = (err && err.message) || String(err);
    toast(AUDREC.err);
  } finally {
    AUDREC.on = false;
    AUDREC.busy = false;
    capDetach();
    AUDREC.sinks = [];
    if (TR.playing) stopPlay();
    if (saved) {
      S.preview = saved.preview;
      S.metro = saved.metro;
      S.loop = saved.loop;
      S.cursor = saved.cursor;
      saved.flags.forEach((f, i) => {
        S.tracks[i].mute = f.mute;
        S.tracks[i].solo = f.solo;
      });
    }
    hooks.syncControls();
    hooks.renderArr();
    scheduleSave();
    if ($('#audio').hidden) capCloseAll();
    hooks.audRender();
    hooks.audBtn();
    if (AUDREC.results.length)
      toast(
        'Recorded ' +
          AUDREC.results.length +
          ' file' +
          (AUDREC.results.length > 1 ? 's' : '') +
          '. Open Audio to save them.'
      );
  }
}
export function audioStop() {
  if (AUDREC.on) AUDREC.stop = true;
}
export function quickRec() {
  if (AUDREC.on) {
    audioStop();
    return;
  }
  if (AUD.source === 'input' && !AUD.mixDev && !AUDREC.caps.mix) {
    hooks.openAudio();
    return;
  }
  audioRecord();
}
export function audMode() {
  if (AUD.mode) return AUD.mode;
  return AUD.source === 'preview' ? 'preview' : AUD.stems === 'channels' ? 'mc707' : 'interface';
}
