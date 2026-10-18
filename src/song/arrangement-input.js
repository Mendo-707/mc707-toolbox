// Mouse and touch on the arrangement: dragging, resizing and copying clips, the loop range on the
// ruler, and dropping patterns onto lanes.
//
// Reads: S, UI, ED, TR, AU, DRAG, bw.
// Calls up the layers through hooks (core/hooks.js).
import { $, $$, clamp, el } from '../core/dom.js';
import { ED, S, UI, addPattern, curClip, getClip, pushUndo, scheduleSave } from '../core/state.js';
import {
  DRAG,
  HEAD,
  barFromX,
  bw,
  hideGhost,
  placeSrc,
  renderArr,
  rowFromY,
  selectClip,
  setDrag,
  showGhost
} from './arrangement.js';
import { metaOf } from '../library/index.js';
import { MAXBARS, carve, ensureBars, loopLen, placeClip, qBar, wrapOff } from '../core/song-model.js';
import { renderEditor } from './editor.js';
import { AU } from '../services/synth.js';
import { TR } from '../services/transport.js';
import { renderLibrary } from './library-panel.js';
import { blkLabel, clipBlock, clipHasBlocks, editBlock, updLoopUI } from './clip-ops.js';
import { SNAP, snapBar, snapFloor } from './layout.js';
import { devNum, devOn } from '../core/device.js';
import { showMenu } from '../ui/menu.js';
import { clipChangeItems } from './clip-change.js';
import { hooks } from '../core/hooks.js';

// library drag source
let CDRAG = null;
export function initArr() {
  const inner = $('#arrInner');
  $('#arr').addEventListener('scroll', () => {
    const a = $('#arr');
    if (
      !CDRAG &&
      !DRAG &&
      a.scrollWidth > a.clientWidth &&
      a.scrollLeft + a.clientWidth > a.scrollWidth - 120 &&
      S.bars < MAXBARS
    ) {
      S.bars = Math.min(MAXBARS, S.bars + 8);
      renderArr();
      scheduleSave();
    }
  });
  inner.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    const rc = e.target.closest('.rcells');
    if (rc) {
      if (e.target.closest('.mark')) return;
      rulerDown(e, rc);
      return;
    }
    const ce = e.target.closest('.clip');
    if (ce) {
      clipDown(e, ce);
      return;
    }
    const lane = e.target.closest('.lane');
    if (lane) {
      const t = +lane.dataset.t;
      const bar = barFromX(e.clientX);
      if (e.altKey && devOn(t)) {
        e.preventDefault();
        showMenu(e.clientX, e.clientY, [
          { label: 'Track ' + devNum(t) + ', bar ' + (Math.max(0, bar) + 1), disabled: true },
          ...clipChangeItems(t, Math.max(0, bar))
        ]);
        return;
      }
      if (UI.arm) {
        placeSrc(UI.arm, t, bar);
        return;
      }
      if (UI.sel) {
        UI.sel = null;
        ED.selNotes.clear();
        $$('.clip.sel').forEach(x => x.classList.remove('sel'));
        renderEditor();
      }
    }
  });
  inner.addEventListener('dblclick', e => {
    const ce = e.target.closest('.clip');
    if (ce) {
      if (e.target.closest('.grip,.gripl')) return;
      const c = getClip(ce.dataset.id);
      if (c) {
        const r = $('#rows').getBoundingClientRect();
        editBlock(c, (e.clientX - r.left - HEAD) / bw);
      }
      return;
    }
    const lane = e.target.closest('.lane');
    if (!lane) return;
    const t = +lane.dataset.t;
    const bar = Math.max(0, barFromX(e.clientX));
    pushUndo();
    const pid = addPattern(S.tracks[t].type, S.tracks[t].type === 'drum' ? 'New beat' : 'New part', 1, [], {
      key: null
    });
    const c = placeClip(t, bar, pid, 1);
    selectClip(c.id);
    renderArr();
    scheduleSave();
  });
  inner.addEventListener('pointermove', e => {
    const ce = !CDRAG && e.target.closest('.clip');
    let hb = $('#blkHover');
    if (ce) {
      const c = getClip(ce.dataset.id);
      if (c && clipHasBlocks(c)) {
        const r = $('#rows').getBoundingClientRect(),
          { a, b } = clipBlock(c, (e.clientX - r.left - HEAD) / bw);
        if (!hb) hb = el('div', { id: 'blkHover' });
        if (hb.parentNode !== ce) ce.append(hb);
        hb.style.left = (a - c.start) * bw + 'px';
        hb.style.width = Math.max(4, (b - a) * bw - 2) + 'px';
        hb.title = 'Double-click to edit ' + blkLabel(a, b) + ' on its own';
      } else if (hb) hb.remove();
    } else if (hb) hb.remove();
    if (UI.arm && !CDRAG && e.target.closest('.lane')) {
      const meta = metaOf(UI.arm);
      if (!meta) return;
      const row = rowFromY(e.clientY);
      showGhost(row, Math.max(0, barFromX(e.clientX)), meta.bars, S.tracks[row].type === meta.type);
    }
  });
  inner.addEventListener('pointerleave', () => {
    if (!CDRAG) hideGhost();
  });
  inner.addEventListener('dragover', e => {
    if (!DRAG) return;
    e.preventDefault();
    const meta = metaOf(DRAG);
    if (!meta) return;
    const row = rowFromY(e.clientY);
    const ok = S.tracks[row].type === meta.type;
    showGhost(row, Math.max(0, barFromX(e.clientX)), meta.bars, ok);
    e.dataTransfer.dropEffect = ok ? 'copy' : 'none';
    const ae = $('#arr'),
      ar = ae.getBoundingClientRect();
    if (e.clientX > ar.right - 60) ae.scrollLeft += 28;
    const endBar = Math.max(0, barFromX(e.clientX)) + meta.bars;
    if (endBar + 4 > S.bars && S.bars < MAXBARS) {
      ensureBars(endBar);
      renderArr();
    }
  });
  inner.addEventListener('dragleave', e => {
    if (!inner.contains(e.relatedTarget)) hideGhost();
  });
  inner.addEventListener('drop', e => {
    if (!DRAG) return;
    e.preventDefault();
    hideGhost();
    placeSrc(DRAG, rowFromY(e.clientY), Math.max(0, barFromX(e.clientX)));
    setDrag(null);
  });
}
/* loop points stay on the player's 1/32-bar ticks, whatever the clip snap */
const tk = v => Math.round(v * 32) / 32,
  LSN = () => Math.max(SNAP(), 1 / 32);
