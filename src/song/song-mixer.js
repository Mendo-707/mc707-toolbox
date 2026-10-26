// Song Mode's mixer: a strip per MC-707 track with level, pan, reverb and chorus (MIDI CC 7, 10, 91
// and 92, sent to the MC-707 as you move them and again whenever the song starts), the track's FILTER,
// MOD, FX and SOUND knobs (CC 80-83: sent once you move them, then at every start), the track's note
// velocity, and mute and solo. It is the song's own mix: saved with the song (the track MIDI controls),
// with undo. It opens in a window of its own that can sit on another screen (services/popout.js).
//
// Reads: S, DEV, MIDI.
import { el } from '../core/dom.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { MIDI, midiAct } from '../services/midi.js';
import { sendCC } from '../services/mc-controls.js';
import { popTheme, popout, popoutOf, themeSig } from '../services/popout.js';
import { mixLight, mixStrip } from '../services/mixer-strip.js';
import { knobAssignFor, knobsReadOnce, masterFor, trackFxFor } from '../services/mixer-fx.js';
import { showMenu } from '../ui/menu.js';
import { renderArr } from './arrangement.js';

const CC = { lvl: 7, pan: 10, rev: 91, cho: 92, flt: 80, mod: 81, fx: 82, snd: 83 };
const DEF = { lvl: 100, pan: 64, rev: 0, cho: 0, flt: 64, mod: 0, fx: 64, snd: 64 };
/* the knobs: only sent once they have been set, since the MC-707's own position is not known */
const KNOBS = ['flt', 'mod', 'fx', 'snd'];
const isSet = (t, key) => !!S.tracks[t].cc && S.tracks[t].cc[CC[key]] != null;
const ID = 'song-mixer';
let held = false;

const valOf = (t, key) => {
  const c = S.tracks[t].cc;
  return c && c[CC[key]] != null ? c[CC[key]] : DEF[key];
};
const live = () => MIDI.out && S.sendCC !== false;
function set(t, key, v) {
  const tr = S.tracks[t];
  tr.cc = tr.cc || {};
  tr.cc[CC[key]] = v;
  if (live()) sendCC(t, CC[key], v);
}
/* a change to the whole track (mute, solo, a reset): one undo step, the song redrawn */
function change(fn) {
  pushUndo();
  fn();
  renderArr();
  scheduleSave();
  refresh();
}
function resetTrack(t) {
  const tr = S.tracks[t];
  if (tr.cc) for (const k in CC) delete tr.cc[CC[k]];
  if (tr.cc && !Object.keys(tr.cc).length) delete tr.cc;
  tr.vol = 100;
  if (live()) for (const k in CC) if (!KNOBS.includes(k)) sendCC(t, CC[k], DEF[k]);
}
/** Send the whole mix to the MC-707 now. */
export function songMixSend() {
  if (!live()) return;
  for (const t of DEVS[DEV].tracks)
    for (const k in CC) if (!KNOBS.includes(k) || isSet(t, k)) sendCC(t, CC[k], valOf(t, k));
}

