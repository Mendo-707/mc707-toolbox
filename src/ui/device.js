// Switching between MC-707 and MC-101 and the one-kit drums option, which rebuild Song and Live.
//
// Reads: S, LV, DEV.
import { $, toast } from '../core/dom.js';
import { DEV, DEVS, assignDevice, devHw, modelOfName } from '../core/device.js';
import { roleOf } from '../core/tracks.js';
import { askDlg } from './dialogs.js';
import { MC107_ROLES, orderFor, reorderTracks } from './track-setup.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { stopAll } from '../services/transport.js';
import { renderAll } from './controls.js';
import { LV } from '../live/state.js';
import { lvClearCustom } from '../live/scene-editor.js';
import { liveBuild } from '../live/set-builder.js';
import { liveRender } from '../live/panels.js';

export function applyDevice() {
  document.body.dataset.dev = DEV;
  const b = $('#menubar .mbrand');
  if (b) b.textContent = DEV === '707' ? 'MC707 / 101 Toolbox' : 'MC707 / 101 Toolbox · ' + DEVS[DEV].name + ' mode';
}
export function setDevice(d) {
  if (d === DEV) return;
  stopAll();
  pushUndo();
  assignDevice(d);
  try {
    localStorage.setItem('mc-device', d);
  } catch (e) {}
  S.tracks.forEach((t, i) => {
    const c = DEVS[d].ch[i];
    if (c) t.ch = c;
  });
  applyDevice();
  scheduleSave();
  if (typeof lvClearCustom === 'function') {
    lvClearCustom();
    LV.edIdx = -1;
    liveBuild();
  }
  renderAll();
  if (typeof liveRender === 'function') liveRender();
  toast(
    d === '101'
      ? 'MC-101 mode: Drums, Bass, Chords and Lead on channels 1–4. Drums play full kits.'
      : d === '107'
        ? 'MC-107 mode: 8 tracks on channels 1–8. Tracks 5–8 play, but the MC-101 never shows them: the app is where you see and change them.'
        : 'MC-707 mode: 8 tracks on channels 1–8.'
  );
  if (d === '107') offer107();
}
/* Switching to the MC-107: offer to move the tracks so the parts you play are on the four the MC shows.
   Only when the tracks can simply be moved (each of those roles is on some track): nothing is lost. */
async function offer107() {
  const perm = orderFor(MC107_ROLES);
  if (!perm || perm.every((o, n) => o === n)) return;
  const ok = await askDlg({
    title: 'Move the main parts to tracks 1–4?',
    text: 'The MC-107 shows only tracks 1–4 on its screen and pads. The app can move the kit, bass, chords and lead there (the parts you play and tweak on the MC), and hats, percussion, pad and pluck to tracks 5–8, which the app plays and you change here. Each track keeps its clips, sound settings and mix. On the MC, set tracks 1–4 to Drum, Tone, Tone, Tone to match.',
    ok: 'Move them',
    cancel: 'Keep the order'
  });
  if (!ok) return;
  reorderTracks(perm);
  toast('Tracks 1–4: kit, bass, chords, lead. Tracks 5–8: hats, perc, pad, pluck.');
}
/**
 * The MIDI output is an MC-101 (or an MC-707) but the app is set to the other one: switch to match it,
 * so the tracks, channels and the ZenCore editor's addresses are right without a trip to Settings.
 * One undo step; Settings › Device changes it back.
 */
export function matchDevice(portName) {
  const m = modelOfName(portName);
  /* (an MC-107 is an MC-101 on the cable: it stays an MC-107) */
  if (!m || m === devHw()) return;
  setDevice(m);
  toast(
    'Found ' +
      (m === '101' ? 'an MC-101' : 'an MC-707') +
      ' on MIDI, so the app switched to ' +
      (m === '101' ? 'MC-101 mode (4 tracks)' : 'MC-707 mode (8 tracks)') +
      '. Settings › Device changes it back.'
  );
}
/** Three full kits on Drums 1-3 (MC-707): Live's composed sets move the main kit between them. */
export function setThreeKits(on) {
  if (DEV === '101') {
    toast('The MC-101 has one drum track');
    return;
  }
  S.threeKits = !!on;
  if (on) S.oneKit = false;
  scheduleSave();
  if (typeof lvClearCustom === 'function') {
    lvClearCustom();
    LV.edIdx = -1;
    liveBuild();
    if (typeof liveRender === 'function') liveRender();
  }
  toast(
    on
      ? 'Load a different full kit on each of Drums 1, 2 and 3: in Live Mode’s composed sets the beat moves between them, fast or slow to suit the genre and the scene.'
      : 'Drums are spread over Drums 1, 2 and 3 again.'
  );
}
export function setOneKit(on) {
  if (DEV === '101') {
    toast('The MC-101 always plays full kits on its one drum track');
    return;
  }
  S.oneKit = !!on;
  if (on) S.threeKits = false;
  scheduleSave();
  if (typeof lvClearCustom === 'function') {
    lvClearCustom();
    LV.edIdx = -1;
    liveBuild();
    if (typeof liveRender === 'function') liveRender();
  }
  toast(
    on
      ? 'Drums 1 now plays full kits (kick, snare, hats and percussion). Drums 2 is free, and Drums 3 keeps builds and impacts.'
      : 'Drums are spread over Drums 1, 2 and 3 again.'
  );
}
