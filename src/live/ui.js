// Builds the Live Mode page and its toolbar, and the timeline maths it uses.
//
// Reads: S, LV, TR.
// Calls up the layers through hooks (core/hooks.js).
import { $, clamp, el, toast } from '../core/dom.js';
import { S, scheduleSave } from '../core/state.js';
import { TR, stopPlay } from '../services/transport.js';
import { toggleFull } from '../ui/fullscreen.js';
import { clipMapOpen } from '../clips/clips-screen.js';
import { FAMLABEL, STYLES } from '../library/styles.js';
import { LV, NOTEN, lvStyle, saveLive } from './state.js';
import { LV_THEMES, liveSetTheme } from './themes.js';
import { liveMoveNow } from './moves.js';
import { LV_BRK, LV_BRKLEN, liveBreak } from './breaks.js';
import { liveNewSet } from './scene-templates.js';
import { lvFullPool } from '../library/pools.js';
import { liveBuild } from './set-builder.js';
import { liveToggle, lvIds } from './engine.js';
import { lvJamAhead } from './jam.js';
import {
  liveAuto,
  liveBpm,
  liveBuildDrop,
  liveEnergy,
  liveKeyCue,
  liveLock,
  liveLockSave,
  liveModeCue,
  liveRate,
  liveRiser,
  liveStutter,
  liveTap,
  lvBlendIn,
  lvOn,
  lvVaryLabel
} from './cues.js';
import { knobsRest, sendKnob } from './pads.js';
import { ctlFix } from './controller.js';
import { liveRender } from './panels.js';
import { vizStart } from './visualizer.js';
import { hooks } from '../core/hooks.js';

/* ---- UI ---- */
export function lvSegs(tickf) {
  if (!lvOn()) {
    const sc = LV.scenes[LV.cur];
    return [
      {
        tick: 0,
        idx: LV.cur,
        ids: Array.from({ length: 8 }, (_, t) => (sc && sc.cells[t] ? sc.cells[t].id : null))
      }
    ];
  }
  const hs = LV.hist;
  let base = null;
  for (const h of hs) if (h.tick <= tickf) base = h;
  if (!base) base = hs[0] || { tick: 0, idx: LV.cur, ids: lvIds() };
  const segs = [base];
  for (const h of hs) if (h.tick > tickf && h.tick > base.tick) segs.push(h);
  /* the intro or outro loops still to come */
  if (LV.jam) lvJamAhead().forEach(a => segs.push({ ...a, idx: a.scene ? LV.jam.to : LV.cur, start: a.tick }));
  LV.cues
    .filter(c => c.type === 'scene')
    .forEach(c => {
      if (!segs.some(s => s.tick === c.tick && s.idx === c.idx)) {
        const sc = LV.scenes[c.idx];
        segs.push({
          tick: c.tick,
          idx: c.idx,
          ids: Array.from({ length: 8 }, (_, t) => (sc && sc.cells[t] ? sc.cells[t].id : null))
        });
      }
    });
  return segs.sort((a, b) => a.tick - b.tick);
}
export const lvTickF = () => (lvOn() && TR.vis[0] ? TR.vis[0].tick : 0);
const lvBtn = (cls, txt, fn, title, id) =>
  el('button', { class: cls, onclick: fn, title: title || '', id: id || null }, txt);
