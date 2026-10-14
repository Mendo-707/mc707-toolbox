// The MC-707 setup wizard: connect MIDI, test notes on each channel, and check the clock and audio.
//
// Owns: SU (the setup wizard).
// Reads: S, REC, MIDI, AU.
import { $, el, toast } from '../core/dom.js';
import { LANES, noteName } from '../core/theory.js';
import { TRACK_COLORS } from '../core/device.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { AU, ensureAudio } from '../services/synth.js';
import { MIDI, connectMidi, refreshOuts, sendMidi } from '../services/midi.js';
import { REC, stopAll } from '../services/transport.js';
import { renderDmap, syncControls } from './controls.js';
import { recMidi } from '../song/recording-midi.js';
import { openAudio } from '../song/audio-dialog.js';
import { liveMidi } from '../live/midi-in.js';

/* ---------- MC-707 setup wizard ---------- */
export const SU = {
  step: 1,
  scan: {},
  ck: {},
  learn: null,
  learned: {},
  drumLearned: {},
  last: null,
  lastCC: null,
  clk: [],
  clkN: 0,
  clkBpm: 0,
  tr: '',
  clockAns: '',
  clockSending: false,
  hi: -1,
  msgs: 0
};
const ROLAND_USB_URL =
  'https://support.roland.com/hc/en-us/articles/16183425095835-MC-707-How-to-set-the-USB-driver-Mode';

export function setMidiIn(id) {
  if (MIDI.inp) MIDI.inp.onmidimessage = null;
  const i = MIDI.access ? MIDI.access.inputs.get(id) : null;
  MIDI.inp = i || null;
  S.midiIn = i ? i.id : '';
  if (i) i.onmidimessage = onMidiIn;
  scheduleSave();
}
function suMon() {
  const m = $('#suMon');
  if (!m) return;
  const l = SU.last;
  m.textContent = l
    ? 'Last note in: channel ' + l.ch + ', note ' + noteName(l.note) + ' (' + l.note + '), velocity ' + l.vel
    : MIDI.inp
      ? 'Waiting for MIDI from the MC-707. Press a pad or key on it.'
      : 'No MIDI input selected.';
  const k = $('#suClk');
  if (k)
    k.textContent = SU.clkN
      ? 'Clock detected from the MC-707 (about ' +
        SU.clkBpm +
        ' BPM)' +
        (SU.tr ? '. Last transport message: ' + SU.tr + '.' : '')
      : 'No MIDI clock received from the MC-707 yet.';
}
function onMidiIn(ev) {
  if (document.body.dataset.mode === 'live' && $('#setup').hidden && liveMidi(ev)) return;
  if (REC.on && $('#setup').hidden) {
    recMidi(ev);
    return;
  }
  if ($('#setup').hidden) return;
  const d = ev.data;
  if (!d || !d.length) return;
  const st = d[0];
  if (st === 0xf8) {
    SU.clk.push(ev.timeStamp);
    if (SU.clk.length > 49) SU.clk.shift();
    SU.clkN++;
    if (SU.clk.length >= 25) {
      const a = (SU.clk[SU.clk.length - 1] - SU.clk[0]) / (SU.clk.length - 1);
      SU.clkBpm = Math.round(60000 / (a * 24));
    }
    if (SU.clkN % 12 === 1) suMon();
    return;
  }
  if (st === 0xfa || st === 0xfb || st === 0xfc) {
    SU.tr = st === 0xfc ? 'stop' : st === 0xfa ? 'start' : 'continue';
    suMon();
    return;
  }
  if (st >= 0xf0) return;
  const typ = st & 0xf0,
    ch = (st & 15) + 1;
  if (typ === 0xb0) {
    SU.lastCC = { ch, cc: d[1], val: d[2] };
    return;
  }
  if (typ !== 0x90 || !d[2]) return;
  SU.last = { ch, note: d[1], vel: d[2] };
  suMon();
  const L = SU.learn;
  if (!L) return;
  if (L.mode === 'ch') {
    pushUndo();
    S.tracks[L.idx].ch = ch;
    SU.learned[L.idx] = ch;
    SU.scan[ch] = L.idx + 1;
    SU.learn = L.all && L.idx < 7 ? { mode: 'ch', idx: L.idx + 1, all: true } : null;
  } else {
    S.drumMap[L.idx] = d[1];
    SU.drumLearned[L.idx] = true;
    SU.learn = L.all && L.idx < LANES.length - 1 ? { mode: 'drum', idx: L.idx + 1, all: true } : null;
    renderDmap();
  }
  scheduleSave();
  renderSetup(true);
}
export function testNote(ti) {
  if (!MIDI.out) {
    toast('No MIDI output selected. Press Auto-connect first.');
    return false;
  }
  ensureAudio();
  const t = S.tracks[ti];
  const ch = t.ch - 1,
    now = AU.ctx.currentTime + 0.02;
  const pitch = t.type === 'drum' ? S.drumMap[0] : 60;
  sendMidi([0x90 | ch, pitch, 110], now);
  sendMidi([0x80 | ch, pitch, 0], now + 0.5);
  return true;
}

