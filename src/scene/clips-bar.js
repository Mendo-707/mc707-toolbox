// Scene Mode's clips: under each track's name, its 16 MC-707 clips as the MC-707's pads show them, lit
// where the scenes use one, so you and the app agree on which clips to keep free. Each track picks the
// clip its scenes start from, and Check the MC-707 reads those clips (read-only) and marks the ones that
// already hold notes, which Send to MC-707 would write over.
//
// Owns: CK (what the last check found).
// Reads: S, SC.
import { el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { scnStart } from '../core/scene-model.js';
import { clipHasNotes, clipNotesToMine } from '../zen/zc-seq.js';
import { showMenu } from '../ui/menu.js';
import { hooks } from '../core/hooks.js';
import { SC, setStart } from './model.js';

/* t:k → {notes, name} for the clips checked, or {err}; and the check under way */
export const CK = { res: {}, busy: false, line: '' };
const used = (map, t) => map.items.filter(x => x.t === t);

/** Track t's pads and its first-clip choice, for its column head. */
export function clipPads(t, map) {
  const mine = new Map(used(map, t).map(x => [x.k, x])),
    first = scnStart(S.scn, t);
  const pads = el('div', { class: 'scnPads', role: 'group', 'aria-label': 'Track ' + devNum(t) + ' clips' });
  for (let k = 0; k < 16; k++) {
    const it = mine.get(k),
      r = CK.res[t + ':' + k],
      p = it && S.patterns[it.cell.pat];
    const why = it
      ? 'Clip ' +
        (k + 1) +
        ': ' +
        (p ? p.name : '') +
        (r && r.notes
          ? '. On the MC-707 it holds notes (' + (r.name || 'no name') + '): Send writes over them'
          : r && !r.err
            ? '. Empty on the MC-707'
            : '')
      : 'Clip ' + (k + 1) + ': not used by the scenes' + (r && r.notes ? ' (holds notes on the MC-707)' : '');
    pads.append(
      el(
        'span',
        {
          class:
            'scnPad' + (it ? ' use' : '') + (r && r.notes ? ' busy' : '') + (r && !r.err && !r.notes ? ' free' : ''),
          title: why + '. Right-click for more',
          oncontextmenu: e => (e.preventDefault(), e.stopPropagation(), padMenu(t, k, e.clientX, e.clientY))
        },
        String(k + 1)
      )
    );
  }
  const sel = el(
    'select',
    {
      'aria-label': 'Track ' + devNum(t) + ': first clip',
      title: 'The clip this track’s scenes start from',
      onchange: e => setStart(t, +e.target.value)
    },
    ...Array.from({ length: 16 }, (_, k) => el('option', { value: k, selected: k === first }, 'from clip ' + (k + 1)))
  );
  return el('div', { class: 'scnClips' }, pads, sel);
}

/* a pad's menu: start the track's clips here, read the clip's notes, or edit its sound on the MC-707 */
function padMenu(t, k, x, y) {
  showMenu(x, y, [
    { label: 'Start this track’s clips here', checked: scnStart(S.scn, t) === k, action: () => setStart(t, k) },
    '-',
    { label: 'Read its notes into My patterns', action: () => clipNotesToMine(t, k) },
    { label: 'Edit its sound in the ZenCore editor', action: () => hooks.zenOpen(t, k) }
  ]);
}
/** The corner: how many clips the scenes need, and Check the MC-707. */
export function clipsSummary(map) {
  const n = DEVS[DEV].tracks.map(t => used(map, t).length),
    busy = map.items.filter(x => (CK.res[x.t + ':' + x.k] || {}).notes).length;
  return el(
    'div',
    { class: 'scnClipSum' },
    el('b', {}, 'MC-707 clips'),
    el('span', { class: 'hint' }, n.reduce((a, b) => a + b, 0) + ' in use, lit on each track'),
    busy ? el('span', { class: 'warn' }, busy + ' already hold notes') : null,
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm',
        disabled: CK.busy,
        onclick: () => checkClips(map),
        title: 'Read the clips the scenes use from the MC-707 (read-only) and mark any that hold notes'
      },
      CK.busy ? 'Checking…' : 'Check the MC-707'
    ),
    CK.line ? el('span', { class: 'hint' }, CK.line) : null
  );
}

/** Read the clips the scenes use and note which hold notes. Only read requests go to the MC-707. */
export async function checkClips(map) {
  if (CK.busy) return;
  const list = map.items;
  if (!list.length) return toast('The scenes use no clips yet');
  CK.busy = true;
  SC.draw();
  let busy = 0,
    bad = 0;
  for (const [n, it] of list.entries()) {
    CK.line = 'Clip ' + (n + 1) + ' of ' + list.length + '…';
    SC.draw();
    const r = await clipHasNotes(it.t, it.k);
    if (!r.ok) {
      bad++;
      CK.res[it.t + ':' + it.k] = { err: r.why };
      if (/not connected/.test(r.why)) break;
      continue;
    }
    CK.res[it.t + ':' + it.k] = { notes: r.notes, name: r.name };
    if (r.notes) busy++;
  }
  CK.busy = false;
  CK.line = bad
    ? 'Some clips did not answer'
    : busy
      ? busy + ' of the clips hold notes: pick other clips, or let Send write over them'
      : 'All ' + list.length + ' clips are empty: ready to send';
  SC.draw();
}
/** Forget the last check (after sending, the clips hold the scenes' notes). */
export function forgetCheck() {
  CK.res = {};
  CK.line = '';
}
