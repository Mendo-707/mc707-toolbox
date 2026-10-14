import { devNm, devNum } from '../core/device.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { CMNOW, clipFor, clipMarkAt, cmFix, cmMarks, ctInfo, patType } from '../services/clip-switch.js';
import { CM_ABBR, clipMapOpen } from './clips-screen.js';
import { hooks } from '../core/hooks.js';

export function cmChipSet(t, k) {
  CMNOW[t] = k;
  ['thClip', 'lvClip'].forEach(p => {
    const e = document.getElementById(p + t);
    if (e) cmChipFill(e, t, k);
  });
}
export function cmChipFill(e, t, k) {
  const m = cmFix()[t],
    on = k != null && k >= 0;
  e.textContent = on ? 'C' + (k + 1) + ' ' + (m.names[k] ? m.names[k].slice(0, 7) : CM_ABBR[m.types[k]]) : 'Clip';
  e.style.setProperty('--k', on ? ctInfo(m.types[k])[2] : 'transparent');
  e.classList.toggle('on', on);
  e.title =
    (on ? devNm() + ' track ' + devNum(t) + ' is on ' + cmLabel(t, k) : 'No clip chosen yet') + '. Click to change.';
}
export const cmLabel = (t, k) => {
  if (k < 0) return 'Automatic';
  const m = cmFix()[t];
  return 'Clip ' + (k + 1) + ' · ' + (m.names[k] || ctInfo(m.types[k])[1]);
};
/* menu entries: every clip set up on this track, then automatic, then the clips screen */
export function cmPickItems(t, cur, fn, autoLabel) {
  const m = cmFix()[t],
    items = [];
  for (let k = 0; k < m.n; k++) items.push({ label: cmLabel(t, k), checked: cur === k, action: () => fn(k) });
  if (autoLabel && (S.clipAuto || cur === -1))
    items.push('-', { label: autoLabel, checked: cur === -1, action: () => fn(-1) });
  items.push('-', { label: 'Set up track ' + devNum(t) + ' clips…', action: () => clipMapOpen(t) });
  return items;
}
export function setClipMark(t, bar, k) {
  pushUndo();
  bar = Math.max(0, Math.floor(bar));
  const ms = cmMarks(),
    ex = ms.find(m => m.t === t && m.bar === bar);
  if (ex) ex.k = k;
  else ms.push({ t, bar, k });
  ms.sort((a, b) => a.bar - b.bar || a.t - b.t);
  scheduleSave();
  hooks.renderArr();
}
export function delClipMark(mk) {
  pushUndo();
  S.clipMarks = cmMarks().filter(m => m !== mk);
  scheduleSave();
  hooks.renderArr();
}
/* which clip a track is on at a bar, as far as the app knows */
export function cmAtBar(t, bar) {
  const mk = clipMarkAt(t, bar);
  if (mk && mk.k >= 0) return mk.k;
  let last = null;
  for (const c of S.clips) if (c.t === t && c.start <= bar + 1e-9 && (!last || c.start > last.start)) last = c;
  if (last && last.pc != null) return last.pc;
  if (S.clipAuto && last) {
    const k = clipFor(t, patType(S.patterns[last.pat]));
    if (k >= 0) return k;
  }
  return null;
}
