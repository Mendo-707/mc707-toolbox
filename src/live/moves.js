// Live Mode moves: MC-707 knob automation over time (filter, resonance, reverb wash, pump, autopan)
// for builds, drops and scene moves.
//
// Reads: S, LV, TR, AU.
import { clamp, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { AU } from '../services/synth.js';
import { sendMidi } from '../services/midi.js';
import { TR } from '../services/transport.js';
import { MC_PARAMS } from '../core/mc707-params.js';
import { curveFn } from '../services/mc-controls.js';
import { LV } from './state.js';
import { lvOn } from './cues.js';
import { liveSync } from './panels.js';
import { knobUI } from './pads.js';
import { toneTracksAll, tracksFor } from '../core/tracks.js';

/* ---- automation moves: MC-707 CCs shaped over time (filter, resonance, reverb wash, pump, autopan) ---- */
export const LV_SCFX = [
  ['none', 'None'],
  ['build', 'Build-up (filter, resonance, wash, pump)'],
  ['pump', 'Pump (sidechain feel)'],
  ['wash', 'Reverb wash'],
  ['filterin', 'Filter opens in'],
  ['autopan', 'Autopan leads']
];
/**
 * A FILTER value `amt` (0-1) of the way from rest into the effect. With the knob resting low (the
 * MC-707's 0) the effect grows upwards; a centred rest (64) dips down toward 0 as it used to.
 */
export function lvFilterAway(amt) {
  const r = LV.rest[0];
  return Math.round(r < 32 ? r + (127 - r) * amt : r - r * amt);
}
export function lvRestCC(t, cc) {
  const tr = S.tracks[t];
  if (tr.cc && tr.cc[cc] != null) return tr.cc[cc];
  if (cc >= 80 && cc <= 83) return LV.rest[cc - 80];
  if (cc === 91) return LV.revRest | 0;
  const p = MC_PARAMS.find(x => x.n === cc);
  return p ? p.def : 64;
}
/* ---- Raven takeover: while you play a track yourself, the app leaves it alone ---- */
/** How long a track stays yours after your last note: 4 bars. */
export const TAKE_TICKS = 128;
/**
 * True while you are playing track t in Raven mode: from your first note until 4 bars after the
 * last one (and never while a key is held). The app then sends that track no pattern notes, no
 * effects, fades or clip changes. When it lapses, the app picks the track up again.
 */
export function lvUserOwns(t) {
  const u = LV.userPlay && LV.userPlay[t];
  if (!u) return false;
  if (LV.perfOn && TR.playing && TR.mode === 'live' && (u.held > 0 || TR.tick - u.last < TAKE_TICKS)) return true;
  delete LV.userPlay[t];
  LV.ver++;
  if (LV.perfOn && TR.playing) toast('Back to the app: ' + S.tracks[t].name);
  return false;
}
/** You played (on) or released (off) a note on track t. The first one takes the track over. */
export function lvUserNote(t, on) {
  if (t < 0 || t > 7 || !LV.perfOn || !lvOn()) return;
  const all = LV.userPlay || (LV.userPlay = {}),
    fresh = !all[t],
    u = all[t] || (all[t] = { held: 0, last: TR.tick });
  u.last = TR.tick;
  u.held = Math.max(0, u.held + (on ? 1 : -1));
  if (!fresh) return;
  /* every effect the app has moving on this track goes back to rest, so you play it clean */
  const nt = AU.ctx ? AU.ctx.currentTime : 0,
    ccs = new Set([11]);
  LV.autos.forEach(a => a.tracks.includes(t) && ccs.add(a.cc));
  if (LV.rise) [80].forEach(c => ccs.add(c));
  if (S.sendCC !== false && !S.tracks[t].mute)
    ccs.forEach(cc => {
      const v = lvRestCC(t, cc);
      LV.ccLast[t + ':' + cc] = v;
      sendMidi([0xb0 | (S.tracks[t].ch - 1), cc, v], nt);
    });
  if (LV.low) delete LV.low[t];
  if (LV.fadeEnds) LV.fadeEnds = LV.fadeEnds.filter(e => e.t !== t);
  LV.ver++;
  toast('You have ' + S.tracks[t].name + ': the app hands it back 4 bars after you stop');
}
export function lvSendCC(t, cc, v, nt) {
  if (lvUserOwns(t)) return;
  v = clamp(Math.round(v), 0, 127);
  const k = t + ':' + cc;
  if (LV.ccLast[k] === v) return;
  LV.ccLast[k] = v;
  if (S.sendCC === false || S.tracks[t].mute) return;
  sendMidi([0xb0 | (S.tracks[t].ch - 1), cc, v], nt);
}
export function lvMove(m) {
  LV.autos = LV.autos.filter(a => !(m.id && a.id === m.id));
  LV.autos.push(m);
  LV.ver++;
  return m;
}
function lvMoveVal(a, t, tick) {
  const u = clamp((tick - a.start) / Math.max(1, a.end - a.start), 0, 1),
    rest = lvRestCC(t, a.cc);
  if (a.kind === 'ramp') {
    const f = (curveFn[a.curve || 'lin'] || curveFn.lin)(u);
    const fr = a.from === 'rest' ? rest : a.from,
      to = a.to === 'rest' ? rest : a.to;
    return fr + (to - fr) * f;
  }
  if (a.kind === 'pump') {
    const per = u >= (a.fastAt || 2) ? a.fastPer || a.period : a.period,
      ph = ((((tick - a.start) % per) + per) % per) / per;
    const d = a.d0 + (a.d1 - a.d0) * u;
    return rest * (1 - d * (1 - Math.pow(Math.min(1, ph * 1.7), 0.7)));
  }
  if (a.kind === 'lfo') {
    const per = Math.max(2, Math.round(a.p0 + (a.p1 - a.p0) * u));
    return 64 + a.depth * 63 * Math.sin((2 * Math.PI * ((tick - a.start) % per)) / per);
  }
  return rest;
}
export function lvAutoTick(tick, nt) {
  if (!LV.autos.length || tick % 2) return;
  /* one value per track and control this tick: a move's value (or its rest when it ends), scaled by a fade
     on the same control, so a fade and a pump never fight */
  const val = new Map(),
    fade = new Map();
  for (const a of LV.autos) {
    if (tick < a.start) continue;
    const done = tick >= a.end;
    if (done && a.restore === false) continue;
    a.tracks.forEach(t => {
      const k = t + ':' + a.cc,
        v = done ? lvRestCC(t, a.cc) : lvMoveVal(a, t, tick);
      if (a.tag === 'fade') fade.set(k, { t, cc: a.cc, v });
      else if (!done || !val.has(k)) val.set(k, { t, cc: a.cc, v });
    });
    if (a.cc >= 80 && a.cc <= 83) {
      if (done) knobUI(a.cc - 80, LV.knobs[a.cc - 80]);
      else if (a.tracks.length) knobUI(a.cc - 80, Math.round(lvMoveVal(a, a.tracks[0], tick)));
    }
  }
  for (const [k, f] of fade) {
    const m = val.get(k);
    if (m) m.v = (m.v * f.v) / Math.max(1, lvRestCC(f.t, f.cc));
    else val.set(k, f);
  }
  for (const { t, cc, v } of val.values()) lvSendCC(t, cc, v, nt);
  LV.autos = LV.autos.filter(a => tick < a.end);
}
export function lvSlam(nt, filter) {
  const keep = [];
  LV.autos.forEach(a => {
    if (filter && !filter(a)) {
      keep.push(a);
      return;
    }
    a.tracks.forEach(t => lvSendCC(t, a.cc, lvRestCC(t, a.cc), nt));
  });
  LV.autos = keep;
  LV.ver++;
}
/* The epic build: filter and resonance climb, reverb washes up, the tone parts pump harder and faster. */
export function lvBuildMoves(t1, t2, tag) {
  if (!LV.buildFx) return;
  const T = toneTracksAll();
  lvMove({
    id: tag + 'res',
    tracks: T,
    cc: 71,
    kind: 'ramp',
    from: 'rest',
    to: 96,
    curve: 'exp',
    start: t1,
    end: t2,
    tag
  });
  lvMove({
    id: tag + 'rev',
    tracks: tracksFor([4, 5, 6, 7]),
    cc: 91,
    kind: 'ramp',
    from: 'rest',
    to: 105,
    curve: 'exp',
    start: t1,
    end: t2,
    tag
  });
  lvMove({
    id: tag + 'pump',
    tracks: tracksFor([3, 4, 5, 6]),
    cc: 11,
    kind: 'pump',
    d0: 0.15,
    d1: 0.75,
    period: 8,
    fastAt: Math.max(0, 1 - 32 / Math.max(32, t2 - t1)),
    fastPer: 4,
    start: t1,
    end: t2,
    tag
  });
}
export function lvSceneFx(sc, tick) {
  lvSlam(AU.ctx ? AU.ctx.currentTime : 0, a => a.tag === 'scene');
  const fx = sc.fx || (sc.kind === 'build' ? 'build' : 'none'),
    end = tick + sc.bars * 32;
  if (fx === 'build') lvBuildMoves(tick, end, 'scene');
  else if (fx === 'pump')
    lvMove({
      id: 'scpump',
      tag: 'scene',
      tracks: tracksFor([3, 4, 5, 6]),
      cc: 11,
      kind: 'pump',
      d0: 0.55,
      d1: 0.55,
      period: 8,
      start: tick,
      end: tick + 32 * 512
    });
  else if (fx === 'wash')
    lvMove({
      id: 'scwash',
      tag: 'scene',
      tracks: tracksFor([4, 5, 6, 7]),
      cc: 91,
      kind: 'ramp',
      from: 'rest',
      to: 100,
      curve: 's',
      start: tick,
      end,
      restore: true
    });
  else if (fx === 'filterin')
    lvMove({
      id: 'scfin',
      tag: 'scene',
      tracks: [0, 1, 2, 3, 4, 5, 6, 7],
      cc: 80,
      kind: 'ramp',
      from: lvFilterAway(0.9),
      to: 'rest',
      curve: 'log',
      start: tick,
      end: tick + Math.min(sc.bars, 8) * 32
    });
  else if (fx === 'autopan')
    lvMove({
      id: 'scpan',
      tag: 'scene',
      tracks: tracksFor([6, 7]),
      cc: 10,
      kind: 'lfo',
      depth: 0.7,
      p0: 16,
      p1: 16,
      start: tick,
      end: tick + 32 * 512
    });
}
/* Quick moves from the Moves panel */
export function liveMoveNow(kind) {
  if (!lvOn()) {
    toast('Press Start Jam first');
    return;
  }
  const beat = Math.ceil(TR.tick / 8) * 8,
    bar = Math.ceil(TR.tick / 32) * 32;
  if (kind === 'wash') {
    lvMove({
      id: 'qwash',
      tag: 'q',
      tracks: tracksFor([4, 5, 6, 7]),
      cc: 91,
      kind: 'ramp',
      from: 'rest',
      to: 110,
      curve: 'exp',
      start: bar,
      end: bar + 64
    });
    toast('Reverb wash over 2 bars');
  } else if (kind === 'throw') {
    lvMove({
      id: 'qthrow',
      tag: 'q',
      tracks: toneTracksAll(),
      cc: 91,
      kind: 'ramp',
      from: 120,
      to: 'rest',
      curve: 'log',
      start: beat,
      end: beat + 16
    });
    toast('Reverb throw');
  } else if (kind === 'dip') {
    lvMove({
      id: 'qdip',
      tag: 'q',
      tracks: [0, 1, 2, 3, 4, 5, 6, 7],
      cc: 80,
      kind: 'ramp',
      from: lvFilterAway(0.85),
      to: 'rest',
      curve: 'exp',
      start: bar,
      end: bar + 32
    });
    toast('Filter dip for 1 bar');
  } else if (kind === 'pump') {
    if (LV.autos.some(a => a.id === 'qpump')) {
      lvSlam(AU.ctx.currentTime, a => a.id === 'qpump');
      toast('Pump off');
    } else {
      lvMove({
        id: 'qpump',
        tag: 'q',
        tracks: tracksFor([3, 4, 5, 6]),
        cc: 11,
        kind: 'pump',
        d0: 0.6,
        d1: 0.6,
        period: 8,
        start: beat,
        end: beat + 32 * 512
      });
      toast('Pump on');
    }
  } else if (kind === 'pan') {
    if (LV.autos.some(a => a.id === 'qpan')) {
      lvSlam(AU.ctx.currentTime, a => a.id === 'qpan');
      toast('Autopan off');
    } else {
      lvMove({
        id: 'qpan',
        tag: 'q',
        tracks: tracksFor([6, 7]),
        cc: 10,
        kind: 'lfo',
        depth: 0.8,
        p0: 16,
        p1: 16,
        start: beat,
        end: beat + 32 * 512
      });
      toast('Autopan on');
    }
  }
  liveSync();
}
