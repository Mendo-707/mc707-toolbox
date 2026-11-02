// Loop rec: record your own riff into the set, and choose when it plays.
//
//   1. Choose      Record to (a melody track, or "the track I play": whichever the MC-707's keys play first),
//                  Length (1, 2, 4 or 8 bars) and Quantize, in the Loop rec panel.
//   2. ● Rec       starts the jam if it is stopped. Recording starts on a bar line: the next one at least two
//                  beats away, or a whole bar later with the count-in on. The panel counts the beats down
//                  (4 3 2 1) and the Now playing box shows REC, so you know when to come in.
//   3. Recording   the track you record to goes quiet (the set's own part stops; Settings can keep it
//                  playing), the strip fills bar by bar with your notes as you play them, and playing on
//                  another track says so. ■ Stop ends it early (the take is the shortest length that holds
//                  what you played); Cancel throws it away.
//   4. The take    the track's own part comes back and nothing else changes: the take waits in a card with
//                  ▶ Play (on its track from the next bar), ↺ Again and ✕ Discard, and joins the takes list.
//                  With "Play a take straight away" on, it plays at once instead.
//   5. Takes       ▶ Play / ■ Back (the set's own part again) from the next bar, ★ the scene keeps it, its own
//                  Quantize (from the notes as you played them), ✕ deletes it. A take follows key changes like
//                  any part (it is written down in the key it was played in); chord lock and variations leave
//                  it as you played it.
//
// Owns: RIFF (the recording and the takes), localStorage 'mc707-live-riffs' (the takes, so scenes that keep
// one still have it) and 'mc707-live-loop-rec' (its settings). Reads: LV, TR, S, CTL.
import { el, toast } from '../core/dom.js';
import { CTL } from './controller.js';
import { S } from '../core/state.js';
import { poolOf } from '../core/tracks.js';
import { FACMAP } from '../library/index.js';
import { touch } from '../core/song-model.js';
import { TR, tickDur } from '../services/transport.js';
import { LV } from './state.js';
import { lvNow } from './themes.js';
import { lvOn } from './cues.js';
import { liveReplace, liveStart } from './engine.js';
import { lvSaveScenes } from './scene-editor.js';

const STORE = 'mc707-live-riffs',
  OPTS = 'mc707-live-loop-rec',
  KEEP = 24;
export const RIFF_BARS = [1, 2, 4, 8];
/** Quantize: the grid a take's notes snap to, in 16ths (0: as played, to a 32nd). */
export const RIFF_QUANT = [
  ['off', 'Off'],
  ['16', '1/16'],
  ['8', '1/8'],
  ['16t', '1/16 triplets'],
  ['8t', '1/8 triplets']
];
const GRID = { off: 0, 16: 1, 8: 2, '16t': 2 / 3, '8t': 4 / 3 };
/**
 * A take's notes snapped to a grid (Quantize), from the notes as played: positions to the nearest step (one
 * landing on the loop's end goes round to its start), lengths to whole steps, one note per pitch and step.
 * @param {{s:number,l:number,n:number,v:number}[]} raw
 * @param {string} q  a RIFF_QUANT value
 * @param {number} bars
 */
export function riffQuantize(raw, q, bars) {
  const g = GRID[q] || 0,
    steps = bars * 16,
    seen = new Set(),
    out = [];
  for (const x of raw) {
    let s = g ? Math.round(x.s / g) * g : x.s;
    if (s >= steps - 1e-6) s -= steps;
    s = Math.round(s * 1e4) / 1e4;
    const l = g ? Math.max(g, Math.round(x.l / g) * g) : x.l,
      k = s + ':' + x.n;
    if (s < 0 || seen.has(k)) continue;
    seen.add(k);
    out.push({ s, l: Math.round(l * 1e4) / 1e4, n: x.n, v: x.v });
  }
  return out.sort((a, b) => a.s - b.s || a.n - b.n);
}
export const RIFF_COUNT = [
  ['bar', 'On the next bar'],
  ['count', 'After a bar’s count-in']
];
/**
 * The recording and its settings: state off, wait (counting in to the start) or rec; track (-1: the track
 * you play), bars, quant, count, auto (play a take straight away), quiet (the track's own part stops while
 * you record).
 */
