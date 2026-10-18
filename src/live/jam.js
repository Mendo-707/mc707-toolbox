// Start Jam and End Jam. A jam opens with a few 2-bar intro loops that build into the first scene
// (parts arrive one group at a time, the filter opens, the last loop rolls and rises into the drop)
// and closes with a quick 1-2 bar outro that winds the scene down to a final hit. The loops are made
// from the set's own patterns, so they suit every genre and lead straight into (or out of) the
// music, and the recipe is picked at random each time.
//
// Owns: LV.jam (the intro or outro in progress).
// Reads: S, LV, TR.
import { toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { oneKit } from '../core/device.js';
import { rollNotes } from '../core/rolls.js';
import { FACMAP, facById } from '../library/index.js';
import { LV, mkEnv } from './state.js';
import { lvFadeOut } from './fades.js';
import { lvTrapRolls } from './extreme.js';
import { lvFilterAway, lvMove } from './moves.js';
import { liveReplace, liveScene, liveStart, liveStop, lvHistMark, lvLog, lvTop } from './engine.js';
import { lvBoundary, lvOn, lvSortCues } from './cues.js';
import { bySlot, slotOf, toneTracksAll, tracksOf } from '../core/tracks.js';

const HATS = [1, 4, 5, 10, 11],
  SNARE = [2, 3];
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---- patterns made from the set's own patterns (kept in the lookup only, not in the library list) ---- */
const LABEL = {
  hats: 'hats only',
  kick: 'kick and hats',
  nosn: 'no snare',
  build: 'build',
  thin: 'thin',
  hit: 'last hit',
  hits: 'hits',
  roots: 'roots',
  sus: 'held'
};
/** Notes of a drum pattern over exactly 2 bars (repeated or cut). */
function twoBars(f) {
  const out = [];
  for (let o = 0; o < 32; o += f.bars * 16) for (const n of f.notes) if (n.s + o < 32) out.push({ ...n, s: n.s + o });
  return out;
}
function drumNotes(f, kind) {
  const n2 = twoBars(f);
  if (kind === 'hats') return n2.filter(n => HATS.includes(n.n));
  if (kind === 'kick') return n2.filter(n => n.n === 0 || HATS.includes(n.n));
  if (kind === 'nosn') return n2.filter(n => !SNARE.includes(n.n));
  if (kind === 'thin')
    return n2
      .filter(n => (n.n === 0 && n.s % 16 === 0) || (HATS.includes(n.n) && n.s % 4 === 0))
      .map(n => ({ ...n, v: Math.round(n.v * 0.8) }));
  if (kind === 'hit')
    return [
      { s: 0, l: 2, n: 0, v: 124 },
      { s: 0, l: 8, n: 9, v: 118 }
    ];
  if (kind === 'build') {
    /* bar 1 as it is; bar 2 keeps the kick on 1 and 2, the hats, and a snare roll that climbs over beats 3 and 4 */
    const keep = n2.filter(n => n.s < 16 || (n.n === 0 && n.s < 24) || HATS.includes(n.n));
    const trap = lvTrapRolls();
    return [
      ...keep,
      ...rollNotes(trap ? 't16' : '16', 24, 2, 84),
      ...rollNotes(trap ? pick(['32', '64']) : pick(['32', 'h32']), 28, 2, 118)
    ];
  }
  return n2;
}
function toneNotes(f, kind) {
  const L = f.bars * 16;
  if (kind === 'hits') {
    /* the chord on the one of every bar, held for half a bar */
    return f.notes.filter(n => n.s % 16 < 1).map(n => ({ ...n, l: Math.min(8, L - n.s) }));
  }
  if (kind === 'roots') {
    /* the bass on the one of every bar, an octave-safe pulse */
    const firsts = [];
    for (let b = 0; b < f.bars; b++) {
      const ns = f.notes.filter(n => n.s >= b * 16 && n.s < b * 16 + 4).sort((a, c) => a.s - c.s || a.n - c.n);
      if (ns.length) firsts.push({ ...ns[0], s: b * 16, l: 6 });
    }
    return firsts;
  }
  if (kind === 'sus') {
    const out = [];
    for (let b = 0; b < f.bars; b++) {
      const s0 = f.notes.filter(n => n.s >= b * 16 && n.s < b * 16 + 16);
      const first = s0.length ? Math.min(...s0.map(n => n.s)) : null;
      if (first != null) s0.filter(n => n.s === first).forEach(n => out.push({ ...n, s: b * 16, l: 16 }));
    }
    return out;
  }
  return f.notes;
}
/** The id of pattern `src` made over as `kind` (cached; found by facById like any pattern). */
function made(srcId, kind) {
  const f = facById(srcId);
  if (!f) return null;
  if (kind === 'full' && f.type === 'tone') return srcId;
  const id = 'jam-' + kind + '-' + srcId;
  if (FACMAP.has(id)) return id;
  const drum = f.type === 'drum',
    notes = drum ? drumNotes(f, kind) : toneNotes(f, kind);
  if (!notes.length) return kind === 'full' ? srcId : null;
  FACMAP.set(id, {
    ...f,
    id,
    name: f.name + ' (' + (LABEL[kind] || kind) + ')',
    bars: drum ? (kind === 'hit' ? 1 : 2) : f.bars,
    notes: notes.sort((a, b) => a.s - b.s || a.n - b.n),
    pool: 'jam',
    jam: true
  });
  return id;
}

/* ---- recipes: which parts play in each 2-bar loop ---- */
/* recipes name the default layout's tracks (slots); has() and loop() find the tracks doing those jobs */
const has = (cells, slot) => tracksOf(slot).some(t => !!cells[t]);
/** A loop: {slot: kind} → {track: id}. */
function loop(cells, spec0) {
  const ids = {},
    spec = bySlot(spec0);
  for (const t in spec) {
    const c = cells[t];
    if (!c) continue;
    const id = made(c.id, spec[t]);
    if (id) ids[t] = id;
  }
  return ids;
}
function introLoops(cells) {
  const D = oneKit() ? {} : { 1: 'full' },
    keys = has(cells, 4) ? { 4: 'full' } : has(cells, 5) ? { 5: 'full' } : {};
  const recipes = {
    'drums first': [
      { 0: 'hats', ...D },
      { 0: 'kick', ...D, 3: 'roots' },
      { 0: 'nosn', ...D, 2: 'full', 3: 'full', 4: 'hits', 5: 'sus' },
      { 0: 'build', ...D, 2: 'full', 3: 'full', 4: 'full', 5: 'full', 7: 'full' }
    ],
    'keys first': [
      { 4: 'sus', 5: 'full' },
      { ...keys, 5: 'full', 0: 'hats', ...D },
      { 0: 'kick', ...D, 3: 'roots', 4: 'full', 5: 'full' },
      { 0: 'build', ...D, 2: 'full', 3: 'full', 4: 'full', 5: 'full', 7: 'full' }
    ],
    'bass first': [
      { 3: 'full', 0: 'hats', ...D },
      { 3: 'full', 0: 'kick', ...D, 4: 'hits' },
      { 0: 'nosn', ...D, 2: 'full', 3: 'full', 4: 'full', 5: 'sus' },
      { 0: 'build', ...D, 2: 'full', 3: 'full', 4: 'full', 5: 'full', 7: 'full' }
    ]
  };
  const names = Object.keys(recipes).filter(
    n => (n !== 'bass first' || has(cells, 3)) && (n !== 'keys first' || has(cells, 4) || has(cells, 5))
  );
  const name = pick(names);
  let r = recipes[name];
  /* sometimes a shorter intro: skip the third loop */
  if (Math.random() < 0.4) r = [r[0], r[1], r[3]];
  return { name, loops: r.map(spec => ({ bars: 2, ids: loop(cells, spec) })).filter(l => Object.keys(l.ids).length) };
}
/* Outros are short: one or two bars from the press, ending on a hit (or a quick fade). */
function outroLoops(cells) {
  const D = oneKit() ? {} : { 1: 'full' },
    keys = has(cells, 5) ? { 5: 'full' } : { 4: 'sus' };
  const hit = { bars: 1, ids: loop(cells, { 0: 'hit', 3: 'roots' }), last: true };
  const recipes = {
    'cut to the hit': [],
    'thin out and hit': [{ 0: 'thin', ...D, 3: 'roots', 5: 'sus' }],
    'breakdown and hit': [{ 1: 'full', 2: 'full', 4: 'hits', 5: 'sus' }],
    'fade away': [{ ...keys, 1: 'full', 3: 'roots' }]
  };
  const names = Object.keys(recipes).filter(n => n !== 'cut to the hit' || Object.keys(hit.ids).length);
  const name = pick(names);
  const fade = name === 'fade away';
  const loops = recipes[name]
    .map(spec => ({ bars: fade ? 2 : 1, ids: loop(cells, spec) }))
    .filter(l => Object.keys(l.ids).length);
  if (!fade && Object.keys(hit.ids).length) loops.push(hit);
  return { name, loops, fade };
}

/* ---- playing a jam ---- */
/** Start Jam: intro loops, then the first scene. Shift-click (now) skips the intro. */
export function liveJamStart(now) {
  if (lvOn()) return;
  liveStart(0);
  if (now) return;
  const sc = LV.scenes[LV.cur];
  if (!sc) return;
  const { name, loops } = introLoops(sc.cells);
  if (loops.length < 2) return;
  LV.jam = { kind: 'in', name, loops, i: -1, next: 0, to: LV.cur };
  for (let t = 0; t < 8; t++) LV.voices[t] = [];
  LV.hist = [];
  lvJamStep(0);
  /* the filter opens over the intro; the last loop rises into the first scene */
  const len = loops.reduce((a, l) => a + l.bars * 32, 0),
    lastAt = len - loops[loops.length - 1].bars * 32;
  lvMove({
    id: 'jamin',
    tag: 'jam',
    tracks: toneTracksAll(),
    cc: 80,
    kind: 'ramp',
    from: lvFilterAway(0.75),
    to: 'rest',
    curve: 'log',
    start: 0,
    end: lastAt
  });
  LV.rise = { start: lastAt, end: len, from: LV.rest[0], to: 127, cc: 80, target: 'all' };
  if (LV.buildFx) {
    LV.cues.push({ type: 'moves', tick: lastAt, end: len });
    lvSortCues();
  }
  toast('Intro: ' + name + ', ' + len / 32 + ' bars into ' + sc.name);
}
/** End Jam: outro loops from the scene playing, then a last hit and stop. Pressed again, it stops now. */
export function liveJamEnd() {
  if (!lvOn()) return;
  if (LV.jam && LV.jam.kind === 'out') {
    liveStop();
    return;
  }
  const sc = LV.scenes[LV.cur];
  const cells = {};
  for (let t = 0; t < 8; t++) {
    const v = lvTop(t);
    if (v) cells[t] = { id: v.f.jam ? (sc && sc.cells[t] ? sc.cells[t].id : v.f.id) : v.f.id };
  }
  const { name, loops, fade } = outroLoops(cells);
  if (!loops.length) {
    liveStop();
    return;
  }
  const at = lvBoundary(1);
  LV.cues = LV.cues.filter(c => !['scene', 'swap', 'fill', 'guest', 'gap', 'thin', 'bov', 'stop'].includes(c.type));
  LV.auto = false;
  LV.jam = { kind: 'out', name, loops, i: -1, next: at, fade };
  LV.ver++;
  toast('Outro: ' + name + ' from bar ' + (at / 32 + 1) + '. Press again to stop now.');
}
/** Called by the engine at the jam's next loop boundary: play the next loop, or hand over. */
export function lvJamStep(tick) {
  const j = LV.jam;
  if (!j) return;
  j.i++;
  if (j.i >= j.loops.length) {
    LV.jam = null;
    if (j.kind === 'in') {
      liveScene(j.to, tick);
      LV.crash = true;
    } else {
      LV.stopAt = tick;
    }
    LV.ver++;
    return;
  }
  const l = j.loops[j.i];
  for (let t = 0; t < 8; t++) {
    const id = l.ids[t];
    const top = lvTop(t);
    if (!id) {
      LV.voices[t] = [];
      continue;
    }
    if (top && top.f.id === id) continue;
    liveReplace(t, id, tick, 0, S.tracks[t].type === 'tone' && slotOf(t) === 5 ? 16 : 0);
  }
  if (j.kind === 'out' && j.i === j.loops.length - 1 && !l.last) {
    /* the last outro loop washes out */
    lvMove({
      id: 'jamwash',
      tag: 'jam',
      tracks: toneTracksAll(),
      cc: 91,
      kind: 'ramp',
      from: 'rest',
      to: 112,
      curve: 'exp',
      start: tick,
      end: tick + l.bars * 32
    });
    if (j.fade)
      for (let t = 0; t < 8; t++) {
        LV.tg[t] = mkEnv(1, 0, tick, l.bars * 32);
        if (LV.voices[t].length) lvFadeOut(t, tick, l.bars * 32);
      }
  }
  j.next = tick + l.bars * 32;
  lvHistMark(tick, (j.kind === 'in' ? 'Intro ' : 'Outro ') + (j.i + 1));
  lvLog(tick);
  LV.ver++;
}
/** The loops still to come, for the timeline: [{tick, ids, label}]. */
export function lvJamAhead() {
  const j = LV.jam;
  if (!j) return [];
  const out = [];
  let tk = j.next;
  for (let i = j.i + 1; i < j.loops.length; i++) {
    out.push({
      tick: tk,
      ids: Array.from({ length: 8 }, (_, t) => j.loops[i].ids[t] || null),
      label: (j.kind === 'in' ? 'Intro ' : 'Outro ') + (i + 1)
    });
    tk += j.loops[i].bars * 32;
  }
  /* after the intro, the first scene */
  const sc = j.kind === 'in' && LV.scenes[j.to];
  if (j.kind === 'out') out.push({ tick: tk, ids: Array(8).fill(null), label: 'End' });
  if (sc)
    out.push({
      tick: tk,
      ids: Array.from({ length: 8 }, (_, t) => (sc.cells[t] ? sc.cells[t].id : null)),
      scene: true
    });
  return out;
}
