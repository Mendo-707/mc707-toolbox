import { $, clamp, el, toast } from '../core/dom.js';
import { TRACK_COLORS } from '../core/device.js';
import { S, curClip, pushUndo, scheduleSave } from '../core/state.js';
import { renderArr, scheduleUI } from './arrangement.js';
import { patOf } from '../core/song-model.js';
import { css, renderEdHead, sizeCanvas } from './editor.js';
import { MIDI } from '../services/midi.js';
import { TR, fmtPos } from '../services/transport.js';
import { showMenu } from '../ui/menu.js';
import { loopClip, playFrom } from './clip-ops.js';
import { MC_PARAMS } from '../core/mc707-params.js';
import { envInterp, fadeGain, sendCC, velMul } from '../services/mc-controls.js';

const CC_NAME = n => {
  const p = MC_PARAMS.find(x => x.n === n);
  return p ? p.name + ' (CC ' + n + ')' : 'CC ' + n;
};
/* ---- shape editor ---- */
export const SH = { target: 'vel', drag: null, sel: -1, pos: null };
function shapePts(c, create) {
  if (SH.target === 'vel') {
    if (!c.ve && create) c.ve = [];
    return c.ve;
  }
  if (!c.cc) {
    if (!create) return null;
    c.cc = { n: SH.target, pts: [] };
  }
  if (c.cc.n !== SH.target) {
    if (!create) return null;
    c.cc.n = SH.target;
  }
  return c.cc.pts;
}
const shapeMax = () => (SH.target === 'vel' ? 1.5 : 1);
function shapeValueAt(c, x01) {
  if (SH.target === 'vel') return fadeGain(c, x01 * c.len) * envInterp(c.ve, x01, 1);
  const pts = c.cc && c.cc.n === SH.target ? c.cc.pts : null;
  return pts && pts.length ? envInterp(pts, x01, 0.5) : null;
}
function shapePreset(name) {
  const c = curClip();
  if (!c) return;
  pushUndo();
  const v = SH.target === 'vel' ? 1 : 1;
  const pts = [];
  const add = (x, y) => pts.push([Math.max(0, Math.min(1, x)), y]);
  switch (name) {
    case 'fadein':
      add(0, 0);
      add(1, v);
      break;
    case 'fadeout':
      add(0, v);
      add(1, 0);
      break;
    case 'swell':
      add(0, 0);
      add(0.5, v);
      add(1, 0);
      break;
    case 'duck':
      add(0, v);
      add(0.4, 0.15 * v);
      add(0.6, 0.15 * v);
      add(1, v);
      break;
    case 'low':
      add(0, 0.3 * v);
      add(1, 0.3 * v);
      break;
    case 'tremolo':
      for (let i = 0; i < 8; i++) {
        add(i / 8, v);
        add(i / 8 + 0.0625, 0.3 * v);
      }
      add(1, v);
      break;
    case 'lfo':
      for (let i = 0; i <= 32; i++) add(i / 32, (0.5 + 0.5 * Math.sin((i / 32) * Math.PI * 4)) * v);
      break;
    case 'saw':
      for (let i = 0; i < 4; i++) {
        add(i / 4, 0);
        add((i + 1) / 4 - 0.001, v);
      }
      break;
    case 'gate':
      for (let i = 0; i < 8; i++) {
        add(i / 8, v);
        add(i / 8 + 0.0624, v);
        add(i / 8 + 0.0626, 0);
        add((i + 1) / 8 - 0.001, 0);
      }
      break;
  }
  const t = shapePts(c, true);
  t.length = 0;
  pts.forEach(p => t.push(p));
  SH.sel = -1;
  scheduleUI();
  drawShape();
}
function shapeReset() {
  const c = curClip();
  if (!c) return;
  pushUndo();
  if (SH.target === 'vel') {
    delete c.ve;
    delete c.fi;
    delete c.fo;
    delete c.fcv;
  } else if (c.cc && c.cc.n === SH.target) delete c.cc;
  SH.sel = -1;
  scheduleUI();
  renderEdHead();
  drawShape();
}
function shapeGeom() {
  const wrap = $('#edShape');
  const W = wrap.clientWidth,
    H = wrap.clientHeight;
  return { W, H, L: 50, R: 14, T: 16, B: 28, pw: Math.max(10, W - 64), ph: Math.max(10, H - 44) };
}
export function drawShape() {
  const c = curClip();
  const wrap = $('#edShape');
  if (!c || !wrap || wrap.hidden) return;
  const g = shapeGeom();
  if (g.W < 20 || g.H < 20) return;
  const cv = $('#edShapeCv');
  const x = sizeCanvas(cv, g.W, g.H);
  const ink = css('--ink'),
    bg = css('--bg'),
    gA = css('--grid-a'),
    gB = css('--grid-b'),
    gC = css('--grid-c'),
    mute = css('--mute'),
    hot = css('--hot');
  const col = TRACK_COLORS[c.t],
    p = patOf(c);
  const MAXV = shapeMax();
  const px = u => g.L + u * g.pw,
    py = v => g.T + (1 - clamp(v / MAXV, 0, 1)) * g.ph;
  x.fillStyle = bg;
  x.fillRect(0, 0, g.W, g.H);
  x.font = '11px "Barlow Semi Condensed",system-ui,sans-serif';
  x.textBaseline = 'middle';
  /* horizontal guides */
  const levels = SH.target === 'vel' ? [0, 0.5, 1, 1.5] : [0, 0.25, 0.5, 0.75, 1];
  levels.forEach(v => {
    const y = py(v);
    x.fillStyle = v === 1 && SH.target === 'vel' ? gC : gB;
    x.fillRect(g.L, y, g.pw, 1);
    x.fillStyle = mute;
    x.textAlign = 'right';
    x.fillText(SH.target === 'vel' ? Math.round(v * 100) + '%' : String(Math.round(v * 127)), g.L - 6, y);
  });
  /* vertical guides: steps, beats, bars */
  const steps = Math.round(c.len * 16);
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    if (s % 16 === 0) x.fillStyle = gC;
    else if (s % 4 === 0) x.fillStyle = gB;
    else if (g.pw / steps >= 7) x.fillStyle = gA;
    else continue;
    x.fillRect(px(u), g.T, 1, g.ph);
  }
  x.fillStyle = mute;
  x.textAlign = 'left';
  for (let b = 0; b < Math.ceil(c.len); b++) {
    x.fillText(fmtPos(c.start + b).split('.')[0], px(b / c.len) + 3, g.H - 12);
  }
  /* pattern notes in the background */
  const L = (c.ll || p.bars) * 16,
    total = c.len * 16;
  let lo = 0,
    hi = 11;
  if (p.type === 'tone' && p.notes.length) {
    lo = Math.min(...p.notes.map(n => n.n));
    hi = Math.max(...p.notes.map(n => n.n));
    if (hi - lo < 7) {
      const m = (hi + lo) / 2;
      lo = m - 3.5;
      hi = m + 3.5;
    }
  }
  x.globalAlpha = 0.28;
  x.fillStyle = col;
  for (let base = -c.off * 16; base < total; base += L)
    for (const n of p.notes) {
      const s = base + n.s;
      if (n.s >= L || s < 0 || s >= total) continue;
      const yy = g.T + 4 + (p.type === 'drum' ? n.n / 11 : 1 - (n.n - lo) / (hi - lo || 1)) * (g.ph - 12);
      x.fillRect(px(s / total), yy, Math.max(2, (Math.min(n.l, total - s) / total) * g.pw - 1), 3);
    }
  x.globalAlpha = 1;
  /* curve */
  const N = Math.max(60, Math.min(400, Math.round(g.pw / 2)));
  const pts = [];
  let any = false;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const v = shapeValueAt(c, u);
    if (v == null) continue;
    any = true;
    pts.push([px(u), py(v)]);
  }
  if (any) {
    x.beginPath();
    x.moveTo(pts[0][0], g.T + g.ph);
    pts.forEach(q => x.lineTo(q[0], q[1]));
    x.lineTo(pts[pts.length - 1][0], g.T + g.ph);
    x.closePath();
    x.fillStyle = col;
    x.globalAlpha = 0.22;
    x.fill();
    x.globalAlpha = 1;
    x.beginPath();
    pts.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])));
    x.strokeStyle = col;
    x.lineWidth = 2.2;
    x.stroke();
  } else {
    x.fillStyle = mute;
    x.textAlign = 'center';
    x.fillText('No automation yet. Click to add points, or pick a preset above.', g.L + g.pw / 2, g.T + g.ph / 2);
  }
  /* fade handles */
  if (SH.target === 'vel') {
    const handle = (u, label) => {
      x.fillStyle = hot;
      x.beginPath();
      x.moveTo(px(u), g.T - 2);
      x.lineTo(px(u) - 7, g.T - 13);
      x.lineTo(px(u) + 7, g.T - 13);
      x.closePath();
      x.fill();
    };
    if (c.fi > 0) handle(Math.min(1, c.fi / 16 / c.len));
    if (c.fo > 0) handle(Math.max(0, 1 - c.fo / 16 / c.len));
  }
  /* editable points */
  const ep = SH.target === 'vel' ? c.ve : c.cc && c.cc.n === SH.target ? c.cc.pts : null;
  (ep || []).forEach((q, i) => {
    x.beginPath();
    x.arc(px(q[0]), py(q[1]), i === SH.sel ? 6 : 5, 0, 7);
    x.fillStyle = i === SH.sel ? hot : bg;
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = i === SH.sel ? ink : col;
    x.stroke();
  });
  /* playhead */
  if (TR.playing && TR.mode === 'song' && SH.pos != null) {
    const u = (SH.pos - c.start) / c.len;
    if (u >= 0 && u <= 1) {
      x.fillStyle = hot;
      x.fillRect(px(u) - 1, g.T, 2, g.ph);
    }
  }
  x.fillStyle = mute;
  x.textAlign = 'left';
  x.fillText(SH.target === 'vel' ? 'Velocity multiplier' : CC_NAME(SH.target), g.L, 8);
}
function shapeHit(e) {
  const c = curClip();
  const g = shapeGeom();
  const r = $('#edShapeCv').getBoundingClientRect();
  const mx = e.clientX - r.left,
    my = e.clientY - r.top;
  const MAXV = shapeMax();
  const px = u => g.L + u * g.pw,
    py = v => g.T + (1 - clamp(v / MAXV, 0, 1)) * g.ph;
  const u = clamp((mx - g.L) / g.pw, 0, 1),
    v = clamp((1 - (my - g.T) / g.ph) * MAXV, 0, MAXV);
  if (SH.target === 'vel') {
    if (c.fi > 0 && Math.abs(mx - px(Math.min(1, c.fi / 16 / c.len))) < 9 && my < g.T + 4) return { kind: 'fi', u, v };
    if (c.fo > 0 && Math.abs(mx - px(Math.max(0, 1 - c.fo / 16 / c.len))) < 9 && my < g.T + 4)
      return { kind: 'fo', u, v };
  }
  const ep = SH.target === 'vel' ? c.ve : c.cc && c.cc.n === SH.target ? c.cc.pts : null;
  if (ep)
    for (let i = 0; i < ep.length; i++)
      if (Math.hypot(mx - px(ep[i][0]), my - py(ep[i][1])) <= 10) return { kind: 'pt', i, u, v };
  return {
    kind: 'new',
    u,
    v,
    inside: mx >= g.L - 4 && mx <= g.L + g.pw + 4 && my >= g.T - 4 && my <= g.T + g.ph + 4
  };
}
function initShape() {
  const cv = $('#edShapeCv');
  cv.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    const c = curClip();
    if (!c) return;
    const h = shapeHit(e);
    if (h.kind === 'new' && !h.inside) return;
    pushUndo();
    cv.setPointerCapture(e.pointerId);
    const steps = Math.round(c.len * 16);
    const snapU = u => (e.altKey ? u : Math.round(u * steps) / steps);
    if (h.kind === 'fi' || h.kind === 'fo') {
      SH.drag = { kind: h.kind };
    } else if (h.kind === 'pt') {
      SH.sel = h.i;
      SH.drag = { kind: 'pt' };
    } else {
      const pts = shapePts(c, true);
      pts.push([snapU(h.u), e.shiftKey ? Math.round(h.v / 0.05) * 0.05 : h.v]);
      pts.sort((a, b) => a[0] - b[0]);
      SH.sel = pts.findIndex(q => q[0] === snapU(h.u));
      SH.drag = { kind: 'pt' };
    }
    scheduleUI();
    drawShape();
  });
  cv.addEventListener('pointermove', e => {
    const c = curClip();
    if (!c) return;
    if (!SH.drag) {
      const h = shapeHit(e);
      cv.style.cursor = h.kind === 'pt' ? 'grab' : h.kind === 'fi' || h.kind === 'fo' ? 'ew-resize' : 'crosshair';
      return;
    }
    const h = shapeHit(e);
    const steps = Math.round(c.len * 16);
    const snapU = u => (e.altKey ? u : Math.round(u * steps) / steps);
    if (SH.drag.kind === 'fi') {
      c.fi = Math.max(0, Math.round(h.u * steps));
      if (!c.fi) delete c.fi;
      scheduleUI();
      renderFadeInputs();
    } else if (SH.drag.kind === 'fo') {
      c.fo = Math.max(0, Math.round((1 - h.u) * steps));
      if (!c.fo) delete c.fo;
      scheduleUI();
      renderFadeInputs();
    } else {
      const pts = shapePts(c, true);
      const q = pts[SH.sel];
      if (!q) return;
      const sel = q;
      q[0] = snapU(h.u);
      q[1] = e.shiftKey ? Math.round(h.v / 0.05) * 0.05 : h.v;
      pts.sort((a, b) => a[0] - b[0]);
      SH.sel = pts.indexOf(sel);
      scheduleUI();
    }
    drawShape();
  });
  const end = () => {
    SH.drag = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('dblclick', e => {
    const c = curClip();
    if (!c) return;
    const h = shapeHit(e);
    if (h.kind === 'pt') {
      pushUndo();
      const pts = shapePts(c, false);
      pts.splice(h.i, 1);
      SH.sel = -1;
      scheduleUI();
      drawShape();
    }
  });
  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    const c = curClip();
    if (!c) return;
    const h = shapeHit(e);
    const items = [];
    if (h.kind === 'pt')
      items.push(
        {
          label: 'Delete point',
          danger: true,
          action: () => {
            pushUndo();
            shapePts(c, false).splice(h.i, 1);
            SH.sel = -1;
            scheduleUI();
            drawShape();
          }
        },
        '-'
      );
    items.push(
      ...[
        ['fadein', 'Fade in'],
        ['fadeout', 'Fade out'],
        ['swell', 'Swell (in and out)'],
        ['duck', 'Duck in the middle'],
        ['low', 'Hold low'],
        ['tremolo', 'Tremolo'],
        ['lfo', 'Slow wave'],
        ['saw', 'Sawtooth'],
        ['gate', 'Gate (8 pulses)']
      ].map(([k, l]) => ({ label: l, action: () => shapePreset(k) })),
      '-',
      { label: 'Reset this shape', danger: true, action: shapeReset }
    );
    showMenu(e.clientX, e.clientY, items);
  });
}
function renderFadeInputs() {
  const c = curClip();
  if (!c) return;
  const a = $('#fadeIn'),
    b = $('#fadeOut');
  if (a && document.activeElement !== a) a.value = c.fi || 0;
  if (b && document.activeElement !== b) b.value = c.fo || 0;
}
export function shapeHead(h, c, p) {
  const tsel = el('select', {
    'aria-label': 'What the shape controls',
    onchange: e => {
      const v = e.target.value;
      SH.target = v === 'vel' ? 'vel' : +v;
      SH.sel = -1;
      if (SH.target !== 'vel' && c.cc && c.cc.n !== SH.target) {
        pushUndo();
        c.cc.n = SH.target;
        scheduleUI();
      }
      renderEdHead();
      drawShape();
    }
  });
  const og = el('optgroup', { label: 'Note velocity' });
  og.append(el('option', { value: 'vel', selected: SH.target === 'vel' }, 'Velocity (fades and swells)'));
  tsel.append(og);
  const og2 = el('optgroup', { label: 'MC-707 MIDI controls (sent to the track)' });
  MC_PARAMS.forEach(m =>
    og2.append(el('option', { value: m.n, selected: SH.target === m.n }, m.name + ' (CC ' + m.n + ')'))
  );
  tsel.append(og2);
  const fi = el('input', {
    type: 'number',
    id: 'fadeIn',
    min: 0,
    step: 1,
    value: c.fi || 0,
    style: 'width:64px',
    'aria-label': 'Fade in steps',
    onchange: e => {
      pushUndo();
      const v = Math.max(0, Math.round(+e.target.value) || 0);
      if (v) c.fi = v;
      else delete c.fi;
      scheduleUI();
      drawShape();
    }
  });
  const fo = el('input', {
    type: 'number',
    id: 'fadeOut',
    min: 0,
    step: 1,
    value: c.fo || 0,
    style: 'width:64px',
    'aria-label': 'Fade out steps',
    onchange: e => {
      pushUndo();
      const v = Math.max(0, Math.round(+e.target.value) || 0);
      if (v) c.fo = v;
      else delete c.fo;
      scheduleUI();
      drawShape();
    }
  });
  const cs = el('select', {
    'aria-label': 'Fade curve',
    onchange: e => {
      pushUndo();
      if (e.target.value === 'lin') delete c.fcv;
      else c.fcv = e.target.value;
      scheduleUI();
      drawShape();
    }
  });
  [
    ['lin', 'Linear'],
    ['exp', 'Slow start'],
    ['log', 'Fast start'],
    ['s', 'S-curve']
  ].forEach(([v, l]) => cs.append(el('option', { value: v, selected: (c.fcv || 'lin') === v }, l)));
  const pr = el('select', {
    'aria-label': 'Shape presets',
    onchange: e => {
      if (e.target.value) shapePreset(e.target.value);
      e.target.value = '';
    }
  });
  pr.append(el('option', { value: '' }, 'Presets…'));
  [
    ['fadein', 'Fade in'],
    ['fadeout', 'Fade out'],
    ['swell', 'Swell'],
    ['duck', 'Duck'],
    ['low', 'Hold low'],
    ['tremolo', 'Tremolo'],
    ['lfo', 'Slow wave'],
    ['saw', 'Sawtooth'],
    ['gate', 'Gate']
  ].forEach(([k, l]) => pr.append(el('option', { value: k }, l)));
  h.append(
    el(
      'div',
      { class: 'grp' },
      el('span', { class: 'hint' }, 'Controls'),
      tsel,
      pr,
      el('button', { class: 'btn sm', onclick: shapeReset, title: 'Remove this shape' }, 'Reset')
    )
  );
  if (SH.target === 'vel')
    h.append(
      el(
        'div',
        { class: 'grp' },
        el('span', { class: 'hint' }, 'Fade in'),
        fi,
        el('span', { class: 'hint' }, 'out'),
        fo,
        el('span', { class: 'hint' }, 'steps'),
        cs,
        el(
          'button',
          {
            class: 'btn sm',
            title: 'Fade in over one bar',
            onclick: () => {
              pushUndo();
              c.fi = 16;
              scheduleUI();
              renderEdHead();
              drawShape();
            }
          },
          '1 bar in'
        ),
        el(
          'button',
          {
            class: 'btn sm',
            title: 'Fade out over one bar',
            onclick: () => {
              pushUndo();
              c.fo = 16;
              scheduleUI();
              renderEdHead();
              drawShape();
            }
          },
          '1 bar out'
        )
      )
    );
  h.append(
    el(
      'div',
      { class: 'grp' },
      el('button', { class: 'btn sm', id: 'bAud', onclick: () => playFrom(c.start) }, 'Play from clip'),
      el('button', { class: 'btn sm', onclick: () => loopClip(c) }, 'Loop clip')
    )
  );
  h.append(
    el(
      'div',
      { class: 'hint shapehint' },
      SH.target === 'vel'
        ? 'Scales how hard notes are played across this clip. Fades only change notes that start during the fade, so for held pads also automate Volume (CC 7) or Expression (CC 11).'
        : 'Sends ' +
            CC_NAME(SH.target) +
            ' to this track on its MIDI channel while the clip plays. It needs a MIDI output. The browser preview sound ignores it.'
    )
  );
}
/* ---- per-track MIDI controls ---- */
const MCT = { t: 3 };
export function openMctl(t) {
  if (t != null) MCT.t = t;
  $('#mctl').hidden = false;
  renderMctl();
}
export function closeMctl() {
  $('#mctl').hidden = true;
}
function renderMctl() {
  const t = S.tracks[MCT.t];
  const head = $('#mctlHead');
  head.textContent = '';
  head.append(
    el('h2', {}, 'MIDI controls'),
    el(
      'div',
      { class: 'steps' },
      ...S.tracks.map((x, i) =>
        el(
          'button',
          {
            class: 'btn sm' + (i === MCT.t ? ' on' : ''),
            title: x.name,
            onclick: () => {
              MCT.t = i;
              renderMctl();
            }
          },
          String(i + 1)
        )
      )
    ),
    el('button', { class: 'btn sm', onclick: closeMctl }, 'Close')
  );
  const b = $('#mctlBody');
  b.textContent = '';
  b.append(
    el(
      'p',
      { class: 'wlead' },
      'Track ' +
        (MCT.t + 1) +
        ', ' +
        t.name +
        ', on MIDI channel ' +
        t.ch +
        '. These sliders send MIDI control changes that the MC-707 recognises, so you can set up a sound from here.' +
        (MIDI.out ? '' : ' No MIDI output is connected yet, so nothing is sent.')
    )
  );
  const g = el('div', { class: 'mgrid' });
  MC_PARAMS.forEach(m => {
    const cur = t.cc && t.cc[m.n] != null ? t.cc[m.n] : m.def;
    const set = t.cc && t.cc[m.n] != null;
    const out = el('output', {}, String(cur));
    const rng = el('input', {
      type: 'range',
      min: 0,
      max: 127,
      value: cur,
      'aria-label': m.name,
      oninput: e => {
        const v = +e.target.value;
        t.cc = t.cc || {};
        t.cc[m.n] = v;
        out.textContent = String(v);
        row.classList.add('set');
        sendCC(MCT.t, m.n, v);
        scheduleSave();
      }
    });
    const row = el(
      'div',
      { class: 'mrow' + (set ? ' set' : '') },
      el('span', { class: 'mn' }, m.name, el('small', {}, 'CC ' + m.n)),
      rng,
      out,
      el(
        'button',
        {
          class: 'btn sm',
          title: 'Forget this value',
          onclick: () => {
            if (t.cc) {
              delete t.cc[m.n];
              if (!Object.keys(t.cc).length) delete t.cc;
            }
            scheduleSave();
            renderMctl();
          }
        },
        '↺'
      )
    );
    g.append(row);
  });
  b.append(g);
  b.append(
    el(
      'p',
      { class: 'hint', style: 'margin-top:8px' },
      'Slider values that you have moved are remembered with the song. Attack, decay, release and vibrato follow Roland’s usual convention where 64 is the middle. If a control does nothing, check that the MC-707 track is set to receive control changes.'
    )
  );
  const f = $('#mctlFoot');
  f.textContent = '';
  f.append(
    el(
      'label',
      {
        class: 'lay',
        style: 'flex-direction:row;align-items:center;padding:4px 8px;color:var(--ink);font-size:13px'
      },
      el('input', {
        type: 'checkbox',
        checked: S.sendCC !== false,
        onchange: e => {
          S.sendCC = e.target.checked;
          scheduleSave();
        }
      }),
      el('span', {}, 'Send remembered values when the song starts')
    ),
    el('div', { class: 'sp' }),
    el(
      'button',
      {
        class: 'btn',
        onclick: () => {
          if (t.cc) for (const n in t.cc) sendCC(MCT.t, +n, t.cc[n]);
          toast('Sent');
        }
      },
      'Send all now'
    ),
    el(
      'button',
      {
        class: 'btn',
        onclick: () => {
          delete t.cc;
          scheduleSave();
          renderMctl();
        }
      },
      'Forget all'
    )
  );
}
export function initStageB() {
  initShape();
  $('#mctl').addEventListener('pointerdown', e => {
    if (e.target.id === 'mctl') closeMctl();
  });
  const cc = $('#ctrlCh');
  for (let i = 1; i <= 16; i++) cc.append(el('option', { value: i }, String(i)));
  cc.value = S.ctrlCh || 16;
  cc.addEventListener('change', e => {
    S.ctrlCh = +e.target.value;
    scheduleSave();
  });
  $('#bTrackCtl').addEventListener('click', () => {
    $('#midiPop').hidden = true;
    openMctl();
  });
}