export const RIFF = {
  state: 'off',
  track: -1,
  bars: 2,
  quant: '16',
  count: 'bar',
  auto: false,
  quiet: true,
  start: 0,
  end: 0,
  t: -1,
  notes: [],
  held: {},
  key: 0,
  mode: 'minor',
  /* a note played on another track while recording (to say so) */
  miss: -1,
  /* the take just recorded, shown in its card until a newer take or Discard */
  last: null,
  /* plays cued for the next bar: [{t, id, tick}] (id null: the set's own part back) */
  cued: [],
  /* each track's own part before a take took over: {t: id} */
  was: {}
};
const SAVED = ['track', 'bars', 'quant', 'count', 'auto', 'quiet'];
try {
  const o = JSON.parse(localStorage.getItem(OPTS) || '{}');
  for (const k of SAVED) if (k in o) RIFF[k] = o[k];
} catch (e) {}
const saveOpts = () => {
  try {
    localStorage.setItem(OPTS, JSON.stringify(Object.fromEntries(SAVED.map(k => [k, RIFF[k]]))));
  } catch (e) {}
};

/* the takes, back in the library so the scenes that keep them find them */
let kept = [];
try {
  kept = JSON.parse(localStorage.getItem(STORE) || '[]').filter(f => f && f.riff && Array.isArray(f.notes));
} catch (e) {}
for (const f of kept) FACMAP.set(f.id, f);
const storeTakes = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(kept));
  } catch (e) {}
};
const usedIds = () => new Set(LV.scenes.flatMap(s => Object.values(s.cells || {}).map(c => c && c.id)));
function keep(f) {
  kept.push(f);
  /* the newest, and any a scene still keeps */
  const used = usedIds();
  if (kept.length > KEEP) kept = kept.filter((g, i) => i >= kept.length - KEEP || used.has(g.id));
  storeTakes();
}
/** The takes, newest first. */
export const riffTakes = () => kept.slice().reverse();

const listeners = new Set();
/** Call fn when the recording or the takes change (to redraw). */
export const riffOnChange = fn => listeners.add(fn);
const changed = () => {
  listeners.forEach(fn => fn());
  animate();
};
const trackName = t => (t >= 0 && S.tracks[t] ? S.tracks[t].name : 'the track you play');
/* where the music you hear is, in ticks (the scheduler runs a little ahead) */
const heard = () => (lvOn() ? TR.tick - Math.max(0, TR.nextTime - lvNow()) / tickDur() : TR.tick);

/** Settings and the panel's choices: track, bars, quant, count, auto, quiet. */
export function riffSet(k, v) {
  RIFF[k] = v;
  saveOpts();
  /* a keyboard plays the track recorded to */
  if (k === 'track' && v >= 0 && LV.ctl) LV.ctl.soloT = v;
  changed();
}

