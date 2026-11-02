// Loop rec: record your own riff into the set. In the Loop rec panel choose the track to record to (or "the
// track I play", whichever the MC-707's keys play first) and how long (1, 2, 4 or 8 bars), then ● Rec: it
// starts on the next bar line (or after a bar's count-in) and records what you play on a keyboard (its solo
// track follows the choice) or the MC-707's own keys while the set carries on. When the bars are up the take
// is kept, and the set is left as it was: ▶ Play puts a take on its track at the next bar, ■ Back brings the
// set's own part back, ★ Keep makes the playing scene keep it, ✕ deletes it. Settings › Loop rec sets the
// timing (16ths, 8ths or as played), the count-in, and whether a take plays straight away.
// A take follows key changes like any part (it is written down in the key it was played in), and chord
// lock and variations leave it as you played it.
//
// Owns: RIFF (the recording and the takes), localStorage 'mc707-live-riffs' (the takes, so scenes that keep
// one still have it) and 'mc707-live-loop-rec' (its settings). Reads: LV, TR, S, CTL.
import { el, toast } from '../core/dom.js';
import { CTL } from './controller.js';
import { S } from '../core/state.js';
import { poolOf } from '../core/tracks.js';
import { FACMAP } from '../library/index.js';
import { TR, tickDur } from '../services/transport.js';
import { LV } from './state.js';
import { lvNow } from './themes.js';
import { lvOn } from './cues.js';
import { liveReplace } from './engine.js';
import { lvSaveScenes } from './scene-editor.js';

const STORE = 'mc707-live-riffs',
  OPTS = 'mc707-live-loop-rec',
  KEEP = 24;
export const RIFF_BARS = [1, 2, 4, 8];
export const RIFF_QUANT = [
  ['16', '16ths'],
  ['8', '8ths'],
  ['off', 'As played']
];
export const RIFF_COUNT = [
  ['bar', 'On the next bar'],
  ['count', 'After a bar’s count-in']
];
/**
 * The recording and its settings: state off, count (counting in), armed (waiting for the bar line) or rec;
 * track (-1: the track you play), bars, quant, count, auto (play a take straight away).
 */