export function drawClipOverlay(cv, c, w, h, col) {
  const hasV = c.fi || c.fo || (c.ve && c.ve.length),
    hasC = c.cc && c.cc.pts && c.cc.pts.length;
  if (!hasV && !hasC) return;
  const x = cv.getContext('2d');
  x.globalAlpha = 1;
  const N = Math.max(10, Math.min(120, Math.round(w / 3)));
  if (hasV) {
    x.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const y = h - 3 - clamp(velMul(c, u * c.len) / 1.5, 0, 1) * (h - 6);
      if (i) x.lineTo(u * w, y);
      else x.moveTo(u * w, y);
    }
    x.strokeStyle = 'rgba(255,255,255,.92)';
    x.lineWidth = 1.5;
    x.stroke();
  }
  if (hasC) {
    x.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const y = h - 3 - clamp(envInterp(c.cc.pts, u, 0.5), 0, 1) * (h - 6);
      if (i) x.lineTo(u * w, y);
      else x.moveTo(u * w, y);
    }
    x.setLineDash([3, 3]);
    x.strokeStyle = col;
    x.lineWidth = 1.5;
    x.stroke();
    x.setLineDash([]);
  }
}
export function quickFade(c, k, v) {
  pushUndo();
  c[k] = v;
  renderArr();
  scheduleSave();
}