/* ---- recording ---- */
/** ● Rec: record from the next bar line (or after a bar's count-in), starting the jam if it is stopped. */
export function riffArm() {
  if (RIFF.state !== 'off') return riffCancel();
  const want = RIFF.track,
    solo = LV.ctl ? LV.ctl.soloT : -1;
  /* the track chosen; or a keyboard's solo track; or the first the MC-707's keys play */
  let t = want >= 0 ? want : CTL.inp && solo >= 0 ? solo : -1;
  if (t >= 0 && (!S.tracks[t] || S.tracks[t].type !== 'tone')) t = -1;
  if (t < 0 && !LV.perfOn && !CTL.inp)
    return void toast('Turn on playing the MC-707 yourself (Live › Settings), or connect a keyboard, to record');
  if (t >= 0 && CTL.inp && LV.ctl) LV.ctl.soloT = t;
  /* stopped: the jam starts, and a bar plays before recording so you can find the groove */
  const fresh = !lvOn();
  if (fresh) {
    liveStart(LV.cur);
    if (!lvOn()) return;
  }
  /* at least two beats to get ready, a whole bar more with the count-in */
  const bar = fresh ? 32 : Math.ceil((TR.tick + 16) / 32) * 32,
    start = RIFF.count === 'count' && !fresh ? bar + 32 : bar;
  Object.assign(RIFF, {
    state: 'wait',
    from: TR.tick,
    start,
    end: start + RIFF.bars * 32,
    bars: RIFF.bars,
    take: RIFF.bars,
    t,
    notes: [],
    held: {},
    miss: -1,
    key: LV.key,
    mode: LV.mode === 'major' ? 'major' : 'minor'
  });
  changed();
}
/** Cancel: the recording is thrown away and the track plays its own part again. */
export function riffCancel() {
  if (RIFF.state === 'off') return;
  const t = RIFF.t;
  RIFF.state = 'off';
  RIFF.notes = [];
  RIFF.held = {};
  handBack(t);
  changed();
  toast('Recording cancelled');
}
/** The jam stopped: a recording going is cancelled, plays waiting for the next bar are dropped. */
export function riffStopped() {
  if (RIFF.state !== 'off') {
    RIFF.state = 'off';
    RIFF.notes = [];
    RIFF.held = {};
  }
  RIFF.cued = [];
  changed();
}
/** ■ Stop: end the recording now; the take is the shortest length that holds what you played. */
export function riffStopEarly() {
  if (RIFF.state !== 'rec') return riffCancel();
  const played = Math.max(1, Math.ceil((heard() - RIFF.start) / 32)),
    bars = RIFF_BARS.find(b => b >= played) || RIFF.bars;
  riffDone(Math.ceil(TR.tick / 32) * 32, Math.min(bars, RIFF.bars));
}
/** The track being recorded to is quiet while it records (the set's own part stops), unless set otherwise. */
export const riffQuiet = t => RIFF.state === 'rec' && RIFF.quiet && t === RIFF.t;

/** A note from the keyboard on its solo track (as it sounds: octave and snap applied). */
export function riffNote(nn, v, on) {
  if (RIFF.state === 'off') return;
  const solo = LV.ctl ? LV.ctl.soloT : -1;
  if (RIFF.t < 0 && on && solo >= 0) RIFF.t = solo;
  if (RIFF.t !== solo) return void miss(solo, on);
  riffAt(nn, v, on);
}
/** A note played on the MC-707 itself, on track t: recorded when it is the track recorded to (or the first). */
export function riffKey(t, nn, v, on) {
  if (RIFF.state === 'off' || !S.tracks[t] || S.tracks[t].type !== 'tone') return;
  if (RIFF.t < 0 && on) RIFF.t = t;
  if (RIFF.t === t) riffAt(nn, v, on);
  else miss(t, on);
}
/* a note on another track: say so (once per track) */
function miss(t, on) {
  if (!on || RIFF.miss === t) return;
  RIFF.miss = t;
  changed();
}
/* where a note falls, in 16ths from the start, as played (to a 32nd); Quantize snaps it afterwards */
function riffAt(nn, v, on) {
  const steps = RIFF.bars * 16,
    at = Math.round(heard() - RIFF.start) / 2;
  if (on) {
    /* a note a touch early for the first beat counts as on it */
    if (at < -0.5 || at >= steps) return;
    RIFF.held[nn] = { s: Math.max(0, at), v };
  } else {
    const h = RIFF.held[nn];
    if (!h) return;
    delete RIFF.held[nn];
    RIFF.notes.push({ s: h.s, l: Math.max(0.5, Math.min(steps, at) - h.s), n: nn, v: h.v });
  }
  /* shown at once */
  RIFF.dirty = true;
  for (const v of views) v();
}

