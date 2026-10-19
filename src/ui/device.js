// Switching between MC-707 and MC-101 and the one-kit drums option, which rebuild Song and Live.
//
// Reads: S, LV, DEV.
import { $, toast } from '../core/dom.js';
import { DEV, DEVS, assignDevice, modelOfName } from '../core/device.js';
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
  if (b) b.textContent = DEV === '101' ? 'MC-707 Toolbox · MC-101 mode' : 'MC-707 Toolbox';
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
      : 'MC-707 mode: 8 tracks on channels 1–8.'
  );
}
/**
 * The MIDI output is an MC-101 (or an MC-707) but the app is set to the other one: switch to match it,
 * so the tracks, channels and the ZenCore editor's addresses are right without a trip to Settings.
 * One undo step; Settings › Device changes it back.
 */
export function matchDevice(portName) {
  const m = modelOfName(portName);
  if (!m || m === DEV) return;
  setDevice(m);
  toast(
    'Found ' +
      (m === '101' ? 'an MC-101' : 'an MC-707') +
      ' on MIDI, so the app switched to ' +
      (m === '101' ? 'MC-101 mode (4 tracks)' : 'MC-707 mode (8 tracks)') +
      '. Settings › Device changes it back.'
  );
}
export function setOneKit(on) {
  if (DEV === '101') {
    toast('The MC-101 always plays full kits on its one drum track');
    return;
  }
  S.oneKit = !!on;
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
