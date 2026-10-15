// Inserting MC-707 clip changes quickly: at the playhead (K, or the toolbar button), by Alt+click on
// a lane, flipping straight back to the clip before (Shift+K), and switching back and forth between
// two clips every few bars.
//
// Reads: S, UI.
import { toast } from '../core/dom.js';
import { devNm, devNum, devOn } from '../core/device.js';
import { S, curClip, pushUndo, scheduleSave } from '../core/state.js';
import { songEnd } from '../core/song-model.js';
import { cmFix, cmMarks } from '../services/clip-switch.js';
import { cmAtBar, cmLabel, cmPickItems, delClipMark, setClipMark } from '../clips/clip-map.js';
import { showMenu } from '../ui/menu.js';
import { posBarNow } from './clip-ops.js';
import { hooks } from '../core/hooks.js';

const short = k => 'C' + (k + 1);
/**
 * The clip to flip to at a bar: the one the track was on before its current clip, or else Clip 1
 * (Clip 2 when it is already on Clip 1). Null when the track has only one clip set up.
 */
export function cmFlipTarget(t, bar) {
  const n = cmFix()[t].n;
  if (n < 2) return null;
  const now = bar > 0 ? cmAtBar(t, bar - 1) : null;
  const earlier = cmMarks()
    .filter(m => m.t === t && m.bar < bar && m.k >= 0 && m.k < n)
    .sort((a, b) => b.bar - a.bar)
    .map(m => m.k)
    .find(k => k !== now);
  if (earlier != null) return earlier;
  return now == null || now <= 0 ? 1 : 0;
}
/** Menu items for a clip change on track t at a bar: flip back, every clip, remove, back and forth. */
export function clipChangeItems(t, bar) {
  const b = Math.max(0, Math.floor(bar)),
    mk = cmMarks().find(m => m.t === t && m.bar === b),
    f = cmFlipTarget(t, b);
  return [
    f != null ? { label: '⇄ Flip to ' + cmLabel(t, f), hint: 'Shift+K', action: () => setClipMark(t, b, f) } : null,
    ...cmPickItems(t, mk ? mk.k : null, k => setClipMark(t, b, k), 'Back to automatic here'),
    mk ? { label: 'Remove the clip change at bar ' + (b + 1), danger: true, action: () => delClipMark(mk) } : null,
    cmFix()[t].n > 1 ? { label: 'Switch back and forth', sub: alternateItems(t, b) } : null
  ];
}
/* the range a back-and-forth covers: the loop if the bar is inside it, otherwise from the bar to the song's end */
function altRange(b) {
  if (S.loop.on && b >= S.loop.start && b < S.loop.end)
    return [Math.floor(S.loop.start), Math.max(Math.floor(S.loop.start) + 1, Math.ceil(S.loop.end))];
  return [b, Math.max(b + 1, Math.ceil(songEnd()))];
}
function alternateItems(t, b) {
  const n = cmFix()[t].n,
    [from, to] = altRange(b),
    cur = cmAtBar(t, from);
  const a = cur != null && cur >= 0 && cur < n ? cur : 0;
  let f = cmFlipTarget(t, from);
  if (f == null || f === a) f = (a + 1) % n;
  const range = 'bars ' + (from + 1) + '–' + to;
  const every = (x, y) =>
    [1, 2, 4, 8].map(e => ({
      label: short(x) + ' ↔ ' + short(y) + ' every ' + (e === 1 ? 'bar' : e + ' bars') + ', ' + range,
      action: () => alternate(t, from, to, x, y, e)
    }));
  const others = [];
  for (let k = 0; k < n; k++) if (k !== a && k !== f) others.push(k);
  return [
    ...every(a, f),
    others.length
      ? {
          label: 'With another clip',
          sub: others.map(k => ({ label: cmLabel(t, k), sub: every(a, k) }))
        }
      : null
  ];
}
/**
 * Clip changes on track t from bar `from` to `to`: clip x, then y, then x … every `each` bars. The
 * clip that was playing at `to` comes back there.
 */
export function alternate(t, from, to, x, y, each) {
  pushUndo();
  const back = cmAtBar(t, to);
  const keep = cmMarks().filter(m => !(m.t === t && m.bar >= from && m.bar < to));
  for (let b = from, i = 0; b < to; b += each, i++) keep.push({ t, bar: b, k: i % 2 ? y : x });
  if (back != null && back >= 0 && to < songEnd() && !keep.some(m => m.t === t && m.bar === to))
    keep.push({ t, bar: to, k: back });
  keep.sort((p, q) => p.bar - q.bar || p.t - q.t);
  S.clipMarks = keep;
  scheduleSave();
  hooks.renderArr();
  toast(
    'Track ' +
      devNum(t) +
      ' switches ' +
      short(x) +
      ' ↔ ' +
      short(y) +
      ' every ' +
      each +
      ' bar' +
      (each > 1 ? 's' : '')
  );
}
/* the track a playhead clip change is for: the selected clip's track, if the MC-707 uses it */
const selTrack = () => {
  const c = curClip();
  return c && devOn(c.t) ? c.t : null;
};
/** The clip-change menu at the playhead (toolbar button and K): the selected clip's track first, then every track. */
export function clipChangeMenu(x, y) {
  const bar = Math.floor(posBarNow()),
    t0 = selTrack(),
    tracks = S.tracks.map((_, i) => i).filter(i => devOn(i));
  const trackItem = t => ({ label: 'Track ' + devNum(t) + ': ' + S.tracks[t].name, sub: clipChangeItems(t, bar) });
  showMenu(x, y, [
    { label: devNm() + ' clip change at bar ' + (bar + 1) + ' (playhead)', disabled: true },
    ...(t0 != null
      ? [
          { label: 'Track ' + devNum(t0) + ': ' + S.tracks[t0].name, disabled: true },
          ...clipChangeItems(t0, bar),
          '-',
          { label: 'Another track', sub: tracks.filter(t => t !== t0).map(trackItem) }
        ]
      : tracks.map(trackItem))
  ]);
}
/** Shift+K: flip the selected clip's track back to the clip before, at the playhead. */
export function flipAtPlayhead() {
  const t = selTrack();
  if (t == null) {
    toast('Select a clip on the track first, or press K to choose a track');
    return;
  }
  const bar = Math.floor(posBarNow()),
    f = cmFlipTarget(t, bar);
  if (f == null) {
    toast('Track ' + devNum(t) + ' has one clip set up. Set up more in Your ' + devNm() + ' clips.');
    return;
  }
  setClipMark(t, bar, f);
  toast('Bar ' + (bar + 1) + ': track ' + devNum(t) + ' → ' + cmLabel(t, f));
}
