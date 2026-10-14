import { $, toast } from './dom.js';
import { LANES, SCALES } from './theory.js';
import { MC_PARAMS } from './mc707-params.js';
import { hooks } from './hooks.js';

const DEFAULT_TRACKS = [
  { name: 'Drums 1', type: 'drum' },
  { name: 'Drums 2', type: 'drum' },
  { name: 'Drums 3', type: 'drum' },
  { name: 'Bass', type: 'tone' },
  { name: 'Chords', type: 'tone' },
  { name: 'Pad', type: 'tone' },
  { name: 'Lead', type: 'tone' },
  { name: 'Pluck', type: 'tone' }
];
export const STORE = 'mc707-song-mode-v1';

/* ---------- state ---------- */
export function newState() {
  return {
    v: 1,
    bpm: 120,
    swing: 50,
    bars: 32,
    loop: { on: false, start: 0, end: 8 },
    cursor: 0,
    key: 5,
    scale: 'minor',
    metro: false,
    clock: false,
    preview: true,
    follow: true,
    midiOut: '',
    drumMap: LANES.map(l => l[1]),
    tracks: DEFAULT_TRACKS.map((t, i) => ({ ...t, ch: i + 1, mute: false, solo: false, vol: 100 })),
    patterns: {},
    clips: [],
    markers: [],
    midiOffset: 0,
    transpose: 0,
    snap: 1,
    ctrlCh: 16,
    sendCC: true,
    nextId: 1
  };
}
export let S = newState();
export function replaceState(v) {
  S = v;
}
export const UI = {
  sel: null,
  arm: null,
  libTab: 'fac',
  libType: 'all',
  libGenre: 'all',
  libRole: 'all',
  libStyle: 'all',
  libKey: 'all',
  libBars: 'all',
  libTempo: 'all',
  libSort: 'default',
  libFav: false,
  q: '',
  libLimit: 60,
  prevTrack: -1
};

export function addPattern(type, name, bars, notes, extra = {}) {
  const id = 'p' + S.nextId++;
  S.patterns[id] = { id, name, type, bars, notes: notes.map(n => ({ ...n })), mod: false, ...extra };
  return id;
}

/* ---------- undo / persistence ---------- */
const UNDO = [],
  REDO = [];
const snapState = () => JSON.stringify(S);
export function pushUndo() {
  UNDO.push(snapState());
  if (UNDO.length > 80) UNDO.shift();
  REDO.length = 0;
  updUndo();
}
export function updUndo() {
  $('#bUndo').disabled = !UNDO.length;
  $('#bRedo').disabled = !REDO.length;
}
export function undo() {
  if (!UNDO.length) return;
  REDO.push(snapState());
  S = JSON.parse(UNDO.pop());
  afterReplace();
}
export function redo() {
  if (!REDO.length) return;
  UNDO.push(snapState());
  S = JSON.parse(REDO.pop());
  afterReplace();
}
function afterReplace() {
  ED.selNotes.clear();
  if (!curClip()) UI.sel = null;
  hooks.stopAll();
  hooks.renderAll();
  scheduleSave();
}
export const HOST = window.toolbox || null;
export const PROJ = { name: '', path: '', dirty: false, t: null };
let saveT = 0;
export function scheduleSave() {
  PROJ.dirty = true;
  if (PROJ.t) PROJ.t();
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(S));
      scheduleSave.warned = false;
    } catch (e) {
      if (!scheduleSave.warned) {
        scheduleSave.warned = true;
        toast('Autosave failed: storage is full. Use File > Save to keep your work.');
      }
    }
  }, 400);
}
export function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !Array.isArray(s.tracks) || s.tracks.length !== 8 || !s.patterns || !Array.isArray(s.clips))
      return null;
    return fixState(s);
  } catch (e) {
    return null;
  }
}
export const getClip = id => S.clips.find(c => c.id === id);
export const curClip = () => (UI.sel ? getClip(UI.sel) : null);
export const ED = {
  mode: 'steps',
  snap: 1,
  zoom: 26,
  lo: 36,
  clipboard: null,
  selNotes: new Set(),
  fit: true,
  geom: null,
  drag: null,
  lastDown: null
};

