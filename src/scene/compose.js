// The Song wizard's Compose it now: the composer (library/compose.js) writes a whole song for a style, and
// this puts it in the app. The song is replaced (one undo step): its patterns, clips over the sections, markers,
// tempo, swing and key, each part on the track whose Track setup role plays it (with one drum track, the
// hats and perc go in with the kit). Scene Mode gets the same song as scenes, one for each section, with
// the scene chain, so Write to the MC-707 and Save as MC-707 project play it as it is. With Choose sounds,
// every clip gets the factory tone or kit the composer named, from the factory sounds in the Sound
// library (Sound browser › Grab from › Factory tones and kits).
//
// Reads: S, ZS, DEV.
import { toast } from '../core/dom.js';
import { S, UI, ED, addPattern } from '../core/state.js';
import { DEV, DEVS } from '../core/device.js';
import { ensureBars } from '../core/song-model.js';
import { NOTE_NAMES } from '../core/theory.js';
import { roleOf } from '../core/tracks.js';
import { hooks } from '../core/hooks.js';
import { compose } from '../library/compose.js';
import { STYLES } from '../library/styles.js';
import { ZS, hashOf } from '../zen/zc-sounds.js';
import { edit } from './model.js';

const DRUM_ROLES = ['kit', 'hats', 'perc'];

/** The factory sounds in the library by name: {tone: Map, kit: Map} (kits only with their bytes). */
function factorySounds() {
  const tone = new Map(),
    kit = new Map();
  for (const e of ZS.list) {
    if (e.src !== 'factory') continue;
    if (e.kind === 'kit' && e.mpj && !kit.has(e.name)) kit.set(e.name, e);
    else if (e.kind === 'tone' && !tone.has(e.name)) tone.set(e.name, e);
  }
  return { tone, kit };
}

/**
 * Put a composed song in the app (replacing the song) and in Scene Mode.
 * @param {ReturnType<typeof compose>} song
 * @param {{style:object, sounds:boolean}} o
 * @returns {{sections:number, bars:number, sounds:number, missing:string[], scenes:boolean}}
 */
