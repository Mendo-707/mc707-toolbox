// Scene Mode's clips board, laid out like the MC-707's CLIP screen: a column for each track (1-D … 8-T)
// with its 16 clips down it, so the clips a scene plays read across like they do on the MC-707 (with the
// editor expanded, the one track's clips in a row).
// A clip shows its pattern, its tone, and whether it is written to the MC-707 (✓), changed since (●) or
// new (+); the clips the selected scene plays are outlined, clips no scene plays are faded, and a ring
// marks a clip that holds notes on the MC-707 (from Check). Click an empty clip to fill it, a full one to
// edit it; right-click for its menu; each track can write its clips.
//
// Reads: S, SC.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { clipState, clipUses } from '../core/scene-model.js';
import { SC, rows, toneOf } from './model.js';
import { checked } from './check.js';

export const MARK = { written: '✓', changed: '●', new: '+', odd: '!' };
export const MARK_TIP = {
  written: 'Written to the MC-707, and not changed since',
  odd: 'Written, but the MC-707 read it back differently: Write ▾ › Show the last write report',
  changed: 'Changed since it was written: write it again',
  new: 'Not written to the MC-707 yet'
};

/**
 * The board. act: {pick(t, k), edit(t, k), menu(t, k, x, y), trackMenu(t, x, y), writeTrack(t)}.
 * @param {number|null} only  draw only this track (the expanded editor)
 */
export function board(act, only = null) {
  const q = S.scn,
    sel = rows()[SC.row],
    tracks = DEVS[DEV].tracks.filter(t => only == null || t === only);
  const pending = t =>
    Array.from({ length: 16 }, (_, k) => clipState(q, S.patterns, t, k)).filter(s => s === 'new' || s === 'changed')
      .length;
  const trk = t => {
    const n = pending(t);
    return el(
      'div',
      {
        class: 'sbTrk',
        style: '--tc:' + TRACK_COLORS[t],
        title: 'Right-click for this track: write its clips, check them on the MC-707',
        oncontextmenu: e => (e.preventDefault(), act.trackMenu(t, e.clientX, e.clientY))
      },
      el(
        'b',
        {},
        /* the MC-707's own column label (1-D a drum track, 3-T a tone track) */
        only == null
          ? devNum(t) + '-' + (S.tracks[t].type === 'drum' ? 'D' : 'T') + ' ' + S.tracks[t].name
          : devNum(t) + ' ' + S.tracks[t].name
      ),
      n
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn sm sbWr',
              title: 'Write this track’s ' + n + ' new or changed clip' + (n === 1 ? '' : 's') + ' to the MC-707',
              onclick: () => act.writeTrack(t)
            },
            '⤒ ' + n
          )
        : null
    );
  };
  /* the expanded editor keeps its one track as a row of 16 */
  if (only != null) {
    const head = el(
      'div',
      { class: 'sbRow sbHead' },
      el('div', { class: 'sbTrk' }, el('span', { class: 'hint' }, 'MC-707 clips')),
      ...Array.from({ length: 16 }, (_, k) => el('div', { class: 'sbNum' }, String(k + 1)))
    );
    const row = el(
      'div',
      { class: 'sbRow', style: '--tc:' + TRACK_COLORS[only] },
      trk(only),
      ...Array.from({ length: 16 }, (_, k) => slot(only, k, sel, act))
    );
    return el('div', { class: 'sBoard', role: 'grid', 'aria-label': 'MC-707 clips' }, head, row);
  }
  const head = el(
    'div',
    { class: 'sbRow sbHead' },
    el('div', { class: 'sbNum', title: 'Clip number, as on the MC-707' }, 'Clip'),
    ...tracks.map(trk)
  );
  const body = Array.from({ length: 16 }, (_, k) =>
    el(
      'div',
      { class: 'sbRow' },
      el('div', { class: 'sbNum' }, String(k + 1)),
      ...tracks.map(t => slot(t, k, sel, act))
    )
  );
  return el(
    'div',
    {
      class: 'sBoard vert',
      style: '--cols:' + tracks.length,
      role: 'grid',
      'aria-label': 'MC-707 clips: a column for each track'
    },
    head,
    ...body
  );
}

function slot(t, k, sel, act) {
  const q = S.scn,
    c = q.clips[t][k],
    p = c && S.patterns[c.pat],
    st = clipState(q, S.patterns, t, k),
    tn = toneOf(c),
    inScene = !!sel && sel.pick[t] === k,
    uses = c ? clipUses(q, t, k) : 0,
    ck = checked(t, k),
    cur = SC.edit && SC.t === t && SC.k === k;
  const tip = p
    ? 'Clip ' +
      (k + 1) +
      ': ' +
      p.name +
      (c.tr ? ' (' + (c.tr > 0 ? '+' : '') + c.tr + ')' : '') +
      (tn ? ', tone ' + tn.name : ', the clip’s own sound') +
      (c.pump ? ', pumps its ' + (c.pump.mode === 'level' ? 'volume' : 'filter') + ' on the kicks' : '') +
      '. ' +
      MARK_TIP[st] +
      '. ' +
      (uses ? 'In ' + uses + ' scene' + (uses === 1 ? '' : 's') : 'In no scene yet') +
      (ck && ck.notes ? '. On the MC-707 it holds notes (' + (ck.name || 'no name') + '): writing replaces them' : '')
    : 'Clip ' +
      (k + 1) +
      ': empty. Click to choose a pattern' +
      (ck
        ? ck.notes
          ? '. On the MC-707 it holds notes (' + (ck.name || 'no name') + ')'
          : '. Empty on the MC-707 too'
        : '');
  return el(
    'button',
    {
      type: 'button',
      class:
        'sbClip' +
        (p ? ' ' + st : ' empty') +
        (inScene ? ' inScene' : '') +
        (p && !uses ? ' unused' : '') +
        (cur ? ' cur' : '') +
        (SC.t === t && SC.k === k ? ' sel' : '') +
        (ck && ck.notes ? ' busy' : ''),
      'data-t': t,
      'data-k': k,
      style: '--tc:' + TRACK_COLORS[t],
      title: tip + '. Right-click for more',
      'aria-label': 'Track ' + devNum(t) + ' clip ' + (k + 1) + ': ' + (p ? p.name : 'empty'),
      onclick: () => (p ? act.edit(t, k) : act.pick(t, k)),
      oncontextmenu: e => (e.preventDefault(), act.menu(t, k, e.clientX, e.clientY))
    },
    p
      ? [
          el('span', { class: 'sbMark', 'aria-hidden': 'true' }, MARK[st]),
          el('b', {}, p.name.replace(/^[A-Za-z ]+: /, '')),
          el(
            'span',
            { class: 'sbSub' },
            (c.pump ? '∿ ' : '') +
              (c.tr ? (c.tr > 0 ? '+' : '') + c.tr + ' · ' : '') +
              (tn ? '♪ ' + tn.name : p.bars + (p.bars === 1 ? ' bar' : ' bars'))
          )
        ]
      : el('span', { class: 'sbPlus' }, '+')
  );
}
