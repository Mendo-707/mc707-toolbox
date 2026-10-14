import { $, el } from '../core/dom.js';
import { FAMLABEL, NK, STYLES } from '../library/styles.js';
import { chooseStyle } from './wizard-styles.js';
import { closeWiz, styleDemo, wizApply, wizSyncPreview } from './wizard-plan.js';
import { wizStep3 } from './wizard-structure.js';
import { wizStep4 } from './wizard-review.js';

export const WIZ = {
  step: 1,
  style: null,
  seed: 1,
  bump: {},
  ov: {},
  bpm: 120,
  swing: 50,
  key: 5,
  struct: 'club',
  layers: Array(8).fill(true),
  fills: true,
  mode: 'replace',
  opts: { names: true, loop: true },
  fam: 'all',
  secs: [],
  preset: '',
  complexity: 2,
  fillEvery: 8,
  modulate: { on: false, semi: 2 }
};
export const curStyle = () => STYLES.find(s => s.id === WIZ.style);
export function openWiz() {
  WIZ.step = 1;
  $('#wiz').hidden = false;
  renderWiz();
}
/* ---- wizard screens ---- */
export function renderWiz(keepScroll) {
  const w = WIZ;
  const names = ['Style', 'Sound', 'Structure', 'Review'];
  const sc = $('#wizBody').scrollTop;
  const head = $('#wizHead');
  head.textContent = '';
  head.append(
    el('h2', { id: 'wizTitle' }, 'Song wizard'),
    el(
      'div',
      { class: 'steps' },
      ...names.map((s, i) =>
        el('span', { class: 'stepdot' + (w.step === i + 1 ? ' on' : w.step > i + 1 ? ' done' : '') }, i + 1 + '. ' + s)
      )
    ),
    el('button', { class: 'btn sm', onclick: closeWiz }, 'Close')
  );
  const body = $('#wizBody');
  body.textContent = '';
  [null, wizStep1, wizStep2, wizStep3, wizStep4][w.step](body);
  body.scrollTop = keepScroll ? sc : 0;
  const foot = $('#wizFoot');
  foot.textContent = '';
  if (w.step > 1)
    foot.append(
      el(
        'button',
        {
          class: 'btn',
          onclick: () => {
            w.step--;
            renderWiz();
          }
        },
        'Back'
      )
    );
  foot.append(el('div', { class: 'sp' }));
  if (w.step < 4)
    foot.append(
      el(
        'button',
        {
          class: 'btn on',
          disabled: !w.style,
          onclick: () => {
            w.step++;
            renderWiz();
          }
        },
        'Next'
      )
    );
  else
    foot.append(
      el('button', { class: 'btn on', onclick: wizApply }, w.mode === 'replace' ? 'Create song' : 'Add to song')
    );
}
function wizStep1(b) {
  b.append(
    el(
      'p',
      { class: 'wlead' },
      'Pick a starting style. The wizard builds a full arrangement from the pattern library, with tempo, key, structure and layers. You can hear it and change every part before anything is created.'
    )
  );
  const chips = el('div', { class: 'chips', style: 'margin-bottom:12px' });
  [
    ['all', 'All styles'],
    ['dnb', 'Drum and bass'],
    ['hh', 'Hip hop'],
    ['edm', 'Dance and club'],
    ['song', 'Grooves and songs']
  ].forEach(([v, l]) =>
    chips.append(
      el(
        'button',
        {
          class: 'btn sm' + (WIZ.fam === v ? ' on' : ''),
          onclick: () => {
            WIZ.fam = v;
            renderWiz();
          }
        },
        l
      )
    )
  );
  chips.append(
    el(
      'button',
      {
        class: 'btn sm',
        onclick: () => {
          const list = STYLES.filter(s => WIZ.fam === 'all' || s.fam === WIZ.fam);
          chooseStyle(list[Math.floor(Math.random() * list.length)].id);
          renderWiz();
        }
      },
      'Surprise me'
    )
  );
  b.append(chips);
  const grid = el('div', { class: 'scards' });
  STYLES.filter(s => WIZ.fam === 'all' || s.fam === WIZ.fam).forEach(st => {
    const demo = el(
      'span',
      {
        class: 'btn sm sdemo',
        role: 'button',
        tabindex: 0,
        'data-id': st.id,
        title: 'Play a short demo of this style',
        onclick: ev => {
          ev.stopPropagation();
          styleDemo(st.id);
        },
        onkeydown: ev => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            ev.stopPropagation();
            styleDemo(st.id);
          }
        }
      },
      '▶ Hear it'
    );
    grid.append(
      el(
        'div',
        {
          class: 'scard' + (WIZ.style === st.id ? ' on' : ''),
          role: 'button',
          tabindex: 0,
          onclick: () => {
            chooseStyle(st.id);
            renderWiz(true);
          },
          onkeydown: ev => {
            if (ev.key === 'Enter') {
              chooseStyle(st.id);
              renderWiz(true);
            }
          }
        },
        el('span', { class: 'fam' }, FAMLABEL[st.fam]),
        el('b', {}, st.name),
        el('span', { class: 'vibe' }, st.vibe),
        el('small', {}, st.bpm[0] + '–' + st.bpm[1] + ' BPM, suggested key ' + NK(st.keys[0][0], st.scale)),
        demo
      )
    );
  });
  b.append(grid);
  if (WIZ.style)
    b.append(
      el(
        'p',
        { class: 'wlead', style: 'margin-top:12px' },
        'Selected: ' + curStyle().name + '. Press Next to set the tempo and key.'
      )
    );
  wizSyncPreview();
}
function wizStep2(b) {
  const w = WIZ,
    st = curStyle();
  b.append(el('p', { class: 'wlead' }, 'Set the tempo, feel and key. Suggestions are based on ' + st.name + '.'));
  const lo = Math.max(40, st.bpm[0] - 20),
    hi = Math.min(240, st.bpm[1] + 20);
  const bOut = el('output', { class: 'big' }, w.bpm + ' BPM'),
    bNote = el('div', { class: 'hint' });
  const noteFor = () => {
    bNote.textContent =
      w.bpm < st.bpm[0] || w.bpm > st.bpm[1]
        ? 'Outside the usual ' +
          st.bpm[0] +
          '–' +
          st.bpm[1] +
          ' for this style. It will still play, but may not feel like the genre.'
        : 'In the usual range for this style (' + st.bpm[0] + '–' + st.bpm[1] + ').';
  };
  noteFor();
  const bpm = el('input', {
    type: 'range',
    min: lo,
    max: hi,
    value: w.bpm,
    'aria-label': 'Tempo',
    oninput: e => {
      w.bpm = +e.target.value;
      bOut.textContent = w.bpm + ' BPM';
      noteFor();
    }
  });
  const sOut = el('output', { class: 'big' }, w.swing + '%');
  const sw = el('input', {
    type: 'range',
    min: 50,
    max: 75,
    value: w.swing,
    'aria-label': 'Swing',
    oninput: e => {
      w.swing = +e.target.value;
      sOut.textContent = w.swing + '%';
    }
  });
  b.append(
    el(
      'div',
      { class: 'wcols' },
      el(
        'div',
        { class: 'wcard' },
        el('h3', {}, 'Tempo'),
        el('div', { class: 'row' }, bpm, bOut),
        el(
          'div',
          { class: 'row' },
          ...[
            ['Slow', st.bpm[0]],
            ['Suggested', st.bpm[2]],
            ['Fast', st.bpm[1]]
          ].map(([l, v]) =>
            el(
              'button',
              {
                class: 'btn sm',
                onclick: () => {
                  w.bpm = v;
                  renderWiz(true);
                }
              },
              l + ' (' + v + ')'
            )
          )
        ),
        bNote
      ),
      el(
        'div',
        { class: 'wcard' },
        el('h3', {}, 'Swing'),
        el('div', { class: 'row' }, sw, sOut),
        el(
          'div',
          { class: 'hint' },
          st.swing >= 54
            ? 'This style usually sounds best with some swing (about ' + st.swing + '%). 50% is perfectly straight.'
            : 'This style is normally played straight (50%). A little swing (52–56%) loosens it up.'
        )
      )
    )
  );
  const keys = el('div', { class: 'chips', style: 'margin:8px 0' });
  for (let r = 0; r < 12; r++) {
    const rec = st.keys.find(k => k[0] === r);
    keys.append(
      el(
        'button',
        {
          class: 'btn keyb' + (w.key === r ? ' on' : '') + (rec ? ' rec' : ''),
          title: rec ? rec[1] : 'Not a typical pick, but works fine',
          onclick: () => {
            w.key = r;
            renderWiz(true);
          }
        },
        NK(r, st.scale)
      )
    );
  }
  const cur = st.keys.find(k => k[0] === w.key);
  b.append(
    el(
      'div',
      { class: 'wcard' },
      el('h3', {}, 'Key (' + (st.scale || 'minor') + ')'),
      el(
        'div',
        { class: 'hint' },
        'Keys with an underline are the usual picks for this style. All patterns are transposed to the key you choose.'
      ),
      keys,
      el(
        'div',
        { class: 'why' },
        cur
          ? cur[1]
          : NK(w.key, st.scale) +
              ' is not one of the usual picks for ' +
              st.name +
              '. That is fine: the patterns are transposed for you, so listen to how the bass sits and move the key up or down a step if it feels too low or too thin.'
      )
    )
  );
}
