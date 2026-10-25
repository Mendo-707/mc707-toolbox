// The pattern editor's toolbar: name, length, key, steps or piano roll, the tools, and which bars
// are being edited.
//
// Reads: S, ED, TR.
// Calls up the layers through hooks (core/hooks.js).
import { $, clamp, el, toast } from '../core/dom.js';
import { NOTE_NAMES, SCALES } from '../core/theory.js';
import { TRACK_COLORS, devOn } from '../core/device.js';
import { ED, S, addPattern, edClip, pushUndo, scheduleSave } from '../core/state.js';
import { renderArr } from './arrangement.js';
import { patOf, touch } from '../core/song-model.js';
import { edDo, layoutEditor, randomize, refreshBarSel, renderEditor, setBars, shiftNotes } from './editor.js';
import { TR, startPat, stopPlay } from '../services/transport.js';
import { deleteClip, dupClip } from './arrangement-input.js';
import { toneTracks } from './library-panel.js';
import { clipOptionsEl } from './clip-options.js';
import { recGroup } from './recording-midi.js';
import { shapeHead } from './shape-editor.js';
import { closeView, placeView, saveToMine, viewLabel } from './lib-view.js';
import { hooks } from '../core/hooks.js';

export function renderEdHead() {
  const c = edClip();
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
    ...(c.view ? [viewGroup(c)] : []),
    seg([['steps', 'Steps'], ['roll', 'Piano roll'], ...(c.view ? [] : [['shape', 'Shape']])], ED.mode, v => {
      ED.mode = v;
      ED.fit = true;
      renderEditor();
    }),
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
    hooks.updTransport();
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
  const shared = !c.view && S.clips.filter(x => x.pat === c.pat).length > 1;
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
    ...recordSample(c, p),
    ...(c.view
      ? []
      : [
          act('Save to My patterns', () => saveToMine(c), 'Keep this pattern in your own library, for every song'),
          act(
            '→ MC-707 clip',
            () => hooks.clipWriteAsk(p, c.t),
            'Write this pattern into an empty clip on the MC-707 (experimental)'
          ),
          act('Duplicate clip', dupClip, 'Place a linked copy right after this clip (Ctrl/Cmd+D)'),
          act('Delete clip', deleteClip, 'Remove this clip from the arrangement (Delete)')
        ])
  );
  h.append(tools);
  if (!c.view) {
    h.append(recGroup());
    h.append(clipOptionsEl(c, p, isDrum));
  }
  h.append(el('div', { id: 'edBarSel', class: 'edbs' }));
  refreshBarSel();
  hooks.updTransport();
  hooks.grabUI();
}
/* Record sample: this pattern on its own, played through the track picked here, to a WAV */
function recordSample(c, p) {
  const same = S.tracks.map((x, i) => i).filter(i => S.tracks[i].type === p.type && devOn(i));
  if (!same.length) return [];
  if (!same.includes(ED.recOn)) ED.recOn = same.includes(c.t) ? c.t : same[0];
  const sel = el(
    'select',
    {
      class: 'edRecOn',
      'aria-label': 'Record the sample from',
      title:
        'The track the pattern plays on while it is recorded (its own audio channel when Audio has per-track channels)',
      onchange: e => {
        ED.recOn = +e.target.value;
      }
    },
    ...same.map(i => el('option', { value: i, selected: ED.recOn === i }, 'from ' + S.tracks[i].name))
  );
  const b = el(
    'button',
    {
      class: 'btn sm',
      id: 'edGrab',
      title: 'Record this pattern on its own to a WAV, played on the track you choose',
      onclick: e => hooks.grabPattern(p, ED.recOn, 1, e.currentTarget)
    },
    '● Record sample'
  );
  return [b, sel];
}
/* the banner for a library pattern open in the editor: where it came from, place it, keep it, close */
function viewGroup(c) {
  const b = (label, fn, title, on) =>
    el('button', { class: 'btn sm' + (on ? ' on' : ''), title: title || label, onclick: fn }, label);
  return el(
    'div',
    { class: 'grp edView' },
    el('span', { class: 'hint' }, viewLabel(c)),
    b('Place at playhead', placeView, 'Put this pattern in the song at the playhead', true),
    c.kind === 'user'
      ? b('Update My pattern', () => saveToMine(c, true), 'Save your changes over this pattern in My patterns')
      : null,
    b('Save to My patterns', () => saveToMine(c), 'Keep a copy in your own library, for every song'),
    b(
      '→ MC-707 clip',
      () => hooks.clipWriteAsk(patOf(c), c.t),
      'Write this pattern into an empty clip on the MC-707 (experimental)'
    ),
    b('Close', closeView, 'Close the pattern without placing it')
  );
}
export function barRange(p) {
  const s = ED.barSel;
  if (!s || !p || p.bars < 2) return null;
  return { a: Math.min(s.a, p.bars - 1), b: Math.min(s.b, p.bars - 1) };
}
