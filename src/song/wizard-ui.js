// The song wizard's window and its first two steps (style and sound).
//
// Owns: WIZ (the song wizard).
import { $, el } from '../core/dom.js';
import { FAMLABEL, NK, STYLES } from '../library/styles.js';
import { chooseStyle } from './wizard-styles.js';
import { closeWiz, styleDemo, wizApply, wizSyncPreview } from './wizard-plan.js';
import { wizStep3 } from './wizard-structure.js';
import { wizStep4 } from './wizard-review.js';
import { hooks } from '../core/hooks.js';

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
/* Compose it now: the whole song for the style picked, written by the composer, every part from one chord
   progression (builds that stop dead, a switch, something new in every drop or chorus) */
const CMP = { minutes: 0, take: 1, sounds: true, mood: 'default' };
/* the composer's dials for each mood: dark (minor, dark chord moves, low and riffy) and edge (harder,
   shorter, busier) */
const MOODS = [
  ['default', 'As the style is', { dark: 0, edge: 0.35 }],
  ['dark', 'Dark', { dark: 0.85, edge: 0.45 }],
  ['hard', 'Hard', { dark: 0.35, edge: 0.85 }],
  ['banger', 'Banger (dark and hard)', { dark: 0.9, edge: 0.95 }],
  ['chill', 'Chill', { dark: 0, edge: 0 }]
];
function composePanel() {
  const st = curStyle();
  const box = el('div', { class: 'wcard wCompose', style: 'margin:0 0 12px' });
  if (!st) {
    box.append(el('b', {}, '♫ Compose it now'), el('span', { class: 'hint' }, '  Pick a style below first.'));
    return box;
  }
  const big = st.fam === 'dnb' || st.fam === 'edm';
  if (!CMP.minutes) CMP.minutes = big ? 5 : 3.5;
  const lab = (t, x) => el('label', { style: 'display:inline-flex;gap:6px;align-items:center' }, t, x);
  const key = el(
    'select',
    { 'aria-label': 'Key', onchange: e => (WIZ.key = +e.target.value) },
    ...Array.from({ length: 12 }, (_, i) => el('option', { value: i }, NK(i, st.scale)))
  );
  key.value = WIZ.key;
  const bpm = el('input', {
    type: 'number',
    min: 40,
    max: 300,
    value: WIZ.bpm,
    'aria-label': 'Tempo',
    style: 'width:64px',
    onchange: e => (WIZ.bpm = Math.max(40, Math.min(300, +e.target.value || WIZ.bpm)))
  });
  const mins = el(
    'select',
    { 'aria-label': 'Length', onchange: e => (CMP.minutes = +e.target.value) },
    ...[2, 3, 3.5, 4, 5, 6, 8].map(m => el('option', { value: m }, m + ' min'))
  );
  mins.value = String(CMP.minutes);
  const take = el('input', {
    type: 'number',
    min: 1,
    max: 9999,
    value: CMP.take,
    'aria-label': 'Take',
    style: 'width:64px',
    onchange: e => (CMP.take = +e.target.value || 1)
  });
  const mood = el(
    'select',
    {
      'aria-label': 'Mood',
      title:
        'Dark: minor, darker chords, a lower riffier line. Hard: harder hits, punchy short bass and stabs, busier drums. Banger: both.',
      onchange: e => (CMP.mood = e.target.value)
    },
    ...MOODS.map(([id, label]) => el('option', { value: id }, label))
  );
  mood.value = CMP.mood;
  const snd = el('input', { type: 'checkbox', onchange: e => (CMP.sounds = e.target.checked) });
  snd.checked = CMP.sounds;
  box.append(
    el('b', {}, '♫ Compose it now: ' + st.name),
    el(
      'div',
      { class: 'hint', style: 'margin:4px 0 8px;line-height:1.4' },
      'The app writes every part itself from one chord progression: drums from the style’s groove, a bass locked to the kick, chords, pads, a hook that develops, builds that stop dead before the drop, and something new in every drop or chorus. It replaces the song (Undo brings it back) and sets up Scene Mode the same way.'
    ),
    el(
      'div',
      { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center' },
      lab('Key', key),
      lab('Tempo', bpm),
      lab('Length', mins),
      lab('Mood', mood),
      lab('Take', take),
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm',
          title: 'A different song in the same style',
          onclick: () => {
            CMP.take = 1 + Math.floor(Math.random() * 9999);
            take.value = CMP.take;
          }
        },
        'Another take'
      ),
      lab(snd, 'Choose sounds (factory tones and kits for every clip)'),
      el(
        'button',
        {
          type: 'button',
          class: 'btn on',
          onclick: () => {
            const o = {
              key: WIZ.key,
              bpm: WIZ.bpm,
              minutes: CMP.minutes,
              seed: CMP.take,
              sounds: CMP.sounds,
              ...(MOODS.find(x => x[0] === CMP.mood) || MOODS[0])[2]
            };
            closeWiz();
            hooks.composeNow(st.id, o);
          }
        },
        '♫ Compose it now'
      )
    )
  );
  return box;
}
function wizStep1(b) {
  b.append(
    el(
      'p',
      { class: 'wlead' },
      'Pick a style. Compose it now and the app writes the whole song in one go, or go step by step (Next) to choose the sound, structure and layers from the pattern library and hear it before anything is created.'
    ),
    composePanel()
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
