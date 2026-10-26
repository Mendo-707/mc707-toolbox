// The Song Mode arrangement: tracks, clips, the ruler and markers, clip-change flags, zoom, and
// placing patterns.
//
// Owns: DRAG (library drag), bw (bar width), ROWH (row height).
// Reads: S, UI, ED, TR, REC, CMNOW, SH.
// Calls up the layers through hooks (core/hooks.js).
import { $, $$, clamp, el, toast } from '../core/dom.js';
import { TRACK_COLORS, devNm, devNum, devOn } from '../core/device.js';
import { ED, S, UI, curClip, pushUndo, scheduleSave } from '../core/state.js';
import { instFactory, metaOf } from '../library/index.js';
import { loopLen, patOf, placeClip } from '../core/song-model.js';
import { defaultLo, renderEditor } from './editor.js';
import { REC, TR } from '../services/transport.js';
import { CMNOW, cmFix, cmMarks, ctInfo } from '../services/clip-switch.js';
import { cmAtBar, cmChipFill, cmLabel, cmPickItems, delClipMark } from '../clips/clip-map.js';
import { renderLibrary } from './library-panel.js';
import { renderEdHead } from './editor-head.js';
import { showMenu } from '../ui/menu.js';
import { posBarNow } from './clip-ops.js';
import { recStop } from './recording-midi.js';
import { loopSection, markerMenu, renameMarker } from './markers.js';
import { fitRows, snapFloor } from './layout.js';
import { SH, drawClipOverlay } from './shape-editor.js';
import { clipChangeItems } from './clip-change.js';
import { hooks } from '../core/hooks.js';

export const HEAD = 196,
  RULERH = 40;
export let ROWH = 54;
export function setRowHeight(v) {
  ROWH = v;
}
export let bw = 64;
export function setBarWidth(v) {
  bw = v;
}
let arrPending = false;
export function scheduleUI() {
  scheduleSave();
  if (!arrPending) {
    arrPending = true;
    requestAnimationFrame(() => {
      arrPending = false;
      renderArr();
      if (UI.libTab === 'proj') renderLibrary();
    });
  }
}
export function placeSrc(src, t, bar) {
  const meta = metaOf(src);
  if (!meta) return false;
  if (S.tracks[t].type !== meta.type) {
    toast(meta.type === 'drum' ? 'Drum patterns go on tracks 1–3' : 'Tone patterns go on tracks 4–8');
    return false;
  }
  pushUndo();
  const pid = src.kind === 'fac' || src.kind === 'user' ? instFactory(meta) : src.id;
  const c = placeClip(t, Math.max(0, bar), pid, meta.bars);
  selectClip(c.id);
  renderArr();
  scheduleSave();
  return true;
}
export function selectClip(id) {
  if (REC.on && UI.sel !== id) recStop();
  UI.sel = id;
  UI.view = null;
  ED.barSel = null;
  ED.selNotes.clear();
  ED.fit = true;
  ED.aud = null;
  SH.sel = -1;
  const c = curClip();
  if (c) {
    const p = patOf(c);
    if (p.type === 'tone') ED.lo = defaultLo(p, c.t);
  }
  $$('.clip').forEach(e => e.classList.toggle('sel', e.dataset.id === id));
  renderEditor();
}

