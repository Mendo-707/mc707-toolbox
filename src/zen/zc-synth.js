// Synth mode: the MC-707 as an 8-track hardware synth for a DAW. The DAW plays each track on its MIDI
// channel and records each track's audio over USB (the MC-707 sends the eight tracks separately), while
// this screen picks, edits and mixes the eight sounds: the Sound browser and ZenCore editor for each
// track, which sound it plays (a clip or the track's own), level and pan, a setup file with all eight
// sounds, and notes passed through from a DAW's virtual port or a keyboard. The app's own sequencer
// stays quiet here.
//
// Reads: SY, DEV.
import { $, el, toast } from '../core/dom.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { hooks } from '../core/hooks.js';
import { MIDI, connectMidi } from '../services/midi.js';
import { showMenu } from '../ui/menu.js';
import { askDlg } from '../ui/dialogs.js';
import { zenOpen } from './zc-editor.js';
import { ZX } from './zc-sysex.js';
import { browserOpen } from './zc-browser.js';
import { flash, strip } from './zc-synth-strip.js';
import { QS, quickForget } from './zc-synth-quick.js';
import {
  SY,
  SYHOOK,
  kbdSet,
  panic,
  readNames,
  setupForget,
  setupKeep,
  setupRead,
  setupSend,
  setupsList,
  thruInputs,
  thruSet,
  tracks
} from './zc-synth-io.js';

let busy = '';
const dn = () => DEVS[DEV].name;

/** Enter or leave Synth mode (called by the mode switch). */
export function synthEnter(on) {
  thruSet(SY.thru, on);
  SYHOOK.activity = on ? flash : null;
  if (on) {
    synthRender();
    /* the inputs to pass notes from need MIDI access: ask once, then draw the list and start passing */
    if (!MIDI.access)
      connectMidi().then(() => {
        if (document.body.dataset.mode !== 'synth') return;
        thruSet(SY.thru, true);
        synthRender();
      });
    if (!SY.names.some(Boolean)) refresh(true);
  }
}
async function refresh(quiet) {
  busy = 'Reading the sounds…';
  synthRender();
  const ok = await readNames();
  busy = '';
  synthRender();
  if (!ok && !quiet) toast('The ' + dn() + ' did not answer. Connect it by USB and allow MIDI with SysEx.');
}
/* opening the editor (or the browser over it); the strip's name is read again when it closes */
function openEditor(t, browse) {
  zenOpen(t, SY.slot[t]);
  if (browse) setTimeout(browserOpen, 0);
  const wait = setInterval(() => {
    if ($('#zcOv')) return;
    clearInterval(wait);
    quickForget(t);
    refresh(true);
  }, 400);
}
/* read every sound (the progress shows on the screen) */
async function readSetup() {
  busy = 'Reading all ' + tracks().length + ' sounds…';
  synthRender();
  const o = await setupRead((t, f) => {
    busy = 'Reading track ' + devNum(t) + '… ' + Math.round(f * 100) + '%';
    const s = $('#syBusy');
    if (s) s.textContent = busy;
  });
  busy = '';
  synthRender();
  if (!o) toast('The ' + dn() + ' did not answer, so the sounds could not be read');
  return o;
}
async function saveSetup() {
  const o = await readSetup();
  if (o) hooks.saveFile('mc707-synth-setup.json', JSON.stringify(o));
}
async function keepSetup() {
  const name = await askDlg({
    title: 'Keep this setup in the browser',
    input: true,
    def: 'Setup ' + (setupsList().length + 1),
    ok: 'Keep'
  });
  if (!name || !name.trim()) return;
  const o = await readSetup();
  if (o) toast(setupKeep(name.trim(), o) ? 'Kept ' + name.trim() : 'The browser would not store it (storage full?)');
}
async function sendSetup(o) {
  busy = 'Sending the setup…';
  synthRender();
  try {
    for (const k in QS) delete QS[k];
    const n = await setupSend(o, t => {
      const s = $('#syBusy');
      if (s) s.textContent = 'Sent track ' + devNum(t);
    });
    toast(n ? 'Sent ' + n + ' sounds to the ' + dn() : 'Nothing in that setup fits these tracks');
  } catch (e) {
    toast('That is not a Synth mode setup');
  }
  busy = '';
  synthRender();
}
function setupsMenu(e) {
  const r = e.currentTarget.getBoundingClientRect(),
    kept = setupsList();
  showMenu(r.left, r.bottom + 4, [
    { label: 'Save to a file…', action: saveSetup },
    { label: 'Open a file…', action: openSetup },
    { label: 'Keep in this browser…', action: keepSetup },
    kept.length ? '-' : null,
    ...kept.map(k => ({
      label: k.name,
      sub: [
        { label: 'Send to the ' + dn(), action: () => sendSetup(k.setup) },
        { label: 'Forget', action: () => (setupForget(k.name), toast('Forgot ' + k.name)) }
      ]
    }))
  ]);
}
function openSetup() {
  const i = el('input', {
    type: 'file',
    accept: '.json,application/json',
    onchange: async () => {
      let o = null;
      try {
        o = JSON.parse(await i.files[0].text());
      } catch (e) {
        return toast('That is not a Synth mode setup file from this app');
      }
      sendSetup(o);
    }
  });
  i.click();
}

