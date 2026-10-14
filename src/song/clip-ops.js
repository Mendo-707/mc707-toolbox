import { $, clamp, toast } from '../core/dom.js';
import { ED, S, UI, addPattern, pushUndo, scheduleSave } from '../core/state.js';
import { HEAD, bw, renderArr, selectClip } from './arrangement.js';
import { carve, ensureBars, loopLen, patOf, placeClip, q16, wrapOff } from '../core/song-model.js';
import { renderEditor } from './editor.js';
import { AU } from '../services/synth.js';
import { TR, startSong, stopAll } from '../services/transport.js';
import { envInterp, velMul } from '../services/mc-controls.js';
import { hooks } from '../core/hooks.js';

export let CLIPB = null;
export function setClipboard(v) {
  CLIPB = v;
}
export const posBarNow = () => (TR.playing && TR.mode === 'song' && TR.vis[0] ? TR.vis[0].tick / 32 : S.cursor);
export function setCursor(b) {
  S.cursor = Math.max(0, b);
  if (TR.playing && TR.mode === 'song') {
    TR.tick = Math.round(S.cursor * 32);
    TR.vis = [];
    TR.nextTime = Math.max(TR.nextTime, AU.ctx.currentTime + 0.03);
  }
  hooks.updPlayhead(S.cursor);
  scheduleSave();
}
export function playFrom(b) {
  stopAll();
  S.cursor = Math.max(0, b);
  hooks.updPlayhead(S.cursor);
  startSong();
}
export function updLoopUI() {
  const lb = $('#loopband'),
    rl = $('.rloop');
  if (lb) {
    lb.style.display = S.loop.on ? 'block' : 'none';
    lb.style.left = HEAD + S.loop.start * bw + 'px';
    lb.style.width = (S.loop.end - S.loop.start) * bw + 'px';
  }
  if (rl) {
    rl.classList.toggle('on', S.loop.on);
    rl.style.left = S.loop.start * bw + 'px';
    rl.style.width = (S.loop.end - S.loop.start) * bw + 'px';
  }
  hooks.syncControls();
}
export function setLoop(a, b) {
  a = clamp(q16(a), 0, Math.max(0, S.bars - 0.0625));
  b = clamp(q16(b), a + 0.0625, S.bars);
  S.loop = { on: true, start: a, end: b };
  updLoopUI();
  scheduleSave();
}
export function loopClip(c) {
  setLoop(c.start, c.start + c.len);
}
export function setClipTr(c, v) {
  pushUndo();
  c.tr = clamp(v, -48, 48);
  if (!c.tr) delete c.tr;
  renderArr();
  scheduleSave();
}
export function setClipLen(c, n) {
  pushUndo();
  n = Math.max(0.0625, q16(n));
  carve(c.t, c.start, c.start + n, c.id);
  c.len = n;
  ensureBars(c.start + n);
  renderArr();
  renderEditor();
  scheduleSave();
}
/* When a clip is cut into pieces, each piece keeps exactly the part of the fades, velocity shape and CC automation it covered. */
export function shapeSlice(c, a, b) {
  const o = {},
    L = c.len,
    x0 = (a - c.start) / L,
    x1 = (b - c.start) / L,
    len = b - a;
  if (c.fi > 0 || c.fo > 0 || (c.ve && c.ve.length)) {
    const N = Math.max(8, Math.min(128, Math.ceil(len * 16)));
    o.ve = [];
    for (let i = 0; i <= N; i++) o.ve.push([i / N, +velMul(c, a - c.start + (len * i) / N).toFixed(4)]);
  }
  if (c.cc && c.cc.pts && c.cc.pts.length) {
    const pts = [[0, envInterp(c.cc.pts, x0, 0.5)]];
    c.cc.pts.forEach(([x, v]) => {
      if (x > x0 + 1e-9 && x < x1 - 1e-9) pts.push([(x - x0) / (x1 - x0), v]);
    });
    pts.push([1, envInterp(c.cc.pts, x1, 0.5)]);
    o.cc = { ...c.cc, pts };
  }
  return o;
}
export function applyShape(piece, o) {
  if (o.ve) {
    piece.ve = o.ve;
    delete piece.fi;
    delete piece.fo;
    delete piece.fcv;
  }
  if (o.cc) piece.cc = o.cc;
  return piece;
}
export function splitClip(c, bar) {
  pushUndo();
  const orig = { ...c },
    end = c.start + c.len;
  S.clips.push(
    applyShape(
      {
        ...c,
        id: 'c' + S.nextId++,
        start: bar,
        len: q16(end - bar),
        off: wrapOff(c.off + (bar - c.start), loopLen(c))
      },
      shapeSlice(orig, bar, end)
    )
  );
  c.len = q16(bar - c.start);
  applyShape(c, shapeSlice(orig, orig.start, bar));
  renderArr();
  scheduleSave();
}
/* One repeat of a looped clip: the bars [a,b) around a song bar. */
export function clipBlock(c, bar) {
  const L = loopLen(c),
    pos = bar - c.start + c.off,
    r = Math.floor(pos / L + 1e-9);
  const bs = c.start + r * L - c.off;
  return { a: Math.max(c.start, q16(bs)), b: Math.min(c.start + c.len, q16(bs + L)) };
}
export const blkLabel = (a, b) =>
  b - a > 1 + 1e-6 ? 'bars ' + (Math.floor(a) + 1) + '–' + Math.ceil(b) : 'bar ' + (Math.floor(a) + 1);
