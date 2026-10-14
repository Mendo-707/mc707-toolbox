import { $, toast } from '../core/dom.js';
import { DEV, DEVS, assignDevice } from '../core/device.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { stopAll } from '../services/transport.js';
import { renderAll } from './controls.js';
import { LV } from '../live/state.js';
import { lvClearCustom } from '../live/scene-editor.js';
import { liveBuild } from '../live/pools.js';
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
