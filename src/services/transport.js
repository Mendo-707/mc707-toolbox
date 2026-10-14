import { clamp } from '../core/dom.js';
import { devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { clipAt, patIndex, songEnd } from '../core/song-model.js';
import { AU, DRUMS, click, ensureAudio, voice } from './synth.js';
import { MIDI, panic, sendMidi } from './midi.js';
import { CMK, PCLAST, autoClip, autoClipReset, sendClip, songClipTick } from '../clips/clip-map.js';
import { updPlayhead, updTransport } from '../clips/clips-screen.js';
import { facById, shiftFor } from '../library/index.js';
import { REC, recStop } from '../song/recording-midi.js';
import { AUTOLAST, autoCC, sendTrackCCs, tickDurAt, velMul } from '../song/automation.js';
import { wizCellAt } from '../song/wizard-plan.js';
import { LV } from '../live/state.js';
import { liveCleanup, liveTick } from '../live/engine.js';
import { vizNote } from '../live/visualizer.js';

/* ---------- transport ---------- */
export const TR = {
  playing: false,
  mode: 'song',
  tick: 0,
  nextTime: 0,
  timer: null,
  vis: [],
  pat: null,
  patTrack: 0,
  ending: false,
  endTime: 0
};
const playBpm = () =>
  TR.mode === 'live'
    ? LV.bpm
    : TR.mode === 'wiz' && TR.wz && TR.wz.bpm
      ? TR.wz.bpm
      : TR.mode === 'pat' && TR.patBpm
        ? TR.patBpm
        : S.bpm;
const playSwing = () =>
  TR.mode === 'live'
    ? LV.swing
    : TR.mode === 'wiz' && TR.wz && TR.wz.swing != null
      ? TR.wz.swing
      : TR.mode === 'pat' && TR.patSwing != null
        ? TR.patSwing
        : S.swing;
export const tickDur = () => 60 / playBpm() / 8;
export function emitNote(ti, nn, v, time, dur, noMidi) {
  if (!devOn(ti)) return;
  const t = S.tracks[ti];
  if (t.vol <= 0) return;
  const vel = clamp(Math.round((v * t.vol) / 100), 1, 127);
  const isD = t.type === 'drum';
  const pitch = isD ? S.drumMap[nn] : clamp(nn + (TR.mode === 'live' ? 0 : S.transpose || 0), 0, 127);
  const tm = time + (t.nudge || 0) / 1000 + (t.hum ? ((Math.random() * 2 - 1) * t.hum) / 1000 : 0);
  if (MIDI.out && !noMidi) {
    const mt = tm + (S.midiOffset || 0) / 1000;
    sendMidi([0x90 | (t.ch - 1), pitch, vel], mt);
    sendMidi([0x80 | (t.ch - 1), pitch, 0], mt + Math.max(dur, 0.03));
  }
  if (TR.mode === 'live' && typeof vizNote === 'function') vizNote(ti, isD ? nn : pitch, vel, time, dur);
  if (S.preview) {
    if (isD) {
      const fn = DRUMS[nn];
      if (fn) fn(tm, vel / 127);
    } else voice(ti, pitch, tm, dur, vel);
  }
}
export function audition(ti, nn, v = 100) {
  ensureAudio();
  emitNote(ti, nn, v, AU.ctx.currentTime + 0.005, 0.22);
}
export function processTick(tick, time) {
  const td = TR.mode === 'song' ? tickDurAt(tick / 32) : tickDur();
  if (S.clock && MIDI.out) {
    sendMidi([0xf8], time);
    sendMidi([0xf8], time + td / 3);
    sendMidi([0xf8], time + (td * 2) / 3);
  }
  if (S.metro && tick % 8 === 0) click(time, tick % 32 === 0);
  const swing = tick % 2 === 0 && (tick / 2) % 2 === 1 ? (playSwing() / 100 - 0.5) * 2 * (td * 2) : 0;
  const nt = time + swing;
  if (TR.mode === 'song') {
    if (tick % 32 === 0 && MIDI.out) {
      const mb = tick / 32;
      for (const m of S.markers)
        if (m.scene != null && m.bar === mb) sendMidi([0xc0 | ((S.ctrlCh || 16) - 1), m.scene], time);
    }
    songClipTick(tick, time);
    const solo = S.tracks.some(t => t.solo);
    const bar = tick / 32;
    for (let ti = 0; ti < 8; ti++) {
      const t = S.tracks[ti];
      if (t.mute || (solo && !t.solo)) continue;
      const c = clipAt(ti, bar);
      if (!c || c.mute) continue;
      const p = S.patterns[c.pat];
      if (!p) continue;
      const Lc = Math.round((c.ll || p.bars) * 32);
      const local = (((tick - Math.round(c.start * 32) + Math.round(c.off * 32)) % Lc) + Lc) % Lc;
      if (c.cc && c.cc.pts && c.cc.pts.length && tick % 2 === 0) autoCC(ti, c, tick, time);
      if (c.pc != null && tick === Math.round(c.start * 32)) {
        if (c.pc < 16) sendClip(ti, c.pc, time + 0.004);
        else sendMidi([0xc0 | (t.ch - 1), clamp(c.pc, 0, 127)], time);
      } else if (c.pc == null && S.clipAuto && (tick === Math.round(c.start * 32) || PCLAST[ti] == null))
        autoClip(ti, p, time);
      const evs = patIndex(p).get(local);
      if (!evs) continue;
      const maxT = (c.start + c.len) * 32 - tick;
      const tone = t.type === 'tone',
        trs = c.tr || 0,
        vm = ((c.vel || 100) / 100) * (c.fi || c.fo || c.ve ? velMul(c, tick / 32 - c.start) : 1);
      for (const n of evs)
        emitNote(ti, tone ? clamp(n.n + trs, 0, 127) : n.n, n.v * vm, nt, Math.min(n.l * 2, maxT) * td);
    }
  } else if (TR.mode === 'wiz') {
    const wz = TR.wz;
    const bar = Math.floor(tick / 32);
    const sec = wz.plan.sections.find(x => bar >= x.start && bar < x.start + x.bars);
    if (sec) {
      const rel = bar - sec.start;
      for (let t = 0; t < 8; t++) {
        const at = wizCellAt(sec, t, rel);
        if (!at) continue;
        const f = facById(at.id);
        if (!f) continue;
        const L = f.bars * 32;
        const local = (((tick - (sec.start + at.off) * 32) % L) + L) % L;
        const evs = patIndex(f).get(local);
        if (!evs) continue;
        const sh = f.type === 'tone' ? shiftFor(f, wz.key) : 0;
        for (const n of evs) emitNote(t, f.type === 'tone' ? clamp(n.n + sh, 0, 127) : n.n, n.v, nt, n.l * 2 * td);
      }
    }
  } else if (TR.mode === 'live') {
    liveTick(tick, nt, td);
  } else {
    const p = TR.pat;
    const evs = patIndex(p).get(tick);
    if (evs)
      for (const n of evs)
        emitNote(TR.patTrack, TR.patShift ? clamp(n.n + TR.patShift, 0, 127) : n.n, n.v, nt, n.l * 2 * td);
  }
  TR.vis.push({ time, tick, dur: td });
}
export function advance() {
  TR.nextTime += TR.mode === 'song' ? tickDurAt(TR.tick / 32) : tickDur();
  TR.tick++;
  if (TR.mode === 'song') {
    const rcd = TR.recEnd != null;
    const endT = rcd ? TR.recEnd : (S.loop.on ? S.loop.end : songEnd()) * 32;
    if (TR.tick >= endT) {
      if (S.loop.on && !rcd) TR.tick = S.loop.start * 32;
      else {
        TR.ending = true;
        TR.endTime = TR.nextTime;
      }
    }
  } else if (TR.mode === 'wiz') {
    const wz = TR.wz;
    if (TR.tick >= wz.endTick) {
      if (wz.loop) TR.tick = wz.startTick;
      else {
        TR.ending = true;
        TR.endTime = TR.nextTime;
      }
    }
  } else if (TR.mode === 'live') {
    /* runs until stopped */
  } else if (TR.tick >= (TR.loopB || TR.pat.bars * 32)) TR.tick = TR.loopA || 0;
}
export function sched() {
  const ctx = AU.ctx;
  if (TR.ending) {
    if (ctx.currentTime >= TR.endTime) stopPlay();
    return;
  }
  const horizon = ctx.currentTime + 0.12;
  while (TR.nextTime < horizon && !TR.ending) {
    processTick(TR.tick, TR.nextTime);
    advance();
  }
}
/* Transport timer. Runs in a Worker so it keeps time when the window is in the background. */
export const TICKER = (() => {
  let w = null,
    fb = null,
    on = false;
  const fallback = () => {
    w = null;
    if (on) {
      clearInterval(fb);
      fb = setInterval(sched, 25);
    }
  };
  try {
    const src = 'let t=null;onmessage=e=>{clearInterval(t);t=null;if(e.data)t=setInterval(()=>postMessage(0),25);};';
    w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = () => {
      if (on && TR.playing) sched();
    };
    w.onerror = e => {
      try {
        e.preventDefault();
      } catch (_) {}
      fallback();
    };
  } catch (e) {
    w = null;
  }
  return {
    start() {
      on = true;
      clearInterval(fb);
      if (w) w.postMessage(1);
      else fb = setInterval(sched, 25);
    },
    stop() {
      on = false;
      clearInterval(fb);
      if (w) w.postMessage(0);
    }
  };
})();
export function startSong(rec) {
  if (REC.on) recStop();
  stopAll();
  ensureAudio();
  let tick = Math.round(S.cursor * 32);
  if (S.loop.on && tick >= S.loop.end * 32) tick = S.loop.start * 32;
  if (!S.loop.on && tick >= songEnd() * 32) tick = 0;
  Object.assign(TR, {
    playing: true,
    mode: 'song',
    tick,
    nextTime: AU.ctx.currentTime + 0.06,
    vis: [],
    ending: false,
    recEnd: rec && rec.endTick != null ? rec.endTick : null
  });
  if (S.clock && MIDI.out) {
    if (tick === 0) sendMidi([0xfa], TR.nextTime);
    else {
      const spp = Math.round(tick / 2);
      sendMidi([0xf2, spp & 127, (spp >> 7) & 127], TR.nextTime);
      sendMidi([0xfb], TR.nextTime);
    }
  }
  Object.keys(AUTOLAST).forEach(k => delete AUTOLAST[k]);
  sendTrackCCs();
  autoClipReset();
  CMK.last = -9;
  TICKER.start();
  sched();
  updTransport();
}
export function startPat(p, ti, range, shift, bpm, swing) {
  stopAll();
  ensureAudio();
  Object.assign(TR, {
    playing: true,
    mode: 'pat',
    pat: p,
    patTrack: ti,
    patShift: shift || 0,
    patBpm: bpm || null,
    patSwing: swing == null ? null : swing,
    loopA: range ? range[0] * 32 : 0,
    loopB: range ? range[1] * 32 : p.bars * 32,
    tick: range ? range[0] * 32 : 0,
    nextTime: AU.ctx.currentTime + 0.06,
    vis: [],
    ending: false
  });
  TICKER.start();
  sched();
  updTransport();
}
export function stopAll() {
  if (!TR.playing) return;
  TICKER.stop();
  TR.playing = false;
  if (AU.ctx && (TR.mode === 'song' || TR.mode === 'live') && S.clock && MIDI.out) sendMidi([0xfc], AU.ctx.currentTime);
  if (typeof liveCleanup === 'function') liveCleanup();
  panic();
  updTransport();
}
export function stopPlay() {
  stopAll();
  updPlayhead(S.cursor);
}
export function togglePlay() {
  if (TR.playing && TR.mode === 'song') stopPlay();
  else startSong();
}
export function fmtPos(bars) {
  const b = Math.floor(bars);
  const beat = Math.floor((bars - b) * 4);
  const st = Math.floor(((bars - b) * 16) % 4);
  return b + 1 + '.' + (beat + 1) + '.' + (st + 1);
}
