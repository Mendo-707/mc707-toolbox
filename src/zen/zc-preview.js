// Live previews for the ZenCore editor: the oscillator's wave, the filter's response curve and an
// LFO's shape over a few cycles. They are drawn from the settings (the MC-707 does not send audio
// back), redraw as a slider moves, and are approximate: they show the shape, not exact levels.
//
// Reads: the sound through the editor's ctx.
import { el } from '../core/dom.js';
import { pk } from './zc-tone.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, a = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, a[k]);
  return e;
};
const path = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
/* a small seeded random, so random shapes look the same on every redraw */
const rnd = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/* ---- oscillator ---- */
const VA = {
  SAW: ph => 1 - 2 * ph,
  RAMP: ph => 2 * ph - 1,
  TRI: ph => (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph),
  SIN: ph => Math.sin(2 * Math.PI * ph),
  JUNO: (ph, d) => 0.6 * (1 - 2 * ph) + 0.4 * (ph < d ? 1 : -1),
  TRI2: ph => Math.tanh(2.2 * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph)) / Math.tanh(2.2),
  TRI3: ph => Math.sin((Math.PI / 2) * 1.8 * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph)),
  SIN2: ph => Math.abs(Math.sin(2 * Math.PI * ph)) * 2 - 1
};
const FORMS = ['SAW', 'SQR', 'TRI', 'SIN', 'RAMP', 'JUNO', 'TRI2', 'TRI3', 'SIN2'];
/** The oscillator's wave, two cycles, for the partial on show. */
export function oscPreview(ctx) {
  const W = 420,
    H = 96,
    M = H / 2,
    A = H / 2 - 8;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'zcEnv zcPrev', role: 'img', 'aria-label': 'Wave preview' });
  const cap = el('small', { class: 'hint' });
  const S = id => ctx.get(pk('SPTL', ctx.part, id)),
    P = id => ctx.get(pk('PTL', ctx.part, id));
  const draw = () => {
    svg.textContent = '';
    svg.append(sv('line', { x1: 0, x2: W, y1: M, y2: M, class: 'zero' }));
    const ty = S('OSC_TYPE'),
      inv = S('VA_INVERT_SW') ? -1 : 1,
      line = (f, cls = 'line') => {
        const pts = [];
        for (let x = 0; x <= W; x++) pts.push([x, M - A * f(((x / W) * 2) % 1, x)]);
        svg.append(sv('path', { d: path(pts), class: cls }));
      };
    if (ty === 1) {
      const form = FORMS[S('VA_FORM')] || 'SAW',
        duty = Math.max(0.05, Math.min(0.95, 0.5 + ((S('PW') - 64) / 127) * 0.9));
      if (form === 'SQR') {
        /* the pulse width, and where PWM sweeps it to */
        const pwm = S('PWM_DEPTH');
        if (pwm) {
          const d2 = Math.max(0.05, Math.min(0.95, duty + (pwm / 63) * 0.4));
          line(ph => inv * (ph < d2 ? 1 : -1), 'line ghost');
        }
        line(ph => inv * (ph < duty ? 1 : -1));
      } else line(ph => inv * VA[form](ph, duty));
      cap.textContent = 'VA ' + form + (form === 'SQR' ? ' · width ' + Math.round(duty * 100) + '%' : '');
    } else if (ty === 3) {
      /* SuperSAW: several saws a little apart, spread by Detune */
      const det = S('SSAW_DETUNE') / 127;
      [-1, -0.5, 0.5, 1].forEach(k => line(ph => 1 - 2 * ((ph + k * det * 0.08 + 1) % 1), 'line ghost'));
      line(ph => 1 - 2 * ph);
      cap.textContent = 'SuperSAW · detune ' + S('SSAW_DETUNE');
    } else if (ty === 4) {
      const r = rnd(7);
      const pts = [];
      for (let x = 0; x <= W; x += 2) pts.push([x, M - A * (r() * 2 - 1) * 0.9]);
      svg.append(sv('path', { d: path(pts), class: 'line' }));
      cap.textContent = 'Noise';
    } else {
      /* PCM waves are samples inside the MC-707: there is nothing to draw */
      svg.append(sv('text', { x: W / 2, y: M + 5, class: 'lbl', 'text-anchor': 'middle' }, ''));
      svg.lastChild.textContent =
        (ty === 2 ? 'PCM-Sync wave ' + S('SYNC_WAV_NUM') : 'PCM wave ' + P('WAV_NUM_L')) + ' (a sample)';
      cap.textContent =
        'PCM waves are recordings inside the MC-707, so there is no picture of them. Play a note to hear it.';
    }
  };
  draw();
  ctx.watch(
    k => /\.(OSC_TYPE|VA_FORM|VA_INVERT_SW|PW|PWM_DEPTH|SSAW_DETUNE|WAV_NUM_L|SYNC_WAV_NUM)$/.test(k) && draw()
  );
  return el('div', { class: 'zcEnvBox' }, svg, cap);
}

