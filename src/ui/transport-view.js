import { $, $$, clamp } from '../core/dom.js';
import { ICON } from '../core/icons.js';
import { ED, S, curClip } from '../core/state.js';
import { HEAD, bw } from '../song/arrangement.js';
import { curPat, patOf } from '../core/song-model.js';
import { edPlay } from '../song/editor.js';
import { AU } from '../services/synth.js';
import { TR, fmtPos, tickDur } from '../services/transport.js';
import { syncAwake } from './fullscreen.js';
import { SH, drawShape } from '../song/shape-editor.js';
import { wizPlayhead, wizSyncPreview } from '../song/wizard-plan.js';
import { liveFrame } from '../live/lanes.js';
import { liveSync } from '../live/panels.js';

export function updTransport() {
  syncAwake();
  if (typeof liveSync === 'function') liveSync();
  if (typeof wizSyncPreview === 'function' && !$('#wiz').hidden) wizSyncPreview();
  const pb = $('#bPlay');
  const on = TR.playing && TR.mode === 'song';
  pb.innerHTML = on ? ICON.stop + ' Stop' : ICON.play + ' Play';
  pb.classList.toggle('on', on);
  const a = $('#bAud');
  if (a) {
    const p = curPat();
    a.textContent = TR.playing && TR.mode === 'pat' && TR.pat === p ? 'Stop pattern' : 'Play pattern';
    a.classList.toggle('on', TR.playing && TR.mode === 'pat' && TR.pat === p);
  }
  $$('.li .aud').forEach(b => {
    const on2 = TR.playing && TR.mode === 'pat' && TR.pat === b._pat;
    b.textContent = on2 ? '■' : '▶';
  });
}
export function frame() {
  requestAnimationFrame(frame);
  if (!TR.playing) return;
  const now = AU.ctx.currentTime;
  while (TR.vis.length > 1 && TR.vis[1].time <= now) TR.vis.shift();
  const v = TR.vis[0];
  if (!v) return;
  const tick = v.tick + (now >= v.time ? clamp((now - v.time) / (v.dur || tickDur()), 0, 1) : 0);
  if (TR.mode === 'song') {
    const bars = tick / 32;
    updPlayhead(bars);
    $('#pos').textContent = fmtPos(bars);
    const c = curClip();
    if (c && bars >= c.start && bars < c.start + c.len) {
      const pb = patOf(c).bars;
      edPlay(((bars - c.start + c.off) * 16) % (pb * 16));
    } else edPlay(-1);
  } else if (TR.mode === 'wiz') {
    wizPlayhead(tick / 32);
  } else if (TR.mode === 'live') {
    liveFrame(tick);
  } else {
    edPlay(tick / 2);
  }
}
export function updPlayhead(bars) {
  SH.pos = bars;
  if (ED.mode === 'shape' && TR.playing && $('#edShape') && !$('#edShape').hidden) drawShape();
  const ph = $('#playhead');
  if (!ph) return;
  ph.style.display = 'block';
  ph.style.transform = 'translateX(' + (HEAD + bars * bw) + 'px)';
  if (TR.playing && TR.mode === 'song' && S.follow) {
    const a = $('#arr');
    const x = HEAD + bars * bw;
    if (x < a.scrollLeft + HEAD + 10 || x > a.scrollLeft + a.clientWidth - 50)
      a.scrollLeft = Math.max(0, x - HEAD - 40);
  }
  if (!TR.playing) $('#pos').textContent = fmtPos(bars);
}
