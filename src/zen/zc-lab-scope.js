// The Slime Lab's scope: a picture of the tone drawn from its settings (the MC-707 sends no audio back),
// so every knob shows. The wave is a few cycles of every partial that is on, summed from its harmonics
// (the oscillator's wave, tuned by its coarse pitch) through its filter; Body adds detuned ghost traces and
// Space faint echoes. Under it, the amp and filter envelopes, with a playhead while a note is tasted, when
// the wave also follows the envelopes and the LFOs. A small version draws the variations.
//
// Reads: nothing (the values come in as v, the partials as ps).
import { el } from '../core/dom.js';

const num = (v, k, d = 0) => (typeof v[k] === 'number' ? v[k] : d);
/** An envelope time setting (0-1023) in seconds, roughly. */
export const envSec = x => Math.pow(Math.max(0, x) / 1023, 2.2) * 7;
const H = 40;
/* a small seeded random, so a PCM wave looks the same on every redraw */
const rnd = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/* the harmonics of one partial's oscillator: [amplitude, phase] for harmonics 1…H */
function harmonics(v, i) {
  const s = k => num(v, 'SPTL' + i + '.' + k),
    type = s('OSC_TYPE');
  const out = [];
  if (type === 4) {
    const r = rnd(97 + i);
    for (let h = 1; h <= H; h++) out.push([r() / Math.sqrt(h), r() * 6.28]);
    return out;
  }
  if (type === 0 || type === 2) {
    const r = rnd(1 + num(v, 'PTL' + i + '.WAV_NUM_L') * 31 + num(v, 'PTL' + i + '.WAV_GID') * 7);
    for (let h = 1; h <= H; h++) out.push([(0.35 + 0.65 * r()) / Math.pow(h, 1.25 + r() * 0.35), r() * 6.28]);
    return out;
  }
  const form = type === 3 ? 0 : s('VA_FORM');
  const d = 0.5 - (Math.abs(num(v, 'SPTL' + i + '.PW', 64) - 64) / 64) * 0.45;
  for (let h = 1; h <= H; h++) {
    let a = 0,
      ph = 0;
    if (form === 0 || form === 4) a = 1 / h;
    else if (form === 1) a = Math.abs((2 / (h * Math.PI)) * Math.sin(h * Math.PI * d)) * 1.6;
    else if (form === 2 || form === 6 || form === 7) a = h % 2 ? 1 / (h * h) : 0;
    else if (form === 5) a = 0.6 / h + (h % 2 ? 0.4 / h : 0);
    else if (form === 8) a = h % 2 ? 0 : 1 / (h * h);
    else a = h === 1 ? 1 : 0;
    if (form === 2 && h % 4 === 3) ph = Math.PI;
    if (form === 4) ph = Math.PI;
    out.push([a, ph]);
  }
  return out;
}
/* how much of harmonic f (in multiples of the lowest note) a partial's filter lets through */
function filterGain(type, fc, q, f) {
  const r = f / fc,
    peak = 1 + q * 5 * Math.exp(-Math.pow(Math.log2(r), 2) / 0.05);
  if (type === 0) return 1;
  if (type === 3) return (1 / Math.sqrt(1 + Math.pow(1 / r, 4))) * peak;
  if (type === 2) return Math.exp(-Math.pow(Math.log2(r), 2) / 0.6) * peak;
  if (type === 4) return 1 + q * 4 * Math.exp(-Math.pow(Math.log2(r), 2) / 0.05);
  return (1 / Math.sqrt(1 + Math.pow(r, 4))) * peak;
}
/* an envelope's level at t seconds into a held note (r: seconds since key up, or null) */
function envAt(T, L, t, r) {
  const seg = [
    [envSec(T[0]), L[0], L[1]],
    [envSec(T[1]), L[1], L[2]],
    [envSec(T[2]), L[2], L[3]]
  ];
  const at = tt => {
    for (const [d, a, b] of seg) {
      if (tt < d) return a + (b - a) * (tt / Math.max(d, 1e-4));
      tt -= d;
    }
    return L[3];
  };
  if (r == null) return at(t);
  const from = at(Math.max(0, t - r)),
    d = envSec(T[3]);
  return r >= d ? L[4] : from + (L[4] - from) * (r / Math.max(d, 1e-4));
}
const ampEnv = (v, i) => [
  ['T1', 'T2', 'T3', 'T4'].map(k => num(v, 'AENV' + i + '.' + k)),
  [0, ...['L1', 'L2', 'L3'].map(k => num(v, 'AENV' + i + '.' + k, 1023) / 1023), 0]
];
const filEnv = (v, i) => [
  ['T1', 'T2', 'T3', 'T4'].map(k => num(v, 'FENV' + i + '.' + k)),
  ['L0', 'L1', 'L2', 'L3', 'L4'].map(k => num(v, 'FENV' + i + '.' + k) / 1023)
];
const lfoW = (form, ph) =>
  form === 1 ? 1 - 4 * Math.abs((ph % 1) - 0.5) : form === 4 ? (ph % 1 < 0.5 ? 1 : -1) : Math.sin(ph * 6.283);

