// Scene Mode's writing to the MC-707: one clip (its notes, and its tone with the track set to play its
// clips' sounds), a track's clips, one scene (its clips first, when they are not written yet), every
// change, or everything; the project tempo; and Auto-write, which writes what changed a moment after a
// change. What was written is marked (model.js), so each clip and scene shows written, changed or new.
//
// Owns: WO (the write settings, localStorage 'mc707-scene-write').
// Reads: S, DEV, MIDI, TR.
import { toast } from '../core/dom.js';
import { S, scheduleSave } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { clipState, pumpKicks, pumpSource, sceneState } from '../core/scene-model.js';
import { PUMP_LANE, kicksUnder, pumpValues } from '../core/pump.js';
import { MIDI } from '../services/midi.js';
import { TR } from '../services/transport.js';
import { askDlg } from '../ui/dialogs.js';
import { MAX_STEPS, STEP_SIZES, encodePattern, writeClip, writeSession } from '../zen/zc-seq.js';
import { MOTION_NONE, MOTION_PER_STEP, motionThin, writeMotion } from '../zen/zc-motion.js';
import { sceneName, writeScenes } from '../zen/zc-scenes.js';
import { lin, slotAddr, trackSetAddr, zxConnect, zxFlush, zxWrite } from '../zen/zc-sysex.js';
import { sendSound, soundFrom } from '../zen/zc-tone.js';
import { zeQuietly } from '../zen/zc-editor.js';
import { SC, clipAt, firstScene, markClip, markPump, markScene, rows, toneOf } from './model.js';
import { uncheck } from './check.js';