/** Every Live tick: the start, the end, and takes cued for this bar. */
export function riffTick(tick) {
  if (RIFF.state === 'wait' && tick >= RIFF.start) {
    RIFF.state = 'rec';
    changed();
  }
  if (RIFF.state === 'rec' && tick >= RIFF.end) riffDone(tick, RIFF.bars);
  if (RIFF.cued.length && RIFF.cued.some(c => tick >= c.tick)) {
    for (const c of RIFF.cued.filter(c => tick >= c.tick)) put(c.t, c.id, tick);
    RIFF.cued = RIFF.cued.filter(c => tick < c.tick);
    changed();
  }
}
/** True while there is something for riffTick to do. */
export const riffBusy = () => RIFF.state !== 'off' || RIFF.cued.length > 0;

/* the track was yours while you played: its own part back now (unless a key is still down) */
function handBack(t) {
  if (t >= 0 && LV.userPlay && LV.userPlay[t] && !LV.userPlay[t].held) delete LV.userPlay[t];
  LV.ver++;
}
function riffDone(tick, bars) {
  const steps = bars * 16,
    t = RIFF.t;
  /* notes still held run to the end */
  for (const nn in RIFF.held) {
    const h = RIFF.held[nn];
    RIFF.notes.push({ s: h.s, l: Math.max(0.5, steps - h.s), n: +nn, v: h.v });
  }
  RIFF.held = {};
  RIFF.state = 'off';
  handBack(t);
  /* as played (kept, so Quantize can change later), and snapped to the grid chosen */
  const raw = riffQuantize(
      RIFF.notes.filter(x => x.s < steps).map(x => ({ ...x, l: Math.min(x.l, steps - x.s) })),
      'off',
      bars
    ),
    notes = riffQuantize(raw, RIFF.quant, bars);
  if (!notes.length || t < 0 || !S.tracks[t]) {
    changed();
    return void toast('Nothing was played, so no take: press ● Rec to try again');
  }
  const f = {
    id: 'riff' + Date.now().toString(36),
    name: 'Take ' + (kept.length + 1),
    type: 'tone',
    genre: LV.style,
    bars,
    key: { root: RIFF.key, scale: RIFF.mode },
    notes,
    raw,
    q: RIFF.quant,
    pool: poolOf(t),
    track: t,
    riff: true
  };
  FACMAP.set(f.id, f);
  keep(f);
  RIFF.last = f.id;
  if (RIFF.auto) put(t, f.id, tick);
  changed();
}

