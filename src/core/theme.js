// The app's colours: dark (the default), light, or whatever the computer is set to. Kept in localStorage
// 'mc707-theme'; base.css has the colours for each (Live Mode has its own themes on top).
//
// Owns: localStorage 'mc707-theme'.
// Reads: nothing.
const KEY = 'mc707-theme';
/** The choices, as [value, label]. */
export const THEMES = [
  ['dark', 'Dark'],
  ['light', 'Light'],
  ['system', 'Match the computer']
];
/** The theme picked ('dark' when none is). */
export function themeNow() {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.some(t => t[0] === v) ? v : 'dark';
  } catch (e) {
    return 'dark';
  }
}
/** Put theme v on the page (data-theme on <html>; none follows the computer). */
export function applyTheme(v = themeNow()) {
  const r = document.documentElement;
  if (v === 'system') {
    delete r.dataset.theme;
    r.style.colorScheme = '';
  } else {
    r.dataset.theme = v;
    r.style.colorScheme = v;
  }
}
/** Pick theme v, keep it, and tell the screens to redraw (the 'mc707-theme' event). */
export function setTheme(v) {
  try {
    localStorage.setItem(KEY, v);
  } catch (e) {}
  applyTheme(v);
  dispatchEvent(new Event('mc707-theme'));
}
