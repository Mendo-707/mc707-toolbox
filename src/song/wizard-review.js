// The song wizard's last step: review and create the song.
//
// Reads: TR, WIZ.
import { el } from '../core/dom.js';
import { TRACK_COLORS, devOn, oneKit } from '../core/device.js';
import { TRACK_POOLS, facById, shiftFor } from '../library/index.js';
import { TR, stopPlay } from '../services/transport.js';
import { GEN_TIPS, KIND_TIPS, trackLabel } from '../library/styles.js';
import { WIZ, renderWiz } from './wizard-ui.js';
import { KEYTXT, kindsOf, wizPlan } from './wizard-styles.js';
import { wizCellPreview, wizSecPreview, wizSongPreview, wizSyncPreview } from './wizard-plan.js';
import { wizAdvice } from './wizard-structure.js';
import { soundCard } from './sound-suggestions.js';
import { lvPool } from '../library/pools.js';

export function wizStep4(b) {
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
