// Scene Mode's toolbar: play and stop with where it is, the tempo, add a scene, from and to Song Mode,
// which MC-707 scene the first row goes into, and Send to MC-707.
//
// Reads: S.
import { el, toast } from '../core/dom.js';
import { S, scheduleSave } from '../core/state.js';
import { sceneName } from '../zen/zc-scenes.js';
import { SC, addRow, firstScene, rows, setFirst } from './model.js';
import { MIDI, connectMidi } from '../services/midi.js';
import { scenesSendOpen } from './send.js';
import { scenesFromSong, scenesToSong } from './convert.js';
import { sceneGuideOpen, sentState } from './guide.js';

/** The toolbar; toggle plays or stops. */
export function sceneTop(toggle) {
  const bpm = el('input', {
    type: 'number',
    min: 40,
    max: 240,
    value: S.bpm,
    'aria-label': 'Tempo (BPM)',
    title: 'The song’s tempo. Send to MC-707 sets the MC-707’s tempo to it too',
    onchange: e => {
      S.bpm = Math.max(40, Math.min(240, Math.round(+e.target.value) || S.bpm));
      e.target.value = S.bpm;
      scheduleSave();
    }
  });
  const first = el(
    'select',
    {
      'aria-label': 'First MC-707 scene',
      title: 'The MC-707 scene the first row goes into',
      onchange: e => setFirst(+e.target.value)
    },
    ...Array.from({ length: 128 }, (_, s) =>
      el('option', { value: s, selected: s === firstScene() }, 'from ' + sceneName(s))
    )
  );
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
          title: 'Play the scenes in order from the selected one (Space)',
          onclick: toggle
        },
        '▶ Play'
      ),
      el('div', { class: 'pos', id: 'scnPos' }, 'Stopped')
    ),
    el('div', { class: 'grp' }, el('label', {}, 'BPM ', bpm)),
    el(
      'div',
      { class: 'grp' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => addRow(rows().length ? rows().length - 1 : null) || toast('The MC-707 holds 128 scenes')
        },
        '+ Scene'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          title: 'Make scenes from the song in Song Mode: a scene wherever its patterns change',
          onclick: scenesFromSong
        },
        'From song'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          title: 'Lay the scenes out in Song Mode, one after another',
          onclick: scenesToSong
        },
        'To song'
      )
    ),
    el(
      'div',
      { class: 'grp', style: 'margin-left:auto' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn' + (SC.clipsOn ? ' on' : ''),
          'aria-pressed': String(SC.clipsOn),
          title: 'Show which MC-707 clips each track uses, and check them on the MC-707',
          onclick: () => ((SC.clipsOn = !SC.clipsOn), SC.draw())
        },
        '▦ Clips'
      ),
      el('label', { title: 'Where the scenes go on the MC-707' }, 'Scenes ', first),
      el(
        'button',
        {
          type: 'button',
          class: 'btn on',
          title: 'Write the clips, their tones and the scenes to the MC-707',
          onclick: scenesSendOpen
        },
        'Send to MC-707…'
      ),
      sentPill(),
      MIDI.out
        ? null
        : el(
            'button',
            {
              type: 'button',
              class: 'btn scnConn',
              title:
                'No MC-707 connected. Play still works here with the app’s own preview sound; Send to MC-707 and the clip check need it connected over USB. Click to connect.',
              onclick: () => connectMidi().then(() => SC.draw())
            },
            '⚠ Not connected'
          ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          title: 'What to do, in the app and on the MC-707, so it plays the scenes with no computer',
          onclick: sceneGuideOpen
        },
        '? How it plays'
      )
    )
  );
}
/* whether the MC-707 has the scenes as they are here */
function sentPill() {
  const st = sentState();
  return el(
    'span',
    {
      class: 'scnSent ' + st,
      title:
        st === 'sent'
          ? 'The MC-707 has these scenes (until you load another project there without saving)'
          : st === 'changed'
            ? 'You changed the scenes after sending: send again for the MC-707 to play them'
            : 'Not sent from this session. Play here works anyway (the app plays the MC-707 over MIDI)'
    },
    st === 'sent' ? '✓ Sent' : st === 'changed' ? '● Changed since sent' : 'Not sent'
  );
}
