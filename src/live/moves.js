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

/* ---- building a set ---- */
/* ---- automation moves: MC-707 CCs shaped over time (filter, resonance, reverb wash, pump, autopan) ---- */
export const LV_TONES = [3, 4, 5, 6, 7],
  LV_PUMP = [3, 4, 5, 6];
export const LV_SCFX = [
  ['none', 'None'],
  ['build', 'Build-up (filter, resonance, wash, pump)'],
  ['pump', 'Pump (sidechain feel)'],
  ['wash', 'Reverb wash'],
  ['filterin', 'Filter opens in'],
  ['autopan', 'Autopan leads']
];
export function lvRestCC(t, cc) {
  const tr = S.tracks[t];
  if (tr.cc && tr.cc[cc] != null) return tr.cc[cc];
  if (cc >= 80 && cc <= 83) return LV.rest[cc - 80];
  if (cc === 91) return LV.revRest | 0;
  const p = MC_PARAMS.find(x => x.n === cc);
  return p ? p.def : 64;
}
export function lvSendCC(t, cc, v, nt) {
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
  for (const a of LV.autos) {
    if (tick < a.start) continue;
    if (tick >= a.end) {
      if (a.restore !== false) a.tracks.forEach(t => lvSendCC(t, a.cc, lvRestCC(t, a.cc), nt));
      continue;
    }
    a.tracks.forEach(t => lvSendCC(t, a.cc, lvMoveVal(a, t, tick), nt));
  }
  LV.autos = LV.autos.filter(a => tick < a.end);
}
/* Put everything back where it was: used when a drop slams in or a scene with its own moves ends. */
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
/* The epic build: filter and resonance climb, reverb washes up, the tone parts pump harder and faster, leads pan wider. */
export function lvBuildMoves(t1, t2, tag) {
  if (!LV.buildFx) return;
  const T = LV_TONES;
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
    tracks: [4, 5, 6, 7],
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
    tracks: LV_PUMP,
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
  lvMove({
    id: tag + 'pan',
    tracks: [6, 7],
    cc: 10,
    kind: 'lfo',
    depth: 0.75,
    p0: 32,
    p1: 4,
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
      tracks: LV_PUMP,
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
      tracks: [4, 5, 6, 7],
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
      from: 12,
      to: 'rest',
      curve: 'log',
      start: tick,
      end: tick + Math.min(sc.bars, 8) * 32
    });
  else if (fx === 'autopan')
    lvMove({
      id: 'scpan',
      tag: 'scene',
      tracks: [6, 7],
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
    toast('Press Start first');
    return;
  }
  const beat = Math.ceil(TR.tick / 8) * 8,
    bar = Math.ceil(TR.tick / 32) * 32;
  if (kind === 'wash') {
    lvMove({
      id: 'qwash',
      tag: 'q',
      tracks: [4, 5, 6, 7],
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
      tracks: LV_TONES,
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
      from: 14,
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
        tracks: LV_PUMP,
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
        tracks: [6, 7],
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
