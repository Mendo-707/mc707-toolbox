// Fullscreen (the Windows app or the browser) and keeping the screen awake while playing.
//
// Owns: STAGE (fullscreen and wake lock).
// Reads: TR.
import { $, toast } from '../core/dom.js';
import { TR } from '../services/transport.js';

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
function syncFullBtn() {
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
      "This window does not allow fullscreen. Press F11 for your browser's own fullscreen, or use the desktop app."
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
export function setAwake(on) {
  STAGE.awake = on;
  try {
    localStorage.setItem('mc707-awake', on ? '1' : '0');
  } catch (e) {}
  syncAwake();
  toast(on ? 'The screen stays on while music is playing' : 'Screen can sleep as normal');
}
export async function syncAwake() {
  const want = STAGE.awake && TR.playing && !document.hidden;
  if (want === STAGE.held) return;
  STAGE.held = want;
  const host = window.toolbox;
  if (host && host.keepAwake) {
    try {
      host.keepAwake(want);
    } catch (e) {}
    return;
  }
  try {
    if (want && navigator.wakeLock) {
      STAGE.lock = await navigator.wakeLock.request('screen');
      STAGE.lock.addEventListener('release', () => {
        STAGE.lock = null;
        if (STAGE.held) {
          STAGE.held = false;
        }
      });
    } else if (!want && STAGE.lock) {
      const l = STAGE.lock;
      STAGE.lock = null;
      await l.release();
    }
  } catch (e) {
    STAGE.lock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (!(window.toolbox && window.toolbox.keepAwake) && !STAGE.lock) STAGE.held = false;
  syncAwake();
});
document.addEventListener('fullscreenchange', syncFullBtn);
