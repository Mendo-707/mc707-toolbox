// Envelope and LFO step graphs for the ZenCore editor: drag a point to change its time (sideways)
// and level (up and down), drag a bar to change an LFO step.
//
// Reads: the sound through the editor's ctx.
import { el } from '../core/dom.js';
import { paramOf } from './zc-tone.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, a = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, a[k]);
  return e;
};
/* Shape presets: times (0-1023) and levels as a share of the full range. Levels are [L0, L1, L2, L3, L4];
   the amp envelope uses L1-L3 (it starts and ends at silence). ZEN-Core envelopes have no curve setting,
   so a shape is these times and levels. */
const SHAPES = {
  amp: [
    ['Pluck', [0, 300, 380, 260], [0, 1, 0.22, 0, 0]],
    ['Stab', [0, 160, 220, 140], [0, 1, 0.5, 0, 0]],
    ['Ping', [0, 90, 110, 70], [0, 1, 0, 0, 0]],
    ['Bass', [0, 260, 320, 90], [0, 1, 0.65, 0.55, 0]],
    ['Organ (gate)', [0, 0, 0, 40], [0, 1, 1, 1, 0]],
    ['Brass', [130, 320, 320, 220], [0, 1, 0.78, 0.7, 0]],
    ['Strings', [420, 380, 380, 520], [0, 1, 0.92, 0.88, 0]],
    ['Pad', [620, 520, 420, 720], [0, 1, 0.9, 0.85, 0]],
    ['Swell', [900, 380, 300, 640], [0, 1, 1, 1, 0]],
    ['Reverse', [820, 12, 12, 24], [0, 1, 0, 0, 0]],
    ['Long tail', [0, 640, 720, 900], [0, 1, 0.3, 0, 0]]
  ],
  filter: [
    ['Pluck sweep', [0, 280, 360, 260], [0.2, 1, 0.3, 0.15, 0.1]],
    ['Acid (fast decay)', [0, 180, 240, 120], [0, 1, 0.18, 0.1, 0]],
    ['Bass punch', [0, 140, 260, 120], [0.1, 1, 0.45, 0.35, 0.2]],
    ['Brass swell', [180, 360, 360, 260], [0.2, 1, 0.7, 0.6, 0.3]],
    ['Slow open', [820, 400, 300, 600], [0, 1, 1, 1, 0.4]],
    ['Wah down', [0, 520, 520, 300], [1, 0.9, 0.2, 0, 0]],
    ['Flat (open)', [0, 0, 0, 0], [1, 1, 1, 1, 1]]
  ],
  pitch: [
    ['Flat', [0, 0, 0, 0], [0, 0, 0, 0, 0]],
    ['Drop (kick, zap)', [0, 160, 200, 120], [0.8, 0, 0, 0, 0]],
    ['Blip', [0, 40, 60, 40], [0.5, 0, 0, 0, 0]],
    ['Rise in', [0, 260, 260, 160], [-0.5, 0, 0, 0, 0]],
    ['Dive on release', [0, 0, 0, 520], [0, 0, 0, 0, -0.8]],
    ['Scoop', [0, 120, 160, 100], [-0.25, 0.05, 0, 0, 0]]
  ]
};
const KIND = { AENV: 'amp', FENV: 'filter', PENV: 'pitch' };
const LEVELS = {
  AENV: [null, 'L1', 'L2', 'L3', null],
  FENV: ['L0', 'L1', 'L2', 'L3', 'L4'],
  PENV: ['L0', 'L1', 'L2', 'L3', 'L4']
};

/**
 * An envelope graph. blk is the instance prefix ('AENV0'); levels lists the level keys in order
 * (null for a fixed zero, as the amp envelope starts and ends at silence). Under the graph: the same
 * values as numbers, shape presets, and copying the shape to the other partials or envelopes.
 */
