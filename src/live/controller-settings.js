import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import { LV, saveLive } from './state.js';
import {
  CTL,
  CTL_PRESETS,
  CTL_ZONES,
  ctlAllOff,
  ctlAttach,
  ctlIndex,
  ctlKeyName,
  ctlKeyboard,
  ctlPreset,
  ctlTargets,
  ctlUsePreset,
  liveRenderCtlBar
} from './controller.js';
import { liveRenderSettings } from './settings-panel.js';

export function ctlRenderSettings(b, chSel) {
  const c = LV.ctl,
    ins = MIDI.access ? [...MIDI.access.inputs.values()].filter(i => i !== MIDI.inp) : [],
    p = ctlPreset();
  const sel = (id, label, val, opts, on) =>
    el(
      'label',
      { class: 'lvf' },
      label,
      el(
        'select',
        {
          id,
          onchange: e => {
            on(e.target.value);
            saveLive();
            liveRenderSettings();
            liveRenderCtlBar();
          }
        },
        ...opts.map(([v, l]) => el('option', { value: v, selected: String(val) === String(v) }, l))
      )
    );
  b.append(
    el('h4', {}, 'Controller keyboard (USB)'),
    el(
      'p',
      { class: 'hint' },
      'Plug a MIDI keyboard into the computer as well as the MC-707. Like the Quasimidi Raven: the lowest octave mutes the 8 tracks (the 4 keys above them are Unmute all, Fill, Build → Drop and Break), the next octave changes the key of every melodic part (drums never change), and every key above plays a live solo on one MC-707 track. The mod wheel opens the filter and the pitch wheel bends the solo. Mute and key options are shared with Raven mode above.'
    ),
    el(
      'div',
      { class: 'lvrow' },
      el(
        'label',
        { class: 'lvf' },
        'Keyboard input',
        el(
          'select',
          {
            id: 'ctlIn',
            onchange: e => {
              c.inName = e.target.value;
              saveLive();
              ctlAttach();
              liveRenderSettings();
            }
          },
          el('option', { value: '' }, ins.length ? 'None' : 'No other MIDI inputs found'),
          ...ins.map(i => el('option', { value: i.name, selected: c.inName === i.name }, i.name))
        )
      ),
      sel(
        'ctlPreset',
        'Model',
        c.preset,
        CTL_PRESETS.map(x => [x[0], x[1]]),
        v => ctlUsePreset(v)
      ),
      el(
        'label',
        { class: 'lvf' },
        'Keys channel',
        chSel(c.keyCh, v => {
          c.keyCh = v;
          saveLive();
        })
      ),
      el(
        'button',
        {
          class: 'btn' + (CTL.learnLow ? ' on' : ''),
          disabled: !CTL.inp,
          onclick: () => {
            CTL.learnLow = !CTL.learnLow;
            liveRenderSettings();
          }
        },
        CTL.learnLow ? 'Press the lowest key…' : 'Set from lowest key'
      )
    ),
    p[9] === 'nov'
      ? el(
          'p',
          { class: 'hint' },
          'On a Novation keyboard, use the MIDI port (not the DAW port), and switch the pots and faders to Custom mode (hold Shift and press the Custom pad) so they send MIDI to other apps. Put the pads in Drum mode, then learn them below.'
        )
      : '',
    ctlKeyboard(),
    el(
      'div',
      { class: 'lvrow' },
      sel('ctlZones', 'Keyboard layout', c.zones, CTL_ZONES, v => {
        c.zones = v;
      })
    ),
    el(
      'div',
      { class: 'lvrow' },
      sel(
        'ctlSoloT',
        'Solo plays',
        c.soloT,
        [[-1, 'Nothing'], ...S.tracks.map((t, i) => [i, 'Track ' + (i + 1) + ': ' + t.name])],
        v => {
          ctlAllOff();
          c.soloT = +v;
        }
      ),
      sel(
        'ctlSoloOct',
        'Solo octave',
        c.soloOct,
        [
          [-2, '−2'],
          [-1, '−1'],
          [0, '0'],
          [1, '+1'],
          [2, '+2']
        ],
        v => {
          ctlAllOff();
          c.soloOct = +v;
        }
      ),
      el(
        'label',
        { class: 'lvf' },
        el('input', {
          type: 'checkbox',
          checked: c.soloSnap,
          onchange: e => {
            c.soloSnap = e.target.checked;
            saveLive();
          }
        }),
        'Keep the solo in the key'
      ),
      el(
        'label',
        { class: 'lvf' },
        el('input', {
          type: 'checkbox',
          checked: c.soloOwn,
          onchange: e => {
            c.soloOwn = e.target.checked;
            saveLive();
          }
        }),
        "Silence the app's pattern on that track"
      ),
      sel(
        'ctlMod',
        'Mod wheel',
        c.modWheel,
        [
          ['filter', 'Opens the FILTER knob on every track'],
          ['mod', 'Modulation on the solo track']
        ],
        v => {
          c.modWheel = v;
        }
      )
    )
  );
  const rows = ctlTargets(),
    tbl = el('div', { class: 'ctlMap' });
  rows.forEach(([id, name, fn]) => {
    const a = c.map[id],
      lrn = CTL.learn === id;
    tbl.append(
      el(
        'div',
        { class: 'ctlRow' + (lrn ? ' lrn' : '') },
        el('b', {}, name),
        el('span', {}, fn),
        el('code', {}, lrn ? 'move or press it…' : ctlKeyName(a)),
        el(
          'button',
          {
            class: 'btn sm' + (lrn ? ' on' : ''),
            disabled: !CTL.inp,
            onclick: () => {
              CTL.learnAll = false;
              CTL.learn = lrn ? null : id;
              liveRenderSettings();
            }
          },
          lrn ? 'Cancel' : 'Learn'
        ),
        a
          ? el(
              'button',
              {
                class: 'btn sm',
                title: 'Clear',
                onclick: () => {
                  delete c.map[id];
                  ctlIndex();
                  saveLive();
                  liveRenderSettings();
                }
              },
              '✕'
            )
          : el('span', {})
      )
    );
  });
  const det = el(
    'details',
    {
      open: !!CTL.learn || !!CTL.openMap,
      ontoggle: e => {
        CTL.openMap = e.target.open;
      }
    },
    el('summary', {}, 'Knobs, faders, buttons and pads (' + Object.keys(c.map).length + ' set)')
  );
  b.append(det);
  det.append(
    el(
      'div',
      { class: 'lvrow' },
      el(
        'button',
        {
          class: 'btn' + (CTL.learnAll ? ' on' : ''),
          disabled: !CTL.inp,
          onclick: () => {
            if (CTL.learnAll) {
              CTL.learnAll = false;
              CTL.learn = null;
            } else {
              CTL.learnAll = true;
              CTL.learn = rows[0][0];
            }
            liveRenderSettings();
          }
        },
        CTL.learnAll ? 'Stop learning' : 'Learn all controls in order'
      ),
      CTL.learnAll
        ? el(
            'button',
            {
              class: 'btn',
              onclick: () => {
                const ts = rows.map(x => x[0]),
                  j = ts.indexOf(CTL.learn);
                CTL.learn = j < ts.length - 1 ? ts[j + 1] : null;
                if (!CTL.learn) CTL.learnAll = false;
                liveRenderSettings();
              }
            },
            'Skip this one'
          )
        : null,
      el(
        'button',
        {
          class: 'btn',
          onclick: () => {
            c.map = {};
            ctlIndex();
            saveLive();
            liveRenderSettings();
          }
        },
        'Clear all'
      )
    ),
    el(
      'p',
      { class: 'hint' },
      'Knobs start on CC 21–28, a common default. If one does nothing, press Learn next to it and turn the knob. Learning a pad replaces the MC-707 for that live pad only; the MC-707 pads keep working.'
    ),
    tbl
  );
}
