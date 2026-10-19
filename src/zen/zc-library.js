// The last edit of each MC-707 clip, so the ZenCore editor reopens where you left it. Kept in this
// browser (or the Windows app) under its own key. Saved sounds moved to the Sound library (zc-sounds.js),
// which takes the older My sounds list ('lib' here) in on first use.
//
// Owns: ZLIB (the clip memory).
// Reads: localStorage 'mc707-zen'.
import { soundFrom, soundJSON } from './zc-tone.js';

const KEY = 'mc707-zen';
export const ZLIB = { lib: [], clips: {}, loaded: false };
function load() {
  if (ZLIB.loaded) return;
  ZLIB.loaded = true;
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Array.isArray(o.lib)) ZLIB.lib = o.lib.filter(e => e && typeof e.id === 'string' && soundFrom(e.s));
    if (o.clips && typeof o.clips === 'object') ZLIB.clips = o.clips;
  } catch (e) {}
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lib: ZLIB.lib, clips: ZLIB.clips }));
    return true;
  } catch (e) {
    return false;
  }
}
/* The last state of each clip's sound, so the editor reopens where you left it even if the MC-707
   cannot be read back. Only the 40 most recent are kept. */
const ck = (kind, t, k) => kind + ':' + t + ':' + k;
export function clipMemory(kind, t, k) {
  load();
  const e = ZLIB.clips[ck(kind, t, k)];
  return e ? soundFrom(e.s) : null;
}
export function rememberClip(snd, t, k) {
  load();
  ZLIB.clips[ck(snd.kind, t, k)] = { at: Date.now(), s: soundJSON(snd) };
  const keys = Object.keys(ZLIB.clips).sort((a, b) => ZLIB.clips[b].at - ZLIB.clips[a].at);
  keys.slice(40).forEach(x => delete ZLIB.clips[x]);
  save();
}
