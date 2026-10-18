// MIDI input in Live Mode: the MC-707 pads and keys (Raven keys), the pad test, and the computer
// keyboard.
//
// Reads: LV, MIDI, DEV.
import { S } from '../core/state.js';
import { lvUserNote } from './moves.js';
import { $, clamp, el, toast } from '../core/dom.js';
import { DEV, DEVS } from '../core/device.js';
import { MIDI, sentRecently } from '../services/midi.js';
import { LV, LV_DRUM_NOTES, LV_KBD_OFF, lvKbdNotes, lvLayoutNotes, noteLbl, saveLive } from './state.js';
import { liveToggle } from './engine.js';
import { livePadDown, livePadUp } from './pads.js';
import { ravenKeyKey, ravenMuteKey } from './controller.js';
import { liveRenderPads } from './panels.js';
import { liveRenderSettings } from './settings-panel.js';

/* ---- MIDI in: pads, key octave, mute octave, knob mirror ---- */
/* ---- Pad test: press pads 1-16 in order and record exactly what the MC-707 sends ---- */
const PT = { on: false, i: 0, res: [] };
export function padTestOpen() {
  PT.on = true;
  PT.i = 0;
  PT.res = Array(16).fill(null);
  let ov = $('#ptOv');
  if (ov) ov.remove();
  ov = el('div', { id: 'ptOv', class: 'ptOv', role: 'dialog', 'aria-label': 'Pad test' });
  document.body.append(ov);
  padTestRender();
}
function padTestClose() {
  PT.on = false;
  const o = $('#ptOv');
  if (o) o.remove();
}
function padTestText() {
  return (
    DEVS[DEV].name +
    ' pad test: ' +
    PT.res.map((x, i) => i + 1 + '=' + (x ? 'ch' + x.ch + ' n' + x.n : 'none')).join(', ')
  );
}
function padTestRender() {
  const ov = $('#ptOv');
  if (!ov) return;
  ov.textContent = '';
  const done = PT.i >= 16,
    grid = el('div', { class: 'ptGrid' });
  for (let i = 0; i < 16; i++) {
    const x = PT.res[i];
    grid.append(
      el(
        'div',
        { class: 'ptPad' + (i === PT.i && !done ? ' now' : '') + (x ? ' got' : '') },
        el('b', {}, String(i + 1)),
        el('span', {}, x ? noteLbl(x.n) + ' (' + x.n + ')' : i === PT.i && !done ? 'press' : ''),
        x ? el('small', {}, 'ch ' + x.ch) : ''
      )
    );
  }
  const box = el(
    'div',
    { class: 'ptBox' },
    el('h3', {}, 'Pad test'),
    el(
      'p',
      {},
      done
        ? 'Done. Copy the result and paste it to Claude, or use it now.'
        : 'Select a drum track on the ' +
            DEVS[DEV].name +
            ', then press pad ' +
            (PT.i + 1) +
            ' (' +
            (PT.i < 8 ? 'top row, ' : 'bottom row, ') +
            ((PT.i % 8) + 1) +
            (['st', 'nd', 'rd'][PT.i % 8] || 'th') +
            ' from the left).'
    ),
    MIDI.inp ? '' : el('p', { class: 'ptWarn' }, 'No MC-707 input is connected. Press Connect MC-707 first.'),
    el(
      'p',
      { class: 'hint' },
      "Nothing arriving? On the MC-707 hold SHIFT and press that track's TRACK SEL button, open the MIDI page, and turn TxMIDI Note ON with output set to USB."
    ),
    grid,
    done ? el('textarea', { readonly: true, class: 'ptOut', rows: 3 }, padTestText()) : '',
    el(
      'div',
      { class: 'lvBtns' },
      done
        ? el(
            'button',
            {
              class: 'btn on',
              onclick: () => {
                const t = padTestText();
                try {
                  navigator.clipboard.writeText(t);
                  toast('Copied. Paste it to Claude.');
                } catch (e) {
                  toast('Select the text and copy it');
                }
              }
            },
            'Copy result'
          )
        : el(
            'button',
            {
              class: 'btn',
              onclick: () => {
                PT.res[PT.i] = null;
                PT.i++;
                padTestRender();
              }
            },
            'Skip (pad sends nothing)'
          ),
      done
        ? el(
            'button',
            {
              class: 'btn',
              onclick: () => {
                const got = PT.res.filter(Boolean);
                if (!got.length) return;
                LV.padNotes = PT.res.map(x => (x ? x.n : null));
                const chs = [...new Set(got.map(x => x.ch))];
                LV.padCh = chs.length === 1 ? chs[0] : 0;
                LV.padLayout = 'custom';
                saveLive();
                liveRenderPads();
                liveRenderSettings();
                toast('Pads set from the test');
                padTestClose();
              }
            },
            'Use these for my pads'
          )
        : '',
      el(
        'button',
        {
          class: 'btn',
          onclick: () => {
            PT.i = Math.max(0, PT.i - 1);
            PT.res[PT.i] = null;
            padTestRender();
          }
        },
        'Back one'
      ),
      el('button', { class: 'btn', onclick: padTestClose }, 'Close')
    )
  );
  ov.append(box);
}
function padTestMidi(d) {
  const typ = d[0] & 0xf0;
  if (!(typ === 0x90 && d[2] > 0) || PT.i >= 16) return true;
  PT.res[PT.i] = { ch: (d[0] & 15) + 1, n: d[1], v: d[2] };
  PT.i++;
  padTestRender();
  return true;
}
export function liveMidi(ev) {
  const d = ev.data;
  if (!d || d.length < 3) return false;
  const st = d[0];
  if (st < 0x80 || st >= 0xf0) return false;
  if (PT.on) return padTestMidi(d);
  const typ = st & 0xf0,
    ch = (st & 15) + 1;
  if (typ === 0xb0 && d[1] >= 80 && d[1] <= 83) {
    LV.knobsIn[d[1] - 80] = d[2];
    const k = $('#lvKi' + (d[1] - 80));
    if (k) k.style.setProperty('--v', d[2] / 127);
    return false;
  }
  const isOn = typ === 0x90 && d[2] > 0,
    isOff = typ === 0x80 || (typ === 0x90 && d[2] === 0);
  const n = d[1];
  if (isOff) {
    if (LV.padCh === 0 || LV.padCh === ch) {
      const i = LV.padNotes.indexOf(n);
      if (i >= 0) {
        livePadUp(i);
        return true;
      }
    }
    if (LV.perfOn && (LV.keyCh === 0 || LV.keyCh === ch)) {
      const k = n - LV.keyBase;
      if (k >= 0 && k < 12) {
        ravenKeyKey(k, false);
        return true;
      }
      const m = n - LV.muteBase;
      if (m >= 0 && m < 12) {
        ravenMuteKey(m, false);
        return true;
      }
    }
    lvPlayedHere(ch, n, false);
    return false;
  }
  if (!isOn) return false;
  if (LV.learn === 'p1') {
    LV.padCh = 0;
    LV.padBase = clamp(n, 0, 112);
    LV.padNotes = LV.padLayout === 'drum' ? LV_DRUM_NOTES.map(x => clamp(x + n - 37, 0, 127)) : lvLayoutNotes();
    LV.learn = -1;
    saveLive();
    liveRenderPads();
    liveRenderSettings();
    toast('Pads set: pad 1 sends note ' + n);
    return true;
  }
  if (LV.learn >= 0) {
    if (LV.learn === 0) LV.padCh = ch;
    LV.padNotes[LV.learn] = n;
    LV.padLayout = 'custom';
    LV.learn = LV.learn >= 15 ? -1 : LV.learn + 1;
    saveLive();
    liveRenderPads();
    liveRenderSettings();
    return true;
  }
  if (LV.padCh === 0 || LV.padCh === ch) {
    const i = LV.padNotes.indexOf(n);
    if (i >= 0) {
      livePadDown(i);
      return true;
    }
  }
  const ravenNote =
    LV.perfOn &&
    (LV.keyCh === 0 || LV.keyCh === ch) &&
    ((n >= LV.keyBase && n < LV.keyBase + 12) || (n >= LV.muteBase && n < LV.muteBase + 12));
  if (LV.padLayout === 'kbd' && !ravenNote && (LV.padCh === 0 || LV.padCh === ch) && lvFollowOctave(n)) {
    const i = LV.padNotes.indexOf(n);
    if (i >= 0) {
      livePadDown(i);
      return true;
    }
  }
  if (LV.perfOn && (LV.keyCh === 0 || LV.keyCh === ch)) {
    const k = n - LV.keyBase;
    if (k >= 0 && k < 12) {
      ravenKeyKey(k, true);
      return true;
    }
    const m = n - LV.muteBase;
    if (m >= 0 && m < 12) {
      ravenMuteKey(m, true);
      return true;
    }
  }
  lvPlayedHere(ch, n, true);
  return false;
}
/* Any other note from the MC-707 is you playing a track yourself (Raven mode takes it over for a while). */
function lvPlayedHere(ch, n, on) {
  if (!LV.perfOn || !ch) return;
  if (on && sentRecently(ch, n)) return;
  const t = S.tracks.findIndex(tr => tr.ch === ch);
  if (t >= 0) lvUserNote(t, on);
}
/* The MC-707's Oct buttons shift every pad by 12. Follow them so the pads keep working. */
function lvFollowOctave(n) {
  const pc = ((n % 12) + 12) % 12;
  const offs = LV_KBD_OFF.filter(o => o != null && o % 12 === pc);
  if (!offs.length) return false;
  let base = n - offs[0];
  if (offs.length > 1 && n - 12 === LV.padBase) base = LV.padBase;
  if (base === LV.padBase || base < 0 || base > 115) return false;
  LV.padBase = base;
  LV.padNotes = lvKbdNotes(base);
  saveLive();
  liveRenderPads();
  if (!$('#lvSetDet') || $('#lvSetDet').open) liveRenderSettings();
  toast('Pads follow the MC-707: octave now starts at ' + noteLbl(base));
  return true;
}
/* ---- computer keyboard: laid out like the pads (piano style) ---- */
export const LV_KEYROWS = ['qwertyui', 'asdfghjk'];
export const lvPadIndex = (row, col) => (LV.padFlip ? (1 - row) * 8 + col : row * 8 + col);
function lvKeyPad(e) {
  const k = e.key.toLowerCase();
  for (let r = 0; r < 2; r++) {
    const c = LV_KEYROWS[r].indexOf(k);
    if (c >= 0) return lvPadIndex(r, c);
  }
  return -1;
}
export function liveKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.target.tagName === 'BUTTON') e.target.blur();
    liveToggle();
    return true;
  }
  const i = lvKeyPad(e);
  if (i >= 0) {
    e.preventDefault();
    if (!e.repeat) livePadDown(i);
    return true;
  }
  return false;
}
export function liveKeyUp(e) {
  if (document.body.dataset.mode !== 'live') return;
  const i = lvKeyPad(e);
  if (i >= 0) livePadUp(i);
}
