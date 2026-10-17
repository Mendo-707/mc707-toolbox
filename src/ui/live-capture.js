// Capture to Song: turns what was played in Live Mode into an arrangement, markers and clip
// changes.
//
// Reads: S, LV, TR, bw.
import { $, toast } from '../core/dom.js';
import { devOn } from '../core/device.js';
import { S, addPattern, pushUndo, scheduleSave } from '../core/state.js';
import { bw } from '../song/arrangement.js';
import { LEVELS, facById, shiftFor } from '../library/index.js';
import { ensureBars, songEnd } from '../core/song-model.js';
import { TR, stopAll } from '../services/transport.js';
import { cmMarks } from '../services/clip-switch.js';
import { renderAll } from './controls.js';
import { trackLabel } from '../library/styles.js';
import { instShift } from '../song/wizard-plan.js';
import { LV, lvStyle } from '../live/state.js';
import { lvModeFam } from '../library/pools.js';
import { LV_RCLIP, lvModeNote } from '../live/engine.js';
import { lvOn } from '../live/cues.js';
import { setMode } from './mode.js';
import { askDlg } from './dialogs.js';

/* ---- capture the set into Song Mode ---- */
function lvCapPat(f, key, mode, st) {
  if (f.type !== 'tone' || !f.key || lvModeFam(f.key.scale) === mode)
    return instShift(f, shiftFor(f, key), key, st.scale);
  const sh = shiftFor(f, key),
    k0 = LV.key,
    m0 = LV.mode;
  LV.key = key;
  LV.mode = mode;
  const notes = f.notes.map(n => ({ ...n, n: lvModeNote(n.n + sh) }));
  LV.key = k0;
  LV.mode = m0;
  return addPattern('tone', f.name + ' (' + mode + ')', f.bars, notes, {
    src: f.id,
    genre: f.genre,
    key: { root: key, scale: mode },
    role: f.role,
    shift: sh
  });
}
export async function liveCapture() {
  if (!LV.log.length || LV.lastTick < 32) {
    toast('Play a set first, then capture it');
    return;
  }
  const st = lvStyle();
  const endBar = lvOn() ? Math.max(1, Math.floor(TR.tick / 32)) : Math.max(1, Math.ceil((LV.lastTick + 1) / 32));
  const segs = LV.log
    .map((e, i) => ({
      s: Math.round(e.tick / 32),
      e: Math.min(endBar, i + 1 < LV.log.length ? Math.round(LV.log[i + 1].tick / 32) : endBar),
      x: e
    }))
    .filter(g => g.e > g.s);
  if (!segs.length) {
    toast('Nothing to capture yet');
    return;
  }
  if (S.clips.length) {
    const ok = await askDlg({
      title: 'Add the captured set to Song Mode?',
      text: 'It will be placed after the current arrangement, with a marker for each scene.',
      ok: 'Capture'
    });
    if (!ok) return;
  }
  stopAll();
  pushUndo();
  const base = S.clips.length ? Math.ceil(songEnd() / 8) * 8 : 0;
  if (!S.clips.length) {
    S.bpm = LV.bpm;
    S.swing = LV.swing;
    S.key = LV.key;
    S.scale = st.scale || 'minor';
    S.tracks.forEach((t, i) => {
      t.name = trackLabel(st, i);
      t.vol = LEVELS[i];
      t.mute = false;
      t.solo = false;
    });
  }
  let count = 0,
    lastIdx = -1;
  for (let t = 0; t < 8; t++) {
    let run = null;
    const close = () => {
      if (!run) return;
      const f = facById(run.id);
      if (f) {
        const pid = lvCapPat(f, run.key, run.mode || LV.mode, st);
        S.clips.push({ id: 'c' + S.nextId++, t, start: base + run.s, len: run.e - run.s, off: 0, pat: pid });
        count++;
      }
      run = null;
    };
    for (const g of segs) {
      const id = g.x.mute[t] ? null : g.x.ids[t];
      if (!id) {
        close();
        continue;
      }
      if (run && run.id === id && run.key === g.x.key && run.mode === g.x.mode && run.e === g.s) run.e = g.e;
      else {
        close();
        run = { id, key: g.x.key, mode: g.x.mode, s: g.s, e: g.e };
      }
    }
    close();
  }
  const pin = {};
  segs.forEach(g => {
    if (g.x.idx !== lastIdx) {
      lastIdx = g.x.idx;
      const sc = LV.scenes[g.x.idx];
      S.markers.push({ bar: base + g.s, name: (sc ? sc.name : 'Scene').slice(0, 20) });
      /* the clips each scene asked for become clip changes on the tracks */
      if (sc)
        for (let t = 0; t < 8; t++) {
          if (!devOn(t)) continue;
          const c = sc.cells[t],
            r = c && c.clip === 'random' ? LV_RCLIP[g.x.idx + ':' + t] : null,
            k = c && c.clip != null ? (c.clip === 'random' ? (r != null ? r : -1) : c.clip) : -1;
          if (k !== (pin[t] == null ? -1 : pin[t])) {
            const ms = cmMarks();
            ms.filter(m => m.t === t && m.bar === base + g.s).forEach(m => ms.splice(ms.indexOf(m), 1));
            ms.push({ t, bar: base + g.s, k });
            pin[t] = k;
          }
        }
    }
  });
  cmMarks().sort((a, b) => a.bar - b.bar || a.t - b.t);
  S.markers.sort((a, b) => a.bar - b.bar);
  ensureBars(base + endBar);
  setMode('song');
  renderAll();
  $('#arr').scrollLeft = Math.max(0, base * bw);
  scheduleSave();
  toast('Captured ' + endBar + ' bars into Song Mode (' + count + ' clips)');
}
