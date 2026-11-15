// Three full kits (core/device.js threeKits): the MC-707's three drum tracks each hold a full kit, and a
// composed set's beat moves between them. The beat is one pattern (the 'full' part on Drums 1); the engine
// sends each of its notes to the kit the scene's plan says is playing at that moment (live/engine.js), so
// swaps, fills and variations work on it as on any part.
//
// How fast the beat moves suits the genre and the scene: drum and bass, jungle and breaks chop between kits
// every half bar or every beat at a peak; garage, dubstep, electro, funk and the dancehall and afro
// grooves change every few bars; the rest keep a kit for a whole scene, and the next scene takes another.
// Each scene starts on its own kit, and when a scene comes round again it may move another way.
//
// Owns: nothing (the plan is a scene's hop and hopK, and LV.hop for the scene playing). Reads: S, LV.
import { threeKits } from '../core/device.js';
import { trackOf } from '../core/tracks.js';
import { S } from '../core/state.js';

/* how the beat moves, in the ticks since the scene began (32 a bar, 8 a beat), as a kit 0-2 */
const MOVE = {
  /* one kit all scene */
  stay: () => 0,
  /* four bars on one kit, four on the next */
  phrase: r => Math.floor(r / 128) % 2,
  /* three bars on one kit, the fourth on the next */
  turn: r => (Math.floor(r / 32) % 4 === 3 ? 1 : 0),
  /* bar by bar: one, two, one, three */
  bar: r => [0, 1, 0, 2][Math.floor(r / 32) % 4],
  /* every half bar between two kits, and every fourth bar chopped beat by beat over all three */
  half: r => (Math.floor(r / 32) % 4 === 3 ? [0, 1, 2, 1][Math.floor(r / 8) % 4] : Math.floor(r / 16) % 2),
  /* beat by beat: one, two, one, three */
  beat: r => [0, 1, 0, 2][Math.floor(r / 8) % 4]
};
export const HOP_NAMES = {
  stay: 'one kit',
  phrase: 'every 4 bars',
  turn: 'every 4th bar',
  bar: 'bar by bar',
  half: 'every half bar',
  beat: 'beat by beat'
};
/* the moves each kind of scene picks from, by how fast the genre's drums move */
const TIER = {
  fast: { groove: ['turn', 'bar', 'half'], peak: ['half', 'beat', 'bar'], tool: ['phrase', 'turn'] },
  mid: { groove: ['phrase', 'turn'], peak: ['turn', 'bar'], tool: ['phrase'] },
  slow: { groove: ['stay'], peak: ['stay', 'phrase'], tool: ['stay'] }
};
const FAST = new Set(['dnb', 'jungle', 'dnbHalf', 'breaks']),
  MID = new Set(['garage', 'dubstep', 'electro', 'funk', 'afro', 'dembow']);
const tierOf = gr => (FAST.has(gr) ? 'fast' : MID.has(gr) ? 'mid' : 'slow');
/** The moves a scene of this kind can make in a genre whose composer grammar is `gr`. */
export const hopMoves = (gr, kind) => TIER[tierOf(gr)][kind] || ['stay'];
/** The drum tracks holding the kits, in order (Drums 1, 2, 3). */
export const hopTracks = () => [0, 1, 2].map(trackOf).filter(t => t >= 0 && S.tracks[t].type === 'drum');
/**
 * Give a composed set's scenes their plans: a move for each scene, and the kit it starts on (the next
 * scene starts on another). Nothing with Three full kits off.
 */
export function hopPlan(scenes, gr, rand = Math.random) {
  if (!threeKits()) return;
  scenes.forEach((sc, i) => {
    const moves = hopMoves(gr, sc.kind);
    sc.hop = moves[Math.floor(rand() * moves.length)];
    sc.hopK = i % 3;
  });
}
/** A scene comes round again: perhaps another move, and another kit to start on. */
export function hopTurn(sc, gr) {
  if (!sc.hop || !threeKits()) return;
  const moves = hopMoves(gr, sc.kind);
  sc.hop = moves[Math.floor(Math.random() * moves.length)];
  sc.hopK = (sc.hopK + 1 + Math.floor(Math.random() * 2)) % 3;
}
/**
 * The track the beat plays on at tick, for a note of track t's part f: the kit the plan says, for anything
 * on the beat's track (Drums 1: the beat, its fills, a Break's hits); t itself for anything else, or with no
 * plan.
 * @param {{speed:string, k:number, start:number}|null} hop  the scene playing (LV.hop)
 */
export function hopTo(hop, t, f, tick) {
  if (!hop || !f || t !== trackOf(0) || !threeKits()) return t;
  const ks = hopTracks();
  if (ks.length < 2) return t;
  const r = Math.max(0, tick - hop.start);
  return ks[(hop.k + (MOVE[hop.speed] || MOVE.stay)(r)) % ks.length];
}
/**
 * For the timeline: where the beat is in bar `bar` of scene sc, for drum track t. Null with no plan or for
 * a track that holds no kit; else {on: the beat plays on t's kit in this bar, chop: it moves between kits
 * within the bar}.
 */
export function hopLane(sc, t, bar) {
  if (!sc || !sc.hop || !threeKits()) return null;
  const ks = hopTracks(),
    i = ks.indexOf(t);
  if (i < 0 || ks.length < 2) return null;
  const move = MOVE[sc.hop] || MOVE.stay,
    used = new Set();
  for (let r = bar * 32; r < bar * 32 + 32; r += 4) used.add(((sc.hopK || 0) + move(r)) % ks.length);
  return { on: used.has(i), chop: used.size > 1 };
}
