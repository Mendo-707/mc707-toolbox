// The top menu bar (File, Edit, Song, Audio, Settings, View, Help), and wiring the setup wizard's
// buttons.
//
// Reads: S, SU, STAGE, DEV.
import { $, el, toast } from '../core/dom.js';
import { DEV, oneKit } from '../core/device.js';
import { HOST, S, scheduleSave } from '../core/state.js';
import { STAGE, isFull, setAwake, toggleFull } from './fullscreen.js';
import { clipMapOpen } from '../clips/clips-screen.js';
import { setDevice, setOneKit } from './device.js';
import { closePops } from './controls.js';
import { SU, closeSetup, openSetup } from './setup-wizard.js';
import { liveStopCue } from '../live/cues.js';
import { startOpen } from './start-screen.js';
import { trackSetupOpen } from './track-setup.js';
import { liveGenrePick } from '../live/genre-picker.js';
import { grabOpen } from './grabber.js';
import { liveCapture } from './live-capture.js';
import { setMode } from './mode.js';
import {
  exitApp,
  projChooseFolder,
  projFolder,
  projNew,
  projOpen,
  projOpenPath,
  projRecents,
  projSave,
  projSaveAs
} from './projects.js';

/* App sounds: the app's own sound in this browser (the preview synth and drums), on or off. The same setting
   as the "Preview sound" boxes in MIDI and sound and in Live Mode. */