function sendClockTest() {
  if (!MIDI.out) {
    toast('No MIDI output selected. Press Auto-connect first.');
    return;
  }
  stopAll();
  ensureAudio();
  const t0 = AU.ctx.currentTime + 0.1,
    beat = 60 / S.bpm,
    n = 24 * 8;
  sendMidi([0xfa], t0);
  for (let i = 0; i < n; i++) sendMidi([0xf8], t0 + (i * beat) / 24);
  sendMidi([0xfc], t0 + (n * beat) / 24 + 0.02);
  SU.clockSending = true;
  SU.clockAns = '';
  renderSetup(true);
  setTimeout(
    () => {
      SU.clockSending = false;
      renderSetup(true);
    },
    (8 * beat + 0.4) * 1000
  );
}
export function openSetup() {
  $('#midiPop').hidden = true;
  $('#setup').hidden = false;
  renderSetup();
  suMon();
}
export function closeSetup() {
  $('#setup').hidden = true;
  SU.learn = null;
}
const ckLine = (state, title, detail) =>
  el(
    'div',
    { class: 'ck ' + state },
    el('span', { class: 'ico' }, state === 'ok' ? '✔' : state === 'bad' ? '✖' : '•'),
    el('span', {}, el('b', {}, title), detail ? el('small', {}, detail) : null)
  );
