// Audio input: the audio settings (AUD), opening inputs, per-track routing of the MC-707's USB
// channels, and feeding recorders. Used by Record audio and the sample grabber.
//
// Owns: AUD (audio settings), AUDREC (audio recording).
// Reads: S, AU.
// Calls up the layers through hooks (core/hooks.js).
import { S } from '../core/state.js';
import { AU, ensureAudio } from './synth.js';
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
export const PRE = 0.25;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const waitFor = async (cond, every = 50) => {
  while (!cond()) await sleep(every);
};
/* ---- input and capture (two independent inputs: mix and stems) ---- */
export const capKey = role => (role === 'stem' && (!AUD.stemDev || AUD.stemDev === AUD.mixDev) ? 'mix' : role);
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
export function capAttach() {
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
export function audMode() {
  if (AUD.mode) return AUD.mode;
  return AUD.source === 'preview' ? 'preview' : AUD.stems === 'channels' ? 'mc707' : 'interface';
}
