// Scene Mode's guide: what to do, in order, so the MC-707 plays the scenes by itself with no computer
// (the app's part and the MC-707's part), and whether the scenes were sent and changed since.
//
// Reads: S, SC.
import { $, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { sceneName } from '../zen/zc-scenes.js';
import { SC, firstScene, rows } from './model.js';

/** Remember the scenes as sent (after Send to MC-707). */
export function markSent() {
  SC.sent = JSON.stringify(S.scn || null);
}
/** 'none' (not sent this session), 'sent', or 'changed' (edited since sending). */
export const sentState = () => (!SC.sent ? 'none' : SC.sent === JSON.stringify(S.scn || null) ? 'sent' : 'changed');

const STEPS = () => {
  const f = sceneName(firstScene());
  return [
    [
      'In the app',
      [
        'Arrange the scenes: a pattern per track in each scene, and how many bars each scene plays. The last scene keeps playing.',
        '▦ Clips shows the MC-707 clips each track will use. Keep those clips free, or pick another starting clip; Check the MC-707 rings any that already hold notes.',
        'Send to MC-707 writes the clips (notes and tones), then the scenes and their lengths. Use a project you can lose the first time.'
      ]
    ],
    [
      'On the MC-707',
      [
        'System 1.71 or later: the scene chain came in 1.71 (Roland’s support page has the update).',
        'Set Call Scene to TYPE2 (UTILITY › SET › CTRL tab), so scenes are numbered as here: SCENE buttons pick the bank, step buttons the scene.',
        'Turn the chain on: press MUTE, hold SHIFT and press a step button for the SCENE CHAIN screen, then set C1 CHAIN to ON.',
        'Call up scene ' + f + ' and press PLAY. Each scene plays its bars, then the next comes in.',
        'Save the project on the MC-707 to keep it. Then unplug the computer: the MC-707 plays the song by itself.'
      ]
    ]
  ];
};

/** Open the guide. */
export function sceneGuideOpen() {
  if ($('#sgOv')) return;
  const close = () => ov.remove();
  const st = sentState();
  const ov = el(
    'div',
    {
      id: 'sgOv',
      class: 'ptOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Play it on the MC-707',
      onclick: e => e.target === ov && close(),
      onkeydown: e => e.key === 'Escape' && (e.stopPropagation(), close())
    },
    el(
      'div',
      { class: 'ptBox sgBox' },
      el('h3', {}, 'Play your scenes on the MC-707, without the computer'),
      el(
        'p',
        { class: 'hint' },
        rows().length +
          ' scene' +
          (rows().length === 1 ? '' : 's') +
          ', from scene ' +
          sceneName(firstScene()) +
          '. ' +
          (st === 'sent'
            ? 'Sent, and not changed since.'
            : st === 'changed'
              ? 'Changed since you sent them: send again.'
              : 'Not sent yet.')
      ),
      ...STEPS().map(([h, list]) =>
        el('div', { class: 'sgPart' }, el('h4', {}, h), el('ol', {}, ...list.map(x => el('li', {}, x))))
      ),
      el(
        'p',
        { class: 'hint' },
        'Without sending, Play here plays the scenes on the MC-707 over MIDI, the app keeping time. The MC-707 needs the computer for that.'
      ),
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn on', onclick: close }, 'Got it')
      )
    )
  );
  document.body.append(ov);
  ov.querySelector('button').focus();
}
