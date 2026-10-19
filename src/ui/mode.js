// Switching between Song Mode, Live Mode and Synth mode.
import { $$ } from '../core/dom.js';
import { renderArr } from '../song/arrangement.js';
import { panic } from '../services/midi.js';
import { stopAll } from '../services/transport.js';
import { updTransport } from './transport-view.js';
import { closePops } from './controls.js';
import { liveRender } from '../live/panels.js';
import { vizStart } from '../live/visualizer.js';
import { liveGenrePick, livePickOnOpen } from '../live/genre-picker.js';
import { synthEnter } from '../zen/zc-synth.js';

/* ---- mode switch ---- */
export function setMode(m) {
  if (document.body.dataset.mode === m) return;
  stopAll();
  panic(true);
  closePops();
  document.body.dataset.mode = m;
  try {
    localStorage.setItem('mc707-mode', m);
  } catch (e) {}
  $$('#menubar .mtab').forEach(b => {
    b.classList.toggle('on', b.dataset.mode === m);
    b.setAttribute('aria-selected', String(b.dataset.mode === m));
  });
  synthEnter(m === 'synth');
  if (m === 'synth') return;
  if (m === 'live') {
    liveRender();
    vizStart();
    if (livePickOnOpen()) liveGenrePick();
  } else {
    updTransport();
    renderArr();
  }
}