/* ---------- recording, markers, saved songs and extras ---------- */
export function fixState(s) {
  const d = newState();
  const num = (v, lo, hi, def) => {
    v = Number(v);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
  };
  if (!s || typeof s !== 'object') return d;
  s.v = 1;
  s.bpm = num(s.bpm, 40, 240, 120);
  s.swing = num(s.swing, 50, 75, 50);
  s.bars = Math.round(num(s.bars, 8, 512, 32));
  s.cursor = num(s.cursor, 0, 512, 0);
  s.key = Math.round(num(s.key, 0, 11, 5));
  if (!SCALES[s.scale]) s.scale = 'minor';
  s.midiOffset = num(s.midiOffset, -200, 200, 0);
  s.transpose = Math.round(num(s.transpose, -24, 24, 0));
  s.snap = [1, 0.5, 0.25, 0.0625].includes(+s.snap) ? +s.snap : 1;
  s.ctrlCh = Math.round(num(s.ctrlCh, 1, 16, 16));
  s.sendCC = s.sendCC !== false;
  s.metro = !!s.metro;
  s.clock = !!s.clock;
  s.preview = s.preview !== false;
  s.follow = s.follow !== false;
  s.midiOut = typeof s.midiOut === 'string' ? s.midiOut : '';
  s.midiIn = typeof s.midiIn === 'string' ? s.midiIn : '';
  s.markers = (Array.isArray(s.markers) ? s.markers : [])
    .filter(m => m && Number.isFinite(+m.bar))
    .map(m => {
      const o = { bar: Math.max(0, Math.round(+m.bar)), name: String(m.name || 'Section').slice(0, 20) };
      if (Number.isFinite(+m.bpm) && +m.bpm >= 40 && +m.bpm <= 240) o.bpm = Math.round(+m.bpm);
      if (m.scene != null && m.scene !== '' && Number.isInteger(+m.scene) && +m.scene >= 0 && +m.scene <= 127)
        o.scene = +m.scene;
      return o;
    });
  s.clipMarks = (Array.isArray(s.clipMarks) ? s.clipMarks : [])
    .filter(
      m =>
        m &&
        Number.isInteger(+m.t) &&
        +m.t >= 0 &&
        +m.t < 8 &&
        Number.isFinite(+m.bar) &&
        Number.isInteger(+m.k) &&
        +m.k >= -1 &&
        +m.k < 16
    )
    .map(m => ({ t: +m.t, bar: Math.max(0, Math.round(+m.bar)), k: +m.k }));
  const lp = s.loop && typeof s.loop === 'object' ? s.loop : {};
  const ls = Math.max(0, Math.round(num(lp.start, 0, 511, 0) * 16) / 16);
  s.loop = {
    on: !!lp.on,
    start: ls,
    end: Math.max(ls + 0.0625, Math.round(num(lp.end, 0.0625, 512, 8) * 16) / 16)
  };
  s.drumMap =
    Array.isArray(s.drumMap) && s.drumMap.length === 12
      ? s.drumMap.map((n, i) => Math.round(num(n, 0, 127, d.drumMap[i])))
      : d.drumMap;
  s.tracks = d.tracks.map((dt, i) => {
    const t = (s.tracks && s.tracks[i]) || {};
    return {
      name: String(t.name || dt.name).slice(0, 16),
      type: dt.type,
      ch: Math.round(num(t.ch, 1, 16, i + 1)),
      mute: !!t.mute,
      solo: !!t.solo,
      vol: Math.round(num(t.vol, 0, 127, 100)),
      ...(Number.isFinite(+t.nudge) && +t.nudge ? { nudge: +t.nudge } : {}),
      ...(Number.isFinite(+t.hum) && +t.hum ? { hum: +t.hum } : {}),
      ...cleanTrackCC(t.cc)
    };
  });
  const pats = {};
  let maxId = 1;
  if (s.patterns && typeof s.patterns === 'object')
    for (const id in s.patterns) {
      const p = s.patterns[id];
      if (!p || !Array.isArray(p.notes) || (p.type !== 'drum' && p.type !== 'tone')) continue;
      p.id = id;
      p.bars = [1, 2, 4, 8, 16, 32].includes(p.bars)
        ? p.bars
        : Math.min(8, Math.max(1, Math.round(num(p.bars, 1, 8, 1))));
      p.name = String(p.name || 'Pattern').slice(0, 40);
      p.notes = p.notes
        .filter(
          n =>
            n &&
            Number.isFinite(+n.s) &&
            Number.isFinite(+n.l) &&
            Number.isFinite(+n.n) &&
            Number.isFinite(+n.v) &&
            n.l > 0 &&
            n.s >= 0 &&
            n.s < p.bars * 16
        )
        .map(n => ({ s: +n.s, l: +n.l, n: Math.round(+n.n), v: Math.max(1, Math.min(127, Math.round(+n.v))) }));
      if (p.key && !(Number.isFinite(+p.key.root) && SCALES[p.key.scale])) p.key = null;
      pats[id] = p;
      const m = /^p(\d+)$/.exec(id);
      if (m) maxId = Math.max(maxId, +m[1] + 1);
    }
  s.patterns = pats;
  const seen = new Set();
  s.clips = (Array.isArray(s.clips) ? s.clips : [])
    .filter(
      c =>
        c &&
        pats[c.pat] &&
        Number.isInteger(c.t) &&
        c.t >= 0 &&
        c.t < 8 &&
        s.tracks[c.t].type === pats[c.pat].type &&
        Number.isFinite(+c.start) &&
        Number.isFinite(+c.len) &&
        c.start >= 0 &&
        c.len >= 0.0625
    )
    .map(c => {
      let id = typeof c.id === 'string' && !seen.has(c.id) ? c.id : 'c' + maxId++;
      seen.add(id);
      const m = /^c(\d+)$/.exec(id);
      if (m) maxId = Math.max(maxId, +m[1] + 1);
      const o = {
        id,
        t: c.t,
        start: Math.round(+c.start * 16) / 16,
        len: Math.max(0.0625, Math.round(+c.len * 16) / 16),
        off: 0,
        pat: c.pat
      };
      if (Number.isFinite(+c.ll) && +c.ll > 0) o.ll = Math.min(8, Math.max(0.0625, Math.round(+c.ll * 16) / 16));
      {
        const L = o.ll || pats[c.pat].bars;
        o.off = Math.round(((((+c.off || 0) % L) + L) % L) * 16) / 16;
      }
      if (c.mute) o.mute = true;
      if (Number.isFinite(+c.tr) && +c.tr) o.tr = Math.max(-48, Math.min(48, Math.round(+c.tr)));
      if (Number.isFinite(+c.vel) && +c.vel && +c.vel !== 100) o.vel = +c.vel;
      fixClipExtras(c, o);
      return o;
    });
  s.clips.forEach(c => {
    s.bars = Math.min(512, Math.max(s.bars, c.start + c.len));
  });
  s.nextId = Math.max(Math.round(num(s.nextId, 1, 1e9, 1)), maxId + 1);
  return s;
}

