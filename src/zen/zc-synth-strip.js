// One Synth mode strip: a track's sound (name, which clip or the track's own sound, the Sound browser and
// the ZenCore editor), a note to try it, an activity light for notes passed through, mute, solo, and
// level, pan and reverb send. Clicking the strip's name sends the keyboard there (when one track plays
// everything).
//
// Reads: SY, S, DEV.
import { el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { MIDI } from '../services/midi.js';
import { showMenu } from '../ui/menu.js';
import { soundAdd, soundsLoad } from './zc-sounds.js';
import { quickForget, quickPanel } from './zc-synth-quick.js';
import {
  SY,
  chOf,
  heardLevel,
  kbdSet,
  kindOf,
  readTrackSound,
  resetMix,
  sendTrackSound,
  tracks,
  setLevel,
  setMute,
  setPan,
  setSlot,
  setSolo
} from './zc-synth-io.js';

const slotName = k => (k === 16 ? 'Track sound' : 'Clip ' + (k + 1));

/* hold to play a note on the track */
function playBtn(t) {
  const n = kindOf(t) === 'kit' ? 36 : S.tracks[t].role === 'bass' || /bass|\bbs\b|sub/i.test(SY.names[t]) ? 36 : 60;
  return el(
    'button',
    {
      type: 'button',
      class: 'btn sm syPlay',
      title: 'Hold to play a note',
      onpointerdown: e => {
        e.preventDefault();
        if (!MIDI.out) return toast('No MIDI output');
        MIDI.out.send([0x90 | chOf(t), n, 100]);
        flash(t);
        const up = () => {
          if (MIDI.out) MIDI.out.send([0x80 | chOf(t), n, 0]);
          for (const ev of ['pointerup', 'pointercancel', 'blur']) removeEventListener(ev, up);
        };
        for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, up);
      }
    },
    '▶'
  );
}
/** Light a strip's activity dot for a moment. */
export function flash(t) {
  const d = document.querySelector('#syAct' + t);
  if (!d) return;
  d.classList.add('on');
  clearTimeout(d._t);
  d._t = setTimeout(() => d.classList.remove('on'), 120);
}

const panText = v => (v === 64 ? 'C' : v < 64 ? 'L' + (64 - v) : 'R' + (v - 64));
/* a slider whose filled part shows the value (from the left, or from the centre for pan) */
function fader(label, v, set, title, t, centre) {
  const out = el('b', {}, centre ? panText(v) : String(v));
  const paint = (inp, x) => {
    const p = (x / 127) * 100;
    inp.style.setProperty('--lo', (centre ? Math.min(p, 50) : 0) + '%');
    inp.style.setProperty('--hi', (centre ? Math.max(p, 50) : p) + '%');
  };
  const inp = el('input', {
    type: 'range',
    min: 0,
    max: 127,
    value: v,
    class: 'syFader' + (centre ? ' centre' : ''),
    'aria-label': label + ', track ' + devNum(t),
    oninput: e => {
      const x = +e.target.value;
      set(x);
      paint(e.target, x);
      out.textContent = centre ? panText(x) : String(x);
    },
    /* double-click back to the middle (pan) or the default level */
    ondblclick: e => {
      const x = centre ? 64 : label === 'Level' ? 100 : 0;
      e.target.value = x;
      e.target.dispatchEvent(new Event('input'));
    }
  });
  paint(inp, v);
  return el('label', { class: 'syRange', title: title + ' · double-click to reset' }, el('span', {}, label), inp, out);
}

/* the strip's right-click menu */
function stripMenu(t, act, x, y) {
  const others = tracks().filter(u => u !== t && kindOf(u) === kindOf(t));
  const withSound = async (why, fn) => {
    toast(why);
    const snd = await readTrackSound(t);
    if (!snd) return toast('The ' + DEVS[DEV].name + ' did not answer');
    await fn(snd);
  };
  showMenu(x, y, [
    { label: 'Browse sounds…', action: () => act.open(t, true) },
    { label: 'Edit in the ZenCore editor…', action: () => act.open(t, false) },
    '-',
    { label: 'Mute', checked: SY.mute[t], action: () => (setMute(t, !SY.mute[t]), act.render()) },
    { label: 'Solo', checked: SY.solo[t], action: () => (setSolo(t, !SY.solo[t]), act.render()) },
    { label: 'Reset level and pan', action: () => (resetMix(t), act.render()) },
    { label: 'Play it from the keyboard (Notes in)', checked: SY.kbd === t, action: () => (kbdSet(t), act.render()) },
    '-',
    {
      label: 'Save this sound to the Sound library',
      action: () =>
        withSound('Reading the sound…', async snd => {
          await soundsLoad();
          const e = await soundAdd(snd, { src: 'mine', mine: true });
          toast(e ? 'Saved ' + e.name + ' to My sounds' : 'It is already in My sounds');
        })
    },
    others.length
      ? {
          label: 'Copy this sound to',
          sub: others.map(u => ({
            label: 'Track ' + devNum(u) + (SY.names[u] ? ' (' + SY.names[u] + ')' : ''),
            action: () =>
              withSound('Copying…', async snd => {
                quickForget(u);
                if (await sendTrackSound(u, snd)) toast('Copied to track ' + devNum(u));
                act.render();
              })
          }))
        }
      : null,
    { label: 'Read its name again', action: () => act.refresh() }
  ]);
}