/**
 * The tone's wave: n points over two cycles of the lowest partial, -1…1.
 * @param {object} at  while a note is tasted: {t, r} (seconds held, seconds since key up), else null
 */
function wave(v, ps, at, n) {
  const low = Math.min(...ps.map(i => num(v, 'PTL' + i + '.PIT_CRS')));
  const ys = new Float32Array(n);
  let peak = 0;
  for (const i of ps) {
    const lvl = num(v, 'PTL' + i + '.LEVEL', 127) / 127;
    if (!lvl) continue;
    const ratio = Math.pow(2, (num(v, 'PTL' + i + '.PIT_CRS') - low) / 12);
    let cut = num(v, 'PTL' + i + '.CUTOFF', 1023),
      amp = lvl;
    const dep = num(v, 'FENV' + i + '.DEPTH');
    if (at) {
      const [T, L] = filEnv(v, i);
      cut += (dep / 63) * envAt(T, L, at.t, at.r) * 700;
      const [aT, aL] = ampEnv(v, i);
      amp *= envAt(aT, aL, at.t, at.r);
      const l = 'LFO' + i + '.',
        ph = at.t * (0.3 + num(v, l + 'LFO2_RATE', 650) / 120),
        ph1 = at.t * (0.3 + num(v, l + 'LFO1_RATE', 650) / 120);
      cut += (num(v, l + 'LFO2_TVF_DEPTH') / 100) * 500 * lfoW(num(v, l + 'LFO2_FORM'), ph);
      cut += (num(v, l + 'LFO1_TVF_DEPTH') / 100) * 500 * lfoW(num(v, l + 'LFO1_FORM'), ph1);
      amp *= 1 - Math.abs(num(v, l + 'LFO1_TVA_DEPTH') / 100) * 0.5 * (1 + lfoW(num(v, l + 'LFO1_FORM'), ph1));
    } else if (dep > 0) cut += (dep / 63) * 200;
    const fc = Math.pow(2, (Math.max(0, Math.min(1023, cut)) / 1023) * 10 - 1),
      q = num(v, 'PTL' + i + '.RESO') / 1023,
      type = num(v, 'PTL' + i + '.FILTER_TYPE', 1);
    const hs = harmonics(v, i).map(([a, p], h) => [a * filterGain(type, fc, q, (h + 1) * ratio), p, (h + 1) * ratio]);
    for (let j = 0; j < n; j++) {
      const x = (j / (n - 1)) * 2 * 6.2832;
      let y = 0;
      for (const [a, p, f] of hs) if (a > 0.002) y += a * Math.sin(f * x + p);
      ys[j] += y * amp;
    }
    peak += amp;
  }
  let m = 0;
  for (const y of ys) m = Math.max(m, Math.abs(y));
  /* scaled to fit, but a quiet moment of a note still looks quiet */
  const k = m ? Math.min(1, peak) / m : 0;
  return Array.from(ys, y => y * k);
}
const pathOf = (ys, W, H, x0 = 0, scale = 1) =>
  ys
    .map(
      (y, j) =>
        (j ? 'L' : 'M') +
        (x0 + (j / (ys.length - 1)) * W).toFixed(1) +
        ' ' +
        (H / 2 - y * scale * (H / 2 - 6)).toFixed(1)
    )
    .join(' ');
