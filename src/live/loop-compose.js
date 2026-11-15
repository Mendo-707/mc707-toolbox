// LoopCompose: play a loop, and the composer writes the rest of the set around it. It is one of the things
// Loop rec can do with a take, so the two share one panel (loopPanel here, built on riff.js's riffPanel).
//
//   1. Choose      in the Loop rec panel: Record to, Length and Quantize, then When the take is in:
//                  "Wait for ▶ Play" and "Play it straight away" are Loop rec as it was; "Compose a set
//                  around it" is LoopCompose, with its own choices: Record over (the beat alone, or the set
//                  as it plays), Key (found in the loop, or the set's kept), The set comes in (straight
//                  away, after 2 or 4 bars) and Keep my other loops.
//   2. ● Rec       over the beat alone: the composer's drums play by themselves (the jam starts if it is
//                  stopped) and your loop records after a bar of them. Over the set: Loop rec records as
//                  usual, on the next bar or after the count-in.
//   3. The set     the key and the chords are found in what you played (library/loop-harmony.js), the
//                  composer writes every other part on them, and your loop goes on its track to stay (a
//                  pinned take, as ▶ Play). Then the whole set comes in; a part that would crowd your loop
//                  sits out. Auto-pilot, swaps and New patterns carry on around it, all on your chords.
//   4. ● New loop  record another: a fresh set built around all your loops comes in, like New patterns. A
//                  new loop on a track that has one replaces it; ✕ takes a loop out of the set.
//   5. A take      ✎ Compose around it, on any take's card, does the same with a take you already have.
//   6. ■ End       the loops stay on their tracks (■ Back takes one off); New patterns writes sets in the
//                  style's own chords again.
//
// Owns: LC (the session and its choices), LV.lc (the chords the composed set follows, read by
// live/set-builder.js), localStorage 'mc707-live-loopcompose' (the choices). Reads: LV, RIFF, TR, S.
import { el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { FACMAP } from '../library/index.js';
import { lvModeFam } from '../library/pools.js';
import { keyName, loopHarmony } from '../library/loop-harmony.js';
import { TR } from '../services/transport.js';
import { LV, saveLive } from './state.js';
import { lvOn, lvSortCues } from './cues.js';
import { liveBuild } from './set-builder.js';
import { liveRender } from './panels.js';
import { RIFF, riffArm, riffCancel, riffOnTake, riffPanel, riffPin, riffSet, RIFF_COUNT } from './riff.js';

const OPTS = 'mc707-live-loopcompose';
/**
 * The session and its choices. state 'off' | 'rec' (recording a loop) | 'on'; loops {track: take id}; the
 * chords found. mode 'keep' (a plain take) | 'compose'; over 'beat' | 'set'; keyFrom 'loop' | 'set'; wait:
 * bars before the set comes in; keep: your other loops stay.
 */
export const LC = {
  state: 'off',
  mode: 'keep',
  over: 'beat',
  keyFrom: 'loop',
  wait: 2,
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
const SAVED = {
  mode: ['keep', 'compose'],
  over: ['beat', 'set'],
  keyFrom: ['loop', 'set'],
  wait: [0, 2, 4],
  keep: [true, false]
};
try {
  const o = JSON.parse(localStorage.getItem(OPTS) || '{}');
  for (const k in SAVED) if (SAVED[k].includes(o[k])) LC[k] = o[k];
} catch (e) {}
const saveOpts = () => {
  try {
    localStorage.setItem(OPTS, JSON.stringify(Object.fromEntries(Object.keys(SAVED).map(k => [k, LC[k]]))));
  } catch (e) {}
};
const listeners = new Set();
const changed = () => listeners.forEach(fn => fn());
const setOpt = (k, v) => {
  LC[k] = v;
  saveOpts();
  changed();
};

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

/* record a loop on the track chosen (-1: the track you play). Over the beat alone: the beat from the next
   bar (the jam starts if stopped) and your loop from the bar after. Over the set: as Loop rec records. */
function record() {
  const t = RIFF.track;
  if (t >= 0 && (!S.tracks[t] || S.tracks[t].type !== 'tone')) return void toast('Choose a melody track to record to');
  const alone = LC.over === 'beat' || !lvOn();
  if (alone) {
    if (LC.auto == null) LC.auto = LV.auto;
    LV.auto = false;
  }
  /* your other loops: kept playing while you record, or taken off */
  for (const u of Object.keys(LC.loops).map(Number))
    if (u === t || !LC.keep) {
      if (LV.pin[u] === LC.loops[u]) {
        if (lvOn()) riffPin(u, null, TR.tick);
        else {
          delete LV.pin[u];
          delete LV.pinUnder[u];
        }
      }
      delete LC.loops[u];
    }
  LC.before = LC.state;
  LC.state = 'rec';
  RIFF.lc = true;
  if (!lvOn()) {
    LV.cur = beatScene();
    riffArm();
    if (RIFF.state === 'off') return fail();
  } else if (alone) {
    const beat = beatScene(),
      bar = Math.ceil((TR.tick + 16) / 32) * 32;
    LV.cues = LV.cues.filter(c => c.type !== 'scene' && c.type !== 'blend' && c.type !== 'blendDrums');
    LV.cues.push({ type: 'scene', idx: beat, tick: bar, hard: true });
    lvSortCues();
    riffArm();
    if (RIFF.state === 'off') return fail();
    /* a bar of the beat alone, then your loop */
    RIFF.start = bar + 32;
    RIFF.end = RIFF.start + RIFF.bars * 32;
  } else {
    riffArm();
    if (RIFF.state === 'off') return fail();
  }
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

/* a session begins: composed sets from here on (the flavour comes back at ■ End) */
function begin() {
  LC.loops = {};
  LC.flavor = LV.flavor;
  LV.flavor = 'composed';
  LV.custom = false;
  LV.lc = null;
}
/** ● Rec with "Compose a set around it": the first loop of a session, or another one. */
export function lcRec() {
  if (RIFF.state !== 'off') return void toast('Loop rec is recording: finish or cancel it first');
  if (LC.state === 'off') {
    begin();
    liveBuild();
  }
  record();
}
/** ✎ Compose around it: a set written around a take you already have (with your other loops, if kept). */
export function lcAround(id) {
  const f = FACMAP.get(id);
  if (!f) return;
  if (RIFF.state !== 'off') return void toast('Loop rec is recording: finish or cancel it first');
  if (!lvOn()) return void toast('Start the jam, then compose around the take');
  const first = LC.state === 'off';
  if (first) begin();
  else if (!LC.keep) for (const u of Object.keys(LC.loops).map(Number)) if (u !== f.track) drop(u);
  LC.loops[f.track] = id;
  compose(TR.tick, first);
}
/* a loop out of the session and off its track */
function drop(t) {
  if (LV.pin[t] === LC.loops[t] && lvOn()) riffPin(t, null, TR.tick);
  delete LC.loops[t];
}
/** ✕ on a loop: out of the set, which is written again around the loops left (none left ends it). */
export function lcDrop(t) {
  if (LC.state !== 'on' || !(t in LC.loops)) return;
  drop(t);
  if (!Object.keys(LC.loops).length) return lcEnd();
  if (lvOn()) compose(TR.tick, false);
  else changed();
}
/** ■ End: LoopCompose off. The loops stay on their tracks; New patterns uses the style's chords again. */
export function lcEnd() {
  if (LC.state === 'rec') riffCancel();
  stop();
  toast('LoopCompose ended: your loops stay on their tracks (■ Back takes one off)');
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

/* a loop was recorded for the session */
riffOnTake((f, tick) => {
  if (LC.state !== 'rec') return;
  if (!f) return fail();
  LC.loops[f.track] = f.id;
  compose(tick, LC.before !== 'on');
});
/* The chords of your loops, a set written on them, the loops on their tracks, then the set comes in.
   first: the session's first set keeps the beat you played over; a later one brings new patterns. */
function compose(tick, first) {
  const loops = Object.entries(LC.loops)
    .map(([t, id]) => ({ t: +t, f: FACMAP.get(id) }))
    .filter(x => x.f);
  if (!loops.length) return fail();
  const h = loopHarmony(
    loops.map(x => ({
      notes: x.f.notes,
      bars: x.f.bars,
      bass: /bass|acid/.test(x.f.pool || '') || x.f.notes.reduce((a, n) => a + n.n, 0) / x.f.notes.length < 50
    })),
    { key: LV.key, scale: LV.mode === 'major' ? 'major' : 'minor', fixed: LC.keyFrom === 'set' }
  );
  /* the loops are written down in the key found, so they sound as played */
  for (const x of loops) x.f.key = { root: h.key, scale: h.scale };
  Object.assign(LC, { key: h.key, scale: h.scale, names: h.names });
  LV.key = h.key;
  LV.homeKey = h.key;
  LV.mode = lvModeFam(h.scale);
  if (!first) LV.seed = Math.floor(Math.random() * 1e6) + 1;
  LV.lc = { prog: h.prog, key: h.key, scale: h.scale, loops: { ...LC.loops } };
  LV.custom = false;
  liveBuild();
  /* (what plays now plays on until the set comes in) */
  LV.cur = 0;
  for (const x of loops) if (LV.pin[x.t] !== x.f.id) riffPin(x.t, x.f.id, tick);
  /* your loop over the beat for a moment, then the set: its fullest groove (drums and parts, not yet a peak) */
  const parts = sc => Object.keys(sc.cells || {}).length;
  let into = -1;
  LV.scenes.forEach((sc, i) => {
    if (sc.kind === 'groove' && (into < 0 || parts(sc) > parts(LV.scenes[into]))) into = i;
  });
  if (into < 0) into = 0;
  LV.cues = LV.cues.filter(c => c.type !== 'scene');
  LV.cues.push({ type: 'scene', idx: into, tick: Math.ceil(tick / 32) * 32 + LC.wait * 32 });
  lvSortCues();
  if (LC.auto != null) LV.auto = LC.auto;
  LC.auto = null;
  LC.state = 'on';
  saveLive();
  LV.ver++;
  toast(
    'Your loop: ' +
      keyName(h.key, h.scale) +
      ', ' +
      h.names.join(' – ') +
      '. The set comes in ' +
      (LC.wait ? 'in ' + LC.wait + ' bars' : 'on the next bar')
  );
  liveRender();
  changed();
}

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
/** The Loop rec panel, LoopCompose in it: what happens to a take, its choices, and the set it wrote. */
export function loopPanel() {
  const compose1 = () => LC.mode === 'compose';
  return riffPanel({
    listen: fn => listeners.add(fn),
    options: going => {
      const beat = compose1() && LC.over === 'beat';
      const rows = [
        el(
          'div',
          { class: 'riffRow' },
          sel(
            'When the take is in',
            compose1() ? 'compose' : RIFF.auto ? 'play' : 'wait',
            [
              ['wait', 'Wait for ▶ Play'],
              ['play', 'Play it straight away'],
              ['compose', 'Compose a set around it']
            ],
            v => {
              if (v !== 'compose') riffSet('auto', v === 'play');
              setOpt('mode', v === 'compose' ? 'compose' : 'keep');
            },
            going
          ),
          sel(
            'Recording starts',
            beat ? 'beat' : RIFF.count,
            beat ? [['beat', 'After a bar of the beat']] : RIFF_COUNT,
            v => riffSet('count', v),
            going || beat
          )
        )
      ];
      if (compose1())
        rows.push(
          el(
            'div',
            { class: 'riffRow lcOpts' },
            sel(
              'Record over',
              LC.over,
              [
                ['beat', 'The beat alone'],
                ['set', 'The set as it plays']
              ],
              v => setOpt('over', v),
              going
            ),
            sel(
              'Key',
              LC.keyFrom,
              [
                ['loop', 'Found in my loop'],
                ['set', 'The set’s key']
              ],
              v => setOpt('keyFrom', v),
              going
            ),
            sel(
              'The set comes in',
              LC.wait,
              [
                [0, 'On the next bar'],
                [2, 'After 2 bars'],
                [4, 'After 4 bars']
              ],
              v => setOpt('wait', +v),
              going
            ),
            el(
              'label',
              {
                class: 'lvf lcKeep',
                title: 'Loops you recorded before stay on their tracks, and the set is written around all of them'
              },
              el('input', { type: 'checkbox', checked: LC.keep, onchange: e => setOpt('keep', e.target.checked) }),
              'Keep my other loops'
            )
          )
        );
      return rows;
    },
    rec: () =>
      compose1()
        ? {
            label: LC.state === 'on' ? '● New loop' : '● Rec',
            title:
              LC.state === 'on'
                ? 'Record another loop: a new set around your loops comes in after it'
                : 'Record a loop: the composer writes the rest of the set around it',
            fn: lcRec,
            hint:
              (LC.over === 'beat' || !lvOn()
                ? 'The beat plays alone and your loop records after a bar of it; '
                : 'Your loop records over the set; ') + 'then the composer writes the set around it. '
          }
        : null,
    takeActs: f => [
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm',
          title: 'The composer writes a set around this take: its key and chords, every other part on them',
          onclick: () => lcAround(f.id)
        },
        '✎ Compose around it'
      )
    ],
    info: () => {
      if (LC.state !== 'on') return null;
      const loops = Object.entries(LC.loops)
        .map(([t, id]) => [+t, S.tracks[t] && S.tracks[t].name, FACMAP.get(id)])
        .filter(x => x[1] && x[2]);
      return el(
        'div',
        { class: 'lcInfo' },
        el(
          'div',
          { class: 'lcHead' },
          el(
            'span',
            {},
            el('b', {}, 'Composed around your loops · ' + keyName(LC.key, LC.scale) + ': '),
            LC.names.join(' – ')
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              title: 'LoopCompose off (your loops stay on their tracks)',
              onclick: lcEnd
            },
            '■ End'
          )
        ),
        ...loops.map(([t, tn, f]) =>
          el(
            'div',
            { class: 'lcLoop' },
            '↻ ' + f.name + ' on ' + tn + ', ' + f.bars + (f.bars > 1 ? ' bars' : ' bar'),
            el(
              'button',
              {
                type: 'button',
                class: 'btn sm',
                'aria-label': 'Take ' + f.name + ' out of the set',
                title: 'Out of the set: it is written again around the loops left',
                onclick: () => lcDrop(t)
              },
              '✕'
            )
          )
        )
      );
    }
  });
}
