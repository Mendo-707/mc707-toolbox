import { $, toast } from '../core/dom.js';

/* ---------- fullscreen and keep screen awake ---------- */
export const STAGE = {
  awake: (() => {
    try {
      return localStorage.getItem('mc707-awake') !== '0';
    } catch (e) {
      return true;
    }
  })(),
  lock: null,
  held: false
};
/* The Windows app sizes its own window; a browser uses the page Fullscreen API. */
export const FULLHOST = window.toolbox && window.toolbox.toggleFullScreen ? window.toolbox : null;
export function isFull() {
  return FULLHOST ? !!STAGE.full : !!document.fullscreenElement;
}
export function canFull() {
  return !!FULLHOST || !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
}
export function syncFullBtn() {
  const b = $('#lvFull');
  if (b) {
    b.classList.toggle('on', isFull());
    b.textContent = isFull() ? '⤡ Exit fullscreen' : '⛶ Fullscreen';
  }
}
export function toggleFull() {
  if (FULLHOST) {
    FULLHOST.toggleFullScreen()
      .then(on => {
        STAGE.full = on;
        syncFullBtn();
      })
      .catch(() => {});
    return;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return;
  }
  if (!canFull()) {
    toast(
      "This window does not allow fullscreen. Press F11 for your browser's own fullscreen, or use the Windows app."
    );
    return;
  }
  document.documentElement
    .requestFullscreen()
    .catch(() => toast("Fullscreen was blocked. Press F11 for your browser's own fullscreen."));
}
if (FULLHOST) {
  if (FULLHOST.onFullScreen)
    FULLHOST.onFullScreen(on => {
      STAGE.full = on;
      syncFullBtn();
    });
  if (FULLHOST.isFullScreen)
    FULLHOST.isFullScreen()
      .then(on => {
        STAGE.full = on;
        syncFullBtn();
      })
      .catch(() => {});
}