export const clipHasBlocks = c => c.len > loopLen(c) + 1e-6 || S.clips.filter(x => x.pat === c.pat).length > 1;
/* Edit just this block: split the clip around one repeat and give that repeat its own copy of the pattern. */
export function editBlock(c, bar) {
  const p = patOf(c),
    L = loopLen(c);
  if (!p) return;
  const { a, b } = clipBlock(c, bar),
    end = c.start + c.len,
    shared = S.clips.filter(x => x.pat === c.pat).length > 1;
  if (!(c.len > L + 1e-6) && !shared) {
    selectClip(c.id);
    return;
  }
  pushUndo();
  let target = c;
  const orig = { ...c };
  if (b < end - 1e-6) {
    S.clips.push(
      applyShape(
        { ...c, id: 'c' + S.nextId++, start: b, len: q16(end - b), off: wrapOff(c.off + (b - c.start), L) },
        shapeSlice(orig, b, end)
      )
    );
    c.len = q16(b - c.start);
  }
  if (a > c.start + 1e-6) {
    const m = applyShape(
      { ...c, id: 'c' + S.nextId++, start: a, len: q16(b - a), off: wrapOff(c.off + (a - c.start), L) },
      shapeSlice(orig, a, b)
    );
    c.len = q16(a - c.start);
    S.clips.push(m);
    target = m;
    applyShape(c, shapeSlice(orig, orig.start, a));
  } else if (b < end - 1e-6) applyShape(c, shapeSlice(orig, orig.start, b));
  const fmt = x => Math.floor(x) + 1;
  target.pat = addPattern(
    p.type,
    p.name + ' (bar' + (b - a > 1 ? 's ' : ' ') + fmt(a) + (b - a > 1 ? '–' + Math.ceil(b) : '') + ')',
    p.bars,
    p.notes,
    { key: p.key ? { ...p.key } : null, role: p.role, genre: p.genre }
  );
  selectClip(target.id);
  renderArr();
  renderEditor();
  scheduleSave();
  toast(
    'Editing bar' +
      (b - a > 1 ? 's ' + fmt(a) + '–' + Math.ceil(b) : ' ' + fmt(a)) +
      ' on its own. The other repeats are unchanged.'
  );
}
/* Glue: join clips that touch on one track back into one clip. Fades, velocity, transpose and mutes are baked in.
   If the result repeats, it becomes a short looping pattern again; if it matches an existing pattern, the clip relinks to it. */
const GLUE_BARS = [1, 2, 4, 8, 16, 32];
export function glueRun(c, dir) {
  const same = S.clips.filter(x => x.t === c.t).sort((a, b) => a.start - b.start),
    touch = (x, y) => Math.abs(x.start + x.len - y.start) < 1e-6;
  let a = same.indexOf(c),
    b = a;
  if (a < 0) return [];
  if (dir === 'next') {
    if (b + 1 < same.length && touch(same[b], same[b + 1])) b++;
  } else {
    while (a > 0 && touch(same[a - 1], same[a])) a--;
    while (b + 1 < same.length && touch(same[b], same[b + 1])) b++;
  }
  return same.slice(a, b + 1);
}
const glueBase = n =>
  String(n || '')
    .replace(/\s*\((?:bars? [\d–\-]+|glued)\)\s*$/, '')
    .replace(/ copy$/, '')
    .trim();
const glueSig = ns =>
  ns
    .map(n => [(+n.s).toFixed(3), n.n, Math.round(n.v), (+n.l).toFixed(3)].join(','))
    .sort()
    .join(';');
