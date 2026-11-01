// The tutorial: what to set up on the MC-707 (or MC-101) and in the app, chapter by chapter: getting
// connected, the tracks, then each mode (Song, Scene, Live, Synth, the ZenCore editor and the Slime Lab).
// Each chapter has what to do on the MC-707, what to do in the app, and buttons that open the place it
// talks about. From the start screen's foot and Help › Tutorial.
//
// Owns: localStorage 'mc707-tutorial' (the chapter open last).
import { $, el } from '../core/dom.js';
import { DEV, DEVS } from '../core/device.js';
import { openSetup } from './setup-wizard.js';
import { trackSetupOpen } from './track-setup.js';
import { templatesOpen } from './templates.js';
import { setMode } from './mode.js';

const KEY = 'mc707-tutorial';
/* a chapter: [id, title, what it is for, [on the device], [in the app], [[button, action]]] */
const chapters = dn => [
  [
    'connect',
    'Connect',
    'Every mode starts here: one USB cable carries every track’s notes, the sounds and (if you like) the audio.',
    [
      'Use a data USB cable in the ' + dn + '’s COMPUTER port, then switch it on.',
      'Open the settings: hold SHIFT and press KNOB ASSIGN (the UTILITY menu), then press the C4 knob for SYSTEM SETTING. Everything below is in there.',
      'USB Driver (turn C3 to find it, C4 to change it): VENDOR, with Roland’s driver on your computer (Windows 10 and 11 install it themselves when online), or GENERIC. Switch the ' +
        dn +
        ' off and on after changing it.',
      'MIDI tab: MIDI Rx Auto Channel OFF, so each track only hears its own channel.',
      'Track Channel 1-8: CH1 to CH8 (track 1 on channel 1 … track 8 on channel 8).',
      'Device ID 17 (the default), for the ZenCore editor.'
    ],
    [
      'Open MC-707 › Set up your MC-707 and press Auto-connect MC-707.',
      'Press Play tracks 1 → 8: each track should sound in turn. If one doesn’t, change its channel there.',
      'Not showing up? Close other programs using the MIDI port (a DAW, another browser tab), try the other USB driver, then Rescan.'
    ],
    [['Set up your MC-707…', () => openSetup()]]
  ],
  [
    'tracks',
    'Tracks',
    'The app and the ' +
      dn +
      ' must agree on which tracks are drums and which play tones. The app can’t change that on the ' +
      dn +
      ', so you set it once by hand.',
    [
      'Each drum track holds a drum kit, each tone track a tone (select the track and choose its sound), unmuted with its level up.',
      'Easiest: load a project template with the tracks already set up. Copy it to the SD card in STORAGE MODE (hold SHIFT and press KNOB ASSIGN, pick STORAGE MODE, press ENTER, then connect USB), then PROJECT › LOAD it and straight away PROJECT › WRITE it under a new name.',
      'Clips that hold a sound but no notes work best: the app plays the notes.'
    ],
    [
      'Settings › Track setup: pick how many drum and tone tracks you use (3 drums + 5 tones is the default) and what each one is for.',
      'MC-707 › Project templates says which template matches your Track setup.',
      'An MC-101: Settings › Device › MC-101 (it also switches by itself when it finds one).'
    ],
    [
      ['Track setup…', () => trackSetupOpen()],
      ['Project templates…', () => templatesOpen()]
    ]
  ],
  [
    'song',
    'Song Mode',
    'Write a whole song on the timeline and play it on the ' + dn + ' note for note.',
    [
      'MIDI Sync: AUTO (or USB) in SYSTEM SETTING, MIDI tab, so the ' + dn + ' follows the app’s tempo.',
      'RX Start Stop USB: OFF if your clips hold notes of their own and you only want the app’s parts.',
      'Recording every track’s audio over USB needs nothing more on the ' +
        dn +
        ' from system 1.60 on (before that, USB Driver VENDOR): it sends the mix and each track as inputs of their own.'
    ],
    [
      'Start from the start screen: Song wizard (a whole song in a style), Empty template, or Blank song.',
      'Drag patterns from the library onto the tracks, or + New blank pattern at the top of the library; click a clip to edit it in the step grid or piano roll.',
      'Tick Make the MC-707 follow this app (MC-707 › Set up your MC-707) to send clock and start/stop with Play.',
      'Space plays. Record audio, or File › Export MIDI, when it’s done.'
    ],
    [['Go to Song Mode', () => setMode('song')]]
  ],
  [
    'scene',
    'Scene Mode',
    'Put the song on the ' + dn + ' as clips and a scene chain, so it plays by itself with no computer.',
    [
      'System 1.71 or later (the scene chain came in 1.71).',
      'Call Scene: TYPE2 (SYSTEM SETTING, CTRL tab), so scenes are numbered as in the app.',
      'Turn the chain on: press MUTE, hold SHIFT and press a step button for the SCENE CHAIN screen, then set C1 CHAIN to ON (the app can’t switch it).',
      'After writing: call up the first scene and press PLAY, and save the project on the ' + dn + ' to keep it.',
      'A track silent on every clip? In its track settings (GENERAL tab) set Sound Source to TRACK, or give each clip its own tone.'
    ],
    [
      'Start from a project template that matches your Track setup, written under a new name: use a project you can lose the first time.',
      'Make them from the song, or fill the clips board yourself: click an empty clip to choose its pattern.',
      'Add scenes to the chain: each plays a clip per track for so many bars.',
      'Write sends what changed (✓ written · ● changed · + not written yet), or turn on Auto-write. ? How it works has the whole list.'
    ],
    [['Go to Scene Mode', () => setMode('scene')]]
  ],
  [
    'live',
    'Live Mode',
    'Play a looping set from 16 pads: scenes, breaks, builds and drops that land on the beat.',
    [
      'For the pads: select a drum track, hold SHIFT and press its TRACK SEL, open the MIDI tab, and turn Tx MIDI Note and Tx USB MIDI ON. The pads then work while that track is selected.',
      'MIDI Sync: AUTO (or USB) if you want the ' + dn + ' to follow the set’s tempo.'
    ],
    [
      'Pick a genre when Live Mode opens (Live › Pick a genre changes it).',
      'Press ▶ Start Jam. Pads 1–7 are the scenes, pad 8 is Break; the bottom row swaps parts, fills, stutters and builds into a drop.',
      'Auto-pilot runs the set by itself; Variation and Chaos set how much it changes. 🎲 New patterns brings fresh parts in without stopping.',
      'Optional: a USB controller keyboard as well, for mutes, key changes and live solos (Raven mode).'
    ],
    [['Go to Live Mode', () => setMode('live')]]
  ],
  [
    'synth',
    'Synth Mode',
    'The ' +
      dn +
      ' as an 8-track synth for your DAW: the DAW plays and records it, the app picks, edits and mixes the sounds.',
    [
      'Nothing to set from system 1.60 on (before that, USB Driver VENDOR in SYSTEM SETTING): over USB the ' +
        dn +
        ' sends the mix and each track as audio inputs of their own.',
      'Windows: Roland’s driver (Windows 10 and 11 install it themselves when online).'
    ],
    [
      'In the DAW: choose the ' +
        dn +
        ' as the audio device, then one MIDI track per ' +
        dn +
        ' track on the channel shown on its strip, and one audio track recording each input.',
      'Windows lets one program use the MIDI port at a time: let the DAW send to a virtual port (loopMIDI) and pick it under Notes in, or use Windows 11’s MIDI Services to share it. Macs share it anyway.',
      'Read sounds shows each track’s sound; Expand a track to edit it beside the others.'
    ],
    [['Go to Synth Mode', () => setMode('synth')]]
  ],
  [
    'zen',
    'ZenCore editor and Slime Lab',
    'Edit the sounds inside your ' + dn + ' on a big screen, or shape them the easy way in the Slime Lab.',
    [
      'Device ID 17 (the default) and the USB connection from Connect.',
      'The editor changes the sound in the ' + dn + '’s memory: save the project on the ' + dn + ' to keep it.',
      'Optional: the factory tones come from the ' +
        dn +
        '’s system update file (MC707_UPA_up.bin from Roland), read on your computer.'
    ],
    [
      'Open MC-707 › Your MC-707 clips & ZenCore, pick a clip and press Edit ZenCore (or right-click a clip anywhere).',
      'With Live on, every change goes to the ' + dn + ' as you make it; play from the editor’s keyboard or the pads.',
      'Sounds opens the Sound browser: your sounds, starters, factory tones and expansions (Grab from › …).',
      'Slime Lab (in the editor’s header, tones): start from a sound, turn the five knobs, grow variations, then Fine-tune.'
    ],
    []
  ]
];

