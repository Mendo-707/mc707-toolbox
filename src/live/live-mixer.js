// Live Mode's mixer: a strip per MC-707 track with Live's own level, pan, reverb and chorus (live/mix.js,
// kept apart from the song's mix and saved with Live's settings), and mute and solo that wait for the
// next beat while the jam plays, like the controller's mutes. It shows what the set is doing too: the
// notes going out, a track the energy level has taken out, one you are playing yourself, and a level a
// controller fader or a move has moved. It opens in a window that can sit on another screen.
//
// Reads: LV, S, TR, DEV.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { midiAct } from '../services/midi.js';
import { TR } from '../services/transport.js';
import { popTheme, popout, popoutOf, themeSig } from '../services/popout.js';
import { mixLight, mixStrip } from '../services/mixer-strip.js';
import { showMenu } from '../ui/menu.js';
import { LV, mkEnv } from './state.js';
import { lvNow } from './themes.js';
import { lvUserOwns } from './moves.js';
import { lvEmute, lvTarget } from './engine.js';
import { lvEffMute, lvOn, lvSortCues } from './cues.js';
import { MIX_CC, lvMixNow, lvMixReset, lvMixSendAll, lvMixSet } from './mix.js';

const ID = 'live-mixer';
let held = false,
  soloT = null,
  soloMuted = [];

/* mute or unmute tracks: on the next beat while the jam plays, at once when it is stopped */
function muteNow(tracks, on) {
  if (!tracks.length) return;
  if (!lvOn()) {
    tracks.forEach(t => (LV.mute[t] = on));
    LV.tg = Array.from({ length: 8 }, (_, t) => mkEnv(lvTarget(t), lvTarget(t), 0, 0));
  } else {
    LV.cues = LV.cues.filter(c => !(c.type === 'mute' && c.tracks.some(t => tracks.includes(t))));
    LV.cues.push({ type: 'mute', tracks, on, tick: Math.ceil((TR.tick + 1) / 8) * 8 });
    lvSortCues();
  }
  LV.ver++;
}
/* solo: the others go quiet (on the beat); un-solo brings back only the ones the solo took out */
function solo(t) {
  const tracks = DEVS[DEV].tracks;
  if (soloT === t) {
    muteNow(soloMuted, false);
    soloT = null;
    soloMuted = [];
    return;
  }
  if (soloT != null)
    muteNow(
      soloMuted.filter(u => u === t),
      false
    );
  const others = tracks.filter(u => u !== t && !lvEffMute(u));
  soloMuted = [...soloMuted.filter(u => u !== t), ...others];
  if (lvEffMute(t)) muteNow([t], false);
  muteNow(others, true);
  soloT = t;
}

function stripFor(t) {
  const tr = S.tracks[t],
    eff = lvEffMute(t),
    pend = lvOn() && eff !== !!LV.mute[t] ? (eff ? 'mute' : 'unmute') : '';
  const dim = lvUserOwns(t) ? 'You’re playing it' : lvEmute(t) ? 'Out (energy)' : '';
  return mixStrip(
    {
      num: devNum(t),
      name: tr.name,
      color: TRACK_COLORS[t],
      sub: (tr.type === 'drum' ? 'Kit' : 'Tone') + ' · ch ' + tr.ch,
      lvl: lvMixNow(t, 'lvl'),
      pan: lvMixNow(t, 'pan'),
      rev: lvMixNow(t, 'rev'),
      cho: lvMixNow(t, 'cho'),
      mute: eff,
      solo: soloT === t,
      pending: pend,
      dim
    },
    {
      title: 'Right-click for more',
      grab: () => (held = true),
      done: () => (held = false),
      set: (key, v) => lvMixSet(t, key, v, lvNow()),
      mute: () => {
        muteNow([t], !lvEffMute(t));
        refresh();
      },
      solo: () => {
        solo(t);
        refresh();
      },
      menu: e =>
        showMenu(e.clientX, e.clientY, [
          { label: 'Reset this track’s mix', action: () => (lvMixReset(t, lvNow()), refresh()) },
          { label: 'Unmute every track', action: () => (unmuteAll(), refresh()) }
        ])
    }
  );
}
function unmuteAll() {
  soloT = null;
  soloMuted = [];
  muteNow(
    DEVS[DEV].tracks.filter(u => lvEffMute(u)),
    false
  );
}

/* what the strips show, to redraw when the set changes it (cues landing, energy, knobs and faders) */
const sig = () =>
  JSON.stringify([
    DEVS[DEV].tracks.map(t => [
      S.tracks[t].name,
      S.tracks[t].ch,
      lvEffMute(t),
      !!LV.mute[t],
      lvEmute(t),
      lvUserOwns(t),
      ...Object.values(MIX_CC).map(n => LV.ccLast[t + ':' + n])
    ]),
    LV.mix,
    soloT,
    lvOn()
  ]);
let strips = [],
  last = '',
  look = '',
  gen = 0,
  lastSig = 0;
/* Live Mode's look: the colours of its screen in the Live theme picked (neon, studio, midnight…) */
const lookSrc = () => document.querySelector('#live') || document.documentElement;
function build(root, h) {
  last = sig();
  look = popTheme(h, lookSrc(), 'popLive');
  const my = ++gen;
  strips = DEVS[DEV].tracks.map(t => [t, stripFor(t)]);
  root.append(
    el(
      'div',
      { class: 'mxWrap live' },
      el(
        'div',
        { class: 'mxTop' },
        el('b', { class: 'mxTitle' }, 'Live mixer'),
        el(
          'span',
          { class: 'hint' },
          'Live’s own mix, apart from the song’s. Mutes and solos land on the next beat while the jam plays.'
        ),
        el(
          'div',
          { class: 'mxActs' },
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              title: 'Send every level, pan and send to the MC-707 now',
              onclick: () => lvMixSendAll(lvNow())
            },
            'Send to MC-707'
          ),
          el('button', { type: 'button', class: 'btn sm', onclick: () => (unmuteAll(), refresh()) }, 'Unmute all'),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              onclick: () => (DEVS[DEV].tracks.forEach(t => lvMixReset(t, lvNow())), refresh())
            },
            'Reset all'
          )
        ),
        h.winBtns()
      ),
      el('div', { class: 'mxStrips' }, ...strips.map(x => x[1]))
    )
  );
  const tick = now => {
    if (!h.open || my !== gen) return;
    for (const [t, node] of strips) mixLight(node, midiAct(S.tracks[t].ch - 1));
    /* the rest is checked a few times a second */
    if (!held && now - lastSig > 120) {
      lastSig = now;
      if (sig() !== last || themeSig(lookSrc()) !== look) return refresh();
    }
    h.raf(tick);
  };
  h.raf(tick);
}
function refresh() {
  const h = popoutOf(ID);
  if (h) h.refresh();
}

/** Open Live Mode's mixer (or bring it forward). */
export function liveMixerOpen() {
  popout({ id: ID, title: 'Live mixer', w: 760, h: 560, build });
}