const KEY = 'mc707-scene-write';
/** The write settings: write over clips holding notes, send the tones, set the tempo, Auto-write. */
export const WO = { replace: true, tones: true, tempo: true, names: true, auto: false };
try {
  Object.assign(WO, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch (e) {}
export function setWO(k, v) {
  WO[k] = v;
  try {
    localStorage.setItem(KEY, JSON.stringify(WO));
  } catch (e) {}
  SC.draw();
}

const pause = ms => new Promise(r => setTimeout(r, ms));
const on = () => DEVS[DEV].tracks;
/** The pattern a clip gets (a transposed copy, named for it, when it has a transpose). */
export function clipPattern(c) {
  const p = S.patterns[c.pat],
    tr = p.type === 'tone' ? c.tr || 0 : 0;
  if (!tr) return p;
  return {
    ...p,
    name: p.name + ' ' + (tr > 0 ? '+' : '') + tr,
    notes: p.notes.map(n => ({ ...n, n: Math.max(0, Math.min(127, n.n + tr)) }))
  };
}

/**
 * The pump's motion for clip k of track t, as it is written (pattern p, the clip's own copy; pump: a
 * draft to show instead of the clip's own): the lane,
 * the values, where the kicks come from and the kick times. null when the clip has no pump.
 */
export function pumpMotion(t, k, p = clipAt(t, k) && clipPattern(clipAt(t, k)), pump = null) {
  const c = clipAt(t, k);
  pump = pump || (c && c.pump);
  if (!c || !pump || !p) return null;
  const enc = encodePattern(p, p.type);
  if (enc.error) return null;
  const kk = STEP_SIZES[enc.size],
    src = pumpSource(S.scn, S.patterns, t, k),
    kicks = kicksUnder(pumpKicks(S.scn, S.patterns, src), enc.steps * kk);
  return {
    lane: PUMP_LANE[pump.mode],
    vals: pumpValues(pump, kicks, enc.steps, kk),
    src,
    kicks,
    steps: enc.steps,
    k: kk
  };
}

/** What is waiting to be written: clips and scenes that are new or changed. */
export function pending() {
  const q = S.scn;
  if (!q) return { clips: [], scenes: [] };
  const clips = [];
  for (const t of on())
    for (let k = 0; k < 16; k++) if (['new', 'changed'].includes(clipState(q, S.patterns, t, k))) clips.push([t, k]);
  const scenes = q.rows.map((r, i) => i).filter(i => sceneState(q, i) !== 'written');
  return { clips, scenes };
}
/* the clips scene i plays that are not written yet */
const unwrittenIn = i =>
  on()
    .filter(t => rows()[i].pick[t] >= 0)
    .map(t => [t, rows()[i].pick[t]])
    .filter(([t, k]) => clipState(S.scn, S.patterns, t, k) !== 'written');

/**
 * Write clips and scenes. what: {clips: [[t, k]…], scenes: [row…] or 'all'}. Quiet: no summary unless
 * something went wrong (Auto-write).
 */
export async function writeThese(what, quiet = false) {
  if (DEV !== '707') return toast('Scenes are only mapped on the MC-707 so far');
  if (!S.scn) return;
  if (firstScene() + rows().length > 128)
    return toast('That is more scenes than the MC-707 has: start from an earlier scene');
  if (!(await zxConnect())) return toast('The MC-707 is not connected (or MIDI with SysEx is not allowed)');
  const clips = what.clips || [],
    scenes = what.scenes === 'all' ? rows().map((r, i) => i) : what.scenes || [],
    bad = [];
  let wrote = 0,
    stopped = false,
    sc = null;
  const ran = await writeSession('Writing to the MC-707', async ui => {
    const N = clips.length + (scenes.length ? 1 : 0) || 1;
    for (const [n, [t, k]] of clips.entries()) {
      if (ui.cancelled) return void (stopped = true);
      const c = clipAt(t, k),
        p = clipPattern(c),
        where = 'Track ' + devNum(t) + ' clip ' + (k + 1),
        head = where + ': ' + p.name + ' (' + (n + 1) + ' of ' + clips.length + ')';
      ui.set(head, n / N);
      const r = await writeClip(t, k, p, {
        replace: WO.replace,
        name: WO.names,
        onStep: (d, cnt) => ui.set(head + ' · step ' + d + ' of ' + cnt, (n + (d / cnt) * 0.8) / N),
        cancel: () => ui.cancelled
      });
      if (r.cancelled) return void (stopped = true);
      if (!r.ok) {
        bad.push(where + ': not written (' + r.why + ')');
        continue;
      }
      if (!r.checked) bad.push(where + ': read-back did not match (' + r.diff + ')');
      if (r.skipped)
        bad.push(
          where +
            ': ' +
            r.skipped +
            ' note' +
            (r.skipped === 1 ? '' : 's') +
            ' could not go in (no drum note for its lane, past the end, or two of the same note in one step)'
        );
      const tn = toneOf(c),
        snd = WO.tones && tn && soundFrom({ zencore: 1, kind: tn.kind, v: tn.d });
      if (snd) {
        ui.set(head + ' · tone ' + tn.name, (n + 0.9) / N);
        await zeQuietly(() => sendSound(snd, slotAddr(snd.kind, t, k)), t);
        /* the track plays its clips' sounds (Sound Source CLIP) */
        zxWrite(trackSetAddr(t) + 4, [1]);
      }
      /* the pump: its lane written; a lane an earlier pump was written into, cleared when it went */
      const was = S.scn.done.p && S.scn.done.p[t + ':' + k],
        pm = pumpMotion(t, k, p);
      if (was && (!pm || PUMP_LANE[was] !== pm.lane)) {
        ui.set(head + ' · clearing the old pump', (n + 0.92) / N);
        await writeMotion(t, k, PUMP_LANE[was], Array(MAX_STEPS * MOTION_PER_STEP).fill(MOTION_NONE));
        markPump(t, k, null);
      }
      if (pm && !pm.kicks.length)
        bad.push(where + ': the pump has no kicks to follow (put the clip in a scene with a kit clip that has kicks)');
      else if (pm) {
        ui.set(head + ' · pump', (n + 0.95) / N);
        await writeMotion(t, k, pm.lane, motionThin(pm.vals));
        markPump(t, k, c.pump.mode);
      }
      markClip(t, k, !r.checked);
      uncheck(t, k);
      wrote++;
      await pause(250);
    }
    await zxFlush();
    if (scenes.length && !stopped) {
      if (WO.tempo) {
        /* the project tempo: 10 00 00 10, four half-bytes of BPM × 100 (seen on an MC-707: 03 02 00 00 = 128.00) */
        const v = Math.round(S.bpm * 100);
        zxWrite(lin(0x10000010), [(v >> 12) & 15, (v >> 8) & 15, (v >> 4) & 15, v & 15]);
      }
      ui.set('Writing ' + scenes.length + ' scene' + (scenes.length === 1 ? '' : 's'), (N - 1) / N);
      const list = rows().map(r => ({ bars: r.bars, clips: Object.fromEntries(on().map(t => [t, r.pick[t]])) }));
      sc = await writeScenes(list, firstScene(), what.scenes === 'all' ? null : scenes);
      if (sc.ok) for (const i of scenes) markScene(i, !sc.checked);
      if (!sc.ok) bad.push('Scenes: not written (' + sc.why + ')');
      else if (!sc.checked) bad.push('Scenes: the read-back did not match; check them on the MC-707');
    }
  });
  if (ran === null) return;
  scheduleSave();
  SC.draw();
  const did =
    [
      wrote ? wrote + ' clip' + (wrote === 1 ? '' : 's') : '',
      sc && sc.ok ? scenes.length + ' scene' + (scenes.length === 1 ? '' : 's') : ''
    ]
      .filter(Boolean)
      .join(' and ') || 'nothing';
  if (stopped) return toast('Stopped: wrote ' + did);
  if (bad.length) {
    LAST = { title: 'Wrote ' + did + '; ' + bad.length + ' need a look', text: bad.join('\n') };
    return void showReport();
  }
  LAST = { title: 'Wrote ' + did, text: 'Everything read back as written.' };
  if (!quiet) toast('Wrote ' + did + ' to the MC-707. Save the project there to keep it.');
}

/* the last write's report */
let LAST = null;
/** Show the last write's report (what needs a look, and what was different). */
export function showReport() {
  if (!LAST) return toast('Nothing written yet in this session');
  askDlg({
    title: LAST.title,
    text: LAST.text + '\n\nSave the project on the MC-707 to keep what was written.',
    ok: 'Copy',
    cancel: 'Close'
  }).then(
    copy =>
      copy &&
      navigator.clipboard &&
      navigator.clipboard.writeText(LAST.title + '\n' + LAST.text).then(
        () => toast('Copied: paste it into a report'),
        () => {}
      )
  );
}
/** Write one clip. */
export const writeOneClip = (t, k) => writeThese({ clips: [[t, k]] });
/** Write a track's clips (the changed and new ones, or all). */
export function writeTrack(t, all = false) {
  const list = [];
  for (let k = 0; k < 16; k++) {
    const st = clipState(S.scn, S.patterns, t, k);
    if (st !== 'empty' && (all || st !== 'written')) list.push([t, k]);
  }
  if (!list.length) return toast('Track ' + devNum(t) + '’s clips are all written');
  writeThese({ clips: list });
}
/** Write one scene, with the clips it plays that are not written yet. */
export const writeOneScene = i => writeThese({ clips: unwrittenIn(i), scenes: [i] });
/** Write what changed. */
export function writeChanged(quiet = false) {
  const p = pending();
  if (!p.clips.length && !p.scenes.length) return quiet || toast('Everything is written: nothing changed since');
  writeThese(p, quiet);
}
/** Write every clip, or every scene, or both. */
export function writeAll(which = 'both') {
  const clips = [];
  if (which !== 'scenes') for (const t of on()) for (let k = 0; k < 16; k++) if (clipAt(t, k)) clips.push([t, k]);
  writeThese({ clips, scenes: which === 'clips' ? [] : 'all' });
}

/* ---- Auto-write: what changed goes over a moment after a change, when nothing plays ---- */
let autoT = 0;
/** Called after every change (model.js): with Auto-write on, write the changes soon. */
export function autoWrite() {
  if (!WO.auto) return;
  clearTimeout(autoT);
  autoT = setTimeout(() => {
    if (!WO.auto || !MIDI.out || TR.playing || document.body.dataset.mode !== 'scene') return;
    const p = pending();
    if (p.clips.length || p.scenes.length) writeThese(p, true);
  }, 1500);
}
/** "Scenes 1-1 to 1-6": where the rows go. */
export const scenesSpan = () =>
  sceneName(firstScene()) + (rows().length > 1 ? ' to ' + sceneName(firstScene() + rows().length - 1) : '');
