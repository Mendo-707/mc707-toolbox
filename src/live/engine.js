// The Live Mode engine: the voices playing on each track, what plays on every tick, scene changes,
// swaps, and start and stop.
//
// Reads: S, LV, TR, REC, MIDI, AU, PCLAST, CLIPPIN, AUTOLAST, CTL.
// Calls up the layers through hooks (core/hooks.js).
import { lvHumApply } from './humanize-ui.js';
import { lvMoodApply } from './mood-ui.js';
import { clamp, toast } from '../core/dom.js';
import { SCALES } from '../core/theory.js';
import { devOn, oneKit } from '../core/device.js';
import { BUSY, S } from '../core/state.js';
import { facById, shiftFor } from '../library/index.js';
import { kitTrack, poolOf, slotOf, toneTracksAll, trackOf, tracksFor, tracksOf } from '../core/tracks.js';
import { patIndex, subTick } from '../core/song-model.js';
import { AU, ensureAudio } from '../services/synth.js';
import { MIDI, sendMidi } from '../services/midi.js';
import { REC, TICKER, TR, emitNote, sched, stopAll, stopPlay } from '../services/transport.js';
import { CLIPPIN, PCLAST, autoClipReset, clipFor, cmFix, patType, sendClip } from '../services/clip-switch.js';
import { hashStr } from '../core/random.js';
import { AUTOLAST, sendTrackCCs } from '../services/mc-controls.js';
import { ENTRY_TICKS, LV, LV_PRI, SWG, envAt, lvBT, lvRand, lvStyle, mkEnv } from './state.js';
import { lvFadeIn, lvFadeOut, lvFadeTick, lvFadesReset, lvLevelBack } from './fades.js';
import { lvIsFlash, lvTracksFor } from './themes.js';
import { lvAutoTick, lvBuildMoves, lvMove, lvRestCC, lvSceneFx, lvSlam, lvUserOwns } from './moves.js';
import { LV_GATE, lvAutoFlash, lvBreakStart, lvRollTick } from './breaks.js';
import { lvChordNow, lvLockNote } from './chord-lock.js';
import { riffBusy, riffQuiet, riffStopped, riffTick } from './riff.js';
import {
  lvAutoBuild,
  lvAutoFresh,
  lvAutoKey,
  lvAutoMove,
  lvAutoPick,
  lvAutoPlan,
  lvAutoPlanUsed,
  lvAutoPlayed,
  lvAutoReset,
  lvAutoTotal
} from './autopilot.js';
import { lvMaskOff } from './scene-templates.js';
import { lvModeFam, lvPool, lvProg } from '../library/pools.js';
import { liveBuild, liveSwapIds } from './set-builder.js';
import { liveVaryStep, lvDropExtras, lvSortCues } from './cues.js';
import { CTL, ctlAllOff } from './controller.js';
import { hooks } from '../core/hooks.js';
import { lvLater, lvLaterTick, lvLaterClear } from './later.js';
import { lvExtreme, lvTrapRoll, lvTrapRolls, lvXExtra, lvXSkip, lvXType } from './extreme.js';
import { knobUI } from './pads.js';
import { lvAnchorStart, lvFitIds } from './harmony.js';
import { liveJamEnd, liveJamStart, lvJamStep } from './jam.js';
import { lvMixSendAll } from './mix.js';

/* ---- engine ---- */
export const lvTop = t => {
  const vs = LV.voices[t].filter(v => v.env.v1 > 0);
  return vs.length ? vs[vs.length - 1] : null;
};
export const lvIds = () =>
  Array.from({ length: 8 }, (_, t) => {
    if (LV.flash && LV.flash.v) {
      if (!LV.flash.loop) {
        const v = LV.flash.v[t];
        return v ? v.f.id : null;
      }
      if (!LV.flash.keep.includes(t)) return null;
    }
    const v = lvTop(t);
    return v ? v.f.id : null;
  });
/* muted by the energy level, or a tone part while New patterns blends in on the drums */
/**
 * A take you put on a track (Loop rec ▶ Play) is pinned there: scene changes, auto-pilot, swaps, new
 * patterns, the energy and the scene's play pattern all leave it playing, until ■ Back. What the set
 * would play there meanwhile is kept in LV.pinUnder, so ■ Back brings in the part of the scene playing then.
 */
export const lvPinned = t => !!(LV.pin && LV.pin[t]);
/** Silence track t, unless a take is pinned there (then only note that the set has nothing there now). */
export function lvClear(t) {
  if (lvPinned(t)) LV.pinUnder[t] = null;
  else LV.voices[t] = [];
}
export const lvEmute = t =>
  !lvPinned(t) && (LV_PRI.indexOf(slotOf(t)) >= LV.energy || (!!LV.blend && S.tracks[t].type === 'tone'));
export const lvTarget = t => (LV.mute[t] || lvEmute(t) ? 0 : 1);
function lvApplyGain(tick) {
  for (let t = 0; t < 8; t++) {
    const g = lvTarget(t);
    if (LV.tg[t].v1 !== g) LV.tg[t] = mkEnv(envAt(LV.tg[t], tick), g, tick, S.tracks[t].type === 'tone' ? 16 : 2);
  }
}
export function lvLog(tick) {
  LV.log.push({
    tick,
    ids: lvIds(),
    mute: Array.from({ length: 8 }, (_, t) => lvTarget(t) === 0 || lvMaskOff(t, tick)),
    key: LV.key,
    mode: LV.mode,
    idx: LV.cur,
    brk: !!LV.flash
  });
  if (LV.log.length > 600) LV.log.shift();
}
/**
 * How a tone part on track t comes and goes at a change: 'pad' fades over the whole Entry time,
 * 'chords' fade briefly, and 'cut' parts (bass, leads, plucks, arps) never fade: they land on the
 * downbeat and stop at the change, letting the notes already playing ring out on their own.
 */