export function envGraph(ctx, blk, levels) {
  const W = 420,
    H = 150,
    P = 10;
  const K = id => blk + '.' + id;
  const env = blk.replace(/\d+$/, ''),
    part = +blk.slice(env.length);
  const lv = levels.map(id => (id ? paramOf(ctx.kind, K(id))[0] : null));
  const lo = lv.find(Boolean)[3],
    hi = lv.find(Boolean)[4];
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'zcEnv', role: 'img', 'aria-label': 'Envelope' });
  const nums = [];
  const sync = () => nums.forEach(([inp, id]) => document.activeElement !== inp && (inp.value = ctx.get(K(id))));
  const draw = () => {
    svg.textContent = '';
    const T = [1, 2, 3, 4].map(i => ctx.get(K('T' + i)));
    const L = levels.map(id => (id ? ctx.get(K(id)) : 0));
    /* times on a square-root scale so short attacks stay visible; the sustain gets a fixed stretch */
    const tw = t => 8 + Math.sqrt(t / 1023) * 80;
    const xs = [P];
    xs.push(xs[0] + tw(T[0]), 0, 0, 0);
    xs[2] = xs[1] + tw(T[1]);
    xs[3] = xs[2] + tw(T[2]);
    const sus = 50;
    xs[4] = xs[3] + sus + tw(T[3]);
    const scale = Math.min(1, (W - 2 * P) / (xs[4] - P));
    const X = xs.map(x => P + (x - P) * scale),
      Y = l => H - P - ((l - lo) / (hi - lo || 1)) * (H - 2 * P);
    if (lo < 0) svg.append(sv('line', { x1: P, x2: W - P, y1: Y(0), y2: Y(0), class: 'zero' }));
    const pts = [
      [X[0], Y(L[0])],
      [X[1], Y(L[1])],
      [X[2], Y(L[2])],
      [X[3], Y(L[3])],
      [X[3] + sus * scale, Y(L[3])],
      [X[4], Y(L[4])]
    ];
    svg.append(sv('path', { d: 'M' + pts.map(p => p.join(',')).join(' L'), class: 'line' }));
    svg.append(
      sv('path', {
        d: 'M' + pts.map(p => p.join(',')).join(' L') + ` L${X[4]},${H - P} L${P},${H - P} Z`,
        class: 'fill'
      })
    );
    /* handles: point i ends time Ti and sits at level Li */
    [1, 2, 3, 5].forEach((pi, n) => {
      const ti = n + 1,
        li = pi === 5 ? 4 : pi;
      const h = sv('circle', { cx: pts[pi][0], cy: pts[pi][1], r: 6, class: 'h' });
      h.addEventListener('pointerdown', e => drag(e, ti, levels[li] ? li : null, scale));
      svg.append(h);
    });
    if (levels[0]) {
      const h = sv('circle', { cx: pts[0][0], cy: pts[0][1], r: 6, class: 'h' });
      h.addEventListener('pointerdown', e => drag(e, null, 0, scale));
      svg.append(h);
    }
    sync();
  };
  function drag(e, ti, li, scale) {
    e.preventDefault();
    const r = svg.getBoundingClientRect(),
      kx = W / r.width,
      ky = H / r.height;
    const t0 = ti ? ctx.get(K('T' + ti)) : 0,
      l0 = li != null ? ctx.get(K(levels[li])) : 0,
      x0 = e.clientX,
      y0 = e.clientY;
    const move = ev => {
      if (ti) {
        /* sideways: move along the square-root time scale */
        const s0 = Math.sqrt(t0 / 1023) * 80,
          s = Math.max(0, Math.min(80, s0 + ((ev.clientX - x0) * kx) / scale));
        ctx.set(K('T' + ti), Math.round((s / 80) ** 2 * 1023), false);
      }
      if (li != null) {
        const d = (-(ev.clientY - y0) * ky * (hi - lo)) / (H - 2 * P);
        ctx.set(K(levels[li]), Math.round(Math.max(lo, Math.min(hi, l0 + d))), false);
      }
      draw();
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      ctx.commit();
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }
  /* the same values as numbers: Time 1-4 and the levels */
  const num = (id, label) => {
    const [p] = paramOf(ctx.kind, K(id));
    const inp = el('input', {
      type: 'number',
      min: p[3],
      max: p[4],
      step: 1,
      'aria-label': label,
      onchange: e => ctx.set(K(id), Math.round(Math.max(p[3], Math.min(p[4], +e.target.value || 0))), true)
    });
    nums.push([inp, id]);
    return el('label', { class: 'zcEnvN' }, el('span', {}, label), inp);
  };
  const row = el(
    'div',
    { class: 'zcEnvNums' },
    ...[1, 2, 3, 4].map(i => num('T' + i, 'Time ' + i)),
    ...levels.map((id, i) => (id ? num(id, 'Level ' + i) : null)).filter(Boolean)
  );
  /* write a shape (times, levels as shares of the range) into envelope e of partial pt */
  const put = (e, pt, T, Lf) => {
    const k = id => e + pt + '.' + id,
      ls = LEVELS[e];
    T.forEach((t, i) => ctx.set(k('T' + (i + 1)), t, false));
    ls.forEach((id, i) => {
      if (!id) return;
      const [p] = paramOf(ctx.kind, k(id));
      ctx.set(k(id), Math.round(Math.max(p[3], Math.min(p[4], Lf[i] * (Lf[i] < 0 ? -p[3] : p[4])))), false);
    });
  };
  /* this envelope's shape as shares of its range, to copy elsewhere */
  const shape = () => {
    const T = [1, 2, 3, 4].map(i => ctx.get(K('T' + i)));
    const L = LEVELS[env].map(id => {
      if (!id) return 0;
      const v = ctx.get(K(id)),
        [p] = paramOf(ctx.kind, K(id));
      return v < 0 ? v / -p[3] : v / (p[4] || 1);
    });
    return [T, L];
  };
  const presets = el(
    'select',
    {
      'aria-label': 'Shape preset',
      onchange: e => {
        const s = SHAPES[KIND[env]][+e.target.value];
        e.target.value = '';
        if (!s) return;
        put(env, part, s[1], s[2]);
        ctx.commit();
      }
    },
    el('option', { value: '' }, 'Shape preset…'),
    ...SHAPES[KIND[env]].map(([n], i) => el('option', { value: i }, n))
  );
  const others = Object.keys(KIND).filter(e => e !== env);
  const copy = el(
    'select',
    {
      'aria-label': 'Copy this envelope',
      onchange: e => {
        const v = e.target.value;
        e.target.value = '';
        const [T, L] = shape();
        if (v === 'parts') [0, 1, 2, 3].filter(i => i !== part).forEach(i => put(env, i, T, L));
        else if (KIND[v]) put(v, part, T, L);
        else return;
        ctx.commit();
      }
    },
    el('option', { value: '' }, 'Copy this shape…'),
    el('option', { value: 'parts' }, 'to the other 3 partials'),
    ...others.map(e => el('option', { value: e }, 'to the ' + KIND[e] + ' envelope (this partial)'))
  );
  draw();
  ctx.watch(k => k.startsWith(blk + '.') && draw());
  return el(
    'div',
    { class: 'zcEnvBox' },
    svg,
    row,
    el('div', { class: 'zcEnvTools' }, presets, copy),
    el(
      'small',
      { class: 'hint' },
      'Drag the points (sideways for time, up and down for level), type the values, or pick a shape.'
    )
  );
}

