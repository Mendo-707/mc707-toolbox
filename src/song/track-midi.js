import { $, el, toast } from '../core/dom.js';
import { S, scheduleSave } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import { MC_PARAMS } from '../core/mc707-params.js';
import { sendCC } from '../services/mc-controls.js';
import { initShape } from './shape-editor.js';

export const CC_NAME = n => {
  const p = MC_PARAMS.find(x => x.n === n);
  return p ? p.name + ' (CC ' + n + ')' : 'CC ' + n;
};
/* ---- per-track MIDI controls ---- */
const MCT = { t: 3 };
export function openMctl(t) {
  if (t != null) MCT.t = t;
  $('#mctl').hidden = false;
  renderMctl();
}
export function closeMctl() {
  $('#mctl').hidden = true;
}
function renderMctl() {
  const t = S.tracks[MCT.t];
  const head = $('#mctlHead');
  head.textContent = '';
  head.append(
    el('h2', {}, 'MIDI controls'),
    el(
      'div',
      { class: 'steps' },
      ...S.tracks.map((x, i) =>
        el(
          'button',
          {
            class: 'btn sm' + (i === MCT.t ? ' on' : ''),
            title: x.name,
            onclick: () => {
              MCT.t = i;
              renderMctl();
            }
          },
          String(i + 1)
        )
      )
    ),
    el('button', { class: 'btn sm', onclick: closeMctl }, 'Close')
  );
  const b = $('#mctlBody');
  b.textContent = '';
  b.append(
    el(
      'p',
      { class: 'wlead' },
      'Track ' +
        (MCT.t + 1) +
        ', ' +
        t.name +
        ', on MIDI channel ' +
        t.ch +
        '. These sliders send MIDI control changes that the MC-707 recognises, so you can set up a sound from here.' +
        (MIDI.out ? '' : ' No MIDI output is connected yet, so nothing is sent.')
    )
  );
  const g = el('div', { class: 'mgrid' });
  MC_PARAMS.forEach(m => {
    const cur = t.cc && t.cc[m.n] != null ? t.cc[m.n] : m.def;
    const set = t.cc && t.cc[m.n] != null;
    const out = el('output', {}, String(cur));
    const rng = el('input', {
      type: 'range',
      min: 0,
      max: 127,
      value: cur,
      'aria-label': m.name,
      oninput: e => {
        const v = +e.target.value;
        t.cc = t.cc || {};
        t.cc[m.n] = v;
        out.textContent = String(v);
        row.classList.add('set');
        sendCC(MCT.t, m.n, v);
        scheduleSave();
      }
    });
    const row = el(
      'div',
      { class: 'mrow' + (set ? ' set' : '') },
      el('span', { class: 'mn' }, m.name, el('small', {}, 'CC ' + m.n)),
      rng,
      out,
      el(
        'button',
        {
          class: 'btn sm',
          title: 'Forget this value',
          onclick: () => {
            if (t.cc) {
              delete t.cc[m.n];
              if (!Object.keys(t.cc).length) delete t.cc;
            }
            scheduleSave();
            renderMctl();
          }
        },
        '↺'
      )
    );
    g.append(row);
  });
  b.append(g);
  b.append(
    el(
      'p',
      { class: 'hint', style: 'margin-top:8px' },
      'Slider values that you have moved are remembered with the song. Attack, decay, release and vibrato follow Roland’s usual convention where 64 is the middle. If a control does nothing, check that the MC-707 track is set to receive control changes.'
    )
  );
  const f = $('#mctlFoot');
  f.textContent = '';
  f.append(
    el(
      'label',
      {
        class: 'lay',
        style: 'flex-direction:row;align-items:center;padding:4px 8px;color:var(--ink);font-size:13px'
      },
      el('input', {
        type: 'checkbox',
        checked: S.sendCC !== false,
        onchange: e => {
          S.sendCC = e.target.checked;
          scheduleSave();
        }
      }),
      el('span', {}, 'Send remembered values when the song starts')
    ),
    el('div', { class: 'sp' }),
    el(
      'button',
      {
        class: 'btn',
        onclick: () => {
          if (t.cc) for (const n in t.cc) sendCC(MCT.t, +n, t.cc[n]);
          toast('Sent');
        }
      },
      'Send all now'
    ),
    el(
      'button',
      {
        class: 'btn',
        onclick: () => {
          delete t.cc;
          scheduleSave();
          renderMctl();
        }
      },
      'Forget all'
    )
  );
}
export function initStageB() {
  initShape();
  $('#mctl').addEventListener('pointerdown', e => {
    if (e.target.id === 'mctl') closeMctl();
  });
  const cc = $('#ctrlCh');
  for (let i = 1; i <= 16; i++) cc.append(el('option', { value: i }, String(i)));
  cc.value = S.ctrlCh || 16;
  cc.addEventListener('change', e => {
    S.ctrlCh = +e.target.value;
    scheduleSave();
  });
  $('#bTrackCtl').addEventListener('click', () => {
    $('#midiPop').hidden = true;
    openMctl();
  });
}