/* ---- takes in the set ---- */
/* a take on its track now (remembering the set's own part), or (id null) the set's own part back */
function put(t, id, tick) {
  const top = LV.voices[t] && LV.voices[t][0],
    cur = top ? top.f.id : null;
  if (id) {
    if (!(cur && FACMAP.get(cur) && FACMAP.get(cur).riff)) RIFF.was[t] = cur;
    liveReplace(t, id, tick, 0, 0);
  } else {
    const back = RIFF.was[t];
    delete RIFF.was[t];
    if (back) liveReplace(t, back, tick, 0, 0);
    else LV.voices[t] = [];
  }
  LV.ver++;
}
const nextBar = () => Math.ceil((TR.tick + 2) / 32) * 32;
/** The take playing on track t now, if one is. */
export const riffPlaying = t => {
  const v = LV.voices[t] && LV.voices[t][0];
  return v && v.f.riff ? v.f.id : null;
};
/** ▶ Play: a take on its track from the next bar. */
export function riffPlay(id) {
  const f = FACMAP.get(id);
  if (!f) return;
  if (!lvOn()) return void toast('Start the jam, then ▶ Play the take');
  RIFF.cued = RIFF.cued.filter(c => c.t !== f.track).concat({ t: f.track, id, tick: nextBar() });
  changed();
}
/** ■ Back: the set's own part on track t again, from the next bar. */
export function riffBack(t) {
  if (!lvOn()) return;
  RIFF.cued = RIFF.cued.filter(c => c.t !== t).concat({ t, id: null, tick: nextBar() });
  changed();
}
/** ★ Keep: the playing scene keeps the take on its track (or lets it go again). */
export function riffKeep(id) {
  const f = FACMAP.get(id),
    sc = LV.scenes[LV.cur];
  if (!f || !sc) return;
  const kept = sc.cells[f.track] && sc.cells[f.track].id === id;
  if (kept) {
    const back = RIFF.was[f.track];
    if (back) sc.cells[f.track] = { id: back, pool: f.pool };
    else delete sc.cells[f.track];
  } else sc.cells[f.track] = { id, pool: f.pool };
  lvSaveScenes();
  toast(kept ? 'The scene plays its own part again' : `This scene keeps ${f.name} on ${S.tracks[f.track].name}`);
  changed();
}
/** Quantize a take again (from the notes as played): it changes as it plays, from its next note. */
export function riffRequant(id, q) {
  const f = FACMAP.get(id);
  if (!f) return;
  f.raw = f.raw || f.notes;
  f.q = q;
  f.notes = riffQuantize(f.raw, q, f.bars);
  touch(f);
  storeTakes();
  changed();
}
/** True when the playing scene keeps this take. */
export const riffKept = id => {
  const f = FACMAP.get(id),
    sc = LV.scenes[LV.cur];
  return !!(f && sc && sc.cells[f.track] && sc.cells[f.track].id === id);
};
/** ✕: delete a take (not one a scene keeps). */
export function riffDelete(id) {
  if (usedIds().has(id)) return void toast('A scene keeps this take: un-keep it (★) first');
  const f = FACMAP.get(id);
  if (f && riffPlaying(f.track) === id) riffBack(f.track);
  RIFF.cued = RIFF.cued.filter(c => c.id !== id);
  kept = kept.filter(g => g.id !== id);
  if (RIFF.last === id) RIFF.last = null;
  storeTakes();
  changed();
}
/** Settings › Loop rec › Delete the takes no scene keeps. */
export function riffDeleteUnused() {
  const used = usedIds(),
    n = kept.length;
  kept = kept.filter(f => used.has(f.id));
  if (RIFF.last && !used.has(RIFF.last)) RIFF.last = null;
  storeTakes();
  changed();
  toast(n - kept.length ? 'Deleted ' + (n - kept.length) + ' takes' : 'No takes to delete');
}

