// Open an MC-707 project file (.mpj, copied off the SD card in storage mode) and see what is in it: its
// name and tempo, each track's kind and sound name, the clips with notes, and the samples it holds. Bring
// the clips into Scene Mode's board (as patterns), add them to My patterns, and play or save the samples
// as WAV files. Read only: the file is never changed. The format is in core/mpj.js.
//
// Reads: S, DEV.
import { el, toast } from '../core/dom.js';
import { S, addPattern, pushUndo, scheduleSave } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS } from '../core/device.js';
import { hooks } from '../core/hooks.js';
import { emptyClips, newRow } from '../core/scene-model.js';
import { readMpj, sampleAudio, wavBytes } from '../core/mpj.js';
import { AU, ensureAudio } from '../services/synth.js';
import { userSave } from '../library/user-lib.js';
import { makeZip, saveFile } from '../song/export.js';
import { STEP_NAMES, joinNotes, toPattern } from '../zen/zc-seq.js';
import { askDlg } from './dialogs.js';
import { matchTypes } from './track-setup.js';

/** Ask for a project file and open it. */
export function mpjPick() {
  const inp = el('input', { type: 'file', accept: '.mpj,.MPJ', style: 'display:none' });
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    if (!f) return;
    toast('Reading ' + f.name + '…');
    try {
      mpjOpen(new Uint8Array(await f.arrayBuffer()), f.name);
    } catch (e) {
      toast('Could not read ' + f.name);
    }
  };
  document.body.append(inp);
  inp.click();
}

const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const tidy = s => s.replace(/\s+/g, ' ').trim();

/* the clip as an app pattern: {pattern, dropped} (drum notes become lanes through the drum map) */
function clipPattern(m, t, k, file) {
  const c = m.tracks[t].clips[k],
    tr = m.tracks[t];
  const name = tidy((c.sound || tr.sound || m.name || file) + ' · T' + (t + 1) + ' C' + (k + 1));
  return toPattern(joinNotes(c.slots), { size: c.size, steps: c.steps }, tr.kind === 'drum' ? 'drum' : 'tone', name);
}

