import { $, el, toast } from '../core/dom.js';
import { DEV, TRACK_COLORS, devNm, devNum, devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { facById } from '../library/index.js';
import { AU, ensureAudio } from '../services/synth.js';
import { MIDI } from '../services/midi.js';
import { CLIPPIN, CMNOW, PCLAST, autoClip, sendClip } from '../services/clip-switch.js';
import { cmChipFill, cmPickItems } from '../clips/clip-map.js';
import { NK } from '../library/styles.js';
import { showMenu } from '../ui/menu.js';
import { LV, MUG } from './state.js';
import { lvIsFlash, lvScCol } from './themes.js';
import { lvPlayOn } from './scene-templates.js';
import { lvEmute, lvTop } from './engine.js';
import { lvEffMute, lvOn } from './cues.js';
import { lvSegs, lvTickF } from './ui.js';
import { liveRenderKeyRec } from './panels.js';
import { VZ } from './visualizer.js';

let lvUI = null;
let lvKeyRecK = '';
export function liveRenderLanes(b0, force) {
  const inner = $('#lvInner'),
    labels = $('#lvLabels'),
    view = $('#lvView');
  if (!inner) return;
  const W = 16,
    bw = Math.max(24, Math.floor((view.clientWidth || 640) / W));
  const tickf = lvTickF();
  const segs = lvSegs(tickf);
  if (labels.children.length !== 9 || labels.dataset.dev !== DEV) {
    labels.dataset.dev = DEV;
    labels.textContent = '';
    labels.append(el('div', { class: 'lvHdr' }, ''));
    S.tracks.forEach((t, i) =>
      labels.append(
        el(
          'div',
          { class: 'lvLab' + (devOn(i) ? '' : ' devoff'), id: 'lvLab' + i, style: '--c:' + TRACK_COLORS[i] },
          el('i', { class: 'vu', id: 'lvLVu' + i }),
          el('span', {}, t.name),
          (() => {
            const b = el('button', {
              class: 'thClip lvClip',
              id: 'lvClip' + i,
              onclick: ev => {
                ev.stopPropagation();
                const r = ev.currentTarget.getBoundingClientRect();
                showMenu(r.left, r.bottom + 2, [
                  { label: 'Switch track ' + devNum(i) + ' now (until the next scene)', disabled: true },
                  ...cmPickItems(
                    i,
                    CLIPPIN[i] != null ? CLIPPIN[i] : null,
                    k => {
                      if (k < 0) {
                        delete CLIPPIN[i];
                        delete PCLAST[i];
                        const v = lvTop(i);
                        if (v) autoClip(i, v.f, AU.ctx ? AU.ctx.currentTime : 0);
                        return;
                      }
                      ensureAudio();
                      CLIPPIN[i] = k;
                      sendClip(i, k, AU.ctx.currentTime);
                      if (!MIDI.out) toast('Connect the ' + devNm() + ' to switch its clips');
                    },
                    'Back to automatic'
                  )
                ]);
              }
            });
            cmChipFill(b, i, CMNOW[i] != null ? CMNOW[i] : null);
            return b;
          })()
        )
      )
    );
  }
  S.tracks.forEach((t, i) => {
    const l = $('#lvLab' + i);
    if (l) {
      l.children[1].textContent = t.name;
      l.classList.toggle('muted', lvEffMute(i) || t.mute || lvEmute(i));
    }
  });
  inner.textContent = '';
  inner.style.width = (W + 2) * bw + 'px';
  const hdr = el('div', { class: 'lvHdr', style: 'width:' + (W + 2) * bw + 'px' });
  inner.append(hdr);
  const segAt = tk => {
    let s = segs[0];
    for (const x of segs) if (x.tick <= tk) s = x;
    return s;
  };
  let prevSeg = null;
  for (let k = 0; k < W + 2; k++) {
    const tk = (b0 + k) * 32,
      s = segAt(tk);
    const rel = Math.max(0, Math.floor((tk - s.tick) / 32)) % (LV.scenes[s.idx] ? LV.scenes[s.idx].bars : 8);
    hdr.append(
      el(
        'div',
        { class: 'lvBar' + (s !== prevSeg ? ' sc' : ''), style: 'left:' + k * bw + 'px;width:' + bw + 'px' },
        s !== prevSeg || rel === 0 ? (LV.scenes[s.idx] ? LV.scenes[s.idx].name : '') : String(rel + 1)
      )
    );
    prevSeg = s;
  }
  const pendFill = LV.cues.filter(c => c.type === 'fill'),
    pendSw = LV.cues.filter(c => c.type === 'swap');
  S.tracks.forEach((t, ti) => {
    const row = el('div', {
      class: 'lvRow' + (devOn(ti) ? '' : ' devoff'),
      style: 'width:' + (W + 2) * bw + 'px;--c:' + TRACK_COLORS[ti]
    });
    for (let k = 0; k < W + 2; k++) {
      const tk = (b0 + k) * 32,
        s = segAt(tk),
        id = s.ids[ti];
      if (!id) continue;
      const f = facById(id);
      if (!f) continue;
      const ssc = LV.scenes[s.idx],
        scell = ssc && ssc.cells[ti];
      if (scell && scell.play && !lvPlayOn(scell.play, Math.floor((tk - s.tick) / 32) % ssc.bars, ssc.bars)) continue;
      const phase = Math.floor((tk - s.tick) / 32) % f.bars;
      const isFill = ti === 0 && pendFill.some(c => c.tick <= tk && tk < c.tick + 32);
      row.append(
        el(
          'div',
          {
            class: 'lvCell' + (phase === 0 ? ' st' : '') + (isFill ? ' fill' : ''),
            style: 'left:' + k * bw + 'px;width:' + (bw - 1) + 'px',
            title: f.name
          },
          phase === 0 || isFill ? (isFill ? 'Fill' : f.name) : ''
        )
      );
    }
    pendSw.forEach(c => {
      if (c.ids[ti]) {
        const k = Math.floor(c.tick / 32) - b0;
        if (k >= 0 && k < W + 2) {
          const nf = facById(c.ids[ti]);
          row.append(
            el(
              'div',
              {
                class: 'lvSwap',
                style: 'left:' + k * bw + 'px;width:' + (bw - 1) + 'px',
                title: 'Swap to ' + (nf ? nf.name : '')
              },
              '→ ' + (nf ? nf.name : '')
            )
          );
        }
      }
    });
    inner.append(row);
  });
  const cue = LV.cues.filter(c => c.type === 'scene')[0];
  if (cue) {
    const k = Math.floor(cue.tick / 32) - b0;
    if (k >= 0 && k <= W + 1) inner.append(el('div', { class: 'lvLine', style: 'left:' + k * bw + 'px' }));
  }
  lvUI = { b0, bw, ver: LV.ver };
}
export function liveStatus(tickf) {
  const on = lvOn(),
    sg = on ? lvSegs(tickf) : null;
  let sc = LV.scenes[LV.cur],
    s0 = null;
  if (on && sg) {
    s0 = sg.filter(x => x.tick <= tickf).pop() || sg[0];
    sc = LV.scenes[s0.idx];
  }
  const nm = $('#lvNowName');
  if (!nm) return;
  nm.textContent =
    on && LV.flash && LV.flash.start <= tickf && LV.flash.end > tickf
      ? '⚡ Break: ' + LV.flash.name
      : on && sc
        ? sc.name
        : 'Stopped';
  const root = $('#live');
  if (root && sc) root.style.setProperty('--acc', lvScCol(sc.e, 58));
  const barNo = on && sc ? Math.floor((tickf - s0.tick) / 32) % sc.bars : 0;
  $('#lvNowBar').textContent =
    on && sc
      ? 'bar ' +
        (barNo + 1) +
        ' of ' +
        sc.bars +
        (LV.auto ? ' · loop ' + (Math.floor((tickf - s0.tick) / (sc.bars * 32)) + 1) + '/' + LV.autoReps : '')
      : 'Press Start, or hit a scene pad';
  const pg = $('#lvProg');
  if (pg && sc) {
    if (pg.children.length !== sc.bars) {
      pg.textContent = '';
      for (let i = 0; i < sc.bars; i++) pg.append(el('i', {}));
    }
    [...pg.children].forEach((x, i) => {
      x.classList.toggle('done', on && i < barNo);
      x.classList.toggle('now', on && i === barNo);
    });
  }
  const cue = LV.cues.filter(c => c.type === 'scene')[0],
    ns = cue ? LV.scenes[cue.idx] : null;
  $('#lvNextName').textContent = on && ns ? ns.name : on && LV.auto ? 'Auto' : '—';
  const nb = cue ? Math.max(0, Math.ceil((cue.tick - tickf) / 32)) : 0;
  $('#lvNextIn').textContent = on && cue ? 'in ' + nb + ' bar' + (nb === 1 ? '' : 's') : '';
  const kc = LV.cues.filter(c => c.type === 'key')[0];
  $('#lvKeyShow').textContent = NK(LV.key, LV.mode);
  const ks = $('#lvKey');
  if (ks && +ks.value !== LV.key) ks.value = LV.key;
  const ms = $('#lvMode');
  if (ms && ms.value !== LV.mode) ms.value = LV.mode;
  if (lvKeyRecK !== LV.key + LV.mode + LV.style) {
    lvKeyRecK = LV.key + LV.mode + LV.style;
    liveRenderKeyRec();
  }
  $('#lvKeyNext').textContent = kc ? '→ ' + NK(kc.key, kc.mode || LV.mode) + ' next bar' : '';
  $('#lvBpmShow').textContent = String(Math.round(LV.bpm * LV.rate));
  const bi = $('#lvBpm');
  if (bi && document.activeElement !== bi && +bi.value !== LV.bpm) bi.value = LV.bpm;
  $('#lvRateShow').textContent = LV.rate === 1 ? '' : LV.rate === 0.5 ? 'half speed' : 'double speed';
  const ec = LV.cues.filter(c => c.type === 'energy').pop(),
    en = $('#lvEnergy');
  if (en && document.activeElement !== en) {
    en.value = ec ? ec.n : LV.energy;
    $('#lvEnVal').textContent = (ec ? ec.n : LV.energy) + (ec ? ' →' : '');
  }
  LV.scenes.forEach((s, i) => {
    const c = $('#lvCard' + i);
    if (!c) return;
    let isCur = on && sc === s && !(LV.flash && LV.flash.start <= tickf),
      isQ = on && cue && cue.idx === i,
      qn = nb;
    if (lvIsFlash(s)) {
      const fc = LV.cues.find(x => x.type === 'flash' && x.idx === i);
      isCur = !!(on && LV.flash && LV.flash.idx === i && LV.flash.start <= tickf);
      isQ = !!(on && (fc || (LV.flash && LV.flash.idx === i && LV.flash.start > tickf)));
      qn = fc ? Math.max(0, Math.ceil((fc.tick - tickf) / 32)) : 0;
    }
    c.classList.toggle('cur', !!isCur);
    c.classList.toggle('queued', !!isQ);
    const q = $('#lvCardQ' + i);
    if (q)
      q.textContent = isQ
        ? qn
          ? 'in ' + qn + ' bar' + (qn === 1 ? '' : 's')
          : 'next bar'
        : isCur
          ? lvIsFlash(s)
            ? 'FLASH!'
            : 'playing'
          : '';
  });
  for (let i = 0; i < 16; i++) {
    const a = LV.acts[i],
      b = $('#lvPad' + i);
    if (!b) continue;
    let cur = false,
      q = false;
    if (/^s\d$/.test(a)) {
      const ix = +a.slice(1);
      if (lvIsFlash(LV.scenes[ix])) {
        cur = !!(on && LV.flash && LV.flash.idx === ix && LV.flash.start <= tickf);
        q = !cur && LV.cues.some(c => c.type === 'flash' && c.idx === ix);
      } else {
        cur = !!(on && sc === LV.scenes[ix] && !(LV.flash && LV.flash.start <= tickf));
        q = !!(on && cue && cue.idx === ix);
      }
    } else if (a.startsWith('mu:')) cur = on && (MUG[a.slice(3)] || []).every(lvEffMute);
    else if (a.startsWith('mt:')) cur = on && lvEffMute(+a.slice(3));
    else if (a.startsWith('key:')) cur = LV.key === +a.slice(4);
    else if (a.startsWith('sw:')) q = LV.cues.some(c => c.type === 'swap' && c.group === a.slice(3));
    else if (a === 'fill') q = LV.cues.some(c => c.type === 'fill' && !c.auto);
    else if (a === 'brk') {
      cur = !!(on && LV.flash && LV.flash.start <= tickf && LV.flash.end > tickf);
      q = !cur && LV.cues.some(c => c.type === 'brk');
    } else if (a === 'stop') q = LV.cues.some(c => c.type === 'stop');
    else if (a === 'auto') cur = LV.auto;
    else if (a === 'lock') cur = !!LV.lock;
    else if (a.startsWith('rise:') || a === 'bd') cur = !!LV.rise;
    b.classList.toggle('cur', !!cur);
    b.classList.toggle('queued', !!q);
  }
  for (let i = 0; i < 12; i++) {
    const b = $('#lvK' + i);
    if (b) {
      b.classList.toggle('on', LV.key === i);
      b.classList.toggle('queued', !!(kc && kc.key === i));
    }
  }
  for (let i = 0; i < 8; i++) {
    const b = $('#lvM' + i);
    if (b) b.classList.toggle('off', lvEffMute(i) || lvEmute(i));
  }
}
export function liveFrame(tickf) {
  VZ.tickf = tickf;
  const b0 = Math.floor(tickf / 32),
    k = b0 + '|' + LV.ver;
  if (k !== LV.lastKey) {
    LV.lastKey = k;
    liveRenderLanes(b0);
  }
  const inner = $('#lvInner');
  if (inner && lvUI) inner.style.transform = 'translateX(' + -(tickf / 32 - b0) * lvUI.bw + 'px)';
  liveStatus(tickf);
  const beat = Math.floor((tickf % 32) / 8),
    frac = (tickf % 8) / 8;
  for (let i = 0; i < 4; i++) {
    const d = $('#lvBeat' + i);
    if (d) d.classList.toggle('on', i === beat);
  }
  const root = $('#live');
  if (root) root.style.setProperty('--beat', String(Math.pow(1 - frac, 2.2) * (beat === 0 ? 1 : 0.55)));
  const now = AU.ctx ? AU.ctx.currentTime : 0;
  for (let t = 0; t < 8; t++) {
    const p = LV.pulse[t],
      v = now >= p.time ? Math.max(0, 1 - (now - p.time) / 0.28) * p.v : 0;
    const a = $('#lvVu' + t),
      c = $('#lvLVu' + t);
    if (a) a.style.setProperty('--v', v.toFixed(2));
    if (c) c.style.setProperty('--v', v.toFixed(2));
  }
  if (LV.dropTick != null && tickf >= LV.dropTick) {
    LV.dropTick = null;
    if (root) {
      root.classList.remove('drop');
      void root.offsetWidth;
      root.classList.add('drop');
    }
  }
}
