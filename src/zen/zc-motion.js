// A clip's motion: the knob moves the MC-707 records into a clip and plays back with it. Each clip has 8
// lanes (C1-C4, then four more), and each step of a lane holds 8 values (0-127, or none: no change),
// two half-bytes each, at the clip's descriptor + 04 00 00 + step × 01 00 + lane × 10. Found by Ada
// Locriana (github.com/Locriana/mctools_sidechain, MIT licence), whose sidechain tool writes a volume
// dip there on every kick.
//
// For now only the Motion test (Help › For developers) uses it: read which lanes of a clip hold motion,
// write a slow test shape into one lane, or clear a lane, to find which lane moves what on your MC-707.
//
// Reads: S, DEV.
import { el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { askDlg } from '../ui/dialogs.js';
import { devTrack, lin, zxConnect, zxFlush, zxRead, zxWrite } from './zc-sysex.js';
import { clipPacked, decodeParams, paramAddr, writeSession } from './zc-seq.js';

/** The lanes, by index. */
export const MOTION_LANES = ['C1', 'C2', 'C3', 'C4', 'Lane 5', 'Lane 6', 'Lane 7', 'Lane 8'];
/** Values per step in a lane. */
export const MOTION_PER_STEP = 8;
/** A value that means no change. */
export const MOTION_NONE = -1;

/** The linear address of lane `lane` of step s in clip k of app track t. */
export const motionAddr = (t, k, s, lane) => lin(clipPacked(devTrack(t), k) + 0x40000 + s * 0x100 + lane * 0x10);

/** One step of a lane from its 16 bytes: 8 values, 0-127 or -1 (none). */
export function decodeMotion(b) {
  const out = [];
  for (let i = 0; i < MOTION_PER_STEP; i++) {
    const v = b && b.length >= i * 2 + 2 ? ((b[i * 2] & 15) << 4) | (b[i * 2 + 1] & 15) : 0xff;
    out.push(v > 127 ? MOTION_NONE : v);
  }
  return out;
}
/** 8 values (0-127, or -1 for none) as the 16 bytes of one step of a lane. */
export const encodeMotion = vals =>
  Array.from({ length: MOTION_PER_STEP }, (_, i) => {
    const v = vals[i];
    return v >= 0 && v <= 127 ? Math.round(v) : 0xff;
  }).flatMap(v => [(v >> 4) & 15, v & 15]);

/** Values the same as the one before become none, the way the MC-707 keeps them. */
export function motionThin(vals) {
  let last = null;
  return vals.map(v => {
    if (v === last) return MOTION_NONE;
    last = v;
    return v;
  });
}

/* the clip's step settings, or null */
async function clipSteps(t, k) {
  const r = await zxRead(paramAddr(t, k), 3, 600, true);
  return decodeParams(Array.isArray(r) ? r : null);
}
/**
 * Read lane `lane` of clip k (read-only), the first `steps` steps.
 * @returns {Promise<number[]|null>} steps × 8 values, or null when the MC-707 did not answer
 */
export async function readMotion(t, k, lane, steps, onStep) {
  const out = [];
  for (let s = 0; s < steps; s++) {
    const b = await zxRead(motionAddr(t, k, s, lane), 16, 300, true);
    if (!Array.isArray(b) && s === 0) return null;
    out.push(...decodeMotion(Array.isArray(b) ? b : null));
    if (onStep) onStep(s + 1, steps);
  }
  return out;
}
/** Write lane `lane` of clip k: vals is steps × 8 values (-1: no change). */
export async function writeMotion(t, k, lane, vals, onStep, cancelled) {
  const steps = Math.ceil(vals.length / MOTION_PER_STEP);
  for (let s = 0; s < steps; s++) {
    zxWrite(motionAddr(t, k, s, lane), encodeMotion(vals.slice(s * MOTION_PER_STEP, (s + 1) * MOTION_PER_STEP)));
    await zxFlush();
    if (onStep) onStep(s + 1, steps);
    if (cancelled && cancelled()) return false;
  }
  return true;
}

/** A few words on what a lane holds. */
export function motionSummary(vals) {
  const set = vals.filter(v => v >= 0);
  if (!set.length) return 'no motion';
  const first = vals.findIndex(v => v >= 0);
  return (
    set.length +
    ' values, ' +
    Math.min(...set) +
    ' to ' +
    Math.max(...set) +
    ' (first at step ' +
    (Math.floor(first / MOTION_PER_STEP) + 1) +
    ': ' +
    vals[first] +
    ')'
  );
}
/** The test shape: from 0 up to 127 over the first half of the clip, and back down over the second. */
export function testShape(steps) {
  const n = steps * MOTION_PER_STEP;
  return motionThin(Array.from({ length: n }, (_, i) => Math.round(127 * (1 - Math.abs((2 * i) / n - 1)))));
}

/* ---- the Motion test (Help › For developers) ---- */
/** Read (up to this many steps) when reading every lane, to keep it quick. */
const READ_ALL_STEPS = 32;

export function motionTestOpen() {
  if (document.getElementById('mtOv')) return;
  const name = DEVS[DEV].name;
  const firstTone = DEVS[DEV].tracks.find(i => S.tracks[i].type !== 'drum');
  const trk = el(
    'select',
    { 'aria-label': 'Track' },
    ...DEVS[DEV].tracks.map(i =>
      /* the first tone track to start with: a bass or pad shows a level change best */
      el('option', { value: i, selected: i === firstTone }, 'Track ' + devNum(i) + ' · ' + S.tracks[i].name)
    )
  );
  const clip = el(
    'select',
    { 'aria-label': 'Clip' },
    ...Array.from({ length: 16 }, (_, k) => el('option', { value: k }, 'Clip ' + (k + 1)))
  );
  const lane = el(
    'select',
    { 'aria-label': 'Lane' },
    ...MOTION_LANES.map((n, i) => el('option', { value: i, selected: i === 3 }, n))
  );
  const out = el('pre', { class: 'sfOut' }, 'Nothing read yet.'),
    status = el('div', { class: 'hint', role: 'status', 'aria-live': 'polite' }, '');
  const log = [];
  const say = (...l) => {
    log.push(...l);
    out.textContent = log.join('\n');
    out.scrollTop = out.scrollHeight;
  };
  const where = () => 'track ' + devNum(+trk.value) + ' clip ' + (+clip.value + 1);
  let busy = false;
  /* run job with the buttons off, after checking the connection and the clip */
  const run = async job => {
    if (busy) return;
    if (!(await zxConnect())) return toast('The ' + name + ' is not connected (or MIDI with SysEx is not allowed)');
    const t = +trk.value,
      k = +clip.value;
    const p = await clipSteps(t, k);
    if (!p) return say('', where() + ': the ' + name + ' did not answer for that clip.');
    busy = true;
    btns.forEach(b => (b.disabled = true));
    try {
      await job(t, k, p.steps);
    } finally {
      busy = false;
      btns.forEach(b => (b.disabled = false));
      status.textContent = '';
    }
  };
  const readAll = el(
    'button',
    {
      type: 'button',
      class: 'btn on',
      onclick: () =>
        run(async (t, k, steps) => {
          const n = Math.min(steps, READ_ALL_STEPS);
          say('', 'Read ' + where() + ' (' + steps + ' steps' + (n < steps ? ', the first ' + n + ' read' : '') + '):');
          for (let l = 0; l < MOTION_LANES.length; l++) {
            const v = await readMotion(t, k, l, n, (d, of) => {
              status.textContent = 'Reading ' + MOTION_LANES[l] + '… step ' + d + ' of ' + of;
            });
            say('  ' + MOTION_LANES[l] + ': ' + (v ? motionSummary(v) : 'did not answer'));
          }
        })
    },
    'Read every lane'
  );
  const write = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: () =>
        run(async (t, k, steps) => {
          const l = +lane.value,
            ln = MOTION_LANES[l];
          const before = await readMotion(t, k, l, steps);
          if (
            !(await askDlg({
              title: 'Write the test shape?',
              text:
                'Lane ' +
                ln +
                ' of ' +
                where() +
                ' gets a slow move from 0 up to 127 and back across the clip (' +
                steps +
                ' steps). Only this lane is written; the notes and the other lanes stay. ' +
                (before && before.some(v => v >= 0)
                  ? 'It holds motion now (' + motionSummary(before) + '), which is replaced.'
                  : 'It holds no motion now.'),
              ok: 'Write'
            }))
          )
            return;
          const shape = testShape(steps);
          const ok = await writeSession('Writing the test shape to ' + where() + ', ' + ln, ui =>
            writeMotion(
              t,
              k,
              l,
              shape,
              (d, of) => ui.set('Step ' + d + ' of ' + of, d / of),
              () => ui.cancelled
            )
          );
          if (!ok) return say('', 'Stopped part-way: ' + ln + ' of ' + where() + ' is only partly written.');
          const back = await readMotion(t, k, l, steps);
          const same = back && back.every((v, i) => v === shape[i]);
          say(
            '',
            'Wrote the test shape to ' +
              ln +
              ' of ' +
              where() +
              ': ' +
              (same
                ? 'read back the same.'
                : 'read back differently (' + (back ? motionSummary(back) : 'no answer') + ').'),
            'Now play the clip on the ' +
              name +
              ' and watch the knobs: which one moves (C1-C4), and what do you hear change?'
          );
        })
    },
    'Write test shape'
  );
  const clear = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: () =>
        run(async (t, k, steps) => {
          const l = +lane.value,
            ln = MOTION_LANES[l];
          if (
            !(await askDlg({
              title: 'Clear the lane?',
              text: 'Lane ' + ln + ' of ' + where() + ' loses all its motion.',
              ok: 'Clear'
            }))
          )
            return;
          const ok = await writeSession('Clearing ' + ln + ' of ' + where(), ui =>
            writeMotion(
              t,
              k,
              l,
              Array(steps * MOTION_PER_STEP).fill(MOTION_NONE),
              (d, of) => ui.set('Step ' + d + ' of ' + of, d / of),
              () => ui.cancelled
            )
          );
          say(
            '',
            ok ? 'Cleared ' + ln + ' of ' + where() + '.' : 'Stopped part-way: ' + ln + ' is only partly cleared.'
          );
        })
    },
    'Clear lane'
  );
  const copy = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(out.textContent);
          toast('Copied: paste it into the chat');
        } catch (e) {
          toast('Could not copy: select the text and copy it');
        }
      }
    },
    'Copy results'
  );
  const btns = [readAll, write, clear];
  const close = () => !busy && ov.remove();
  const ov = el(
    'div',
    { id: 'mtOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Motion test' },
    el(
      'div',
      { class: 'ptBox', style: 'max-width:680px' },
      el('h3', {}, 'Motion test: which lane moves what'),
      el(
        'p',
        { class: 'hint', style: 'line-height:1.45' },
        'A clip’s motion is the knob moves it plays back. This finds which of its 8 lanes moves which knob on your ' +
          name +
          '. Use a clip that holds notes in a project you can lose, and stop playback first. Thanks to Ada Locriana for finding where motion is kept.'
      ),
      el(
        'ol',
        { class: 'hint sfSteps' },
        el('li', {}, 'Pick the track and clip. Read every lane (read-only) to see which lanes hold motion already.'),
        el(
          'li',
          {},
          'Pick lane C4 and Write test shape. Play the clip on the ' + name + ': which knob moves, and what changes?'
        ),
        el('li', {}, 'Try C1-C3 the same way if you like. Clear lane takes the shape out again.'),
        el(
          'li',
          {},
          'Optional: record a knob move on the ' + name + ' (motion rec), then Read every lane to see where it went.'
        ),
        el('li', {}, 'Copy results into the chat, with what moved.')
      ),
      el(
        'div',
        { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
        trk,
        clip,
        readAll,
        lane,
        write,
        clear,
        copy
      ),
      status,
      out,
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Close')
      )
    )
  );
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  document.body.append(ov);
}
