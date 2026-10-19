// The clock and playback: the tick scheduler (in a Worker so it keeps time in the background),
// playing the song, a single pattern or the wizard preview, sending notes, and the MIDI recording
// state REC.
//
// Owns: TR (the transport), REC (MIDI recording).
// Reads: S, MIDI, AU, PCLAST, CMK, AUTOLAST.
// Calls up the layers through hooks (core/hooks.js).
import { clamp, toast } from '../core/dom.js';
import { devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { facById, shiftFor } from '../library/index.js';
import { patIndex, songEnd, subTick } from '../core/song-model.js';
import { AU, DRUMS, click, ensureAudio, voice } from './synth.js';
import { MIDI, panic, sendMidi } from './midi.js';
import { CMK, PCLAST, autoClip, autoClipReset, sendClip, songClipTick } from './clip-switch.js';
import { AUTOLAST, autoCC, sendTrackCCs, tickDurAt, velMul } from './mc-controls.js';
import { hooks } from '../core/hooks.js';

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
    ? hooks.liveTempo()
    : TR.mode === 'wiz' && TR.wz && TR.wz.bpm
      ? TR.wz.bpm
      : TR.mode === 'pat' && TR.patBpm
        ? TR.patBpm
        : S.bpm;
const playSwing = () =>
  TR.mode === 'live'
    ? hooks.liveSwingAmt()
    : TR.mode === 'wiz' && TR.wz && TR.wz.swing != null
      ? TR.wz.swing
      : TR.mode === 'pat' && TR.patSwing != null
        ? TR.patSwing
        : S.swing;
/** Length of one tick (1/32 bar) in seconds at the current playing tempo. */
export const tickDur = () => 60 / playBpm() / 8;
/**
 * Play a note on a track: sends MIDI to the MC-707 and plays the preview sound. Applies the track's
 * velocity, nudge, humanize, drum map and the song's transpose.
 * @param {number} ti     track 0-7
 * @param {number} nn     drum lane (drum tracks) or MIDI note (tone tracks)
 * @param {number} v      velocity
 * @param {number} time   AU.ctx time
 * @param {number} dur    seconds
 * @param {boolean} [noMidi]  preview sound only
 */
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
  if (TR.mode === 'live' && typeof hooks.vizNote === 'function') hooks.vizNote(ti, isD ? nn : pitch, vel, time, dur);
  if (S.preview) {
    if (isD) {
      const fn = DRUMS[nn];
      if (fn) fn(tm, vel / 127);
    } else voice(ti, pitch, tm, dur, vel);
  }
}
/** Play one note on a track right now (for clicks in the editor). */
export function audition(ti, nn, v = 100) {
  ensureAudio();
  emitNote(ti, nn, v, AU.ctx.currentTime + 0.005, 0.22);
}
/** Everything that happens on one tick in the current mode (song, pattern, wizard or live). Called by sched(). */
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
    for (let ti = 0; ti < 8; ti++) {
      const t = S.tracks[ti];
      if (t.mute || (solo && !t.solo)) continue;
      /* every clip that overlaps this tick: clip edges can sit between ticks (down to 1/256 bar), so a
         clip can start or end part-way through one */
      for (const c of S.clips) {
        if (c.t !== ti || c.mute) continue;
        const c0 = c.start * 32,
          c1 = (c.start + c.len) * 32;
        if (c0 >= tick + 1 - 1e-9 || c1 <= tick + 1e-9) continue;
        const p = S.patterns[c.pat];
        if (!p) continue;
        const Lc = Math.round((c.ll || p.bars) * 32);
        if (c0 <= tick + 1e-9) {
          if (c.cc && c.cc.pts && c.cc.pts.length && tick % 2 === 0) autoCC(ti, c, tick, time);
        }
        /* the clip's MC-707 clip change, on the tick where it starts */
        if (c0 < tick + 1 - 1e-9 && c0 >= tick - 1e-9) {
          const at = time + (c0 - tick) * td;
          if (c.pc != null) {
            if (c.pc < 16) sendClip(ti, c.pc, at + 0.004);
            else sendMidi([0xc0 | (t.ch - 1), clamp(c.pc, 0, 127)], at);
          } else if (S.clipAuto) autoClip(ti, p, at);
        } else if (c.pc == null && S.clipAuto && PCLAST[ti] == null && c0 < tick) autoClip(ti, p, time);
        /* where this tick falls in the pattern (a fraction of a tick when the clip is offset finely) */
        const a = ((((tick - c0 + c.off * 32) % Lc) + Lc) % Lc) + 1e-9,
          k = Math.floor(a),
          idx = patIndex(p);
        const tone = t.type === 'tone',
          trs = c.tr || 0;
        for (const key of [k, k + 1]) {
          const evs = idx.get(key % Lc);
          if (!evs) continue;
          for (const n of evs) {
            const rel = key + subTick(n) - a; /* ticks after this tick */
            if (rel < -1e-6 || rel >= 1 - 1e-6) continue;
            const abs = tick + Math.max(0, rel);
            if (abs < c0 - 1e-6 || abs >= c1 - 1e-6) continue;
            const vm = ((c.vel || 100) / 100) * (c.fi || c.fo || c.ve ? velMul(c, abs / 32 - c.start) : 1);
            emitNote(
              ti,
              tone ? clamp(n.n + trs, 0, 127) : n.n,
              n.v * vm,
              nt + Math.max(0, rel) * td,
              Math.min(n.l * 2, c1 - abs) * td
            );
          }
        }
      }
    }
  } else if (TR.mode === 'wiz') {
    const wz = TR.wz;
    const bar = Math.floor(tick / 32);
    const sec = wz.plan.sections.find(x => bar >= x.start && bar < x.start + x.bars);
    if (sec) {
      const rel = bar - sec.start;
      for (let t = 0; t < 8; t++) {
        const at = hooks.wizCellAt(sec, t, rel);
        if (!at) continue;
        const f = facById(at.id);
        if (!f) continue;
        const L = f.bars * 32;
        const local = (((tick - (sec.start + at.off) * 32) % L) + L) % L;
        const evs = patIndex(f).get(local);
        if (!evs) continue;
        const sh = f.type === 'tone' ? shiftFor(f, wz.key) : 0;
        for (const n of evs)
          emitNote(t, f.type === 'tone' ? clamp(n.n + sh, 0, 127) : n.n, n.v, nt + subTick(n) * td, n.l * 2 * td);
      }
    }
  } else if (TR.mode === 'live') {
    hooks.liveTick(tick, nt, td);
  } else {
    const p = TR.pat;
    const evs = patIndex(p).get(tick);
    if (evs)
      for (const n of evs)
        emitNote(
          TR.patTrack,
          TR.patShift ? clamp(n.n + TR.patShift, 0, 127) : n.n,
          n.v,
          nt + subTick(n) * td,
          n.l * 2 * td
        );
  }
  TR.vis.push({ time, tick, dur: td });
}
/** Move the transport on by one tick (looping, song end, pattern range). */
export function advance() {
  TR.nextTime += TR.mode === 'song' ? tickDurAt(TR.tick / 32) : tickDur();
  TR.tick++;
  if (TR.mode === 'song') {
    const rcd = TR.recEnd != null;
    const endT = rcd ? TR.recEnd : (S.loop.on ? S.loop.end : songEnd()) * 32;
    if (TR.tick >= endT) {
      if (S.loop.on && !rcd) TR.tick = Math.round(S.loop.start * 32);
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
/* How the clock copes on stage: TR.late counts the stalls it rode out, TR.errs the ticks that failed. */
const LATE = 0.05; /* seconds behind the audio clock before the timeline moves on instead of catching up */
let errToast = 0;
/** A tick that went wrong: logged, shown at most every 30 s, and the clock carries on. */
function tickError(e, tick) {
  TR.errs = (TR.errs || 0) + 1;
  TR.lastErr = { tick, msg: String((e && e.message) || e) };
  if (TR.errs <= 5) console.error('Tick ' + tick + ' failed; playback carried on.', e);
  const now = Date.now();
  if (now - errToast > 30000) {
    errToast = now;
    toast('Something went wrong at bar ' + (Math.floor(tick / 32) + 1) + '. Playback carried on.');
  }
}
/** Schedule all ticks that fall within the look-ahead window. Run by TICKER. */
export function sched() {
  const ctx = AU.ctx;
  if (TR.ending) {
    if (ctx.currentTime >= TR.endTime) stopPlay();
    return;
  }
  /* after a stall (the computer froze for a moment) the music carries on from where it was, a little
     late, instead of firing every missed tick at once */
  if (ctx.currentTime - TR.nextTime > LATE) {
    TR.nextTime = ctx.currentTime + 0.01;
    TR.late = (TR.late || 0) + 1;
  }
  const horizon = ctx.currentTime + 0.12;
  while (TR.nextTime < horizon && !TR.ending) {
    const tick = TR.tick;
    /* one bad tick never stops the music: it is logged and the clock moves on */
    try {
      processTick(tick, TR.nextTime);
    } catch (e) {
      tickError(e, tick);
    }
    try {
      advance();
    } catch (e) {
      tickError(e, tick);
      if (TR.tick === tick) {
        TR.tick++;
        TR.nextTime += tickDur();
      }
    }
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
/** Play the song from the playhead. rec: {endTick} to stop at a tick (used by audio recording). */
export function startSong(rec) {
  if (REC.on) hooks.recStop();
  stopAll();
  ensureAudio();
  let tick = Math.round(S.cursor * 32);
  if (S.loop.on && tick >= S.loop.end * 32) tick = Math.round(S.loop.start * 32);
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
  hooks.updTransport();
}
/**
 * Play one pattern on a loop.
 * @param {import('../core/types.js').Pattern} p
 * @param {number} ti        track to play it on
 * @param {[number, number]} [range]  bars to loop, default the whole pattern
 * @param {number} [shift]   semitones
 * @param {number} [bpm]
 * @param {number} [swing]
 */
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
  hooks.updTransport();
}
/** Stop whatever is playing, send all notes off, and update the transport display. */
export function stopAll() {
  if (!TR.playing) return;
  TICKER.stop();
  TR.playing = false;
  if (AU.ctx && (TR.mode === 'song' || TR.mode === 'live') && S.clock && MIDI.out) sendMidi([0xfc], AU.ctx.currentTime);
  if (typeof hooks.liveCleanup === 'function') hooks.liveCleanup();
  panic();
  hooks.updTransport();
}
/** Stop, and show the playhead at the song cursor (S.cursor). */
export function stopPlay() {
  stopAll();
  hooks.updPlayhead(S.cursor);
}
/** Play or stop the song (the Play button and Space). */
export function togglePlay() {
  if (TR.playing && TR.mode === 'song') stopPlay();
  else startSong();
}
/** '3.2.1' (bar.beat.step) for a position in bars. */
export function fmtPos(bars) {
  const b = Math.floor(bars);
  const beat = Math.floor((bars - b) * 4);
  const st = Math.floor(((bars - b) * 16) % 4);
  return b + 1 + '.' + (beat + 1) + '.' + (st + 1);
}
export const REC = {
  on: false,
  mode: 'live',
  quant: 1,
  held: {},
  cur: 0,
  chordPos: 0,
  lastT: 0,
  metroWas: false,
  warned: false,
  pat: null,
  ti: 0,
  oct: 0
};
