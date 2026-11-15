// Three full kits (core/device.js threeKits): the MC-707's three drum tracks each hold a full kit, and a
// composed set's beat moves between them the way a drum and bass track moves between breaks. The beat is one
// pattern (the 'full' part on Drums 1); the engine sends each of its notes to the kit the scene's plan says
// is playing at that moment (live/engine.js), so swaps, fills and variations work on it as on any part.
//
// The beat stays on one kit and moves now and then, always on a beat:
//   turnaround  the last beat or two of a four-bar phrase on another kit, back on the next downbeat
//   flick       a single beat on another kit, mid-phrase
//   switch      after eight bars the beat moves to another kit for the next eight (sometimes two beats
//               early, a pickup)
// How often depends on the genre (most in drum and bass, jungle and breaks, a little in garage, dubstep,
// electro, funk and the afro and dancehall grooves, a switch now and then elsewhere) and the scene (peaks
// most, breakdowns hardly). Never more than one move in two bars. Each scene starts on a kit of its own;
// the plan covers 16 bars (two loops of an 8-bar scene) and is written again when the scene comes round.
//
// Owns: nothing (a scene's plan is sc.hop, and LV.hop {plan, start} for the scene playing). Reads: S, LV.
import { threeKits } from '../core/device.js';
import { trackOf } from '../core/tracks.js';
import { S } from '../core/state.js';

const BAR = 32,
  BEAT = 8,
  SPAN = 16 * BAR;
/* how often each move happens, by how much the genre's drums move: turnaround (per four-bar phrase), flick
   (per two bars without a move), switch (per eight bars) */
const RATE = {
  fast: { turn: 0.55, flick: 0.22, sw: 0.5 },
  mid: { turn: 0.3, flick: 0.08, sw: 0.35 },
  slow: { turn: 0.1, flick: 0, sw: 0.25 }
};
/* and by the scene */
const KIND = { peak: 1, groove: 0.7, tool: 0.6, build: 0, strip: 0.2 };
const FAST = new Set(['dnb', 'jungle', 'dnbHalf', 'breaks']),
  MID = new Set(['garage', 'dubstep', 'electro', 'funk', 'afro', 'dembow']);
const tierOf = gr => (FAST.has(gr) ? 'fast' : MID.has(gr) ? 'mid' : 'slow');
/** The drum tracks holding the kits, in order (Drums 1, 2, 3). */
export const hopTracks = () => [0, 1, 2].map(trackOf).filter(t => t >= 0 && S.tracks[t].type === 'drum');

/**
 * A plan for a scene: {base: its first kit, segs: [[from, to, kit], ...] in ticks over 16 bars}; outside
 * a seg the beat is on the scene's kit at that point (base, or the kit a switch moved it to).
 */
export function hopMake(kind, gr, base, rand = Math.random) {
  const R = RATE[tierOf(gr)],
    m = KIND[kind] ?? 0.5,
    segs = [];
  let kit = base,
    last = -2 * BAR;
  const other = k => (k + 1 + Math.floor(rand() * 2)) % 3;
  for (let bar = 0; bar < 16; bar++) {
    const at = bar * BAR,
      free = at - last >= 2 * BAR;
    if (bar === 7 && rand() < R.sw * m) {
      /* a switch for the second eight bars, from the downbeat or as a two-beat pickup */
      const to = other(kit),
        from = rand() < 0.5 ? at + BAR : at + 2 * BEAT;
      segs.push([from, SPAN, to, 'switch']);
      last = from;
      kit = to;
      continue;
    }
    if (!free) continue;
    if (bar % 4 === 3 && rand() < R.turn * m) {
      /* a turnaround: the last one or two beats of the phrase */
      const n = rand() < 0.6 ? 2 : 1;
      segs.push([at + (4 - n) * BEAT, at + BAR, other(kit), 'turn']);
      last = at;
    } else if (bar % 2 === 1 && bar % 4 !== 3 && rand() < R.flick * m) {
      /* a flick: one beat, the third or the fourth */
      const b = rand() < 0.5 ? 2 : 3;
      segs.push([at + b * BEAT, at + (b + 1) * BEAT, other(kit), 'flick']);
      last = at;
    }
  }
  /* the switches set the kit underneath what comes after them */
  const sw = segs.filter(s => s[3] === 'switch');
  return {
    base,
    segs: segs
      .map(([a, b, k, w]) => {
        /* a turnaround or flick moves off the kit the beat is on at that point */
        if (w === 'switch') return [a, SPAN, k];
        const under = sw.filter(s => s[0] <= a).pop();
        const now = under ? under[2] : base;
        return [a, b, k === now ? (k + 1) % 3 : k];
      })
      .sort((x, y) => x[0] - y[0])
  };
}
/** The kit (0-2) a plan has the beat on at r ticks into the scene. */
export function hopKit(plan, r) {
  const x = ((r % SPAN) + SPAN) % SPAN;
  let k = plan.base;
  /* the last seg that covers x wins (a turnaround over a switch) */
  for (const [a, b, kk] of plan.segs) if (a <= x && x < b) k = kk;
  return k;
}
/**
 * Give a composed set's scenes their plans; each scene starts on a kit of its own. Nothing with Three full
 * kits off.
 */
export function hopPlan(scenes, gr, rand = Math.random) {
  if (!threeKits()) return;
  scenes.forEach((sc, i) => (sc.hop = hopMake(sc.kind, gr, i % 3, rand)));
}
/** A scene comes round again: a new plan, starting on another kit. */
export function hopTurn(sc, gr) {
  if (!sc.hop || !threeKits()) return;
  sc.hop = hopMake(sc.kind, gr, (sc.hop.base + 1 + Math.floor(Math.random() * 2)) % 3);
}
/**
 * The track a note of track t's part f plays on at tick: for anything on the beat's track (Drums 1: the
 * beat, its fills, a Break's hits), the kit the plan says; t itself for anything else, or with no plan.
 * @param {{plan:{base:number, segs:number[][]}, start:number}|null} hop  the scene playing (LV.hop)
 */
export function hopTo(hop, t, f, tick) {
  if (!hop || !hop.plan || !f || t !== trackOf(0) || !threeKits()) return t;
  const ks = hopTracks();
  if (ks.length < 2) return t;
  return ks[hopKit(hop.plan, Math.max(0, tick - hop.start)) % ks.length];
}
/**
 * For the timeline: where the beat is in bar `bar` of scene sc, for drum track t. Null with no plan or for
 * a track that holds no kit; else {on: the beat plays on t's kit in this bar, chop: it moves between kits
 * within the bar}.
 */
export function hopLane(sc, t, bar) {
  if (!sc || !sc.hop || !sc.hop.segs || !threeKits()) return null;
  const ks = hopTracks(),
    i = ks.indexOf(t);
  if (i < 0 || ks.length < 2) return null;
  const used = new Set();
  for (let r = bar * BAR; r < bar * BAR + BAR; r += BEAT) used.add(hopKit(sc.hop, r) % ks.length);
  return { on: used.has(i), chop: used.size > 1 };
}