/* ---------- arrangement ---------- */
export let DRAG = null;
export function setDrag(v) {
  DRAG = v;
}
// clip drag state
export function renderArr() {
  fitRows();
  const inner = $('#arrInner');
  inner.style.setProperty('--bw', bw + 'px');
  inner.style.setProperty('--head', HEAD + 'px');
  inner.style.setProperty('--rowh', ROWH + 'px');
  inner.classList.toggle('armed', !!UI.arm);
  inner.textContent = '';
  const W = S.bars * bw;
  const rc = el('div', { class: 'rcells', style: 'width:' + W + 'px' });
  for (let b = 0; b < S.bars; b++)
    rc.append(
      el(
        'div',
        { class: 'rcell', style: 'left:' + b * bw + 'px;width:' + bw + 'px' },
        bw >= 34 || b % 2 === 0 ? String(b + 1) : ''
      )
    );
  rc.append(
    el('div', {
      class: 'rloop' + (S.loop.on ? ' on' : ''),
      style: 'left:' + S.loop.start * bw + 'px;width:' + (S.loop.end - S.loop.start) * bw + 'px'
    })
  );
  (S.markers || []).forEach((m, i) =>
    rc.append(
      el(
        'div',
        {
          class: 'mark',
          'data-i': i,
          style: 'left:' + m.bar * bw + 'px',
          title: 'Click to loop this section. Double-click to rename. Right-click for more.',
          onclick: () => loopSection(i),
          ondblclick: ev => {
            ev.stopPropagation();
            renameMarker(i);
          },
          oncontextmenu: ev => {
            ev.preventDefault();
            ev.stopPropagation();
            showMenu(ev.clientX, ev.clientY, markerMenu(i));
          }
        },
        m.name + (m.bpm ? ' ♩' + m.bpm : '') + (m.scene != null ? ' · S' + (m.scene + 1) : '')
      )
    )
  );
  const armMeta = UI.arm ? metaOf(UI.arm) : null;
  const corner = el(
    'div',
    { class: 'corner' + (armMeta ? ' armed' : '') },
    armMeta ? 'Placing: ' + armMeta.name + ' — tap a lane' : S.bars + ' bars'
  );
  inner.append(el('div', { class: 'ruler' }, corner, rc));
  const rows = el('div', { class: 'rows', id: 'rows' });
  S.tracks.forEach((t, i) => rows.append(trackRow(t, i, W)));
  rows.append(
    el('div', {
      class: 'loopband',
      id: 'loopband',
      style:
        'left:' +
        (HEAD + S.loop.start * bw) +
        'px;width:' +
        (S.loop.end - S.loop.start) * bw +
        'px;display:' +
        (S.loop.on ? 'block' : 'none')
    }),
    el('div', { class: 'ghost', id: 'ghost' }),
    el(
      'div',
      { class: 'playhead', id: 'playhead' },
      el(
        'button',
        {
          class: 'grabBtn',
          id: 'grabBtn',
          'aria-label': 'Sample grabber',
          onclick: ev => {
            ev.stopPropagation();
            hooks.grabOpen(ev.currentTarget);
          }
        },
        '◉'
      )
    )
  );
  inner.append(rows);
  hooks.updPlayhead(TR.playing && TR.mode === 'song' ? (TR.vis[0] ? TR.vis[0].tick / 32 : S.cursor) : S.cursor);
  const bi = $('#barsIn');
  if (bi) bi.value = S.bars;
  hooks.grabUI();
}
function trackRow(t, i, W) {
  const col = TRACK_COLORS[i];
  const chSel = el('select', {
    title: 'MIDI channel',
    'aria-label': 'MIDI channel for ' + t.name,
    onchange: e => {
      pushUndo();
      t.ch = +e.target.value;
      scheduleSave();
    }
  });
  for (let c = 1; c <= 16; c++) chSel.append(el('option', { value: c, selected: c === t.ch }, 'Ch ' + c));
  const head = el(
    'div',
    { class: 'thead' + (ROWH < 52 ? ' compact' : ''), 'data-t': i, style: '--c:' + col },
    el(
      'div',
      { class: 'trow1' },
      el('input', {
        class: 'tname',
        type: 'text',
        value: t.name,
        maxlength: 16,
        title: t.name,
        'aria-label': 'Track ' + (i + 1) + ' name',
        onchange: e => {
          pushUndo();
          t.name = e.target.value.trim().slice(0, 16) || t.name;
          scheduleSave();
          renderEdHead();
        }
      }),
      (() => {
        if (!devOn(i)) return '';
        const b = el('button', {
          class: 'thClip',
          id: 'thClip' + i,
          onclick: ev => {
            ev.stopPropagation();
            const r = ev.currentTarget.getBoundingClientRect(),
              bar = Math.floor(TR.playing && TR.mode === 'song' ? posBarNow() : S.cursor);
            showMenu(r.left, r.bottom + 2, [
              { label: 'Clip change at bar ' + (bar + 1) + ' (playhead)', disabled: true },
              ...clipChangeItems(i, bar)
            ]);
          }
        });
        cmChipFill(b, i, TR.playing && CMNOW[i] != null ? CMNOW[i] : cmAtBar(i, S.cursor));
        return b;
      })(),
      el(
        'button',
        {
          class: 'ms m' + (t.mute ? ' on' : ''),
          title: 'Mute',
          onclick: () => {
            pushUndo();
            t.mute = !t.mute;
            renderArr();
            scheduleSave();
          }
        },
        'M'
      ),
      el(
        'button',
        {
          class: 'ms s' + (t.solo ? ' on' : ''),
          title: 'Solo',
          onclick: () => {
            pushUndo();
            t.solo = !t.solo;
            renderArr();
            scheduleSave();
          }
        },
        'S'
      )
    ),
    el(
      'div',
      { class: 'trow2' },
      el('span', { class: 'ttype' }, t.type === 'drum' ? 'Drums' : 'Tone'),
      chSel,
      el('input', {
        type: 'range',
        min: 0,
        max: 127,
        value: t.vol,
        title: 'Track velocity (100 = unchanged)',
        'aria-label': 'Velocity for ' + t.name,
        oninput: e => {
          t.vol = +e.target.value;
        },
        onchange: () => {
          scheduleSave();
        }
      })
    )
  );
  const lane = el('div', { class: 'lane', 'data-t': i, style: 'width:' + W + 'px' });
  S.clips.filter(c => c.t === i).forEach(c => lane.append(clipEl(c, col)));
  if (devOn(i))
    cmMarks().forEach(mk => {
      if (mk.t !== i) return;
      const m = cmFix()[i],
        k = mk.k,
        auto = k < 0;
      lane.append(
        el(
          'div',
          {
            class: 'cmk' + (auto ? ' auto' : ''),
            style: 'left:' + mk.bar * bw + 'px;--k:' + (auto ? 'var(--mute)' : ctInfo(m.types[k])[2])
          },
          el(
            'b',
            {
              title:
                'Bar ' +
                (mk.bar + 1) +
                ': ' +
                devNm() +
                ' track ' +
                devNum(i) +
                ' → ' +
                cmLabel(i, k) +
                '. Drag to move, click to change, right-click to delete.',
              onpointerdown: ev => cmkDown(ev, mk)
            },
            auto ? 'AUTO' : 'C' + (k + 1) + ' ' + (m.names[k] ? m.names[k].slice(0, 10) : ctInfo(m.types[k])[1])
          )
        )
      );
    });
  return el('div', { class: 'trow' + (i === 3 ? ' split' : '') + (devOn(i) ? '' : ' devoff') }, head, lane);
}
function cmkDown(e, mk) {
  if (e.button === 2) return;
  e.preventDefault();
  e.stopPropagation();
  const b = e.currentTarget,
    host = b.parentNode,
    x0 = e.clientX,
    bar0 = mk.bar;
  let moved = false,
    undo = false;
  b.setPointerCapture(e.pointerId);
  const mv = ev => {
    const nb = Math.max(0, Math.min(S.bars - 1, bar0 + Math.round((ev.clientX - x0) / bw)));
    if (Math.abs(ev.clientX - x0) > 3) moved = true;
    if (moved && nb !== mk.bar && !cmMarks().some(m => m !== mk && m.t === mk.t && m.bar === nb)) {
      if (!undo) {
        pushUndo();
        undo = true;
      }
      mk.bar = nb;
      host.style.left = nb * bw + 'px';
    }
  };
  const up = ev => {
    b.removeEventListener('pointermove', mv);
    b.removeEventListener('pointerup', up);
    b.removeEventListener('pointercancel', up);
    if (moved) {
      cmMarks().sort((a, c) => a.bar - c.bar || a.t - c.t);
      scheduleSave();
      renderArr();
    } else showMenu(ev.clientX, ev.clientY, cmkMenu(mk));
  };
  b.addEventListener('pointermove', mv);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
}
export function cmkMenu(mk) {
  return [
    { label: 'Track ' + devNum(mk.t) + ', bar ' + (mk.bar + 1), disabled: true },
    ...cmPickItems(
      mk.t,
      mk.k,
      k => {
        pushUndo();
        mk.k = k;
        scheduleSave();
        renderArr();
      },
      'Back to automatic switching'
    ),
    { label: 'Delete this clip change', danger: true, action: () => delClipMark(mk) }
  ];
}
function clipEl(c, col) {
  const p = patOf(c);
  const w = Math.max(8, c.len * bw - 2),
    h = ROWH - 8;
  const e = el('div', {
    class: 'clip' + (c.id === UI.sel ? ' sel' : '') + (c.mute ? ' muted' : ''),
    'data-id': c.id,
    style: 'left:' + c.start * bw + 'px;width:' + w + 'px;--c:' + col,
    title: p.name + ' — drag to move, drag the right edge to resize, Alt-drag to copy. Right-click for more options.'
  });
  const cv = el('canvas');
  drawClipPreview(cv, c, p, w, h, col);
  drawClipOverlay(cv, c, w, h, col);
  const used = S.clips.filter(x => x.pat === c.pat).length;
  e.append(
    cv,
    el('span', { class: 'cname' }, p.name),
    ...(used > 1 || c.tr || c.vel || c.mute
      ? [
          el(
            'span',
            { class: 'lnk' },
            [
              c.mute ? 'muted' : '',
              c.tr ? (c.tr > 0 ? '+' : '') + c.tr + ' st' : '',
              c.vel ? c.vel + '%' : '',
              used > 1 ? 'linked ×' + used : ''
            ]
              .filter(Boolean)
              .join(' · ')
          )
        ]
      : []),
    el('i', { class: 'gripl' }),
    el('i', { class: 'grip' })
  );
  return e;
}
function drawClipPreview(cv, c, p, w, h, col) {
  cv.width = Math.round(w);
  cv.height = Math.round(h);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  const x = cv.getContext('2d');
  x.fillStyle = col;
  {
    const L = loopLen(c);
    if (c.len > L + 1e-6) {
      x.save();
      x.strokeStyle = col;
      x.globalAlpha = 0.55;
      x.setLineDash([3, 3]);
      for (let s = L - (c.off % L); s < c.len - 1e-6; s += L) {
        const px = Math.round((s / c.len) * w) + 0.5;
        x.beginPath();
        x.moveTo(px, 2);
        x.lineTo(px, h - 2);
        x.stroke();
      }
      x.restore();
    }
  }
  if (!p.notes.length) return;
  const L = (c.ll || p.bars) * 16,
    total = c.len * 16;
  let lo = 0,
    hi = 11;
  if (p.type === 'tone') {
    lo = Math.min(...p.notes.map(n => n.n));
    hi = Math.max(...p.notes.map(n => n.n));
    if (hi - lo < 7) {
      const m = (hi + lo) / 2;
      lo = m - 3.5;
      hi = m + 3.5;
    }
  }
  const top = 15,
    ph = h - top - 3;
  for (let base = -c.off * 16; base < total; base += L) {
    for (const n of p.notes) {
      const s = base + n.s;
      if (n.s >= L || s < 0 || s >= total) continue;
      const px = (s / total) * w,
        pw = Math.max(1.5, (Math.min(n.l, total - s) / total) * w - 0.5);
      let yy;
      if (p.type === 'drum') yy = top + (n.n / 11) * (ph - 2);
      else yy = top + (1 - (n.n - lo) / (hi - lo || 1)) * (ph - 2);
      x.globalAlpha = 0.55 + (0.45 * n.v) / 127;
      x.fillRect(px, yy, pw, 2.2);
    }
  }
}
export function barFromX(clientX) {
  const r = $('#rows').getBoundingClientRect();
  return snapFloor((clientX - r.left - HEAD) / bw);
}
export function rowFromY(clientY) {
  const r = $('#rows').getBoundingClientRect();
  return clamp(Math.floor((clientY - r.top) / ROWH), 0, 7);
}
export function showGhost(row, bar, len, ok) {
  const g = $('#ghost');
  if (!g) return;
  g.style.display = 'block';
  g.style.left = HEAD + bar * bw + 'px';
  g.style.width = len * bw - 2 + 'px';
  g.style.top = row * ROWH + 4 + (row >= 3 ? 3 : 0) + 'px';
  g.style.height = ROWH - 8 + 'px';
  g.classList.toggle('bad', !ok);
}
export function hideGhost() {
  const g = $('#ghost');
  if (g) g.style.display = 'none';
}
