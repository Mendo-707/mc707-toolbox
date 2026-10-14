import { clamp } from '../core/dom.js';
import { SCALES } from '../core/theory.js';
import { devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { TRACK_POOLS, facById, shiftFor } from '../library/index.js';
import { patIndex } from '../core/song-model.js';
import { AU, ensureAudio } from '../services/synth.js';
import { MIDI, sendMidi } from '../services/midi.js';
import { REC, TICKER, TR, emitNote, sched, stopAll, stopPlay } from '../services/transport.js';
import { CLIPPIN, PCLAST, autoClip, autoClipReset, cmFix, sendClip } from '../services/clip-switch.js';
import { hashStr } from '../core/random.js';
import { AUTOLAST, sendTrackCCs } from '../services/mc-controls.js';
import { LV, LV_PRI, SWG, envAt, lvBT, lvRand, lvStyle, mkEnv } from './state.js';
import { lvIsFlash, lvTracksFor } from './themes.js';
import { lvAutoTick, lvBuildMoves, lvMove, lvRestCC, lvSceneFx, lvSlam } from './moves.js';
import { lvAutoFlash, lvBreakStart, lvRollTick } from './breaks.js';
import { lvMaskOff } from './scene-templates.js';
import { lvModeFam, lvPool, lvProg } from '../library/pools.js';
import { liveBuild, liveSwapIds } from './pools.js';
import { liveVaryStep, lvDropExtras, lvSortCues } from './cues.js';
import { CTL, ctlAllOff } from './controller.js';
import { hooks } from '../core/hooks.js';

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
export const lvEmute = t => LV_PRI.indexOf(t) >= LV.energy;
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
export function liveReplace(t, id, tick, fade, entry) {
  const f = facById(id);
  if (!f) return;
  if (S.clipAuto) autoClip(t, f, AU.ctx ? AU.ctx.currentTime + 0.1 : 0);
  const tone = S.tracks[t].type === 'tone';
  if (tone && fade > 0)
    LV.voices[t].forEach(v => {
      if (v.env.v1 > 0) v.env = mkEnv(envAt(v.env, tick), 0, tick, fade);
    });
  else LV.voices[t] = [];
  LV.voices[t].push({ f, start: tick, env: entry > 0 ? mkEnv(0, 1, tick, entry) : mkEnv(1, 1, tick, 0) });
}
/* a scene part can name the MC-707 clip it plays on; otherwise the track follows the kind of part (when automatic switching is on) */
export function lvCellClip(t, cell, time) {
  if (!devOn(t)) return;
  if (cell && cell.clip != null && cell.clip < cmFix()[t].n) {
    CLIPPIN[t] = cell.clip;
    if (PCLAST[t] !== cell.clip) sendClip(t, cell.clip, time);
  } else if (CLIPPIN[t] != null) {
    delete CLIPPIN[t];
    delete PCLAST[t];
    if (cell) {
      const f = facById(cell.id);
      if (f) autoClip(t, f, time);
    }
  }
}
export function liveScene(idx, tick, hard) {
  const prev = LV.scenes[LV.cur],
    sc = LV.scenes[idx];
  if (!sc || lvIsFlash(sc)) return;
  const jump = sc.e - (prev ? prev.e : 0);
  const base = hard || LV.entry === 'hard' ? 0 : LV.entry === 'slow' ? 64 : 32;
  const toneFade = jump >= 4 ? Math.min(base, 8) : base;
  LV.gap = null;
  LV.thin = null;
  LV.bov = null;
  LV.cues = LV.cues.filter(c => c.type !== 'guestOut' && !(c.type === 'mute' && c.auto));
  if (hard) {
    lvSlam(AU.ctx ? AU.ctx.currentTime : 0, a => a.tag !== 'q');
    if (LV.buildFx)
      lvMove({
        id: 'dropthrow',
        tag: 'drop',
        tracks: [2],
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
  for (let t = 0; t < 8; t++) {
    const cell = sc.cells[t],
      tone = S.tracks[t].type === 'tone',
      top = lvTop(t);
    lvCellClip(t, cell, AU.ctx ? AU.ctx.currentTime + 0.1 : 0);
    if (!cell) {
      if (tone && toneFade > 0)
        LV.voices[t].forEach(v => {
          if (v.env.v1 > 0) v.env = mkEnv(envAt(v.env, tick), 0, tick, toneFade);
        });
      else LV.voices[t] = [];
      continue;
    }
    if (top && top.f.id === cell.id) {
      top.start = tick;
      continue;
    }
    liveReplace(
      t,
      cell.id,
      tick,
      tone ? toneFade : 0,
      top ? (tone ? toneFade : 0) : tone ? toneFade : jump >= 4 ? 0 : base
    );
  }
  if (jump >= 4 && !hard && LV.entry !== 'hard') {
    LV.crash = true;
    LV.dropTick = tick;
  }
  if (LV.rise && tick >= LV.rise.start && LV.rise.end > tick) lvRiseReset(tick);
  lvSceneFx(sc, tick);
  LV.hist.push({ tick, idx, ids: lvIds() });
  if (LV.hist.length > 8) LV.hist.shift();
  lvLog(tick);
  LV.ver++;
}
function lvRiseReset(tick) {
  const r = LV.rise;
  if (!r) return;
  LV.rise = null;
  lvTracksFor(r.target).forEach(t =>
    sendMidi([0xb0 | (S.tracks[t].ch - 1), r.cc, LV.rest[r.cc - 80]], AU.ctx.currentTime)
  );
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
  lvTracksFor(r.target).forEach(t => sendMidi([0xb0 | (S.tracks[t].ch - 1), r.cc, clamp(v, 0, 127)], nt));
}
function liveFire(c, tick) {
  if (c.type === 'scene') liveScene(c.idx, tick, c.hard);
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
      lvLog(tick);
    }
  } else if (c.type === 'guestOut') {
    const v = lvTop(c.t);
    if (v && v.f.id === c.id) {
      v.env = mkEnv(envAt(v.env, tick), 0, tick, 32);
      lvLog(tick);
    }
  } else if (c.type === 'swap') {
    for (const t in c.ids)
      if (lvTop(+t))
        liveReplace(+t, c.ids[t], tick, S.tracks[+t].type === 'tone' ? 16 : 0, S.tracks[+t].type === 'tone' ? 16 : 0);
    const h = LV.hist[LV.hist.length - 1];
    if (h) h.ids = lvIds();
    lvLog(tick);
  } else if (c.type === 'fill') LV.fill = { f: c.f, start: tick, end: tick + Math.min(c.f.bars, 2) * 32 };
  else if (c.type === 'mute') {
    c.tracks.forEach(t => {
      LV.mute[t] = c.on;
    });
    lvApplyGain(tick);
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
    for (let t = 0; t < 8; t++)
      LV.voices[t].forEach(v => {
        if (v.env.v1 > 0) v.env = mkEnv(envAt(v.env, tick), 0, tick, 32);
      });
    LV.stopAt = tick + 32;
  }
  LV.ver++;
}
function lvAutoNext() {
  const n = LV.scenes.length,
    reg = [...Array(n).keys()].filter(i => !lvIsFlash(LV.scenes[i]));
  if (!reg.length) return LV.cur;
  let nx = LV.cur + 1;
  while (nx < n && lvIsFlash(LV.scenes[nx])) nx++;
  if (nx >= n) nx = reg.length > 2 ? reg[1] : reg[0];
  if (LV.chaos > 60 && Math.random() < (LV.chaos - 60) / 80) {
    const cand = reg.filter(i => i !== LV.cur && i !== reg[0]);
    if (cand.length) nx = lvRand(cand);
  }
  return nx;
}
export function lvSwapCue(group, tick) {
  const ids = {};
  (SWG[group] || []).forEach(t => {
    const v = lvTop(t);
    if (!v) return;
    const pool = liveSwapIds(t).filter(id => id !== v.f.id);
    if (!pool.length) return;
    const ref = S.tracks[t].type === 'tone' ? lvTop(t === 4 ? 3 : 4) : null,
      prog = ref && lvProg(ref.f);
    let fit = prog
      ? pool.filter(id => {
          const f = facById(id);
          return lvProg(f) === prog && f.bars === ref.f.bars;
        })
      : [];
    if (prog && !fit.length)
      fit = lvPool(lvStyle(), TRACK_POOLS[t]).filter(id => {
        const f = facById(id);
        return id !== v.f.id && lvProg(f) === prog && f.bars === ref.f.bars;
      });
    ids[t] = lvRand(fit.length && Math.random() < 0.8 ? fit : pool);
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
    total = loop * LV.autoReps;
  const pend = LV.cues.some(c => c.type === 'scene');
  if (!pend && rel === total - 64) {
    const idx = lvAutoNext(),
      fire = LV.sceneStart + total,
      nx = LV.scenes[idx];
    const hard = nx.e - sc.e >= 4 && lvDropExtras(fire);
    LV.cues.push({ type: 'scene', idx, tick: fire, hard: hard || undefined });
    if (!hard && LV.fills && sc.cells[0] && nx.cells[0] && nx.e >= sc.e && LV.fillIds.length) {
      const f = facById(lvRand(LV.fillIds));
      if (f) LV.cues.push({ type: 'fill', tick: fire - 32, f, auto: true });
    }
    lvSortCues();
    LV.ver++;
  } else if (rel > 0 && rel % loop === 0 && rel < total - 64 && Math.random() < (LV.chaos / 100) * 0.6) {
    if (Math.random() < 0.3 && lvAutoFlash(tick + loop)) LV.ver++;
    else if (Math.random() < 0.25 && LV.fillIds.length && sc.cells[0]) {
      const f = facById(lvRand(LV.fillIds));
      if (f) {
        LV.cues.push({ type: 'fill', tick: tick + 32, f });
        lvSortCues();
        LV.ver++;
      }
    } else lvSwapCue(lvRand(['drums', 'bass', 'chords', 'lead', 'perc']), tick + 32);
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
  if (LV.lock || LV.vary <= 0 || k < 1 || t === 5 || t === 2 || (L < 64 && k % 2 === 0)) return null;
  if (v._vk === k) return v._vt;
  const hs = (hashStr(v.f.id + ':' + t) + Math.imul(k, 2654435761)) >>> 0;
  let ty = null;
  if ((hs % 1000) / 1000 < (LV.vary / 100) * 0.8) {
    const o =
      t === 0
        ? ['ghost', 'kickx', 'open']
        : t === 1
          ? ['open', 'thin']
          : t === 3
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
    run.forEach((nn, i) => emitNote(t, clamp(nn, 0, 127), clamp(90 * g, 1, 127), nt + i * 2 * td, 1.6 * td));
  } else if (vt === 'ghost' && t === 0 && local >= L - 32 && [6, 14, 22, 30].includes(local - (L - 32)))
    emitNote(0, 2, clamp(44 * g, 1, 127), nt, td);
  else if (vt === 'open' && local === L - 4) emitNote(t, 5, clamp(92 * g, 1, 127), nt, 2 * td);
  else if (vt === 'kickx' && t === 0 && local === L - 6) emitNote(0, 0, clamp(104 * g, 1, 127), nt, td);
}
export function liveTick(tick, nt, td) {
  while (LV.cues.length && LV.cues[0].tick <= tick) liveFire(LV.cues.shift(), tick);
  if (LV.flash && tick >= LV.flash.end) {
    const fe = LV.flash.end;
    LV.flash = null;
    const im = lvPool(lvStyle(), 'impact');
    const f = im.length ? facById(lvRand(im)) : null;
    if (f) LV.impact = { tick: fe, f };
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
    if (!S.tracks[0].mute) emitNote(0, 9, 110, nt, 0.5);
  }
  const rel = tick - LV.sceneStart;
  if (rel % 32 === 0) {
    for (let t = 0; t < 8; t++) LV.voices[t] = LV.voices[t].filter(v => !(v.env.v1 === 0 && tick >= v.env.t1));
    if (!LV.lock && (LV.auto || LV.vary > 0)) {
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
    if (tick === im.tick && !S.tracks[lvBT()].mute) {
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
  for (let t = 0; t < 8; t++) {
    const trk = S.tracks[t];
    if (trk.mute || (solo && !trk.solo)) continue;
    const tg = envAt(LV.tg[t], tick);
    if (tg <= 0.01) continue;
    const tone = trk.type === 'tone';
    if (LV.thin && tick >= LV.thin && (t === 0 || t === 3)) continue;
    if (!fl && t === lvBT() && LV.bov && tick >= LV.bov.start) {
      const f = LV.bov.f,
        L = f.bars * 32,
        evs = patIndex(f).get((tick - LV.bov.start + LV.bov.off) % L);
      if (evs) {
        for (const n of evs) emitNote(lvBT(), n.n, n.v, nt, n.l * 2 * td);
        LV.pulse[lvBT()] = { time: nt, v: 1 };
      }
      continue;
    }
    if (!fl && t === 0 && LV.fill && tick >= LV.fill.start) {
      const f = LV.fill.f,
        evs = patIndex(f).get((ft - LV.fill.start + f.bars * 32 * 8) % (f.bars * 32));
      if (evs) {
        for (const n of evs) emitNote(0, n.n, clamp(n.v * tg, 1, 127), nt, n.l * 2 * td);
        LV.pulse[0] = { time: nt, v: 1 };
      }
      continue;
    }
    if ((!fl || fl.loop) && lvMaskOff(t, tick)) continue;
    if (LV.ctl && LV.ctl.soloOwn && CTL.inp && t === LV.ctl.soloT) continue;
    const vft = fl && fl.kind === 'stutter' ? fft : ft;
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
      const vt = quiet ? null : lvVarOf(v, t, Math.floor((vft - v.start) / L), L),
        last = local >= L - 32;
      if (vt) lvVarExtra(t, v, vt, local, L, nt, td, g);
      const evs = patIndex(v.f).get(local);
      if (!evs) continue;
      if (tone && v.shK !== LV.key) {
        v.sh = shiftFor(v.f, LV.key);
        v.shK = LV.key;
      }
      const conv = tone && v.f.key && lvModeFam(v.f.key.scale) !== LV.mode;
      for (const n of evs) {
        if (vt === 'thin' && local % 8 !== 0 && (local >> 1) % 3 === 1) continue;
        let nn = tone ? (conv ? lvModeNote(n.n + (v.sh || 0)) : n.n + (v.sh || 0)) : n.n;
        if (tone && ((vt === 'oct' && last && (local >> 2) & 1) || (vt === 'up' && t >= 6)))
          nn = t === 3 ? (nn + 12 <= 64 ? nn + 12 : nn) : nn + 12;
        emitNote(t, tone ? clamp(nn, 0, 127) : nn, clamp(n.v * g, 1, 127), nt, n.l * 2 * td);
        if (vt === 'echo' && last && tone)
          emitNote(t, clamp(nn, 0, 127), clamp(n.v * g * 0.55, 1, 127), nt + 6 * td, n.l * 2 * td);
      }
      LV.pulse[t] = { time: nt, v: Math.min(1, g) };
    }
  }
  LV.lastTick = tick;
}
export function liveStart(idx) {
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
    maskSig: ''
  });
  autoClipReset();
  for (let t = 0; t < 8; t++) {
    const c = sc.cells[t];
    lvCellClip(t, c, TR.nextTime);
    if (c) liveReplace(t, c.id, 0, 0, 0);
  }
  LV.autos = [];
  LV.ccLast = {};
  lvSceneFx(sc, 0);
  LV.hist.push({ tick: 0, idx: i, ids: lvIds() });
  lvLog(0);
  if (S.clock && MIDI.out) sendMidi([0xfa], TR.nextTime);
  Object.keys(AUTOLAST).forEach(k => delete AUTOLAST[k]);
  sendTrackCCs();
  TICKER.start();
  sched();
  LV.ver++;
  hooks.updTransport();
}
export function liveCleanup() {
  try {
    ctlAllOff();
  } catch (e) {}
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
  Object.keys(LV.held).forEach(k => {
    if (k.startsWith('sc')) {
      const i = +k.slice(2);
      sendMidi([0x80 | ((S.ctrlCh || 16) - 1), LV.scBase + i, 0], AU.ctx.currentTime);
    }
  });
  LV.held = {};
}
export function liveStop() {
  if (TR.playing && TR.mode === 'live') stopPlay();
}
export function liveToggle() {
  if (TR.playing && TR.mode === 'live') liveStop();
  else liveStart(0);
}
