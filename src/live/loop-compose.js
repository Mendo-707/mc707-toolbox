// LoopCompose: start from a beat, play a loop on a track of your choice, and the composer writes the
// rest of the set around it.
//
//   1. Choose      Record to (a melody track) and Length, in the LoopCompose panel, then ● Start.
//   2. The beat    the composer's drums play alone (the jam starts if it is stopped); after a bar, Loop rec
//                  records your loop (its strip and count-down show in the Loop rec panel).
//   3. The set     the key and the chords are found in what you played (library/loop-harmony.js), the
//                  composer writes every other part on them, and your loop goes on its track to stay (a
//                  pinned take, as Loop rec's ▶ Play). Two bars later the whole set comes in; a part that
//                  would crowd your loop sits out. Auto-pilot, swaps and New patterns carry on around it,
//                  all on your chords.
//   4. New loop    choose a track again and record: the set strips back to the drums (and your other loops,
//                  with "Keep my other loops" on) while you play, then a fresh set built around all your
//                  loops comes in, like New patterns. A new loop on a track that has one replaces it.
//   5. End         the loops stay on their tracks (■ Back in Loop rec takes one off); New patterns writes
//                  sets in the style's own chords again.
//
// Owns: LC (the session), LV.lc (the chords the composed set follows, read by live/set-builder.js),
// localStorage 'mc707-live-loopcompose' (its choices). Reads: LV, RIFF, TR, S.
import { el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { FACMAP } from '../library/index.js';
import { lvModeFam } from '../library/pools.js';
import { keyName, loopHarmony } from '../library/loop-harmony.js';
import { TR } from '../services/transport.js';
import { LV, saveLive } from './state.js';
import { lvOn, lvSortCues } from './cues.js';
import { liveStart } from './engine.js';
import { liveBuild } from './set-builder.js';
import { liveRender } from './panels.js';
import { RIFF, riffArm, riffCancel, riffOnChange, riffOnTake, riffPin, riffSet, riffShow, RIFF_BARS } from './riff.js';

const OPTS = 'mc707-live-loopcompose';
/** The session: state 'off' | 'rec' (recording a loop) | 'on'; loops {track: take id}; the chords found. */
export const LC = {
  state: 'off',
  t: -1,
  bars: 4,
  keep: true,
  loops: {},
  names: [],
  key: 0,
  scale: 'minor',
  /* what to go back to: the patterns flavour, auto-pilot, and the state before a recording */
  flavor: null,
  auto: null,
  before: 'off'
};
try {
  const o = JSON.parse(localStorage.getItem(OPTS) || '{}');
  if (o.t != null) LC.t = o.t;
  if (RIFF_BARS.includes(o.bars)) LC.bars = o.bars;
  if (o.keep != null) LC.keep = !!o.keep;
} catch (e) {}
const saveOpts = () => {
  try {
    localStorage.setItem(OPTS, JSON.stringify({ t: LC.t, bars: LC.bars, keep: LC.keep }));
  } catch (e) {}
};
const toneTracks = () => S.tracks.map((tr, t) => [t, tr.name]).filter(([t]) => S.tracks[t].type === 'tone');
const listeners = new Set();
const changed = () => listeners.forEach(fn => fn());
riffOnChange(changed);

/* the drums of the set's fullest groove scene, alone: what you play your loop over */
function beatScene() {
  const drums = sc => Object.keys(sc.cells || {}).filter(t => S.tracks[t] && S.tracks[t].type !== 'tone').length;
  const from = LV.scenes
    .filter(sc => sc.cells && sc.kind !== 'lc')
    .reduce((a, sc) => (!a || drums(sc) > drums(a) ? sc : a), null);
  const cells = {};
  if (from) for (const t in from.cells) if (S.tracks[t] && S.tracks[t].type !== 'tone') cells[t] = from.cells[t];
  LV.scenes = LV.scenes.filter(sc => sc.kind !== 'lc');
  LV.scenes.push({ kind: 'lc', name: 'Your loop', bars: 4, e: 5, cells });
  LV.ver++;
  return LV.scenes.length - 1;
}

/* record on track t: the beat from the next bar (the jam starts if stopped), your loop from the bar after */
function record(t) {
  if (!S.tracks[t] || S.tracks[t].type !== 'tone') return void toast('Choose a melody track to record to');
  if (LC.auto == null) LC.auto = LV.auto;
  LV.auto = false;
  /* your other loops: kept playing over the beat, or taken off */
  for (const u of Object.keys(LC.loops).map(Number))
    if (u === t || !LC.keep) {
      if (LV.pin[u] === LC.loops[u]) {
        if (lvOn()) riffPin(u, null, TR.tick);
        else {
          delete LV.pin[u];
          delete LV.pinUnder[u];
        }
      }
      if (!LC.keep || u === t) delete LC.loops[u];
    }
  const beat = beatScene();
  riffSet('track', t);
  riffSet('bars', LC.bars);
  LC.before = LC.state;
  LC.state = 'rec';
  RIFF.lc = true;
  if (!lvOn()) {
    LV.cur = beat;
    riffArm();
    if (RIFF.state === 'off') return fail();
  } else {
    const bar = Math.ceil((TR.tick + 16) / 32) * 32;
    LV.cues = LV.cues.filter(c => c.type !== 'scene' && c.type !== 'blend' && c.type !== 'blendDrums');
    LV.cues.push({ type: 'scene', idx: beat, tick: bar, hard: true });
    lvSortCues();
    riffArm();
    if (RIFF.state === 'off') return fail();
    /* a bar of the beat alone, then your loop */
    RIFF.start = bar + 32;
    RIFF.end = RIFF.start + LC.bars * 32;
  }
  riffShow();
  changed();
}
/* the recording did not start or was cancelled: back as it was */
function fail() {
  RIFF.lc = false;
  LC.state = LC.before === 'on' ? 'on' : 'off';
  if (LC.auto != null) LV.auto = LC.auto;
  LC.auto = null;
  if (LC.state === 'off') stop();
  changed();
}

/** ● Start: a composed set's beat, and your first loop on track t. */
export function lcStart(t = LC.t) {
  if (RIFF.state !== 'off') return void toast('Loop rec is recording: finish or cancel it first');
  LC.loops = {};
  LC.flavor = LV.flavor;
  LV.flavor = 'composed';
  LV.custom = false;
  LV.lc = null;
  liveBuild();
  record(t);
}
/** ● New loop: record another loop on track t; a fresh set around your loops comes in after it. */
export function lcNewLoop(t = LC.t) {
  if (LC.state === 'off') return lcStart(t);
  if (RIFF.state !== 'off') return void toast('Loop rec is recording: finish or cancel it first');
  record(t);
}
/** ■ End: LoopCompose off. The loops stay on their tracks; New patterns uses the style's chords again. */
export function lcEnd() {
  if (LC.state === 'rec') riffCancel();
  stop();
  toast('LoopCompose ended: your loops stay on their tracks (■ Back in Loop rec takes one off)');
}
function stop() {
  LC.state = 'off';
  LV.lc = null;
  LV.scenes = LV.scenes.filter(sc => sc.kind !== 'lc');
  if (LV.cur >= LV.scenes.length) LV.cur = 0;
  if (LC.flavor) LV.flavor = LC.flavor;
  LC.flavor = null;
  if (LC.auto != null) LV.auto = LC.auto;
  LC.auto = null;
  saveLive();
  LV.ver++;
  changed();
}

/* the take is in: the chords, a set written on them, your loops on their tracks, then the set comes in */
riffOnTake((f, tick) => {
  if (LC.state !== 'rec') return;
  if (!f) return fail();
  const first = LC.before !== 'on';
  LC.loops[f.track] = f.id;
  const loops = Object.entries(LC.loops)
    .map(([t, id]) => ({ t: +t, f: FACMAP.get(id) }))
    .filter(x => x.f);
  const h = loopHarmony(
    loops.map(x => ({
      notes: x.f.notes,
      bars: x.f.bars,
      bass: /bass|acid/.test(x.f.pool || '') || x.f.notes.reduce((a, n) => a + n.n, 0) / x.f.notes.length < 50
    })),
    { key: LV.key, scale: LV.mode === 'major' ? 'major' : 'minor' }
  );
  /* the loops are written down in the key found, so they sound as played */
  for (const x of loops) x.f.key = { root: h.key, scale: h.scale };
  Object.assign(LC, { key: h.key, scale: h.scale, names: h.names });
  LV.key = h.key;
  LV.homeKey = h.key;
  LV.mode = lvModeFam(h.scale);
  /* a new loop brings new patterns everywhere; the first keeps the beat you played over */
  if (!first) LV.seed = Math.floor(Math.random() * 1e6) + 1;
  LV.lc = { prog: h.prog, key: h.key, scale: h.scale, loops: { ...LC.loops } };
  LV.custom = false;
  liveBuild();
  /* (the beat plays on until the set comes in) */
  LV.cur = 0;
  for (const x of loops) if (LV.pin[x.t] !== x.f.id) riffPin(x.t, x.f.id, tick);
  /* two bars of your loop over the beat, then the set: its fullest groove (drums and parts, not yet a peak) */
  const parts = sc => Object.keys(sc.cells || {}).length;
  let into = -1;
  LV.scenes.forEach((sc, i) => {
    if (sc.kind === 'groove' && (into < 0 || parts(sc) > parts(LV.scenes[into]))) into = i;
  });
  if (into < 0) into = 0;
  LV.cues = LV.cues.filter(c => c.type !== 'scene');
  LV.cues.push({ type: 'scene', idx: into, tick: Math.ceil(tick / 32) * 32 + 64 });
  lvSortCues();
  if (LC.auto != null) LV.auto = LC.auto;
  LC.auto = null;
  LC.state = 'on';
  saveLive();
  LV.ver++;
  toast('Your loop: ' + keyName(h.key, h.scale) + ', ' + h.names.join(' – ') + '. The set comes in in two bars');
  liveRender();
  changed();
});

/** The LoopCompose panel (above Loop rec). */
export function lcPanel() {
  const box = el('div', { class: 'lcPanel' });
  const draw = () => {
    if (LC.t < 0 || !S.tracks[LC.t] || S.tracks[LC.t].type !== 'tone') {
      const first = toneTracks()[0];
      LC.t = first ? first[0] : -1;
    }
    const going = LC.state === 'rec';
    const pick = el(
      'select',
      {
        'aria-label': 'LoopCompose track',
        disabled: going,
        onchange: e => {
          LC.t = +e.target.value;
          saveOpts();
        }
      },
      ...toneTracks().map(([t, name]) => el('option', { value: t, selected: t === LC.t }, name))
    );
    const len = el(
      'select',
      {
        'aria-label': 'LoopCompose length',
        disabled: going,
        onchange: e => {
          LC.bars = +e.target.value;
          saveOpts();
        }
      },
      ...RIFF_BARS.map(n => el('option', { value: n, selected: n === LC.bars }, n + (n > 1 ? ' bars' : ' bar')))
    );
    const keep = el('input', {
      type: 'checkbox',
      checked: LC.keep,
      onchange: e => {
        LC.keep = e.target.checked;
        saveOpts();
      }
    });
    const b = (label, fn, title, cls) =>
      el('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ' sm'), title, onclick: fn }, label);
    const loops = Object.entries(LC.loops)
      .map(([t, id]) => [S.tracks[t] && S.tracks[t].name, FACMAP.get(id)])
      .filter(x => x[0] && x[1]);
    const kids = [
      el(
        'p',
        { class: 'lcHelp' },
        'Start from a beat, play a loop on a track, and the composer writes the rest of the set around it.'
      ),
      el(
        'div',
        { class: 'riffRow' },
        el('label', { class: 'lvf' }, 'Record to', pick),
        el('label', { class: 'lvf' }, 'Length', len),
        LC.state !== 'off' ? el('label', { class: 'lvf lcKeep' }, keep, 'Keep my other loops') : null
      ),
      going
        ? el(
            'div',
            { class: 'riffRow' },
            el(
              'span',
              { class: 'lcStat', 'aria-live': 'polite' },
              RIFF.state === 'rec'
                ? '● Recording your loop on ' + S.tracks[LC.t].name + '…'
                : 'The beat, then play your loop from the next bar (the count-down is in Loop rec)'
            ),
            b('Cancel', () => riffCancel(), 'Throw the recording away')
          )
        : el(
            'div',
            { class: 'riffRow' },
            LC.state === 'off'
              ? b('● Start', () => lcStart(LC.t), 'Play a beat and record your loop on the track chosen', 'rec')
              : b(
                  '● New loop',
                  () => lcNewLoop(LC.t),
                  'Record another loop: the set strips back to the drums, then a new set around your loops comes in',
                  'rec'
                ),
            LC.state === 'on' ? b('■ End', lcEnd, 'LoopCompose off (your loops stay on their tracks)') : null
          ),
      LC.state === 'on'
        ? el(
            'div',
            { class: 'lcInfo' },
            el('b', {}, keyName(LC.key, LC.scale) + ': '),
            LC.names.join(' – '),
            ...loops.map(([tn, f]) =>
              el(
                'div',
                { class: 'lcLoop' },
                '↻ ' + f.name + ' on ' + tn + ', ' + f.bars + (f.bars > 1 ? ' bars' : ' bar')
              )
            )
          )
        : null
    ];
    box.replaceChildren(...kids.filter(Boolean));
  };
  listeners.add(() => box.isConnected && draw());
  draw();
  return box;
}