export function glueClips(run) {
  if (run.length < 2) {
    toast('Nothing to glue: the next clip has to start exactly where this one ends');
    return;
  }
  const t = run[0].t,
    tone = S.tracks[t].type === 'tone',
    s0 = run[0].start,
    total = q16(run.reduce((n, x) => n + x.len, 0));
  if (total > 32 + 1e-6) {
    toast('Glue joins up to 32 bars at a time');
    return;
  }
  const notes = [];
  for (const c of run) {
    if (c.mute) continue;
    const p = patOf(c);
    if (!p) continue;
    const L = loopLen(c),
      vm = (c.vel || 100) / 100,
      shaped = c.fi > 0 || c.fo > 0 || (c.ve && c.ve.length);
    for (let k = Math.floor(c.off / L) - 1; k * L - c.off < c.len; k++)
      for (const n of p.notes) {
        if (n.s / 16 >= L - 1e-9) continue;
        const pos = n.s / 16 + k * L - c.off;
        if (pos < -1e-9 || pos >= c.len - 1e-9) continue;
        notes.push({
          ...n,
          s: +((c.start - s0 + pos) * 16).toFixed(4),
          l: +Math.min(n.l, (c.len - pos) * 16).toFixed(4),
          n: tone ? clamp(n.n + (c.tr || 0), 0, 127) : n.n,
          v: clamp(Math.round(n.v * vm * (shaped ? velMul(c, pos) : 1)), 1, 127)
        });
      }
  }
  /* shortest repeating loop that covers the whole glued stretch */
  let bars = GLUE_BARS.find(b => b >= total - 1e-6),
    body = notes;
  for (const P of GLUE_BARS) {
    if (P >= total - 1e-6 || Math.abs(total / P - Math.round(total / P)) > 1e-6) continue;
    const base = notes.filter(n => n.s < P * 16 - 1e-6),
      reps = Math.round(total / P),
      exp = [];
    for (let k = 0; k < reps; k++) base.forEach(n => exp.push({ ...n, s: n.s + k * P * 16 }));
    if (glueSig(exp) === glueSig(notes)) {
      bars = P;
      body = base;
      break;
    }
  }
  const p0 = patOf(run[0]),
    sig = glueSig(body);
  const match = [...new Set(run.map(c => c.pat))]
    .map(id => S.patterns[id])
    .find(p => p && p.bars === bars && glueSig(p.notes) === sig);
  const names = [...new Set(run.map(c => glueBase(patOf(c).name)))];
  const pid = match
    ? match.id
    : addPattern(
        p0.type,
        (names.length === 1 ? names[0] : names[0] + ' (glued)').slice(0, 40),
        bars,
        body.map(n => ({ ...n })),
        { key: p0.key ? { ...p0.key } : null, role: p0.role, genre: p0.genre }
      );
  pushUndo();
  const ccs = run.filter(c => c.cc && c.cc.pts && c.cc.pts.length),
    cn = ccs.length ? ccs[0].cc.n : null;
  const nc = { id: 'c' + S.nextId++, t, start: s0, len: total, off: 0, pat: pid };
  if (run[0].pc != null) nc.pc = run[0].pc;
  if (ccs.length) {
    const pts = [];
    ccs
      .filter(c => c.cc.n === cn)
      .forEach(c => c.cc.pts.forEach(([x, v]) => pts.push([+((c.start - s0 + x * c.len) / total).toFixed(5), v])));
    pts.sort((a, b) => a[0] - b[0]);
    nc.cc = { ...ccs[0].cc, pts };
  }
  const ids = new Set(run.map(c => c.id));
  S.clips = S.clips.filter(c => !ids.has(c.id));
  S.clips.push(nc);
  selectClip(nc.id);
  renderArr();
  renderEditor();
  scheduleSave();
  toast(
    'Glued ' +
      run.length +
      ' clips into one (' +
      (total === 1 ? '1 bar' : total + ' bars') +
      (bars < total ? ', looping a ' + bars + '-bar pattern' : '') +
      (match ? ', back to the original pattern' : '') +
      ')' +
      (ccs.some(c => c.cc.n !== cn) ? '. Only one automation lane was kept.' : '')
  );
}
export function copyClipTo(c, t) {
  pushUndo();
  carve(t, c.start, c.start + c.len);
  const n = { ...c, id: 'c' + S.nextId++, t };
  S.clips.push(n);
  selectClip(n.id);
  renderArr();
  scheduleSave();
}
export function makeUnique(c) {
  const p = patOf(c);
  pushUndo();
  c.pat = addPattern(p.type, p.name + ' copy', p.bars, p.notes, {
    key: p.key ? { ...p.key } : null,
    role: p.role,
    genre: p.genre
  });
  renderArr();
  renderEditor();
  scheduleSave();
  toast('This clip now has its own copy');
}
export function deleteClipById(id) {
  pushUndo();
  const i = S.clips.findIndex(c => c.id === id);
  if (i >= 0) S.clips.splice(i, 1);
  if (UI.sel === id) {
    UI.sel = null;
    ED.selNotes.clear();
  }
  renderArr();
  renderEditor();
  scheduleSave();
}
export function pasteClip(t, bar) {
  if (!CLIPB) {
    toast('Copy a clip first');
    return;
  }
  const p = S.patterns[CLIPB.pat];
  if (!p) {
    toast('That pattern no longer exists');
    return;
  }
  if (S.tracks[t].type !== p.type) {
    toast(p.type === 'drum' ? 'Drum clips go on tracks 1–3' : 'Tone clips go on tracks 4–8');
    return;
  }
  pushUndo();
  carve(t, bar, bar + CLIPB.len);
  const n = { ...CLIPB, id: 'c' + S.nextId++, t, start: bar };
  S.clips.push(n);
  ensureBars(bar + n.len);
  selectClip(n.id);
  renderArr();
  scheduleSave();
}
export function newPatternAt(t, bar) {
  pushUndo();
  const type = S.tracks[t].type;
  const pid = addPattern(type, type === 'drum' ? 'New beat' : 'New part', 1, [], { key: null });
  const c = placeClip(t, bar, pid, 1);
  selectClip(c.id);
  renderArr();
  scheduleSave();
}
