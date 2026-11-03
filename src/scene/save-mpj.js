// Save as MC-707 project (.mpj): the song as a project file to copy onto the MC-707's SD card and load
// there (PROJECT › LOAD), with no computer. Scene Mode's clips and scenes go in, or, when Scene Mode has
// none, the ones it would make from the song (the song is not changed). Each clip's notes, step size and
// steps are encoded as Scene Mode writes them over USB (zen/zc-seq.js), the scenes and chain as it does
// (zen/zc-scenes.js), with the song's name and tempo, into Roland's empty project for the Track setup
// (core/mpj-write.js). Not in the file yet: the sounds (each track keeps the template's) and motion
// (Pump, knob recording); writing over USB still sends those.
//
// Reads: S, PROJ, DEV, HOST.
import { el, toast } from '../core/dom.js';
import { HOST, PROJ, S } from '../core/state.js';
import { DEV, DEVS } from '../core/device.js';
import { mpjBlank, mpjFill } from '../core/mpj-write.js';
import { saveFile } from '../song/export.js';
import { askDlg } from '../ui/dialogs.js';
import { encodePattern, lostText } from '../zen/zc-seq.js';
import { clipPattern } from './write.js';
import { songToRows } from './convert.js';

/** The song as project contents: {name, bpm, clips, scenes, first, from, lost} or {error}. */
export function mpjSong(name) {
  if (DEV !== '707') return { error: 'MC-707 project files are for the MC-707 (8 tracks): switch Settings › Device' };
  const own = !!(S.scn && S.scn.rows.length),
    made = own ? { rows: S.scn.rows, clips: S.scn.clips } : songToRows();
  if (!made.rows.length) return { error: 'The song has nothing to play yet' };
  const clips = [],
    lost = [];
  for (const t of DEVS[DEV].tracks)
    for (let k = 0; k < 16; k++) {
      const c = made.clips[t] && made.clips[t][k];
      if (!c || !S.patterns[c.pat]) continue;
      const type = S.tracks[t].type === 'drum' ? 'drum' : 'tone',
        p = clipPattern(c);
      if (p.type !== type) {
        lost.push(S.tracks[t].name + ' clip ' + (k + 1) + ': a ' + p.type + ' pattern on a ' + type + ' track');
        continue;
      }
      const enc = encodePattern(p, type);
      if (enc.error) {
        lost.push(S.tracks[t].name + ' clip ' + (k + 1) + ': ' + enc.error);
        continue;
      }
      if (enc.skipped) lost.push(S.tracks[t].name + ' clip ' + (k + 1) + ': ' + lostText(enc));
      clips.push({ t, k, size: enc.size, steps: enc.steps, slots: enc.slots });
    }
  return {
    name: (name || PROJ.name || 'Toolbox song').slice(0, 16),
    bpm: S.bpm,
    clips,
    scenes: made.rows.map(r => ({ bars: r.bars, pick: r.pick })),
    first: own ? S.scn.first || 0 : 0,
    from: own ? 'Scene Mode’s clips and scenes' : 'the song (as Scene Mode would make its scenes)',
    lost
  };
}

/** The project file for the song now: {bytes, song} or {error}. */
export async function mpjBytes(name) {
  const song = mpjSong(name);
  if (song.error) return song;
  const kinds = S.tracks.map(t => (t.type === 'drum' ? 'drum' : 'tone'));
  return { bytes: mpjFill(await mpjBlank(kinds), song), song };
}

/** File › Save as MC-707 project: a name, the file, then how to load it on the MC-707. */
export async function saveMpjOpen() {
  const first = mpjSong();
  if (first.error) return void toast(first.error);
  const name = await askDlg({
    title: 'Save as MC-707 project',
    text:
      'A project file to copy onto the MC-707’s SD card and load there, with no computer. It holds ' +
      first.clips.length +
      ' clips and ' +
      first.scenes.length +
      ' scenes from ' +
      first.from +
      ', and the tempo (' +
      first.bpm +
      ' BPM).\n\nThe sounds are not in it yet: each track starts with the template’s default sound, so choose them on the MC-707 (or write the song over USB in Scene Mode, which sends them). Pump and other motion are not in it either.\n\nThe project’s name on the MC-707 (up to 16 letters):',
    input: true,
    def: first.name,
    ok: 'Save'
  });
  if (!name) return;
  let made;
  try {
    made = await mpjBytes(name);
  } catch (e) {
    return void toast('Could not make the project file: ' + ((e && e.message) || e));
  }
  if (made.error) return void toast(made.error);
  const file =
    name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .slice(0, 16) || 'Toolbox song';
  let where = '';
  if (HOST && HOST.saveBinary) {
    try {
      where = await HOST.saveBinary(file + '.mpj', made.bytes, 'mpj');
    } catch (e) {
      return void toast('Could not save the file');
    }
    if (!where) return;
  } else await saveFile(file + '.mpj', new Blob([made.bytes], { type: 'application/octet-stream' }));
  const li = (...k) => el('li', {}, ...k);
  await askDlg({
    title: 'Saved ' + file + '.mpj',
    text:
      (where ? 'In ' + where + '. ' : 'In your Downloads folder. ') +
      (made.song.lost.length ? 'Left out: ' + made.song.lost.join('; ') + '.' : 'Every note went in.'),
    body: el(
      'ol',
      { class: 'hint', style: 'margin:0;padding-left:20px;line-height:1.5' },
      li('On the MC-707: hold SHIFT and press KNOB ASSIGN, pick STORAGE MODE and press ENTER.'),
      li('Connect the USB cable: the SD card shows up as a drive.'),
      li('Copy the .mpj file into the folder with the MC-707’s other projects (under ROLAND), then eject the drive.'),
      li('Leave storage mode, press PROJECT, choose LOAD and pick ' + name.slice(0, 16) + '.'),
      li('Press PLAY: it opens on the first scene with the scene chain on, so the scenes follow one another. Choose the sounds, then save the project on the MC-707.'). Save the project on the MC-707 once you have chosen its sounds.'
      )
    ),
    ok: 'OK',
    cancel: 'Close'
  });
}
