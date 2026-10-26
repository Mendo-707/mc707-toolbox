// Scene Mode's guide: what to do, in order, so the MC-707 plays the scenes by itself with no computer
// (the app's part and the MC-707's part), with how far this song has got.
//
// Reads: S.
import { $, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { sceneName } from '../zen/zc-scenes.js';
import { firstScene, rows } from './model.js';
import { pending } from './write.js';
import { templatesOpen } from '../ui/templates.js';

const STEPS = () => {
  const f = sceneName(firstScene());
  return [
    [
      'In the app',
      [
        '0 · Start the MC-707 from a project template that matches your Track setup (MC-707 › Project templates, or the button below), written under a new name, so its tracks are drum and tone tracks where the app expects them.',
        '1 · Clips: fill the MC-707’s clips on the board. Click an empty clip to choose its pattern, a full one to edit its notes (Notes) and its sound (Sound: the ZenCore editor and the factory tones).',
        '2 · Scenes: add scenes to the chain. Each one plays a clip per track (its chips) for so many bars; the last keeps playing.',
        '3 · Write: Write sends what changed (✓ written · ● changed · + not written yet). Or write one clip, a track or a scene from its button or right-click, or turn on Auto-write. Use a project you can lose the first time.'
      ]
    ],
    [
      '4 · On the MC-707',
      [
        'System 1.71 or later: the scene chain came in 1.71 (Roland’s support page has the update).',
        'Set Call Scene to TYPE2 (UTILITY › SET › CTRL tab), so scenes are numbered as here: SCENE buttons pick the bank, step buttons the scene.',
        'Turn the chain on: press MUTE, hold SHIFT and press a step button for the SCENE CHAIN screen, then set C1 CHAIN to ON. (The app cannot switch it.)',
        'Call up scene ' + f + ' and press PLAY. Each scene plays its bars, then the next comes in.',
        'Save the project on the MC-707 to keep it. Then unplug the computer: the MC-707 plays the song by itself.',
        'A track silent on every clip? Check its Sound Source (the track settings, GENERAL tab): a clip given its own tone here sets it to CLIP, and clips with no sound of their own then play nothing. Set it to TRACK, or give each clip a tone.'
      ]
    ]
  ];
};

/** Open the guide. */
export function sceneGuideOpen() {
  if ($('#sgOv')) return;
  const close = () => ov.remove();
  const p = pending(),
    n = p.clips.length + p.scenes.length,
    clips = S.scn ? S.scn.clips.flat().filter(Boolean).length : 0;
  const ov = el(
    'div',
    {
      id: 'sgOv',
      class: 'ptOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'How it plays on the MC-707',
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
        clips +
          ' clip' +
          (clips === 1 ? '' : 's') +
          ', ' +
          rows().length +
          ' scene' +
          (rows().length === 1 ? '' : 's') +
          ' from scene ' +
          sceneName(firstScene()) +
          '. ' +
          (!rows().length ? 'No scenes yet.' : n ? n + ' clips and scenes not written yet.' : 'Everything is written.')
      ),
      ...STEPS().map(([h, list]) =>
        el('div', { class: 'sgPart' }, el('h4', {}, h), el('ol', {}, ...list.map(x => el('li', {}, x))))
      ),
      el(
        'p',
        { class: 'hint' },
        'Without writing, Play here plays the scenes on the MC-707 over MIDI, the app keeping time. The MC-707 needs the computer for that.'
      ),
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end;gap:8px' },
        el(
          'button',
          { type: 'button', class: 'btn', style: 'margin-right:auto', onclick: () => (close(), templatesOpen()) },
          'MC-707 project templates…'
        ),
        el('button', { type: 'button', class: 'btn on', onclick: close }, 'Got it')
      )
    )
  );
  document.body.append(ov);
  ov.querySelector('button.on').focus();
}
