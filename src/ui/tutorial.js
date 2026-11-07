// The tutorials: Basic setup (getting connected, the tracks), then one for each mode (Song, Scene, Live,
// Synth, the ZenCore editor and the Slime Lab), each on its own, from a page that lists them all. A tutorial
// goes page by page: what to do on the MC-707 (or MC-101), then what to do in the app, with buttons that open
// the place it talks about. Tick each step as you do it (each tutorial shows how far you are); Show me goes
// to the place a step talks about and points at it. From the start screen's foot, and Help (Basic setup, the
// mode you are in, or all of them).
//
// Owns: localStorage 'mc707-tutorial-done' (the steps ticked).
import { $, el } from '../core/dom.js';
import { DEV, DEVS } from '../core/device.js';
import { openSetup } from './setup-wizard.js';
import { trackSetupOpen } from './track-setup.js';
import { templatesOpen } from './templates.js';
import { setMode } from './mode.js';

const DONE = 'mc707-tutorial-done';
let done = new Set();
try {
  done = new Set(JSON.parse(localStorage.getItem(DONE) || '[]'));
} catch (e) {}
const saveDone = () => {
  try {
    localStorage.setItem(DONE, JSON.stringify([...done]));
  } catch (e) {}
};
/* a step: its text and, for some, where Show me points ({mode, sel} or {mode, text}: a button's words) */
const stepOf = x => (Array.isArray(x) ? { text: x[0], show: x[1] } : { text: x, show: null });
const stepKeys = c => [...c[3].map((_, i) => c[0] + ':d' + i), ...c[4].map((_, i) => c[0] + ':a' + i)];

