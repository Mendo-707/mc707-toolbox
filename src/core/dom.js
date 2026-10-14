// Tiny DOM helpers used everywhere: $ and $$ (querySelector), el() to build elements, clamp, toast
// messages, and duration formatting.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
/** Limit v to the range a…b. */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/**
 * Build a DOM element. props: class, style, id, any attribute, and on<event> handlers
 * (e.g. onclick). kids: strings, nodes, or null/false (skipped).
 * @param {string} tag
 * @param {object} [props]
 * @param {...(Node|string|null|false)} kids
 * @returns {HTMLElement}
 */
export const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
/** Show a short message at the bottom of the window. @param {string} msg */
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2300);
}
/** "2:45" for a number of bars at a tempo. @param {number} bars @param {number} bpm @returns {string} */
export const fmtDur = (bars, bpm) => {
  const sec = (bars * 4 * 60) / bpm;
  return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0');
};
