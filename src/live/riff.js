// Loop your own riff: play a riff on a keyboard (or the MC-707's own keys, in Raven mode) on the solo track,
// and it becomes a part of the set. Record riff arms it; recording starts on the next bar line and runs 1, 2
// or 4 bars while the set plays on; the notes snap to 16ths, and when the bars are up the riff loops on that
// track at once, in place of its part, and the scene keeps it. It follows key changes like any part (it is
// written down in the key it was played in), and chord lock leaves it as you played it.
// Riffs are kept (localStorage 'mc707-live-riffs') so scenes that use them still have them next time.
//
// Owns: RIFF (the recording), localStorage 'mc707-live-riffs'. Reads: LV, TR, S, CTL.
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
  KEEP = 24;
/** The riff being recorded: off, armed (waiting for the bar line) or rec; its bars, start and end ticks. */
export const RIFF = { state: 'off', bars: 2, start: 0, end: 0, t: -1, notes: [], held: {}, key: 0, mode: 'minor' };
export const RIFF_BARS = [1, 2, 4];

/* the riffs kept, back in the library so the scenes that use them find them */
let kept = [];
try {
  kept = JSON.parse(localStorage.getItem(STORE) || '[]').filter(f => f && f.riff && Array.isArray(f.notes));
} catch (e) {}
for (const f of kept) FACMAP.set(f.id, f);
function keep(f) {
  kept.push(f);
  /* the newest, and any a scene still uses */
  const used = new Set(LV.scenes.flatMap(s => Object.values(s.cells || {}).map(c => c && c.id)));
  if (kept.length > KEEP) kept = kept.filter((g, i) => i >= kept.length - KEEP || used.has(g.id));
  try {
    localStorage.setItem(STORE, JSON.stringify(kept));
  } catch (e) {}
}
const listeners = new Set();
/** Call fn when the recording starts, stops or changes (to redraw a button). */
export const riffOnChange = fn => listeners.add(fn);
const changed = () => listeners.forEach(fn => fn());

/** Record riff: arm a recording on the solo track from the next bar line, or cancel the one armed or running. */
export function riffArm() {
  if (RIFF.state !== 'off') {
    RIFF.state = 'off';
    changed();
    return void toast('Riff recording cancelled');
  }
  if (!lvOn()) return void toast('Start the jam first, then record a riff over it');
  /* a keyboard plays its solo track; the MC-707's own keys, whichever track you play first */
  const solo = LV.ctl ? LV.ctl.soloT : -1,
    t = CTL.inp && solo >= 0 && S.tracks[solo] && S.tracks[solo].type === 'tone' ? solo : -1;
  if (t < 0 && !LV.perfOn)
    return void toast('Turn on playing the MC-707 yourself (Live › Settings), or connect a keyboard, to record a riff');
  const start = Math.ceil((TR.tick + 4) / 32) * 32;
  Object.assign(RIFF, {
    state: 'armed',
    start,
    end: start + RIFF.bars * 32,
    t,
    notes: [],
    held: {},
    key: LV.key,
    mode: LV.mode === 'major' ? 'major' : 'minor'
  });
  changed();
  const len = RIFF.bars + ' bar' + (RIFF.bars > 1 ? 's' : '');
  toast(
    t >= 0
      ? `Play your riff on ${S.tracks[t].name}: ${len} from the next bar`
      : `Play your riff on the MC-707, on a melody track: ${len} from the next bar`
  );
}
/** A note played on the MC-707 itself, on track t: recorded when it is the riff's track (the first played). */
export function riffKey(t, nn, v, on) {
  if (RIFF.state === 'off' || !S.tracks[t] || S.tracks[t].type !== 'tone') return;
  if (RIFF.t < 0 && on) RIFF.t = t;
  if (RIFF.t === t) riffNote(nn, v, on);
}

