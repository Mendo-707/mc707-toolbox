// My sounds for the ZenCore editor: tones and kits you save, and the last edit of each MC-707 clip.
// Kept in this browser (or the Windows app) under its own key. Starter tones are in zc-starters.js.
//
// Owns: ZLIB (my sounds and the clip memory).
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
/** My saved sounds, newest first (of one kind when given). */
export function myList(kind) {
  load();
  return ZLIB.lib.filter(e => !kind || e.s.kind === kind);
}
/** Save a sound to My sounds. @returns {boolean} */
export function mySave(snd, name) {
  load();
  ZLIB.lib.unshift({ id: 'z' + Date.now().toString(36), at: Date.now(), s: soundJSON(snd, name) });
  return save();
}
export function myDelete(id) {
  load();
  ZLIB.lib = ZLIB.lib.filter(e => e.id !== id);
  save();
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