/* ---- filter ---- */
/** The filter's response: level against frequency, from type, cutoff, resonance and slope. */
export function filterCurve(ctx) {
  const W = 420,
    H = 120,
    TOP = 18,
    LO = -42; /* dB at the bottom */
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'zcEnv zcPrev', role: 'img', 'aria-label': 'Filter curve' });
  const cap = el('small', { class: 'hint' });
  const S = id => ctx.get(pk('SPTL', ctx.part, id)),
    P = id => ctx.get(pk('PTL', ctx.part, id));
  const fx = x => 20 * Math.pow(1000, x / W); /* 20 Hz to 20 kHz across */
  const yOf = db => ((TOP - Math.max(LO, Math.min(TOP, db))) / (TOP - LO)) * (H - 8) + 4;
  const draw = () => {
    svg.textContent = '';
    [100, 1000, 10000].forEach(f => {
      const x = (Math.log(f / 20) / Math.log(1000)) * W;
      svg.append(sv('line', { x1: x, x2: x, y1: 0, y2: H, class: 'zero' }));
    });
    svg.append(sv('line', { x1: 0, x2: W, y1: yOf(0), y2: yOf(0), class: 'zero' }));
    const vcf = S('FILTER_TYPE') === 1,
      tvf = ['OFF', 'LPF', 'BPF', 'HPF', 'PKG', 'LPF2', 'LPF3'][P('FILTER_TYPE')] || 'LPF',
      type = vcf ? (S('VCF_TYPE') === 0 ? 'OFF' : 'LPF') : tvf,
      poles = vcf ? [2, 3, 4][S('FILTER_SLOPE')] || 2 : tvf === 'LPF2' ? 2 : tvf === 'LPF3' ? 3 : tvf === 'LPF' ? 4 : 2,
      fc = 20 * Math.pow(1000, P('CUTOFF') / 1023),
      q = 0.6 + (P('RESO') / 1023) * 10,
      hpc = S('HPF_CUTOFF') ? 20 * Math.pow(1000, S('HPF_CUTOFF') / 1023) : 0;
    const mag = f => {
      const x = f / fc,
        d = Math.sqrt((1 - x * x) ** 2 + (x / q) ** 2);
      let g = 1;
      if (type === 'LPF' || type === 'LPF2' || type === 'LPF3') {
        g = 1 / d;
        if (poles >= 3) g /= Math.sqrt(1 + x * x);
        if (poles >= 4) g /= Math.sqrt(1 + x * x);
      } else if (type === 'HPF') g = (x * x) / d;
      else if (type === 'BPF') g = x / q / d;
      else if (type === 'PKG') g = 1 + ((P('RESO') / 1023) * 3 * (x / q)) / d;
      if (hpc) {
        const h = f / hpc;
        g *= h / Math.sqrt(1 + h * h);
      }
      return 20 * Math.log10(Math.max(1e-6, g));
    };
    const pts = [];
    for (let x = 0; x <= W; x += 2) pts.push([x, yOf(mag(fx(x)))]);
    svg.append(sv('path', { d: path(pts) + ` L${W},${H} L0,${H} Z`, class: 'fill' }));
    svg.append(sv('path', { d: path(pts), class: 'line' }));
    const hz = fc >= 1000 ? (fc / 1000).toFixed(1) + ' kHz' : Math.round(fc) + ' Hz';
    cap.textContent =
      (type === 'OFF' ? 'Filter off' : (vcf ? 'VCF ' : 'TVF ') + type + ' · about ' + hz) +
      (vcf ? ' · ' + ['-12', '-18', '-24'][S('FILTER_SLOPE')] + ' dB' : '') +
      ' · drawn from the settings, so the shape is approximate';
  };
  draw();
  ctx.watch(k => /\.(FILTER_TYPE|VCF_TYPE|FILTER_SLOPE|CUTOFF|RESO|HPF_CUTOFF)$/.test(k) && draw());
  return el('div', { class: 'zcEnvBox' }, svg, cap);
}