/* Show me: to the step's mode, then a ring round the thing it talks about, and a way back */
function showMe(spec, back) {
  if (spec.mode && document.body.dataset.mode !== spec.mode) setMode(spec.mode);
  setTimeout(() => {
    /* a target inside a folded panel: unfold it first */
    const raw = spec.sel ? $(spec.sel) : null;
    for (let d = raw && raw.closest('details'); d; d = d.parentElement && d.parentElement.closest('details'))
      d.open = true;
    const t = spec.sel
      ? raw
      : [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.trim().includes(spec.text));
    $('#tutSpot')?.remove();
    if (!t || !t.offsetParent) return back();
    t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = t.getBoundingClientRect();
    const spot = el(
      'div',
      { id: 'tutSpot', 'aria-live': 'polite' },
      el('div', {
        class: 'tutRing',
        style: `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px`
      }),
      el(
        'button',
        {
          type: 'button',
          class: 'btn on tutBack',
          style: `left:${Math.min(innerWidth - 220, Math.max(8, r.left))}px;top:${r.bottom + 14 > innerHeight - 50 ? r.top - 48 : r.bottom + 14}px`,
          onclick: () => (spot.remove(), back())
        },
        '‹ Back to the tutorial'
      )
    );
    document.body.append(spot);
    /* the ring goes with the next click anywhere else, or after a while */
    const away = e => {
      if (e.target.closest && e.target.closest('.tutBack')) return;
      spot.remove();
      removeEventListener('pointerdown', away, true);
    };
    setTimeout(() => addEventListener('pointerdown', away, true), 50);
    setTimeout(() => spot.remove(), 9000);
  }, 250);
}
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
      'The app connects by itself as it opens or when the ' +
        dn +
        ' is plugged in, and says so. If it doesn’t: MC-707 › Set up your MC-707 › Auto-connect MC-707.',
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
      'Sound Source: CLIP on every track. Hold SHIFT and press the track’s TRACK SEL, open the GENERAL tab and set Sound Source to CLIP, so each clip keeps its own sound. Then select each clip and give it a sound (a new clip can be silent until you do). Scene Mode, the clip switching and MC-707 project files all count on it.',
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
      [
        'Drag patterns from the library onto the tracks, or + New blank pattern at the top of the library; click a clip to edit it in the step grid or piano roll.',
        { mode: 'song', sel: '#libNew' }
      ],
      'Tick Make the MC-707 follow this app (MC-707 › Set up your MC-707) to send clock and start/stop with Play.',
      ['Space plays. Record audio, or File › Export MIDI, when it’s done.', { mode: 'song', sel: '#bPlay' }]
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
      'A clip silent? With Sound Source on CLIP (as Basic setup has it) each clip plays its own sound: select the clip and choose one, or give it a tone in Scene Mode and write it.'
    ],
    [
      'Start from a project template that matches your Track setup, written under a new name: use a project you can lose the first time.',
      [
        'Make them from the song, or fill the clips board yourself: click an empty clip to choose its pattern.',
        { mode: 'scene', text: 'Make them from the song' }
      ],
      'Add scenes to the chain: each plays a clip per track for so many bars.',
      'Write sends what changed (✓ written · ● changed · + not written yet), or turn on Auto-write. ? How it works has the whole list.',
      'Or skip the cable: File › Save as MC-707 project (.mpj) makes a project file to copy onto the SD card and load on the ' +
        dn +
        ' (PROJECT › LOAD). The sounds are not in it yet: choose them there.'
    ],
    [['Go to Scene Mode', () => setMode('scene')]]
  ],
  [
    'live',
    'Live Mode',
    'Play a looping set from 16 pads: scenes, breaks, builds and drops that land on the beat.',
    [
      'For the pads: select a drum track, hold SHIFT and press its TRACK SEL, open the MIDI tab, and turn Tx MIDI Note and Tx USB MIDI ON. The pads then work while that track is selected.',
      'MIDI Sync: AUTO (or USB) if you want the ' + dn + ' to follow the set’s tempo.',
      'To record riffs on the ' +
        dn +
        '’s own keys (Loop rec): turn Tx MIDI Note and Tx USB MIDI ON for that melody track too, the same way as for the pads, and play above the C4–B5 keys Raven mode uses.'
    ],
    [
      'Pick a genre when Live Mode opens (Live › Pick a genre changes it).',
      [
        'Press ▶ Start Jam. Pads 1–7 are the scenes, pad 8 is Break; the bottom row swaps parts, fills, stutters and builds into a drop.',
        { mode: 'live', sel: '#lvStart' }
      ],
      [
        'Auto-pilot runs the set by itself; Variation and Chaos set how much it changes. 🎲 New patterns brings fresh parts in without stopping.',
        { mode: 'live', sel: '#lvAuto' }
      ],
      [
        'Loop rec: choose the track to record to, how long and the Quantize, then press ● Rec (it starts the jam if it’s stopped). Come in when the count-down reaches the start; the track goes quiet while you record and your notes appear as you play. The take then waits, with the set unchanged, until you press ▶ Play; ★ makes the scene keep it.',
        { mode: 'live', sel: '.riffPanel .riffBtn' }
      ],
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
      [
        'Read sounds shows each track’s sound; Expand a track to edit it beside the others.',
        { mode: 'synth', text: 'Read sounds' }
      ]
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
      [
        'Open MC-707 › Your MC-707 clips & ZenCore, pick a clip and press Edit ZenCore (or right-click a clip anywhere).',
        { mode: 'song', sel: '#bClips' }
      ],
      'With Live on, every change goes to the ' + dn + ' as you make it; play from the editor’s keyboard or the pads.',
      'Sounds opens the Sound browser: your sounds, starters, factory tones and expansions (Grab from › …).',
      'Slime Lab (in the editor’s header, tones): start from a sound, turn the five knobs, grow variations, then Fine-tune.'
    ],
    []
  ]
];

/*
 * The tutorials, from the chapters: Basic setup is Connect and Tracks, every other chapter a mode's tutorial.
 * Each chapter gives two pages, on the device then in the app (a side with no steps gives none).
 */
