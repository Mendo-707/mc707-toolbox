// Checking the MC-707's clips before writing (read-only): which of the clips Scene Mode is about to
// write already hold notes there (writing replaces them), or every clip of one track, to see which are
// free. The board shows what was found.
//
// Owns: CK (what the last check found).
// Reads: S, SC.
import { toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { clipState } from '../core/scene-model.js';
import { clipHasNotes } from '../zen/zc-seq.js';
import { SC } from './model.js';

/* 't:k' → {notes, name} for the clips checked, or {err}; and the check under way */
export const CK = { res: {}, busy: false, line: '' };

/** Read these clips ([[t, k]…]) and note which hold notes. */
export async function checkClips(list, what) {
  if (CK.busy) return;
  if (!list.length) return toast('Nothing to check: no clips waiting to be written');
  CK.busy = true;
  let busy = 0,
    bad = 0;
  for (const [n, [t, k]] of list.entries()) {
    CK.line = 'Checking ' + what + ': ' + (n + 1) + ' of ' + list.length + '…';
    SC.draw();
    const r = await clipHasNotes(t, k);
    if (!r.ok) {
      bad++;
      CK.res[t + ':' + k] = { err: r.why };
      if (/not connected/.test(r.why)) break;
      continue;
    }
    CK.res[t + ':' + k] = { notes: r.notes, name: r.name };
    if (r.notes) busy++;
  }
  CK.busy = false;
  CK.line = bad
    ? 'Some clips did not answer'
    : busy
      ? busy + ' of ' + list.length + ' hold notes on the MC-707 (ringed): writing replaces them'
      : 'All ' + list.length + ' are empty on the MC-707';
  SC.draw();
}
/** Check the clips that are about to be written for the first time. */
export function checkNew() {
  const list = [];
  for (const t of DEVS[DEV].tracks)
    for (let k = 0; k < 16; k++) if (clipState(S.scn, S.patterns, t, k) === 'new') list.push([t, k]);
  checkClips(list, 'the new clips');
}
/** Check all 16 clips of track t, to see which are free on the MC-707. */
export const checkTrack = t =>
  checkClips(
    Array.from({ length: 16 }, (_, k) => [t, k]),
    'track ' + devNum(t)
  );
/** What the check found for clip k of track t, or null. */
export const checked = (t, k) => CK.res[t + ':' + k] || null;
/** Forget clip k's check (it was written since). */
export const uncheck = (t, k) => delete CK.res[t + ':' + k];