/** Show what is in project file u8 (named file). */
export function mpjOpen(u8, file) {
  const m = readMpj(u8);
  if (m.error) return toast(m.error);
  document.getElementById('mpjOv')?.remove();
  const close = () => ov.remove();
  const title = m.name || file.replace(/\.mpj$/i, '');
  const full = (t, k) => {
    const c = m.tracks[t].clips[k];
    return c && c.notes ? c : null;
  };
  const clipCount = m.tracks.reduce((n, tr, t) => n + tr.clips.filter((c, k) => full(t, k)).length, 0);
  let playing = null;
  const stop = () => {
    if (playing) playing.stop();
    playing = null;
  };
  const play = s => {
    ensureAudio();
    stop();
    const ch = sampleAudio(u8, s),
      buf = AU.ctx.createBuffer(ch.length, ch[0].length, s.rate);
    ch.forEach((d, i) => buf.copyToChannel(d, i));
    const src = AU.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(AU.ctx.destination);
    src.start();
    playing = src;
  };
  const wavName = (s, i) => String(i + 1).padStart(2, '0') + ' ' + s.name.replace(/\.wav$/i, '') + '.wav';
  /* the project's first 8 scenes that play a clip with notes: [{n, pick}] */
  const scenes = m.scenes
    .map((pick, n) => ({
      n,
      pick: pick.map((k, t) => (k >= 0 && full(t, k) && m.tracks[t].kind !== 'looper' ? k : -1))
    }))
    .filter(x => x.pick.some(k => k >= 0));
  const sceneRows = scenes.map(x =>
    el(
      'div',
      { class: 'mpjScn' },
      el('b', {}, '1-' + (x.n + 1)),
      ...x.pick.map((k, t) =>
        el(
          'span',
          {
            class: 'mpjClip' + (k < 0 ? ' empty' : ''),
            style: '--tc:' + TRACK_COLORS[t],
            title: 'Track ' + (t + 1) + (k < 0 ? ': nothing' : ': clip ' + (k + 1))
          },
          k < 0 ? '–' : String(k + 1)
        )
      )
    )
  );
  const trackRows = m.tracks.map((tr, t) =>
    el(
      'div',
      { class: 'mpjTrk', style: '--tc:' + TRACK_COLORS[t] },
      el('b', {}, 'Track ' + (t + 1)),
      el('span', { class: 'mpjKind ' + tr.kind }, tr.kind.toUpperCase()),
      el('span', { class: 'mpjSound', title: 'The track’s sound' }, tr.sound || '—'),
      el(
        'span',
        { class: 'mpjClips' },
        ...(tr.kind === 'looper'
          ? [el('span', { class: 'hint' }, 'Looper track: its recordings are not read yet')]
          : tr.clips.map((c, k) =>
              full(t, k)
                ? el(
                    'span',
                    {
                      class: 'mpjClip',
                      title:
                        'Clip ' +
                        (k + 1) +
                        (c.sound ? ' · ' + c.sound : '') +
                        ': ' +
                        plural(c.notes, 'note') +
                        ', ' +
                        c.steps +
                        ' steps of ' +
                        STEP_NAMES[c.size]
                    },
                    String(k + 1)
                  )
                : el('span', { class: 'mpjClip empty', 'aria-hidden': 'true' }, '·')
            ))
      )
    )
  );
  const sampleRows = m.samples.map((s, i) =>
    el(
      'div',
      { class: 'mpjSmp' },
      el('button', { type: 'button', class: 'btn sm', title: 'Play it', onclick: () => play(s) }, '▶'),
      el('b', {}, s.name),
      el(
        'span',
        { class: 'hint' },
        (s.channels === 2 ? 'stereo' : 'mono') +
          ' · ' +
          (s.count / s.channels / s.rate).toFixed(2) +
          ' s · ' +
          s.rate / 1000 +
          ' kHz'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm',
          onclick: () => saveFile(wavName(s, i), wavBytes(sampleAudio(u8, s), s.rate))
        },
        'Save WAV'
      )
    )
  );
  const toScenes = async () => {
    const types = m.tracks.map(tr => tr.kind);
    const wrong = DEVS[DEV].tracks.filter(
      t =>
        (types[t] === 'drum' || types[t] === 'tone') &&
        m.tracks[t].clips.some((c, k) => full(t, k)) &&
        S.tracks[t].type !== types[t]
    );
    if (wrong.length) {
      const ok = await askDlg({
        title: 'Set the tracks to match the project?',
        text:
          'In the project, ' +
          wrong.map(t => 'track ' + (t + 1) + ' is a ' + types[t] + ' track').join(', ') +
          '. The app’s Track setup changes to match (Undo brings it back); without that, those clips are left out.',
        ok: 'Match the tracks',
        cancel: 'Leave them out'
      });
      if (ok && !(await matchTypes(types))) return;
    }
    if (
      S.scn &&
      !(await askDlg({
        title: 'Replace Scene Mode’s clips and scenes?',
        text:
          'Scene Mode’s clips' +
          (scenes.length ? ' and scenes are' : ' are') +
          ' replaced by the project’s (Undo brings them back).',
        ok: 'Replace'
      }))
    )
      return;
    pushUndo();
    let dropped = 0,
      put = 0,
      skipped = 0;
    const clips = emptyClips();
    for (const t of DEVS[DEV].tracks)
      for (let k = 0; k < 16; k++) {
        if (!full(t, k)) continue;
        if (S.tracks[t].type !== m.tracks[t].kind) {
          skipped++;
          continue;
        }
        const r = clipPattern(m, t, k, file);
        dropped += r.dropped;
        if (!r.pattern.notes.length) continue;
        const p = r.pattern;
        clips[t][k] = { pat: addPattern(p.type, p.name, p.bars, p.notes, { role: p.role || '' }) };
        put++;
      }
    S.scn = S.scn || { v: 2, first: 0, rows: [], tones: {}, done: { c: {}, s: {}, p: {} } };
    S.scn.clips = clips;
    if (scenes.length) {
      /* its scenes, in order from 1-1; each as long as its longest clip (the chain lengths are not read yet) */
      S.scn.first = 0;
      S.scn.rows = scenes.map(x => {
        const pick = x.pick.map((k, t) => (k >= 0 && clips[t][k] ? k : -1)),
          bars = Math.max(1, ...pick.map((k, t) => (k >= 0 ? S.patterns[clips[t][k].pat].bars : 1)));
        const r = newRow('r' + S.nextId++, 'Scene 1-' + (x.n + 1), bars);
        r.pick = pick;
        return r;
      });
    } else S.scn.rows.forEach(r => (r.pick = r.pick.map((k, t) => (k >= 0 && clips[t][k] ? k : -1))));
    S.scn.done = { c: {}, s: {}, p: {} };
    if (m.bpm >= 20 && m.bpm <= 300) S.bpm = m.bpm;
    /* the tracks take the names of their sounds on the MC-707 */
    for (const t of DEVS[DEV].tracks)
      if (m.tracks[t].sound && m.tracks[t].kind !== 'empty') S.tracks[t].name = m.tracks[t].sound.slice(0, 16);
    scheduleSave();
    close();
    hooks.setMode('scene');
    hooks.renderAll();
    toast(
      'Brought in ' +
        plural(put, 'clip') +
        (scenes.length ? ' and ' + plural(scenes.length, 'scene') : '') +
        ' from ' +
        title +
        (m.bpm ? ' at ' + m.bpm + ' BPM' : '') +
        (skipped ? '; ' + skipped + ' left out (track kind)' : '') +
        (dropped ? '; ' + plural(dropped, 'drum note') + ' had no lane in the drum map' : '')
    );
  };
  const toMine = () => {
    let n = 0;
    m.tracks.forEach((tr, t) =>
      tr.clips.forEach((c, k) => {
        if (!full(t, k) || (tr.kind !== 'drum' && tr.kind !== 'tone')) return;
        const r = clipPattern(m, t, k, file);
        if (r.pattern.notes.length && userSave(r.pattern)) n++;
      })
    );
    hooks.renderAll();
    toast('Added ' + plural(n, 'clip') + ' from ' + title + ' to My patterns');
  };
  const saveAll = () =>
    saveFile(
      title.replace(/[^\w\- ]+/g, '').trim() + ' samples.zip',
      makeZip(m.samples.map((s, i) => ({ name: wavName(s, i), data: wavBytes(sampleAudio(u8, s), s.rate) })))
    );
  const ov = el(
    'div',
    { id: 'mpjOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'MC-707 project file' },
    el(
      'div',
      { class: 'ptBox mpjBox' },
      el('h3', {}, 'MC-707 project: ' + title),
      el(
        'p',
        { class: 'hint' },
        file +
          ' · ' +
          (m.bpm ? m.bpm + ' BPM · ' : '') +
          plural(clipCount, 'clip') +
          ' with notes · ' +
          plural(m.samples.length, 'sample') +
          '. Read only: the file is not changed.'
      ),
      el('div', { class: 'mpjTracks' }, ...trackRows),
      scenes.length
        ? el(
            'div',
            { class: 'mpjScenes' },
            el('h4', {}, 'Scenes 1-1 to 1-8'),
            el(
              'p',
              { class: 'hint' },
              'The clip each track plays in the project’s first 8 scenes (the ones that play anything). They come into Scene Mode with the clips, each as long as its longest clip: the chain lengths and scenes past 1-8 are not read yet.'
            ),
            ...sceneRows
          )
        : null,
      el(
        'div',
        { class: 'mpjActs' },
        el(
          'button',
          { type: 'button', class: 'btn on', onclick: toScenes, disabled: !clipCount },
          'Bring the clips into Scene Mode'
        ),
        el('button', { type: 'button', class: 'btn', onclick: toMine, disabled: !clipCount }, 'Add them to My patterns')
      ),
      el(
        'p',
        { class: 'hint' },
        'Clips come in with their notes, lengths and step sizes, each in the same track and clip number, as patterns you can edit and write back; the tracks take their sounds’ names and the song its tempo. Not read from the file yet: the sounds themselves (only their names), scenes past 1-8 and chain lengths, motion, and looper recordings.'
      ),
      m.samples.length
        ? el(
            'div',
            { class: 'mpjSamples' },
            el('h4', {}, 'Samples in the project'),
            ...sampleRows,
            el(
              'div',
              { class: 'mpjActs' },
              el('button', { type: 'button', class: 'btn', onclick: saveAll }, 'Save all samples (zip)')
            )
          )
        : null,
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn', onclick: () => (stop(), close()) }, 'Close')
      )
    )
  );
  ov.addEventListener('keydown', e => e.key === 'Escape' && (stop(), close()));
  document.body.append(ov);
  return m;
}
