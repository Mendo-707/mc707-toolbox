// The desktop app's native feel: classes on <html> for its look (desktop.css: no text selection on the
// controls, no bounce, no web cursors, the top bar as the window's title bar), the page's colours sent to
// the title bar's buttons, and on a Mac the app's menus in the Mac's own menu bar.
//
// Reads: HOST (the desktop app's bridge), the menus menubar.js passes in.
import { HOST } from '../core/state.js';

/** Mark the page as the desktop app and keep the title bar in the page's colours. */
export function initDesktop() {
  if (!HOST) return;
  const r = document.documentElement;
  r.classList.add('desktop', 'os-' + (HOST.platform || 'win32'));
  if (!HOST.setChrome) return;
  const send = () => {
    const bar = document.getElementById('menubar') || document.body,
      cs = getComputedStyle(bar);
    const bg = toHex(cs.backgroundColor) || '#16171a',
      ink = toHex(getComputedStyle(document.body).color) || '#ece9e2';
    HOST.setChrome({ bg, ink });
  };
  requestAnimationFrame(send);
  addEventListener('mc707-theme', () => requestAnimationFrame(send));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(send));
}
/* "rgb(31, 32, 36)" -> "#1f2024" (the title bar takes hex) */
function toHex(c) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
  return m ? '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('') : null;
}

/**
 * On a Mac, put the app's menus in the Mac's menu bar (and leave them out of the window).
 * @param {() => object[]} build  the menus as they are now: [{label, items:[{label, key, checked, run,
 *   sub:[…]} | '-']}]; called again whenever the mode changes, a menu is used, or the window comes back
 */
export function macMenus(build) {
  if (!HOST || HOST.platform !== 'darwin' || !HOST.setMacMenu || !HOST.onMenuCmd) return false;
  let RUN = new Map();
  const send = () => {
    const run = new Map();
    let n = 0;
    const ser = items =>
      items.map(it => {
        if (it === '-') return '-';
        if (it.sub) return { label: it.label, sub: ser(it.sub) };
        const id = 'm' + n++;
        run.set(id, it.run);
        return { id, label: it.label, key: it.key || '', checked: it.checked == null ? null : !!it.checked };
      });
    try {
      HOST.setMacMenu(build().map(m => ({ label: m.label, items: ser(m.items) })));
      RUN = run;
    } catch (e) {}
  };
  HOST.onMenuCmd(id => {
    const f = RUN.get(id);
    try {
      if (f) f();
    } catch (e) {}
    setTimeout(send, 50);
  });
  new MutationObserver(send).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
  addEventListener('focus', send);
  addEventListener('mc707-theme', send);
  document.documentElement.classList.add('native-menu');
  send();
  return true;
}