/* how fat and how distant the tone looks: ghost traces and echoes */
function look(v, ps) {
  const avg = f => ps.reduce((s, i) => s + f(i), 0) / ps.length;
  return {
    fat:
      avg(i => num(v, 'SPTL' + i + '.FAT', 64) / 127 + Math.abs(num(v, 'PTL' + i + '.STEREO_DETN')) / 40) +
      (ps.some(i => num(v, 'SPTL' + i + '.OSC_TYPE') === 3) ? 0.5 : 0) +
      num(v, 'SCMN.UNISON_SW') * 0.4 +
      (ps.length > 1
        ? (Math.max(...ps.map(i => num(v, 'PTL' + i + '.PIT_FINE'))) -
            Math.min(...ps.map(i => num(v, 'PTL' + i + '.PIT_FINE')))) /
          15
        : 0),
    space: avg(i => (num(v, 'PTL' + i + '.REV_SEND') + num(v, 'PTL' + i + '.CHO_SEND') * 0.7) / 140)
  };
}

/* ---- the scope ---- */
const W = 600,
  WH = 150,
  EH = 54;
/** The scope's element (drawn by scopeDraw). */
export function scopeEl() {
  return el('div', { class: 'lsScope', 'aria-hidden': 'true' });
}
/**
 * Draw the tone: the whole scope (at null) or, while a note is tasted, only the moving parts.
 * @param {HTMLElement} box  from scopeEl
 * @param {object} at  {t, r} while tasting, else null
 */
