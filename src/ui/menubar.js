// The top menu bar (File, Edit, Song, Scene, Live, Synth, Settings, View, Help, each shown in the modes it
// belongs to), and wiring the setup wizard's buttons.
//
// Reads: S, SU, STAGE, DEV.
import { songMixerOpen } from '../song/song-mixer.js';
import { liveMixerOpen } from '../live/live-mixer.js';
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
import { showMenu } from './menu.js';
import { aboutOpen } from './about.js';
import { LINKS, openLink } from '../core/version.js';
import { synthAct } from '../zen/zc-synth.js';
import { songToClipsOpen } from '../zen/zc-seq.js';
import { sceneFinderOpen } from '../zen/zc-scan.js';
import { motionTestOpen } from '../zen/zc-motion.js';
import { templatesOpen } from './templates.js';
import { sceneToggle } from '../scene/screen.js';
import { addRow, rows } from '../scene/model.js';
import { scenesFromSong, scenesToSong } from '../scene/convert.js';
import { WO, setWO, writeAll, writeChanged } from '../scene/write.js';
import { checkNew } from '../scene/check.js';
import { THEMES, setTheme, themeNow } from '../core/theme.js';
import { sceneGuideOpen } from '../scene/guide.js';
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
  /* [label, action, shortcut, checked()] items; [label, null, '', null, sub] opens a submenu (right-click
     menu items); 0 is a divider; 'recent' is the recent projects list */
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
        ['Start screen…', () => startOpen('menu')],
        ['Saved songs (quick slots)…', go('#bFile')],
        ['Load demo song', go('#fDemo')],
        ['Export MIDI (.zip)', go('#fMidi')],
        0,
        [
          'Folders',
          null,
          '',
          null,
          () => [
            { label: 'Open project folder', action: () => projFolder('projects') },
            { label: 'Open recording folder', action: () => projFolder('recordings') },
            '-',
            { label: 'Choose project folder…', action: () => projChooseFolder('projects') },
            { label: 'Choose recording folder…', action: () => projChooseFolder('recordings') }
          ]
        ],
        0,
        ['Exit', exitApp]
      ]
    ],
    [
      'Edit',
      'song',
      [
        ['Undo', go('#bUndo'), 'Ctrl+Z'],
        ['Redo', go('#bRedo'), 'Ctrl+Shift+Z'],
        0,
        ['New pattern or load MIDI…', go('#bNewPat')],
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
        ['Tap tempo', go('#bTap')],
        ['Mixer…', () => songMixerOpen()],
        ['Send patterns to MC-707 clips…', () => songToClipsOpen()],
        ['Send song to MC-707 scenes…', () => songToClipsOpen(true)],
        ['Arrange it in Scene Mode', () => (setMode('scene'), scenesFromSong())],
        0,
        ['Record audio', go('#bAudRec'), 'R'],
        ['Audio inputs and settings…', go('#bAudSet')]
      ]
    ],
    [
      'Scene',
      'scene',
      [
        ['Play / stop', () => sceneToggle(), 'Space'],
        0,
        ['Add a scene', () => addRow(rows().length ? rows().length - 1 : null)],
        ['Make scenes and clips from the song…', () => scenesFromSong()],
        ['Lay the scenes out in Song Mode…', () => scenesToSong()],
        0,
        ['Write what changed', () => writeChanged()],
        ['Write everything', () => writeAll()],
        ['Write the clips only', () => writeAll('clips')],
        ['Write the scenes only', () => writeAll('scenes')],
        ['Auto-write changes', () => setWO('auto', !WO.auto), '', () => WO.auto],
        0,
        ['Check the new clips on the MC-707', () => checkNew()],
        ['How it plays on the MC-707…', () => sceneGuideOpen()]
      ]
    ],
    [
      'Live',
      'live',
      [
        ['Start / stop', go('#lvStart'), 'Space'],
        ['Stop at end of phrase', () => liveStopCue()],
        0,
        ['New patterns', go('#lvNew')],
        ['Pick a genre…', () => liveGenrePick()],
        0,
        ['Grab a sample…', () => grabOpen($('.mb.open') || $('#lvStart'))],
        ['Capture to Song', () => liveCapture()],
        ['Mixer…', () => liveMixerOpen()],
        ['Your MC-707 clips…', () => clipMapOpen()],
        0,
        ['Connect MC-707', go('#lvMidi')],
        ['Settings and mapping…', go('#lvPadSet')]
      ]
    ],
    [
      'Synth',
      'synth',
      [
        ['Read sounds', () => synthAct('read')],
        0,
        ['Save setup to a file…', () => synthAct('save')],
        ['Open a setup file…', () => synthAct('open')],
        ['Keep setup in this browser…', () => synthAct('keep')],
        0,
        ['Panic (all notes off)', () => synthAct('panic')],
        ['Setting up your DAW', () => synthAct('help')]
      ]
    ],
    [
      'Settings',
      '',
      [
        [
          'Device',
          null,
          '',
          null,
          () => [
            { label: 'MC-707 (8 tracks)', checked: DEV === '707', action: () => setDevice('707') },
            { label: 'MC-101 (4 tracks)', checked: DEV === '101', action: () => setDevice('101') }
          ]
        ],
        ['Track setup…', () => trackSetupOpen()],
        ['Drums on one track (full kits)', () => setOneKit(!S.oneKit), '', () => oneKit()],
        ['Your MC-707 clips…', () => clipMapOpen()],
        0,
        ['Quick setup…', go('#bSetup')],
        ['MIDI and sound…', go('#bMidi')],
        ['Track MIDI controls…', go('#bTrackCtl')],
        ['Audio inputs…', go('#bAudSet')],
        ['App sounds (hear the app in this browser)', toggleAppSound, '', () => !!S.preview],
        0,
        [
          'Theme',
          null,
          '',
          null,
          () => THEMES.map(([v, label]) => ({ label, checked: themeNow() === v, action: () => setTheme(v) }))
        ]
      ]
    ],
    [
      'View',
      '',
      [
        ['Fullscreen', toggleFull, 'F11', isFull],
        ['Keep the screen awake while playing', () => setAwake(!STAGE.awake), '', () => STAGE.awake],
        0,
        ['Pattern library', go('#bLibT'), '', null, null, 'song'],
        ['Follow the playhead', go('#bFollow'), '', on('#bFollow'), null, 'song'],
        ['Metronome click', go('#bMetro'), '', on('#bMetro'), null, 'song']
      ]
    ],
    [
      'Help',
      '',
      [
        ['Shortcuts and tips', go('#bHelp'), '', null, null, 'song'],
        ['Guide', () => openLink(LINKS.guide)],
        ['Set up your MC-707…', go('#bSetup')],
        ['MC-707 project templates…', () => templatesOpen()],
        0,
        [
          'For developers',
          null,
          '',
          null,
          () => [
            { label: 'MC-707 SysEx guide', action: () => openLink(LINKS.sysex) },
            { label: 'ZenCore parameter reference', action: () => openLink(LINKS.params) },
            { label: 'Diagnostics page', action: () => openLink(LINKS.diagnostics) },
            { label: 'Find MC-707 scene data (read-only scan)…', action: () => sceneFinderOpen() },
            { label: 'Motion test (which lane moves what)…', action: () => motionTestOpen() }
          ]
        ],
        [
          'Troubleshooting',
          null,
          '',
          null,
          () => [
            { label: 'Send test note', action: go('#bTest') },
            { label: 'All notes off', action: go('#bPanic') },
            '-',
            { label: 'Reset autosave and reload…', danger: true, action: go('#fReset') }
          ]
        ],
        0,
        ['Check for updates', () => openLink(LINKS.releases)],
        ['Report a problem', () => openLink(LINKS.issues)],
        ['About MC-707 Toolbox', () => aboutOpen()]
      ]
    ]
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
      const [label, fn, key, chk, sub, onlyMode] = it;
      const mi = el(
        'button',
        {
          class: 'mi' + (sub ? ' msub' : ''),
          role: 'menuitem',
          'aria-haspopup': sub ? 'true' : null,
          onclick: ev => {
            ev.stopPropagation();
            if (sub) {
              /* a submenu opens beside the item, as a right-click menu */
              const r = mi.getBoundingClientRect();
              showMenu(r.right - 4, r.top - 4, sub());
              return;
            }
            closeAll();
            try {
              fn();
            } catch (e) {}
          }
        },
        el('span', {}, label),
        el('small', {}, sub ? '▸' : key || '')
      );
      if (onlyMode) mi.dataset.m = onlyMode;
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
    ['song', 'Song Mode', 'Arrange a song on a timeline; the app plays the MC-707 note for note'],
    ['scene', 'Scene Mode', 'Arrange in MC-707 scenes and send them, so the MC-707 plays the song by itself'],
    ['live', 'Live Mode', 'Perform a looping set from 16 pads'],
    ['synth', 'Synth Mode', 'The MC-707 as an 8-track synth for your DAW']
  ].forEach(([m, l, tip]) =>
    tabs.append(
      el(
        'button',
        {
          class: 'mtab' + (document.body.dataset.mode === m ? ' on' : ''),
          role: 'tab',
          'data-mode': m,
          'aria-selected': String(document.body.dataset.mode === m),
          title: tip,
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
