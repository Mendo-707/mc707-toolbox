// My patterns: patterns you save from the editor into your own library. Kept in this browser (or
// the Windows app) under one localStorage key, apart from songs, so they are there in every song.
//
// Owns: the My patterns list (read it with userLib()).
// Reads: localStorage 'mc707-user-patterns'.

const KEY = 'mc707-user-patterns';
let LIST = null;
function load() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a)
      ? a.filter(
          p => p && typeof p.id === 'string' && Array.isArray(p.notes) && (p.type === 'drum' || p.type === 'tone')
        )
      : [];
  } catch (e) {
    return [];
  }
}
/**
 * Every pattern in My patterns, newest first (loaded from the browser the first time).
 * @returns {Array<import('../core/types.js').Pattern & {genre?: string, bpm?: number|null, at?: number}>}
 */
export function userLib() {
  if (!LIST) LIST = load();
  return LIST;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(userLib()));
    return true;
  } catch (e) {
    return false;
  }
}
/** A pattern in My patterns by id, or undefined. */
export const userById = id => userLib().find(p => p.id === id);
/**
 * Save a copy of a pattern into My patterns. With `replaceId`, overwrite that one instead.
 * @returns {string|null} its id, or null if the browser would not store it
 */
export function userSave(p, replaceId) {
  const old = replaceId ? userById(replaceId) : null;
  const e = {
    id: old ? old.id : 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    name: String(p.name || 'My pattern').slice(0, 28),
    type: p.type,
    bars: p.bars,
    notes: p.notes.map(n => ({ s: n.s, l: n.l, n: n.n, v: n.v })),
    key: p.key ? { root: p.key.root, scale: p.key.scale } : null,
    role: p.role || '',
    genre: p.genre || '',
    bpm: null,
    at: Date.now()
  };
  if (old) Object.assign(old, e);
  else userLib().unshift(e);
  return save() ? e.id : null;
}
/** Rename a pattern in My patterns. */
export function userRename(id, name) {
  const p = userById(id);
  if (!p) return;
  p.name = String(name).trim().slice(0, 28) || p.name;
  save();
}
/** Remove a pattern from My patterns (songs that use a copy of it keep their copy). */
export function userDelete(id) {
  const L = userLib(),
    i = L.findIndex(p => p.id === id);
  if (i >= 0) L.splice(i, 1);
  save();
}