/* ---- what you see ---- */
/** A picture of notes: a little piano roll, bars across, pitch up (an SVG). */
function roll(notes, bars, opts = {}) {
  const W = bars * 16,
    ns = notes.length ? notes : [],
    lo = Math.min(...ns.map(n => n.n), 60) - 1,
    hi = Math.max(...ns.map(n => n.n), lo + 12) + 1,
    H = hi - lo;
  const lines = [];
  for (let b = 1; b < bars; b++) lines.push(`<line x1="${b * 16}" y1="0" x2="${b * 16}" y2="${H}" class="rlBar"/>`);
  for (let q = 4; q < W; q += 4) if (q % 16) lines.push(`<line x1="${q}" y1="0" x2="${q}" y2="${H}" class="rlBeat"/>`);
  const rects = ns.map(
    n =>
      `<rect x="${n.s}" y="${hi - n.n - 1}" width="${Math.max(0.35, n.l)}" height="1" rx="0.3" class="rlNote${
        n.open ? ' open' : ''
      }"/>`
  );
  const head =
    opts.at != null
      ? `<rect x="0" y="0" width="${Math.max(0, Math.min(W, opts.at))}" height="${H}" class="rlDone"/>` +
        `<line x1="${opts.at}" y1="0" x2="${opts.at}" y2="${H}" class="rlHead"/>`
      : '';
  const box = el('div', { class: 'riffRoll' + (opts.cls ? ' ' + opts.cls : '') });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${head}${lines.join(
    ''
  )}${rects.join('')}</svg>`;
  return box;
}
/* the notes so far, those still held running up to now */
const liveNotes = at => [
  ...RIFF.notes,
  ...Object.entries(RIFF.held).map(([n, h]) => ({ s: h.s, l: Math.max(0.35, at - h.s), n: +n, open: true }))
];
/** What the recording is doing now: {big, line, cls} for the card and the badge. */
function now() {
  const h = heard(),
    tn = trackName(RIFF.t);
  if (RIFF.state === 'wait') {
    const beats = Math.ceil((RIFF.start - h) / 8);
    return {
      big: beats <= 4 ? String(Math.max(1, beats)) : '…',
      line:
        beats <= 4
          ? 'Get ready: recording ' + tn + ' in ' + beats + (beats > 1 ? ' beats' : ' beat')
          : 'Count-in: recording ' + tn + ' starts in a bar',
      badge: 'REC in ' + Math.max(1, Math.min(beats, 99)),
      cls: 'wait'
    };
  }
  if (RIFF.state === 'rec') {
    const bar = Math.min(RIFF.bars, Math.floor((h - RIFF.start) / 32) + 1);
    return {
      big: '●',
      line: 'Recording ' + tn + ': bar ' + Math.max(1, bar) + ' of ' + RIFF.bars,
      badge: '● REC ' + (RIFF.t >= 0 ? S.tracks[RIFF.t].name + ' ' : '') + Math.max(1, bar) + '/' + RIFF.bars,
      cls: 'rec'
    };
  }
  return null;
}

/* the moving parts (count-down, playhead, notes, badge), each animation frame while something moves */
let raf = 0;
const views = new Set();
function animate() {
  if (raf || typeof requestAnimationFrame !== 'function') return;
  raf = requestAnimationFrame(frame);
}
function frame() {
  raf = 0;
  for (const v of views) v();
  badge();
  if (RIFF.state !== 'off' || RIFF.cued.length || takesPlaying()) animate();
}
const takesPlaying = () => lvOn() && kept.some(f => riffPlaying(f.track) === f.id);
/** The REC badge in the Now playing box (live/ui.js makes #lvRecBadge): click it for the panel. */
function badge() {
  const b = document.getElementById('lvRecBadge');
  if (!b) return;
  const n = now();
  b.hidden = !n;
  if (!n) return;
  b.textContent = n.badge;
  b.className = 'lvRecBadge ' + n.cls;
}
/** Open the Loop rec panel and bring it into view (the badge's click). */
export function riffShow() {
  const d = document.getElementById('lvF-looprec');
  if (!d) return;
  d.open = true;
  d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

const trackOpts = () => [
  [-1, 'The track I play'],
  ...S.tracks.map((tr, t) => [t, tr.name]).filter(([t]) => S.tracks[t].type === 'tone')
];
const sel = (label, val, opts, on, disabled) =>
  el(
    'label',
    { class: 'lvf' },
    label,
    el(
      'select',
      { 'aria-label': label, disabled: !!disabled, onchange: e => on(e.target.value) },
      ...opts.map(([v, l]) => el('option', { value: v, selected: String(v) === String(val) }, l))
    )
  );
const btn = (label, fn, title, cls) =>
  el('button', { type: 'button', class: 'btn sm' + (cls ? ' ' + cls : ''), title: title || '', onclick: fn }, label);
const bars = n => n + (n > 1 ? ' bars' : ' bar');

/** The Loop rec panel: choices, ● Rec, the recording as it happens, the take just made, and the takes. */
export function riffPanel() {
  const box = el('div', { class: 'riffPanel' });
  let card = null,
    strip = null,
    fill = null,
    status = null,
    big = null;
  /* the parts that move, redrawn each frame while recording */
  const tick = () => {
    if (!box.isConnected || !strip) return;
    const n = now();
    if (!n) return;
    const h = heard(),
      at = (h - RIFF.start) / 2;
    big.textContent = n.big;
    status.textContent = n.line;
    card.className = 'riffCard ' + n.cls;
    if (n.cls === 'wait') {
      /* the count-down fills towards the start */
      const span = Math.max(1, RIFF.start - RIFF.from);
      fill.style.width = Math.min(100, Math.max(0, ((h - RIFF.from) / span) * 100)) + '%';
    } else fill.style.width = '100%';
    if (RIFF.state === 'rec' || RIFF.dirty) {
      RIFF.dirty = false;
      strip.replaceChildren(roll(liveNotes(Math.max(0, at)), RIFF.bars, { at: RIFF.state === 'rec' ? at : null }));
    }
  };
  views.add(tick);
  const draw = () => {
    const going = RIFF.state !== 'off';
    const head = el(
      'div',
      { class: 'riffRow' },
      sel('Record to', RIFF.track, trackOpts(), v => riffSet('track', +v), going),
      sel(
        'Length',
        RIFF.bars,
        RIFF_BARS.map(n => [n, bars(n)]),
        v => riffSet('bars', +v),
        going
      ),
      sel('Quantize', RIFF.quant, RIFF_QUANT, v => riffSet('quant', v), going)
    );
    /* idle: ● Rec and where it will listen; going: the count-down or the recording; done: the take */
    card = strip = fill = status = big = null;
    let main;
    if (going) {
      big = el('b', { class: 'riffBig', 'aria-live': 'polite' });
      status = el('span', { class: 'riffStat', 'aria-live': 'polite' });
      fill = el('i');
      strip = el('div', { class: 'riffStrip' });
      card = el(
        'div',
        { class: 'riffCard' },
        el('div', { class: 'riffTop' }, big, status),
        el('div', { class: 'riffCount' }, fill),
        strip,
        RIFF.miss >= 0
          ? el(
              'p',
              { class: 'riffWarn' },
              `You played on ${S.tracks[RIFF.miss].name}, but this records ${trackName(RIFF.t)}: select ${trackName(
                RIFF.t
              )} on the MC-707 (or record to "The track I play").`
            )
          : null,
        el(
          'div',
          { class: 'riffRow' },
          RIFF.state === 'rec'
            ? btn('■ Stop', riffStopEarly, 'End the recording now and keep what you played', 'on')
            : null,
          btn('Cancel', riffCancel, 'Throw this recording away')
        )
      );
      main = card;
    } else {
      const last = RIFF.last && FACMAP.get(RIFF.last);
      const rec = el(
        'button',
        {
          type: 'button',
          class: 'btn riffBtn',
          title: lvOn() ? 'Record from the next bar' : 'Start the jam and record after a bar',
          onclick: () => riffArm()
        },
        '● Rec'
      );
      main = el(
        'div',
        {},
        el(
          'div',
          { class: 'riffRow' },
          rec,
          el(
            'span',
            { class: 'hint riffStat' },
            (lvOn() ? 'Records from the next bar. ' : 'Starts the jam, then records after a bar. ') +
              (RIFF.track >= 0
                ? `Play ${trackName(RIFF.track)} on a keyboard, or on the MC-707 with ${trackName(RIFF.track)} selected.`
                : 'Play any melody track on the MC-707, or a keyboard.')
          )
        ),
        last
          ? el(
              'div',
              { class: 'riffCard done' },
              el(
                'div',
                { class: 'riffTop' },
                el('b', { class: 'riffBig' }, '✓'),
                el(
                  'span',
                  { class: 'riffStat' },
                  `${last.name} is ready: ${last.notes.length} notes on ${trackName(last.track)}, ${bars(last.bars)}. ` +
                    (riffPlaying(last.track) === last.id ? 'Playing in the set.' : 'The set is unchanged.')
                )
              ),
              roll(last.notes, last.bars),
              el(
                'div',
                { class: 'riffRow' },
                takeBtn(last),
                btn('↺ Again', () => riffArm(), 'Record it again (this take stays in the list)'),
                btn('✕ Discard', () => riffDelete(last.id), 'Throw this take away')
              )
            )
          : null
      );
    }
    const takes = riffTakes().slice(0, 8);
    box.replaceChildren(
      head,
      main,
      el('h4', { class: 'riffH' }, 'Takes'),
      takes.length
        ? el(
            'ul',
            { class: 'riffTakes', 'aria-label': 'Takes' },
            ...takes.map(f => {
              const on = riffPlaying(f.track) === f.id,
                keptHere = riffKept(f.id);
              return el(
                'li',
                { class: (on ? 'on' : '') + (f.id === RIFF.last ? ' last' : '') },
                el(
                  'div',
                  { class: 'riffName' },
                  el('b', {}, f.name),
                  el('span', { class: 'hint' }, trackName(f.track) + ' · ' + bars(f.bars) + (on ? ' · playing' : ''))
                ),
                roll(f.notes, f.bars, { cls: 'mini' }),
                el(
                  'div',
                  { class: 'riffActs' },
                  el(
                    'select',
                    {
                      class: 'riffQ',
                      'aria-label': 'Quantize ' + f.name,
                      title: 'Quantize this take (from the notes as you played them)',
                      onchange: e => riffRequant(f.id, e.target.value)
                    },
                    ...RIFF_QUANT.map(([v, l]) =>
                      el('option', { value: v, selected: v === (f.q || 'off') }, l.replace(' triplets', 'T'))
                    )
                  ),
                  takeBtn(f),
                  btn(
                    '★',
                    () => riffKeep(f.id),
                    keptHere ? 'This scene keeps it: click to let it go' : 'This scene keeps it',
                    keptHere ? 'on' : ''
                  ),
                  btn('✕', () => riffDelete(f.id), 'Delete this take')
                )
              );
            })
          )
        : el('p', { class: 'hint' }, 'No takes yet. Nothing in the set changes until you ▶ Play a take.')
    );
    tick();
  };
  draw();
  riffOnChange(draw);
  return box;
}
/* ▶ Play / ■ Back for a take, or what it is waiting for */
function takeBtn(f) {
  const on = riffPlaying(f.track) === f.id,
    cued = RIFF.cued.find(c => c.t === f.track && (c.id === f.id || (on && c.id === null)));
  if (cued) return btn('Next bar…', () => {}, 'It changes on the next bar', 'wait');
  return on
    ? btn('■ Back', () => riffBack(f.track), 'The set’s own part again, from the next bar', 'on')
    : btn('▶ Play', () => riffPlay(f.id), 'Play this take on ' + trackName(f.track) + ' from the next bar');
}
/** Settings › Loop rec: count-in, the track while recording, play straight away, and tidying the takes. */
export function riffSettings() {
  const check = (label, k, title) =>
    el(
      'label',
      { class: 'lvf', title: title || '' },
      el('input', { type: 'checkbox', checked: !!RIFF[k], onchange: e => riffSet(k, e.target.checked) }),
      label
    );
  return el(
    'div',
    {},
    el(
      'div',
      { class: 'lvrow' },
      sel('Recording starts', RIFF.count, RIFF_COUNT, v => riffSet('count', v)),
      check(
        'Quiet the track while recording',
        'quiet',
        'The set’s own part on the track you record to stops while you record'
      ),
      check('Play a take straight away', 'auto', 'Otherwise a take waits until you press ▶ Play')
    ),
    el(
      'div',
      { class: 'lvrow' },
      el('button', { type: 'button', class: 'btn sm', onclick: riffDeleteUnused }, 'Delete the takes no scene keeps')
    ),
    el(
      'p',
      { class: 'hint' },
      'Recording always starts on a bar line at least two beats away (a whole bar more with the count-in); from a stopped jam it starts the jam and records after one bar. Takes are kept between sessions; a scene that keeps one (★) still has it next time.'
    )
  );
}