function cleanPts(a, maxY) {
  if (!Array.isArray(a)) return null;
  const o = a
    .filter(q => Array.isArray(q) && Number.isFinite(+q[0]) && Number.isFinite(+q[1]))
    .map(q => [Math.min(1, Math.max(0, +q[0])), Math.min(maxY, Math.max(0, +q[1]))])
    .sort((x, y) => x[0] - y[0])
    .slice(0, 200);
  return o;
}
function fixClipExtras(c, o) {
  if (Number.isFinite(+c.fi) && +c.fi > 0) o.fi = Math.min(512, Math.round(+c.fi));
  if (Number.isFinite(+c.fo) && +c.fo > 0) o.fo = Math.min(512, Math.round(+c.fo));
  if (['exp', 'log', 's'].includes(c.fcv)) o.fcv = c.fcv;
  const ve = cleanPts(c.ve, 1.5);
  if (ve && ve.length) o.ve = ve;
  if (c.cc && MC_PARAMS.some(m => m.n === +c.cc.n)) {
    const pts = cleanPts(c.cc.pts, 1);
    if (pts) o.cc = { n: +c.cc.n, pts };
  }
  if (Number.isInteger(+c.pc) && +c.pc >= 0 && +c.pc <= 127 && c.pc !== null && c.pc !== '') o.pc = +c.pc;
}
function cleanTrackCC(cc) {
  if (!cc || typeof cc !== 'object') return {};
  const o = {};
  MC_PARAMS.forEach(m => {
    const v = cc[m.n];
    if (Number.isFinite(+v) && v !== null && v !== '') o[m.n] = Math.max(0, Math.min(127, Math.round(+v)));
  });
  return Object.keys(o).length ? { cc: o } : {};
}
