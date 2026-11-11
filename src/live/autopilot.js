// Auto-pilot's choices, shaped like a DJ's set rather than a loop round the scene list:
//   journey   scenes follow an arc (groove, lift, peak, a second peak, a breakdown, back to the groove …),
//             taking the version of each kind heard least lately, so Peak and Peak B, Groove and Groove B
//             take turns; with Chaos high it sometimes jumps somewhere else
//   builds    a lift into a peak gets a snare build, the filter riser and the drop
//   fresh     every so often (about every twelve scene changes) a breakdown brings in New patterns, so a
//             long set keeps finding new parts in the same style; never on a set you edited yourself
//   key lift  with Chaos at half or more, coming out of a breakdown the key sometimes rises a tone (never
//             more than two tones from home, and back home with fresh patterns)
//   moves     in a peak, now and then a filter dip or a reverb throw at the end of a loop, and a throw
//             into every breakdown
// Owns: LV.ap (the journey so far). Reads: LV, TR.
import { facById } from '../library/index.js';
import { lvPool } from '../library/pools.js';
import { tracksFor, toneTracksAll } from '../core/tracks.js';
import { LV, lvOwnBuild, lvRand, lvStyle } from './state.js';
import { lvIsFlash } from './themes.js';
import { lvFilterAway, lvMove } from './moves.js';
import { liveNewSet } from './scene-templates.js';
import { lvBlendIn } from './cues.js';
import { TR } from '../services/transport.js';
import { lvSceneTurn } from './set-builder.js';

/* the arc, by scene kind; it starts again at its first step */
const ARC = ['groove', 'build', 'peak', 'peak', 'strip', 'groove', 'tool', 'build', 'peak', 'strip'];
const FRESH_EVERY = 12;
const ap = () => LV.ap || (LV.ap = { step: 1, played: {}, changes: 0, home: LV.key });
/** Forget the journey (a new start). */
export function lvAutoReset() {
  /* a set starts on its groove: the journey goes on from there */
  LV.ap = { step: 1, played: {}, changes: 0, home: LV.key };
}

/**
 * The scene after scene `after` (the one playing, or the one planned before): the arc's next kind, the
 * version of it heard least lately; with high Chaos, a detour. After a lift it is always a peak (whatever
 * put the lift there: the arc, a detour, or your own cue), so a build never leads into nothing.
 */
export function lvAutoPick(after = LV.cur) {
  const A = ap(),
    reg = LV.scenes.map((s, i) => i).filter(i => !lvIsFlash(LV.scenes[i]) && i !== after);
  if (!reg.length) return after;
  const least = cand => cand.reduce((b, i) => ((A.played[i] || 0) < (A.played[b] || 0) ? i : b), cand[0]);
  if (LV.scenes[after] && LV.scenes[after].kind === 'build') {
    const peaks = reg.filter(i => LV.scenes[i].kind === 'peak');
    if (peaks.length) {
      const k = ARC.indexOf('peak', A.step);
      if (k >= 0) A.step = (k + 1) % ARC.length;
      return least(peaks);
    }
  }
  if (LV.chaos > 60 && Math.random() < (LV.chaos - 60) / 100) return lvRand(reg);
  for (let k = 0; k < ARC.length; k++) {
    const kind = ARC[(A.step + k) % ARC.length],
      cand = reg.filter(i => LV.scenes[i].kind === kind);
    if (!cand.length) continue;
    A.step = (A.step + k + 1) % ARC.length;
    /* least played, the first in the list on a tie */
    return least(cand);
  }
  return lvRand(reg);
}
/**
 * How long auto-pilot plays a scene, in ticks: its loop times Repeats, but a lift once (a build peaks at
 * its end, so a second pass would build up, stop, and build again from nothing).
 */
export const lvAutoTotal = sc => sc.bars * 32 * (sc.kind === 'build' ? 1 : LV.autoReps);
/** Would auto-pilot bring in fresh patterns instead of a scene of this kind (lvAutoFresh)? */
export const lvAutoFreshDue = kind => !LV.custom && ap().changes >= FRESH_EVERY && ['strip', 'groove'].includes(kind);
/**
 * Auto-pilot's next two scenes, chosen as soon as a scene starts (not two bars before it ends), so the
 * timeline and the Next card show them all the way: LV.apPlan {from: the scene's start, list: [{idx,
 * fresh}, ...]}. The first is cued two bars before the change as before (a scene you cue in the meantime
 * still wins); when it starts, the second moves up and another is chosen after it. Nothing is planned past
 * fresh patterns (the scenes after them are not written yet).
 */