/** Open the tutorial (at a chapter, or the one open last). */
export function tutorialOpen(at) {
  if ($('#tutOv')) return;
  const dn = DEVS[DEV].name,
    list = chapters(dn);
  let cur = list.findIndex(c => c[0] === at);
  if (cur < 0) {
    try {
      cur = Math.max(
        0,
        list.findIndex(c => c[0] === localStorage.getItem(KEY))
      );
    } catch (e) {
      cur = 0;
    }
  }
  const close = () => ov.remove();
  const nav = el('nav', { class: 'tutNav', 'aria-label': 'Chapters' }),
    body = el('div', { class: 'tutBody', tabindex: '-1' });
  const go = i => {
    cur = Math.max(0, Math.min(list.length - 1, i));
    try {
      localStorage.setItem(KEY, list[cur][0]);
    } catch (e) {}
    draw();
  };
  const part = (title, items) =>
    items.length
      ? el('section', { class: 'tutPart' }, el('h4', {}, title), el('ol', {}, ...items.map(x => el('li', {}, x))))
      : null;
  function draw() {
    nav.replaceChildren(
      ...list.map((c, i) =>
        el(
          'button',
          {
            type: 'button',
            class: 'tutCh' + (i === cur ? ' on' : ''),
            'aria-current': i === cur ? 'step' : 'false',
            onclick: () => go(i)
          },
          el('span', { class: 'tutN' }, String(i + 1)),
          c[1]
        )
      )
    );
    const [, title, why, dev, app, acts] = list[cur];
    body.replaceChildren(
      ...[
        el('h3', {}, title),
        el('p', { class: 'tutWhy' }, why),
        el('div', { class: 'tutCols' }, part('On the ' + dn, dev), part('In the app', app)),
        acts.length
          ? el(
              'div',
              { class: 'tutActs' },
              ...acts.map(([label, fn]) =>
                el('button', { type: 'button', class: 'btn', onclick: () => (close(), fn()) }, label)
              )
            )
          : null,
        el(
          'div',
          { class: 'tutFoot' },
          el('button', { type: 'button', class: 'btn', disabled: cur === 0, onclick: () => go(cur - 1) }, '‹ Back'),
          el('span', { class: 'hint' }, cur + 1 + ' of ' + list.length),
          cur < list.length - 1
            ? el(
                'button',
                { type: 'button', class: 'btn on', onclick: () => go(cur + 1) },
                'Next: ' + list[cur + 1][1] + ' ›'
              )
            : el('button', { type: 'button', class: 'btn on', onclick: close }, 'Done')
        )
      ].filter(Boolean)
    );
    body.scrollTop = 0;
  }
  const ov = el(
    'div',
    {
      id: 'tutOv',
      class: 'ptOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Tutorial',
      onclick: e => e.target === ov && close(),
      onkeydown: e => {
        if (e.key === 'Escape') (e.stopPropagation(), close());
        else if (e.key === 'ArrowRight' && e.target.tagName !== 'INPUT') go(cur + 1);
        else if (e.key === 'ArrowLeft' && e.target.tagName !== 'INPUT') go(cur - 1);
      }
    },
    el(
      'div',
      { class: 'ptBox tutBox' },
      el(
        'div',
        { class: 'cmHead' },
        el('h3', {}, 'Tutorial: setting up'),
        el('button', { type: 'button', class: 'btn sm on', onclick: close }, 'Close')
      ),
      el('div', { class: 'tutMain' }, nav, body)
    )
  );
  document.body.append(ov);
  draw();
  body.focus();
}
