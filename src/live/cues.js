// Live Mode cues: everything that waits for the next beat, bar or phrase (scene changes, swaps,
// mutes, key changes, energy) and the Variation engine.
//
// Reads: LV, TR.
import { $, clamp, toast } from '../core/dom.js';
import { devOn } from '../core/device.js';
import { facById } from '../library/index.js';
import { poolOf, slotOf, trackOf, tracksFor, tracksOf } from '../core/tracks.js';
import { TR } from '../services/transport.js';
import { LV, SWG, lvRand, lvStyle, saveLive } from './state.js';
import { lvIsFlash } from './themes.js';
import { lvSaveScenes } from './scene-editor.js';
import { lvAutoFlash } from './breaks.js';
import { lvPool } from '../library/pools.js';
import { liveSwapIds } from './set-builder.js';
import { lvFitIds, lvMelodicCount } from './harmony.js';
import { liveStart, lvEmute, lvIds, lvSwapCue, lvTop } from './engine.js';
import { lvTickF } from './ui.js';
import { liveStatus } from './lanes.js';
import { liveRender, liveRenderCards, liveRenderPads, liveSync } from './panels.js';

/* ---- cues (all quantised) ---- */
export const lvOn = () => TR.playing && TR.mode === 'live';
/* Variation: every phrase, parts change on their own. Higher = more often and more at once. */
export const lvVaryLabel = () =>
  LV.vary === 0 ? 'Off' : LV.vary < 35 ? 'Low' : LV.vary < 70 ? 'Medium' : LV.vary <= 100 ? 'High' : 'Extreme';