const tutorials = dn => {
  const ch = chapters(dn),
    pages = (c, prefix) =>
      [
        { c, side: 'd', title: (prefix ? c[1] + ': ' : '') + 'On the ' + dn, steps: c[3], why: c[2] },
        { c, side: 'a', title: (prefix ? c[1] + ': ' : '') + 'In the app', steps: c[4], acts: c[5] }
      ].filter(p => p.steps.length);
  const setup = ch.filter(c => c[0] === 'connect' || c[0] === 'tracks');
  return [
    {
      id: 'setup',
      title: 'Basic setup',
      blurb: 'Do this first: connect the ' + dn + ' and match its tracks to the app’s. Every mode needs it.',
      pages: setup.flatMap(c => pages(c, true)),
      keys: setup.flatMap(stepKeys)
    },
    ...ch
      .filter(c => !setup.includes(c))
      .map(c => ({ id: c[0], title: c[1], blurb: c[2], pages: pages(c, false), keys: stepKeys(c) }))
  ];
};
const doneOf = t => t.keys.filter(k => done.has(k)).length;

/**
 * Open the tutorials: at one ('setup', or a mode: 'song', 'scene', 'live', 'synth', 'zen'), at a page of
 * it, or at the list of them all.
 */
export function tutorialOpen(at, page = 0) {
  if ($('#tutOv')) return;
  const dn = DEVS[DEV].name,
    list = tutorials(dn);
  let tut = list.find(t => t.id === at) || null,
    cur = page;
  const close = () => ov.remove();
  const head = el('div', { class: 'cmHead' }),
    body = el('div', { class: 'tutBody', tabindex: '-1' });
  const open = (t, p = 0) => {
    tut = t;
    cur = Math.max(0, Math.min(t ? t.pages.length - 1 : 0, p));
    draw();
  };
  const bar = t => {
    const n = doneOf(t);
    return el(
      'div',
      { class: 'tutProg', title: n + ' of ' + t.keys.length + ' steps done' },
      el('i', { style: 'width:' + Math.round((n / t.keys.length) * 100) + '%' }),
      el('span', {}, n === t.keys.length ? '✓ Done' : n + ' of ' + t.keys.length + ' steps')
    );
  };
  const closeBtn = () => el('button', { type: 'button', class: 'btn sm on', onclick: close }, 'Close');
  const stepList = pg =>
    el(
      'ol',
      { class: 'tutSteps' },
      ...pg.steps.map((x, i) => {
        const st = stepOf(x),
          k = pg.c[0] + ':' + pg.side + i;
        return el(
          'li',
          { class: done.has(k) ? 'did' : '' },
          el(
            'label',
            { class: 'tutStep' },
            el('input', {
              type: 'checkbox',
              checked: done.has(k),
              'aria-label': 'Done',
              onchange: e => {
                if (e.target.checked) done.add(k);
                else done.delete(k);
                saveDone();
                draw(true);
              }
            }),
            el('span', {}, st.text)
          ),
          st.show
            ? el(
                'button',
                {
                  type: 'button',
                  class: 'tutShow',
                  onclick: () => {
                    const id = tut.id,
                      p = cur;
                    close();
                    showMe(st.show, () => tutorialOpen(id, p));
                  }
                },
                'Show me ›'
              )
            : null
        );
      })
    );

  /* the list of tutorials */
  function drawHub() {
    head.replaceChildren(el('h3', {}, 'Tutorials'), closeBtn());
    const [setup, ...modes] = list;
    const card = (t, big) =>
      el(
        'button',
        {
          type: 'button',
          class: 'tutCard' + (big ? ' big' : '') + (doneOf(t) === t.keys.length ? ' ok' : ''),
          onclick: () => open(t)
        },
        el('b', {}, t.title),
        el('span', { class: 'tutBlurb' }, t.blurb),
        bar(t)
      );
    body.replaceChildren(
      el(
        'p',
        { class: 'tutWhy' },
        'Short guides to what to set on the ' +
          dn +
          ' and in the app. Start with Basic setup, then the mode you want to use.'
      ),
      card(setup, true),
      el('h4', { class: 'tutSub' }, 'Each mode'),
      el('div', { class: 'tutCards' }, ...modes.map(t => card(t)))
    );
  }
  /* one tutorial, at a page */
  function drawTut() {
    const pg = tut.pages[cur],
      last = cur === tut.pages.length - 1,
      setupLeft = tut.id !== 'setup' && doneOf(list[0]) < list[0].keys.length;
    head.replaceChildren(
      el('button', { type: 'button', class: 'btn sm', onclick: () => open(null) }, '‹ All tutorials'),
      el('h3', {}, tut.title),
      bar(tut),
      closeBtn()
    );
    body.replaceChildren(
      ...[
        tut.pages.length > 1
          ? el(
              'nav',
              { class: 'tutPages', 'aria-label': 'Pages' },
              ...tut.pages.map((p, i) =>
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'tutPg' + (i === cur ? ' on' : ''),
                    'aria-current': i === cur ? 'step' : 'false',
                    onclick: () => open(tut, i)
                  },
                  el(
                    'span',
                    { class: 'tutN' + (p.steps.every((_, j) => done.has(p.c[0] + ':' + p.side + j)) ? ' ok' : '') },
                    p.steps.every((_, j) => done.has(p.c[0] + ':' + p.side + j)) ? '✓' : String(i + 1)
                  ),
                  p.title
                )
              )
            )
          : null,
        setupLeft && cur === 0
          ? el(
              'p',
              { class: 'tutNote' },
              'Haven’t done Basic setup yet? ',
              el('button', { type: 'button', class: 'tutShow', onclick: () => open(list[0]) }, 'Start there ›')
            )
          : null,
        el('h4', { class: 'tutSub' }, pg.title),
        pg.why ? el('p', { class: 'tutWhy' }, pg.why) : null,
        stepList(pg),
        pg.acts && pg.acts.length
          ? el(
              'div',
              { class: 'tutActs' },
              ...pg.acts.map(([label, fn]) =>
                el('button', { type: 'button', class: 'btn', onclick: () => (close(), fn()) }, label)
              )
            )
          : null,
        el(
          'div',
          { class: 'tutFoot' },
          el(
            'button',
            { type: 'button', class: 'btn', disabled: cur === 0, onclick: () => open(tut, cur - 1) },
            '‹ Back'
          ),
          el('span', { class: 'hint' }, 'Page ' + (cur + 1) + ' of ' + tut.pages.length),
          !last
            ? el(
                'button',
                { type: 'button', class: 'btn on', onclick: () => open(tut, cur + 1) },
                'Next: ' + tut.pages[cur + 1].title + ' ›'
              )
            : tut.id === 'setup'
              ? el('button', { type: 'button', class: 'btn on', onclick: () => open(null) }, 'Done: pick a mode ›')
              : el('button', { type: 'button', class: 'btn on', onclick: () => open(null) }, 'Done ›')
        )
      ].filter(Boolean)
    );
  }
  function draw(keepScroll) {
    const top = body.scrollTop;
    ov.querySelector('.tutBox').classList.toggle('hub', !tut);
    if (tut) drawTut();
    else drawHub();
    body.scrollTop = keepScroll ? top : 0;
  }
  const ov = el(
    'div',
    {
      id: 'tutOv',
      class: 'ptOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Tutorials',
      onclick: e => e.target === ov && close(),
      onkeydown: e => {
        const typing = e.target.tagName === 'INPUT';
        if (e.key === 'Escape') (e.stopPropagation(), close());
        else if (!tut || typing) return;
        else if (e.key === 'ArrowRight') open(tut, cur + 1);
        else if (e.key === 'ArrowLeft') open(tut, cur - 1);
        else if (/^[1-9]$/.test(e.key)) open(tut, +e.key - 1);
      }
    },
    el('div', { class: 'ptBox tutBox' }, head, body)
  );
  document.body.append(ov);
  draw();
  body.focus();
}
