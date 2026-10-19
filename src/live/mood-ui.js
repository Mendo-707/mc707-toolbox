// The Mood control for Live Mode (next to Humanize): a menu of moods (Angry, Dark, Driving, Euphoric,
// Uplifting, Chill, Dreamy, Melancholy) and a small pad to drag between them, calm to intense across
// and dark to bright up. A mood leans the set towards patterns that feel that way inside the genre
// (library/mood.js), makes the band play harder and shorter or softer and longer (services/humanize.js),
// and sets the tempo, feel, chaos and how parts come in and drops land. While playing, the new set comes
// in over one bar (live/mood-move.js). Off leaves everything as it was.
//
// Reads: LV.
import { $, el, toast } from '../core/dom.js';
import { MOODS, moodName } from '../library/mood.js';
import { HUM } from '../services/humanize.js';
import { LV, lvStyle, saveLive } from './state.js';
import { liveBuild } from './set-builder.js';
import { liveBpm, lvOn } from './cues.js';
import { humanizeSync, lvHumApply } from './humanize-ui.js';
import { liveRender } from './panels.js';
import { lvMoodMove } from './mood-move.js';

/** Put the mood into the player (on start and on every change). */
export function lvMoodApply() {
  const m = LV.mood;
  HUM.push = m && Math.abs(m.i - 50) >= 10 ? Math.max(-1, Math.min(1, (m.i - 50) / 50)) : 0;
}

/* the settings a mood brings with it; the middle of each scale leaves the setting alone */
function moodSettings(m) {
  const st = lvStyle(),
    said = [];
  const [lo, hi] = st.bpm;
  if (Math.abs(m.i - 50) >= 15 && hi > lo) {
    const bpm = Math.round(lo + ((hi - lo) * m.i) / 100);
    if (bpm !== LV.bpm) liveBpm(bpm - LV.bpm);
    said.push(LV.bpm + ' BPM');
  }
  if (m.i >= 70) {
    /* intense stays tight; with Humanize on, the band pushes ahead of the beat */
    Object.assign(LV, { entry: 'hard', dropStyle: 'hard', brkStyle: 'stutter' });
    if ((LV.human || 0) > 0) ((LV.feel = 'pushed'), said.push('pushed feel'));
    LV.chaos = Math.max(LV.chaos, 55);
    said.push('hard drops');
  } else if (m.i <= 35) {
    Object.assign(LV, { feel: 'laidback', entry: 'slow', dropStyle: 'smooth' });
    LV.chaos = Math.min(LV.chaos, 15);
    /* laid back needs a touch of Humanize to be heard */
    if ((LV.human || 0) < 25) LV.human = 25;
    said.push('laid back', 'smooth entries');
  }
  humanizeSync();
  lvHumApply();
  return said;
}

/** Choose a mood (null for Off): the set is rebuilt with it, as the Patterns menu does. */
export function lvMoodSet(m, quiet) {
  LV.mood = m ? { i: Math.round(m.i), c: Math.round(m.c) } : null;
  const said = m ? moodSettings(LV.mood) : [];
  lvMoodApply();
  saveLive();
  liveBuild();
  const live = lvOn();
  if (live) lvMoodMove(LV.mood);
  moodSync();
  liveRender();
  if (!quiet)
    toast(
      'Mood: ' +
        moodName(LV.mood) +
        (said.length ? ' (' + said.join(', ') + ')' : '') +
        (live ? (LV.mood && LV.mood.i <= 40 ? '. Easing into it on the next bar' : '. Into it on the next bar') : '')
    );
}

/** The menu and the pad. */
export function moodControl() {
  const menu = el(
    'select',
    {
      id: 'lvMood',
      'aria-label': 'Mood',
      title:
        'Mood: leans the whole set one way inside the genre. Intense moods pick harder, busier, shorter parts, play them harder and faster, and drop hard; calm moods pick softer, longer, sparser parts and lay back. Dark moods pick minor, clashing, lower parts; bright moods major, open, higher ones. Off leaves the picks as they were.',
      onchange: e => {
        const v = e.target.value,
          p = MOODS.find(x => x[0] === v);
        lvMoodSet(p ? { i: p[2], c: p[3] } : null);
      }
    },
    el('option', { value: 'off' }, 'Off'),
    ...MOODS.map(([v, n]) => el('option', { value: v }, n)),
    el('option', { value: 'custom', disabled: true }, 'Custom')
  );
  const dot = el('i', { class: 'lvMoodDot', id: 'lvMoodDot' });
  const pad = el(
    'div',
    {
      class: 'lvMoodPad',
      id: 'lvMoodPad',
      role: 'slider',
      'aria-label': 'Mood pad: calm to intense across, dark to bright up',
      title: 'Drag: calm ← → intense, dark ↓ ↑ bright. Release to rebuild the set. Double-click for Off.',
      ondblclick: () => lvMoodSet(null)
    },
    dot
  );
  let drag = null;
  const at = e => {
    const r = pad.getBoundingClientRect();
    return {
      i: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      c: Math.max(0, Math.min(100, (1 - (e.clientY - r.top) / r.height) * 100))
    };
  };
  pad.addEventListener('pointerdown', e => {
    drag = at(e);
    pad.setPointerCapture(e.pointerId);
    showDot(drag);
  });
  pad.addEventListener('pointermove', e => {
    if (!drag) return;
    drag = at(e);
    showDot(drag);
  });
  pad.addEventListener('pointerup', () => {
    if (!drag) return;
    /* snap to a named mood when released close to one */
    const near = MOODS.find(x => Math.hypot(x[2] - drag.i, x[3] - drag.c) < 9);
    lvMoodSet(near ? { i: near[2], c: near[3] } : drag);
    drag = null;
  });
  return el('span', { class: 'lvf' }, 'Mood', menu, pad);
}
function showDot(m) {
  const d = $('#lvMoodDot');
  if (!d) return;
  d.hidden = !m;
  if (m) {
    d.style.left = m.i + '%';
    d.style.top = 100 - m.c + '%';
  }
}
/** Keep the control in step when settings are loaded or changed elsewhere. */
export function moodSync() {
  const s = $('#lvMood'),
    m = LV.mood;
  if (s) {
    const p = m && MOODS.find(x => x[2] === m.i && x[3] === m.c);
    s.value = !m ? 'off' : p ? p[0] : 'custom';
  }
  showDot(m);
  const pad = $('#lvMoodPad');
  if (pad) pad.classList.toggle('on', !!m);
}