export function liveVaryStep(tick, rel) {
  const sc = LV.scenes[LV.cur];
  if (!sc || LV.stopAt != null) return;
  const U = (LV.vary >= 75 ? 2 : LV.vary >= 40 ? 4 : 8) * 32;
  if (rel % U !== U - 64) return;
  const end = tick + 64;
  if (LV.cues.some(c => (c.type === 'scene' || c.type === 'bov' || c.type === 'gap') && c.tick <= end + 32)) return;
  const X = LV.vary > 100,
    p = Math.min(1, LV.vary / 100),
    R = Math.random;
  let fill = false,
    did = 0;
  if (R() < p * 0.3 && lvAutoFlash(end)) {
    LV.ver++;
    return;
  }
  if (R() < p * 0.85) {
    const g = lvRand(['bass', 'chords', 'lead', 'perc', 'drums', 'pad']);
    if (lvSwapCue(g, end)) did++;
  }
  if (X && lvSwapCue(lvRand(['drums', 'perc', 'bass', 'lead']), end)) did++;
  if (p > 0.6 && R() < p - 0.5) {
    const g = lvRand(['chords', 'lead', 'perc']);
    if (lvSwapCue(g, end)) did++;
  }
  if (
    LV.fills &&
    sc.cells[trackOf(0)] &&
    LV.fillIds.length &&
    !LV.cues.some(c => c.type === 'fill') &&
    R() < (X ? 0.9 : p * 0.6)
  ) {
    const f = facById(lvRand(LV.fillIds));
    if (f) {
      LV.cues.push({ type: 'fill', tick: end - 32, f, auto: true });
      fill = true;
      did++;
    }
  }
  if (R() < p * 0.35) {
    const cand = [0, 3, 4, 6].flatMap(tracksOf).filter(t => lvTop(t) && !LV.mute[t] && !(fill && slotOf(t) === 0));
    if (cand.length) {
      const t = lvRand(cand);
      LV.cues.push(
        { type: 'mute', tracks: [t], on: true, tick: end - 32, auto: true },
        { type: 'mute', tracks: [t], on: false, tick: end, auto: true }
      );
      did++;
    }
  }
  /* a guest melody only when it fits the progression playing and the mix has room (at most 3 melodic parts) */
  if (R() < p * 0.45 && lvMelodicCount() < 3) {
    const empty = [6, 7, 5].flatMap(tracksOf).filter(t => !lvTop(t) && !LV.mute[t] && !lvEmute(t));
    if (empty.length) {
      const t = lvRand(empty),
        id = lvRand(lvFitIds(t, liveSwapIds(t), null, slotOf(t) === 6));
      if (id) {
        LV.cues.push({ type: 'guest', t, id, tick: end }, { type: 'guestOut', t, id, tick: end + U });
        did++;
      }
    }
  }
  if (did) {
    lvSortCues();
    LV.ver++;
  }
}
export function lvSortCues() {
  LV.cues.sort((a, b) => a.tick - b.tick);
}
function lvBase() {
  const sc = LV.cues.filter(c => c.type === 'scene').pop();
  return sc ? sc.tick : LV.sceneStart;
}
export function lvBoundary(unitBars) {
  const base = lvBase(),
    U = Math.max(1, unitBars) * 32,
    from = Math.max(TR.tick, base);
  return base + Math.ceil((from - base) / U) * U;
}
function lvAutoFill(sc, nx, tick) {
  /* a fill leads into a scene with more energy, or into a different beat, so the drums do not just switch */
  const k = trackOf(0),
    newKit = nx.cells[k] && sc.cells[k] && nx.cells[k].id !== sc.cells[k].id;
  if (LV.fills && sc.cells[k] && nx.cells[k] && (nx.e >= sc.e || newKit) && LV.fillIds.length && tick - 32 >= TR.tick) {
    const f = facById(lvRand(LV.fillIds));
    if (f) LV.cues.push({ type: 'fill', tick: tick - 32, f, auto: true });
  }
}
export function liveCue(idx) {
  const sc = LV.scenes[idx];
  if (!sc) return;
  if (!lvOn()) {
    liveStart(idx);
    return;
  }
  /* a scene pad during the intro or outro takes over: the jam carries on as a normal set */
  if (LV.jam) {
    LV.jam = null;
    LV.cues = LV.cues.filter(c => c.type !== 'moves');
  }
  const pend = LV.cues.find(c => c.type === 'scene');
  LV.cues = LV.cues.filter(
    c => c.type !== 'scene' && c.type !== 'gap' && c.type !== 'thin' && !(c.type === 'fill' && c.auto)
  );
  if (pend && pend.idx === idx) {
    LV.ver++;
    toast('Cue cancelled');
    return;
  }
  const cur = LV.scenes[LV.cur];
  const tick = lvBoundary(LV.quant === 'phrase' ? cur.bars : LV.quant);
  const hard = sc.e - cur.e >= 4 && lvDropExtras(tick);
  LV.cues.push({ type: 'scene', idx, tick, hard: hard || undefined });
  if (!hard) lvAutoFill(cur, sc, tick);
  lvSortCues();
  LV.ver++;
}
/* Before a big jump: thin out kick and bass for the last bar, then a beat of silence, then everything slams in. */
export function lvDropExtras(t2) {
  if (LV.dropStyle === 'smooth') return false;
  if (t2 - 32 > TR.tick) LV.cues.push({ type: 'thin', tick: t2 - 32 });
  if (LV.dropStyle === 'gap' && t2 - 8 > TR.tick) LV.cues.push({ type: 'gap', tick: t2 - 8 });
  return true;
}
export function liveBuildDrop() {
  if (!lvOn()) {
    toast('Press Start Jam first');
    return;
  }
  const n = LV.scenes.length;
  if (!n) return;
  const curSc = LV.scenes[LV.cur];
  let b = LV.scenes.findIndex((s, i) => s.kind === 'build' && i !== LV.cur);
  if (curSc.kind === 'build') b = -1;
  const after = i =>
    LV.scenes.map((s, j) => j).filter(j => j !== LV.cur && !lvIsFlash(LV.scenes[j]) && (i < 0 || j > i));
  const pickDrop = c => c.reduce((best, j) => (best < 0 || LV.scenes[j].e > LV.scenes[best].e ? j : best), -1);
  let dI = pickDrop(after(b));
  if (dI < 0) dI = pickDrop(after(-1));
  if (dI < 0) {
    toast('No drop scene in this set');
    return;
  }
  LV.cues = LV.cues.filter(c => !['scene', 'gap', 'thin', 'bov'].includes(c.type) && !(c.type === 'fill' && c.auto));
  const bars = LV.riseBars || 4,
    t1 = lvBoundary(LV.quant === 'phrase' ? curSc.bars : LV.quant),
    t2 = t1 + bars * 32;
  if (b >= 0) LV.cues.push({ type: 'scene', idx: b, tick: t1 });
  const bp = lvPool(lvStyle(), 'build').map(facById).filter(Boolean);
  const fit = bp.filter(f => f.bars >= bars);
  const bf = fit.length ? lvRand(fit) : bp.length ? lvRand(bp) : null;
  if (bf) LV.cues.push({ type: 'bov', tick: t1, end: t2, f: bf, off: Math.max(0, (bf.bars - bars) * 32) });
  const hard = lvDropExtras(t2);
  LV.cues.push({ type: 'scene', idx: dI, tick: t2, hard: hard || undefined });
  LV.rise = { start: t1, end: t2, from: LV.rest[0], to: 127, cc: 80, target: 'all' };
  LV.cues.push({ type: 'moves', tick: t1, end: t2 });
  lvSortCues();
  LV.ver++;
  toast('Build ' + bars + ' bars → ' + LV.scenes[dI].name);
}
export function liveSwap(group) {
  if (!lvOn()) {
    toast('Press Start Jam (or a scene pad) first');
    return;
  }
  const probe = {};
  let maxBars = 1;
  tracksFor(SWG[group]).forEach(t => {
    if (lvTop(t)) maxBars = Math.max(maxBars, lvTop(t).f.bars);
  });
  const c = lvSwapCue(group, lvBoundary(Math.min(maxBars, 4)));
  if (!c) toast('Nothing to swap in this scene');
}
export function liveFillNow() {
  if (!lvOn()) {
    toast('Press Start Jam first');
    return;
  }
  if (!LV.fillIds.length || !LV.scenes[LV.cur].cells[trackOf(0)]) {
    toast('No drum fill available here');
    return;
  }
  const f = facById(lvRand(LV.fillIds));
  LV.cues = LV.cues.filter(c => !(c.type === 'fill' && !c.auto));
  LV.cues.push({ type: 'fill', tick: lvBoundary(1), f });
  lvSortCues();
  LV.ver++;
}
export function lvEffMute(t) {
  const p = LV.cues.filter(c => c.type === 'mute' && c.tracks.includes(t)).pop();
  return p ? p.on : !!LV.mute[t];
}
export function liveMute(tracks) {
  if (!lvOn()) {
    toast('Press Start Jam first');
    return;
  }
  const on = !tracks.every(lvEffMute);
  LV.cues = LV.cues.filter(
    c => !(c.type === 'mute' && c.tracks.length === tracks.length && c.tracks.every(t => tracks.includes(t)))
  );
  LV.cues.push({ type: 'mute', tracks, on, tick: lvBoundary(1) });
  lvSortCues();
  LV.ver++;
}
export function liveEnergy(n) {
  n = clamp(Math.round(n), 1, 8);
  if (!lvOn()) {
    LV.energy = n;
    LV.ver++;
    return;
  }
  LV.cues = LV.cues.filter(c => c.type !== 'energy');
  if (n !== LV.energy) LV.cues.push({ type: 'energy', n, tick: lvBoundary(1) });
  lvSortCues();
  LV.ver++;
}
export function liveKeyCue(pc, mode) {
  mode = mode || (LV.cues.find(c => c.type === 'key') || {}).mode || LV.mode;
  LV.homeKey = pc;
  if (!lvOn()) {
    LV.key = pc;
    LV.mode = mode;
    saveLive();
    LV.ver++;
    liveRender();
    return;
  }
  LV.cues = LV.cues.filter(c => c.type !== 'key');
  if (pc === LV.key && mode === LV.mode) {
    LV.ver++;
    return;
  }
  LV.cues.push({ type: 'key', key: pc, mode, tick: lvBoundary(1) });
  lvSortCues();
  LV.ver++;
  saveLive();
}
export function liveModeCue(mode) {
  const kc = LV.cues.find(c => c.type === 'key');
  liveKeyCue(kc ? kc.key : LV.key, mode);
}
export function liveStopCue() {
  if (!lvOn()) return;
  LV.cues = LV.cues.filter(c => c.type !== 'stop');
  LV.cues.push({ type: 'stop', tick: lvBoundary(LV.scenes[LV.cur].bars) });
  lvSortCues();
  LV.ver++;
  toast('Will fade out and stop at the end of the phrase');
}
export function liveRiser(dir) {
  if (!lvOn()) {
    toast('Press Start Jam first');
    return;
  }
  const t1 = lvBoundary(1),
    nextScene = LV.cues.find(c => c.type === 'scene' && c.tick > t1);
  const end = nextScene ? nextScene.tick : t1 + LV.riseBars * 32;
  const r = LV.rest[0],
    low = r < 32;
  /* up: from rest into the filter; down: the other way (out of the filter back to rest when it rests low) */
  LV.rise =
    dir === 'down'
      ? { start: t1, end, from: low ? 127 : r, to: low ? r : 0, cc: 80, target: 'all' }
      : { start: t1, end, from: r, to: 127, cc: 80, target: 'all' };
  LV.ver++;
}
export function liveStutter(len, on) {
  if (!lvOn()) return;
  if (on) {
    LV.stut = { press: TR.tick, len: Math.max(1, len) };
  } else LV.stut = null;
  LV.ver++;
}
export function liveRate(r) {
  LV.rate = r;
  LV.ver++;
}
/* Lock: hold the loop exactly as it is playing now. Auto-pilot, variation, guest parts leaving and repeat changes all wait;
   your own pad presses still work, and Save as scene keeps it. */
