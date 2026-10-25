// The sidechain pump: a part ducks on every kick and comes back, written into a clip's motion so the
// MC-707 plays it by itself. Volume pumps the SOUND (C4) knob's lane (set to Level with KNOB ASSIGN on the
// MC-707), Filter the FILTER knob's lane (cutoff on most sounds). The idea and the motion layout are Ada
// Locriana's (github.com/Locriana/mctools_sidechain). The shape: down on the kick (half down one motion
// point before), held, then back, eased like a compressor letting go or in a straight line as Ada's tool
// does. Where it starts, how long it holds and how long it takes to come back are set finely, in eighths of
// a 16th (one motion point in a 1/16 clip), since a later or longer comeback changes the groove; times are
// in 16ths, so the shape stays in time at any clip step size or tempo. Softer kicks duck less; ghost notes
// not at all. The kick pattern repeats under a longer clip, and the end of the clip wraps to its start.
//
// Plain data and maths only. Reads: nothing.

/** Which motion lane each kind uses (FILTER is lane 0, SOUND (C4) lane 3). */
export const PUMP_LANE = { level: 3, filter: 0 };
export const PUMP_MODES = [
  ['level', 'Volume'],
  ['filter', 'Filter']
];
/** How far it ducks, as a share of the resting value. */
export const PUMP_DEPTH = { light: 0.35, medium: 0.6, heavy: 0.85 };
/** Quick choices for how long it takes to come back, in 16ths (it can be set to any eighth of a 16th). */
export const PUMP_REL = { '1/16': 1, '1/8': 2, '1/4': 4 };
/** The fine settings, in 16ths: [lowest, highest, default]; each moves in eighths of a 16th. */
export const PUMP_TIME = { rel: [0.25, 8, 2], hold: [0, 4, 0.5], start: [-1, 1, 0] };
export const PUMP_FINE = 1 / 8;
/** How it comes back: eased (like a compressor) or in a straight line. */
export const PUMP_CURVES = [
  ['eased', 'Eased'],
  ['straight', 'Straight']
];
/** The value it rests at between kicks. */
export const PUMP_REST = { level: 100, filter: 127 };
/** Kicks softer than this are ghost notes: no duck. */
export const PUMP_GHOST = 50;
/** The drum lane the kicks are on (the app's lane 0, Kick). */
export const KICK_LANE = 0;

/** A new pump of kind mode ('level' or 'filter'). */
export const newPump = mode => ({
  mode,
  depth: 'medium',
  rel: PUMP_TIME.rel[2],
  hold: PUMP_TIME.hold[2],
  start: PUMP_TIME.start[2],
  curve: 'eased',
  rest: PUMP_REST[mode]
});
/* a fine time setting, kept in range and on the eighths of a 16th (older pumps had '1/16', '1/8', '1/4') */
function fine(v, which) {
  const [lo, hi, def] = PUMP_TIME[which],
    x = typeof v === 'string' && PUMP_REL.hasOwnProperty(v) ? PUMP_REL[v] : +v;
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x / PUMP_FINE) * PUMP_FINE)) : def;
}
/** A pump as loaded, checked (or null). */
export function fixPump(x) {
  if (!x || typeof x !== 'object' || !PUMP_LANE.hasOwnProperty(x.mode)) return null;
  const rest = Math.round(+x.rest);
  return {
    mode: x.mode,
    depth: PUMP_DEPTH.hasOwnProperty(x.depth) ? x.depth : 'medium',
    rel: fine(x.rel, 'rel'),
    hold: fine(x.hold, 'hold'),
    start: fine(x.start, 'start'),
    curve: x.curve === 'straight' ? 'straight' : 'eased',
    rest: Number.isFinite(rest) ? Math.max(1, Math.min(127, rest)) : PUMP_REST[x.mode]
  };
}

/** The kicks in a drum pattern: [{s, v}] (16ths), ghost notes left out. */
export const kickHits = p =>
  (p && p.type === 'drum' ? p.notes : [])
    .filter(n => n.n === KICK_LANE && (n.v || 100) >= PUMP_GHOST)
    .map(n => ({ s: n.s, v: n.v || 100 }));

/**
 * The kick times under a clip `len` 16ths long: each source pattern's kicks repeated every `period`
 * (its length) across the clip. @param {{hits:{s,v}[], period:number}[]} srcs
 * @returns {{s:number, v:number}[]}
 */
export function kicksUnder(srcs, len) {
  const out = [];
  for (const { hits, period } of srcs)
    if (period > 0)
      for (let o = 0; o < len; o += period) for (const h of hits) if (h.s + o < len) out.push({ s: h.s + o, v: h.v });
  return out.sort((a, b) => a.s - b.s);
}

/**
 * How far down the pump is (0-1 of its depth) d 16ths after a kick: half down one motion point (`early`)
 * before it starts, all the way down from `start` for `hold`, then back over `rel`: eased (95% back by
 * then, like a compressor letting go) or straight (all the way back by then).
 */
export function duck(d, o, early) {
  const x = d - o.start;
  if (x < -early - 1e-9 || x > o.hold + o.rel * 2) return 0;
  if (x < 0) return 0.5;
  if (x < o.hold) return 1;
  const r = x - o.hold;
  return o.curve === 'straight' ? Math.max(0, 1 - r / o.rel) : Math.exp((-r * 3) / o.rel);
}

/**
 * The pump's motion for a clip: `steps` steps of `k` 16ths, 8 values a step.
 * @param {{mode, depth, rel, hold, start, curve, rest}} pump  (times in 16ths)
 * @param {{s:number, v:number}[]} kicks  kick times in the clip (kicksUnder)
 * @returns {number[]} steps × 8 values, 0-127
 */
export function pumpValues(pump, kicks, steps, k) {
  const n = steps * 8,
    dt = k / 8,
    len = steps * k,
    depth = PUMP_DEPTH[pump.depth] || 0.6,
    o = {
      rel: fine(pump.rel, 'rel'),
      hold: pump.hold == null ? PUMP_TIME.hold[2] : fine(pump.hold, 'hold'),
      start: pump.start == null ? 0 : fine(pump.start, 'start'),
      curve: pump.curve
    },
    rest = pump.rest;
  /* the clip loops: a kick near the end ducks the start, one at the start the end */
  const all = [...kicks, ...kicks.map(x => ({ ...x, s: x.s - len })), ...kicks.map(x => ({ ...x, s: x.s + len }))];
  return Array.from({ length: n }, (_, i) => {
    const t = i * dt;
    let down = 0;
    for (const x of all) {
      const g = duck(t - x.s, o, dt);
      if (g) down = Math.max(down, g * depth * Math.min(1, x.v / 100));
    }
    return Math.max(0, Math.min(127, Math.round(rest * (1 - down))));
  });
}