/** A note from the keyboard on the solo track (as it sounds: octave and snap applied). */
export function riffNote(nn, v, on) {
  if (RIFF.state === 'off') return;
  /* where the clock is now, in ticks (the scheduler runs a little ahead of what you hear) */
  const now = TR.tick - (TR.nextTime - lvNow()) / tickDur(),
    steps = RIFF.bars * 16,
    step = Math.round((now - RIFF.start) / 2);
  if (on) {
    /* a note a touch early for the first beat counts as on it */
    if (step < -1 || step >= steps) return;
    RIFF.held[nn] = { s: Math.max(0, step), v };
  } else {
    const h = RIFF.held[nn];
    if (!h) return;
    delete RIFF.held[nn];
    RIFF.notes.push({ s: h.s, l: Math.max(1, Math.min(steps, step) - h.s), n: nn, v: h.v });
  }
}

/** Every Live tick: the recording starts on its bar line, and at its end the riff goes in. */
export function riffTick(tick) {
  if (RIFF.state === 'armed' && tick >= RIFF.start) {
    RIFF.state = 'rec';
    changed();
  }
  if (RIFF.state === 'rec' && tick >= RIFF.end) riffDone(tick);
}
function riffDone(tick) {
  const steps = RIFF.bars * 16,
    t = RIFF.t;
  /* notes still held run to the end */
  for (const nn in RIFF.held) {
    const h = RIFF.held[nn];
    RIFF.notes.push({ s: h.s, l: Math.max(1, steps - h.s), n: +nn, v: h.v });
  }
  RIFF.held = {};
  RIFF.state = 'off';
  changed();
  /* one note per pitch and step */
  const seen = new Set(),
    notes = RIFF.notes
      .filter(x => x.s < steps && !seen.has(x.s + ':' + x.n) && seen.add(x.s + ':' + x.n))
      .sort((a, b) => a.s - b.s || a.n - b.n);
  if (!notes.length || t < 0) return void toast('Nothing was played, so no riff');
  if (!lvOn() || !S.tracks[t]) return;
  const f = {
    id: 'riff' + Date.now().toString(36),
    name: 'Your riff ' + (kept.length + 1),
    type: 'tone',
    genre: LV.style,
    bars: RIFF.bars,
    key: { root: RIFF.key, scale: RIFF.mode },
    notes,
    pool: poolOf(t),
    riff: true
  };
  FACMAP.set(f.id, f);
  liveReplace(t, f.id, tick, 0, 0);
  /* the track was yours while you played: your riff takes it over straight away (unless a key is still down) */
  if (LV.userPlay && LV.userPlay[t] && !LV.userPlay[t].held) delete LV.userPlay[t];
  /* the scene keeps it, so it is there when the scene comes round again */
  const sc = LV.scenes[LV.cur];
  if (sc) {
    sc.cells[t] = { id: f.id, pool: f.pool };
    lvSaveScenes();
  }
  keep(f);
  LV.ver++;
  toast(`${f.name} loops on ${S.tracks[t].name}, and this scene keeps it`);
}

/** Record riff and its length, for the keyboard's bar and More moves (each shows what it is doing). */
export function riffControls() {
  const btn = el('button', { type: 'button', class: 'btn sm riffBtn', onclick: () => riffArm() }),
    bars = el(
      'select',
      {
        class: 'riffBars',
        title: 'How long the riff is',
        'aria-label': 'Riff length',
        onchange: e => (RIFF.bars = +e.target.value)
      },
      ...RIFF_BARS.map(n => el('option', { value: n, selected: n === RIFF.bars }, n + (n > 1 ? ' bars' : ' bar')))
    );
  const show = () => {
    btn.textContent =
      RIFF.state === 'rec' ? '● Recording… (stop)' : RIFF.state === 'armed' ? '● Next bar… (cancel)' : '● Record riff';
    btn.classList.toggle('on', RIFF.state !== 'off');
    btn.classList.toggle('rec', RIFF.state === 'rec');
    btn.title =
      RIFF.state === 'off'
        ? 'Play a riff on the solo track and it loops as that track’s part'
        : 'Cancel the recording (the part stays as it was)';
    bars.disabled = RIFF.state !== 'off';
  };
  show();
  riffOnChange(() => document.body.contains(btn) && show());
  return el('span', { class: 'riffBox' }, btn, bars);
}