function rulerDown(e, rc) {
  const r = rc.getBoundingClientRect();
  const x0 = e.clientX;
  const b0 = tk(clamp(snapFloor((e.clientX - r.left) / bw), 0, S.bars - 1));
  const xr = e.clientX - r.left;
  const which = Math.abs(xr - S.loop.start * bw) <= 6 ? 's' : Math.abs(xr - S.loop.end * bw) <= 6 ? 'e' : null;
  if (which) {
    const mv2 = ev => {
      const bb = tk(clamp(snapBar((ev.clientX - r.left) / bw), 0, S.bars));
      if (which === 's') S.loop.start = Math.min(bb, S.loop.end - LSN());
      else S.loop.end = Math.max(bb, S.loop.start + LSN());
      S.loop.on = true;
      updLoopUI();
    };
    const up2 = () => {
      removeEventListener('pointermove', mv2);
      removeEventListener('pointerup', up2);
      scheduleSave();
    };
    addEventListener('pointermove', mv2);
    addEventListener('pointerup', up2);
    return;
  }
  let moved = false;
  const mv = ev => {
    if (!moved && Math.abs(ev.clientX - x0) < 4) return;
    moved = true;
    const b1 = tk(clamp(snapFloor((ev.clientX - r.left) / bw), 0, S.bars - 1));
    S.loop.start = Math.min(b0, b1);
    S.loop.end = tk(Math.max(b0, b1) + LSN());
    S.loop.on = true;
    updLoopUI();
  };
  const up = () => {
    removeEventListener('pointermove', mv);
    removeEventListener('pointerup', up);
    if (!moved) {
      S.cursor = b0;
      if (TR.playing && TR.mode === 'song') {
        TR.tick = b0 * 32;
        TR.vis = [];
        TR.nextTime = Math.max(TR.nextTime, AU.ctx.currentTime + 0.03);
      }
      hooks.updPlayhead(b0);
    }
    scheduleSave();
  };
  addEventListener('pointermove', mv);
  addEventListener('pointerup', up);
}
function clipDown(e, ce) {
  const c = getClip(ce.dataset.id);
  if (!c) return;
  if (UI.arm) {
    UI.arm = null;
    renderLibrary();
    renderArr();
  }
  if (UI.sel !== c.id) selectClip(c.id);
  const rect = ce.getBoundingClientRect();
  const edge = e.clientX > rect.right - 10,
    ledge = e.clientX < rect.left + 8 && rect.width > 24;
  const mode = ledge ? 'trimL' : edge ? 'resize' : 'move';
  CDRAG = {
    c,
    mode,
    x0: e.clientX,
    start: c.start,
    len: c.len,
    off: c.off,
    t: c.t,
    moved: false,
    copy: e.altKey,
    ok: true,
    nt: c.t,
    ns: c.start,
    nl: c.len,
    noff: c.off
  };
  const mv = ev => {
    const d = CDRAG;
    const dx = ev.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(ev.clientY - e.clientY) < 4) return;
    d.moved = true;
    /* hold Shift while dragging to ignore the snap */
    const free = ev.shiftKey,
      sb = v => (free ? qBar(v) : snapBar(v)),
      sn = free ? 0.015625 : SNAP();
    if (d.mode === 'resize') {
      d.nl = qBar(Math.max(sn, sb(d.len + dx / bw)));
      d.ns = d.start;
      d.nt = d.t;
    } else if (d.mode === 'trimL') {
      let delta = sb(dx / bw);
      delta = Math.min(delta, d.len - sn);
      delta = Math.max(delta, -d.start);
      d.ns = qBar(d.start + delta);
      d.nl = qBar(d.len - delta);
      d.nt = d.t;
      d.noff = wrapOff(d.off + delta, loopLen(d.c));
    } else {
      d.ns = Math.max(0, qBar(sb(d.start + dx / bw)));
      d.nl = d.len;
      const row = rowFromY(ev.clientY);
      d.nt = S.tracks[row].type === S.tracks[d.t].type ? row : d.t;
    }
    showGhost(d.nt, d.ns, d.nl, true);
    const ae = $('#arr'),
      ar = ae.getBoundingClientRect();
    if (ev.clientX > ar.right - 50) ae.scrollLeft += 24;
    else if (ev.clientX < ar.left + HEAD + 30 && ae.scrollLeft > 0) ae.scrollLeft -= 24;
    if (d.ns + d.nl + 4 > S.bars && S.bars < MAXBARS) {
      ensureBars(d.ns + d.nl);
      renderArr();
      showGhost(d.nt, d.ns, d.nl, true);
    }
  };
  const up = () => {
    removeEventListener('pointermove', mv);
    removeEventListener('pointerup', up);
    const d = CDRAG;
    CDRAG = null;
    hideGhost();
    if (!d || !d.moved) return;
    pushUndo();
    if (d.copy && d.mode === 'move') {
      carve(d.nt, d.ns, d.ns + d.nl);
      const n = { ...d.c, id: 'c' + S.nextId++, t: d.nt, start: d.ns, len: d.nl };
      S.clips.push(n);
      ensureBars(d.ns + d.nl);
      UI.sel = n.id;
    } else {
      carve(d.nt, d.ns, d.ns + d.nl, d.c.id);
      d.c.t = d.nt;
      d.c.start = d.ns;
      d.c.len = d.nl;
      if (d.mode === 'trimL') d.c.off = d.noff;
      ensureBars(d.ns + d.nl);
    }
    renderArr();
    renderEditor();
    scheduleSave();
  };
  addEventListener('pointermove', mv);
  addEventListener('pointerup', up);
}
export function deleteClip() {
  const c = curClip();
  if (!c) return;
  pushUndo();
  S.clips.splice(S.clips.indexOf(c), 1);
  UI.sel = null;
  ED.selNotes.clear();
  renderArr();
  renderEditor();
  scheduleSave();
}
export function dupClip() {
  const c = curClip();
  if (!c) return;
  pushUndo();
  const n = placeClip(c.t, c.start + c.len, c.pat, c.len);
  n.off = 0;
  n.mute = c.mute;
  n.tr = c.tr;
  n.vel = c.vel;
  selectClip(n.id);
  renderArr();
  scheduleSave();
}
