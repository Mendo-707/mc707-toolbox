// The song wizard's structure step: sections, lengths, complexity and key changes.
//
// Reads: WIZ.
import { MOODS, moodName } from '../library/mood.js';
import { clamp, el, fmtDur } from '../core/dom.js';
import { TRACK_COLORS, devNum, devOn, oneKit } from '../core/device.js';
import { NK, STRUCT, trackLabel } from '../library/styles.js';
import { WIZ, curStyle, renderWiz } from './wizard-ui.js';
import { defaultSecs, kindsOf } from './wizard-styles.js';
import { poolOf, slotOf, trackOf } from '../core/tracks.js';

export function wizStep3(b) {
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
  /* mood: leans the picks inside the style, and sets the tempo and fill spacing to match */
  const mood = el(
    'select',
    {
      'aria-label': 'Mood',
      style: 'max-width:260px;display:block;margin:4px 0',
      onchange: e => {
        const p = MOODS.find(x => x[0] === e.target.value);
        w.mood = p ? { i: p[2], c: p[3] } : null;
        if (p && Math.abs(p[2] - 50) >= 15) {
          const [lo, hi] = curStyle().bpm;
          w.bpm = Math.round(lo + ((hi - lo) * p[2]) / 100);
          w.fillEvery = p[2] >= 70 ? 4 : p[2] <= 35 ? 16 : w.fillEvery;
        }
        w.ov = {};
        rerender();
      }
    },
    el('option', { value: 'off' }, 'Off: anything in the style'),
    ...MOODS.map(([v, n]) => el('option', { value: v, selected: !!w.mood && moodName(w.mood) === n }, n))
  );
  feel.append(
    el(
      'div',
      { class: 'row' },
      el(
        'label',
        { class: 'lay', style: 'flex:1;min-width:180px' },
        el(
          'span',
          {},
          el('b', {}, 'Mood '),
          mood,
          el(
            'small',
            {},
            'Angry and Driving pick harder, busier, darker parts and a faster tempo; Chill and Dreamy softer, sparser, brighter ones and a slower tempo. It stays inside the style.'
          )
        )
      )
    )
  );
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
    if (devOn(t) && !(oneKit() && (slotOf(t) === 1 || slotOf(t) === 2)))
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
            el(
              'small',
              {},
              t === trackOf(0) && oneKit()
                ? 'Full kit: kick, snare, hats and percussion'
                : poolOf(t) === 'acid'
                  ? 'Acid line'
                  : what[slotOf(t)]
            )
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
export function wizAdvice(w, plan, st) {
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