/* ---- LFO ---- */
const LFO_F = {
  SIN: ph => Math.sin(2 * Math.PI * ph),
  TRI: ph => (ph < 0.25 ? 4 * ph : ph < 0.75 ? 2 - 4 * ph : 4 * ph - 4),
  'SAW-UP': ph => 2 * ph - 1,
  'SAW-DW': ph => 1 - 2 * ph,
  SQR: ph => (ph < 0.5 ? 1 : -1),
  TRP: ph => Math.max(-1, Math.min(1, 2 * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph))),
  VSIN: ph => Math.sin(2 * Math.PI * ph) * (0.6 + 0.4 * Math.cos(4 * Math.PI * ph))
};
const LFO_FORMS = ['SIN', 'TRI', 'SAW-UP', 'SAW-DW', 'SQR', 'RND', 'TRP', 'S&H', 'CHS', 'VSIN', 'STEP'];
/** An LFO's shape over a few cycles, with its delay and fade (n = 1 or 2). */
export function lfoPreview(ctx, n) {
  const W = 420,
    H = 84,
    M = H / 2,
    A = H / 2 - 6;
  const pre = pk('LFO', ctx.part, 'LFO' + n + '_');
  const G = id => ctx.get(pre + id);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'zcEnv zcPrev', role: 'img', 'aria-label': 'LFO preview' });
  const draw = () => {
    svg.textContent = '';
    svg.append(sv('line', { x1: 0, x2: W, y1: M, y2: M, class: 'zero' }));
    const form = LFO_FORMS[G('FORM')] || 'SIN',
      cycles = 3,
      delay = (G('DELAY') / 1023) * W * 0.3,
      fade = (G('FADE') / 1023) * W * 0.4,
      mode = G('FADE_MODE'),
      off = G('OFST') / 100,
      r = rnd(11),
      steps = Array.from({ length: 16 }, (_, i) => (ctx.get(pre + 'STEP_' + (i + 1)) || 0) / 72),
      nSteps = (G('STEP_MAX') ?? 15) + 1;
    const rand = Array.from({ length: cycles * 4 + 2 }, () => r() * 2 - 1);
    const val = ph => {
      const c = Math.floor(ph),
        f = ph - c;
      if (form === 'STEP') return steps[Math.floor(f * nSteps) % 16];
      if (form === 'S&H') return rand[c * 2 + (f < 0.5 ? 0 : 1)];
      if (form === 'RND' || form === 'CHS') {
        const a = rand[c],
          b = rand[c + 1],
          t = (1 - Math.cos(Math.PI * f)) / 2;
        return (a + (b - a) * t) * (form === 'CHS' ? 0.6 + 0.4 * Math.sin(17 * ph) : 1);
      }
      return LFO_F[form](f);
    };
    const pts = [];
    for (let x = 0; x <= W; x++) {
      let amp = 1,
        v = 0;
      if (x < delay) v = 0;
      else {
        const t = x - delay;
        /* fades: ON-IN / OFF-IN rise over the fade time, ON-OUT / OFF-OUT fall */
        if (fade > 0) amp = mode % 2 === 0 ? Math.min(1, t / fade) : Math.max(0, 1 - t / fade);
        v = val((t / (W - delay || 1)) * cycles);
      }
      pts.push([x, M - A * Math.max(-1, Math.min(1, v * amp + (x < delay ? 0 : off * 0.5)))]);
    }
    svg.append(sv('path', { d: path(pts), class: 'line' }));
  };
  draw();
  ctx.watch(k => k.startsWith(pre) && draw());
  return svg;
}
