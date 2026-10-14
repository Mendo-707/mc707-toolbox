import { $, clamp, el, toast } from '../core/dom.js';
import { LANES, NOTE_NAMES, SCALES, noteName } from '../core/theory.js';
import { TRACK_COLORS, devOn } from '../core/device.js';
import { S, addPattern, pushUndo, scheduleSave } from '../core/state.js';
import { deleteClip, dupClip, renderArr } from './arrangement.js';
import { curClip, curPat, patOf, touch } from '../core/song-model.js';
import { TR, audition, startPat, stopPlay } from '../services/transport.js';
import { updTransport } from '../clips/clips-screen.js';
import { toneTracks } from './library-panel.js';
import { clipOptionsEl } from './editor-menus.js';
import { REC, recGroup } from './recording-midi.js';
import { lockPitch } from './editor-tools.js';
import { drawShape, shapeHead } from './automation.js';

export function defaultLo(p, t) {
  if (p.notes.length) return clamp(Math.floor(Math.min(...p.notes.map(n => n.n)) / 12) * 12, 12, 96);
  return { 3: 24, 4: 48, 5: 48, 6: 60, 7: 60 }[t] || 48;
}

/* ---------- pattern editor ---------- */
const LW = 100;
export const ED = {
  mode: 'steps',
  snap: 1,
  zoom: 26,
  lo: 36,
  clipboard: null,
  selNotes: new Set(),
  fit: true,
  geom: null,
  drag: null,
  lastDown: null
};
export const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
export function sizeCanvas(cv, w, h) {
  const d = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12e6 / Math.max(1, w * h))));
  cv.width = Math.max(1, Math.round(w * d));
  cv.height = Math.max(1, Math.round(h * d));
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  const x = cv.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0);
  return x;
}
function edRows(p) {
  if (p.type === 'drum') return LANES.map((l, i) => ({ id: i, label: l[0], sub: noteName(S.drumMap[i]), kind: 'd' }));
  const key = p.key || { root: S.key, scale: S.scale };
  const sc = SCALES[key.scale] || SCALES.chromatic;
  const used = new Set(p.notes.map(n => n.n));
  const lows = [...used],
    inS = m => sc.includes((((m - key.root) % 12) + 12) % 12);
  let hi, lo;
  if (ED.mode === 'roll') {
    hi = Math.max(96, ...lows);
    lo = Math.min(24, ...lows);
  } else {
    hi = Math.max(ED.lo + 24, ...lows);
    lo = Math.min(ED.lo, ...lows);
  }
  const out = [];
  for (let m = hi; m >= lo; m--) {
    if (ED.mode === 'steps' && !inS(m) && !used.has(m)) continue;
    out.push({
      id: m,
      label: noteName(m),
      black: [1, 3, 6, 8, 10].includes(m % 12),
      inScale: inS(m),
      root: (((m - key.root) % 12) + 12) % 12 === 0,
      kind: 't'
    });
  }
  return out;
}
export function renderEditor() {
  const c = curClip();
  $('#edBody').style.display = c ? '' : 'none';
  $('#edEmpty').hidden = !!c;
  if (!c) {
    $('#edHead').textContent = '';
    $('#edVelWrap').hidden = true;
    $('#edShape').hidden = true;
    return;
  }
  renderEdHead();
  layoutEditor();
}
export function renderEdHead() {
  const c = curClip();
  const h = $('#edHead');
  if (!c) {
    h.textContent = '';
    return;
  }
  const p = patOf(c),
    t = S.tracks[c.t];
  const isDrum = p.type === 'drum';
  h.textContent = '';
  const seg = (opts, cur, fn) => {
    const d = el('div', { class: 'seg' });
    opts.forEach(([v, l]) =>
      d.append(el('button', { class: 'btn sm' + (v === cur ? ' on' : ''), onclick: () => fn(v) }, l))
    );
    return d;
  };
  const act = (label, fn, title) => el('button', { class: 'btn sm', title: title || label, onclick: fn }, label);
  h.append(
    el(
      'div',
      { class: 'grp' },
      el('input', {
        type: 'text',
        id: 'edName',
        value: p.name,
        maxlength: 28,
        'aria-label': 'Pattern name',
        onchange: e => {
          pushUndo();
          p.name = e.target.value.trim().slice(0, 28) || p.name;
          touch(p);
        }
      }),
      el('span', { class: 'chip', style: '--c:' + TRACK_COLORS[c.t] }, t.name)
    ),
    seg(
      [
        ['steps', 'Steps'],
        ['roll', 'Piano roll'],
        ['shape', 'Shape']
      ],
      ED.mode,
      v => {
        ED.mode = v;
        ED.fit = true;
        renderEditor();
      }
    ),
    el(
      'div',
      { class: 'grp' },
      el('span', { class: 'hint' }, 'Length'),
      seg(
        [
          [1, '1'],
          [2, '2'],
          [4, '4'],
          [8, '8']
        ],
        p.bars,
        setBars
      ),
      el('span', { class: 'hint' }, 'bars')
    )
  );
  if (ED.mode === 'shape') {
    shapeHead(h, c, p);
    h.append(clipOptionsEl(c, p, p.type === 'drum'));
    updTransport();
    return;
  }
  if (ED.mode === 'roll') {
    const g = el('select', {
      'aria-label': 'Grid',
      onchange: e => {
        ED.snap = +e.target.value;
      }
    });
    [
      [0.5, '1/32'],
      [1, '1/16'],
      [2, '1/8'],
      [4, '1/4'],
      [16, '1 bar']
    ].forEach(([v, l]) => g.append(el('option', { value: v, selected: v === ED.snap }, l)));
    h.append(
      el(
        'div',
        { class: 'grp' },
        el('span', { class: 'hint' }, 'Grid'),
        g,
        el(
          'button',
          {
            class: 'btn sm',
            title: 'Zoom out',
            onclick: () => {
              ED.zoom = Math.max(10, ED.zoom - 6);
              layoutEditor();
            }
          },
          '−'
        ),
        el(
          'button',
          {
            class: 'btn sm',
            title: 'Zoom in',
            onclick: () => {
              ED.zoom = Math.min(70, ED.zoom + 6);
              layoutEditor();
            }
          },
          '+'
        )
      )
    );
  } else if (!isDrum) {
    h.append(
      el(
        'div',
        { class: 'grp' },
        el('span', { class: 'hint' }, 'Octave'),
        el(
          'button',
          {
            class: 'btn sm',
            onclick: () => {
              ED.lo = clamp(ED.lo - 12, 12, 96);
              layoutEditor();
            }
          },
          '▼'
        ),
        el(
          'button',
          {
            class: 'btn sm',
            onclick: () => {
              ED.lo = clamp(ED.lo + 12, 12, 96);
              layoutEditor();
            }
          },
          '▲'
        ),
        el('span', { class: 'hint' }, 'Note length'),
        (() => {
          const g = el('select', {
            'aria-label': 'Note length for new steps',
            onchange: e => {
              ED.snap = +e.target.value;
            }
          });
          [
            [1, '1 step'],
            [2, '2 steps'],
            [4, '4 steps'],
            [8, '8 steps']
          ].forEach(([v, l]) => g.append(el('option', { value: v, selected: v === Math.max(1, ED.snap) }, l)));
          return g;
        })()
      )
    );
  }
  if (!isDrum) {
    const key = p.key || { root: S.key, scale: S.scale };
    const rs = el('select', {
      'aria-label': 'Key',
      onchange: e => {
        pushUndo();
        p.key = { root: +e.target.value, scale: (p.key || key).scale };
        touch(p);
        layoutEditor();
      }
    });
    NOTE_NAMES.forEach((n, i) => rs.append(el('option', { value: i, selected: i === key.root }, n)));
    const ss = el('select', {
      'aria-label': 'Scale',
      onchange: e => {
        pushUndo();
        p.key = { root: (p.key || key).root, scale: e.target.value };
        touch(p);
        layoutEditor();
      }
    });
    Object.keys(SCALES).forEach(n => ss.append(el('option', { value: n, selected: n === key.scale }, n)));
    h.append(
      el(
        'div',
        { class: 'grp' },
        el('span', { class: 'hint' }, 'Key'),
        rs,
        ss,
        el(
          'button',
          {
            class: 'btn sm' + (ED.lock ? ' on' : ''),
            title: 'New notes snap to the scale',
            onclick: () => {
              ED.lock = !ED.lock;
              renderEdHead();
            }
          },
          'Scale lock'
        )
      )
    );
  }
  const tools = el(
    'div',
    { class: 'grp' },
    act(
      'Clear',
      () =>
        edDo(p => {
          p.notes = [];
        }),
      'Remove all notes'
    ),
    act('Random', () => edDo(randomize), 'Fill with a random variation'),
    act(
      'Humanize',
      () =>
        edDo(p =>
          p.notes.forEach(n => {
            n.v = clamp(n.v + Math.round(Math.random() * 24 - 12), 20, 127);
          })
        ),
      'Vary velocities slightly'
    ),
    act(
      'Quantize',
      () =>
        edDo(p =>
          p.notes.forEach(n => {
            n.s = Math.min(Math.round(n.s), p.bars * 16 - 1);
            n.l = Math.max(1, Math.round(n.l));
          })
        ),
      'Snap notes to the 1/16 grid'
    ),
    act('◀', () => edDo(p => shiftNotes(p, -1)), 'Shift left one step'),
    act('▶', () => edDo(p => shiftNotes(p, 1)), 'Shift right one step'),
    act('Reverse', () =>
      edDo(p =>
        p.notes.forEach(n => {
          n.s = Math.max(0, p.bars * 16 - n.s - n.l);
        })
      )
    ),
    act(
      'Double',
      () => {
        if (p.bars >= 8) {
          toast('Patterns are up to 8 bars');
          return;
        }
        edDo(p => {
          const L = p.bars * 16;
          p.notes.push(...p.notes.map(n => ({ ...n, s: n.s + L })));
          p.bars *= 2;
        }, true);
      },
      'Repeat the pattern to double its length'
    )
  );
  if (!isDrum) {
    tools.append(
      act(
        '−1',
        () =>
          edDo(p =>
            p.notes.forEach(n => {
              n.n = clamp(n.n - 1, 0, 127);
            })
          ),
        'Transpose down a semitone'
      ),
      act(
        '+1',
        () =>
          edDo(p =>
            p.notes.forEach(n => {
              n.n = clamp(n.n + 1, 0, 127);
            })
          ),
        'Transpose up a semitone'
      ),
      act(
        '−12',
        () =>
          edDo(p =>
            p.notes.forEach(n => {
              n.n = clamp(n.n - 12, 0, 127);
            })
          ),
        'Down an octave'
      ),
      act(
        '+12',
        () =>
          edDo(p =>
            p.notes.forEach(n => {
              n.n = clamp(n.n + 12, 0, 127);
            })
          ),
        'Up an octave'
      )
    );
  }
  tools.append(
    act(
      'Copy',
      () => {
        const r = barRange(p);
        if (r) {
          const lo = r.a * 16,
            hi = (r.b + 1) * 16;
          ED.clipboard = JSON.stringify({
            type: p.type,
            bars: r.b - r.a + 1,
            notes: p.notes.filter(n => n.s >= lo && n.s < hi).map(n => ({ ...n, s: n.s - lo }))
          });
          toast('Copied bar' + (r.a === r.b ? ' ' + (r.a + 1) : 's ' + (r.a + 1) + '–' + (r.b + 1)));
          return;
        }
        ED.clipboard = JSON.stringify({ type: p.type, bars: p.bars, notes: p.notes });
        toast('Pattern copied');
      },
      'Copy the selected bars, or the whole pattern'
    ),
    act('Paste', () => {
      if (!ED.clipboard) {
        toast('Nothing copied yet');
        return;
      }
      const cb = JSON.parse(ED.clipboard);
      if (cb.type !== p.type) {
        toast('Paste drums into drums, tone into tone');
        return;
      }
      edDo(p => {
        p.bars = cb.bars;
        p.notes = cb.notes.map(n => ({ ...n }));
      });
    })
  );
  const shared = S.clips.filter(x => x.pat === c.pat).length > 1;
  if (shared)
    tools.append(
      act(
        'Make unique',
        () => {
          pushUndo();
          const np = addPattern(p.type, p.name + ' copy', p.bars, p.notes, {
            key: p.key ? { ...p.key } : null,
            role: p.role,
            genre: p.genre
          });
          c.pat = np;
          scheduleSave();
          renderArr();
          renderEditor();
          toast('This clip now has its own copy');
        },
        'This pattern is used by several clips. Give this clip its own copy.'
      )
    );
  const edOn = () =>
    p.type === 'tone' &&
    ED.playOn != null &&
    ED.playOnClip === c.id &&
    S.tracks[ED.playOn] &&
    S.tracks[ED.playOn].type === 'tone' &&
    devOn(ED.playOn)
      ? ED.playOn
      : c.t;
  tools.append(
    el(
      'button',
      {
        class: 'btn sm',
        id: 'bAud',
        onclick: () => {
          if (TR.playing && TR.mode === 'pat' && TR.pat === p) stopPlay();
          else startPat(p, edOn(), ED.aud);
        }
      },
      'Play pattern'
    ),
    ...(p.type === 'tone'
      ? [
          el(
            'select',
            {
              class: 'edPlayOn',
              'aria-label': 'Play the pattern on',
              title: "Hear this pattern through another tone track's sound (the clip stays on its own track)",
              onchange: e => {
                ED.playOn = +e.target.value;
                ED.playOnClip = c.id;
                if (TR.playing && TR.mode === 'pat' && TR.pat === p) startPat(p, edOn(), ED.aud);
              }
            },
            ...toneTracks().map(i =>
              el('option', { value: i, selected: edOn() === i }, 'on ' + S.tracks[i].name + (i === c.t ? ' (own)' : ''))
            )
          )
        ]
      : []),
    act('Duplicate clip', dupClip, 'Place a linked copy right after this clip (Ctrl/Cmd+D)'),
    act('Delete clip', deleteClip, 'Remove this clip from the arrangement (Delete)')
  );
  h.append(tools);
  h.append(recGroup());
  h.append(clipOptionsEl(c, p, isDrum));
  h.append(el('div', { id: 'edBarSel', class: 'edbs' }));
  refreshBarSel();
  updTransport();
}
function barRange(p) {
  const s = ED.barSel;
  if (!s || !p || p.bars < 2) return null;
  return { a: Math.min(s.a, p.bars - 1), b: Math.min(s.b, p.bars - 1) };
}
function edDo(fn, whole) {
  const p = curPat();
  if (!p) return;
  pushUndo();
  const r = whole ? null : barRange(p);
  const bars0 = p.bars;
  if (r) {
    const lo = r.a * 16,
      hi = (r.b + 1) * 16,
      N = hi - lo;
    const inn = [],
      out = [];
    p.notes.forEach(n => (n.s >= lo && n.s < hi ? inn : out).push(n));
    const q = Object.create(p);
    q.bars = r.b - r.a + 1;
    q.notes = inn.map(n => ({ ...n, s: n.s - lo }));
    fn(q);
    p.notes = out.concat(
      q.notes.filter(n => n.s >= 0 && n.s < N).map(n => ({ ...n, s: n.s + lo, l: Math.min(n.l, N - n.s) }))
    );
    ED.selNotes.clear();
    p.notes.forEach(n => {
      if (n.s >= lo && n.s < hi) ED.selNotes.add(n);
    });
  } else {
    fn(p);
    ED.selNotes.clear();
  }
  touch(p);
  if (p.bars !== bars0) renderEdHead();
  layoutEditor();
  refreshBarSel();
}
function bsApply() {
  const p = curPat();
  if (!p) return;
  ED.selNotes.clear();
  const r = barRange(p);
  if (r)
    p.notes.forEach(n => {
      if (n.s >= r.a * 16 && n.s < (r.b + 1) * 16) ED.selNotes.add(n);
    });
  refreshBarSel();
  drawEditor();
}
function bsPick(i, shift) {
  const s = ED.barSel;
  if (shift && s) ED.barSel = { a: Math.min(s.a, i), b: Math.max(s.b, i) };
  else if (s && s.a === i && s.b === i) ED.barSel = null;
  else ED.barSel = { a: i, b: i };
  bsApply();
}
function barRepeat() {
  const p = curPat(),
    r = barRange(p);
  if (!p || !r) return;
  const lo = r.a * 16,
    hi = (r.b + 1) * 16,
    len = hi - lo,
    end = p.bars * 16;
  pushUndo();
  const src = p.notes.filter(n => n.s >= lo && n.s < hi);
  p.notes = p.notes.filter(n => n.s < hi);
  for (let o = hi; o < end; o += len)
    src.forEach(n => {
      const s = n.s - lo + o;
      if (s < end) p.notes.push({ ...n, s, l: Math.min(n.l, end - s) });
    });
  touch(p);
  layoutEditor();
  refreshBarSel();
  toast('Repeated bar' + (r.a === r.b ? ' ' : 's ') + (r.a + 1) + (r.a === r.b ? '' : '–' + (r.b + 1)) + ' to the end');
}
function refreshBarSel() {
  const host = $('#edBarSel');
  const c = curClip();
  if (!host || !c) return;
  const p = patOf(c);
  host.textContent = '';
  if (p.bars < 2 || ED.mode === 'shape') {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const r = barRange(p);
  const shared = S.clips.filter(x => x.pat === c.pat).length;
  host.append(el('span', { class: 'hint' }, 'Edit bars'));
  for (let i = 0; i < p.bars; i++) {
    const has = p.notes.some(n => n.s >= i * 16 && n.s < (i + 1) * 16);
    const b = el(
      'button',
      {
        class: 'btn sm bsc' + (r && i >= r.a && i <= r.b ? ' on' : '') + (has ? ' has' : ''),
        title: 'Bar ' + (i + 1) + (has ? '' : ' (empty)') + '. Click to select, shift-click or drag for a range.',
        'aria-pressed': r && i >= r.a && i <= r.b ? 'true' : 'false'
      },
      String(i + 1)
    );
    b.addEventListener('mousedown', e => {
      if (e.button) return;
      e.preventDefault();
      ED.bsAnchor = i;
      bsPick(i, e.shiftKey);
    });
    b.addEventListener('mouseenter', e => {
      if (e.buttons & 1 && ED.bsAnchor != null) {
        ED.barSel = { a: Math.min(ED.bsAnchor, i), b: Math.max(ED.bsAnchor, i) };
        bsApply();
      }
    });
    b.addEventListener('click', e => {
      if (e.detail === 0) bsPick(i, e.shiftKey);
    });
    host.append(b);
  }
  host.append(
    el(
      'button',
      {
        class: 'btn sm' + (r ? '' : ' on'),
        title: 'Tools affect the whole pattern',
        onclick: () => {
          ED.barSel = null;
          bsApply();
        }
      },
      'All'
    )
  );
  if (r) {
    host.append(
      el(
        'button',
        { class: 'btn sm', title: 'Copy the selected bars over the rest of the pattern', onclick: barRepeat },
        'Repeat to end'
      )
    );
    host.append(
      el(
        'span',
        { class: 'hint' },
        'The tools above only change bar' + (r.a === r.b ? ' ' + (r.a + 1) : 's ' + (r.a + 1) + '–' + (r.b + 1)) + '.'
      )
    );
  }
  if (shared > 1)
    host.append(el('span', { class: 'hint bswarn' }, 'Linked to ' + shared + ' clips. Edits change all of them.'));
}
export function shiftNotes(p, d) {
  const N = p.bars * 16;
  p.notes.forEach(n => {
    n.s = (((n.s + d) % N) + N) % N;
  });
}
function setBars(b) {
  const p = curPat();
  if (!p || p.bars === b) return;
  pushUndo();
  if (b < p.bars) {
    const N = b * 16;
    p.notes = p.notes.filter(n => n.s < N);
    p.notes.forEach(n => {
      n.l = Math.min(n.l, N - n.s);
    });
  }
  p.bars = b;
  touch(p);
  renderEditor();
}
export function randomize(p) {
  const N = p.bars * 16;
  if (p.type === 'drum') {
    const keep = new Set([0, 2, 3]);
    p.notes = p.notes.filter(n => keep.has(n.n));
    const dens = { 1: 0.1, 4: 0.55, 5: 0.1, 6: 0.04, 7: 0.04, 8: 0.05, 10: 0.15, 11: 0.1 };
    for (const lane in dens)
      for (let s = 0; s < N; s++)
        if (Math.random() < dens[lane]) p.notes.push({ s, l: 1, n: +lane, v: Math.round(55 + Math.random() * 50) });
    if (!p.notes.some(n => n.n === 0)) for (let s = 0; s < N; s += 8) p.notes.push({ s, l: 1, n: 0, v: 110 });
  } else {
    const key = p.key || { root: S.key, scale: S.scale };
    const sc = SCALES[key.scale] || SCALES.chromatic;
    const pool = [];
    for (let m = ED.lo; m <= ED.lo + 24; m++) if (sc.includes((((m - key.root) % 12) + 12) % 12)) pool.push(m);
    p.notes = [];
    let s = 0;
    while (s < N) {
      if (Math.random() < 0.55) {
        const l = [1, 1, 2, 2, 3, 4][Math.floor(Math.random() * 6)];
        const len = Math.min(l, N - s);
        p.notes.push({
          s,
          l: len,
          n: pool[Math.floor(Math.random() * pool.length)],
          v: Math.round(70 + Math.random() * 45)
        });
        s += len;
      } else s += 1;
    }
  }
}
export function layoutEditor() {
  const c = curClip();
  if (!c) return;
  const p = patOf(c);
  if (ED.mode === 'shape') {
    $('#edScroll').style.display = 'none';
    $('#edVelWrap').hidden = true;
    $('#edShape').hidden = false;
    drawShape();
    return;
  }
  $('#edScroll').style.display = '';
  $('#edShape').hidden = true;
  const roll = ED.mode === 'roll';
  const cw = roll ? ED.zoom : 26;
  const rows = edRows(p);
  const rh = p.type === 'drum' ? (roll ? 24 : 26) : roll ? 16 : 22;
  const N = p.bars * 16;
  const idx = new Map(rows.map((r, i) => [r.id, i]));
  ED.geom = { rows, idx, cw, rh, N, W: N * cw, H: rows.length * rh };
  $('#edVelWrap').hidden = !roll;
  sizeCanvas($('#edLabels'), LW, ED.geom.H);
  sizeCanvas($('#edGrid'), ED.geom.W, ED.geom.H);
  $('#edGridWrap').style.width = ED.geom.W + 'px';
  if (roll) sizeCanvas($('#edVel'), ED.geom.W, 64);
  if (ED.fit) {
    const sc = $('#edScroll');
    sc.scrollLeft = 0;
    if (p.type === 'tone' && rows.length) {
      const used = p.notes.map(n => n.n);
      const mid = used.length ? used.reduce((a, b) => a + b, 0) / used.length : ED.lo + 12;
      let best = 0,
        bd = 1e9;
      rows.forEach((r, i) => {
        const d = Math.abs(r.id - mid);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      requestAnimationFrame(() => {
        sc.scrollTop = Math.max(0, best * rh - sc.clientHeight / 2);
      });
    } else
      requestAnimationFrame(() => {
        sc.scrollTop = 0;
      });
    ED.fit = false;
  }
  drawEditor();
}
export function drawEditor() {
  const c = curClip();
  const g = ED.geom;
  if (!c || !g) return;
  if (ED.mode === 'shape') {
    drawShape();
    return;
  }
  const p = patOf(c);
  const col = TRACK_COLORS[c.t];
  const roll = ED.mode === 'roll';
  const ink = css('--ink'),
    bg = css('--bg'),
    gA = css('--grid-a'),
    gB = css('--grid-b'),
    gC = css('--grid-c'),
    alt = css('--rowalt'),
    blk = css('--blackkey'),
    panel = css('--panel'),
    mute = css('--mute'),
    line = css('--line');
  /* labels */
  let x = sizeCanvas($('#edLabels'), LW, g.H);
  x.font = '600 11px "Barlow Semi Condensed",system-ui,sans-serif';
  x.textBaseline = 'middle';
  g.rows.forEach((r, i) => {
    const y = i * g.rh;
    x.fillStyle = r.kind === 't' && r.black ? blk : panel;
    x.fillRect(0, y, LW, g.rh);
    if (r.kind === 't' && r.black) {
      x.fillStyle = panel;
      x.globalAlpha = 0.55;
      x.fillRect(0, y, LW, g.rh);
      x.globalAlpha = 1;
      x.fillStyle = blk;
      x.fillRect(0, y, LW, g.rh);
    }
    x.fillStyle = r.root ? col : r.kind === 't' && !r.inScale ? mute : ink;
    x.fillText(r.label, 8, y + g.rh / 2);
    if (r.sub) {
      x.fillStyle = mute;
      x.fillText(r.sub, LW - 30, y + g.rh / 2);
    }
    x.fillStyle = line;
    x.fillRect(0, y + g.rh - 1, LW, 1);
  });
  x.fillStyle = line;
  x.fillRect(LW - 1, 0, 1, g.H);
  /* grid */
  x = sizeCanvas($('#edGrid'), g.W, g.H);
  x.fillStyle = bg;
  x.fillRect(0, 0, g.W, g.H);
  g.rows.forEach((r, i) => {
    const y = i * g.rh;
    if (r.kind === 't') {
      if (r.black) {
        x.fillStyle = blk;
        x.fillRect(0, y, g.W, g.rh);
      } else if (!r.inScale) {
        x.fillStyle = blk;
        x.globalAlpha = 0.6;
        x.fillRect(0, y, g.W, g.rh);
        x.globalAlpha = 1;
      }
      if (r.root) {
        x.fillStyle = col;
        x.globalAlpha = 0.1;
        x.fillRect(0, y, g.W, g.rh);
        x.globalAlpha = 1;
      }
    } else if (i % 2) {
      x.fillStyle = alt;
      x.fillRect(0, y, g.W, g.rh);
    }
    x.fillStyle = r.kind === 't' && r.id % 12 === 0 ? gC : gA;
    x.fillRect(0, y + g.rh - 1, g.W, 1);
  });
  for (let s = 0; s <= g.N; s++) {
    const px = s * g.cw;
    if (s % 16 === 0) x.fillStyle = gC;
    else if (s % 4 === 0) x.fillStyle = gB;
    else if (g.cw >= 10) x.fillStyle = gA;
    else continue;
    x.fillRect(px, 0, 1, g.H);
    if (roll && ED.snap < 1 && g.cw >= 18 && s < g.N) {
      x.fillStyle = gA;
      x.fillRect(px + g.cw / 2, 0, 1, g.H);
    }
  }
  /* notes */
  for (const n of p.notes) {
    const ri = g.idx.get(n.n);
    if (ri === undefined) continue;
    const y = ri * g.rh,
      px = n.s * g.cw,
      sel = ED.selNotes.has(n);
    x.globalAlpha = 0.5 + (0.5 * n.v) / 127;
    x.fillStyle = col;
    if (p.type === 'drum' && !roll) {
      const gh = n.v <= 55,
        ac = n.v >= 115;
      x.globalAlpha = gh ? 0.38 : 1;
      rr(x, px + 2, y + 3, g.cw - 4, g.rh - 6, 4);
      x.fill();
      if (ac) {
        x.globalAlpha = 1;
        x.strokeStyle = ink;
        x.lineWidth = 1.5;
        rr(x, px + 3.5, y + 4.5, g.cw - 7, g.rh - 9, 3);
        x.stroke();
      }
    } else {
      const w = Math.max(n.l * g.cw - 1, 3);
      rr(x, px + 0.5, y + 1, w, g.rh - 2, 2.5);
      x.fill();
      if (!roll && p.type === 'tone' && Math.abs(n.s - Math.round(n.s)) > 0.01) {
        x.globalAlpha = 1;
        x.strokeStyle = ink;
        x.setLineDash([2, 2]);
        x.stroke();
        x.setLineDash([]);
      }
    }
    if (sel) {
      x.globalAlpha = 1;
      x.strokeStyle = ink;
      x.lineWidth = 1.5;
      rr(x, px + 0.5, y + 1, Math.max(n.l * g.cw - 1, 3), g.rh - 2, 2.5);
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  {
    const r = barRange(p);
    if (r) {
      const L = r.a * 16 * g.cw,
        R = (r.b + 1) * 16 * g.cw;
      x.fillStyle = bg;
      x.globalAlpha = 0.55;
      if (L > 0) x.fillRect(0, 0, L, g.H);
      if (R < g.W) x.fillRect(R, 0, g.W - R, g.H);
      x.globalAlpha = 1;
      x.strokeStyle = col;
      x.lineWidth = 2;
      x.strokeRect(L + 1, 1, R - L - 2, g.H - 2);
    }
  }
  if (REC.on && REC.mode === 'step' && REC.pat === p) {
    x.fillStyle = css('--hot');
    x.globalAlpha = 0.25;
    x.fillRect(REC.cur * g.cw, 0, g.cw, g.H);
    x.globalAlpha = 1;
  }
  if (roll) drawVel(p, col, ink, gB);
}
function rr(x, a, b, w, h, r) {
  x.beginPath();
  if (x.roundRect) x.roundRect(a, b, w, h, r);
  else x.rect(a, b, w, h);
}
function drawVel(p, col, ink, gB) {
  const g = ED.geom;
  const x = sizeCanvas($('#edVel'), g.W, 64);
  const h = 64;
  x.clearRect(0, 0, g.W, h);
  for (let s = 0; s <= g.N; s += 4) {
    x.fillStyle = gB;
    x.fillRect(s * g.cw, 0, 1, h);
  }
  for (const n of p.notes) {
    const bx = n.s * g.cw,
      bh = Math.max(2, (n.v / 127) * (h - 6));
    x.globalAlpha = ED.selNotes.has(n) ? 1 : 0.8;
    x.fillStyle = col;
    x.fillRect(bx + 1, h - bh, Math.max(3, Math.min(8, n.l * g.cw - 2)), bh);
    if (ED.selNotes.has(n)) {
      x.strokeStyle = ink;
      x.lineWidth = 1;
      x.strokeRect(bx + 1.5, h - bh + 0.5, Math.max(3, Math.min(8, n.l * g.cw - 2)) - 1, bh - 1);
    }
  }
  x.globalAlpha = 1;
}
export function edPlay(step) {
  const el2 = $('#edPlay');
  if (!el2) return;
  const g = ED.geom;
  if (step < 0 || !g) {
    el2.style.display = 'none';
    return;
  }
  el2.style.display = 'block';
  el2.style.transform = 'translateX(' + step * g.cw + 'px)';
}
export function initEditor() {
  const gc = $('#edGrid'),
    lc = $('#edLabels'),
    vc = $('#edVel');
  lc.addEventListener('pointerdown', e => {
    const c = curClip();
    if (!c || !ED.geom) return;
    const ri = Math.floor(e.offsetY / ED.geom.rh);
    const r = ED.geom.rows[ri];
    if (r) audition(c.t, r.id, 100);
  });
  gc.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    const c = curClip();
    if (!c || !ED.geom) return;
    const p = patOf(c);
    const g = ED.geom;
    const x = e.offsetX,
      y = e.offsetY;
    const ri = Math.floor(y / g.rh);
    const r = g.rows[ri];
    if (!r) return;
    const pos = x / g.cw;
    const isDrum = p.type === 'drum';
    if (ED.mode === 'steps') {
      const st = Math.floor(pos);
      if (st < 0 || st >= g.N) return;
      const hit = p.notes.find(n => n.n === r.id && st >= Math.floor(n.s) && st < Math.ceil(n.s + n.l - 0.001));
      if (hit) {
        pushUndo();
        if (isDrum) {
          if (hit.v >= 115) hit.v = 42;
          else if (hit.v <= 55) p.notes.splice(p.notes.indexOf(hit), 1);
          else hit.v = 127;
          if (p.notes.includes(hit)) audition(c.t, r.id, hit.v);
          touch(p);
          drawEditor();
          return;
        }
        p.notes.splice(p.notes.indexOf(hit), 1);
        touch(p);
        drawEditor();
        ED.drag = { type: 'paint', mode: 'remove', last: st + ':' + r.id };
      } else {
        pushUndo();
        const n = { s: st, l: isDrum ? 1 : Math.max(1, ED.snap >= 1 ? ED.snap : 1), n: r.id, v: 100 };
        p.notes.push(n);
        audition(c.t, r.id, 100);
        touch(p);
        drawEditor();
        ED.drag = { type: 'paint', mode: 'add', last: st + ':' + r.id };
      }
      gc.setPointerCapture(e.pointerId);
      return;
    }
    /* piano roll */
    const hit = [...p.notes].reverse().find(n => n.n === r.id && pos >= n.s && pos <= n.s + n.l);
    if (hit) {
      const now = performance.now();
      if (ED.lastDown && ED.lastDown.n === hit && now - ED.lastDown.t < 320) {
        pushUndo();
        p.notes.splice(p.notes.indexOf(hit), 1);
        ED.selNotes.delete(hit);
        ED.lastDown = null;
        touch(p);
        drawEditor();
        return;
      }
      ED.lastDown = { n: hit, t: now };
      if (e.shiftKey) {
        if (ED.selNotes.has(hit)) ED.selNotes.delete(hit);
        else ED.selNotes.add(hit);
      } else if (!ED.selNotes.has(hit)) {
        ED.selNotes.clear();
        ED.selNotes.add(hit);
      }
      const edge = x > (hit.s + hit.l) * g.cw - 7;
      pushUndo();
      audition(c.t, hit.n, hit.v);
      ED.drag = {
        type: edge ? 'resize' : 'move',
        x0: x,
        ri0: ri,
        orig: [...ED.selNotes].map(n => ({ n, s: n.s, l: n.l, ri: g.idx.get(n.n) }))
      };
    } else {
      ED.selNotes.clear();
      const sn = ED.snap;
      const s = clamp(Math.floor(pos / sn) * sn, 0, g.N - sn);
      const note = { s, l: Math.min(sn, g.N - s), n: lockPitch(r.id, p), v: 100 };
      pushUndo();
      p.notes.push(note);
      ED.selNotes.add(note);
      audition(c.t, r.id, 100);
      ED.drag = { type: 'resize', x0: x, ri0: ri, orig: [{ n: note, s, l: note.l, ri }], created: true };
    }
    touch(p);
    drawEditor();
    gc.setPointerCapture(e.pointerId);
  });
  gc.addEventListener('pointermove', e => {
    const c = curClip();
    if (!c || !ED.geom) return;
    const p = patOf(c);
    const g = ED.geom;
    const d = ED.drag;
    const x = e.offsetX,
      y = e.offsetY;
    if (!d) {
      if (ED.mode === 'roll') {
        const ri = Math.floor(y / g.rh);
        const r = g.rows[ri];
        const pos = x / g.cw;
        const hit = r && p.notes.find(n => n.n === r.id && pos >= n.s && pos <= n.s + n.l);
        gc.style.cursor = hit ? (x > (hit.s + hit.l) * g.cw - 7 ? 'ew-resize' : 'grab') : 'crosshair';
      } else gc.style.cursor = 'pointer';
      return;
    }
    if (d.type === 'paint') {
      const st = Math.floor(x / g.cw),
        ri = Math.floor(y / g.rh);
      const r = g.rows[ri];
      if (!r || st < 0 || st >= g.N) return;
      const key = st + ':' + r.id;
      if (key === d.last) return;
      d.last = key;
      const isDrum = p.type === 'drum';
      const hit = p.notes.find(n => n.n === r.id && st >= Math.floor(n.s) && st < Math.ceil(n.s + n.l - 0.001));
      if (d.mode === 'add' && !hit) {
        p.notes.push({ s: st, l: isDrum ? 1 : Math.max(1, ED.snap >= 1 ? ED.snap : 1), n: r.id, v: 100 });
        audition(c.t, r.id, 100);
      } else if (d.mode === 'remove' && hit) p.notes.splice(p.notes.indexOf(hit), 1);
      else return;
      touch(p);
      drawEditor();
      return;
    }
    const sn = ED.snap;
    const dx = x - d.x0;
    const ds = Math.round(dx / (g.cw * sn)) * sn;
    if (d.type === 'resize') {
      for (const o of d.orig) o.n.l = clamp(o.l + ds, sn, g.N - o.n.s);
    } else {
      const dr = Math.floor(y / g.rh) - d.ri0;
      for (const o of d.orig) {
        o.n.s = clamp(o.s + ds, 0, Math.max(0, g.N - o.n.l));
        const ni = clamp(o.ri + dr, 0, g.rows.length - 1);
        if (g.rows[ni].id !== o.n.n) {
          o.n.n = g.rows[ni].id;
          d.pitchMoved = true;
          audition(c.t, o.n.n, o.n.v);
        }
      }
    }
    touch(p);
    drawEditor();
  });
  const end = () => {
    ED.drag = null;
  };
  gc.addEventListener('pointerup', end);
  gc.addEventListener('pointercancel', end);
  /* velocity lane */
  let vdown = false;
  const setVel = e => {
    const c = curClip();
    if (!c || !ED.geom) return;
    const p = patOf(c);
    const g = ED.geom;
    const x = e.offsetX,
      y = e.offsetY;
    const v = clamp(Math.round((1 - y / 64) * 127 + 4), 1, 127);
    const hits = p.notes.filter(
      n => x >= n.s * g.cw - 2 && x <= n.s * g.cw + Math.max(10, Math.min(n.l * g.cw, 10)) + 2
    );
    if (!hits.length) return;
    const sel = hits.filter(n => ED.selNotes.has(n));
    const targets = sel.length
      ? sel
      : [hits.reduce((a, b) => (Math.abs(a.s * g.cw - x) < Math.abs(b.s * g.cw - x) ? a : b))];
    const first = Math.min(...targets.map(n => n.s));
    p.notes.forEach(n => {
      if (targets.includes(n) || (!sel.length && n.s === first && targets.some(t => t.s === n.s))) n.v = v;
    });
    touch(p);
    drawEditor();
  };
  vc.addEventListener('pointerdown', e => {
    vdown = true;
    pushUndo();
    vc.setPointerCapture(e.pointerId);
    setVel(e);
  });
  vc.addEventListener('pointermove', e => {
    if (vdown) setVel(e);
  });
  vc.addEventListener('pointerup', () => {
    vdown = false;
  });
  $('#edScroll').addEventListener('scroll', () => {
    $('#edVelWrap').scrollLeft = $('#edScroll').scrollLeft;
  });
}
