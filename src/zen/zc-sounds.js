// The sound library behind the ZenCore editor's Sound browser: tones and kits you save or grab from the
// MC-707, each with a name, an instrument type, genre tags and a favourite star. Kept in this browser's
// IndexedDB (room for thousands; only the values that differ from Roland's initial sound are stored),
// with a backup file to export and import. The older My sounds list moves in on first use.
//
// Owns: ZS (the library in memory), the 'mc707-sounds' IndexedDB, localStorage 'mc707-zen-favs'.
// Reads: localStorage 'mc707-zen' (My sounds, once).
import { ZC_CATEGORIES } from './zc-data.js';
import { newSound, soundFrom } from './zc-tone.js';

export const ZS = { list: [], ready: false, favs: new Set() };
/** Instrument types: [id, label, ZenCore categories, words in a name]. */
export const TYPES = [
  [
    'keys',
    'Piano and keys',
    [
      'Ac.Piano',
      'Pop-Piano',
      'E.Grand Piano',
      'E.Piano1',
      'E.Piano2',
      'Harpsichord',
      'Clav',
      'Celesta',
      'Synth PolyKey'
    ],
    /piano|\bep\b|keys|rhodes|wurl|clav/i
  ],
  ['organ', 'Organ', ['E.Organ', 'Pipe Organ', 'Reed Organ', 'Accordion', 'Harmonica'], /organ|accord/i],
  ['bell', 'Bells and mallets', ['Bell', 'Mallet', 'Synth BellPad'], /bell|mallet|marimba|vibe|kalimba|glock/i],
  ['guitar', 'Guitar and plucked', ['Ac.Guitar', 'E.Guitar', 'Dist.Guitar', 'Plucked/Stroke'], /guitar|gtr|harp\b/i],
  ['bass', 'Bass', ['Ac.Bass', 'E.Bass', 'Synth Bass'], /bass|\bbs\b|sub\b|808|reese|wobble/i],
  [
    'strings',
    'Strings and orchestra',
    ['Solo Strings', 'Ensemble Strs', 'Orchestral'],
    /string|\bstr\b|orch|cello|violin/i
  ],
  [
    'brass',
    'Brass, wind and stabs',
    ['Solo Brass', 'Ensemble Brass', 'Wind', 'Flute', 'Sax', 'Recorder', 'Synth Brass', 'Hit'],
    /brass|horn|sax|flute|stab|hit\b/i
  ],
  ['vox', 'Voices', ['Vox/Choir', 'Scat'], /vox|choir|voice|vocal/i],
  ['lead', 'Synth lead', ['Synth Lead'], /lead|\bld\b|hoover|sync|saw/i],
  ['pad', 'Pads', ['Synth Pad/Str'], /pad|warm|atmos/i],
  [
    'pluck',
    'Plucks, sequences and arps',
    ['Synth Seq/Pop', 'Pulsating', 'Phrase', 'Beat&Groove'],
    /pluck|seq|arp|step/i
  ],
  ['fx', 'Effects', ['Synth FX', 'Sound FX'], /\bfx\b|noise|riser|zap|sweep/i],
  ['drums', 'Drums and kits', ['Drums', 'Percussion'], /kick|snare|drum|perc|kit\b|hat\b/i],
  ['other', 'Other', [], null]
];
export const TYPE_LABEL = Object.fromEntries(TYPES.map(([id, l]) => [id, l]));
/** Genre tags offered in the browser (you can type your own too). */
export const GENRE_TAGS = [
  'House',
  'Techno',
  'Trance',
  'DnB',
  'Dubstep',
  'Hip hop',
  'Trap',
  'Lo-fi',
  'Big beat',
  'Electro',
  'Garage',
  'Synthwave',
  'Pop',
  'Funk',
  'Ambient',
  'Cinematic'
];

/** The instrument type of a sound: from its ZenCore category, else from words in its name. */
export function typeOf(snd, name) {
  if (snd.kind === 'kit') return 'drums';
  const cat = ZC_CATEGORIES[snd.v['CMN.CATEGORY'] | 0];
  for (const [id, , cats] of TYPES) if (cats.includes(cat)) return id;
  const n = name || snd.v['CMN.NAME'] || '';
  for (const [id, , , re] of TYPES) if (re && re.test(n)) return id;
  return 'other';
}

/* ---- storing only what differs from the initial sound ---- */
const INIT = {};
const init = kind => INIT[kind] || (INIT[kind] = newSound(kind));
export function diffOf(snd) {
  const d = {},
    i = init(snd.kind).v;
  for (const k in snd.v) if (snd.v[k] !== i[k]) d[k] = snd.v[k];
  return d;
}
/** A fingerprint of a sound's values, to spot one that is already in the library. */
export function hashOf(kind, d) {
  const s =
    kind +
    JSON.stringify(
      Object.keys(d)
        .sort()
        .map(k => [k, d[k]])
    );
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}
/** The sound of a library entry. */
export const soundOf = e => soundFrom({ zencore: 1, kind: e.kind, v: e.d });

