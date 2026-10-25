// Scene Mode's toolbar: play and stop with where it is, the tempo, the four steps of the job with how far
// each has got (1 Clips, 2 Scenes, 3 Write, 4 On the MC-707), whether the MC-707 is connected, and Write
// with its choices (what to write, Auto-write and the write settings).
//
// Reads: S, WO, MIDI.
import { el } from '../core/dom.js';
import { S, scheduleSave } from '../core/state.js';
import { MIDI, connectMidi } from '../services/midi.js';
import { showMenu } from '../ui/menu.js';
import { SC, forgetWritten, rows } from './model.js';
import { WO, pending, setWO, writeAll, writeChanged } from './write.js';
import { sceneGuideOpen } from './guide.js';
import { checkNew } from './check.js';
import { CK } from './check.js';

/** The Write button's menu. */
export function writeMenu(x, y) {
  const p = pending(),
    n = p.clips.length + p.scenes.length,
    tick = (label, k, title) => ({ label, checked: WO[k], hint: title, action: () => setWO(k, !WO[k]) });
  showMenu(x, y, [
    { label: 'Write what changed (' + n + ')', disabled: !n, action: () => writeChanged() },
    { label: 'Write everything', action: () => writeAll() },
    { label: 'Write the clips only', action: () => writeAll('clips') },
    { label: 'Write the scenes only', action: () => writeAll('scenes') },
    '-',
    tick('Auto-write changes', 'auto'),
    tick('Write over clips that hold notes', 'replace'),
    tick('Send the tones', 'tones'),
    tick('Name clips after their patterns', 'names'),
    tick('Set the MC-707’s tempo with the scenes', 'tempo'),
    '-',
    { label: 'Check the new clips on the MC-707 (read-only)', action: checkNew },
    { label: 'Forget what was written (another project on the MC-707)', action: forgetWritten }
  ]);
}

function steps() {
  const q = S.scn,
    clips = q ? q.clips.flat().filter(Boolean).length : 0,
    scenes = rows().length,
    picked = rows().some(r => r.pick.some(k => k >= 0)),
    p = pending(),
    waiting = p.clips.length + p.scenes.length;
  const step = (n, label, state, sub, title, onclick) =>
    el(
      'button',
      { type: 'button', class: 'stStep ' + state, title, onclick },
      el('i', {}, state === 'done' ? '✓' : String(n)),
      el('b', {}, label),
      el('span', {}, sub)
    );
  return el(
    'nav',
    { class: 'stSteps', 'aria-label': 'Steps' },
    step(
      1,
      'Clips',
      clips ? 'done' : 'now',
      clips ? clips + ' filled' : 'fill some',
      'Fill clips on the board: click an empty clip to choose its pattern, a full one to edit its notes and sound',
      () => SC.draw()
    ),
    step(
      2,
      'Scenes',
      picked ? 'done' : clips ? 'now' : 'later',
      scenes ? scenes + ' in the chain' : 'add one',
      'Add scenes to the chain and choose the clip each track plays in them',
      null
    ),
    step(
      3,
      'Write',
      !scenes ? 'later' : waiting ? 'now' : 'done',
      waiting ? waiting + ' waiting' : scenes ? 'all written' : '–',
      waiting
        ? 'Write what changed to the MC-707 (' + p.clips.length + ' clips, ' + p.scenes.length + ' scenes)'
        : 'Everything is written to the MC-707',
      () => writeChanged()
    ),
    step(
      4,
      'On the MC-707',
      scenes && !waiting ? 'now' : 'later',
      'chain on, play',
      'What to do on the MC-707 so it plays the scenes with no computer',
      sceneGuideOpen
    )
  );
}

/** The toolbar; toggle plays or stops. */
export function sceneTop(toggle) {
  const bpm = el('input', {
    type: 'number',
    min: 40,
    max: 240,
    value: S.bpm,
    'aria-label': 'Tempo (BPM)',
    title: 'The song’s tempo. Writing the scenes sets the MC-707’s tempo too (Write ▾ to turn that off)',
    onchange: e => {
      S.bpm = Math.max(40, Math.min(240, Math.round(+e.target.value) || S.bpm));
      e.target.value = S.bpm;
      scheduleSave();
    }
  });
  const p = pending(),
    n = p.clips.length + p.scenes.length;
  return el(
    'header',
    { class: 'scnTop' },
    el('div', { class: 'brand' }, el('b', {}, 'Scene Mode'), el('span', {}, 'MC-707 Toolbox')),
    el(
      'div',
      { class: 'grp' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn play',
          id: 'scnPlay',
          title: 'Play the scene chain from the selected scene (Space)',
          onclick: toggle
        },
        '▶ Play'
      ),
      el('div', { class: 'pos', id: 'scnPos' }, 'Stopped'),
      el('label', {}, 'BPM ', bpm)
    ),
    steps(),
    el(
      'div',
      { class: 'grp', style: 'margin-left:auto' },
      CK.line ? el('span', { class: 'hint scCk' }, CK.line) : null,
      MIDI.out
        ? null
        : el(
            'button',
            {
              type: 'button',
              class: 'btn scnConn',
              title:
                'No MC-707 connected. Play still works here with the app’s own sound; writing and checking need it connected over USB. Click to connect.',
              onclick: () => connectMidi().then(() => SC.draw())
            },
            '⚠ Not connected'
          ),
      WO.auto
        ? el(
            'span',
            {
              class: 'scAuto',
              title: 'Auto-write is on: changes go to the MC-707 a moment after you make them (Write ▾ to turn it off)'
            },
            'Auto'
          )
        : null,
      el(
        'span',
        { class: 'scWrite' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn' + (n ? ' on' : ''),
            title: n ? 'Write the ' + n + ' changed or new clips and scenes to the MC-707' : 'Everything is written',
            onclick: () => writeChanged()
          },
          n ? 'Write ' + n + ' changes' : '✓ All written'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'btn' + (n ? ' on' : ''),
            'aria-label': 'Write choices',
            title: 'Write everything, clips or scenes only; Auto-write; settings',
            onclick: e => writeMenu(e.clientX, e.clientY)
          },
          '▾'
        )
      )
    )
  );
}
