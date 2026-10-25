// The start screen: when the app opens (in Song Mode) it offers to load the last session, start
// a blank song or an empty template with its sections marked, open the song wizard, go to Scene, Live
// or Synth Mode, or open the ZenCore editor. A tick box turns it off.
//
// Reads: S, PROJ.
// Owns: localStorage 'mc707-start' ('0' = do not show at start).
import { $, el } from '../core/dom.js';
import { PROJ, S, UI, pushUndo, replaceState, newState } from '../core/state.js';
import { afterReplaceKeepUndo } from './controls.js';
import { openWiz } from '../song/wizard-ui.js';
import { setMode } from './mode.js';
import { DEVS, DEV } from '../core/device.js';
import { zenOpen } from '../zen/zc-editor.js';

const KEY = 'mc707-start';
/** True unless the start screen was turned off. */
export function startOnOpen() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch (e) {
    return true;
  }
}
/* sections of the empty template: 64 bars in a classic dance shape */
const TEMPLATE = [
  [0, 'Intro'],
  [8, 'Build'],
  [16, 'Drop'],
  [32, 'Break'],
  [40, 'Build 2'],
  [48, 'Drop 2'],
  [56, 'Outro']
];
function fresh(template) {
  pushUndo();
  const m = S.midiOut;
  replaceState(newState());
  S.midiOut = m;
  if (template) {
    S.bars = 64;
    S.markers = TEMPLATE.map(([bar, name]) => ({ bar, name }));
  }
  UI.sel = null;
  afterReplaceKeepUndo();
}
/**
 * Show the start screen. `last` is true when the app opened with the session it saved last time
 * (it is already loaded behind the screen, so Load last session simply keeps it); 'menu' when
 * opened from the File menu, where that card goes back to the song open now.
 */
export function startOpen(last = true) {
  if ($('#startOv')) return;
  const has = !!last;
  const close = () => ov.remove();
  const card = (icon, title, text, fn, on) =>
    el(
      'button',
      {
        type: 'button',
        class: 'stCard' + (on ? ' on' : ''),
        onclick: () => {
          close();
          fn();
        }
      },
      el('span', { class: 'stIcon', 'aria-hidden': 'true' }, icon),
      el('b', {}, title),
      el('small', {}, text)
    );
  const ov = el(
    'div',
    { id: 'startOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Start' },
    el(
      'div',
      { class: 'ptBox stBox' },
      el('h2', {}, 'MC-707 Toolbox'),
      el('p', { class: 'hint' }, 'What would you like to do?'),
      el(
        'div',
        { class: 'stGrid' },
        has
          ? card(
              '↻',
              last === 'menu' ? 'Back to this song' : 'Load last session',
              (PROJ.name || 'Your last song') +
                ' · ' +
                (S.clips.length ? S.clips.length + ' clips' : 'empty') +
                ' at ' +
                Math.round(S.bpm) +
                ' BPM',
              () => {},
              true
            )
          : null,
        card('＋', 'Blank song', 'An empty arrangement: drag patterns in from the library.', () => fresh(false), !has),
        card('▤', 'Empty template', '64 bars with the sections marked: intro, build, drop, break, drop 2, outro.', () =>
          fresh(true)
        ),
        card('✦', 'Song wizard', 'Pick a style and get a full arrangement to start from.', () => openWiz()),
        card('▦', 'Scene Mode', 'Arrange in MC-707 scenes, then send them so the MC-707 plays the song by itself.', () =>
          setMode('scene')
        ),
        card('◉', 'Live Mode', 'Pick a genre and jam: scenes on 16 pads, drops, breaks and effects.', () =>
          setMode('live')
        ),
        card(
          '≋',
          'Synth Mode',
          'The MC-707 as an 8-track synth for your DAW: pick, edit and mix each track’s sound.',
          () => setMode('synth')
        ),
        card(
          '◈',
          'ZenCore editor',
          'Edit a sound on the MC-707: every parameter, the Sound browser and the factory tones.',
          /* the first tone track's clip 1; the editor's own Track and Clip menus pick another */
          () => zenOpen(DEVS[DEV].tracks.find(t => S.tracks[t].type !== 'drum') ?? DEVS[DEV].tracks[0], 0)
        )
      ),
      el(
        'label',
        { class: 'stShow' },
        el('input', {
          type: 'checkbox',
          checked: true,
          onchange: e => {
            try {
              localStorage.setItem(KEY, e.target.checked ? '1' : '0');
            } catch (er) {}
          }
        }),
        ' Show this when the app opens (also in File › Start screen)'
      )
    )
  );
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
  document.body.append(ov);
  setTimeout(() => {
    const b = ov.querySelector('.stCard.on') || ov.querySelector('.stCard');
    if (b) b.focus();
  }, 30);
}