export function liveLock(on) {
  LV.lock = on == null ? !LV.lock : !!on;
  if (LV.lock) {
    LV.cues = LV.cues.filter(c => !c.gen && c.type !== 'guestOut');
    toast('Loop locked: the parts playing now stay put until you unlock');
  } else toast('Unlocked: auto-pilot and variation carry on');
  LV.ver++;
  liveSync();
}
export function liveLockSave() {
  const sc = LV.scenes[LV.cur];
  if (!sc) {
    toast('Start the set first');
    return;
  }
  const ids = lvIds(),
    cells = {};
  ids.forEach((id, t) => {
    if (!id || !devOn(t) || lvEffMute(t)) return;
    const f = facById(id),
      old = sc.cells[t];
    cells[t] = { id, pool: old && old.id === id ? old.pool : (f && f.pool) || poolOf(t) };
    if (old && old.play) cells[t].play = old.play;
    if (old && old.clip != null) cells[t].clip = old.clip;
  });
  if (!Object.keys(cells).length) {
    toast('Nothing is playing to save');
    return;
  }
  const n = LV.scenes.filter(x => /^Locked/.test(x.name)).length + 1,
    ns = { kind: sc.kind === 'flash' ? 'drop' : sc.kind, name: 'Locked ' + n, bars: sc.bars, e: sc.e, cells };
  if (sc.fx) ns.fx = sc.fx;
  if (LV.scenes.length >= 7) {
    LV.scenes[LV.cur] = ns;
    toast('All 7 scene pads are full, so the playing scene was replaced by Locked ' + n);
  } else {
    LV.scenes.splice(LV.cur + 1, 0, ns);
    LV.cur = LV.cur;
    toast('Saved as scene ' + (LV.cur + 2) + ': Locked ' + n);
  }
  lvSaveScenes();
  LV.ver++;
  liveRenderCards();
  liveRenderPads();
}
export function liveAuto(on) {
  LV.auto = on == null ? !LV.auto : on;
  LV.ver++;
  liveSync();
}
export function liveTap() {
  const n = performance.now();
  LV.tapT = LV.tapT.filter(x => n - x < 2500);
  LV.tapT.push(n);
  if (LV.tapT.length >= 3) {
    const a = (LV.tapT[LV.tapT.length - 1] - LV.tapT[0]) / (LV.tapT.length - 1);
    LV.bpm = clamp(Math.round(60000 / a), 40, 240);
    saveLive();
    liveRender();
  }
}
export function liveBpm(d) {
  LV.bpm = clamp(LV.bpm + d, 40, 240);
  saveLive();
  const b = $('#lvBpm');
  if (b) b.value = LV.bpm;
  liveStatus(lvTickF());
}

/**
 * New patterns while playing: from the next bar the tone parts drop out and the drums carry on; the
 * new set's drums take over halfway, and its first scene comes in after 2 to 6 bars.
 */
export function lvBlendIn() {
  LV.jam = null;
  LV.cues = LV.cues.filter(
    c =>
      !['scene', 'gap', 'thin', 'bov', 'swap', 'guest', 'blend', 'blendDrums'].includes(c.type) &&
      !(c.type === 'fill' && c.auto)
  );
  const t0 = lvBoundary(1),
    bars = 2 + Math.floor(Math.random() * 5),
    end = t0 + bars * 32;
  LV.cues.push({ type: 'blend', tick: t0 });
  LV.cues.push({ type: 'blendDrums', tick: t0 + Math.max(1, Math.floor(bars / 2)) * 32 });
  LV.cues.push({ type: 'scene', idx: 0, tick: end });
  lvSortCues();
  LV.ver++;
  return bars;
}
