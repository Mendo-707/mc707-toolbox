import { $$ } from '../core/dom.js';
import { renderArr } from '../song/arrangement.js';
import { panic } from '../services/midi.js';
import { stopAll } from '../services/transport.js';
import { updTransport } from '../clips/clips-screen.js';
import { closePops } from '../song/controls.js';
import { liveRender } from '../live/ui.js';
import { vizStart } from '../live/visualizer.js';

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
  if (m === 'live') {
    liveRender();
    vizStart();
  } else {
    updTransport();
    renderArr();
  }
}