export function lvFadeKind(t) {
  const s = slotOf(t);
  return s === 5 ? 'pad' : s === 4 ? 'chords' : 'cut';
}
/**
 * Put pattern `id` on track t from `tick`. One track is one MC-707 part, so the old pattern stops
 * where the new one starts (two patterns on one track sound like a mistake). A tone part that shares
 * the progression already playing starts in step with it. `entry` fades it in over that many ticks
 * (pads take the whole fade, chords at most a quarter bar (a bar on the long settings), drums a
 * quarter bar, and bass and melodies none, so they land on the beat with their full attack).
 */
export function liveReplace(t, id, tick, fade, entry) {
  /* a pinned take stays: the part is noted for ■ Back (and the take comes back if the track was cleared) */
  if (lvPinned(t) && id !== LV.pin[t]) {
    LV.pinUnder[t] = id;
    const top = LV.voices[t] && LV.voices[t][0];
    if (top && top.f.id === LV.pin[t]) return;
    id = LV.pin[t];
  }
  const f = facById(id);
  if (!f) return;
  const was = LV.voices[t].some(v => v.env.v1 > 0),
    tone = S.tracks[t].type === 'tone';
  LV.voices[t] = [];
  const kind = tone ? lvFadeKind(t) : 'drum',
    ent =
      kind === 'pad'
        ? entry
        : kind === 'chords'
          ? Math.min(entry, entry >= 64 ? 32 : 8)
          : kind === 'cut'
            ? 0
            : Math.min(entry, 8);
  LV.voices[t].push({
    f,
    start: lvAnchorStart(t, f, tick),
    env: ent > 0 ? mkEnv(0, 1, tick, ent) : mkEnv(1, 1, tick, 0)
  });
  /* a tone part coming in from silence also fades its MC-707 track up; anything else plays at full level */
  const now = AU.ctx ? AU.ctx.currentTime : 0;
  if (tone && !was && ent > 0) lvFadeIn(t, tick, ent, now);
  else lvLevelBack(t, now);
}
/** Note what is playing from `tick` (for the timeline), inside the current scene. */
export function lvHistMark(tick, label) {
  LV.hist.push({ tick, idx: LV.cur, start: label ? tick : LV.sceneStart, ids: lvIds(), label });
  if (LV.hist.length > 16) LV.hist.shift();
}
/**
 * What each track really plays in the bar starting at `tick`, for the timeline's current bar: the
 * pattern, and whether it plays ('on'), sits the bar out ('rest'), is held back by the energy ('em'),
 * is fading out ('fade'), or is a fill, build or break playing over the track.
 */
function lvBarSnap(tick) {
  /* a break that starts during this bar counts too */
  const pend = LV.cues.find(c => c.type === 'brk' && c.tick < tick + 32),
    fl = LV.flash && tick >= LV.flash.start ? LV.flash : pend && pend.b ? pend.b : null,
    snap = [];
  for (let t = 0; t < 8; t++) {
    let c = null;
    const rollT = fl && (fl.kind === 'roll' || fl.kind === 'drop') ? (fl.kind === 'roll' ? kitTrack() : lvBT()) : -1;
    if (t === rollT) c = { id: null, k: 'roll' };
    else if (fl && !fl.loop && fl.v && fl.v[t]) c = { id: fl.v[t].f.id, k: 'brk' };
    else if (t === trackOf(0) && LV.fill && tick >= LV.fill.start) c = { id: LV.fill.f.id, k: 'fill' };
    else if (t === lvBT() && LV.bov && tick >= LV.bov.start) c = { id: LV.bov.f.id, k: 'bov' };
    else if (t === lvBT() && LV.impact && LV.impact.tick < tick + 32) c = { id: LV.impact.f.id, k: 'imp' };
    else {
      const v = lvTop(t);
      if (v) c = { id: v.f.id, k: lvMaskOff(t, tick) ? 'rest' : lvEmute(t) || LV.mute[t] ? 'em' : 'on' };
      else {
        const fv = LV.voices[t].find(x => x.env.v1 === 0 && x.env.t1 > tick);
        if (fv) c = { id: fv.f.id, k: 'fade' };
      }
    }
    snap.push(c);
  }
  LV.bars.set(tick / 32, snap);
  if (LV.bars.size > 48) LV.bars.delete(LV.bars.keys().next().value);
}
/* a scene part can name the MC-707 clip it plays on; otherwise the track follows the kind of part (when automatic switching is on) */
/* the clip each Live scene played on each track when its setting is Random, for Capture to Song (scene:track) */
export const LV_RCLIP = {};
/**
 * Switch track t to the clip a scene part asks for: a clip number, 'random' (any of the track's
 * clips, a different one each time when it can) or nothing (the track stays as it is). Live Mode
 * keeps its own clip choices: Song Mode's automatic switching does not apply here. A track a scene
 * pinned goes back to the clip for its own kind of part when the next scene leaves it as is.
 */
