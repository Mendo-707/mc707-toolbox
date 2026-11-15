// Auto-pilot's choices, shaped like a DJ's set rather than a loop round the scene list:
//   journey   scenes follow an arc shaped by the genre (JOURNEY): build and drop for drum and bass,
//             dubstep, trance and big beat; long grooves and the odd drop for house, techno, garage and
//             disco; verse and hook for hip hop, R&B, reggae, funk, pop and the afro and dancehall styles
//             (a lift only before the last hook); a slow drift for ambient and cinematic. Each takes the
//             version of a kind heard least lately, so Peak and Peak B, Groove and Groove B take turns;
//             with Chaos high it sometimes jumps somewhere else
//   lengths   how many loops a scene plays is chosen when it is planned, around Repeats: longer grooves
//             in club music, shorter hooks in songs, a lift once
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

/* The arcs, by scene kind (each starts again at its first step), and how many loops each kind plays
   around Repeats ([fewer, more]), by the shape of the genre's music. */
const JOURNEY = {
  drop: {
    arc: ['groove', 'build', 'peak', 'peak', 'strip', 'groove', 'tool', 'build', 'peak', 'strip'],
    reps: { groove: [0, 0], peak: [-1, 0], strip: [-1, 0], tool: [-1, 0] }
  },
  club: {
    arc: ['groove', 'groove', 'tool', 'build', 'peak', 'groove', 'peak', 'strip', 'groove', 'tool', 'peak'],
    reps: { groove: [0, 1], peak: [0, 1], strip: [-1, 0], tool: [0, 1] }
  },
  song: {
    arc: ['groove', 'peak', 'groove', 'peak', 'tool', 'strip', 'build', 'peak', 'groove', 'peak'],
    reps: { groove: [0, 0], peak: [-1, 0], strip: [-1, -1], tool: [-1, 0] }
  },
  drift: {
    arc: ['groove', 'strip', 'groove', 'tool', 'peak', 'strip', 'groove', 'peak'],
    reps: { groove: [0, 1], peak: [0, 1], strip: [0, 1], tool: [0, 1] }
  }
};
const SHAPE = {
  drop: [
    'liquid',
    'neuro',
    'jungle',
    'jumpup',
    'halftime',
    'dubstep',
    'riddim',
    'trance',
    'progtrance',
    'bigbeat',
    'breakbeat'
  ],
  club: [
    'deephouse',
    'classichouse',
    'techhouse',
    'afrohouse',
    'techno',
    'minimal',
    'acidtechno',
    'ukgarage',
    'speedgarage',
    'electro',
    'disco',
    'nudisco'
  ],
  drift: ['ambient', 'cinematic']
};
/** The shape of the style's journey: 'drop', 'club', 'song' or 'drift'. */
export const lvShape = (id = LV.style) => Object.keys(SHAPE).find(k => SHAPE[k].includes(id)) || 'song';
const arc = () => JOURNEY[lvShape()].arc;
/** How many loops auto-pilot plays a scene this time: around Repeats, by the genre's shape (a lift once). */
export function lvAutoReps(sc) {
  if (!sc || sc.kind === 'build') return 1;
  const [lo, hi] = JOURNEY[lvShape()].reps[sc.kind] || [0, 0],
    n = LV.autoReps + lo + Math.floor(Math.random() * (hi - lo + 1));
  /* (never past 48 bars, nor under one loop) */
  return Math.max(1, Math.min(4, n, Math.floor(48 / sc.bars)));
}
const FRESH_EVERY = 12;
const ap = () => LV.ap || (LV.ap = { step: 1, played: {}, changes: 0, home: LV.key });
const ARC_OF = () => arc();
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
      const ARC = ARC_OF(),
        k = ARC.indexOf('peak', A.step);
      if (k >= 0) A.step = (k + 1) % ARC.length;
      return least(peaks);
    }
  }
  if (LV.chaos > 60 && Math.random() < (LV.chaos - 60) / 100) return lvRand(reg);
  const ARC = ARC_OF();
  A.step %= ARC.length;
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
 * How long auto-pilot plays a scene, in ticks: its loop times the loops chosen for it (lvAutoReps, when it
 * was planned; reps for a planned one), a lift once (a build peaks at its end, so a second pass would build
 * up, stop, and build again from nothing).
 */
export const lvAutoTotal = (sc, reps) => {
  if (sc.kind === 'build') return sc.bars * 32;
  const now = LV.apNow && LV.apNow.from === LV.sceneStart && sc === LV.scenes[LV.cur] ? LV.apNow.reps : null;
  return sc.bars * 32 * (reps || now || LV.autoReps);
};
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
  /* the scene that just started was the plan's first: the rest of the plan carries on, and the loops
     chosen for it are its length now */
  const went = P && P.list.length && P.next === LV.sceneStart;
  LV.apNow = went && P.list[0].idx === LV.cur ? { from: LV.sceneStart, reps: P.list[0].reps } : LV.apNow;
  const list = went && P.list.length > 1 ? P.list.slice(1) : [];
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
    list.push({ idx, fresh, reps: lvAutoReps(nx) });
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
  A.step = ARC_OF().indexOf('strip') + 1;
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
