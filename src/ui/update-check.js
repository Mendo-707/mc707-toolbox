// Checking for a newer version: asks GitHub for the latest release and compares it with this one. Used by
// the start screen (once a session, quietly), Help › Check for updates and the About window. Nothing is
// sent but the request itself; without a connection it says it could not check.
//
// Reads: VERSION. Owns: sessionStorage 'mc707-update' (the answer, so the start screen asks once).
import { LINKS, VERSION, openLink } from '../core/version.js';
import { toast } from '../core/dom.js';

const API = 'https://api.github.com/repos/Mendo-707/mc707-toolbox/releases/latest';
const KEY = 'mc707-update';

/* 1.5.10 is after 1.5.9 */
const parts = v =>
  String(v)
    .replace(/^v/i, '')
    .split('.')
    .map(n => parseInt(n, 10) || 0);
/** True when version a is later than b. */
export function newer(a, b) {
  const x = parts(a),
    y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

/**
 * The latest release: {latest, newer, url}, or null when GitHub could not be reached.
 * @param {boolean} [again]  ask again even if this session has asked already
 */
export async function checkUpdate(again = false) {
  if (!again)
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && c.latest) return { ...c, newer: newer(c.latest, VERSION) };
    } catch (e) {}
  try {
    const ctl = new AbortController(),
      t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(API, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json(),
      latest = String(j.tag_name || '').replace(/^v/i, '');
    if (!latest) return null;
    const out = { latest, url: j.html_url || LINKS.releases };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(out));
    } catch (e) {}
    return { ...out, newer: newer(latest, VERSION) };
  } catch (e) {
    return null;
  }
}
/** Help › Check for updates: says what it found, and opens the download page when there is a newer one. */
export async function checkUpdateNow() {
  toast('Checking for updates…');
  const u = await checkUpdate(true);
  if (!u) return toast('Could not reach GitHub to check. The releases page has the latest version.');
  if (u.newer) {
    toast('Version ' + u.latest + ' is out (you have ' + VERSION + '): opening the download page');
    openLink(u.url);
  } else toast('You have the latest version (' + VERSION + ')');
}
