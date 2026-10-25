// Between Song Mode and Scene Mode: make scenes from the song (a scene wherever the patterns playing
// change, named after the song's markers) and lay the scenes out as the song (a clip per run of the same
// cell, a marker per scene).
//
// Reads: S.
import { toast } from '../core/dom.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { DEVS, DEV } from '../core/device.js';
import { hooks } from '../core/hooks.js';
import { SCN_BARS, SCN_MAX, newRow, sameCell } from '../core/scene-model.js';
import { ensureBars } from '../core/song-model.js';
import { askDlg } from '../ui/dialogs.js';
import { SC, edit, rows } from './model.js';

/** The song as scene rows (see the header). */
export function songToRows() {
  const tracks = DEVS[DEV].tracks;
  const live = S.clips.filter(c => tracks.includes(c.t) && !c.mute && S.patterns[c.pat]);
  const cuts = [...new Set(live.flatMap(c => [Math.round(c.start), Math.round(c.start + c.len)]))].sort(
    (a, b) => a - b
  );
  const segs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i],
      b = cuts[i + 1],
      cells = Array(8).fill(null);
    if (b <= a) continue;
    for (const t of tracks) {
      const c = live.find(c => c.t === t && a + 0.5 >= c.start && a + 0.5 < c.start + c.len);
      if (c) cells[t] = c.tr && S.patterns[c.pat].type === 'tone' ? { pat: c.pat, tr: c.tr } : { pat: c.pat };
    }
    const prev = segs[segs.length - 1];
    if (prev && prev.b === a && cells.every((x, t) => (x ? sameCell(x, prev.cells[t]) : !prev.cells[t]))) prev.b = b;
    else segs.push({ a, b, cells });
  }
  const empty = s => s.cells.every(x => !x);
  while (segs.length && empty(segs[0])) segs.shift();
  while (segs.length && empty(segs[segs.length - 1])) segs.pop();
  const out = [];
  for (const s of segs)
    for (let a = s.a; a < s.b; a += SCN_BARS) {
      const mk = S.markers.find(m => m.bar === a);
      const r = newRow('r' + S.nextId++, mk ? mk.name : 'Scene ' + (out.length + 1), Math.min(SCN_BARS, s.b - a));
      r.cells = s.cells.map(x => (x ? { ...x } : null));
      out.push(r);
    }
  return out;
}
/** Scene Mode's From the song. */
export async function scenesFromSong() {
  const list = songToRows();
  if (!list.length) return toast('The song has nothing to make scenes from');
  if (list.length > SCN_MAX) return toast('That would be ' + list.length + ' scenes; the MC-707 holds 128');
  if (
    rows().length &&
    !(await askDlg({
      title: 'Replace the scenes?',
      text:
        'Your ' +
        rows().length +
        ' scenes are replaced by ' +
        list.length +
        ' made from the song (Undo brings them back).',
      ok: 'Replace'
    }))
  )
    return;
  edit(q => {
    q.rows = list;
    SC.row = 0;
  });
  toast('Made ' + list.length + ' scenes from the song');
}
/** Scene Mode's To Song Mode: the scenes laid out one after another, replacing the song's clips and markers. */
export async function scenesToSong() {
  const rs = rows();
  if (!rs.length) return toast('Add a scene first');
  if (
    S.clips.length &&
    !(await askDlg({
      title: 'Replace the song’s arrangement?',
      text: 'The clips and markers in Song Mode are replaced by the scenes, one after another (Undo brings them back).',
      ok: 'Replace'
    }))
  )
    return;
  pushUndo();
  S.clips = [];
  S.markers = [];
  let at = 0;
  const open = Array(8).fill(null);
  const shut = t => {
    if (open[t]) (S.clips.push(open[t].clip), (open[t] = null));
  };
  rs.forEach(r => {
    S.markers.push({ bar: at, name: r.name });
    for (let t = 0; t < 8; t++) {
      const c = r.cells[t];
      if (open[t] && sameCell(open[t].cell, c)) open[t].clip.len += r.bars;
      else {
        shut(t);
        if (c && S.patterns[c.pat]) {
          const clip = { id: 'c' + S.nextId++, t, start: at, len: r.bars, off: 0, pat: c.pat };
          if (c.tr) clip.tr = c.tr;
          open[t] = { cell: c, clip };
        }
      }
    }
    at += r.bars;
  });
  for (let t = 0; t < 8; t++) shut(t);
  ensureBars(at);
  scheduleSave();
  hooks.renderAll();
  toast('Laid out ' + rs.length + ' scenes (' + at + ' bars) in Song Mode');
}