export function lvCellClip(t, cell, time) {
  if (!devOn(t) || lvUserOwns(t)) return;
  const n = cmFix()[t].n;
  let k = cell ? cell.clip : null;
  if (k === 'random') {
    const cur = PCLAST[t];
    k = n > 1 ? Math.floor(Math.random() * n) : null;
    if (k != null && k === cur) k = (k + 1 + Math.floor(Math.random() * (n - 1))) % n;
    if (k != null) LV_RCLIP[LV.scenes.indexOf(LV.scenes.find(s => s.cells[t] === cell)) + ':' + t] = k;
  }
  if (k != null && k >= 0 && k < n) {
    CLIPPIN[t] = k;
    if (PCLAST[t] !== k) sendClip(t, k, time);
  } else if (CLIPPIN[t] != null) {
    delete CLIPPIN[t];
    delete PCLAST[t];
    const f = cell && facById(cell.id),
      h = f ? clipFor(t, patType(f)) : -1;
    if (h >= 0) sendClip(t, h, time);
  }
}
export function liveScene(idx, tick, hard, len) {
  const prev = LV.scenes[LV.cur],
    sc = LV.scenes[idx];
  if (!sc || lvIsFlash(sc)) return;
  const jump = sc.e - (prev ? prev.e : 0);
  const base = hard || LV.entry === 'hard' ? 0 : ENTRY_TICKS[LV.entry] || 32;
  const toneFade = jump >= 4 ? Math.min(base, 8) : base;
  LV.gap = null;
  LV.thin = null;
  LV.bov = null;
  if (LV.blend) {
    LV.blend = null;
    lvApplyGain(tick);
  }
  /* an auto mute for a bar that was cut short: its track comes back now, not never */
  let back = false;
  for (const c of LV.cues)
    if (c.type === 'mute' && c.auto && !c.on)
      for (const t of c.tracks) if (LV.mute[t]) ((LV.mute[t] = false), (back = true));
  if (back) lvApplyGain(tick);
  LV.cues = LV.cues.filter(c => c.type !== 'guestOut' && !(c.type === 'mute' && c.auto));
  if (hard) {
    lvSlam(AU.ctx ? AU.ctx.currentTime : 0, a => a.tag !== 'q' && a.tag !== 'fade');
    if (LV.buildFx)
      lvMove({
        id: 'dropthrow',
        tag: 'drop',
        tracks: tracksFor([2]),
        cc: 91,
        kind: 'ramp',
        from: 110,
        to: 'rest',
        curve: 'log',
        start: tick,
        end: tick + 16
      });
    if (LV.energy < 8) {
      LV.energy = 8;
      lvApplyGain(tick);
    }
    const im = lvPool(lvStyle(), 'impact');
    const f = im.length ? facById(lvRand(im)) : null;
    if (f) LV.impact = { tick, f };
    LV.dropTick = tick;
  }
  LV.cur = idx;
  LV.sceneStart = tick;
  /* the new scene's progression: a part of another progression that is leaving stops at once instead of fading over it */
  const newProg =
    [4, 3, 5, 7, 6]
      .flatMap(tracksOf)
      .map(t => sc.cells[t] && lvProg(facById(sc.cells[t].id)))
      .find(Boolean) || null;
  /* going down (fewer or calmer parts): drums that leave fade over a beat, and the last notes of the parts
     that leave ring out into the reverb, so a busy scene settles into a quiet one instead of cutting */
  const parts = c => (c ? Array.from({ length: 8 }, (_, t) => c[t]).filter(Boolean).length : 0);
  const down = !hard && LV.entry !== 'hard' && (jump < 0 || parts(sc.cells) < parts(prev && prev.cells)),
    leaving = [];
  for (let t = 0; t < 8; t++) {
    const cell = sc.cells[t],
      tone = S.tracks[t].type === 'tone',
      top = lvTop(t);
    if (lvPinned(t)) {
      LV.pinUnder[t] = cell ? cell.id : null;
      if (!(top && top.f.id === LV.pin[t])) liveReplace(t, LV.pin[t], tick, 0, 0);
      LV.pinUnder[t] = cell ? cell.id : null;
      continue;
    }
    lvCellClip(t, cell, AU.ctx ? AU.ctx.currentTime + 0.1 : 0);
    if (!cell && down && top && !tone) {
      /* drums that leave fade over a beat instead of stopping dead (bass and melodies still stop cleanly on
         the downbeat, and pads and chords fade as below) */
      LV.voices[t].forEach(v => {
        if (v.env.v1 > 0) v.env = mkEnv(envAt(v.env, tick), 0, tick, 8);
      });
      leaving.push(t);
      continue;
    }
    /* melodies that leave (not the bass: reverb on it is mud) ring out into the reverb */
    if (!cell && down && top && lvFadeKind(t) === 'cut' && slotOf(t) !== 3) leaving.push(t);
    if (!cell) {
      const clash = top && newProg && lvProg(top.f) && lvProg(top.f) !== newProg;
      const kind = tone ? lvFadeKind(t) : 'drum';
      /* pads may linger over the change and chords thin out briefly; bass and melodies simply stop on the change */
      if (tone && toneFade > 0 && kind !== 'cut')
        LV.voices[t].forEach(v => {
          if (v.env.v1 > 0) {
            const d = clash ? 4 : kind === 'pad' ? toneFade : Math.min(toneFade, toneFade >= 64 ? 32 : 12);
            v.env = mkEnv(envAt(v.env, tick), 0, tick, d);
            lvFadeOut(t, tick, d);
          }
        });
      else LV.voices[t] = [];
      continue;
    }
    /* the same pattern carries on where it is, so the groove and the progression do not jump back to bar 1 */
    if (top && top.f.id === cell.id) continue;
    liveReplace(
      t,
      cell.id,
      tick,
      tone ? toneFade : 0,
      top ? (tone ? toneFade : 0) : tone ? toneFade : jump >= 4 ? 0 : base
    );
  }
  /* a lift played shorter than its build (Build → Drop for 4 bars of an 8-bar build): the build joins part
     way, so it still peaks right on the drop */
  if (len && sc.kind === 'build')
    for (const t in sc.cells) {
      const v = LV.voices[t] && LV.voices[t][0];
      if (v && v.f.id === sc.cells[t].id && v.f.bars > len) v.start = tick - (v.f.bars - len) * 32;
    }
  if (jump >= 4 && !hard && LV.entry !== 'hard') {
    LV.crash = true;
    LV.dropTick = tick;
  }
  /* the leaving parts' last notes ring out into the reverb, then their send goes back for next time */
  if (leaving.length && S.sendCC !== false)
    lvMove({
      id: 'leavetail',
      tag: 'scene',
      tracks: leaving,
      cc: 91,
      kind: 'ramp',
      from: 90,
      to: 'rest',
      curve: 'log',
      start: tick,
      end: tick + 48
    });
  /* a step down lands softly: the tone parts that stay get a short reverb tail across the change */
  if (jump <= -2 && LV.buildFx && !hard)
    lvMove({
      id: 'landthrow',
      tag: 'scene',
      tracks: toneTracksAll().filter(t => sc.cells[t]),
      cc: 91,
      kind: 'ramp',
      from: 96,
      to: 'rest',
      curve: 'log',
      start: tick,
      end: tick + 24
    });
  if (LV.rise && tick >= LV.rise.start && LV.rise.end > tick) lvRiseReset(tick);
  lvSceneFx(sc, tick);
  LV.hist.push({ tick, idx, start: tick, ids: lvIds() });
  if (LV.hist.length > 16) LV.hist.shift();
  lvLog(tick);
  LV.ver++;
}
function lvRiseReset(tick) {
  const r = LV.rise;
  if (!r) return;
  LV.rise = null;
  lvTracksFor(r.target).forEach(t =>
    lvUserOwns(t) ? 0 : sendMidi([0xb0 | (S.tracks[t].ch - 1), r.cc, LV.rest[r.cc - 80]], AU.ctx.currentTime)
  );
  LV.knobs[r.cc - 80] = LV.rest[r.cc - 80];
  knobUI(r.cc - 80, LV.rest[r.cc - 80]);
}
function lvRiseTick(tick, nt) {
  const r = LV.rise;
  if (!r || tick < r.start || tick % 2) return;
  if (tick >= r.end) {
    lvRiseReset(tick);
    return;
  }
  const u = (tick - r.start) / (r.end - r.start),
    v = Math.round(r.from + (r.to - r.from) * u);
  lvTracksFor(r.target).forEach(
    t => lvUserOwns(t) || sendMidi([0xb0 | (S.tracks[t].ch - 1), r.cc, clamp(v, 0, 127)], nt)
  );
  knobUI(r.cc - 80, clamp(v, 0, 127));
}
function liveFire(c, tick) {
  if (c.type === 'scene') liveScene(c.idx, tick, c.hard, c.len);
  else if (c.type === 'gap') {
    if (LV.cues.some(x => x.type === 'scene')) LV.gap = c.tick;
  } else if (c.type === 'thin') {
    if (LV.cues.some(x => x.type === 'scene')) LV.thin = c.tick;
  } else if (c.type === 'bov') LV.bov = { f: c.f, start: c.tick, end: c.end, off: c.off };
  else if (c.type === 'moves') lvBuildMoves(c.tick, c.end, 'bd');
  else if (c.type === 'brk') lvBreakStart(c.b, tick);
  else if (c.type === 'guest') {
    if (!lvTop(c.t)) {
      liveReplace(c.t, c.id, tick, 0, 16);
      lvHistMark(tick);
      lvLog(tick);
    }
  } else if (c.type === 'guestOut') {
    const v = lvTop(c.t);
    if (v && v.f.id === c.id) {
      /* a guest melody stops at the end of its phrase; a guest pad fades */
      if (lvFadeKind(c.t) === 'pad') {
        v.env = mkEnv(envAt(v.env, tick), 0, tick, 32);
        lvFadeOut(c.t, tick, 32);
      } else LV.voices[c.t] = [];
      lvHistMark(tick);
      lvLog(tick);
    }
  } else if (c.type === 'swap') {
    for (const t in c.ids)
      if (lvTop(+t))
        liveReplace(+t, c.ids[t], tick, S.tracks[+t].type === 'tone' ? 16 : 0, S.tracks[+t].type === 'tone' ? 16 : 0);
    lvHistMark(tick);
    lvLog(tick);
  } else if (c.type === 'fill') {
    /* a fill always ends on its boundary (the downbeat it leads into) and plays the end of the fill pattern */
    const end = c.end != null && c.end > tick ? c.end : tick + 32;
    LV.fill = { f: c.f, start: tick, end, org: end - c.f.bars * 32 };
  } else if (c.type === 'mute') {
    c.tracks.forEach(t => {
      LV.mute[t] = c.on;
    });
    lvApplyGain(tick);
    lvLog(tick);
  } else if (c.type === 'blend') {
    /* New patterns: the tone parts drop out and the drums carry on */
    LV.blend = { tick };
    lvApplyGain(tick);
    lvHistMark(tick, 'New patterns');
    lvLog(tick);
  } else if (c.type === 'blendDrums') {
    /* halfway: the new set's drums take over, then the whole first scene comes in */
    const sc = LV.scenes[0];
    for (let t = 0; t < 8; t++)
      if (S.tracks[t].type !== 'tone' && sc && sc.cells[t]) liveReplace(t, sc.cells[t].id, tick, 0, 0);
    lvLog(tick);
  } else if (c.type === 'energy') {
    LV.energy = c.n;
    lvApplyGain(tick);
    lvLog(tick);
  } else if (c.type === 'key') {
    LV.key = c.key;
    if (c.mode) LV.mode = c.mode;
    lvLog(tick);
  } else if (c.type === 'stop') {
    /* bass and melodies finish with the phrase; drums, chords and pads fade out over 2 bars, then stop */
    for (let t = 0; t < 8; t++) {
      if (S.tracks[t].type === 'tone' && lvFadeKind(t) === 'cut') {
        LV.voices[t] = [];
        continue;
      }
      let fading = false;
      LV.voices[t].forEach(v => {
        if (v.env.v1 > 0) {
          v.env = mkEnv(envAt(v.env, tick), 0, tick, 64);
          fading = true;
        }
      });
      if (fading) lvFadeOut(t, tick, 64);
    }
    LV.stopAt = tick + 64;
  }
  LV.ver++;
}
export function lvSwapCue(group, tick) {
  const ids = {};
  tracksFor(SWG[group]).forEach(t => {
    const v = lvTop(t);
    if (!v) return;
    /* only patterns that fit the progression playing on the other tracks (wider pool if the flavour has none) */
    const free = !lvProg(v.f);
    let fit = lvFitIds(t, liveSwapIds(t), v.f.id, free);
    if (!fit.length)
      fit = lvFitIds(t, lvPool(lvStyle(), t === trackOf(0) && oneKit() ? 'full' : poolOf(t)), v.f.id, free);
    if (!fit.length) return;
    ids[t] = lvRand(fit);
  });
  if (!Object.keys(ids).length) return null;
  LV.cues = LV.cues.filter(c => !(c.type === 'swap' && c.group === group));
  const c = { type: 'swap', group, ids, tick };
  LV.cues.push(c);
  lvSortCues();
  LV.ver++;
  return c;
}
function liveAutoStep(tick, rel) {
  const sc = LV.scenes[LV.cur];
  if (!sc || LV.stopAt != null) return;
  const loop = sc.bars * 32,
    total = lvAutoTotal(sc);
  const pend = LV.cues.some(c => c.type === 'scene' || c.type === 'blend');
  /* the next scene is chosen when this one starts, so it shows on the timeline from then on */
  if (!pend && !LV.jam) lvAutoPlan();
  /* two bars before the scene's planned end; or, when that moment was missed (auto-pilot switched on
     late, or a cue of yours was waiting then), at the next bar line, landing on a loop's end at least two
     bars away, so a scene never plays on forever */
  if (!pend && rel >= total - 64 && LV.apCued !== LV.sceneStart) {
    LV.apCued = LV.sceneStart;
    /* the next scene on the journey (or, now and then at a breakdown, fresh patterns) */
    const plan = lvAutoPlan(),
      first = plan && plan.list[0],
      idx = first ? first.idx : lvAutoPick(),
      fire = LV.sceneStart + Math.max(total, Math.ceil((rel + 64) / loop) * loop),
      nx = LV.scenes[idx];
    if (first ? first.fresh && lvAutoFresh(nx.kind, true) : lvAutoFresh(nx.kind)) {
      /* the blend brings the new set in; the journey picks up again after it */
      LV.apPlan = null;
      LV.apCued = null;
      LV.ver++;
      return;
    }
    if (first) lvAutoPlanUsed(fire);
    else lvAutoPlayed(idx);
    const built = lvAutoBuild(sc, nx, fire);
    const hard = nx.e - sc.e >= 4 && lvDropExtras(fire);
    LV.cues.push({ type: 'scene', idx, tick: fire, hard: hard || undefined, turned: true });
    lvAutoKey(sc, nx, fire);
    if (nx.kind === 'strip') lvAutoMove(sc, fire, true);
    if (
      !hard &&
      !built &&
      LV.fills &&
      sc.cells[trackOf(0)] &&
      nx.cells[trackOf(0)] &&
      nx.e >= sc.e &&
      LV.fillIds.length
    ) {
      const f = facById(lvRand(LV.fillIds));
      if (f) LV.cues.push({ type: 'fill', tick: fire - 32, end: fire, f, auto: true });
    }
    lvSortCues();
    LV.ver++;
  } else if (rel > 0 && rel % loop === 0 && rel < total - 64) {
    const nxt = tick + loop;
    lvAutoMove(sc, nxt, false);
    if (Math.random() >= (LV.chaos / 100) * 0.6) return;
    /* everything lands on the end of this loop: a break or fill leads into the next pass, a swap starts with it */
    if (Math.random() < 0.3 && lvAutoFlash(nxt)) LV.ver++;
    else if (Math.random() < 0.25 && LV.fillIds.length && sc.cells[trackOf(0)]) {
      const f = facById(lvRand(LV.fillIds));
      if (f) {
        LV.cues.push({ type: 'fill', tick: nxt - 32, end: nxt, f });
        lvSortCues();
        LV.ver++;
      }
    } else if (nxt < LV.sceneStart + total) lvSwapCue(lvRand(['drums', 'bass', 'chords', 'lead', 'perc']), nxt);
  }
}
/* turn a note from a minor-family pattern into major (or the reverse), relative to the current key */
export function lvModeNote(n) {
  const r = (((n - LV.key) % 12) + 12) % 12;
  if (LV.mode === 'major') return r === 3 || r === 8 || r === 10 ? n + 1 : n;
  return r === 4 || r === 9 || r === 11 ? n - 1 : n;
}
/* Repeat variation: when a pattern comes round again it changes a little, more often the higher Variation is. */
function lvVarOf(v, t, k, L) {
  const s = slotOf(t),
    th = trackOf(1),
    X = lvExtreme(),
    rolls = (s === 1 || (s === 0 && !(th >= 0 && LV.voices[th].some(x => x.env.v1 > 0)))) && lvTrapRolls();
  if (LV.lock || k < 1 || s === 5 || s === 2) return null;
  const off = LV.vary <= 0 || (!X && L < 64 && k % 2 === 0);
  if (off && !rolls) return null;
  if (v._vk === k) return v._vt;
  const hs = (hashStr(v.f.id + ':' + t) + Math.imul(k, 2654435761)) >>> 0;
  /* trap-family hats roll whatever Variation is set to */
  let ty = rolls ? lvTrapRoll(v, t, hs) : null;
  if (ty || off) ty = ty || null;
  else if (X) ty = (hs % 1000) / 1000 < 0.6 + (LV.vary - 100) / 62 ? lvXType(v, t, hs) : null;
  else if ((hs % 1000) / 1000 < (LV.vary / 100) * 0.8) {
    const o =
      s === 0
        ? ['ghost', 'kickx', 'open']
        : s === 1
          ? ['open', 'thin']
          : s === 3
            ? ['oct', 'run', 'thin', 'echo']
            : ['oct', 'run', 'echo', 'thin', 'up'];
    ty = o[(hs >>> 11) % o.length];
  }
  v._vk = k;
  v._vt = ty;
  return ty;
}
function lvVarExtra(t, v, vt, local, L, nt, td, g) {
  if (vt === 'run' && local === L - 8) {
    const f = v.f,
      first = f.notes.filter(n => n.s < 1).map(n => n.n);
    if (!f.notes.length) return;
    let tgt = (first.length ? Math.min(...first) : f.notes[0].n) + (v.sh || 0);
    if (f.key && lvModeFam(f.key.scale) !== LV.mode) tgt = lvModeNote(tgt);
    const sc = SCALES[LV.mode === 'major' ? 'major' : 'minor'],
      ins = n => sc.includes((((n - LV.key) % 12) + 12) % 12),
      run = [];
    for (let n = tgt - 1; run.length < 4 && n > tgt - 15; n--) if (ins(n)) run.unshift(n);
    run.forEach((nn, i) =>
      i
        ? lvLater(t, clamp(nn, 0, 127), clamp(90 * g, 1, 127), i * 2, 1.6)
        : emitNote(t, clamp(nn, 0, 127), clamp(90 * g, 1, 127), nt, 1.6 * td)
    );
  } else if (vt === 'ghost' && slotOf(t) === 0 && local >= L - 32 && [6, 14, 22, 30].includes(local - (L - 32)))
    emitNote(t, 2, clamp(44 * g, 1, 127), nt, td);
  else if (vt === 'open' && local === L - 4) emitNote(t, 5, clamp(92 * g, 1, 127), nt, 2 * td);
  else if (vt === 'kickx' && slotOf(t) === 0 && local === L - 6) emitNote(t, 0, clamp(104 * g, 1, 127), nt, td);
}
export function liveTick(tick, nt, td) {
  lvLaterTick(tick, nt, td);
  lvFadeTick(tick, nt);
  while (LV.cues.length && LV.cues[0].tick <= tick) liveFire(LV.cues.shift(), tick);
  if (LV.jam && tick >= LV.jam.next) lvJamStep(tick);
  if (riffBusy()) riffTick(tick);
  if (tick % 32 === 0) lvBarSnap(tick);
  if (LV.flash && tick >= LV.flash.end) {
    const fe = LV.flash.end;
    LV.flash = null;
    const im = lvPool(lvStyle(), 'impact');
    const f = im.length ? facById(lvRand(im)) : null;
    if (f) LV.impact = { tick: fe, f };
    lvHistMark(tick);
    lvLog(tick);
    LV.ver++;
  }
  if (LV.stopAt != null && tick >= LV.stopAt) {
    TR.ending = true;
    TR.endTime = nt;
    LV.stopAt = null;
  }
  if (LV.crash) {
    LV.crash = false;
    const tk = trackOf(0);
    if (tk >= 0 && !S.tracks[tk].mute && !lvUserOwns(tk)) emitNote(tk, 9, 110, nt, 0.5);
  }
  const rel = tick - LV.sceneStart;
  if (rel % 32 === 0) {
    for (let t = 0; t < 8; t++) LV.voices[t] = LV.voices[t].filter(v => !(v.env.v1 === 0 && tick >= v.env.t1));
    if (!LV.lock && !LV.jam && (LV.auto || LV.vary > 0)) {
      const before = new Set(LV.cues);
      if (LV.auto) liveAutoStep(tick, rel);
      if (LV.vary > 0) liveVaryStep(tick, rel);
      LV.cues.forEach(c => {
        if (!before.has(c)) c.gen = true;
      });
    }
    const ms = Array.from({ length: 8 }, (_, t) => (lvMaskOff(t, tick) ? 1 : 0)).join('');
    if (ms !== LV.maskSig) {
      LV.maskSig = ms;
      lvLog(tick);
    }
  }
  lvRiseTick(tick, nt);
  lvAutoTick(tick, nt);
  if (LV.gap && tick >= LV.gap) {
    LV.lastTick = tick;
    return;
  }
  const solo = S.tracks.some(t => t.solo);
  const fl = LV.flash && tick >= LV.flash.start ? LV.flash : null;
  const quiet = !!(
    fl ||
    LV.bov ||
    LV.thin ||
    LV.stut ||
    LV.cues.some(c => (c.type === 'gap' || c.type === 'brk' || (c.type === 'scene' && c.hard)) && c.tick - tick <= 40)
  );
  if (LV.impact && tick >= LV.impact.tick) {
    const im = LV.impact;
    LV.impact = null;
    if (tick === im.tick && lvBT() >= 0 && !S.tracks[lvBT()].mute && !lvUserOwns(lvBT())) {
      const evs = patIndex(im.f).get(0);
      if (evs) for (const n of evs) emitNote(lvBT(), n.n, n.v, nt, 0.4);
      LV.pulse[lvBT()] = { time: nt, v: 1 };
    }
  }
  if (LV.bov && tick >= LV.bov.end) LV.bov = null;
  if (LV.fill && tick >= LV.fill.end) LV.fill = null;
  const ft = LV.stut
    ? LV.stut.press - LV.stut.len + ((((tick - LV.stut.press) % LV.stut.len) + LV.stut.len) % LV.stut.len)
    : tick;
  let fft = ft;
  if (fl && fl.kind === 'stutter') {
    const u = (tick - fl.start) / fl.len,
      seg = fl.len >= 32 ? (u < 0.5 ? 8 : u < 0.75 ? 4 : 2) : u < 0.5 ? 4 : 2;
    fft = fl.start - seg + ((((tick - fl.start) % seg) + seg) % seg);
  }
  if (fl && (fl.kind === 'roll' || fl.kind === 'drop')) lvRollTick(fl, tick, nt, td);
  /* Gate chop plays the loop only on the gate's 16ths, cut short; Half-time plays it at half speed */
  const fk = fl && fl.loop ? fl.kind : '',
    fr = fl ? tick - fl.start : 0;
  const hush = (fk === 'half' && fr % 2 !== 0) || (fk === 'gate' && LV_GATE[(fr >> 1) & 15] !== 'x');
  /* Chord lock: the chord playing now, worked out once this tick when a lead or pluck needs it */
  let chordNow;
  const chord = () => (chordNow === undefined ? (chordNow = lvChordNow(ft)) : chordNow);
  const durK = fk === 'half' ? 2 : 1,
    durMax = fk === 'gate' ? 1.6 * td : Infinity;
  for (let t = 0; t < 8; t++) {
    const trk = S.tracks[t];
    if (trk.mute || (solo && !trk.solo) || lvUserOwns(t)) continue;
    const tg = envAt(LV.tg[t], tick);
    if (tg <= 0.01) continue;
    const tone = trk.type === 'tone';
    if (LV.thin && tick >= LV.thin && (slotOf(t) === 0 || slotOf(t) === 3)) continue;
    if (!fl && t === lvBT() && LV.bov && tick >= LV.bov.start) {
      const f = LV.bov.f,
        L = f.bars * 32,
        evs = patIndex(f).get((tick - LV.bov.start + LV.bov.off) % L);
      if (evs) {
        for (const n of evs) emitNote(lvBT(), n.n, n.v, nt + subTick(n) * (TR.subTd || td), n.l * 2 * td);
        LV.pulse[lvBT()] = { time: nt, v: 1 };
      }
      continue;
    }
    if (!fl && t === trackOf(0) && LV.fill && tick >= LV.fill.start) {
      const f = LV.fill.f,
        L = f.bars * 32,
        evs = patIndex(f).get((((ft - LV.fill.org) % L) + L) % L);
      if (evs) {
        for (const n of evs)
          emitNote(t, n.n, clamp(n.v * tg, 1, 127), nt + subTick(n) * (TR.subTd || td), n.l * 2 * td);
        LV.pulse[t] = { time: nt, v: 1 };
      }
      continue;
    }
    if ((!fl || fl.loop) && lvMaskOff(t, tick)) continue;
    if (hush) continue;
    /* Loop rec: the track you record to is quiet while you play */
    if (riffQuiet(t)) continue;
    /* the solo track left to you (but your own riff plays) */
    if (LV.ctl && LV.ctl.soloOwn && CTL.inp && t === LV.ctl.soloT && !(LV.voices[t][0] && LV.voices[t][0].f.riff))
      continue;
    const vft = fl && fl.kind === 'stutter' ? fft : fk === 'half' ? fl.start + (fr >> 1) : ft;
    for (const v of fl
      ? fl.loop
        ? fl.keep.includes(t)
          ? LV.voices[t]
          : []
        : fl.v[t]
          ? [fl.v[t]]
          : []
      : LV.voices[t]) {
      const g = envAt(v.env, tick) * tg;
      if (g <= 0.02) continue;
      const L = v.f.bars * 32,
        local = (((vft - v.start) % L) + L) % L;
      /* variations change the app's parts, never your own riff */
      const vt = quiet || v.f.riff ? null : lvVarOf(v, t, Math.floor((vft - v.start) / L), L),
        last = local >= L - 32;
      if (vt) {
        lvVarExtra(t, v, vt, local, L, nt, td, g);
        lvXExtra(t, v, vt, local, L, nt, td, g);
      }
      const evs = patIndex(v.f).get(local);
      if (!evs) continue;
      if (tone && v.shK !== LV.key) {
        v.sh = shiftFor(v.f, LV.key);
        v.shK = LV.key;
      }
      const conv = tone && v.f.key && lvModeFam(v.f.key.scale) !== LV.mode;
      for (const n of evs) {
        if (vt === 'thin' && local % 8 !== 0 && (local >> 1) % 3 === 1) continue;
        if (vt && lvXSkip(v, vt, local, L, n)) continue;
        let nn = tone ? (conv ? lvModeNote(n.n + (v.sh || 0)) : n.n + (v.sh || 0)) : n.n;
        if (tone && ((vt === 'oct' && last && (local >> 2) & 1) || (vt === 'up' && slotOf(t) >= 6)))
          nn = slotOf(t) === 3 ? (nn + 12 <= 64 ? nn + 12 : nn) : nn + 12;
        if (tone && slotOf(t) >= 6 && LV.chordLock !== false && !v.f.riff) nn = lvLockNote(nn, n.l, local, chord());
        emitNote(
          t,
          tone ? clamp(nn, 0, 127) : nn,
          clamp(n.v * g, 1, 127),
          nt + subTick(n) * (TR.subTd || td),
          Math.min(n.l * 2 * td * durK, durMax)
        );
        if (slotOf(t) === 3) v._last = nn;
        /* the echo plays on its own tick (a dotted 8th later), so it swings with the groove and comes in
           order with the notes around it */
        if (vt === 'echo' && last && tone)
          lvLater(t, clamp(nn, 0, 127), clamp(n.v * g * 0.55, 1, 127), 6 + subTick(n), n.l * 2, lvUserOwns);
      }
      LV.pulse[t] = { time: nt, v: Math.min(1, g) };
    }
  }
  LV.lastTick = tick;
}
export function liveStart(idx) {
  if (BUSY.write) return void toast(BUSY.write);
  lvLaterClear();
  if (REC.on) hooks.recStop();
  stopAll();
  ensureAudio();
  if (!LV.scenes.length) liveBuild();
  let i = clamp(idx == null ? 0 : idx, 0, LV.scenes.length - 1);
  if (lvIsFlash(LV.scenes[i])) {
    const j = LV.scenes.findIndex(s => !lvIsFlash(s));
    if (j >= 0) i = j;
  }
  const sc = LV.scenes[i];
  lvAutoReset();
  lvHumApply(true);
  lvMoodApply();
  Object.assign(TR, { late: 0, lateMax: 0, gapMax: 0, lastRun: 0 });
  Object.assign(TR, {
    playing: true,
    mode: 'live',
    tick: 0,
    nextTime: AU.ctx.currentTime + 0.06,
    vis: [],
    ending: false,
    recEnd: null
  });
  Object.assign(LV, {
    cur: i,
    blend: null,
    sceneStart: 0,
    voices: Array.from({ length: 8 }, () => []),
    cues: [],
    fill: null,
    mute: {},
    energy: 8,
    stut: null,
    rise: null,
    rate: LV.rate || 1,
    tg: Array.from({ length: 8 }, () => mkEnv(1, 1, 0, 0)),
    stopAt: null,
    crash: false,
    gap: null,
    thin: null,
    bov: null,
    impact: null,
    autos: [],
    ccLast: {},
    hist: [],
    log: [],
    lastTick: 0,
    dropTick: null,
    flash: null,
    jam: null,
    bars: new Map(),
    maskSig: '',
    apCued: null,
    apPlan: null
  });
  autoClipReset();
  for (let t = 0; t < 8; t++) {
    const c = sc.cells[t];
    lvCellClip(t, c, TR.nextTime);
    if (c) liveReplace(t, c.id, 0, 0, 0);
    /* a pinned take comes back with the jam */ else if (lvPinned(t)) {
      LV.pinUnder[t] = null;
      liveReplace(t, LV.pin[t], 0, 0, 0);
    }
  }
  lvFadesReset(TR.nextTime);
  LV.autos = [];
  LV.ccLast = {};
  lvSceneFx(sc, 0);
  LV.hist.push({ tick: 0, idx: i, ids: lvIds() });
  lvLog(0);
  if (S.clock && MIDI.out) sendMidi([0xfa], TR.nextTime);
  Object.keys(AUTOLAST).forEach(k => delete AUTOLAST[k]);
  sendTrackCCs();
  /* then Live's own mix (live/mix.js), so its levels, pans and sends win over the song's */
  if (MIDI.out) lvMixSendAll(AU.ctx.currentTime + 0.03);
  TICKER.start();
  sched();
  LV.ver++;
  hooks.updTransport();
}
export function liveCleanup() {
  lvLaterClear();
  try {
    ctlAllOff();
  } catch (e) {}
  if (MIDI.out && AU.ctx) lvFadesReset(AU.ctx.currentTime);
  if (LV.autos && LV.autos.length && MIDI.out && AU.ctx) {
    const nt = AU.ctx.currentTime;
    LV.autos.forEach(a =>
      a.tracks.forEach(t => {
        if (S.sendCC !== false) sendMidi([0xb0 | (S.tracks[t].ch - 1), a.cc, lvRestCC(t, a.cc)], nt);
      })
    );
    LV.autos = [];
    LV.ccLast = {};
  }
  if (TR.mode !== 'live') return;
  try {
    if (LV.rise) lvRiseReset(0);
  } catch (e) {}
  LV.stut = null;
  LV.held = {};
}
export function liveStop() {
  LV.jam = null;
  riffStopped();
  if (TR.playing && TR.mode === 'live') stopPlay();
}
/** The Start Jam / End Jam button (and Space): an intro into the first scene, or an outro to the end. */
export function liveToggle(e) {
  if (TR.playing && TR.mode === 'live') liveJamEnd();
  else liveJamStart(!!(e && e.shiftKey));
}