/** The Synth menu's actions: read, save, open, keep, panic, help. */
export function synthAct(what) {
  if (what === 'read') refresh(false);
  else if (what === 'save') saveSetup();
  else if (what === 'open') openSetup();
  else if (what === 'keep') keepSetup();
  else if (what === 'panic') (panic(), toast('All notes off'));
  else if (what === 'help') {
    const d = $('#synth .syHelp');
    if (d) {
      d.open = true;
      d.scrollIntoView({ block: 'nearest' });
    }
  }
}
/* what the strips call back */
const ACT = { open: (t, b) => openEditor(t, b), refresh: () => refresh(true), render: () => synthRender() };

/** Draw the Synth mode screen. */
export function synthRender() {
  const box = $('#synth');
  if (!box) return;
  box.textContent = '';
  const thru = el(
    'select',
    {
      'aria-label': 'Pass notes through from',
      title:
        'Notes from this input go to the ' +
        dn() +
        ': a keyboard, or the DAW through a virtual MIDI port (loopMIDI on Windows) when the DAW cannot share the ' +
        dn() +
        '’s port',
      onchange: e => thruSet(e.target.value, true)
    },
    el('option', { value: '' }, 'Off'),
    ...thruInputs().map(p => el('option', { value: p.id, selected: SY.thru === p.id }, p.name))
  );
  const kbd = el(
    'select',
    {
      'aria-label': 'Where passed-through notes go',
      title:
        'Each on its own channel (a DAW), or all to one track (a keyboard). Click a strip’s sound name to move it there.',
      onchange: e => (kbdSet(e.target.value === 'own' ? 'own' : +e.target.value), synthRender())
    },
    el('option', { value: 'own', selected: SY.kbd === 'own' }, 'Each track’s channel'),
    ...tracks().map(t => el('option', { value: t, selected: SY.kbd === t }, 'Track ' + devNum(t)))
  );
  const on = ZX.state === 'ready';
  const steps = [
    [
      'Audio',
      'On the ' +
        dn() +
        ', set USB audio to send the tracks separately (see its manual), and install Roland’s driver on Windows. Your DAW then sees one input per track.'
    ],
    [
      'Tracks',
      'Make one MIDI track per ' +
        dn() +
        ' track in the DAW, sending on the channel shown on its strip, and one audio track recording each input.'
    ],
    [
      'MIDI port',
      'Windows lets one program use the ' +
        dn() +
        '’s MIDI port at a time. Let the DAW send to a virtual port (loopMIDI) and pick it under Notes in, or use Windows 11’s MIDI Services to share the port. Macs share it anyway.'
    ],
    [
      'Saving',
      'Setups › Save to a file keeps all eight sounds and the mix next to your DAW project. Saving the project on the ' +
        dn() +
        ' keeps them too.'
    ]
  ];
  box.append(
    el(
      'header',
      { class: 'syTop' },
      el(
        'div',
        { class: 'syTitle' },
        el('h2', {}, 'Synth Mode'),
        el(
          'p',
          {},
          'Your DAW plays the ' +
            dn() +
            '’s ' +
            tracks().length +
            ' tracks and records each one’s audio over USB. Pick, edit and mix the sounds here.'
        )
      ),
      el(
        'div',
        {
          class: 'syLink' + (on ? ' on' : ''),
          title: on
            ? 'Reading and writing sounds over SysEx'
            : 'Connect the ' + dn() + ' by USB and allow MIDI with SysEx'
        },
        el('i'),
        on ? dn() + ' connected' : dn() + ' not connected'
      )
    ),
    el(
      'div',
      { class: 'syBar' },
      el(
        'div',
        { class: 'syActs' },
        el(
          'button',
          { type: 'button', class: 'btn', onclick: () => refresh(false), title: 'Read every track’s sound name again' },
          'Read sounds'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: setupsMenu,
            title: 'Save, open or keep all eight sounds with the mix'
          },
          'Setups ▾'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'btn syPanic',
            onclick: () => (panic(), toast('All notes off')),
            title: 'Stop every note on every track'
          },
          'Panic'
        )
      ),
      el(
        'div',
        { class: 'syIn', title: 'Notes from another input played on the ' + dn() },
        el('span', {}, 'Notes in'),
        thru,
        el('span', { class: 'syArrow', 'aria-hidden': 'true' }, '→'),
        kbd
      ),
      el('span', { id: 'syBusy', class: 'syBusy' }, busy)
    ),
    el('div', { class: 'syGrid' }, ...tracks().map(t => strip(t, ACT))),
    el(
      'details',
      { class: 'syHelp' },
      el('summary', {}, 'Setting up your DAW'),
      el('ol', {}, ...steps.map(([h, t]) => el('li', {}, el('b', {}, h), el('span', {}, t))))
    )
  );
}