function stripFor(t) {
  const tr = S.tracks[t];
  const vel = el('input', {
    type: 'range',
    min: 0,
    max: 127,
    value: tr.vol,
    class: 'mxKnob',
    'aria-label': 'Velocity, ' + tr.name,
    onpointerdown: () => grab(),
    oninput: e => {
      const x = (S.tracks[t].vol = +e.target.value);
      e.target.nextSibling.textContent = String(x);
      e.target.style.setProperty('--hi', (x / 127) * 100 + '%');
    },
    onchange: () => done(),
    onpointerup: () => done(),
    ondblclick: e => {
      e.target.value = 100;
      e.target.dispatchEvent(new Event('input'));
      e.target.dispatchEvent(new Event('change'));
    }
  });
  vel.style.setProperty('--lo', '0%');
  vel.style.setProperty('--hi', (tr.vol / 127) * 100 + '%');
  const [fx, onFx] = trackFxFor(t, refresh);
  return mixStrip(
    {
      fx,
      num: devNum(t),
      name: tr.name,
      color: TRACK_COLORS[t],
      sub: (tr.type === 'drum' ? 'Kit' : 'Tone') + ' · ch ' + tr.ch,
      lvl: valOf(t, 'lvl'),
      pan: valOf(t, 'pan'),
      rev: valOf(t, 'rev'),
      cho: valOf(t, 'cho'),
      mute: tr.mute,
      solo: tr.solo,
      knobs: KNOBS.map((key, n) => ({
        key,
        assign: knobAssignFor(t, n, refresh),
        v: valOf(t, key),
        def: DEF[key],
        unset: !isSet(t, key)
      })),
      extra: [
        el(
          'label',
          { class: 'mxRow', title: 'Note velocity, played by the app (100 = as written) · double-click for 100' },
          el('span', {}, 'Velocity'),
          vel,
          el('b', {}, String(tr.vol))
        )
      ]
    },
    {
      fx: onFx,
      grab,
      done,
      set: (key, v) => set(t, key, v),
      /* the track looked up when clicked: undo or a loaded song replaces the track objects */
      mute: () => change(() => (S.tracks[t].mute = !S.tracks[t].mute)),
      solo: () => change(() => (S.tracks[t].solo = !S.tracks[t].solo)),
      menu: e =>
        showMenu(e.clientX, e.clientY, [
          { label: 'Solo only this track', action: () => change(() => S.tracks.forEach((x, i) => (x.solo = i === t))) },
          { label: 'Reset this track’s mix', action: () => change(() => resetTrack(t)) }
        ])
    }
  );
}
function grab() {
  if (!held) pushUndo();
  held = true;
}
function done() {
  held = false;
  scheduleSave();
}

/* what the strips show, to redraw when it changes elsewhere (the song, undo, another song loaded) */
const sig = () =>
  JSON.stringify(
    DEVS[DEV].tracks.map(t => {
      const x = S.tracks[t];
      return [x.name, x.type, x.ch, x.mute, x.solo, x.vol, x.cc];
    })
  );
let strips = [],
  last = '',
  look = '',
  gen = 0,
  lastSig = 0;
/* Song Mode's look: the app's own colours, light or dark as the app is */
const lookSrc = () => document.documentElement;
function build(root, h) {
  last = sig();
  look = popTheme(h, lookSrc(), 'popSong');
  const my = ++gen;
  strips = DEVS[DEV].tracks.map(t => [t, stripFor(t)]);
  root.append(
    el(
      'div',
      { class: 'mxWrap' },
      el(
        'div',
        { class: 'mxTop' },
        el('b', { class: 'mxTitle' }, 'Song mixer'),
        el('span', { class: 'hint' }, 'Saved with the song and sent to the MC-707 when it starts.'),
        el(
          'div',
          { class: 'mxActs' },
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              title: 'Send every level, pan, send and set knob to the MC-707 now',
              onclick: songMixSend
            },
            'Send to MC-707'
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              onclick: () => change(() => S.tracks.forEach(x => ((x.mute = false), (x.solo = false))))
            },
            'Clear mutes and solos'
          ),
          el(
            'button',
            { type: 'button', class: 'btn sm', onclick: () => change(() => DEVS[DEV].tracks.forEach(resetTrack)) },
            'Reset all'
          )
        ),
        h.winBtns()
      ),
      el('div', { class: 'mxStrips' }, ...strips.map(x => x[1]), masterFor(refresh))
    )
  );
  const tick = now => {
    if (!h.open || my !== gen) return;
    for (const [t, node] of strips) mixLight(node, midiAct(S.tracks[t].ch - 1));
    /* the rest is checked a few times a second */
    if (!held && now - lastSig > 150) {
      lastSig = now;
      if (sig() !== last || themeSig(lookSrc()) !== look) return refresh();
    }
    h.raf(tick);
  };
  h.raf(tick);
  /* what each knob controls, read once from the MC-707 when it is connected */
  knobsReadOnce(DEVS[DEV].tracks, refresh);
}
function refresh() {
  const h = popoutOf(ID);
  if (h) h.refresh();
}

/** Open Song Mode's mixer (or bring it forward). */
export function songMixerOpen() {
  popout({ id: ID, title: 'Song mixer', w: 980, h: 760, build });
}
/** Close it (when leaving Song Mode). */
export function songMixerClose() {
  const h = popoutOf(ID);
  if (h) h.close();
}
