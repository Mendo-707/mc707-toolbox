import { $, clamp, toast } from '../core/dom.js';
import { ED, S, UI, curClip, getClip } from '../core/state.js';
import { HEAD, barFromX, bw, cmkMenu, selectClip } from './arrangement.js';
import { curPat, patOf, songEnd } from '../core/song-model.js';
import { drawEditor, randomize, shiftNotes } from './editor.js';
import { audition } from '../services/transport.js';
import { cmMarks } from '../services/clip-switch.js';
import { CM, closeMenu, showMenu } from '../ui/menu.js';
import { loopClip, setLoop, updLoopUI } from './clip-ops.js';
import { clipMenuItems, laneMenuItems, rulerMenuItems, trackMenuItems } from './arrangement-menus.js';
import { edOp, fillRow } from './clip-options.js';
import { CHORDS, diatonic, euclidRow } from './editor-tools.js';

function rowSub(c, r) {
  return [
    ...[1, 2, 4, 8].map(n => ({
      label: 'Fill row every ' + n + (n === 1 ? ' step' : ' steps'),
      action: () => edOp(p => fillRow(p, r.id, n))
    })),
    {
      label: 'Euclidean rhythm',
      sub: [3, 4, 5, 6, 7, 9, 11].map(k => ({
        label: k + ' hits per bar',
        action: () => edOp(p => euclidRow(p, r.id, k))
      }))
    },
    '-',
    {
      label: 'Randomize row',
      action: () =>
        edOp(p => {
          p.notes = p.notes.filter(n => n.n !== r.id);
          const N = p.bars * 16;
          for (let s = 0; s < N; s++)
            if (Math.random() < 0.25) p.notes.push({ s, l: 1, n: r.id, v: Math.round(60 + Math.random() * 60) });
        })
    },
    {
      label: 'Clear row',
      danger: true,
      action: () =>
        edOp(p => {
          p.notes = p.notes.filter(n => n.n !== r.id);
        })
    }
  ];
}
function patternSub() {
  return [
    { label: 'Random variation', action: () => edOp(randomize) },
    {
      label: 'Humanize velocities',
      action: () =>
        edOp(p =>
          p.notes.forEach(n => {
            n.v = clamp(n.v + Math.round(Math.random() * 24 - 12), 20, 127);
          })
        )
    },
    {
      label: 'Quantize to 1/16',
      action: () =>
        edOp(p =>
          p.notes.forEach(n => {
            n.s = Math.min(Math.round(n.s), p.bars * 16 - 1);
            n.l = Math.max(1, Math.round(n.l));
          })
        )
    },
    {
      label: 'Reverse',
      action: () =>
        edOp(p =>
          p.notes.forEach(n => {
            n.s = Math.max(0, p.bars * 16 - n.s - n.l);
          })
        )
    },
    { label: 'Shift left one step', action: () => edOp(p => shiftNotes(p, -1)) },
    { label: 'Shift right one step', action: () => edOp(p => shiftNotes(p, 1)) },
    {
      label: 'Double length',
      disabled: (curPat() || { bars: 8 }).bars >= 8,
      action: () =>
        edOp(p => {
          const L = p.bars * 16;
          p.notes.push(...p.notes.map(n => ({ ...n, s: n.s + L })));
          p.bars *= 2;
          ED.fit = false;
        })
    },
    '-',
    {
      label: 'Clear whole pattern',
      danger: true,
      action: () =>
        edOp(p => {
          p.notes = [];
        })
    }
  ];
}
function editorContext(e) {
  e.preventDefault();
  const c = curClip();
  if (!c || !ED.geom) return;
  const p = patOf(c),
    g = ED.geom;
  const ri = Math.floor(e.offsetY / g.rh);
  const r = g.rows[ri];
  if (!r) return;
  const pos = e.offsetX / g.cw;
  const hit = [...p.notes].reverse().find(n => n.n === r.id && pos >= n.s && pos < n.s + Math.max(n.l, 0.5));
  const drum = p.type === 'drum';
  if (hit && e.shiftKey) {
    edOp(pp => {
      pp.notes.splice(pp.notes.indexOf(hit), 1);
    });
    ED.selNotes.delete(hit);
    return;
  }
  const items = [];
  if (hit) {
    if (!ED.selNotes.has(hit)) {
      ED.selNotes.clear();
      ED.selNotes.add(hit);
      drawEditor();
    }
    const tg = () => [...ED.selNotes];
    const cnt = ED.selNotes.size;
    items.push({
      label: cnt > 1 ? 'Delete ' + cnt + ' notes' : 'Delete note',
      danger: true,
      action: () => {
        edOp(pp => {
          pp.notes = pp.notes.filter(n => !ED.selNotes.has(n));
        });
        ED.selNotes.clear();
      }
    });
    items.push({
      label: 'Duplicate',
      action: () =>
        edOp(pp => {
          const t2 = tg();
          const a = Math.min(...t2.map(n => n.s)),
            b = Math.max(...t2.map(n => n.s + n.l));
          const span = Math.max(1, b - a);
          const add = t2.map(n => ({ ...n, s: n.s + span })).filter(n => n.s + n.l <= pp.bars * 16);
          pp.notes.push(...add);
          ED.selNotes.clear();
          add.forEach(n => ED.selNotes.add(n));
        })
    });
    items.push({
      label: 'Velocity',
      sub: [
        ['Ghost', 42],
        ['Soft', 70],
        ['Normal', 100],
        ['Accent', 127]
      ]
        .map(([l, v]) => ({
          label: l + ' (' + v + ')',
          action: () =>
            edOp(() =>
              tg().forEach(n => {
                n.v = v;
              })
            )
        }))
        .concat([
          '-',
          {
            label: '+10',
            action: () =>
              edOp(() =>
                tg().forEach(n => {
                  n.v = clamp(n.v + 10, 1, 127);
                })
              )
          },
          {
            label: '−10',
            action: () =>
              edOp(() =>
                tg().forEach(n => {
                  n.v = clamp(n.v - 10, 1, 127);
                })
              )
          }
        ])
    });
    if (!drum || ED.mode === 'roll')
      items.push({
        label: 'Length',
        sub: [
          ['1/32', 0.5],
          ['1/16', 1],
          ['1/8', 2],
          ['1/4', 4],
          ['1/2', 8],
          ['1 bar', 16]
        ].map(([l, v]) => ({
          label: l,
          action: () =>
            edOp(pp =>
              tg().forEach(n => {
                n.l = Math.max(0.5, Math.min(v, pp.bars * 16 - n.s));
              })
            )
        }))
      });
    if (!drum)
      items.push({
        label: 'Transpose',
        sub: [
          ['+1', 1],
          ['−1', -1],
          ['+12 (octave)', 12],
          ['−12 (octave)', -12],
          ['+7', 7],
          ['−7', -7]
        ].map(([l, v]) => ({
          label: l,
          action: () =>
            edOp(() =>
              tg().forEach(n => {
                n.n = clamp(n.n + v, 0, 127);
              })
            )
        }))
      });
    items.push({
      label: 'Select all in this row',
      action: () => {
        ED.selNotes.clear();
        p.notes.filter(n => n.n === r.id).forEach(n => ED.selNotes.add(n));
        drawEditor();
      }
    });
  } else {
    const sn = ED.mode === 'steps' ? 1 : ED.snap;
    items.push({
      label: 'Add note here',
      action: () => {
        const s = clamp(Math.floor(pos / sn) * sn, 0, g.N - sn);
        edOp(pp => {
          pp.notes.push({ s, l: drum ? 1 : Math.max(sn, 1), n: r.id, v: 100 });
        });
        audition(c.t, r.id, 100);
      }
    });
    if (!drum) {
      const s0 = clamp(Math.floor(pos / sn) * sn, 0, g.N - 1);
      const stamp = iv =>
        edOp(pp => {
          iv.forEach(i => pp.notes.push({ s: s0, l: Math.min(4, g.N - s0), n: clamp(r.id + i, 0, 127), v: 100 }));
        });
      items.push({
        label: 'Chord here (' + r.label + ')',
        sub: CHORDS.map(([nm, iv]) => ({ label: nm, action: () => stamp(iv) })).concat([
          '-',
          { label: 'Triad in key', action: () => stamp(diatonic(p, r.id, 3)) },
          { label: 'Seventh in key', action: () => stamp(diatonic(p, r.id, 4)) }
        ])
      });
    }
  }
  items.push(
    '-',
    {
      label: 'Select all',
      action: () => {
        p.notes.forEach(n => ED.selNotes.add(n));
        drawEditor();
      }
    },
    {
      label: 'Copy selected notes',
      disabled: !ED.selNotes.size,
      action: () => {
        const t2 = [...ED.selNotes];
        const a = Math.min(...t2.map(n => n.s));
        ED.noteClip = { type: p.type, notes: t2.map(n => ({ ...n, s: n.s - a })) };
        toast(t2.length + ' notes copied');
      }
    },
    {
      label: 'Paste notes here',
      disabled: !ED.noteClip || ED.noteClip.type !== p.type,
      action: () =>
        edOp(pp => {
          const a = Math.floor(pos);
          const add = ED.noteClip.notes.map(n => ({ ...n, s: n.s + a })).filter(n => n.s < pp.bars * 16);
          pp.notes.push(...add);
          ED.selNotes.clear();
          add.forEach(n => ED.selNotes.add(n));
        })
    },
    '-',
    { label: 'This row (' + r.label + ')', sub: rowSub(c, r) },
    { label: 'Whole pattern', sub: patternSub() }
  );
  showMenu(e.clientX, e.clientY, items);
}
function labelContext(e) {
  e.preventDefault();
  const c = curClip();
  if (!c || !ED.geom) return;
  const g = ED.geom;
  const r = g.rows[Math.floor(e.offsetY / g.rh)];
  if (!r) return;
  showMenu(e.clientX, e.clientY, [
    { label: 'Preview ' + r.label, action: () => audition(c.t, r.id, 100) },
    '-',
    ...rowSub(c, r)
  ]);
}
function velContext(e) {
  e.preventDefault();
  const c = curClip();
  if (!c) return;
  const all = f => edOp(p => p.notes.forEach(f));
  showMenu(e.clientX, e.clientY, [
    {
      label: 'Set all velocities',
      sub: [40, 70, 100, 127].map(v => ({
        label: String(v),
        action: () =>
          all(n => {
            n.v = v;
          })
      }))
    },
    {
      label: 'Ramp up',
      action: () =>
        edOp(p => {
          const N = p.bars * 16;
          p.notes.forEach(n => {
            n.v = clamp(Math.round(40 + (87 * n.s) / N), 1, 127);
          });
        })
    },
    {
      label: 'Ramp down',
      action: () =>
        edOp(p => {
          const N = p.bars * 16;
          p.notes.forEach(n => {
            n.v = clamp(Math.round(127 - (87 * n.s) / N), 1, 127);
          });
        })
    },
    {
      label: 'Accent every beat',
      action: () =>
        all(n => {
          n.v = n.s % 4 === 0 ? 120 : 85;
        })
    },
    {
      label: 'Randomize',
      action: () =>
        all(n => {
          n.v = Math.round(60 + Math.random() * 67);
        })
    }
  ]);
}
export function initExtra() {
  addEventListener(
    'pointerdown',
    e => {
      if (CM && !CM.contains(e.target)) closeMenu();
    },
    true
  );
  addEventListener('blur', closeMenu);
  addEventListener('resize', closeMenu);
  $('#arr').addEventListener('scroll', closeMenu);
  const inner = $('#arrInner');
  inner.addEventListener('contextmenu', e => {
    if (e.target.matches && e.target.matches('input[type=text],input[type=number]')) return;
    if (e.target.closest('#grabBtn,.thClip')) return;
    e.preventDefault();
    const rc = e.target.closest('.rcells');
    if (rc) {
      const bar = clamp(Math.floor((e.clientX - rc.getBoundingClientRect().left) / bw), 0, S.bars - 1);
      showMenu(e.clientX, e.clientY, rulerMenuItems(bar));
      return;
    }
    const ck = e.target.closest('.cmk');
    if (ck) {
      const lane = ck.closest('.lane'),
        t = +lane.dataset.t,
        bar = Math.round(parseFloat(ck.style.left) / bw),
        mk = cmMarks().find(m => m.t === t && m.bar === bar);
      if (mk) showMenu(e.clientX, e.clientY, cmkMenu(mk));
      return;
    }
    const ce = e.target.closest('.clip');
    if (ce) {
      const c = getClip(ce.dataset.id);
      if (c) {
        if (UI.sel !== c.id) selectClip(c.id);
        {
          const r = $('#rows').getBoundingClientRect();
          UI.ctxBar = (e.clientX - r.left - HEAD) / bw;
        }
        showMenu(e.clientX, e.clientY, clipMenuItems(c));
      }
      return;
    }
    const th = e.target.closest('.thead');
    if (th) {
      showMenu(e.clientX, e.clientY, trackMenuItems(+th.dataset.t));
      return;
    }
    const lane = e.target.closest('.lane');
    if (lane) showMenu(e.clientX, e.clientY, laneMenuItems(+lane.dataset.t, Math.max(0, barFromX(e.clientX))));
  });
  inner.addEventListener('pointermove', e => {
    const rc = e.target.closest('.rcells');
    if (!rc) return;
    const x = e.clientX - rc.getBoundingClientRect().left;
    rc.style.cursor =
      Math.abs(x - S.loop.start * bw) <= 6 || Math.abs(x - S.loop.end * bw) <= 6 ? 'ew-resize' : 'pointer';
  });
  $('#edGrid').addEventListener('contextmenu', editorContext);
  $('#edLabels').addEventListener('contextmenu', labelContext);
  $('#edVel').addEventListener('contextmenu', velContext);
  $('#loopS').addEventListener('change', e => {
    const v = Number(e.target.value) || 1;
    setLoop(v - 1, Math.max(S.loop.end, v));
  });
  $('#loopE').addEventListener('change', e => {
    const v = Number(e.target.value) || S.loop.end;
    setLoop(S.loop.start, Math.max(v, S.loop.start + 0.0625));
  });
  $('#bLoopClip').addEventListener('click', () => {
    const c = curClip();
    if (!c) {
      toast('Select a clip first');
      return;
    }
    loopClip(c);
  });
  $('#bLoopAll').addEventListener('click', () => setLoop(0, Math.max(1, Math.ceil(songEnd()))));
  updLoopUI();
}
