import { $, $$, clamp, toast } from '../core/dom.js';
import { DEV } from '../core/device.js';
import { S, UI, addPattern, pushUndo, scheduleSave } from '../core/state.js';
import { bw } from './arrangement.js';
import { ensureBars, songEnd } from '../core/song-model.js';
import { ED } from './editor.js';
import { AU, ensureAudio } from '../services/synth.js';
import { TICKER, TR, sched, startPat, stopAll, stopPlay } from '../services/transport.js';
import { updTransport } from '../clips/clips-screen.js';
import { renderAll } from './controls.js';
import { LEVELS, facById, shiftFor } from '../library/index.js';
import { STYLES, trackLabel } from '../library/styles.js';
import { WIZ } from './wizard-ui.js';
import { defaultWiz, wizPlan } from './wizard-styles.js';

/* What plays on a track at a bar of a wizard section: fills on Drums 1, builds and impacts on Drums 3. */
export function wizCellAt(sec, t, rel) {
  const c = sec.cells[t];
  if (t === 2) {
    if (sec.impact && rel === 0) return { id: sec.impact, off: 0 };
    if (sec.build && rel >= sec.build.bar) return { id: sec.build.id, off: sec.build.bar };
  }
  if (!c || !c.id) return null;
  if (t === 0 && DEV === '101' && sec.build && rel >= sec.build.bar) return { id: sec.build.id, off: sec.build.bar };
  if (t === 0 && sec.fills.length) {
    const fl = sec.fills.find(x => x.bar === rel);
    if (fl) return { id: fl.id, off: rel };
  }
  return { id: c.id, off: 0 };
}
export function instShift(f, sh, rootPc, scale) {
  const found = Object.keys(S.patterns).find(k => {
    const p = S.patterns[k];
    return p.src === f.id && !p.mod && (p.shift || 0) === sh;
  });
  if (found) return found;
  return addPattern(
    f.type,
    f.name,
    f.bars,
    f.notes.map(n => ({ ...n, n: f.type === 'tone' ? n.n + sh : n.n })),
    {
      src: f.id,
      genre: f.genre,
      key: f.type === 'tone' ? { root: rootPc, scale: scale || (f.key && f.key.scale) || 'minor' } : null,
      role: f.role,
      shift: sh
    }
  );
}
export function wizApply() {
  const w = WIZ,
    plan = wizPlan(w),
    st = plan.st;
  stopAll();
  pushUndo();
  let base = 0;
  if (w.mode === 'replace') {
    S.clips = [];
    S.patterns = {};
    S.markers = [];
    S.clipMarks = [];
    S.bars = 32;
    S.cursor = 0;
    S.loop = { on: false, start: 0, end: 8 };
    UI.sel = null;
    ED.selNotes.clear();
  } else if (S.clips.length) base = Math.ceil(songEnd() / 8) * 8;
  if (w.mode === 'replace') {
    S.bpm = w.bpm;
    S.swing = w.swing;
    S.key = w.key;
    S.scale = st.scale || 'minor';
  }
  if (w.mode === 'replace' && w.opts.names)
    S.tracks.forEach((t, i) => {
      t.name = trackLabel(st, i);
      t.vol = LEVELS[i];
      t.mute = false;
      t.solo = false;
    });
  const add = (t, start, len, fid) => {
    const f = facById(fid);
    if (!f || len < 1) return;
    const pid = instShift(f, shiftFor(f, w.key), w.key, st.scale);
    S.clips.push({ id: 'c' + S.nextId++, t, start: base + start, len, off: 0, pat: pid });
  };
  plan.sections.forEach(sec => {
    S.markers.push({ bar: base + sec.start, name: sec.name.slice(0, 20) });
    if (DEV === '101' && (sec.build || sec.impact)) {
      /* MC-101: one drum track, so the build takes over the kit for its last bars */
      const c = sec.cells[0],
        end = sec.build ? sec.build.bar : sec.bars;
      if (c && c.id) {
        let pos = 0;
        for (const fl of sec.fills.filter(x => x.bar < end)) {
          if (fl.bar > pos) add(0, sec.start + pos, fl.bar - pos, c.id);
          add(0, sec.start + fl.bar, 1, fl.id);
          pos = fl.bar + 1;
        }
        if (pos < end) add(0, sec.start + pos, end - pos, c.id);
      }
      if (sec.build) add(0, sec.start + sec.build.bar, sec.build.len, sec.build.id);
    } else if (sec.build || sec.impact) {
      const c = sec.cells[2],
        a = sec.impact ? 1 : 0,
        b = sec.build ? sec.build.bar : sec.bars;
      if (sec.impact) add(2, sec.start, 1, sec.impact);
      if (c && c.id && b > a) add(2, sec.start + a, b - a, c.id);
      if (sec.build) add(2, sec.start + sec.build.bar, sec.build.len, sec.build.id);
    }
    for (const t in sec.cells) {
      const c = sec.cells[t];
      if (!c.id) continue;
      if (+t === 2 && (sec.build || sec.impact)) continue;
      if (+t === 0 && DEV === '101' && (sec.build || sec.impact)) continue;
      if (+t === 0 && sec.fills.length) {
        let pos = 0;
        for (const fl of sec.fills) {
          if (fl.bar > pos) add(0, sec.start + pos, fl.bar - pos, c.id);
          add(0, sec.start + fl.bar, 1, fl.id);
          pos = fl.bar + 1;
        }
        if (pos < sec.bars) add(0, sec.start + pos, sec.bars - pos, c.id);
      } else add(+t, sec.start, sec.bars, c.id);
    }
  });
  if (w.modulate && w.modulate.on) {
    const last = [...plan.sections].reverse().find(s => /drop|hook|chorus/.test(s.kind));
    if (last) {
      const from = base + last.start;
      S.clips.forEach(c => {
        if (c.start >= from - 1e-9 && S.tracks[c.t].type === 'tone')
          c.tr = clamp((c.tr || 0) + w.modulate.semi, -48, 48);
      });
    }
  }
  ensureBars(base + plan.total);
  S.markers.sort((a, b) => a.bar - b.bar);
  if (w.opts.loop) {
    const d = plan.sections.find(s => /drop|hook/.test(s.kind));
    if (d) {
      S.loop = { on: true, start: base + d.start, end: base + d.start + Math.min(d.bars, 16) };
      S.cursor = base + d.start;
    }
  }
  closeWiz();
  renderAll();
  const a = $('#arr');
  a.scrollLeft = Math.max(0, base * bw);
  toast('Song created. Press Space to play.');
  scheduleSave();
}
/* ---- wizard preview ---- */
function startWiz(plan, key, secIdx, bpm, swing) {
  stopAll();
  ensureAudio();
  const sec = secIdx != null ? plan.sections[secIdx] : null;
  const startTick = (sec ? sec.start : 0) * 32,
    endTick = (sec ? sec.start + sec.bars : plan.total) * 32;
  Object.assign(TR, {
    playing: true,
    mode: 'wiz',
    wz: {
      plan,
      key,
      bpm: bpm || plan.st.bpm[2],
      swing: swing == null ? plan.st.swing : swing,
      startTick,
      endTick,
      loop: !!sec,
      secIdx: secIdx == null ? null : secIdx
    },
    tick: startTick,
    nextTime: AU.ctx.currentTime + 0.06,
    vis: [],
    ending: false,
    recEnd: null
  });
  TICKER.start();
  sched();
  updTransport();
}
export function wizSongPreview() {
  if (TR.playing && TR.mode === 'wiz' && !TR.wz.loop) {
    stopPlay();
    return;
  }
  startWiz(wizPlan(WIZ), WIZ.key, null, WIZ.bpm, WIZ.swing);
}
export function wizSecPreview(si) {
  if (TR.playing && TR.mode === 'wiz' && TR.wz.secIdx === si) {
    stopPlay();
    return;
  }
  startWiz(wizPlan(WIZ), WIZ.key, si, WIZ.bpm, WIZ.swing);
}
export function wizCellPreview(id, t) {
  const f = facById(id);
  if (!f) return;
  if (TR.playing && TR.mode === 'pat' && TR.pat === f && TR.patTrack === t) {
    stopPlay();
    return;
  }
  startPat(f, t, null, f.type === 'tone' ? shiftFor(f, WIZ.key) : 0, WIZ.bpm, WIZ.swing);
}
export function styleDemo(id) {
  const st = STYLES.find(s => s.id === id);
  const w = defaultWiz(id);
  const plan = wizPlan(w);
  let idx = plan.sections.findIndex(s => /drop|hook/.test(s.kind));
  if (idx < 0) idx = 0;
  if (TR.playing && TR.mode === 'wiz' && TR.wz.demo === id) {
    stopPlay();
    return;
  }
  startWiz(plan, w.key, idx, w.bpm, w.swing);
  TR.wz.demo = id;
  wizSyncPreview();
}
export function wizSyncPreview() {
  const wz = TR.playing && TR.mode === 'wiz' ? TR.wz : null;
  const sb = $('#wzSong');
  if (sb) {
    const on = !!wz && !wz.loop;
    sb.textContent = on ? '■ Stop preview' : '▶ Preview the song';
    sb.classList.toggle('on', on);
  }
  $$('.wzsec').forEach(b => {
    const on = !!wz && wz.secIdx === +b.dataset.si;
    b.textContent = on ? '■' : '▶';
    b.classList.toggle('on', on);
  });
  $$('.wzcell').forEach(b => {
    const on = TR.playing && TR.mode === 'pat' && TR.pat === b._f && TR.patTrack === +b.dataset.t;
    b.textContent = on ? '■' : '▶';
    b.classList.toggle('on', on);
  });
  $$('.sdemo').forEach(b => {
    const on = !!wz && wz.demo === b.dataset.id;
    b.textContent = on ? '■ Stop' : '▶ Hear it';
    b.classList.toggle('on', on);
  });
  if (!wz) $$('.tlh.playing').forEach(e => e.classList.remove('playing'));
}
export function wizPlayhead(bars) {
  const wz = TR.wz;
  if (!wz) return;
  const sec = wz.plan.sections.find(s => bars >= s.start && bars < s.start + s.bars);
  $$('.tlh').forEach(e => e.classList.toggle('playing', !!sec && +e.dataset.si === sec.si));
}
export function closeWiz() {
  $('#wiz').hidden = true;
  if (TR.playing && (TR.mode === 'wiz' || TR.mode === 'pat')) stopPlay();
}