export const RIFF = {
  state: 'off',
  track: -1,
  bars: 2,
  quant: '16',
  count: 'bar',
  auto: false,
  start: 0,
  end: 0,
  t: -1,
  notes: [],
  held: {},
  key: 0,
  mode: 'minor',
  /* plays cued for the next bar: [{t, id, tick}] (id null: the set's own part back) */
  cued: [],
  /* each track's own part before a take took over: {t: id} */
  was: {}
};
try {
  const o = JSON.parse(localStorage.getItem(OPTS) || '{}');
  for (const k of ['track', 'bars', 'quant', 'count', 'auto']) if (k in o) RIFF[k] = o[k];
} catch (e) {}
const saveOpts = () => {
  try {
    localStorage.setItem(
      OPTS,
      JSON.stringify({ track: RIFF.track, bars: RIFF.bars, quant: RIFF.quant, count: RIFF.count, auto: RIFF.auto })
    );
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
const changed = () => listeners.forEach(fn => fn());

/** Settings and the panel's choices: track, bars, quant, count, auto. */
export function riffSet(k, v) {
  RIFF[k] = v;
  saveOpts();
  /* a keyboard plays the track recorded to */
  if (k === 'track' && v >= 0 && LV.ctl) LV.ctl.soloT = v;
  changed();
}

/** ● Rec: arm a recording from the next bar line (or after a count-in), or cancel the one going. */
export function riffArm() {
  if (RIFF.state !== 'off') {
    RIFF.state = 'off';
    changed();
    return void toast('Recording cancelled');
  }
  if (!lvOn()) return void toast('Start the jam first, then record over it');
  const want = RIFF.track,
    solo = LV.ctl ? LV.ctl.soloT : -1;
  /* the track chosen; or a keyboard's solo track; or the first the MC-707's keys play */
  let t = want >= 0 ? want : CTL.inp && solo >= 0 ? solo : -1;
  if (t >= 0 && (!S.tracks[t] || S.tracks[t].type !== 'tone')) t = -1;
  if (t < 0 && !LV.perfOn && !CTL.inp)
    return void toast('Turn on playing the MC-707 yourself (Live › Settings), or connect a keyboard, to record');
  if (t >= 0 && CTL.inp && LV.ctl) LV.ctl.soloT = t;
  const bar = Math.ceil((TR.tick + 4) / 32) * 32,
    start = RIFF.count === 'count' ? bar + 32 : bar;
  Object.assign(RIFF, {
    state: RIFF.count === 'count' ? 'count' : 'armed',
    start,
    end: start + RIFF.bars * 32,
    t,
    notes: [],
    held: {},
    key: LV.key,
    mode: LV.mode === 'major' ? 'major' : 'minor'
  });
  changed();
}
/** A note from the keyboard on its solo track (as it sounds: octave and snap applied). */
export function riffNote(nn, v, on) {
  if (RIFF.state === 'off') return;
  if (RIFF.t < 0 && LV.ctl && on) RIFF.t = LV.ctl.soloT;
  if (LV.ctl && RIFF.t !== LV.ctl.soloT) return;
  riffAt(nn, v, on);
}
/** A note played on the MC-707 itself, on track t: recorded when it is the track recorded to (or the first). */
export function riffKey(t, nn, v, on) {
  if (RIFF.state === 'off' || !S.tracks[t] || S.tracks[t].type !== 'tone') return;
  if (RIFF.t < 0 && on) RIFF.t = t;
  if (RIFF.t === t) riffAt(nn, v, on);
}
/* where a note falls, in 16ths from the start (snapped to the timing chosen) */
function riffAt(nn, v, on) {
  /* where the clock is now, in ticks (the scheduler runs a little ahead of what you hear) */
  const now = TR.tick - (TR.nextTime - lvNow()) / tickDur(),
    q = RIFF.quant === '8' ? 4 : RIFF.quant === 'off' ? 1 : 2,
    steps = RIFF.bars * 16,
    at = (Math.round((now - RIFF.start) / q) * q) / 2;
  if (on) {
    /* a note a touch early for the first beat counts as on it */
    if (at < -q / 2 || at >= steps) return;
    RIFF.held[nn] = { s: Math.max(0, at), v };
  } else {
    const h = RIFF.held[nn];
    if (!h) return;
    delete RIFF.held[nn];
    RIFF.notes.push({ s: h.s, l: Math.max(q / 2, Math.min(steps, at) - h.s), n: nn, v: h.v });
  }
}

/** Every Live tick: counting in, recording, the take at the end, and takes cued for this bar. */
export function riffTick(tick) {
  if (RIFF.state === 'count' && tick >= RIFF.start - 32) {
    RIFF.state = 'armed';
    changed();
  }
  if (RIFF.state === 'armed' && tick >= RIFF.start) {
    RIFF.state = 'rec';
    changed();
  } else if (RIFF.state === 'rec' && tick < RIFF.end && (tick - RIFF.start) % 32 === 0) changed();
  if (RIFF.state === 'rec' && tick >= RIFF.end) riffDone(tick);
  if (RIFF.cued.length && RIFF.cued.some(c => tick >= c.tick)) {
    for (const c of RIFF.cued.filter(c => tick >= c.tick)) put(c.t, c.id, tick);
    RIFF.cued = RIFF.cued.filter(c => tick < c.tick);
    changed();
  }
}
/** True while there is something for riffTick to do. */
export const riffBusy = () => RIFF.state !== 'off' || RIFF.cued.length > 0;

function riffDone(tick) {
  const steps = RIFF.bars * 16,
    t = RIFF.t;
  /* notes still held run to the end */
  for (const nn in RIFF.held) {
    const h = RIFF.held[nn];
    RIFF.notes.push({ s: h.s, l: Math.max(0.5, steps - h.s), n: +nn, v: h.v });
  }
  RIFF.held = {};
  RIFF.state = 'off';
  /* one note per pitch and step */
  const seen = new Set(),
    notes = RIFF.notes
      .filter(x => x.s < steps && !seen.has(x.s + ':' + x.n) && seen.add(x.s + ':' + x.n))
      .sort((a, b) => a.s - b.s || a.n - b.n);
  if (!notes.length || t < 0 || !S.tracks[t]) {
    changed();
    return void toast('Nothing was played, so no take');
  }
  const f = {
    id: 'riff' + Date.now().toString(36),
    name: 'Take ' + (kept.length + 1),
    type: 'tone',
    genre: LV.style,
    bars: RIFF.bars,
    key: { root: RIFF.key, scale: RIFF.mode },
    notes,
    pool: poolOf(t),
    track: t,
    riff: true
  };
  FACMAP.set(f.id, f);
  keep(f);
  /* the track was yours while you played: hand it back (unless a key is still down) */
  if (LV.userPlay && LV.userPlay[t] && !LV.userPlay[t].held) delete LV.userPlay[t];
  if (RIFF.auto) put(t, f.id, tick);
  else toast(`${f.name} recorded on ${S.tracks[t].name}: ▶ Play puts it in the set`);
  LV.ver++;
  changed();
}

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
  if (!f || !lvOn()) return void toast('Start the jam first');
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
/** True when the playing scene keeps this take. */
export const riffKept = id => {
  const f = FACMAP.get(id),
    sc = LV.scenes[LV.cur];
  return !!(f && sc && sc.cells[f.track] && sc.cells[f.track].id === id);
};
/** ✕: delete a take (not one a scene keeps). */
export function riffDelete(id) {
  if (usedIds().has(id)) return void toast('A scene keeps this take: un-keep it first');
  if (Object.values(LV.voices).some(vs => vs[0] && vs[0].f.id === id)) {
    const f = FACMAP.get(id);
    if (f) riffBack(f.track);
  }
  kept = kept.filter(f => f.id !== id);
  storeTakes();
  changed();
}
/** Settings › Loop rec › Delete the takes no scene keeps. */
export function riffDeleteUnused() {
  const used = usedIds(),
    n = kept.length;
  kept = kept.filter(f => used.has(f.id));
  storeTakes();
  changed();
  toast(n - kept.length ? 'Deleted ' + (n - kept.length) + ' takes' : 'No takes to delete');
}

/* ---- the Loop rec panel ---- */
const trackOpts = () => [
  [-1, 'The track I play'],
  ...S.tracks.map((tr, t) => [t, tr.name]).filter(([t]) => S.tracks[t].type === 'tone')
];
const sel = (label, val, opts, on) =>
  el(
    'label',
    { class: 'lvf' },
    label,
    el(
      'select',
      { 'aria-label': label, onchange: e => on(e.target.value) },
      ...opts.map(([v, l]) => el('option', { value: v, selected: String(v) === String(val) }, l))
    )
  );
/** Recording, in a line: what it is doing, with the bar it is on. */
function status() {
  const tn = RIFF.t >= 0 && S.tracks[RIFF.t] ? S.tracks[RIFF.t].name : 'the track you play';
  if (RIFF.state === 'count') return 'Count-in: recording starts in a bar';
  if (RIFF.state === 'armed') return 'Starts on the next bar: play on ' + tn;
  if (RIFF.state === 'rec') {
    const bar = Math.min(RIFF.bars, Math.floor((TR.tick - RIFF.start) / 32) + 1);
    return `Recording ${tn}: bar ${bar} of ${RIFF.bars}`;
  }
  return lvOn() ? 'Ready: recording starts on the next bar' : 'Start the jam, then record over it';
}
/** The Loop rec panel: track, length, ● Rec, and the takes. */
export function riffPanel() {
  const box = el('div', { class: 'riffPanel' });
  const draw = () => {
    if (!document.body.contains(box) && box.isConnected === false && box.childNodes.length) return;
    const rec = el(
      'button',
      {
        type: 'button',
        class: 'btn riffBtn' + (RIFF.state !== 'off' ? ' on' : '') + (RIFF.state === 'rec' ? ' rec' : ''),
        onclick: () => riffArm(),
        title: RIFF.state === 'off' ? 'Record what you play into a take' : 'Cancel the recording'
      },
      RIFF.state === 'off' ? '● Rec' : '■ Cancel'
    );
    const takes = riffTakes().slice(0, 8);
    box.replaceChildren(
      el(
        'div',
        { class: 'riffRow' },
        sel('Record to', RIFF.track, trackOpts(), v => riffSet('track', +v)),
        sel(
          'Length',
          RIFF.bars,
          RIFF_BARS.map(n => [n, n + (n > 1 ? ' bars' : ' bar')]),
          v => riffSet('bars', +v)
        )
      ),
      el('div', { class: 'riffRow' }, rec, el('span', { class: 'hint riffStat' }, status())),
      takes.length
        ? el(
            'ul',
            { class: 'riffTakes', 'aria-label': 'Takes' },
            ...takes.map(f => {
              const t = f.track,
                on = riffPlaying(t) === f.id,
                cued = RIFF.cued.find(c => c.t === t),
                keptHere = riffKept(f.id);
              return el(
                'li',
                { class: on ? 'on' : '' },
                el('b', {}, f.name),
                el(
                  'span',
                  { class: 'hint' },
                  (S.tracks[t] ? S.tracks[t].name : 'Track ' + (t + 1)) +
                    ' · ' +
                    f.bars +
                    (f.bars > 1 ? ' bars' : ' bar')
                ),
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'btn sm' + (on ? ' on' : ''),
                    title: on
                      ? 'The set’s own part back, from the next bar'
                      : 'Play this take on its track from the next bar',
                    onclick: () => (on ? riffBack(t) : riffPlay(f.id))
                  },
                  cued && cued.id === f.id ? 'Next bar…' : cued && on ? 'Next bar…' : on ? '■ Back' : '▶ Play'
                ),
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'btn sm' + (keptHere ? ' on' : ''),
                    title: keptHere ? 'This scene keeps it: click to let it go' : 'This scene keeps it',
                    onclick: () => riffKeep(f.id)
                  },
                  '★'
                ),
                el(
                  'button',
                  { type: 'button', class: 'btn sm', title: 'Delete this take', onclick: () => riffDelete(f.id) },
                  '✕'
                )
              );
            })
          )
        : el('p', { class: 'hint' }, 'Your takes show here. Nothing in the set changes until you press ▶ Play.')
    );
  };
  draw();
  riffOnChange(draw);
  return box;
}
/** Settings › Loop rec: timing, count-in, play straight away, and tidying the takes. */
export function riffSettings() {
  return el(
    'div',
    {},
    el(
      'div',
      { class: 'lvrow' },
      sel('Timing', RIFF.quant, RIFF_QUANT, v => riffSet('quant', v)),
      sel('Recording starts', RIFF.count, RIFF_COUNT, v => riffSet('count', v)),
      el(
        'label',
        { class: 'lvf' },
        el('input', { type: 'checkbox', checked: RIFF.auto, onchange: e => riffSet('auto', e.target.checked) }),
        'Play a take straight away'
      )
    ),
    el(
      'div',
      { class: 'lvrow' },
      el('button', { type: 'button', class: 'btn sm', onclick: riffDeleteUnused }, 'Delete the takes no scene keeps')
    ),
    el(
      'p',
      { class: 'hint' },
      'Timing snaps your notes to 16ths or 8ths, or keeps them as played (to a 32nd). Takes are kept between sessions; a scene that keeps one (★) still has it next time.'
    )
  );
}
