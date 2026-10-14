// Arrangement layout: snap, row heights that fit the window, the splitter between arrangement and
// editor, and clip geometry.
//
// Reads: S, ED, ROWH.
import { $, clamp, el } from '../core/dom.js';
import { devCount } from '../core/device.js';
import { ED, S, curClip, pushUndo, scheduleSave } from '../core/state.js';
import { ROWH, RULERH, renderArr, setRowHeight } from './arrangement.js';
import { carve, ensureBars, loopLen, q16, wrapOff } from '../core/song-model.js';
import { layoutEditor } from './editor.js';

export const SNAP = () => ([1, 0.5, 0.25, 0.0625].includes(+S.snap) ? +S.snap : 1);
export const snapBar = v => Math.round(v / SNAP()) * SNAP();
export const snapFloor = v => Math.floor(v / SNAP() + 1e-9) * SNAP();
export function fitRows() {
  const a = $('#arr');
  if (!a) return false;
  const h = a.getBoundingClientRect().height;
  if (!h) return false;
  const r = clamp(Math.floor((h - RULERH - 3 - 16) / devCount()), 34, 180);
  if (r !== ROWH) {
    setRowHeight(r);
    return true;
  }
  return false;
}
let GEOMT = 0;
export function setGeom(c, g, coal) {
  const now = performance.now();
  if (!coal || now - GEOMT > 800) pushUndo();
  GEOMT = now;
  if (g.t != null) c.t = g.t;
  if (g.ll !== undefined) {
    if (g.ll > 0) c.ll = q16(clamp(g.ll, 0.0625, 8));
    else delete c.ll;
  }
  const L = loopLen(c);
  let start = g.start != null ? q16(Math.max(0, g.start)) : c.start,
    len = g.len != null ? q16(Math.max(0.0625, g.len)) : c.len,
    off = g.off != null ? g.off : c.off;
  if (g.trim != null) {
    const nd = Math.min(g.trim, c.len - 0.0625);
    const ns = Math.max(0, c.start + nd);
    const real = ns - c.start;
    start = q16(ns);
    len = q16(c.len - real);
    off = c.off + real;
  }
  carve(c.t, start, start + len, c.id);
  c.start = start;
  c.len = len;
  c.off = wrapOff(off, loopLen(c));
  ensureBars(start + len);
  renderArr();
  scheduleSave();
}
export function clipArrow(e) {
  const c = curClip();
  if (!c) return false;
  const s = SNAP(),
    k = e.key;
  if (k === 'ArrowUp' || k === 'ArrowDown') {
    const type = S.tracks[c.t].type;
    const dir = k === 'ArrowUp' ? -1 : 1;
    let t = c.t + dir;
    while (t >= 0 && t < 8 && S.tracks[t].type !== type) t += dir;
    if (t < 0 || t > 7) return true;
    e.preventDefault();
    setGeom(c, { t }, true);
    return true;
  }
  const d = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
  if (!d) return false;
  e.preventDefault();
  if (e.shiftKey) setGeom(c, { len: c.len + d * s }, true);
  else if (e.altKey) setGeom(c, { trim: d * s }, true);
  else setGeom(c, { start: c.start + d * s }, true);
  return true;
}
export function initPro() {
  const sel = $('#snapSel');
  [
    [1, 'Bar'],
    [0.5, '1/2 bar'],
    [0.25, 'Beat'],
    [0.0625, 'Step']
  ].forEach(([v, l]) => sel.append(el('option', { value: v }, l)));
  sel.value = SNAP();
  sel.addEventListener('change', e => {
    S.snap = +e.target.value;
    scheduleSave();
  });
  try {
    const h = +localStorage.getItem('mc707-edh');
    if (h >= 140) document.documentElement.style.setProperty('--edH', h + 'px');
  } catch (e) {}
  const split = $('#split'),
    ed = $('#editor');
  split.addEventListener('pointerdown', e => {
    e.preventDefault();
    split.setPointerCapture(e.pointerId);
    const y0 = e.clientY,
      h0 = ed.getBoundingClientRect().height;
    const mv = ev => {
      const h = clamp(h0 - (ev.clientY - y0), 140, innerHeight - 260);
      document.documentElement.style.setProperty('--edH', h + 'px');
    };
    const up = () => {
      split.removeEventListener('pointermove', mv);
      split.removeEventListener('pointerup', up);
      try {
        localStorage.setItem('mc707-edh', String(Math.round(ed.getBoundingClientRect().height)));
      } catch (e) {}
      if (ED.geom) layoutEditor();
    };
    split.addEventListener('pointermove', mv);
    split.addEventListener('pointerup', up);
  });
  split.addEventListener('dblclick', () => {
    document.documentElement.style.removeProperty('--edH');
    try {
      localStorage.removeItem('mc707-edh');
    } catch (e) {}
    if (ED.geom) layoutEditor();
  });
  split.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const h = ed.getBoundingClientRect().height + (e.key === 'ArrowUp' ? 30 : -30);
    document.documentElement.style.setProperty('--edH', clamp(h, 140, innerHeight - 260) + 'px');
    if (ED.geom) layoutEditor();
  });
  if (window.ResizeObserver)
    new ResizeObserver(() => {
      if (fitRows()) renderArr();
    }).observe($('#arr'));
  if (fitRows()) renderArr();
}
