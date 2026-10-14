// The Live Mapping panel: pad layout and actions, Raven mode, knob rest values and the controller
// keyboard.
//
// Reads: S, LV, MIDI.
import { $, clamp, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import {
  LV,
  LV_ACTS,
  LV_ACTS_KBD,
  LV_DRUM_NOTES,
  LV_LABEL,
  LV_TOPFN,
  NOTEN,
  lvLayoutNotes,
  noteLbl,
  saveLive
} from './state.js';
import { ravenSection } from './raven.js';
import { ctlRenderSettings } from './controller-settings.js';
import { padTestOpen } from './midi-in.js';
import { liveRenderKnobs, liveRenderPads } from './panels.js';

export function liveRenderSettings() {
  const b = $('#lvSetBody');
  if (!b) return;
  b.textContent = '';
  const chSel = (val, on) => {
    const s = el('select', { onchange: e => on(+e.target.value) });
    s.append(el('option', { value: 0, selected: val === 0 }, 'Any channel'));
    for (let c = 1; c <= 16; c++) s.append(el('option', { value: c, selected: val === c }, 'Channel ' + c));
    return s;
  };
  const noteIn = (val, on) =>
    el('input', {
      type: 'number',
      min: 0,
      max: 127,
      value: val,
      style: 'width:64px',
      onchange: e => on(clamp(Math.round(+e.target.value) || 0, 0, 127))
    });
  b.append(
    el(
      'p',
      { class: 'hint' },
      LV.padLayout === 'kbd'
        ? "Matches the MC-707 pads in keyboard mode: the bottom row plays C D E F G A B C, the top row plays C# D# F# G# A# with Oct −, Step and Oct + in between. Those three send no note, so their pads work from the screen and keyboard only. The app follows the MC-707's Oct buttons automatically."
        : LV.padLayout === 'drum'
          ? "Matches the MC-707 pads with a drum track selected: they send the drum notes (kick 36, snare 38, closed hat 42 …) on that track's channel. Select any drum track on the MC-707 and the pads work. If yours differ, run the Pad test."
          : 'Pads send 16 notes in a row. Use Learn if your pads send something else.'
    )
  );
  b.append(
    el(
      'div',
      { class: 'lvrow' },
      el(
        'label',
        { class: 'lvf' },
        'Pad channel',
        chSel(LV.padCh, v => {
          LV.padCh = v;
          saveLive();
          liveRenderPads();
        })
      ),
      el(
        'label',
        { class: 'lvf' },
        'Pad layout',
        el(
          'select',
          {
            onchange: e => {
              const v = e.target.value;
              if (v === 'custom') return;
              const was = LV.padLayout;
              LV.padLayout = v;
              LV.padFlip = v === 'kbd';
              LV.padNotes = lvLayoutNotes();
              if (JSON.stringify(LV.acts) === JSON.stringify(was === 'kbd' ? LV_ACTS_KBD : LV_ACTS))
                LV.acts = (v === 'kbd' ? LV_ACTS_KBD : LV_ACTS).slice();
              saveLive();
              liveRenderPads();
              liveRenderSettings();
            }
          },
          el('option', { value: 'drum', selected: LV.padLayout === 'drum' }, 'MC-707 drum track (recommended)'),
          el('option', { value: 'grid', selected: LV.padLayout === 'grid' }, '16 notes in a row (other controllers)'),
          el(
            'option',
            { value: 'kbd', selected: LV.padLayout === 'kbd' },
            'MC-707 keyboard mode (white keys on the bottom row)'
          ),
          LV.padLayout === 'custom' ? el('option', { value: 'custom', selected: true }, 'Learned from your pads') : null
        )
      ),
      el(
        'button',
        {
          class: 'btn' + (LV.learn === 'p1' ? ' on' : ''),
          disabled: !MIDI.inp,
          title: MIDI.inp ? 'Press the top-left pad on the MC-707 once' : 'Connect the MC-707 first',
          onclick: () => {
            LV.learn = LV.learn === 'p1' ? -1 : 'p1';
            liveRenderSettings();
            liveRenderPads();
          }
        },
        LV.learn === 'p1' ? 'Now press pad 1 on the MC-707…' : 'Set from pad 1 (one press)'
      ),
      el(
        'button',
        {
          class: 'btn on',
          onclick: padTestOpen,
          title: 'Press pads 1–16 in order and see exactly what the MC-707 sends'
        },
        'Pad test'
      ),
      el(
        'button',
        {
          class: 'btn' + (LV.learn >= 0 ? ' on' : ''),
          disabled: !MIDI.inp,
          title: MIDI.inp ? '' : 'Connect the MC-707 first',
          onclick: () => {
            LV.learn = LV.learn >= 0 ? -1 : 0;
            liveRenderSettings();
            liveRenderPads();
          }
        },
        LV.learn >= 0 ? 'Press pad ' + (LV.learn + 1) + '… (click to stop)' : 'Learn the 16 pads in order'
      ),
      LV.learn >= 0
        ? el(
            'button',
            {
              class: 'btn',
              onclick: () => {
                LV.padNotes[LV.learn] = null;
                LV.learn = LV.learn >= 15 ? -1 : LV.learn + 1;
                saveLive();
                liveRenderPads();
                liveRenderSettings();
              }
            },
            'Skip (pad sends no note)'
          )
        : null,
      el(
        'button',
        {
          class: 'btn',
          onclick: () => {
            LV.padLayout = 'drum';
            LV.padFlip = false;
            LV.padBase = 36;
            LV.padNotes = LV_DRUM_NOTES.slice();
            LV.acts = LV_ACTS.slice();
            LV.padCh = 0;
            saveLive();
            liveRenderPads();
            liveRenderSettings();
          }
        },
        'Reset pads'
      )
    )
  );
  const grid = el('div', { class: 'lvActGrid' });
  const opts = [];
  for (let i = 0; i < 8; i++) opts.push(['s' + i, 'Scene ' + (i + 1) + (LV.scenes[i] ? ': ' + LV.scenes[i].name : '')]);
  [
    'sw:drums',
    'sw:perc',
    'sw:bass',
    'sw:chords',
    'sw:pad',
    'sw:lead',
    'fill',
    'bd',
    'rise:up',
    'rise:down',
    'stut:4',
    'stut:8',
    'stut:16',
    'en:up',
    'en:down',
    'auto',
    'lock',
    'mu:drums',
    'mu:bass',
    'mu:chords',
    'mu:lead',
    'next',
    'prev',
    'stop'
  ].forEach(a => opts.push([a, LV_LABEL[a]]));
  NOTEN.forEach((n, i) => opts.push(['key:' + i, 'Key ' + n]));
  S.tracks.forEach((t, i) => opts.push(['mt:' + i, 'Mute ' + t.name]));
  for (let i = 0; i < 16; i++) opts.push(['sc:' + i, 'Scatter ' + (i + 1) + ' (hold)']);
  for (let i = 0; i < 16; i++) {
    const s = el('select', {
      'aria-label': 'Action for pad ' + (i + 1),
      onchange: e => {
        LV.acts[i] = e.target.value;
        saveLive();
        liveRenderPads();
      }
    });
    opts.forEach(([v, l]) => s.append(el('option', { value: v, selected: LV.acts[i] === v }, l)));
    grid.append(
      el(
        'label',
        { class: 'lvf' },
        'Pad ' +
          (i + 1) +
          ((LV.padLayout === 'kbd') === i < 8 ? ' (bottom row)' : ' (top row)') +
          ' · ' +
          (LV.padNotes[i] == null
            ? LV.padLayout === 'kbd' && i >= 8 && LV_TOPFN[i - 8]
              ? LV_TOPFN[i - 8] + ', screen only'
              : 'no note'
            : noteLbl(LV.padNotes[i])),
        s
      )
    );
  }
  b.append(grid);
  b.append(ravenSection(chSel, noteIn));
  b.append(
    el('h4', {}, 'Knobs and scatter'),
    el(
      'div',
      { class: 'lvrow' },
      ...['FILTER', 'MOD', 'FX', 'SOUND'].map((n, i) =>
        el(
          'label',
          { class: 'lvf' },
          n + ' rest',
          el('input', {
            type: 'number',
            min: 0,
            max: 127,
            value: LV.rest[i],
            style: 'width:60px',
            onchange: e => {
              LV.rest[i] = clamp(Math.round(+e.target.value) || 0, 0, 127);
              saveLive();
            }
          })
        )
      ),
      el(
        'label',
        { class: 'lvf' },
        'Reverb rest',
        el('input', {
          type: 'number',
          min: 0,
          max: 127,
          value: LV.revRest | 0,
          style: 'width:60px',
          onchange: e => {
            LV.revRest = clamp(Math.round(+e.target.value) || 0, 0, 127);
            saveLive();
          }
        })
      ),
      el(
        'label',
        { class: 'lvf' },
        'Scatter notes start at',
        noteIn(LV.scBase, v => {
          LV.scBase = clamp(v, 0, 112);
          saveLive();
          liveRenderKnobs();
        })
      )
    ),
    el(
      'p',
      { class: 'hint' },
      'Rest is where a knob returns after the XY pad, a riser or a reset. The manual does not say where each knob rests on the MC-707, so adjust these to match. FILTER at 64 is a common centre. Reverb rest is the reverb send (CC 91) that Wash, Throw and builds return to, so set it to the send level your tracks use.'
    )
  );
  ctlRenderSettings(b, chSel);
}