/* ---- IndexedDB, with this browser session's memory as a fallback ---- */
let dbP = null;
function db() {
  if (!dbP)
    dbP = new Promise(res => {
      try {
        const r = indexedDB.open('mc707-sounds', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('sounds', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) {
        res(null);
      }
    });
  return dbP;
}
async function tx(mode, fn) {
  const d = await db();
  if (!d) return null;
  return new Promise(res => {
    try {
      const t = d.transaction('sounds', mode),
        out = fn(t.objectStore('sounds'));
      t.oncomplete = () => res(out && 'result' in out ? out.result : true);
      t.onerror = t.onabort = () => res(null);
    } catch (e) {
      res(null);
    }
  });
}
const saveFavs = () => {
  try {
    localStorage.setItem('mc707-zen-favs', JSON.stringify([...ZS.favs]));
  } catch (e) {}
};

/** Load the library (once), moving the older My sounds in. */
export async function soundsLoad() {
  if (ZS.ready) return ZS.list;
  try {
    ZS.favs = new Set(JSON.parse(localStorage.getItem('mc707-zen-favs') || '[]'));
  } catch (e) {}
  const all = (await tx('readonly', s => s.getAll())) || [];
  ZS.list = all.filter(e => e && e.id && e.d).sort((a, b) => b.at - a.at);
  ZS.ready = true;
  try {
    const old = JSON.parse(localStorage.getItem('mc707-zen') || '{}');
    if (Array.isArray(old.lib) && old.lib.length && !localStorage.getItem('mc707-zen-moved')) {
      for (const o of old.lib.slice().reverse()) {
        const s = soundFrom(o.s);
        if (s) await soundAdd(s, { name: o.s.name, src: 'mine', at: o.at });
      }
      localStorage.setItem('mc707-zen-moved', '1');
    }
  } catch (e) {}
  return ZS.list;
}
/**
 * Add a sound. Returns the entry, or null when the same sound is already in the library (dup) or it
 * could not be stored.
 * @param {object} snd
 * @param {{name?:string,type?:string,tags?:string[],src?:string,at?:number}} meta
 */
export async function soundAdd(snd, meta = {}) {
  const d = diffOf(snd),
    h = hashOf(snd.kind, d);
  if (ZS.list.some(e => e.h === h)) return null;
  const name = (meta.name || snd.v['CMN.NAME'] || snd.v['KCMN.NAME'] || 'Untitled').trim();
  const e = {
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: meta.at || Date.now(),
    kind: snd.kind,
    name,
    type: meta.type || typeOf(snd, name),
    tags: meta.tags || [],
    src: meta.src || 'mine',
    h,
    d
  };
  await tx('readwrite', s => s.put(e));
  ZS.list.unshift(e);
  return e;
}
/**
 * Add many sounds in one go (one store write): [{snd, name, src}]. Sounds already in the library are
 * skipped. Returns how many were added.
 */
export async function soundAddMany(items) {
  const seen = new Set(ZS.list.map(e => e.h)),
    at = Date.now(),
    add = [];
  items.forEach(({ snd, name, src }, i) => {
    const d = diffOf(snd),
      h = hashOf(snd.kind, d);
    if (seen.has(h)) return;
    seen.add(h);
    const nm = (name || snd.v['CMN.NAME'] || snd.v['KCMN.NAME'] || 'Untitled').trim();
    add.push({
      id: 's' + at.toString(36) + '_' + i.toString(36),
      at: at - i,
      kind: snd.kind,
      name: nm,
      type: typeOf(snd, nm),
      tags: [],
      src: src || 'mine',
      h,
      d
    });
  });
  await tx('readwrite', s => add.forEach(e => s.put(e)));
  ZS.list = [...ZS.list, ...add].sort((a, b) => b.at - a.at);
  return add.length;
}
/** Remove every sound from one source ('factory', say). Returns how many went. */
export async function soundsRemoveSrc(src) {
  const gone = ZS.list.filter(e => e.src === src);
  ZS.list = ZS.list.filter(e => e.src !== src);
  await tx('readwrite', s => gone.forEach(e => s.delete(e.id)));
  return gone.length;
}
export async function soundUpdate(id, patch) {
  const e = ZS.list.find(x => x.id === id);
  if (!e) return;
  Object.assign(e, patch);
  await tx('readwrite', s => s.put(e));
}
export async function soundDelete(id) {
  ZS.list = ZS.list.filter(x => x.id !== id);
  ZS.favs.delete(id);
  saveFavs();
  await tx('readwrite', s => s.delete(id));
}
/** Star or unstar (library entries and starters alike, by id). */
export function toggleFav(id) {
  if (ZS.favs.has(id)) ZS.favs.delete(id);
  else ZS.favs.add(id);
  saveFavs();
}
/** The whole library as a backup file's JSON (without the factory tones: those come from your own update file). */
export const libraryJSON = () =>
  JSON.stringify({
    app: 'mc707-toolbox',
    sounds: 1,
    favs: [...ZS.favs],
    list: ZS.list.filter(e => e.src !== 'factory').map(({ h, ...e }) => e)
  });
/** Add the sounds from a backup file. Returns {added, same}. */
export async function libraryImport(text) {
  const o = JSON.parse(text);
  if (!o || o.sounds !== 1 || !Array.isArray(o.list)) throw new Error('not a sound library');
  let added = 0,
    same = 0;
  for (const e of o.list.slice().reverse()) {
    const s = soundOf(e || {});
    if (!s) continue;
    const r = await soundAdd(s, {
      name: e.name,
      type: e.type,
      tags: Array.isArray(e.tags) ? e.tags : [],
      src: e.src,
      at: e.at
    });
    if (r) {
      added++;
      if ((o.favs || []).includes(e.id)) ZS.favs.add(r.id);
    } else same++;
  }
  saveFavs();
  return { added, same };
}
