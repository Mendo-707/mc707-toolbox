// Song › Compose a song: the composer (library/compose.js) writes a whole song for a style, and this puts
// it in the app. The song is replaced (one undo step): its patterns, clips over the sections, markers,
// tempo, swing and key, each part on the track whose Track setup role plays it (with one drum track, the
// hats and perc go in with the kit). Scene Mode gets the same song as scenes, one for each section, with
// the scene chain, so Write to the MC-707 and Save as MC-707 project play it as it is. With Choose sounds,
// every clip gets the factory tone or kit the composer named, from the factory sounds in the Sound
// library (Sound browser › Grab from › Factory tones and kits).
//
// Reads: S, ZS, DEV.
import { el, toast } from '../core/dom.js';
import { S, UI, ED, addPattern } from '../core/state.js';
import { DEV, DEVS } from '../core/device.js';
import { ensureBars } from '../core/song-model.js';
import { NOTE_NAMES } from '../core/theory.js';
import { roleOf } from '../core/tracks.js';
import { hooks } from '../core/hooks.js';
import { compose } from '../library/compose.js';
import { FAMLABEL, STYLES } from '../library/styles.js';
import { ZS, hashOf } from '../zen/zc-sounds.js';
import { askDlg } from '../ui/dialogs.js';
import { edit } from './model.js';

const LS = 'mc707-compose';
const DRUM_ROLES = ['kit', 'hats', 'perc'];
const famOf = st => (st.fam === 'all' ? 'song' : st.fam);
const defMinutes = st => (famOf(st) === 'dnb' || famOf(st) === 'edm' ? 5 : 3.5);
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(LS)) || {};
  } catch (e) {
    return {};
  }
};
const keep = o => {
  try {
    localStorage.setItem(LS, JSON.stringify(o));
  } catch (e) {
    /* nothing to keep */
  }
};

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
      scenes = false;
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

/** Song › Compose a song: style, key, tempo, length and sounds, then the song. */
export async function composeOpen(styleId) {
  const was = load();
  const list = STYLES.filter(s => s.fam !== 'all');
  let st = list.find(s => s.id === (styleId || was.style)) || list[0];
  const sel = el('select', { style: 'width:100%' });
  for (const fam of ['dnb', 'edm', 'hh', 'song']) {
    const g = el('optgroup', { label: FAMLABEL[fam] || fam });
    list.filter(s => famOf(s) === fam).forEach(s => g.append(el('option', { value: s.id }, s.name)));
    sel.append(g);
  }
  sel.value = st.id;
  const key = el('select', {}, ...NOTE_NAMES.map((n, i) => el('option', { value: i }, n)));
  const bpm = el('input', { type: 'number', min: 40, max: 300, style: 'width:70px' });
  const mins = el('select', {}, ...[2, 3, 3.5, 4, 5, 6, 8].map(m => el('option', { value: m }, m + ' min')));
  const take = el('input', { type: 'number', min: 1, max: 9999, value: 1, style: 'width:70px' });
  const fs = factorySounds();
  const snd = el('input', { type: 'checkbox' });
  snd.checked = was.sounds !== false && fs.tone.size > 0;
  snd.disabled = !fs.tone.size;
  const vibe = el('div', { class: 'hint', style: 'line-height:1.4' });
  const fill = () => {
    st = list.find(s => s.id === sel.value) || st;
    key.value = st.keys && st.keys[0] ? st.keys[0][0] : 9;
    bpm.value = st.bpm ? st.bpm[2] : 120;
    mins.value = String(defMinutes(st));
    vibe.textContent = st.vibe || '';
  };
  sel.onchange = fill;
  fill();
  if (was.style === st.id && was.mins) mins.value = String(was.mins);
  const row = (label, ...x) =>
    el(
      'label',
      { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
      el('span', { style: 'min-width:64px' }, label),
      ...x
    );
  const body = el(
    'div',
    { style: 'display:flex;flex-direction:column;gap:8px' },
    row('Style', sel),
    vibe,
    row('Key', key, el('span', {}, 'Tempo'), bpm, el('span', {}, 'BPM')),
    row(
      'Length',
      mins,
      el('span', {}, 'Take'),
      take,
      el(
        'button',
        { class: 'btn sm', type: 'button', onclick: () => (take.value = 1 + Math.floor(Math.random() * 9999)) },
        'Another take'
      )
    ),
    el(
      'label',
      { style: 'display:flex;gap:8px;align-items:flex-start;line-height:1.4' },
      snd,
      el(
        'span',
        {},
        'Choose sounds: every clip gets a factory tone or kit picked for its part, so Save as MC-707 project plays with real sounds. ' +
          (!fs.tone.size
            ? '(Add the factory sounds first: Sound browser › Grab from › Factory tones and kits.)'
            : !fs.kit.size
              ? '(No factory kits yet: add the factory sounds again to get them; the drums keep the project’s own kits.)'
              : '')
      )
    )
  );
  const ok = await askDlg({
    title: 'Compose a song',
    text: 'The app writes every part itself from one chord progression: drums from the style’s groove, a bass locked to the kick, chords, pads, a hook that develops, arps, builds that stop dead before the drop, and something new in every drop or chorus. It replaces the song (Undo brings it back) and sets up Scene Mode the same way.',
    body,
    ok: 'Compose'
  });
  if (!ok) return;
  const opts = {
    key: +key.value,
    bpm: Math.max(40, Math.min(300, +bpm.value || 120)),
    minutes: +mins.value,
    seed: +take.value || 1
  };
  keep({ style: st.id, mins: opts.minutes, sounds: snd.checked });
  hooks.stopAll && hooks.stopAll();
  const song = compose(st, opts);
  const r = applyComposed(song, { style: st, sounds: snd.checked && !snd.disabled });
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
      (snd.checked && r.sounds ? ' ' + r.sounds + ' clips have sounds.' : '') +
      (r.missing.length ? ' Not in your library: ' + r.missing.slice(0, 4).join(', ') + '.' : '') +
      ' Press Space to play.'
  );
}