export function scopeDraw(box, v, ps, at = null) {
  if (!box.firstChild) {
    box.innerHTML =
      `<svg class="lsWave" viewBox="0 0 ${W} ${WH}" preserveAspectRatio="none">` +
      `<line class="lsMid" x1="0" y1="${WH / 2}" x2="${W}" y2="${WH / 2}"/><g class="lsEcho"></g><g class="lsGhost"></g>` +
      `<path class="lsLine" d=""/></svg>` +
      `<svg class="lsEnv" viewBox="0 0 ${W} ${EH}" preserveAspectRatio="none"><path class="lcAmp"/><path class="lcAmpL"/>` +
      `<path class="lcFil"/><line class="lcRel" y1="0" y2="${EH}"/><line class="lcHead" x1="-10" x2="-10" y1="0" y2="${EH}"/></svg>` +
      `<span class="lcLab"></span>`;
  }
  const ys = wave(v, ps, at, 300),
    lk = look(v, ps);
  box.querySelector('.lsLine').setAttribute('d', pathOf(ys, W, WH));
  const g = box.querySelector('.lsGhost');
  const nG = Math.min(4, Math.round(lk.fat * 3));
  g.innerHTML = Array.from(
    { length: nG },
    (_, j) =>
      `<path d="${pathOf(ys, W, WH, (j % 2 ? -1 : 1) * (3 + j * 3), 1 - 0.05 * (j + 1))}" opacity="${(0.32 - j * 0.06).toFixed(2)}"/>`
  ).join('');
  const e = box.querySelector('.lsEcho');
  const nE = Math.round(lk.space * 3);
  e.innerHTML = Array.from(
    { length: nE },
    (_, j) => `<path d="${pathOf(ys, W, WH, 18 * (j + 1), 0.6 - j * 0.15)}" opacity="${(0.22 - j * 0.06).toFixed(2)}"/>`
  ).join('');
  if (!at || !box.dataset.env) envDraw(box, v, ps);
  head(box, at);
}
/* the envelopes of the first partial that is on */
function envDraw(box, v, ps) {
  const i = ps[0],
    [aT, aL] = ampEnv(v, i),
    [fT, fL] = filEnv(v, i);
  const at = aT.slice(0, 3).map(envSec),
    ft = fT.slice(0, 3).map(envSec);
  const held = Math.max(at[0] + at[1] + at[2], ft[0] + ft[1] + ft[2]) + 0.5;
  const total = Math.max(0.6, held + Math.max(envSec(aT[3]), envSec(fT[3])));
  const X = t => (t / total) * W,
    Y = l => EH - 3 - l * (EH - 8);
  const pts = (T, L, d) => [
    [0, L[0]],
    [d[0], L[1]],
    [d[0] + d[1], L[2]],
    [d[0] + d[1] + d[2], L[3]],
    [held, L[3]],
    [held + envSec(T[3]), L[4]]
  ];
  const p = ps => ps.map(([t, l], j) => (j ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(l).toFixed(1)).join(' ');
  const amp = pts(aT, aL, at),
    dep = num(v, 'FENV' + i + '.DEPTH');
  const fil = pts(fT, dep < 0 ? fL.map(l => 1 - l) : fL, ft);
  box.querySelector('.lcAmp').setAttribute('d', p(amp) + ` L${X(held + envSec(aT[3]))} ${EH} L0 ${EH} Z`);
  box.querySelector('.lcAmpL').setAttribute('d', p(amp));
  box.querySelector('.lcFil').setAttribute('d', dep ? p(fil) : '');
  const rel = box.querySelector('.lcRel');
  rel.setAttribute('x1', X(held));
  rel.setAttribute('x2', X(held));
  box.querySelector('.lcLab').innerHTML =
    'AMP' + (dep ? ' · <i>FILTER</i>' : '') + ' envelope' + (ps.length > 1 ? ' · partial ' + (i + 1) : '');
  box.dataset.env = JSON.stringify({ total, held });
}
function head(box, at) {
  const h = box.querySelector('.lcHead');
  let x = -10;
  if (at && box.dataset.env) {
    const { total, held } = JSON.parse(box.dataset.env);
    const pos = at.r == null ? Math.min(at.t, held) : held + at.r;
    x = (Math.min(pos, total) / total) * W;
  }
  h.setAttribute('x1', x);
  h.setAttribute('x2', x);
}
/** Forget the drawn envelope, so the next draw redraws it. */
export const scopeStale = box => box && delete box.dataset.env;

/** A small picture of a tone (a variation): its wave and its amp envelope, as SVG markup. */
export function miniSvg(v, ps) {
  const w = 120,
    h = 44,
    ys = wave(v, ps, null, 90),
    lk = look(v, ps);
  const [aT, aL] = ampEnv(v, ps[0]);
  const d = aT.map(envSec),
    held = d[0] + d[1] + d[2] + 0.3,
    tot = Math.max(0.5, held + d[3]);
  const X = t => (t / tot) * w,
    Y = l => 58 - l * 10;
  const env = [
    [0, 0],
    [d[0], aL[1]],
    [d[0] + d[1], aL[2]],
    [d[0] + d[1] + d[2], aL[3]],
    [held, aL[3]],
    [held + d[3], 0]
  ]
    .map(([t, l], j) => (j ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(l).toFixed(1))
    .join(' ');
  const ghost = lk.fat > 0.8 ? `<path class="lmG" d="${pathOf(ys, w, h, 3, 0.92)}"/>` : '';
  return (
    `<svg viewBox="0 0 ${w} 60" class="lmSvg" aria-hidden="true">${ghost}<path class="lmW" d="${pathOf(ys, w, h)}"/>` +
    `<path class="lmE" d="${env}"/></svg>`
  );
}
