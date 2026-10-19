// The Humanize control for Live Mode (next to Swing): an amount from Off to Loose and a feel (Natural,
// Laid back, Pushed, Drunk). The playing itself is in services/humanize.js.
//
// Reads: LV.
import { $, el } from '../core/dom.js';
import { FEEL_NAMES, HUM, humReset } from '../services/humanize.js';
import { LV, saveLive } from './state.js';

/** Put Live Mode's setting into the player (on start and on every change). */
export function lvHumApply(reset) {
  HUM.amount = Math.max(0, Math.min(100, +LV.human || 0));
  HUM.feel = LV.feel || 'natural';
  if (reset) humReset(LV.seed || 1);
}
const label = n => (n <= 0 ? 'Off' : n < 25 ? 'Subtle' : n < 55 ? 'Human' : n < 80 ? 'Loose' : 'Very loose');

/** The slider and the feel menu. */
export function humanizeControl() {
  const out = el('b', { id: 'lvHumV', class: 'lvSwV' }, label(LV.human || 0));
  const slider = el('input', {
    type: 'range',
    id: 'lvHum',
    min: 0,
    max: 100,
    value: LV.human || 0,
    style: 'width:90px',
    'aria-label': 'Humanize',
    title:
      'Humanize: makes the band sound played. Each instrument sits in its own spot against the beat and drifts a little, downbeats and the backbeat lean in, hats alternate hands, chords are strummed, and the snare sometimes flams. Off is machine-tight. Changes straight away.',
    oninput: e => {
      LV.human = +e.target.value;
      out.textContent = label(LV.human);
      lvHumApply();
      saveLive();
    }
  });
  const feel = el(
    'select',
    {
      id: 'lvFeel',
      'aria-label': 'Feel',
      title:
        'Natural: snare a touch behind, hats on top. Laid back: everyone sits behind the beat. Pushed: urgent, ahead of the beat. Drunk: loose and lazy, after J Dilla.',
      onchange: e => {
        LV.feel = e.target.value;
        lvHumApply();
        saveLive();
      }
    },
    ...FEEL_NAMES.map(([v, n]) => el('option', { value: v, selected: v === (LV.feel || 'natural') }, n))
  );
  return el('span', { class: 'lvf' }, 'Humanize', slider, out, feel);
}
/** Keep the control in step when settings are loaded or changed elsewhere. */
export function humanizeSync() {
  const s = $('#lvHum'),
    f = $('#lvFeel');
  if (s) s.value = LV.human || 0;
  if (f) f.value = LV.feel || 'natural';
  const o = $('#lvHumV');
  if (o) o.textContent = label(LV.human || 0);
}