export function applyComposed(song, o) {
  const tracks = DEVS[DEV].tracks,
    role = t => roleOf(t),
    first = r => tracks.find(t => role(t) === r),
    kitT = first('kit'),
    has = r => first(r) !== undefined;
  /* each part's track: the first track with its role; with no hats or perc track they join the kit */
  const merge = DRUM_ROLES.filter(r => r !== 'kit' && !has(r));
  const fs = o.sounds ? factorySounds() : null,
    missing = new Set();
  let scenes = true,
    nSounds = 0;
  const total = song.sections.reduce((a, s) => a + s.bars, 0);
  edit(q => {
    S.clips = [];
    S.patterns = {};
    S.markers = [];
    S.clipMarks = [];
    S.cursor = 0;
    S.loop = { on: false, start: 0, end: 8 };
    S.bpm = song.bpm;
    S.swing = song.swing;
    S.key = song.key;
    S.scale = song.scale;
    UI.sel = null;
    ED.selNotes.clear();
    const made = {};
    const patOf = keys => {
      const id = keys.join('+');
      if (made[id]) return made[id];
      const ps = keys.map(k => song.patterns[k]),
        p = ps[0];
      const notes = ps.flatMap(x => x.notes);
      made[id] = addPattern(p.type, p.name, p.bars, notes, {
        role: p.role,
        key: p.type === 'tone' ? { root: song.key, scale: song.scale } : null,
        composed: o.style.id
      });
      return made[id];
    };
    /* the clips, and each track's clips in the order they first play (Scene Mode's 16 a track) */
    const order = {};
    let at = 0;
    const rows = [];
    for (const sec of song.sections) {
      S.markers.push({ bar: at, name: sec.name.slice(0, 20) });
      const pick = Array(8).fill(-1);
      for (const t of tracks) {
        const r = role(t);
        let keys = [];
        if (t === kitT) keys = ['kit', ...merge].map(x => sec.parts[x]).filter(Boolean);
        else if (sec.parts[r] && first(r) === t) keys = [sec.parts[r]];
        if (!keys.length) continue;
        const pid = patOf(keys);
        S.clips.push({ id: 'c' + S.nextId++, t, start: at, len: sec.bars, off: 0, pat: pid });
        const list = (order[t] = order[t] || []);
        if (!list.some(x => x.pid === pid)) list.push({ pid, keys });
        const k = list.findIndex(x => x.pid === pid);
        if (k > 15) scenes = false;
        pick[t] = k;
      }
      rows.push({ name: sec.name, bars: sec.bars, pick });
      at += sec.bars;
    }
    ensureBars(total);
    /* Scene Mode: the same song as scenes (the MC-707 holds 16 clips a track and 128 scenes) */
    if (!scenes || rows.length > 128) {
      /* the old song's scenes go too (their patterns are gone) */
      scenes = false;
      q.rows = [];
      q.clips = Array.from({ length: 8 }, () => Array(16).fill(null));
      q.tones = {};
      return;
    }
    q.first = 0;
    q.rows = rows.map((r, i) => ({
      id: 'r' + S.nextId++,
      name: r.name.slice(0, 16),
      bars: Math.min(127, r.bars),
      pick: r.pick
    }));
    q.clips = Array.from({ length: 8 }, () => Array(16).fill(null));
    q.tones = {};
    for (const t in order)
      order[t].forEach(({ pid, keys }, k) => {
        const clip = { pat: pid };
        if (fs) {
          const name = song.sounds[keys[0]],
            drum = song.patterns[keys[0]].type === 'drum',
            e = name && (drum ? fs.kit : fs.tone).get(name);
          if (e) {
            const tone = { name: e.name.slice(0, 16), kind: e.kind, d: e.d };
            if (e.mpj) tone.mpj = e.mpj;
            const key = hashOf(e.kind, e.d) + (e.mpj ? ':kit' : '');
            q.tones[key] = tone;
            clip.tone = key;
            nSounds++;
          } else if (name) missing.add(name);
        }
        q.clips[t][k] = clip;
      });
  });
  return { sections: song.sections.length, bars: total, sounds: nSounds, missing: [...missing], scenes };
}

/**
 * The Song wizard's Compose it now: the composer writes the whole song for a style, it goes in (replacing
 * the song, one undo step) and a toast says what came out.
 * @param {string} styleId
 * @param {{key:number, bpm:number, minutes:number, seed:number, sounds:boolean}} o
 */
export function composeNow(styleId, o) {
  const st = STYLES.find(s => s.id === styleId);
  if (!st) return null;
  const fs = factorySounds();
  hooks.stopAll && hooks.stopAll();
  const song = compose(st, {
    key: o.key,
    bpm: Math.max(40, Math.min(300, +o.bpm || 120)),
    minutes: +o.minutes || 4,
    seed: +o.seed || 1,
    dark: o.dark,
    edge: o.edge
  });
  const sounds = !!o.sounds && fs.tone.size > 0;
  const r = applyComposed(song, { style: st, sounds });
  hooks.renderAll && hooks.renderAll();
  toast(
    'Composed ' +
      st.name +
      ': ' +
      r.sections +
      ' sections, ' +
      Math.round((r.bars * 4 * 10) / song.bpm) / 10 +
      ' minutes in ' +
      NOTE_NAMES[song.key] +
      ' ' +
      song.scale +
      '.' +
      (r.scenes ? ' Scene Mode has the same scenes.' : '') +
      (sounds && r.sounds ? ' ' + r.sounds + ' clips have sounds.' : '') +
      (o.sounds && !fs.tone.size ? ' No factory sounds yet: Sound browser › Grab from › Factory tones and kits.' : '') +
      (r.missing.length ? ' Not in your library: ' + r.missing.slice(0, 4).join(', ') + '.' : '') +
      ' Press Space to play.'
  );
  return r;
}