export function lvAutoPlan() {
  const P = LV.apPlan;
  if (P && P.from === LV.sceneStart && P.list.length && P.list.every(x => LV.scenes[x.idx])) return P;
  /* the scene that just started was the plan's first: the rest of the plan carries on */
  const list = P && P.list.length > 1 && P.next === LV.sceneStart ? P.list.slice(1) : [];
  while (list.length < 2 && !(list.length && list[list.length - 1].fresh)) {
    const idx = lvAutoPick(list.length ? list[list.length - 1].idx : LV.cur),
      nx = LV.scenes[idx];
    if (!nx) break;
    const fresh = lvAutoFreshDue(nx.kind);
    /* counted now, so the scene after it is not the same one again */
    if (!fresh) {
      lvAutoPlayed(idx);
      /* (a scene that comes round again is played another way: chosen now, so the timeline shows it) */
      lvSceneTurn(idx);
    }
    list.push({ idx, fresh });
  }
  LV.apPlan = list.length ? { from: LV.sceneStart, list } : null;
  LV.ver++;
  return LV.apPlan;
}
/** A scene change is cued: count it. */
export function lvAutoPlayed(idx) {
  const A = ap();
  A.played[idx] = (A.played[idx] || 0) + 1;
  A.changes++;
}
/** Auto-pilot's plan was used: its first scene is cued for tick (the rest of the plan waits for it). */
export function lvAutoPlanUsed(tick) {
  if (LV.apPlan) LV.apPlan.next = tick;
}

/** Into a peak from a lift: a snare build over the last bars, the filter riser and the drop moves. */
export function lvAutoBuild(sc, nx, fire) {
  if (!(nx.kind === 'peak' && sc.kind === 'build') || LV.cues.some(c => c.type === 'bov')) return false;
  /* cued two bars ahead, so the build fills those two bars */
  const bars = Math.max(1, Math.min(2, Math.floor((fire - TR.tick) / 32))),
    t1 = fire - bars * 32;
  const bp = lvPool(lvStyle(), 'build').map(facById).filter(Boolean),
    fit = bp.filter(f => f.bars >= bars),
    bf = fit.length ? lvRand(fit) : bp.length ? lvRand(bp) : null;
  /* (a composed lift rolls into the drop itself: another build on top would only fight it) */
  if (bf && !lvOwnBuild(sc))
    LV.cues.push({ type: 'bov', tick: t1, end: fire, f: bf, off: Math.max(0, (bf.bars - bars) * 32) });
  LV.rise = { start: t1, end: fire, from: LV.rest[0], to: 127, cc: 80, target: 'all' };
  LV.cues.push({ type: 'moves', tick: t1, end: fire });
  return true;
}

/**
 * Time for fresh patterns: at a breakdown or a groove, after enough scene changes, on a set that is not
 * your own. Builds the new set and blends it in; true when it did.
 */
export function lvAutoFresh(nextKind, planned) {
  const A = ap();
  /* (planned: auto-pilot's plan already decided it) */
  if (!planned && (LV.custom || A.changes < FRESH_EVERY || !['strip', 'groove'].includes(nextKind))) return false;
  A.changes = 0;
  A.played = {};
  A.step = ARC.indexOf('strip') + 1;
  if (LV.key !== A.home)
    LV.cues.push({ type: 'key', key: A.home, mode: LV.mode, tick: Math.ceil(TR.tick / 32) * 32 + 32 });
  liveNewSet();
  lvBlendIn();
  return true;
}
/** Out of a breakdown, with Chaos at half or more: now and then the key goes up a tone at the change. */
export function lvAutoKey(sc, nx, fire) {
  const A = ap();
  if (LV.chaos < 50 || sc.kind !== 'strip' || nx.kind === 'strip' || Math.random() > 0.35) return;
  const up = (((LV.key - A.home) % 12) + 12) % 12;
  if (up >= 4) return;
  LV.cues.push({ type: 'key', key: (LV.key + 2) % 12, mode: LV.mode, tick: fire });
}

/** A move at the end of a loop: in a peak, sometimes a filter dip or a throw; into a breakdown, a throw. */
export function lvAutoMove(sc, end, intoBreak) {
  if (!LV.buildFx) return;
  if (intoBreak) {
    lvMove({
      id: 'apthrow',
      tag: 'ap',
      tracks: toneTracksAll(),
      cc: 91,
      kind: 'ramp',
      from: 118,
      to: 'rest',
      curve: 'log',
      start: end - 8,
      end: end + 24
    });
    return;
  }
  if (sc.kind !== 'peak' || Math.random() > 0.15 + LV.chaos / 250) return;
  if (Math.random() < 0.5)
    lvMove({
      id: 'apdip',
      tag: 'ap',
      tracks: [0, 1, 2, 3, 4, 5, 6, 7],
      cc: 80,
      kind: 'ramp',
      from: lvFilterAway(0.8),
      to: 'rest',
      curve: 'exp',
      start: end - 32,
      end
    });
  else
    lvMove({
      id: 'apthrow',
      tag: 'ap',
      tracks: tracksFor([4, 5, 6, 7]),
      cc: 91,
      kind: 'ramp',
      from: 120,
      to: 'rest',
      curve: 'log',
      start: end - 8,
      end: end + 16
    });
}
