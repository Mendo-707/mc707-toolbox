// Scene Mode's Sound tab: the full ZenCore editor, with its Sound browser (your library, the factory tones
// from your update file, the starters, grabbing from the MC-707), docked for the MC-707 clip a cell goes
// into. It opens on the cell's tone (and puts it on that clip) or on what the clip holds; changes go to
// the MC-707 as you make them and are kept as the cell's tone when you leave the tab, the cell or the
// editor, so Send to MC-707 sends them again.
//
// Reads: S, SC, ZE.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { devNum } from '../core/device.js';
import { scnClips } from '../core/scene-model.js';
import { ZE, zeLoad, zenClose, zenOpen } from '../zen/zc-editor.js';
import { diffOf } from '../zen/zc-sounds.js';
import { soundFrom } from '../zen/zc-tone.js';
import { SC, rows, setTone, toneOf } from './model.js';

/* the editor stays in this box across redraws, as Synth Mode's dock does */
const HOST = el('div', { class: 'scnZen' });
/* the cell the editor is open for, and how many edits it had once the cell's tone was in */
let open = null;
/* the editor closed from inside (Esc, Done): keep its sound and go back to the notes */
let watch = null;
function watchClose() {
  if (watch) return;
  watch = new MutationObserver(() => {
    if (!open || HOST.querySelector('#zcOv')) return;
    keepSound();
    open = null;
    SC.tab = 'notes';
    SC.draw();
  });
  watch.observe(HOST, { childList: true });
}

/** The MC-707 clip (0-15) cell (i, t) goes into, or -1. */
export const clipOf = (i, t) => (S.scn ? scnClips(S.scn).clip[i][t] : -1);

/**
 * Keep the editor's sound as the cell's tone, when it was changed there. While Scene Mode is drawing
 * (later), the change waits until the drawing is done.
 */
export function keepSound(later = false) {
  if (!open || !ZE.snd || ZE.undo.length <= open.undo) return;
  const v = ZE.snd.v,
    { i, t } = open,
    tone = { name: String(v['CMN.NAME'] || v['KCMN.NAME'] || 'Tone').trim(), kind: ZE.snd.kind, d: diffOf(ZE.snd) };
  open.undo = ZE.undo.length;
  if (later) setTimeout(() => setTone(i, t, tone));
  else setTone(i, t, tone);
}
/** Keep the sound and close the editor. */
export function closeSound(later = false) {
  if (!open) return;
  keepSound(later);
  if (!HOST.isConnected) document.body.append(HOST);
  zenClose();
  HOST.remove();
  open = null;
}

/** The Sound tab's content for cell (i, t), or null when the editor was closed from inside (Esc, Done). */
export function soundHost(i, t) {
  const k = clipOf(i, t);
  if (k < 0) {
    closeSound(true);
    return el(
      'p',
      { class: 'hint scnZenNote' },
      'This cell has no MC-707 clip: a track holds 16 different cells at most.'
    );
  }
  const key = i + ':' + t + ':' + k;
  if (open && open.key === key) {
    if (HOST.querySelector('#zcOv')) return HOST;
    open = null;
    return null;
  }
  closeSound(true);
  watchClose();
  open = { key, i, t, k, undo: Infinity };
  requestAnimationFrame(async () => {
    await zenOpen(t, k, HOST);
    const tn = toneOf(rows()[i] && rows()[i].cells[t]),
      snd = tn && soundFrom({ zencore: 1, kind: tn.kind, v: tn.d });
    if (snd) await zeLoad(snd, 'Loaded this cell’s tone');
    if (open && open.key === key) open.undo = ZE.undo.length;
  });
  return HOST;
}
/** What the tab says about where the changes go. */
export const soundNote = (i, t) =>
  clipOf(i, t) < 0
    ? ''
    : 'Changes go to track ' +
      devNum(t) +
      ' clip ' +
      (clipOf(i, t) + 1) +
      ' on the MC-707 as you make them, and stay with this cell.';
/** The editor is open for a cell. */
export const soundOpen = () => !!open;
