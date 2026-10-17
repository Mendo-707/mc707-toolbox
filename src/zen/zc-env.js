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
/**
 * An envelope graph. blk is the instance prefix ('AENV0'); levels lists the level keys in order
 * (null for a fixed zero, as the amp envelope starts and ends at silence).
 */
export function envGraph(ctx, blk, levels) {
  const W = 420,
    H = 150,
    P = 10;
  const K = id => blk + '.' + id;
  const lv = levels.map(id => (id ? paramOf(ctx.kind, K(id))[0] : null));
  const lo = lv.find(Boolean)[3],
    hi = lv.find(Boolean)[4];
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'zcEnv', role: 'img', 'aria-label': 'Envelope' });
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
  draw();
  return el(
    'div',
    { class: 'zcEnvBox' },
    svg,
    el('small', { class: 'hint' }, 'Drag the points: sideways for time, up and down for level.')
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
