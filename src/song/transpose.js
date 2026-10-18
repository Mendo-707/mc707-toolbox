// The Transpose dialog: transpose the whole song, a section, a range or chosen tracks, with key
// changes.
//
// Reads: S, UI.
// Calls up the layers through hooks (core/hooks.js).
import { $, clamp, el, toast } from '../core/dom.js';
import { NOTE_NAMES } from '../core/theory.js';
import { TRACK_COLORS } from '../core/device.js';
import { S, UI, curClip, pushUndo, scheduleSave } from '../core/state.js';
import { renderArr } from './arrangement.js';
import { loopLen, qBar, songEnd, wrapOff } from '../core/song-model.js';
import { renderEditor } from './editor.js';
import { applyShape, playFrom, posBarNow, setLoop, shapeSlice } from './clip-ops.js';
import { sectionEnd } from './markers.js';
import { hooks } from '../core/hooks.js';
import { toneTracksAll } from '../core/tracks.js';

/* ---------- transpose dialog (whole song or parts) ---------- */
const XP = {
  scope: 'song',
  a: 1,
  b: 8,
  section: 0,
  fromBar: null,
  tracks: new Set([3, 4, 5, 6, 7]),
  semi: 0,
  mode: 'add',
  from: 5,
  to: 5
};
const songKeyRoot = () => (((S.key + (S.transpose || 0)) % 12) + 12) % 12;
function xpRange() {
  const end = Math.max(1, Math.ceil(songEnd()));
  switch (XP.scope) {
    case 'song':
      return [0, Infinity];
    case 'from':
      return [XP.fromBar != null ? XP.fromBar : Math.floor(posBarNow()), Infinity];
    case 'loop':
      return [S.loop.start, S.loop.end];
    case 'range':
      return [Math.max(0, XP.a - 1), Math.max(XP.a, XP.b)];
    case 'section': {
      const m = S.markers[XP.section];
      return m ? [m.bar, sectionEnd(XP.section)] : [0, end];
    }
    case 'clip': {
      const c = curClip();
      return c ? [c.start, c.start + c.len] : [0, end];
    }
  }
  return [0, Infinity];
}
function xpDescribe() {
  const [a, b] = xpRange();
  if (XP.scope === 'song') return 'the whole song';
  if (!Number.isFinite(b)) return 'bar ' + (a + 1) + ' to the end of the song';
  return 'bars ' + (a + 1) + '–' + b;
}
function xpCounts() {
  const [a, b] = xpRange();
  const cl = S.clips.filter(
    c => XP.tracks.has(c.t) && S.tracks[c.t].type === 'tone' && c.start < b && c.start + c.len > a
  );
  return {
    n: cl.length,
    splits: cl.filter(c => c.start < a || (Number.isFinite(b) && c.start + c.len > b)).length
  };
}
export function splitAtBar(bar, set) {
  for (const c of S.clips.slice()) {
    if (!set.has(c.t) || !(bar > c.start && bar < c.start + c.len)) continue;
    const orig = { ...c },
      end = c.start + c.len;
    S.clips.push(
      applyShape(
        {
          ...c,
          id: 'c' + S.nextId++,
          start: bar,
          len: qBar(end - bar),
          off: wrapOff(c.off + (bar - c.start), loopLen(c))
        },
        shapeSlice(orig, bar, end)
      )
    );
    c.len = qBar(bar - c.start);
    applyShape(c, shapeSlice(orig, orig.start, bar));
  }
}
function mergeClips() {
  S.clips.sort((x, y) => x.t - y.t || x.start - y.start);
  for (let i = S.clips.length - 2; i >= 0; i--) {
    const a = S.clips[i],
      b = S.clips[i + 1];
    if (
      a.t !== b.t ||
      a.pat !== b.pat ||
      Math.abs(a.start + a.len - b.start) > 1e-6 ||
      (a.tr || 0) !== (b.tr || 0) ||
      (a.vel || 0) !== (b.vel || 0) ||
      !!a.mute !== !!b.mute ||
      (a.ll || 0) !== (b.ll || 0)
    )
      continue;
    const pb = loopLen(a);
    if (Math.abs(wrapOff(a.off + a.len, pb) - wrapOff(b.off, pb)) < 1e-6) {
      a.len = qBar(a.len + b.len);
      if (UI.sel === b.id) UI.sel = a.id;
      S.clips.splice(i + 1, 1);
    }
  }
}
function xpApply(reset) {
  const [a, b] = xpRange();
  const semi = reset ? 0 : XP.semi;
  const mode = reset ? 'set' : XP.mode;
  const allTone = toneTracksAll().every(t => XP.tracks.has(t));
  pushUndo();
  if (XP.scope === 'song' && allTone) {
    S.transpose = clamp(mode === 'add' ? (S.transpose || 0) + semi : semi, -24, 24);
    if (reset)
      S.clips.forEach(c => {
        delete c.tr;
      });
  } else {
    const set = XP.tracks;
    if (Number.isFinite(a)) splitAtBar(a, set);
    if (Number.isFinite(b)) splitAtBar(b, set);
    S.clips
      .filter(c => set.has(c.t) && S.tracks[c.t].type === 'tone' && c.start >= a && c.start + c.len <= b)
      .forEach(c => {
        const v = mode === 'add' ? (c.tr || 0) + semi : semi;
        c.tr = clamp(v, -48, 48);
        if (!c.tr) delete c.tr;
      });
    mergeClips();
  }
  renderArr();
  renderEditor();
  hooks.syncExtra();
  scheduleSave();
  toast(
    reset
      ? 'Transposition reset for ' + xpDescribe()
      : 'Transposed ' + xpDescribe() + ' by ' + (semi > 0 ? '+' : '') + semi + ' semitones'
  );
}
export function openXpose(pre) {
  Object.assign(
    XP,
    {
      scope: 'song',
      semi: 0,
      mode: 'add',
      fromBar: null,
      section: 0,
      tracks: new Set(toneTracksAll()),
      from: songKeyRoot(),
      to: songKeyRoot(),
      a: S.loop.start + 1,
      b: S.loop.end
    },
    pre || {}
  );
  if (XP.scope === 'clip' && !curClip()) XP.scope = 'song';
  $('#xpose').hidden = false;
  renderXpose();
}
export function closeXpose() {
  $('#xpose').hidden = true;
}
function renderXpose() {
  const head = $('#xposeHead');
  head.textContent = '';
  head.append(
    el('h2', {}, 'Transpose'),
    el('div', { class: 'steps' }),
    el('button', { class: 'btn sm', onclick: closeXpose }, 'Close')
  );
  const b = $('#xposeBody');
  b.textContent = '';
  b.append(
    el(
      'p',
      { class: 'wlead' },
      'Shift tone parts up or down for the whole song or just one part. Drums are not changed. Changes to parts are stored on each clip, so they are easy to undo or reset.'
    )
  );
  /* scope */
  const scopes = [
    ['song', 'Whole song'],
    ['from', 'From a bar to the end'],
    ['loop', 'The loop range'],
    ['range', 'A bar range'],
    ['section', 'A marked section'],
    ['clip', 'The selected clip']
  ];
  const ss = el('select', {
    'aria-label': 'What to transpose',
    onchange: e => {
      XP.scope = e.target.value;
      renderXpose();
    }
  });
  scopes.forEach(([v, l]) =>
    ss.append(
      el(
        'option',
        {
          value: v,
          selected: XP.scope === v,
          disabled: (v === 'section' && !S.markers.length) || (v === 'clip' && !curClip())
        },
        l + (v === 'section' && !S.markers.length ? ' (add markers first)' : '')
      )
    )
  );
  b.append(el('div', { class: 'xrow' }, el('label', {}, 'What to transpose', ss)));
  if (XP.scope === 'from') {
    b.append(
      el(
        'div',
        { class: 'xrow' },
        el(
          'label',
          {},
          'Starting bar',
          el('input', {
            type: 'number',
            min: 1,
            max: S.bars,
            value: (XP.fromBar != null ? XP.fromBar : Math.floor(posBarNow())) + 1,
            style: 'width:80px',
            onchange: e => {
              XP.fromBar = clamp((+e.target.value || 1) - 1, 0, S.bars - 1);
              renderXpose();
            }
          })
        ),
        el(
          'button',
          {
            class: 'btn sm',
            onclick: () => {
              XP.fromBar = Math.floor(posBarNow());
              renderXpose();
            }
          },
          'Use playhead'
        )
      )
    );
  }
  if (XP.scope === 'range') {
    b.append(
      el(
        'div',
        { class: 'xrow' },
        el(
          'label',
          {},
          'From bar',
          el('input', {
            type: 'number',
            min: 1,
            max: S.bars,
            value: XP.a,
            style: 'width:80px',
            onchange: e => {
              XP.a = clamp(+e.target.value || 1, 1, S.bars);
              if (XP.b < XP.a) XP.b = XP.a;
              renderXpose();
            }
          })
        ),
        el(
          'label',
          {},
          'To bar (inclusive)',
          el('input', {
            type: 'number',
            min: 1,
            max: S.bars,
            value: XP.b,
            style: 'width:80px',
            onchange: e => {
              XP.b = clamp(+e.target.value || 1, XP.a, S.bars);
              renderXpose();
            }
          })
        ),
        el(
          'button',
          {
            class: 'btn sm',
            onclick: () => {
              XP.a = S.loop.start + 1;
              XP.b = S.loop.end;
              renderXpose();
            }
          },
          'Use loop range'
        )
      )
    );
  }
  if (XP.scope === 'section') {
    const sl = el('select', {
      'aria-label': 'Section',
      onchange: e => {
        XP.section = +e.target.value;
        renderXpose();
      }
    });
    S.markers.forEach((m, i) =>
      sl.append(el('option', { value: i, selected: XP.section === i }, m.name + ' (bar ' + (m.bar + 1) + ')'))
    );
    b.append(el('div', { class: 'xrow' }, el('label', {}, 'Section', sl)));
  }
  /* tracks */
  const tw = el('div', { class: 'xrow' });
  toneTracksAll().forEach(t =>
    tw.append(
      el(
        'label',
        {
          class: 'lay',
          style:
            '--c:' +
            TRACK_COLORS[t] +
            ';padding:4px 8px;flex-direction:row;align-items:center;color:var(--ink);font-size:13px'
        },
        el('input', {
          type: 'checkbox',
          checked: XP.tracks.has(t),
          onchange: e => {
            if (e.target.checked) XP.tracks.add(t);
            else XP.tracks.delete(t);
            renderXpose();
          }
        }),
        el('span', {}, t + 1 + ' ' + S.tracks[t].name)
      )
    )
  );
  b.append(el('div', {}, el('div', { class: 'hint' }, 'Tracks to include'), tw));
  /* amount */
  const am = el('select', {
    'aria-label': 'Semitones',
    onchange: e => {
      XP.semi = +e.target.value;
      renderXpose();
    }
  });
  for (let v = -12; v <= 12; v++)
    am.append(el('option', { value: v, selected: XP.semi === v }, (v > 0 ? '+' : '') + v + ' semitones'));
  const q = el('div', { class: 'xq' });
  [-12, -7, -5, -2, -1, 1, 2, 5, 7, 12].forEach(v =>
    q.append(
      el(
        'button',
        {
          class: 'btn sm' + (XP.semi === v ? ' on' : ''),
          onclick: () => {
            XP.semi = v;
            renderXpose();
          }
        },
        (v > 0 ? '+' : '') + v
      )
    )
  );
  b.append(el('div', { class: 'xrow' }, el('label', {}, 'Amount', am)), q);
  const kf = el('select', {
      'aria-label': 'From key',
      onchange: e => {
        XP.from = +e.target.value;
      }
    }),
    kt = el('select', {
      'aria-label': 'To key',
      onchange: e => {
        XP.to = +e.target.value;
      }
    });
  NOTE_NAMES.forEach((n, i) => {
    kf.append(el('option', { value: i, selected: XP.from === i }, n));
    kt.append(el('option', { value: i, selected: XP.to === i }, n));
  });
  b.append(
    el(
      'div',
      { class: 'xrow' },
      el('span', { class: 'hint' }, 'Or change key from'),
      kf,
      el('span', { class: 'hint' }, 'to'),
      kt,
      el(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            const d = (((XP.to - XP.from) % 12) + 12) % 12;
            XP.semi = d > 6 ? d - 12 : d;
            renderXpose();
          }
        },
        'Use this change'
      )
    )
  );
  b.append(
    el(
      'div',
      { class: 'xrow' },
      ...[
        ['add', 'Add to the current transposition'],
        ['set', 'Set exactly (replace it)']
      ].map(([v, l]) =>
        el(
          'label',
          {
            class: 'lay',
            style: 'flex-direction:row;align-items:center;padding:4px 8px;color:var(--ink);font-size:13px'
          },
          el('input', {
            type: 'radio',
            name: 'xpmode',
            checked: XP.mode === v,
            onchange: () => {
              XP.mode = v;
              renderXpose();
            }
          }),
          el('span', {}, l)
        )
      )
    )
  );
  /* result */
  const cnt = xpCounts();
  const allTone = toneTracksAll().every(t => XP.tracks.has(t));
  let txt;
  if (!XP.tracks.size) txt = 'Choose at least one track.';
  else if (XP.scope === 'song' && allTone) {
    const cur = S.transpose || 0;
    const nw = XP.mode === 'add' ? cur + XP.semi : XP.semi;
    txt =
      'The song transpose changes from ' +
      (cur > 0 ? '+' : '') +
      cur +
      ' to ' +
      (nw > 0 ? '+' : '') +
      nw +
      ' semitones for all tone tracks. This is the same setting as “Song transpose” in the MIDI panel.';
  } else
    txt =
      'Applies to ' +
      xpDescribe() +
      ': ' +
      cnt.n +
      ' clip' +
      (cnt.n === 1 ? '' : 's') +
      (cnt.splits ? ', ' + cnt.splits + ' of them will be split at the edges' : '') +
      '.';
  if (XP.semi !== 0 || XP.mode === 'set') txt += ' Amount: ' + (XP.semi > 0 ? '+' : '') + XP.semi + ' semitones.';
  b.append(el('div', { class: 'xres' }, txt));
  const f = $('#xposeFoot');
  f.textContent = '';
  const ok = XP.tracks.size > 0 && (XP.scope !== 'song' || true);
  f.append(
    el(
      'button',
      {
        class: 'btn',
        onclick: () => {
          xpApply(true);
          renderXpose();
        },
        title:
          XP.scope === 'song'
            ? 'Set the song transpose to 0 and clear clip transposes'
            : 'Set the transposition of these clips back to 0'
      },
      'Reset'
    ),
    el('div', { class: 'sp' }),
    el(
      'button',
      {
        class: 'btn',
        disabled: !ok,
        onclick: () => {
          xpApply(false);
          const [a, b2] = xpRange();
          const hi = Number.isFinite(b2) ? b2 : Math.max(a + 1, Math.ceil(songEnd()));
          setLoop(a, Math.min(hi, a + 16));
          closeXpose();
          playFrom(a);
        }
      },
      'Apply and listen'
    ),
    el(
      'button',
      {
        class: 'btn on',
        disabled: !ok,
        onclick: () => {
          xpApply(false);
          closeXpose();
        }
      },
      'Apply'
    )
  );
}