/** The 16 steps of an LFO's STEP wave (key prefix 'LFO0.LFO1_'), dragged as bars. */
export function stepGraph(ctx, pre) {
  const W = 420,
    H = 110;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'zcEnv zcSteps', role: 'img', 'aria-label': 'LFO steps' });
  const key = i => pre + 'STEP_' + (i + 1);
  const draw = () => {
    svg.textContent = '';
    svg.append(sv('line', { x1: 0, x2: W, y1: H / 2, y2: H / 2, class: 'zero' }));
    const n = ctx.get(pre + 'STEP_MAX') ?? 15;
    for (let i = 0; i < 16; i++) {
      const v = ctx.get(key(i)),
        x = (i * W) / 16 + 2,
        y = H / 2 - (v / 72) * (H / 2 - 4);
      svg.append(
        sv('rect', {
          x,
          width: W / 16 - 4,
          y: Math.min(y, H / 2),
          height: Math.max(1, Math.abs(H / 2 - y)),
          class: 'bar' + (i > n ? ' off' : '')
        })
      );
    }
  };
  const at = ev => {
    const r = svg.getBoundingClientRect(),
      i = Math.max(0, Math.min(15, Math.floor(((ev.clientX - r.left) / r.width) * 16))),
      y = ((ev.clientY - r.top) / r.height) * H,
      v = Math.round(Math.max(-72, Math.min(72, ((H / 2 - y) / (H / 2 - 4)) * 72)));
    ctx.set(key(i), v, false);
    draw();
  };
  svg.addEventListener('pointerdown', e => {
    e.preventDefault();
    at(e);
    const up = () => {
      removeEventListener('pointermove', at);
      removeEventListener('pointerup', up);
      ctx.commit();
    };
    addEventListener('pointermove', at);
    addEventListener('pointerup', up);
  });
  draw();
  return svg;
}