/**
 * A strip. act: {open(t, browse), refresh(), render()} from the screen.
 */
export function strip(t, act) {
  const dn = DEVS[DEV].name,
    target = SY.kbd === t,
    quiet = heardLevel(t) === 0;
  const slot = el(
    'select',
    {
      class: 'sySlot',
      'aria-label': 'Which sound track ' + devNum(t) + ' plays',
      title:
        'The sound the DAW plays on this track: one of its clips (selected on the ' + dn + ') or the track’s own sound',
      onchange: async e => {
        const k = +e.target.value;
        quickForget(t);
        if (await setSlot(t, k)) toast('Track ' + devNum(t) + ' plays ' + slotName(k).toLowerCase());
        act.refresh();
      }
    },
    ...[...Array.from({ length: 16 }, (_, k) => k), 16].map(k =>
      el('option', { value: k, selected: SY.slot[t] === k }, slotName(k))
    )
  );
  const toggle = (lab, cls, on, fn, title) =>
    el(
      'button',
      {
        type: 'button',
        class: 'syTg ' + cls + (on ? ' on' : ''),
        'aria-pressed': String(on),
        title,
        onclick: () => (fn(!on), act.render())
      },
      lab
    );
  return el(
    'section',
    {
      class: 'syStrip' + (quiet ? ' quiet' : '') + (target ? ' target' : '') + (SY.solo[t] ? ' solo' : ''),
      style: '--tc:' + (TRACK_COLORS[t] || '#39ff7a'),
      'aria-label': 'Track ' + devNum(t),
      title: 'Right-click for more: copy the sound to another track, save it to the library, reset the mix',
      oncontextmenu: e => {
        if (e.target.matches('input, select')) return;
        e.preventDefault();
        stripMenu(t, act, e.clientX, e.clientY);
      }
    },
    el(
      'div',
      { class: 'syHead' },
      el('span', { class: 'syNum' }, String(devNum(t))),
      el('span', { class: 'syType' }, (kindOf(t) === 'kit' ? 'Drum kit' : 'Tone') + ', channel ' + (chOf(t) + 1)),
      el('i', { class: 'syAct', id: 'syAct' + t, title: 'Lights when notes arrive' }),
      toggle('M', 'mute', SY.mute[t], v => setMute(t, v), 'Mute'),
      toggle('S', 'solo', SY.solo[t], v => setSolo(t, v), 'Solo: hear only the soloed tracks')
    ),
    el(
      'div',
      { class: 'syLcd' },
      el(
        'button',
        {
          type: 'button',
          class: 'syName' + (SY.names[t] ? '' : ' none'),
          title: SY.kbd === 'own' ? SY.names[t] || 'No sound read yet' : 'Play this track from the keyboard',
          onclick: () => {
            if (SY.kbd !== 'own') (kbdSet(t), act.render());
          }
        },
        SY.names[t] || 'No sound read'
      ),
      el(
        'div',
        { class: 'syLcdRow' },
        slot,
        target ? el('span', { class: 'syKbd', title: 'Notes in play this track' }, '⌨ keyboard') : null
      )
    ),
    el(
      'div',
      { class: 'syBtns' },
      /* tones only: a kit's drum sounds can't be changed over MIDI */
      S.tracks[t].type === 'drum'
        ? null
        : el(
            'button',
            {
              type: 'button',
              class: 'btn sm syBrowse',
              onclick: () => act.open(t, true),
              title: 'Pick a sound from the Sound browser'
            },
            'Browse'
          ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm',
          onclick: () => act.open(t, false),
          title: 'Edit every parameter in the ZenCore editor'
        },
        'Edit'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm syExpBtn' + (act.exp && act.exp() === t ? ' on' : ''),
          onclick: () => act.expand(t),
          title:
            act.exp && act.exp() === t
              ? 'Back to all eight strips'
              : 'Expand this track: the others shrink to the side and its ZenCore editor fills the screen'
        },
        act.exp && act.exp() === t ? '⤡ Collapse' : '⤢ Expand'
      ),
      playBtn(t)
    ),
    quickPanel(t),
    el(
      'div',
      { class: 'syMix' },
      fader('Level', SY.level[t], v => setLevel(t, v), 'Track level (MIDI volume, CC 7)', t),
      /* no reverb send here: the MC-707's main effects only reach its MIX output, not a track's own */
      fader('Pan', SY.pan[t], v => setPan(t, v), 'Pan (CC 10)', t, true)
    )
  );
}