function toggleAppSound() {
  S.preview = !S.preview;
  ['#cPrev', '#lvPrev'].forEach(id => {
    const b = $(id);
    if (b) b.checked = S.preview;
  });
  scheduleSave();
  toast(S.preview ? 'App sounds on: you hear the app in this browser too' : 'App sounds off: only the MC-707 plays');
}
/* ---------- menu bar ---------- */
function initMenubar() {
  const nav = $('#menubar');
  if (!nav) return;
  const go = id => () => {
    const e = $(id);
    if (e) e.click();
  };
  const on = id => () => {
    const e = $(id);
    return !!(e && e.classList.contains('on'));
  };
  const M = [
    [
      'File',
      '',
      [
        ['New project', projNew, 'Ctrl+N'],
        ['Open project…', projOpen, 'Ctrl+O'],
        'recent',
        ['Save', projSave, 'Ctrl+S'],
        ['Save as…', projSaveAs, 'Ctrl+Shift+S'],
        0,
        ['Saved songs (quick slots)…', go('#bFile')],
        ['Start screen…', () => startOpen('menu')],
        ['Load demo song', go('#fDemo')],
        ['Export MIDI (.zip)', go('#fMidi')],
        0,
        ['Open project folder', () => projFolder('projects')],
        ['Open recording folder', () => projFolder('recordings')],
        ['Choose project folder…', () => projChooseFolder('projects')],
        ['Choose recording folder…', () => projChooseFolder('recordings')],
        0,
        ['Reset autosave and reload', go('#fReset')],
        0,
        ['Exit', exitApp]
      ]
    ],
    [
      'Edit',
      'song',
      [
        ['New pattern or load MIDI…', go('#bNewPat')],
        0,
        ['Undo', go('#bUndo'), 'Ctrl+Z'],
        ['Redo', go('#bRedo'), 'Ctrl+Shift+Z'],
        0,
        ['Transpose…', go('#bXpose')],
        ['Structure tools…', go('#bStruct')],
        0,
        ['Add 8 bars to the end', go('#bAddBars')]
      ]
    ],
    [
      'Song',
      'song',
      [
        ['Song wizard…', go('#bWiz')],
        ['Transpose…', go('#bXpose')],
        ['Structure tools…', go('#bStruct')],
        0,
        ['Loop the whole song', go('#bLoopAll')],
        ['Loop the selected clip', go('#bLoopClip'), '\\'],
        ['Tap tempo', go('#bTap')]
      ]
    ],
    [
      'Audio',
      'song',
      [
        ['Record audio', go('#bAudRec'), 'R'],
        ['Audio inputs and settings…', go('#bAudSet')]
      ]
    ],
    [
      'Live',
      'live',
      [
        ['Start / stop', go('#lvStart'), 'Space'],
        ['Stop at end of phrase', () => liveStopCue()],
        0,
        ['Fullscreen', toggleFull, 'F11', isFull],
        ['Keep the screen awake while playing', () => setAwake(!STAGE.awake), '', () => STAGE.awake],
        0,
        ['Connect MC-707', go('#lvMidi')],
        ['New patterns', go('#lvNew')],
        ['Pick a genre…', () => liveGenrePick()],
        0,
        ['Grab a sample…', () => grabOpen($('.mb.open') || $('#lvStart'))],
        ['Capture to Song', () => liveCapture()],
        ['Your MC-707 clips…', () => clipMapOpen()],
        ['Settings and mapping…', go('#lvPadSet')]
      ]
    ],
    [
      'Settings',
      '',
      [
        ['App sounds (hear the app in this browser)', toggleAppSound, '', () => !!S.preview],
        0,
        ['Device: MC-707 (8 tracks)', () => setDevice('707'), '', () => DEV === '707'],
        ['Device: MC-101 (4 tracks)', () => setDevice('101'), '', () => DEV === '101'],
        ['Track setup…', () => trackSetupOpen()],
        ['Drums on one track (full kits)', () => setOneKit(!S.oneKit), '', () => oneKit()],
        ['Your MC-707 clips…', () => clipMapOpen()],
        0,
        ['Quick setup…', go('#bSetup')],
        ['MIDI and sound…', go('#bMidi')],
        ['Track MIDI controls…', go('#bTrackCtl')],
        ['Audio inputs…', go('#bAudSet')],
        0,
        ['Send test note', go('#bTest')],
        ['All notes off', go('#bPanic')]
      ]
    ],
    [
      'View',
      'song',
      [
        ['Fullscreen', toggleFull, 'F11', isFull],
        ['Keep the screen awake while playing', () => setAwake(!STAGE.awake), '', () => STAGE.awake],
        0,
        ['Pattern library', go('#bLibT')],
        ['Follow the playhead', go('#bFollow'), '', on('#bFollow')],
        ['Metronome click', go('#bMetro'), '', on('#bMetro')]
      ]
    ],
    ['Help', '', [['Shortcuts and tips', go('#bHelp')]]]
  ];
  let openB = null;
  const closeAll = () => {
    nav.querySelectorAll('.mdrop').forEach(d => (d.hidden = true));
    nav.querySelectorAll('.mb').forEach(b => {
      b.classList.remove('open');
      b.setAttribute('aria-expanded', 'false');
    });
    openB = null;
  };
  const show = (b, d) => {
    closeAll();
    d.hidden = false;
    b.classList.add('open');
    b.setAttribute('aria-expanded', 'true');
    openB = b;
    d.style.left = b.offsetLeft + 'px';
    d.querySelectorAll('.mi[data-chk]').forEach(m => {
      const f = m._chk;
      m.firstChild.textContent = (f && f() ? '✔ ' : '') + m.dataset.label;
    });
    if (d._recent) {
      d._recent.textContent = '';
      const rl = HOST ? projRecents() : [];
      if (rl.length) {
        d._recent.append(
          el('div', { class: 'msep' }),
          el('div', { class: 'hint', style: 'padding:2px 10px' }, 'Recent')
        );
        rl.forEach(r =>
          d._recent.append(
            el(
              'button',
              {
                class: 'mi',
                role: 'menuitem',
                title: r.path,
                onclick: ev => {
                  ev.stopPropagation();
                  closeAll();
                  projOpenPath(r.path);
                }
              },
              el('span', {}, r.name),
              el('small', {}, '')
            )
          )
        );
        d._recent.append(el('div', { class: 'msep' }));
      }
    }
  };
  nav.append(el('span', { class: 'mbrand' }, 'MC-707 Toolbox'));
  M.forEach(([name, modes, items]) => {
    const b = el('button', { class: 'mb', role: 'menuitem', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, name);
    const d = el('div', { class: 'mdrop', role: 'menu', hidden: true });
    if (modes) {
      b.dataset.m = modes;
      d.dataset.m = modes;
    }
    items.forEach(it => {
      if (!it) {
        d.append(el('div', { class: 'msep' }));
        return;
      }
      if (it === 'recent') {
        d._recent = el('div', {});
        d.append(d._recent);
        return;
      }
      const [label, fn, key, chk] = it;
      const mi = el(
        'button',
        {
          class: 'mi',
          role: 'menuitem',
          onclick: ev => {
            ev.stopPropagation();
            closeAll();
            try {
              fn();
            } catch (e) {}
          }
        },
        el('span', {}, label),
        el('small', {}, key || '')
      );
      if (chk) {
        mi.dataset.chk = '1';
        mi.dataset.label = label;
        mi._chk = chk;
      }
      d.append(mi);
    });
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      closePops();
      if (openB === b) closeAll();
      else show(b, d);
    });
    b.addEventListener('mouseenter', () => {
      if (openB && openB !== b) show(b, d);
    });
    nav.append(b, d);
  });
  const tabs = el('div', { class: 'mtabs', role: 'tablist', 'aria-label': 'Mode' });
  [
    ['song', 'Song Mode'],
    ['live', 'Live Mode']
  ].forEach(([m, l]) =>
    tabs.append(
      el(
        'button',
        {
          class: 'mtab' + (document.body.dataset.mode === m ? ' on' : ''),
          role: 'tab',
          'data-mode': m,
          'aria-selected': String(document.body.dataset.mode === m),
          onclick: () => setMode(m)
        },
        l
      )
    )
  );
  nav.append(el('span', { class: 'mproj', 'data-m': 'song', id: 'mProj' }, 'Untitled'), tabs);
  document.addEventListener(
    'pointerdown',
    e => {
      if (openB && !e.target.closest('#menubar')) closeAll();
    },
    true
  );
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && openB) closeAll();
  });
  addEventListener('blur', closeAll);
}
export function initSetup() {
  initMenubar();
  $('#bSetup').addEventListener('click', openSetup);
  $('#bSetupFromMidi').addEventListener('click', openSetup);
  $('#setup').addEventListener('pointerdown', e => {
    if (e.target.id === 'setup') closeSetup();
  });
  if (S.midiIn) SU.pendingIn = S.midiIn;
}
