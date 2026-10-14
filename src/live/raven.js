import { el, toast } from '../core/dom.js';
import { TRACK_COLORS } from '../core/device.js';
import { S } from '../core/state.js';
import { LV, NOTEN, noteLbl, saveLive } from './state.js';
import { ctlAllOff, liveRenderCtlBar } from './controller.js';
import { liveRenderPerf } from './panels.js';
import { liveRenderSettings } from './settings-panel.js';

/* Raven presets: whole ways of playing, set in one tap */
const RV_PRESETS = [
  [
    'classic',
    'Classic Raven',
    "Mutes toggle on the beat. Key keys move relative to the set's key and latch on the bar. Solo plays Lead in key.",
    {
      muteMode: 'toggle',
      muteWhen: 'beat',
      trMode: 'rel',
      trHold: false,
      trWhen: 'bar',
      zones: 'raven',
      soloT: 6,
      soloOct: 0,
      soloSnap: true,
      modWheel: 'filter'
    }
  ],
  [
    'muteb',
    'Raven Mute B',
    'Hold a mute key to cut a track, let go and it is straight back. Key changes spring back on release.',
    {
      muteMode: 'hold',
      muteWhen: 'now',
      trMode: 'rel',
      trHold: true,
      trWhen: 'beat',
      zones: 'raven',
      soloT: 6,
      soloOct: 0,
      soloSnap: true,
      modWheel: 'filter'
    }
  ],
  [
    'dj',
    'DJ cuts',
    'Tap to cut and bring back parts, landing on the next beat. Keys are absolute (C = C) and wait for the bar. No solo.',
    {
      muteMode: 'toggle',
      muteWhen: 'beat',
      trMode: 'abs',
      trHold: false,
      trWhen: 'bar',
      zones: 'raven',
      soloT: -1,
      soloOct: 0,
      soloSnap: false,
      modWheel: 'filter'
    }
  ],
  [
    'jockey',
    'Key jockey',
    'Hold key keys to throw the whole set up or down like a transposer, instantly. It springs home when you let go.',
    {
      muteMode: 'toggle',
      muteWhen: 'bar',
      trMode: 'rel',
      trHold: true,
      trWhen: 'now',
      zones: 'raven',
      soloT: 6,
      soloOct: 0,
      soloSnap: true,
      modWheel: 'filter'
    }
  ],
  [
    'drop',
    'Drop builder',
    'Mutes wait for the bar, so you can stack cuts before a drop and bring everything in together. Mod wheel opens the filter.',
    {
      muteMode: 'toggle',
      muteWhen: 'bar',
      trMode: 'rel',
      trHold: false,
      trWhen: 'bar',
      zones: 'raven',
      soloT: 6,
      soloOct: 0,
      soloSnap: true,
      modWheel: 'filter'
    }
  ],
  [
    'lead',
    'Lead player',
    'Mutes and keys at the bottom, the rest plays a Lead solo an octave up, kept in key. Mod wheel adds vibrato.',
    {
      muteMode: 'toggle',
      muteWhen: 'beat',
      trMode: 'rel',
      trHold: false,
      trWhen: 'bar',
      zones: 'raven',
      soloT: 6,
      soloOct: 1,
      soloSnap: true,
      modWheel: 'mod'
    }
  ],
  [
    'bass',
    'Bass player',
    "Mutes and keys at the bottom, the rest plays Bass an octave down in key. Mute the app's bassline and play your own.",
    {
      muteMode: 'toggle',
      muteWhen: 'beat',
      trMode: 'rel',
      trHold: false,
      trWhen: 'bar',
      zones: 'raven',
      soloT: 3,
      soloOct: -1,
      soloSnap: true,
      modWheel: 'filter'
    }
  ],
  [
    'jam',
    'Chord jam',
    'Key keys at the bottom, every other key plays Chords in key. No mute keys on the controller (the MC-707 keys still mute).',
    {
      muteMode: 'toggle',
      muteWhen: 'beat',
      trMode: 'rel',
      trHold: false,
      trWhen: 'bar',
      zones: 'keysolo',
      soloT: 4,
      soloOct: 0,
      soloSnap: true,
      modWheel: 'mod'
    }
  ]
];
const RV_KEYS = [
  'muteMode',
  'muteWhen',
  'trMode',
  'trHold',
  'trWhen',
  'zones',
  'soloT',
  'soloOct',
  'soloSnap',
  'modWheel'
];
const rvActive = () => {
  const c = LV.ctl;
  return (RV_PRESETS.find(p => RV_KEYS.every(k => String(p[3][k]) === String(c[k]))) || [])[0] || null;
};
function rvUse(id) {
  const p = RV_PRESETS.find(x => x[0] === id);
  if (!p) return;
  ctlAllOff();
  Object.assign(LV.ctl, p[3]);
  LV.perfOn = true;
  saveLive();
  liveRenderSettings();
  liveRenderPerf();
  liveRenderCtlBar();
  toast('Raven preset: ' + p[1]);
}
/* one octave of keys, labelled with what each does */
function rvOctave(base, kind) {
  const c = LV.ctl,
    wrap = el('div', { class: 'rvKb ' + kind }),
    blk = [1, 3, 6, 8, 10];
  let wx = 0;
  for (let i = 0; i < 12; i++) {
    const n = base + i,
      isB = blk.includes(n % 12);
    const lab =
      kind === 'mute'
        ? i < 8
          ? String(i + 1)
          : ['All', 'Fill', 'Drop', 'Brk'][i - 8]
        : c.trMode === 'rel'
          ? i === 0
            ? '0'
            : '+' + i
          : NOTEN[i];
    const tip =
      kind === 'mute'
        ? i < 8
          ? 'Mute ' + S.tracks[i].name
          : ['Unmute all', 'Fill', 'Build → Drop', 'Break'][i - 8]
        : c.trMode === 'rel'
          ? 'Key +' + i + " from the set's key"
          : 'Key of ' + NOTEN[i];
    wrap.append(
      el(
        'i',
        {
          class: 'rk ' + (isB ? 'b' : 'w') + (kind === 'mute' && i >= 8 ? ' fx' : ''),
          title: noteLbl(n) + ' · ' + tip,
          style:
            'left:' + (isB ? wx * 26 - 8 : wx * 26) + 'px' + (kind === 'mute' && i < 8 ? ';--c:' + TRACK_COLORS[i] : '')
        },
        el('span', {}, lab)
      )
    );
    if (!isB) wx++;
  }
  wrap.style.width = wx * 26 + 'px';
  return wrap;
}
export function ravenSection(chSel, noteIn) {
  const c = LV.ctl,
    act = rvActive(),
    wrap = el('div', { class: 'rvWrap' + (LV.perfOn ? '' : ' off') });
  const seg = (label, val, opts, on) =>
    el(
      'div',
      { class: 'rvSeg' },
      el('small', {}, label),
      el(
        'div',
        { class: 'segb' },
        ...opts.map(([v, l, t]) =>
          el(
            'button',
            {
              class: 'btn sm' + (String(val) === String(v) ? ' on' : ''),
              title: t || '',
              onclick: () => {
                on(v);
                saveLive();
                liveRenderSettings();
                liveRenderPerf();
                liveRenderCtlBar();
              }
            },
            l
          )
        )
      )
    );
  const when = [
    ['now', 'Now', 'Straight away'],
    ['beat', 'Beat', 'On the next beat'],
    ['bar', 'Bar', 'On the next bar']
  ];
  wrap.append(
    el(
      'div',
      { class: 'rvHead' },
      el(
        'div',
        {},
        el('h4', {}, 'Raven mode'),
        el(
          'p',
          { class: 'hint' },
          'Mute and key keys on the MC-707 (keyboard mode) and on a controller keyboard, like the Quasimidi Raven.'
        )
      ),
      el(
        'label',
        { class: 'rvSwitch' },
        el('input', {
          type: 'checkbox',
          checked: LV.perfOn,
          onchange: e => {
            LV.perfOn = e.target.checked;
            saveLive();
            liveRenderPerf();
            liveRenderSettings();
          }
        }),
        el('span', {}),
        LV.perfOn ? 'On' : 'Off'
      )
    ),
    el(
      'div',
      { class: 'rvPresets' },
      ...RV_PRESETS.map(([id, name, desc]) =>
        el(
          'button',
          { class: 'rvP' + (act === id ? ' on' : ''), onclick: () => rvUse(id) },
          el('b', {}, name),
          el('span', {}, desc)
        )
      )
    ),
    el(
      'div',
      { class: 'rvMaps' },
      el(
        'div',
        { class: 'rvMap' },
        el(
          'div',
          { class: 'rvMapH' },
          el('b', {}, 'Mute octave'),
          el('span', {}, 'MC-707 from'),
          noteIn(LV.muteBase, v => {
            LV.muteBase = v;
            saveLive();
            liveRenderPerf();
            liveRenderSettings();
          }),
          el('em', {}, noteLbl(LV.muteBase))
        ),
        rvOctave(LV.muteBase, 'mute')
      ),
      el(
        'div',
        { class: 'rvMap' },
        el(
          'div',
          { class: 'rvMapH' },
          el('b', {}, 'Key octave'),
          el('span', {}, 'MC-707 from'),
          noteIn(LV.keyBase, v => {
            LV.keyBase = v;
            saveLive();
            liveRenderPerf();
            liveRenderSettings();
          }),
          el('em', {}, noteLbl(LV.keyBase))
        ),
        rvOctave(LV.keyBase, 'key')
      )
    ),
    el(
      'div',
      { class: 'rvOpts' },
      el(
        'div',
        { class: 'rvCard' },
        el('b', {}, 'Mutes'),
        seg(
          'Mute keys',
          c.muteMode,
          [
            ['toggle', 'Toggle', 'Press to mute, again to unmute'],
            ['hold', 'Hold', 'Muted only while held (Raven Mute B)']
          ],
          v => {
            c.muteMode = v;
          }
        ),
        seg('They land', c.muteWhen, when, v => {
          c.muteWhen = v;
        })
      ),
      el(
        'div',
        { class: 'rvCard' },
        el('b', {}, 'Key changes'),
        seg(
          'Key keys',
          c.trMode,
          [
            ['rel', 'Relative', "C = the set's own key, C# = up 1 …"],
            ['abs', 'Absolute', 'C = key of C, D = key of D …']
          ],
          v => {
            c.trMode = v;
          }
        ),
        seg(
          'After release',
          c.trHold ? '1' : '',
          [
            ['', 'Latch', 'Stays until another key'],
            ['1', 'Spring back', "Back to the set's key on release"]
          ],
          v => {
            c.trHold = !!v;
          }
        ),
        seg('They land', c.trWhen, when, v => {
          c.trWhen = v;
        })
      ),
      el(
        'div',
        { class: 'rvCard' },
        el('b', {}, 'MC-707 keys'),
        el(
          'label',
          { class: 'gf' },
          'Channel',
          chSel(LV.keyCh, v => {
            LV.keyCh = v;
            saveLive();
          })
        ),
        el(
          'p',
          { class: 'hint' },
          'Put the MC-707 pads in keyboard mode. Drums never change key. The controller keyboard, solo and mod wheel are set further down.'
        )
      )
    )
  );
  return wrap;
}