export async function suAutoConnect() {
  await connectMidi();
  if (MIDI.access) {
    MIDI.access.onstatechange = () => {
      refreshOuts();
      if (!$('#setup').hidden) renderSetup(true);
    };
    const outs = [...MIDI.access.outputs.values()],
      ins = [...MIDI.access.inputs.values()];
    const mo = outs.find(o => /MC-?707/i.test(o.name));
    if (mo && (!MIDI.out || !/MC-?707/i.test(MIDI.out.name))) {
      S.midiOut = mo.id;
      refreshOuts();
    }
    const mi = ins.find(i => /MC-?707/i.test(i.name)) || ins.find(i => i.id === S.midiIn);
    if (mi) setMidiIn(mi.id);
    if (mo && !S.clock) {
      S.clock = true;
      syncControls();
      scheduleSave();
    }
  }
  renderSetup(true);
}
function renderSetup(keep) {
  const sc = $('#setupBody').scrollTop;
  const head = $('#setupHead');
  head.textContent = '';
  head.append(
    el('h2', { id: 'setupTitle' }, 'Quick setup'),
    el('div', { class: 'steps' }),
    el('button', { class: 'btn sm', onclick: closeSetup }, 'Close')
  );
  const b = $('#setupBody');
  b.textContent = '';
  const sup = !!navigator.requestMIDIAccess;
  const outs = MIDI.access ? [...MIDI.access.outputs.values()] : [],
    ins = MIDI.access ? [...MIDI.access.inputs.values()] : [];
  const mcOut = outs.find(o => /MC-?707/i.test(o.name));
  b.append(
    el('p', { class: 'wlead' }, 'Plug in the MC-707 over USB, then press one button. Everything below is optional.')
  );
  /* 1 connect */
  const c1 = el('div', { class: 'wcard' }, el('h3', {}, '1. Connect'));
  if (!sup)
    c1.append(ckLine('bad', 'This browser has no Web MIDI', 'Use Chrome or Edge on a computer, or the Windows app.'));
  c1.append(
    el(
      'div',
      { class: 'row' },
      el(
        'button',
        { class: 'btn on', onclick: suAutoConnect },
        MIDI.access ? 'Rescan and auto-connect' : 'Auto-connect MC-707'
      )
    )
  );
  if (MIDI.access) {
    c1.append(
      ckLine(
        MIDI.out ? 'ok' : 'bad',
        'Output: ' + (MIDI.out ? MIDI.out.name : 'none'),
        MIDI.out ? '' : outs.length ? 'Pick your MC-707 below.' : 'No MIDI outputs found. Open “Not showing up?” below.'
      ),
      ckLine(
        MIDI.inp ? 'ok' : 'pend',
        'Input: ' + (MIDI.inp ? MIDI.inp.name : 'none'),
        MIDI.inp ? '' : 'Optional. Lets you learn channels and record from the MC-707.'
      )
    );
    if (!mcOut || outs.length > 1 || ins.length > 1) {
      const os = el('select', {
        'aria-label': 'MIDI output',
        onchange: e => {
          S.midiOut = e.target.value;
          refreshOuts();
          renderSetup(true);
        }
      });
      os.append(el('option', { value: '' }, 'No output'));
      outs.forEach(o => os.append(el('option', { value: o.id, selected: MIDI.out && MIDI.out.id === o.id }, o.name)));
      const is = el('select', {
        'aria-label': 'MIDI input',
        onchange: e => {
          setMidiIn(e.target.value);
          renderSetup(true);
        }
      });
      is.append(el('option', { value: '' }, 'No input'));
      ins.forEach(i => is.append(el('option', { value: i.id, selected: MIDI.inp && MIDI.inp.id === i.id }, i.name)));
      c1.append(
        el(
          'div',
          { class: 'wcols', style: 'margin:8px 0 0' },
          el('label', { class: 'cprow', style: 'flex-direction:column;align-items:stretch' }, 'Send notes to', os),
          el('label', { class: 'cprow', style: 'flex-direction:column;align-items:stretch' }, 'Listen to', is)
        )
      );
    }
  }
  b.append(c1);
  /* 2 test */
  const c2 = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, '2. Test the tracks'));
  c2.append(
    el(
      'div',
      { class: 'row' },
      el(
        'button',
        {
          class: 'btn on',
          disabled: !MIDI.out,
          onclick: () => {
            S.tracks.forEach((t, i) =>
              setTimeout(() => {
                SU.hi = i;
                renderSetup(true);
                testNote(i);
              }, i * 1100)
            );
            setTimeout(() => {
              SU.hi = -1;
              renderSetup(true);
            }, 8 * 1100);
          }
        },
        'Play tracks 1 → 8'
      ),
      el(
        'button',
        {
          class: 'btn',
          disabled: !MIDI.inp,
          title: MIDI.inp ? 'Press a pad on each MC-707 track in turn' : 'Needs a MIDI input',
          onclick: () => {
            SU.learn = { mode: 'ch', idx: 0, all: true };
            renderSetup(true);
          }
        },
        SU.learn && SU.learn.mode === 'ch'
          ? 'Waiting: play a pad on MC-707 track ' + (SU.learn.idx + 1) + '…'
          : 'Learn channels from the MC-707'
      ),
      el('span', { class: 'hint' }, 'Each MC-707 track should sound in turn. If one is wrong, change its channel here.')
    )
  );
  const tbl = el('div', { class: 'sut' });
  S.tracks.forEach((t, i) => {
    const chs = el('select', {
      'aria-label': 'Channel for track ' + (i + 1),
      onchange: e => {
        pushUndo();
        t.ch = +e.target.value;
        scheduleSave();
        renderSetup(true);
      }
    });
    for (let c = 1; c <= 16; c++) chs.append(el('option', { value: c, selected: t.ch === c }, 'Ch ' + c));
    tbl.append(
      el(
        'div',
        { class: 'sur' + (SU.hi === i ? ' hi' : ''), style: '--c:' + TRACK_COLORS[i] },
        el('span', { class: 'tn' }, i + 1 + '. ' + t.name + (t.type === 'drum' ? ' (drums)' : '')),
        chs,
        el(
          'button',
          {
            class: 'btn sm',
            disabled: !MIDI.out,
            onclick: () => {
              SU.hi = i;
              testNote(i);
              renderSetup(true);
            }
          },
          'Send test'
        )
      )
    );
  });
  c2.append(tbl, el('div', { id: 'suMon', class: 'mon', style: 'margin-top:6px' }, ''));
  b.append(c2);
  /* 3 clock */
  const c3 = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, '3. Tempo sync'));
  c3.append(
    el(
      'label',
      { class: 'lay', style: '--c:var(--hot)' },
      el('input', {
        type: 'checkbox',
        checked: S.clock,
        onchange: e => {
          S.clock = e.target.checked;
          syncControls();
          scheduleSave();
        }
      }),
      el(
        'span',
        {},
        el('b', {}, 'Make the MC-707 follow this app'),
        el('small', {}, 'Sends MIDI clock and start/stop when you press Play. On the MC-707 set sync to AUTO or USB.')
      )
    )
  );
  c3.append(
    el(
      'div',
      { class: 'row' },
      el(
        'button',
        { class: 'btn', disabled: SU.clockSending || !MIDI.out, onclick: sendClockTest },
        SU.clockSending ? 'Sending… watch the MC-707' : 'Test: send start + clock'
      ),
      el('span', { id: 'suClk', class: 'hint' }, '')
    )
  );
  b.append(c3);
  /* 4 audio */
  const c4 = el(
    'div',
    { class: 'wcard', style: 'margin-top:12px' },
    el('h3', {}, '4. Audio recording (optional)'),
    el(
      'p',
      { class: 'hint' },
      'Record the mix and all 8 MC-707 tracks over USB, or the mix from your audio interface.'
    ),
    el(
      'div',
      { class: 'row' },
      el(
        'button',
        {
          class: 'btn',
          onclick: () => {
            closeSetup();
            openAudio();
          }
        },
        'Set up audio inputs…'
      )
    )
  );
  b.append(c4);
  const chk = el(
    'details',
    { class: 'wcard', style: 'margin-top:12px' },
    el('summary', {}, 'Settings to check on the MC-707')
  );
  chk.append(
    el(
      'ul',
      {},
      el(
        'li',
        {},
        'USB driver: press SHIFT + KNOB ASSIGN, choose SET, then USB DRIVER. Use VENDOR (needs Roland’s driver) or GENERIC. ',
        el('a', { href: ROLAND_USB_URL, target: '_blank', rel: 'noopener' }, 'Roland’s instructions')
      ),
      el('li', {}, 'Tracks 1–3 hold drum kits and tracks 4–8 hold tone sounds, unmuted with their levels up.'),
      el('li', {}, 'Each track receives on its own channel (default: track 1 = channel 1 … track 8 = channel 8).'),
      el('li', {}, 'Scene and clip changes are optional: the MC-707 must receive control and program change over USB.')
    )
  );
  b.append(chk);
  const help = el('details', { class: 'wcard', style: 'margin-top:12px' }, el('summary', {}, 'Not showing up?'));
  help.append(
    el(
      'ul',
      {},
      el('li', {}, 'Use a data USB cable in the COMPUTER port, then power on the MC-707.'),
      el('li', {}, 'Try the other USB driver mode (VENDOR or GENERIC) and restart the MC-707.'),
      el('li', {}, 'Close other programs holding the MIDI port (a DAW, other tabs), then press Rescan.'),
      el('li', {}, 'If this page is embedded, open it in its own tab and allow MIDI when asked.')
    )
  );
  b.append(help);
  b.scrollTop = keep ? sc : 0;
  const f = $('#setupFoot');
  f.textContent = '';
  f.append(el('div', { class: 'sp' }), el('button', { class: 'btn on', onclick: closeSetup }, 'Done'));
  suMon();
}
