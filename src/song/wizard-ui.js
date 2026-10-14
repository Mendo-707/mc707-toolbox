import { $, clamp, el, fmtDur } from '../core/dom.js';
import { TRACK_COLORS, devNum, devOn, oneKit } from '../core/device.js';
import { TRACK_POOLS, facById, shiftFor } from '../library/index.js';
import { TR, stopPlay } from '../services/transport.js';
import { FAMLABEL, GEN_TIPS, KIND_TIPS, NK, STRUCT, STYLES, trackLabel } from '../library/styles.js';
import { KEYTXT, chooseStyle, defaultSecs, kindsOf, wizPlan } from './wizard-styles.js';
import {
  closeWiz,
  styleDemo,
  wizApply,
  wizCellPreview,
  wizSecPreview,
  wizSongPreview,
  wizSyncPreview
} from './wizard-plan.js';
import { soundCard } from './sound-suggestions.js';
import { lvPool } from '../library/pools.js';

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
const curStyle = () => STYLES.find(s => s.id === WIZ.style);
export function openWiz() {
  WIZ.step = 1;
  $('#wiz').hidden = false;
  renderWiz();
}
/* ---- wizard screens ---- */
function renderWiz(keepScroll) {
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
function wizStep3(b) {
  const w = WIZ,
    st = curStyle();
  const K = kindsOf(st.fam);
  const rerender = () => renderWiz(true);
  b.append(
    el(
      'p',
      { class: 'wlead' },
      'Choose how the song is laid out. Start from a preset, then change, add, remove or reorder sections. Each row is one section.'
    )
  );
  const cards = el('div', { class: 'scards' });
  STRUCT[st.fam].forEach(s => {
    const total = s.secs.reduce((a, x) => a + x[1], 0);
    const strip = el(
      'div',
      { class: 'strip' },
      ...s.secs.map(([k, n]) =>
        el('span', { style: 'flex:' + n, title: K[k].name + ', ' + n + ' bars' }, n >= 6 ? K[k].name : '')
      )
    );
    cards.append(
      el(
        'button',
        {
          class: 'scard' + (w.preset === s.id ? ' on' : ''),
          onclick: () => {
            w.preset = s.id;
            w.secs = defaultSecs(st, s.id);
            w.ov = {};
            rerender();
          }
        },
        el('b', {}, s.name),
        el('span', { class: 'vibe' }, s.desc),
        strip,
        el('small', {}, total + ' bars, about ' + fmtDur(total, w.bpm) + ' at ' + w.bpm + ' BPM')
      )
    );
  });
  b.append(cards);
  /* section editor */
  const total = w.secs.reduce((a, x) => a + x.bars, 0);
  const ed = el(
    'div',
    { class: 'wcard', style: 'margin-top:12px' },
    el('h3', {}, 'Sections (' + w.secs.length + ', ' + total + ' bars, about ' + fmtDur(total, w.bpm) + ')')
  );
  const tbl = el('div', { class: 'sut' });
  w.secs.forEach((sec, i) => {
    const ksel = el('select', {
      'aria-label': 'Section type',
      onchange: e => {
        sec.kind = e.target.value;
        if (!sec.name || Object.values(K).some(k => k.name === sec.name)) sec.name = K[sec.kind].name;
        w.preset = '';
        w.ov = {};
        rerender();
      }
    });
    Object.keys(K).forEach(k => ksel.append(el('option', { value: k, selected: sec.kind === k }, K[k].name)));
    const move = d => {
      const j = i + d;
      if (j < 0 || j >= w.secs.length) return;
      [w.secs[i], w.secs[j]] = [w.secs[j], w.secs[i]];
      w.preset = '';
      w.ov = {};
      rerender();
    };
    tbl.append(
      el(
        'div',
        { class: 'sur seced' },
        el('input', {
          type: 'text',
          value: sec.name,
          maxlength: 16,
          'aria-label': 'Section name',
          onchange: e => {
            sec.name = e.target.value.trim().slice(0, 16) || K[sec.kind].name;
            rerender();
          }
        }),
        ksel,
        el('input', {
          type: 'number',
          min: 1,
          max: 64,
          value: sec.bars,
          'aria-label': 'Bars',
          style: 'width:64px',
          onchange: e => {
            sec.bars = clamp(Math.round(+e.target.value) || 1, 1, 64);
            w.preset = '';
            w.ov = {};
            rerender();
          }
        }),
        el(
          'span',
          { class: 'secb' },
          el('button', { class: 'btn sm', title: 'Move up', disabled: i === 0, onclick: () => move(-1) }, '▲'),
          el(
            'button',
            { class: 'btn sm', title: 'Move down', disabled: i === w.secs.length - 1, onclick: () => move(1) },
            '▼'
          ),
          el(
            'button',
            {
              class: 'btn sm',
              title: 'Duplicate',
              onclick: () => {
                w.secs.splice(i + 1, 0, { ...sec });
                w.preset = '';
                w.ov = {};
                rerender();
              }
            },
            '⧉'
          ),
          el(
            'button',
            {
              class: 'btn sm',
              title: 'Remove',
              disabled: w.secs.length <= 1,
              onclick: () => {
                w.secs.splice(i, 1);
                w.preset = '';
                w.ov = {};
                rerender();
              }
            },
            '✕'
          )
        )
      )
    );
  });
  ed.append(tbl);
  const addSel = el('select', { 'aria-label': 'Add a section' });
  addSel.append(el('option', { value: '' }, 'Add a section…'));
  Object.keys(K).forEach(k => addSel.append(el('option', { value: k }, K[k].name)));
  addSel.addEventListener('change', e => {
    const k = e.target.value;
    if (!k) return;
    w.secs.push({ kind: k, bars: 8, name: K[k].name });
    w.preset = '';
    w.ov = {};
    rerender();
  });
  ed.append(
    el(
      'div',
      { class: 'row' },
      addSel,
      el(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            w.preset = st.fam === 'dnb' || st.fam === 'edm' ? 'club' : 'full';
            w.secs = defaultSecs(st, w.preset);
            w.ov = {};
            rerender();
          }
        },
        'Reset to the preset'
      )
    )
  );
  b.append(ed);
  /* feel */
  const feel = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, 'Feel and detail'));
  const cx = el('div', { class: 'row' });
  [
    [1, 'Simple', 'Fewer layers and only the fills that lead into bigger sections.'],
    [2, 'Standard', 'A balanced arrangement.'],
    [3, 'Intricate', 'Long sections are split into 8-bar phrases that change pattern, with more fills.']
  ].forEach(([v, l, d]) =>
    cx.append(
      el(
        'label',
        { class: 'lay', style: 'flex:1;min-width:180px' },
        el('input', {
          type: 'radio',
          name: 'wcx',
          checked: w.complexity === v,
          onchange: () => {
            w.complexity = v;
            w.ov = {};
            rerender();
          }
        }),
        el('span', {}, el('b', {}, l), el('small', {}, d))
      )
    )
  );
  feel.append(cx);
  const fl = el('div', { class: 'row' });
  [
    ['classic', 'Classic', 'Simpler, steadier parts.'],
    ['mixed', 'Mixed', 'Anything that fits the style.'],
    ['lively', 'Lively', 'Busier, syncopated melodies, bouncier bass and chords.']
  ].forEach(([v, l, d]) =>
    fl.append(
      el(
        'label',
        { class: 'lay', style: 'flex:1;min-width:180px' },
        el('input', {
          type: 'radio',
          name: 'wfl',
          checked: (w.flavor || 'mixed') === v,
          onchange: () => {
            w.flavor = v;
            w.ov = {};
            rerender();
          }
        }),
        el('span', {}, el('b', {}, 'Patterns: ' + l), el('small', {}, d))
      )
    )
  );
  feel.append(fl);
  const fe = el('select', {
    'aria-label': 'Fill spacing',
    onchange: e => {
      w.fillEvery = +e.target.value;
      rerender();
    }
  });
  [
    [4, 'every 4 bars'],
    [8, 'every 8 bars'],
    [16, 'every 16 bars']
  ].forEach(([v, l]) => fe.append(el('option', { value: v, selected: w.fillEvery === v }, l)));
  const ms = el('select', {
    'aria-label': 'Key change',
    onchange: e => {
      w.modulate.semi = +e.target.value;
    }
  });
  [1, 2, 3, 4, 5, 7].forEach(v =>
    ms.append(
      el('option', { value: v, selected: w.modulate.semi === v }, 'up ' + v + (v === 1 ? ' semitone' : ' semitones'))
    )
  );
  feel.append(
    el(
      'div',
      { class: 'row' },
      el(
        'label',
        {
          class: 'lay',
          style: 'flex-direction:row;align-items:center;padding:4px 8px;color:var(--ink);font-size:13px'
        },
        el('input', {
          type: 'checkbox',
          checked: w.fills,
          onchange: e => {
            w.fills = e.target.checked;
          }
        }),
        el('span', {}, 'Drum fills')
      ),
      el('span', { class: 'hint' }, 'placed'),
      fe
    ),
    el(
      'div',
      { class: 'row' },
      el(
        'label',
        {
          class: 'lay',
          style: 'flex-direction:row;align-items:center;padding:4px 8px;color:var(--ink);font-size:13px'
        },
        el('input', {
          type: 'checkbox',
          checked: w.modulate.on,
          onchange: e => {
            w.modulate.on = e.target.checked;
          }
        }),
        el('span', {}, 'Change key for the final drop or hook:')
      ),
      ms,
      el('span', { class: 'hint' }, '(stored as a clip transpose, so you can undo or edit it later)')
    )
  );
  b.append(feel);
  const lay = el('div', { class: 'layers' });
  const what = [
    'Main drums',
    'Hi-hat or ride layer',
    'Percussion layer',
    'Bass',
    'Chords or keys',
    'Pad',
    'Lead melody',
    'Counter-melody'
  ];
  for (let t = 0; t < 8; t++)
    if (devOn(t) && !(oneKit() && (t === 1 || t === 2)))
      lay.append(
        el(
          'label',
          { class: 'lay', style: '--c:' + TRACK_COLORS[t] },
          el('input', {
            type: 'checkbox',
            checked: w.layers[t],
            onchange: e => {
              w.layers[t] = e.target.checked;
              w.ov = {};
            }
          }),
          el(
            'span',
            {},
            el('b', {}, 'Track ' + devNum(t) + ': ' + trackLabel(st, t)),
            el('small', {}, t === 0 && oneKit() ? 'Full kit: kick, snare, hats and percussion' : what[t])
          )
        )
      );
  b.append(el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, 'Layers'), lay));
  const mode = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, 'Where to put it'));
  [
    ['replace', 'Replace the current song', 'Starts fresh and sets tempo, swing, key, track names and levels.'],
    [
      'append',
      'Add after the current song',
      'Keeps your song, tempo and track names, and adds the new section at the end.'
    ]
  ].forEach(([v, l, d]) =>
    mode.append(
      el(
        'label',
        { class: 'lay' },
        el('input', {
          type: 'radio',
          name: 'wmode',
          checked: w.mode === v,
          onchange: () => {
            w.mode = v;
          }
        }),
        el('span', {}, el('b', {}, l), el('small', {}, d))
      )
    )
  );
  b.append(mode);
}
function wizAdvice(w, plan, st) {
  const a = [];
  if (w.bpm < st.bpm[0] || w.bpm > st.bpm[1])
    a.push('Tempo is outside the usual ' + st.bpm[0] + '–' + st.bpm[1] + ' BPM for ' + st.name + '.');
  if (!st.keys.find(k => k[0] === w.key))
    a.push(
      NK(w.key, st.scale) +
        ' is an unusual key for ' +
        st.name +
        '. If the bass sounds too low or thin, try ' +
        NK(st.keys[0][0], st.scale) +
        '.'
    );
  if (!w.layers[3]) a.push('The bass layer is off. The song will feel light without it.');
  if (!w.layers[1] && !w.layers[0]) a.push('Both drum layers are off.');
  if (!w.layers[1]) a.push('The hats layer is off, so the groove may sound thin.');
  if (!w.fills) a.push('Fills are off. Fills at the end of phrases help the listener hear the structure.');
  if (plan.sections.length > 1 && plan.sections.every(s => s.kind === plan.sections[0].kind))
    a.push('Every section is the same type, so the song will not change much. Mix in different section types.');
  if (plan.total < 24) a.push('This is quite short (' + plan.total + ' bars). It is fine for a sketch.');
  if (plan.total > 128) a.push('This is long (' + plan.total + ' bars). Consider shorter sections.');
  if (w.modulate && w.modulate.on)
    a.push('The final drop or hook will be raised by ' + w.modulate.semi + ' semitones for a lift.');
  const used = new Set();
  plan.sections.forEach(s => {
    for (const t in s.cells) if (s.cells[t].id) used.add(s.cells[t].id);
  });
  a.push('Uses ' + used.size + ' different patterns across ' + plan.sections.length + ' sections.');
  a.push('Total length: ' + plan.total + ' bars, about ' + fmtDur(plan.total, w.bpm) + ' at ' + w.bpm + ' BPM.');
  return a;
}
function wizStep4(b) {
  const w = WIZ,
    plan = wizPlan(w),
    st = plan.st;
  const re = () => renderWiz(true);
  if (TR.playing && TR.mode === 'wiz') {
    TR.wz.plan = plan;
    TR.wz.key = w.key;
    if (!TR.wz.demo) {
      TR.wz.bpm = w.bpm;
      TR.wz.swing = w.swing;
    }
    const sec = TR.wz.secIdx != null ? plan.sections[TR.wz.secIdx] : null;
    if (TR.wz.secIdx != null && !sec) stopPlay();
    else if (sec) {
      TR.wz.startTick = sec.start * 32;
      TR.wz.endTick = (sec.start + sec.bars) * 32;
    } else TR.wz.endTick = plan.total * 32;
  }
  const left = el('div', { class: 'wleft' });
  left.append(
    el(
      'div',
      { class: 'wsum' },
      el('b', {}, st.name),
      ' · ' + w.bpm + ' BPM · ' + KEYTXT(w.key, st.scale) + ' · ' + plan.total + ' bars'
    ),
    el(
      'div',
      { class: 'row' },
      el('button', { class: 'btn on', id: 'wzSong', onclick: wizSongPreview }, '▶ Preview the song'),
      el(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            w.seed = Math.floor(Math.random() * 1e6) + 1;
            w.ov = {};
            w.bump = {};
            re();
          }
        },
        'Shuffle everything'
      ),
      el(
        'span',
        { class: 'hint' },
        'Use ▶ on a section or a pattern to hear just that part. Pattern menus swap one part, ↻ re-picks a whole row.'
      )
    )
  );
  const cols =
    '96px ' + plan.sections.map(s => 'minmax(' + Math.max(112, s.bars * 7) + 'px,' + s.bars + 'fr)').join(' ');
  const g = el('div', { class: 'tl', style: 'grid-template-columns:' + cols });
  g.append(el('div', { class: 'tlc corner' }));
  plan.sections.forEach(s =>
    g.append(
      el(
        'div',
        { class: 'tlh', 'data-si': s.si },
        el(
          'div',
          { class: 'tlhr' },
          el('b', {}, s.name),
          el(
            'button',
            {
              class: 'btn sm wzsec',
              'data-si': s.si,
              title: 'Loop this section',
              onclick: () => wizSecPreview(s.si)
            },
            '▶'
          )
        ),
        el(
          'small',
          {},
          'bars ' +
            (s.start + 1) +
            '–' +
            (s.start + s.bars) +
            (s.fills.length ? ', fills' : '') +
            (s.build ? ', build' : '') +
            (s.impact ? ', impact' : '')
        )
      )
    )
  );
  g.append(el('div', { class: 'tlc lab' }, 'Energy'));
  plan.sections.forEach(s => {
    const n = Object.values(s.cells).filter(c => c.id).length;
    g.append(el('div', { class: 'tlc en' }, el('i', { style: 'height:' + Math.round((n / 8) * 100) + '%' })));
  });
  for (let t = 0; t < 8; t++) {
    if (!devOn(t) || (oneKit() && (t === 1 || t === 2))) continue;
    const pool = t === 0 && oneKit() ? 'full' : TRACK_POOLS[t];
    g.append(
      el(
        'div',
        { class: 'tlc lab', style: '--c:' + TRACK_COLORS[t] },
        el('span', {}, trackLabel(st, t)),
        el(
          'button',
          {
            class: 'btn sm',
            title: 'Pick different patterns for this whole row',
            onclick: () => {
              w.bump[pool] = (w.bump[pool] || 0) + 1;
              if (t === 0) w.bump.fill = (w.bump.fill || 0) + 1;
              for (const k in w.ov) if (k.endsWith(':' + t)) delete w.ov[k];
              re();
            }
          },
          '↻'
        )
      )
    );
    plan.sections.forEach(s => {
      const c = s.cells[t];
      if (!c) {
        g.append(el('div', { class: 'tlc none' }, w.layers[t] ? '' : 'off'));
        return;
      }
      const sel = el('select', {
        class: 'cellsel',
        'aria-label': trackLabel(st, t) + ' in ' + s.name,
        style: '--c:' + TRACK_COLORS[t],
        onchange: e => {
          const v = e.target.value;
          if (v === c.auto) delete w.ov[s.si + ':' + t];
          else w.ov[s.si + ':' + t] = v;
          re();
        }
      });
      sel.append(el('option', { value: '', selected: !c.id }, '(empty)'));
      const ids = [...(st.pools[c.pool] || [])];
      const more = lvPool(st, c.pool).filter(id => !ids.includes(id));
      if (c.id && !ids.includes(c.id) && !more.includes(c.id)) more.unshift(c.id);
      ids.forEach(id => {
        const f = facById(id);
        sel.append(el('option', { value: id, selected: id === c.id }, f.name));
      });
      if (more.length) {
        const og = el('optgroup', { label: 'More patterns (' + more.length + ')' });
        more.forEach(id => {
          const f = facById(id);
          og.append(el('option', { value: id, selected: id === c.id }, f.name));
        });
        sel.append(og);
      }
      let title = '';
      const f = c.id && facById(c.id);
      if (f && f.type === 'tone') {
        const sh = shiftFor(f, w.key);
        title = 'Transposed ' + (sh > 0 ? '+' : '') + sh + ' semitones from ' + f.keyName;
      }
      sel.title = title;
      const pb = el(
        'button',
        {
          class: 'btn sm wzcell',
          'data-t': t,
          title: 'Hear this pattern on track ' + (t + 1),
          disabled: !c.id,
          onclick: () => wizCellPreview(c.id, t)
        },
        '▶'
      );
      pb._f = f || null;
      g.append(el('div', { class: 'tlc cell' }, sel, pb));
    });
  }
  left.append(el('div', { class: 'tlwrap' }, g));
  const opts = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, 'When you create it'));
  [
    ['names', 'Name the tracks and set suggested levels', w.mode === 'replace'],
    ['loop', 'Loop the first drop or hook so you can hear it straight away', true]
  ].forEach(([k, l, en]) =>
    opts.append(
      el(
        'label',
        { class: 'lay' },
        el('input', {
          type: 'checkbox',
          checked: w.opts[k],
          disabled: !en,
          onchange: e => {
            w.opts[k] = e.target.checked;
          }
        }),
        el('span', {}, l)
      )
    )
  );
  left.append(opts);
  const right = el('div', { class: 'wright' });
  right.append(
    el(
      'div',
      { class: 'wcard' },
      el('h3', {}, 'Suggestions'),
      el('ul', {}, ...wizAdvice(w, plan, st).map(x => el('li', {}, x)))
    )
  );
  right.append(soundCard(st));
  right.append(
    el(
      'div',
      { class: 'wcard' },
      el('h3', {}, 'About ' + st.name),
      el('p', { class: 'hint' }, st.vibe),
      el('ul', {}, ...st.tips.map(x => el('li', {}, x)))
    )
  );
  const seen = new Set();
  const kt = KIND_TIPS[st.fam];
  right.append(
    el(
      'div',
      { class: 'wcard' },
      el('h3', {}, 'Section notes'),
      el(
        'ul',
        {},
        ...plan.sections
          .filter(s => !seen.has(s.kind) && seen.add(s.kind))
          .map(s => el('li', {}, el('b', {}, kindsOf(st.fam)[s.kind].name + ': '), kt[s.kind]))
      )
    )
  );
  right.append(
    el(
      'div',
      { class: 'wcard' },
      el('h3', {}, 'Mixing and workflow'),
      el('ul', {}, ...GEN_TIPS.map(x => el('li', {}, x)))
    )
  );
  b.append(el('div', { class: 'wlayout' }, left, right));
  wizSyncPreview();
}
