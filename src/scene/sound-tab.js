// Scene Mode's Sound tab: the full ZenCore editor, with its Sound browser (your library, the factory tones
// from your update file, the starters, grabbing from the MC-707), docked for the selected MC-707 clip. It
// opens on the clip's tone (and puts it on the clip) or on what the clip holds there; changes go to the
// MC-707 as you make them and are kept as the clip's tone when you leave the tab, the clip or the editor.
//
// Reads: S, SC, ZE.
import { el } from '../core/dom.js';
import { devNum } from '../core/device.js';
import { ZE, zeLoad, zenClose, zenOpen } from '../zen/zc-editor.js';
import { diffOf } from '../zen/zc-sounds.js';
import { soundFrom } from '../zen/zc-tone.js';
import { SC, clipAt, setTone, toneOf } from './model.js';

/* the box the editor stays in across redraws (as Synth Mode's dock does), made on first use */
let HOST = null;
const host = () => HOST || (HOST = el('div', { class: 'scnZen' }));
/* the clip the editor is open for, and how many edits it had once the clip's tone was in */
let open = null;
/* the editor closed from inside (Esc, Done): keep its sound and go back to the notes */
let watch = null;
function watchClose() {
  if (watch) return;
  watch = new MutationObserver(() => {
    if (!open || host().querySelector('#zcOv')) return;
    keepSound();
    open = null;
    SC.tab = 'notes';
    SC.draw();
  });
  watch.observe(host(), { childList: true });
}

/**
 * Keep the editor's sound as the clip's tone, when it was changed there. While Scene Mode is drawing
 * (later), the change waits until the drawing is done.
 */
export function keepSound(later = false) {
  if (!open || !ZE.snd || ZE.undo.length <= open.undo) return;
  const v = ZE.snd.v,
    { t, k } = open,
    tone = { name: String(v['CMN.NAME'] || v['KCMN.NAME'] || 'Tone').trim(), kind: ZE.snd.kind, d: diffOf(ZE.snd) };
  open.undo = ZE.undo.length;
  if (later) setTimeout(() => setTone(t, k, tone));
  else setTone(t, k, tone);
}
/** Keep the sound and close the editor. */
export function closeSound(later = false) {
  if (!open) return;
  keepSound(later);
  if (!host().isConnected) document.body.append(host());
  zenClose();
  host().remove();
  open = null;
}

/** The Sound tab for clip k of track t, or null when the editor was closed from inside (Esc, Done). */
export function soundHost(t, k) {
  const key = t + ':' + k;
  if (open && open.key === key) {
    if (host().querySelector('#zcOv')) return host();
    open = null;
    return null;
  }
  closeSound(true);
  watchClose();
  open = { key, t, k, undo: Infinity };
  requestAnimationFrame(async () => {
    await zenOpen(t, k, host());
    const tn = toneOf(clipAt(t, k)),
      snd = tn && soundFrom({ zencore: 1, kind: tn.kind, v: tn.d });
    if (snd) await zeLoad(snd, 'Loaded this clip’s tone');
    if (open && open.key === key) open.undo = ZE.undo.length;
  });
  return host();
}
/** What the tab says about where the changes go. */
export const soundNote = (t, k) =>
  'Changes go to track ' + devNum(t) + ' clip ' + (k + 1) + ' on the MC-707 as you make them, and stay with this clip.';
