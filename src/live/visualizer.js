import { $, clamp } from '../core/dom.js';
import { TRACK_COLORS } from '../core/device.js';
import { S } from '../core/state.js';
import { AU } from '../services/synth.js';
import { LV, lvHue } from './state.js';
import { lvOn } from './cues.js';

/* ---- visualizer ---- */
export const VZ = {
  nb: 72,
  bars: new Float32Array(72),
  ev: [],
  parts: [],
  kick: 0,
  snare: 0,
  hat: 0,
  crash: 0,
  flash: 0,
  run: false,
  last: 0,
  tickf: 0,
  cw: 0,
  ch: 0,
  hue: 215,
  hueT: 215,
  rot: 0
};
export function vizNote(ti, nn, vel, time, dur) {
  if (!VZ.run) return;
  if (VZ.ev.length > 300) VZ.ev.splice(0, 100);
  VZ.ev.push({ ti, nn, vel, time, dur, drum: S.tracks[ti].type === 'drum' });
}
function vizSpawn(e) {
  const v = clamp(e.vel / 127, 0.15, 1),
    col = TRACK_COLORS[e.ti] || '#fff';
  if (e.drum) {
    if (e.nn === 0) VZ.kick = Math.max(VZ.kick, v);
    else if (e.nn === 2 || e.nn === 3 || e.nn === 1) VZ.snare = Math.max(VZ.snare, v);
    else if (e.nn === 4 || e.nn === 5 || e.nn === 10 || e.nn === 11) {
      VZ.hat = Math.max(VZ.hat, v);
      for (let i = 0; i < 2; i++)
        VZ.parts.push({
          k: 'hat',
          x: Math.random(),
          y: 0.08 + Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 0.08,
          vy: 0.05 + Math.random() * 0.1,
          life: 1,
          c: '#fff',
          s: 1.5 + Math.random() * 1.5
        });
    } else if (e.nn === 9) {
      VZ.crash = 1;
      VZ.flash = 1;
    } else {
      VZ.parts.push({ k: 'ring', x: 0.2 + Math.random() * 0.6, y: 0.55, r: 0, life: 1, c: col, v });
    }
    return;
  }
  const bin = clamp(Math.round(((e.nn - 24) / 72) * (VZ.nb - 1)), 0, VZ.nb - 1);
  for (let d = -3; d <= 3; d++) {
    const i = bin + d;
    if (i >= 0 && i < VZ.nb) VZ.bars[i] = Math.max(VZ.bars[i], v * Math.pow(0.62, Math.abs(d)));
  }
  VZ.parts.push({
    k: 'star',
    x: (bin + 0.5) / VZ.nb,
    y: 0,
    vy: 0.25 + v * 0.35,
    life: 1,
    c: col,
    s: 2 + v * 3
  });
  if (VZ.parts.length > 260) VZ.parts.splice(0, 60);
}
function vizDraw(now, dt) {
  const cv = $('#lvViz');
  if (!cv) return;
  const W = cv.clientWidth,
    H = cv.clientHeight;
  if (W < 10 || H < 10) return;
  let dpr = Math.min(1.5, devicePixelRatio || 1);
  if (W * H * dpr * dpr > 900000) dpr = Math.sqrt(900000 / (W * H));
  if (VZ.cw !== Math.round(W * dpr) || VZ.ch !== H * dpr) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    VZ.cw = cv.width;
    VZ.ch = cv.height;
  }
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const on = lvOn(),
    actx = AU.ctx ? AU.ctx.currentTime : 0;
  if (on) {
    while (VZ.ev.length && VZ.ev[0].time <= actx) vizSpawn(VZ.ev.shift());
  } else VZ.ev.length = 0;
  const dec = k => Math.pow(0.5, dt / k);
  VZ.kick *= dec(0.16);
  VZ.snare *= dec(0.1);
  VZ.hat *= dec(0.07);
  VZ.crash *= dec(0.5);
  VZ.flash *= dec(0.12);
  const t = now / 1000,
    tk = VZ.tickf;
  const sc = LV.scenes[LV.cur];
  const hueT = sc ? lvHue(sc.e) : 215;
  VZ.hue += (((hueT - VZ.hue + 540) % 360) - 180) * Math.min(1, dt * 2);
  const hue = VZ.hue,
    beat = on ? Math.pow(1 - (tk % 8) / 8, 2.4) * (Math.floor((tk % 32) / 8) === 0 ? 1 : 0.55) : 0;
  const hz = H * 0.58;
  /* sky */
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'hsl(' + ((hue + 250) % 360) + ',55%,' + (6 + beat * 3) + '%)');
  g.addColorStop(0.58, 'hsl(' + ((hue + 300) % 360) + ',60%,' + (14 + VZ.kick * 10) + '%)');
  g.addColorStop(1, '#07080f');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  /* sun */
  const sr = H * 0.2 * (1 + 0.16 * VZ.kick + 0.04 * beat),
    sx = W / 2,
    sy = hz - sr * 0.15;
  g = x.createLinearGradient(0, sy - sr, 0, sy + sr);
  g.addColorStop(0, 'hsl(' + ((hue + 60) % 360) + ',95%,62%)');
  g.addColorStop(1, 'hsl(' + ((hue + 300) % 360) + ',90%,55%)');
  x.save();
  x.beginPath();
  x.rect(0, 0, W, hz);
  x.clip();
  {
    const gr = sr * (1.5 + 0.6 * VZ.kick),
      hg = x.createRadialGradient(sx, sy, sr * 0.9, sx, sy, gr);
    hg.addColorStop(0, 'hsla(' + ((hue + 300) % 360) + ',90%,60%,' + (0.45 + 0.4 * VZ.kick) + ')');
    hg.addColorStop(1, 'hsla(' + ((hue + 300) % 360) + ',90%,60%,0)');
    x.fillStyle = hg;
    x.fillRect(sx - gr, sy - gr, gr * 2, gr * 2);
  }
  x.fillStyle = g;
  x.beginPath();
  x.arc(sx, sy, sr, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'hsl(' + ((hue + 300) % 360) + ',60%,' + (14 + VZ.kick * 10) + '%)';
  for (let i = 0; i < 6; i++) {
    const yy = sy + sr * (0.05 + i * 0.17),
      hh = sr * (0.02 + i * 0.022) * (1 + (on ? (tk / 32) % 1 : t % 1) * 0.0);
    x.fillRect(sx - sr, yy, sr * 2, hh);
  }
  x.restore();
  /* bars (above horizon) */
  const bw = W / VZ.nb;
  for (let i = 0; i < VZ.nb; i++) {
    if (!on)
      VZ.bars[i] = Math.max(
        VZ.bars[i] * 0.9,
        0.05 + 0.05 * Math.sin(t * 1.2 + i * 0.35) + 0.03 * Math.sin(t * 0.7 + i * 0.9)
      );
    else VZ.bars[i] *= dec(0.22);
    const v = VZ.bars[i],
      bh = v * hz * 1.05;
    if (bh < 1) continue;
    const c = 'hsl(' + ((hue + (i / VZ.nb) * 140) % 360) + ',90%,' + (55 + v * 15) + '%)';
    x.fillStyle = c;
    x.globalAlpha = 0.9;
    x.fillRect(i * bw + 1, hz - bh, Math.max(1, bw - 2), bh);
    x.globalAlpha = 0.22;
    x.fillRect(i * bw + 1, hz + 2, Math.max(1, bw - 2), bh * 0.55);
  }
  x.globalAlpha = 1;
  /* floor grid */
  g = x.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, 'rgba(8,8,18,.2)');
  g.addColorStop(1, 'rgba(8,8,18,.85)');
  x.fillStyle = g;
  x.fillRect(0, hz, W, H - hz);
  x.strokeStyle = 'hsl(' + ((hue + 300) % 360) + ',90%,62%)';
  x.lineWidth = 1;
  const ph = on ? (tk / 32) % 1 : (t * 0.12) % 1;
  x.globalAlpha = 0.35 + 0.4 * beat;
  x.beginPath();
  for (let i = -14; i <= 14; i++) {
    x.moveTo(W / 2 + i * 8, hz);
    x.lineTo(W / 2 + i * W * 0.16, H);
  }
  x.stroke();
  for (let i = 0; i < 9; i++) {
    const f = (i + ph * 1) / 9,
      y = hz + (H - hz) * Math.pow(f, 2.2);
    x.globalAlpha = (0.15 + 0.5 * f) * (0.6 + 0.6 * beat);
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(W, y);
    x.stroke();
  }
  x.globalAlpha = 1;
  /* horizon glow line */
  x.fillStyle = 'hsl(' + ((hue + 300) % 360) + ',95%,70%)';
  x.globalAlpha = 0.6 + 0.4 * VZ.snare;
  x.fillRect(0, hz - 1, W, 2 + VZ.snare * 4);
  x.globalAlpha = 1;
  /* particles */
  for (let i = VZ.parts.length - 1; i >= 0; i--) {
    const p = VZ.parts[i];
    p.life -= dt * (p.k === 'ring' ? 1.1 : p.k === 'hat' ? 1.6 : 0.9);
    if (p.life <= 0) {
      VZ.parts.splice(i, 1);
      continue;
    }
    if (p.k === 'star') {
      p.y += p.vy * dt;
      const px = p.x * W,
        py = hz - VZ.bars[Math.min(VZ.nb - 1, Math.floor(p.x * VZ.nb))] * hz * 1.05 - p.y * H,
        ps = p.s * p.life;
      x.fillStyle = p.c;
      x.globalAlpha = p.life * 0.25;
      x.beginPath();
      x.arc(px, py, ps * 2.6, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = p.life;
      x.beginPath();
      x.arc(px, py, ps, 0, Math.PI * 2);
      x.fill();
    } else if (p.k === 'hat') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      x.globalAlpha = p.life * 0.9;
      x.fillStyle = '#fff';
      x.fillRect(p.x * W, p.y * hz, p.s, p.s * 3);
    } else {
      p.r += dt * H * 0.9;
      x.globalAlpha = p.life * 0.7;
      x.strokeStyle = p.c;
      x.lineWidth = 2 + p.v * 3;
      x.beginPath();
      x.arc(p.x * W, p.y * H, p.r * 0.5, 0, Math.PI * 2);
      x.stroke();
    }
  }
  x.globalAlpha = 1;
  /* snare / crash flashes */
  if (VZ.snare > 0.02 || VZ.flash > 0.02) {
    x.fillStyle = '#fff';
    x.globalAlpha = Math.min(0.35, VZ.snare * 0.12 + VZ.flash * 0.3);
    x.fillRect(0, 0, W, H);
    x.globalAlpha = 1;
  }
  /* label */
  x.textAlign = 'left';
  x.textBaseline = 'bottom';
  x.fillStyle = '#fff';
  x.globalAlpha = 0.55;
  x.font = '800 ' + Math.max(14, Math.min(34, H * 0.1)) + 'px "Barlow Semi Condensed",system-ui,sans-serif';
  x.fillText(on && sc ? sc.name.toUpperCase() : 'READY', 14, H - 10);
  x.globalAlpha = 1;
}
function vizLoop(now) {
  if (document.body.dataset.mode !== 'live') {
    VZ.run = false;
    return;
  }
  const dt = Math.min(0.1, (now - (VZ.last || now)) / 1000);
  VZ.last = now;
  if (!document.hidden) {
    try {
      vizDraw(now, dt);
    } catch (e) {}
  }
  requestAnimationFrame(vizLoop);
}
export function vizStart() {
  if (VZ.run) return;
  VZ.run = true;
  VZ.last = 0;
  requestAnimationFrame(vizLoop);
}