export function liveInit() {
  ctlFix();
  if (!LV_THEMES[LV.theme]) LV.theme = 'neon';
  try {
    STYLES.forEach(st => lvFullPool(st));
  } catch (e) {}
  hooks.applyDevice();
  const root = $('#live');
  if (!root) return;
  root.dataset.theme = LV.theme;
  root.dataset.light = LV_THEMES[LV.theme].light ? '1' : '';
  const sel = (label, node) => el('label', { class: 'lvf' }, label, node);
  const styleSel = el('select', {
    id: 'lvStyle',
    'aria-label': 'Style',
    onchange: e => {
      liveNewSet(e.target.value);
      if (lvOn()) stopPlay();
      liveRender();
    }
  });
  ['dnb', 'hh', 'edm', 'song'].forEach(f => {
    const g = el('optgroup', { label: FAMLABEL[f] });
    STYLES.filter(s => s.fam === f).forEach(s => g.append(el('option', { value: s.id }, s.name)));
    if (g.children.length) styleSel.append(g);
  });
  const keySel = el('select', { id: 'lvKey', 'aria-label': 'Key', onchange: e => liveKeyCue(+e.target.value) });
  const modeSel = el(
    'select',
    { id: 'lvMode', 'aria-label': 'Major or minor', onchange: e => liveModeCue(e.target.value) },
    el('option', { value: 'minor' }, 'minor'),
    el('option', { value: 'major' }, 'major')
  );
  NOTEN.forEach((n, i) => keySel.append(el('option', { value: i }, n)));
  const bpm = el('input', {
    type: 'number',
    id: 'lvBpm',
    min: 40,
    max: 240,
    step: 1,
    style: 'width:64px',
    onchange: e => {
      LV.bpm = clamp(Math.round(+e.target.value) || LV.bpm, 40, 240);
      e.target.value = LV.bpm;
      saveLive();
    }
  });
  const sw = el('input', {
    type: 'range',
    id: 'lvSwing',
    min: 50,
    max: 75,
    style: 'width:90px',
    'aria-label': 'Swing',
    title:
      'Swing: 50% is straight; higher pushes every second 16th later for a looser, bouncier groove. Changes straight away.',
    oninput: e => {
      LV.swing = +e.target.value;
      $('#lvSwV').textContent = LV.swing + '%';
      saveLive();
    }
  });
  const qs = el('select', {
    id: 'lvQ',
    'aria-label': 'Launch quantise',
    onchange: e => {
      LV.quant = e.target.value === 'phrase' ? 'phrase' : +e.target.value;
      saveLive();
    }
  });
  [
    ['phrase', 'End of phrase'],
    [1, '1 bar'],
    [2, '2 bars'],
    [4, '4 bars'],
    [8, '8 bars']
  ].forEach(([v, l]) => qs.append(el('option', { value: v }, l)));
  const es = el('select', {
    id: 'lvEntry',
    'aria-label': 'Entry',
    onchange: e => {
      LV.entry = e.target.value;
      saveLive();
    }
  });
  [
    ['smooth', 'Smooth (1 bar)'],
    ['slow', 'Slow (2 bars)'],
    ['long', 'Long (4 bars)'],
    ['vlong', 'Very long (8 bars)'],
    ['hard', 'Hard cut']
  ].forEach(([v, l]) => es.append(el('option', { value: v }, l)));
  const reps = el('select', {
    id: 'lvReps',
    'aria-label': 'Loops per scene',
    onchange: e => {
      LV.autoReps = +e.target.value;
      saveLive();
    }
  });
  [1, 2, 3, 4].forEach(n => reps.append(el('option', { value: n }, n + (n === 1 ? ' loop' : ' loops'))));
  const top = el(
    'div',
    { class: 'lvTop' },
    el(
      'button',
      {
        class: 'btn lvstart',
        id: 'lvStart',
        onclick: liveToggle,
        title:
          'Start Jam: a few 2-bar intro loops build into the first scene (Shift-click to start the first scene straight away). End Jam: outro loops wind it down to a last hit; press again to stop now.'
      },
      '▶ Start Jam'
    ),
    el(
      'button',
      {
        class: 'btn lvauto',
        id: 'lvAuto',
        onclick: () => liveAuto(),
        title: 'Let the set run itself: fills, swaps and scene changes'
      },
      'Auto-pilot'
    ),
    el(
      'button',
      {
        class: 'btn lvlock',
        id: 'lvLock',
        onclick: () => liveLock(),
        title:
          'Hold the loop exactly as it is playing: the same patterns on every track, no automatic changes. Your own pad presses still work.'
      },
      '🔓 Lock loop'
    ),
    el(
      'button',
      {
        class: 'btn',
        id: 'lvLockSave',
        hidden: true,
        onclick: liveLockSave,
        title: 'Keep this exact loop as a scene pad'
      },
      '＋ Save as scene'
    ),
    sel('Style', styleSel),
    sel('Key', el('span', { class: 'lvsw' }, keySel, modeSel)),
    el('span', { class: 'lvKeyRec', id: 'lvKeyRec', 'aria-label': 'Suggested keys for this style' }),
    el(
      'span',
      { class: 'lvf' },
      'BPM',
      el('button', { class: 'btn sm', onclick: () => liveBpm(-1), title: 'Slower' }, '−'),
      bpm,
      el('button', { class: 'btn sm', onclick: () => liveBpm(1), title: 'Faster' }, '+'),
      el('button', { class: 'btn sm', onclick: liveTap, title: 'Tap the tempo' }, 'Tap')
    ),
    el('span', { class: 'lvf' }, 'Swing', sw, el('b', { id: 'lvSwV', class: 'lvSwV' }, LV.swing + '%')),
    el(
      'button',
      {
        class: 'btn',
        id: 'lvNew',
        onclick: () => {
          liveNewSet();
          if (lvOn()) {
            const bars = lvBlendIn();
            toast('New patterns: down to the drums, the new set comes in over ' + bars + ' bars');
          } else toast('New set built from ' + lvStyle().name);
          liveRender();
        },
        title: 'Build a fresh set of scenes and patterns in this style'
      },
      '🎲 New patterns'
    ),
    el('span', { class: 'hint', id: 'lvMidiSt' }, ''),
    /* tools opened from the Live menu: kept here hidden so the menu, shortcuts and Fullscreen label find them */
    el(
      'span',
      { class: 'lvTools', hidden: true },
      el(
        'button',
        {
          class: 'btn',
          id: 'lvMidi',
          onclick: async () => {
            await hooks.suAutoConnect();
            liveRender();
          },
          title: 'Connect to the MC-707 over USB MIDI'
        },
        'Connect MC-707'
      ),
      el(
        'button',
        {
          class: 'btn',
          id: 'lvGrab',
          onclick: ev => hooks.grabOpen(ev.currentTarget),
          title: 'Sample grabber: record a few bars of one track to a WAV'
        },
        '◉ Grab sample'
      ),
      el(
        'button',
        {
          class: 'btn',
          id: 'lvCapture',
          onclick: hooks.liveCapture,
          title: 'Turn what you just played into an arrangement in Song Mode'
        },
        '⏺ Capture to Song'
      ),
      el(
        'button',
        { class: 'btn', id: 'lvFull', onclick: toggleFull, title: 'Fill the whole screen (F11)' },
        '⛶ Fullscreen'
      ),
      el(
        'button',
        {
          class: 'btn',
          onclick: () => clipMapOpen(),
          title: 'Tell the app what sound each MC-707 clip holds, so tracks can switch sounds'
        },
        '▦ Clips'
      ),
      el(
        'button',
        {
          class: 'btn',
          id: 'lvPadSet',
          onclick: () => {
            const d = $('#lvSetDet');
            d.open = true;
            d.scrollIntoView({ block: 'nearest' });
          }
        },
        'Mapping'
      )
    )
  );
  /* playback options, in the settings panel at the bottom */
  const playOpts = el(
    'div',
    { class: 'lvPlayOpts' },
    sel('Loops', reps),
    sel(
      'Patterns',
      el(
        'select',
        {
          id: 'lvFlavor',
          'aria-label': 'Pattern style',
          title: 'Lively picks busier, more syncopated parts. Classic keeps them simple.',
          onchange: e => {
            LV.flavor = e.target.value;
            saveLive();
            liveBuild();
            liveRender();
            toast(
              lvOn() ? 'New patterns arrive with the next scene' : 'Set rebuilt with ' + e.target.value + ' patterns'
            );
          }
        },
        el('option', { value: 'lively' }, 'Lively'),
        el('option', { value: 'mixed' }, 'Mixed'),
        el('option', { value: 'classic' }, 'Classic')
      )
    ),
    sel('Launch on', qs),
    sel('Entry', es),
    el(
      'label',
      { class: 'lvf' },
      el('input', {
        type: 'checkbox',
        id: 'lvFills',
        onchange: e => {
          LV.fills = e.target.checked;
          saveLive();
        }
      }),
      'Fills'
    ),
    el(
      'label',
      { class: 'lvf' },
      el('input', {
        type: 'checkbox',
        id: 'lvPrev',
        onchange: e => {
          S.preview = e.target.checked;
          scheduleSave();
          hooks.syncControls();
        }
      }),
      'Preview sound'
    ),
    el(
      'label',
      { class: 'lvf' },
      'Theme',
      el(
        'select',
        { id: 'lvTheme', 'aria-label': 'Colour theme', onchange: e => liveSetTheme(e.target.value) },
        ...Object.entries(LV_THEMES).map(([k, v]) => el('option', { value: k, selected: LV.theme === k }, v.name))
      )
    )
  );
  const hero = el(
    'div',
    { class: 'lvHero' },
    el(
      'div',
      { class: 'lvbox lvnow' },
      el('small', {}, 'NOW PLAYING'),
      el('b', { id: 'lvNowName', class: 'big' }, 'Stopped'),
      el('div', { class: 'lvProg', id: 'lvProg' }),
      el('div', { class: 'lvbeats', id: 'lvBeats' }, ...[0, 1, 2, 3].map(i => el('i', { id: 'lvBeat' + i }))),
      el('span', { id: 'lvNowBar', class: 'hint' }, '')
    ),
    el(
      'div',
      { class: 'lvbox' },
      el('small', {}, 'NEXT'),
      el('b', { id: 'lvNextName', class: 'big' }, '—'),
      el('span', { id: 'lvNextIn', class: 'lvcount' }, '')
    ),
    el(
      'div',
      { class: 'lvbox' },
      el('small', {}, 'KEY'),
      el('b', { id: 'lvKeyShow', class: 'big' }, ''),
      el('span', { id: 'lvKeyNext', class: 'hint' }, '')
    ),
    el(
      'div',
      { class: 'lvbox' },
      el('small', {}, 'TEMPO'),
      el('b', { id: 'lvBpmShow', class: 'big' }, ''),
      el('span', { id: 'lvRateShow', class: 'hint' }, '')
    )
  );
  const cards = el('div', { class: 'lvTiles', id: 'lvCards' });
  const lanes = el(
    'div',
    { class: 'lvLanes' },
    el('div', { class: 'lvLH', id: 'lvLabels' }),
    el('div', { class: 'lvLV', id: 'lvView' }, el('div', { class: 'lvLI', id: 'lvInner' }))
  );
  const pads = el(
    'div',
    { class: 'lvPadsBox' },
    el('div', { class: 'lvh' }, el('h3', {}, 'Pads'), el('span', { class: 'hint', id: 'lvPadHint' })),
    el('div', { class: 'lvPads', id: 'lvPads' })
  );
  const viz = el(
    'div',
    { class: 'lvViz' },
    el('canvas', { id: 'lvViz', 'aria-label': 'Visualizer', 'aria-hidden': 'true' })
  );
  const left = el(
    'div',
    { class: 'lvLeft' },
    cards,
    el('div', { class: 'lvPanel lvScEd', id: 'lvScEd', hidden: true }),
    lanes,
    pads,
    viz
  );
  const fx = el(
    'div',
    { class: 'lvRight' },
    el(
      'div',
      { class: 'lvPanel' },
      el('div', { class: 'lvh' }, el('h3', {}, 'Energy'), el('b', { id: 'lvEnVal' }, '8')),
      el('input', {
        type: 'range',
        id: 'lvEnergy',
        min: 1,
        max: 8,
        step: 1,
        class: 'lvEn',
        'aria-label': 'Energy: how many parts are playing',
        onchange: e => liveEnergy(+e.target.value),
        oninput: e => {
          $('#lvEnVal').textContent = e.target.value;
        }
      }),
      el('div', { class: 'hint' }, 'Fewer parts for a breakdown, all 8 for full power. Changes on the next bar.'),
      el(
        'div',
        { class: 'lvh', style: 'margin-top:12px' },
        el('h3', {}, 'Variation'),
        el('b', { id: 'lvVaryVal' }, '50')
      ),
      el('input', {
        type: 'range',
        id: 'lvVary',
        min: 0,
        max: 125,
        step: 5,
        class: 'lvEn',
        'aria-label': 'Variation: how often parts change by themselves',
        oninput: e => {
          LV.vary = +e.target.value;
          $('#lvVaryVal').textContent = lvVaryLabel();
          saveLive();
        }
      }),
      el('div', { class: 'hint' }, 'How often the set changes by itself. 0 holds every scene; past High is Extreme.')
    ),
    el(
      'div',
      { class: 'lvPanel' },
      el('h3', {}, 'Moves'),
      el(
        'div',
        { class: 'lvBtns' },
        lvBtn(
          'btn lvbrk',
          '⚡ Break',
          () => liveBreak(),
          'A quick flash, then straight back into the loop on the downbeat. Also the top-right pad.'
        ),
        el(
          'select',
          {
            id: 'lvBrkSt',
            'aria-label': 'Break style',
            title: 'What the Break pad does',
            onchange: e => {
              LV.brkStyle = e.target.value;
              saveLive();
            }
          },
          ...LV_BRK.map(([v, l]) => el('option', { value: v }, l))
        ),
        el(
          'select',
          {
            id: 'lvBrkLen',
            'aria-label': 'Break length',
            title: 'How long a break lasts',
            onchange: e => {
              LV.brkLen = +e.target.value;
              saveLive();
            }
          },
          ...LV_BRKLEN.map(([v, l]) => el('option', { value: v }, l))
        )
      ),
      el(
        'div',
        { class: 'lvBtns' },
        lvBtn('btn lvbd', '🚀 Build → Drop', liveBuildDrop, 'Queue a build scene with a filter riser, then the drop'),
        lvBtn('btn', 'Riser ↑', () => liveRiser('up'), 'Sweep the FILTER knob up over the next bars'),
        lvBtn('btn', 'Riser ↓', () => liveRiser('down')),
        el(
          'select',
          {
            id: 'lvRiseBars',
            'aria-label': 'Build length',
            title: 'How long Build → Drop and the risers last',
            onchange: e => {
              LV.riseBars = +e.target.value;
              saveLive();
            }
          },
          ...[2, 4, 8].map(n => el('option', { value: n }, n + ' bars'))
        ),
        el(
          'select',
          {
            id: 'lvDropSt',
            'aria-label': 'Drop style',
            title:
              'How big jumps land: Smooth crossfades, Hard cuts kick and bass for the last bar then slams in with an impact, Hard + gap adds a beat of silence first',
            onchange: e => {
              LV.dropStyle = e.target.value;
              saveLive();
            }
          },
          el('option', { value: 'gap' }, 'Hard drop + gap'),
          el('option', { value: 'hard' }, 'Hard drop'),
          el('option', { value: 'smooth' }, 'Smooth drop')
        )
      ),
      el(
        'div',
        { class: 'lvBtns' },
        lvBtn('btn', 'Wash', () => liveMoveNow('wash'), 'Reverb rises over 2 bars, then snaps back'),
        lvBtn('btn', 'Throw', () => liveMoveNow('throw'), 'A burst of reverb on the next beat that fades out'),
        lvBtn('btn', 'Filter dip', () => liveMoveNow('dip'), 'Close the filter for a bar and open it back up'),
        lvBtn(
          'btn',
          'Pump',
          () => liveMoveNow('pump'),
          'Sidechain-style pumping on the bass, chords and pad. Press again to stop.',
          'lvPumpB'
        ),
        lvBtn(
          'btn',
          'Autopan',
          () => liveMoveNow('pan'),
          'Lead and pluck swing left and right in time. Press again to stop.',
          'lvPanB'
        )
      ),
      el(
        'label',
        { class: 'lvf', style: 'margin:2px 0 6px' },
        el('input', {
          type: 'checkbox',
          id: 'lvBuildFx',
          onchange: e => {
            LV.buildFx = e.target.checked;
            saveLive();
          }
        }),
        'Epic builds: resonance, reverb wash and pump climb into every drop'
      ),
      el(
        'div',
        { class: 'lvBtns' },
        ...[
          ['Stutter ¼', 8],
          ['Stutter ⅛', 4],
          ['Stutter 1/16', 2]
        ].map(([l, len]) => {
          const b = el('button', { class: 'btn lvhold', title: 'Hold to repeat the last slice' }, l);
          const on = ev => {
            ev.preventDefault();
            try {
              b.setPointerCapture(ev.pointerId);
            } catch (_) {}
            b.classList.add('on');
            liveStutter(len, true);
          };
          const off = () => {
            b.classList.remove('on');
            liveStutter(0, false);
          };
          b.addEventListener('pointerdown', on);
          b.addEventListener('pointerup', off);
          b.addEventListener('pointercancel', off);
          b.addEventListener('lostpointercapture', off);
          return b;
        })
      ),
      el(
        'div',
        { class: 'lvBtns' },
        el('span', { class: 'hint' }, 'Speed'),
        ...[
          [0.5, '½×'],
          [1, '1×'],
          [2, '2×']
        ].map(([r, l]) =>
          el(
            'button',
            { class: 'btn lvrate', id: 'lvRate' + String(r).replace('.', '_'), onclick: () => liveRate(r) },
            l
          )
        ),
        el(
          'label',
          { class: 'lvf' },
          'Chaos',
          el('input', {
            type: 'range',
            id: 'lvChaos',
            min: 0,
            max: 100,
            style: 'width:90px',
            oninput: e => {
              LV.chaos = +e.target.value;
              saveLive();
            },
            title: 'How often Auto-pilot adds fills and swaps'
          })
        )
      )
    ),
    el(
      'div',
      { class: 'lvPanel' },
      el(
        'div',
        { class: 'lvh' },
        el('h3', {}, 'Knobs'),
        el(
          'label',
          { class: 'lvf' },
          'to',
          el('select', {
            id: 'lvKT',
            'aria-label': 'Knob target',
            onchange: e => {
              LV.ktarget = e.target.value;
              saveLive();
            }
          })
        )
      ),
      el('div', { class: 'lvKnobs', id: 'lvKnobs' }),
      el(
        'div',
        {
          class: 'lvxy',
          id: 'lvXY',
          title: 'Drag: left–right is FILTER, up–down is FX. Springs back on release.'
        },
        el('i', { id: 'lvXYd' }),
        el('span', {}, 'FILTER ↔ · FX ↕')
      )
    ),
    el(
      'div',
      { class: 'lvPanel' },
      el('div', { class: 'lvh' }, el('h3', {}, 'Scatter'), el('span', { class: 'hint' }, 'hold')),
      el('div', { class: 'lvSc', id: 'lvScG' }),
      el('div', { class: 'hint', id: 'lvScHint' })
    ),
    el(
      'div',
      { class: 'lvPanel' },
      el('h3', {}, 'Key and parts'),
      el('div', { class: 'hint', id: 'lvPerfHint' }),
      el('div', { class: 'lvKeysRow', id: 'lvKeys' }),
      el('div', { class: 'lvStrips', id: 'lvMutes' }),
      el('div', { class: 'ctlBar', id: 'lvCtlBar', hidden: true })
    )
  );
  const sets = el(
    'details',
    { class: 'lvSet', id: 'lvSetDet' },
    el('summary', {}, 'Settings and mapping'),
    el('h4', {}, 'Playback'),
    playOpts,
    el('div', { id: 'lvSetBody' })
  );
  root.append(top, hero, el('div', { class: 'lvMain' }, left, fx), sets);
  const xy = $('#lvXY');
  const xyMove = ev => {
    const r = xy.getBoundingClientRect();
    const x = clamp((ev.clientX - r.left) / r.width, 0, 1),
      y = clamp((ev.clientY - r.top) / r.height, 0, 1);
    const d = $('#lvXYd');
    d.style.left = x * 100 + '%';
    d.style.top = y * 100 + '%';
    sendKnob(0, Math.round(x * 127));
    sendKnob(2, Math.round((1 - y) * 127));
  };
  xy.addEventListener('pointerdown', ev => {
    try {
      xy.setPointerCapture(ev.pointerId);
    } catch (_) {}
    xy.classList.add('on');
    xyMove(ev);
  });
  xy.addEventListener('pointermove', ev => {
    if (xy.classList.contains('on')) xyMove(ev);
  });
  const xyUp = () => {
    if (!xy.classList.contains('on')) return;
    xy.classList.remove('on');
    knobsRest();
    xyRestPos();
  };
  const xyRestPos = () => {
    const d = $('#lvXYd');
    d.style.left = '50%';
    d.style.top = '50%';
  };
  xyRestPos();
  xy.addEventListener('pointerup', xyUp);
  xy.addEventListener('pointercancel', xyUp);
  liveBuild();
  liveRender();
  if (document.body.dataset.mode === 'live') vizStart();
}
