import { $, clamp, el, toast } from '../core/dom.js';
import { DEV, DEVS, TRACK_COLORS, devNum, devOn } from '../core/device.js';
import { S, scheduleSave } from '../core/state.js';
import { AU, ensureAudio } from '../services/synth.js';
import { MIDI } from '../services/midi.js';
import { TR, stopPlay } from '../services/transport.js';
import { toggleFull } from '../ui/fullscreen.js';
import { CLIPPIN, CMNOW, PCLAST, autoClip, cmChipFill, cmPickItems, devNm, sendClip } from '../clips/clip-map.js';
import { applyDevice, clipMapOpen } from '../clips/clips-screen.js';
import { syncControls } from '../song/controls.js';
import { FLASH_RH } from '../library/flash.js';
import { facById } from '../library/index.js';
import { STYLES } from '../library/styles.js';
import { showMenu } from '../song/clip-ops.js';
import { suAutoConnect } from '../ui/setup-wizard.js';
import { grabOpen } from '../song/grabber.js';
import { FAMLABEL, NK } from '../song/wizard-styles.js';
import {
  LV,
  LV_ACTS,
  LV_ACTS_KBD,
  LV_DRUM_NOTES,
  LV_LABEL,
  LV_TOPFN,
  MUG,
  NOTEN,
  lvLayoutNotes,
  lvStyle,
  noteLbl,
  saveLive
} from './state.js';
import { LV_FLASHC, LV_THEMES, actColor, actLabel, liveSetTheme, lvIsFlash, lvScCol } from './themes.js';
import { LV_SCFX, liveMoveNow } from './moves.js';
import { liveEditScene, liveRenderSceneEd } from './scene-editor.js';
import { LV_BRK, LV_BRKLEN, liveBreak } from './breaks.js';
import { LV_PLAY, liveNewSet, lvPlayOn } from './scene-templates.js';
import { liveBuild, lvFullPool, lvModeFam } from './pools.js';
import { liveToggle, lvEmute, lvIds, lvTop } from './engine.js';
import {
  liveAuto,
  liveBpm,
  liveBuildDrop,
  liveCue,
  liveEnergy,
  liveKeyCue,
  liveLock,
  liveLockSave,
  liveModeCue,
  liveMute,
  liveRate,
  liveRiser,
  liveStutter,
  liveTap,
  lvEffMute,
  lvOn,
  lvVaryLabel
} from './cues.js';
import { knobsRest, livePadDown, livePadUp, scatter, sendKnob } from './pads.js';
import { ctlFix, liveRenderCtlBar } from './controller.js';
import { ravenSection } from './raven.js';
import { ctlRenderSettings } from './controller-settings.js';
import { LV_KEYROWS, lvPadIndex, padTestOpen } from './midi-in.js';
import { liveCapture } from './capture.js';
import { VZ, vizStart } from './visualizer.js';

/* ---- UI ---- */
function lvSegs(tickf) {
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
let lvUI = null;
const lvBtn = (cls, txt, fn, title, id) =>
  el('button', { class: cls, onclick: fn, title: title || '', id: id || null }, txt);
export function liveInit() {
  ctlFix();
  if (!LV_THEMES[LV.theme]) LV.theme = 'neon';
  try {
    STYLES.forEach(st => lvFullPool(st));
  } catch (e) {}
  applyDevice();
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
    style: 'width:80px',
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
    el('button', { class: 'btn lvstart', id: 'lvStart', onclick: liveToggle }, '▶ Start'),
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
    sel('Loops', reps),
    sel('Style', styleSel),
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
          syncControls();
        }
      }),
      'Preview sound'
    ),
    el(
      'button',
      {
        class: 'btn',
        id: 'lvNew',
        onclick: () => {
          liveNewSet();
          if (lvOn()) stopPlay();
          liveRender();
          toast('New set built from ' + lvStyle().name);
        },
        title: 'Build a fresh set of scenes and patterns in this style'
      },
      '🎲 New patterns'
    ),
    el(
      'button',
      {
        class: 'btn',
        id: 'lvMidi',
        onclick: async () => {
          await suAutoConnect();
          liveRender();
        },
        title: 'Connect to the MC-707 over USB MIDI'
      },
      'Connect MC-707'
    ),
    el('span', { class: 'hint', id: 'lvMidiSt' }, ''),
    el(
      'button',
      {
        class: 'btn',
        id: 'lvGrab',
        onclick: ev => grabOpen(ev.currentTarget),
        title: 'Sample grabber: record a few bars of one track to a WAV'
      },
      '◉ Grab sample'
    ),
    el(
      'button',
      {
        class: 'btn',
        id: 'lvCapture',
        onclick: liveCapture,
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
      'label',
      { class: 'lvf' },
      'Theme',
      el(
        'select',
        { id: 'lvTheme', 'aria-label': 'Colour theme', onchange: e => liveSetTheme(e.target.value) },
        ...Object.entries(LV_THEMES).map(([k, v]) => el('option', { value: k, selected: LV.theme === k }, v.name))
      )
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
        max: 100,
        step: 5,
        class: 'lvEn',
        'aria-label': 'Variation: how often parts change by themselves',
        oninput: e => {
          LV.vary = +e.target.value;
          $('#lvVaryVal').textContent = lvVaryLabel();
          saveLive();
        }
      }),
      el(
        'div',
        { class: 'hint' },
        'How often the set changes by itself: part swaps, fills, short drop-outs and guest melodies, and repeats come back with octave jumps, runs, echoes and ghost notes. 0 keeps every scene exactly as it is.'
      )
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
        'Epic builds: resonance, reverb wash, pump and autopan climb into every drop'
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
    el('summary', {}, 'Mapping and settings'),
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
export function liveRender() {
  if (!$('#lvStyle')) return;
  $('#lvStyle').value = LV.style;
  $('#lvKey').value = LV.key;
  $('#lvBpm').value = LV.bpm;
  $('#lvSwing') && ($('#lvSwing').value = LV.swing);
  $('#lvQ').value = LV.quant;
  $('#lvEntry').value = LV.entry;
  $('#lvFills').checked = LV.fills;
  $('#lvPrev').checked = !!S.preview;
  $('#lvReps').value = LV.autoReps;
  $('#lvChaos').value = LV.chaos;
  $('#lvRiseBars').value = LV.riseBars;
  $('#lvBrkSt').value = LV.brkStyle;
  $('#lvBrkLen').value = LV.brkLen;
  $('#lvBuildFx').checked = LV.buildFx !== false;
  $('#lvFlavor').value = LV.flavor;
  $('#lvVary').value = LV.vary;
  $('#lvVaryVal').textContent = lvVaryLabel();
  $('#lvDropSt').value = LV.dropStyle;
  $('#lvMode').value = LV.mode || 'minor';
  const ms = $('#lvMidiSt');
  if (ms)
    ms.textContent =
      (MIDI.out ? 'Out: ' + MIDI.out.name : 'No MIDI out') + ' · ' + (MIDI.inp ? 'In: ' + MIDI.inp.name : 'no MIDI in');
  liveRenderKeyRec();
  liveRenderCards();
  liveRenderSceneEd();
  liveRenderPads();
  liveRenderPerf();
  liveRenderKnobs();
  liveRenderSettings();
  liveRenderCtlBar();
  liveRenderLanes(0, true);
  liveStatus(0);
  liveSync();
}
export function liveSync() {
  const b = $('#lvStart');
  if (!b) return;
  const on = lvOn();
  b.textContent = on ? '■ Stop' : '▶ Start';
  b.classList.toggle('stopb', on);
  {
    const pb = $('#lvPumpB'),
      pn = $('#lvPanB');
    if (pb)
      pb.classList.toggle(
        'on',
        (LV.autos || []).some(a => a.id === 'qpump')
      );
    if (pn)
      pn.classList.toggle(
        'on',
        (LV.autos || []).some(a => a.id === 'qpan')
      );
  }
  const a = $('#lvAuto');
  if (a) {
    a.classList.toggle('on', LV.auto);
    a.textContent = LV.auto ? 'Auto-pilot ON' : 'Auto-pilot';
  }
  const lk = $('#lvLock');
  if (lk) {
    lk.classList.toggle('on', !!LV.lock);
    lk.textContent = LV.lock ? '🔒 Locked' : '🔓 Lock loop';
    const ls = $('#lvLockSave');
    if (ls) ls.hidden = !LV.lock;
  }
  const pv = $('#lvPrev');
  if (pv) pv.checked = !!S.preview;
  [0.5, 1, 2].forEach(r => {
    const x = $('#lvRate' + String(r).replace('.', '_'));
    if (x) x.classList.toggle('on', LV.rate === r);
  });
  if (!on) liveStatus(0);
}
let lvKeyRecK = '';
function liveRenderKeyRec() {
  const b = $('#lvKeyRec');
  if (!b) return;
  const st = lvStyle();
  b.textContent = '';
  b.append(el('small', {}, 'Try'));
  st.keys.forEach(([pc, why]) => {
    const m = lvModeFam(st.scale);
    const on = LV.key === pc && LV.mode === m;
    b.append(
      el('button', { class: 'lvkr' + (on ? ' on' : ''), title: why, onclick: () => liveKeyCue(pc, m) }, NK(pc, m))
    );
  });
}
export function liveRenderCards() {
  const c = $('#lvCards');
  c.textContent = '';
  LV.scenes.forEach((sc, i) =>
    c.append(
      el(
        'div',
        {
          class: 'lvTile' + (LV.edIdx === i ? ' editing' : '') + (lvIsFlash(sc) ? ' flash' : ''),
          id: 'lvCard' + i,
          role: 'button',
          tabindex: 0,
          style: '--c:' + (lvIsFlash(sc) ? LV_FLASHC : lvScCol(sc.e, 55)),
          onclick: e => {
            if (e.target.closest('.lvEdit')) return;
            liveCue(i);
          },
          onkeydown: e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              liveCue(i);
            }
          },
          title: lvIsFlash(sc)
            ? 'Flash: a quick break on the next bar, then straight back into the loop'
            : 'Cue this scene'
        },
        el(
          'button',
          {
            class: 'lvEdit',
            title: 'Edit this scene: name, length, energy, parts and moves',
            onclick: e => {
              e.stopPropagation();
              liveEditScene(i);
            }
          },
          '✎'
        ),
        el('span', { class: 'ln' }, i + 1 + '. ' + sc.name),
        el(
          'span',
          { class: 'lvmap' },
          ...Array.from({ length: 8 }, (_, t) => {
            const c = sc.cells[t],
              C = TRACK_COLORS[t],
              part = c && c.play && c.play !== 'all';
            return el('i', {
              class: devOn(t) ? '' : 'devoff',
              style: c
                ? 'background:' + (part ? 'repeating-linear-gradient(90deg,' + C + ' 0 3px,transparent 3px 6px)' : C)
                : '',
              title:
                S.tracks[t].name +
                (c ? (part ? ' · ' + (LV_PLAY.find(x => x[0] === c.play) || ['', ''])[1].toLowerCase() : '') : ' · off')
            });
          })
        ),
        el('span', { class: 'le' }, el('i', { style: 'width:' + sc.e * 10 + '%' })),
        lvIsFlash(sc)
          ? el(
              'small',
              {},
              '⚡ ' +
                (FLASH_RH.find(x => x[0] === sc.rh) || [0, 'Flash'])[1] +
                ' · ' +
                sc.bars +
                (sc.bars === 1 ? ' bar' : ' bars') +
                ', then back'
            )
          : el(
              'small',
              {},
              sc.bars +
                (sc.bars === 1 ? ' bar' : ' bars') +
                ' · ' +
                Object.keys(sc.cells).length +
                ' parts' +
                ((sc.fx || (sc.kind === 'build' ? 'build' : 'none')) !== 'none'
                  ? ' · ' + (LV_SCFX.find(x => x[0] === (sc.fx || 'build')) || ['', ''])[1].split(' (')[0]
                  : '')
            ),
        el('span', { class: 'lq', id: 'lvCardQ' + i })
      )
    )
  );
}
function lvActKind(a) {
  if (!a) return '';
  const k = a.split(':')[0];
  return (
    {
      sw: 'Swap',
      mu: 'Mute',
      mt: 'Mute',
      fill: 'Fill',
      brk: 'Break',
      stut: 'Stutter',
      rise: 'Riser',
      bd: 'Drop',
      key: 'Key',
      en: 'Energy',
      auto: 'Auto',
      sc: 'Scatter',
      next: 'Scene',
      prev: 'Scene',
      stop: 'Stop'
    }[k] || (/^s\d$/.test(a) ? (lvIsFlash(LV.scenes[+a.slice(1)]) ? 'Flash' : 'Scene ' + (+a.slice(1) + 1)) : '')
  );
}
export function liveRenderPads() {
  const g = $('#lvPads');
  if (!g) return;
  g.textContent = '';
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 8; c++) {
      const i = lvPadIndex(r, c),
        a = LV.acts[i],
        kk = LV_KEYROWS[Math.floor(i / 8)][i % 8].toUpperCase();
      const nn = LV.padNotes[i],
        learnMe = LV.learn === i || (LV.learn === 'p1' && i === 0),
        fn = LV.padLayout === 'kbd' && i >= 8 ? LV_TOPFN[i - 8] : null;
      const where =
        nn == null
          ? fn
            ? 'the MC-707 ' + fn + ' button does not send a note, so use the screen or key'
            : 'no MIDI note'
          : 'MIDI note ' + nn + ' (' + noteLbl(nn) + ')';
      const b = el(
        'button',
        {
          class: 'lvPad' + (nn == null ? ' nonote' : '') + (learnMe ? ' learnme' : ''),
          id: 'lvPad' + i,
          style: '--c:' + actColor(a),
          title: 'Pad ' + (i + 1) + ' · ' + where + ' · key ' + kk
        },
        el('span', { class: 'pk' }, lvActKind(a)),
        el('b', {}, actLabel(a)),
        el('span', { class: 'pf' }, el('i', { class: 'pn' }, fn || ''), el('kbd', {}, kk))
      );
      b.addEventListener('pointerdown', ev => {
        if (ev.button === 2) return;
        ev.preventDefault();
        try {
          b.setPointerCapture(ev.pointerId);
        } catch (_) {}
        livePadDown(i);
      });
      b.addEventListener('pointerup', () => livePadUp(i));
      b.addEventListener('pointercancel', () => livePadUp(i));
      g.append(b);
    }
  $('#lvPadHint').textContent =
    (LV.learn === 'p1'
      ? 'Press pad 1 (top left) on the MC-707 now. '
      : LV.padLayout === 'kbd'
        ? 'Laid out like the MC-707 pads in keyboard mode. '
        : 'Pads 1–8 on top, 9–16 below, like the ' + DEVS[DEV].name + '. ') +
    'Click, press the key shown, or hit the pad on the ' +
    DEVS[DEV].name +
    ' (' +
    (LV.padCh ? 'channel ' + LV.padCh : 'any channel') +
    '). Cues wait for the launch point.';
}
export function liveRenderPerf() {
  const k = $('#lvKeys'),
    m = $('#lvMutes');
  if (!k) return;
  k.textContent = '';
  m.textContent = '';
  NOTEN.forEach((n, i) =>
    k.append(
      el(
        'button',
        {
          class: 'lvK' + (n.length > 1 ? ' blk' : '') + (LV.key === i ? ' on' : ''),
          id: 'lvK' + i,
          onclick: () => liveKeyCue(i),
          title: 'Change key to ' + n + ' (MIDI note ' + (LV.keyBase + i) + ')'
        },
        n
      )
    )
  );
  S.tracks.forEach((t, i) =>
    m.append(
      el(
        'button',
        {
          class: 'lvM' + (devOn(i) ? '' : ' devoff'),
          id: 'lvM' + i,
          style: '--c:' + TRACK_COLORS[i],
          onclick: () => liveMute([i]),
          title: 'Mute or unmute ' + t.name + ' (MIDI note ' + (LV.muteBase + i) + ')'
        },
        el('i', { class: 'vu', id: 'lvVu' + i }),
        el('span', {}, t.name)
      )
    )
  );
  $('#lvPerfHint').textContent = LV.perfOn
    ? 'First octave (' +
      noteLbl(LV.keyBase) +
      '–' +
      noteLbl(LV.keyBase + 11) +
      ') changes the key of every melodic part. Second octave (' +
      noteLbl(LV.muteBase) +
      '–' +
      noteLbl(LV.muteBase + 7) +
      ') mutes and unmutes parts.'
    : 'Key and mute keys are switched off in the mapping panel.';
}
function liveRenderKnobs() {
  const kb = $('#lvKnobs');
  if (!kb) return;
  kb.textContent = '';
  ['FILTER', 'MOD', 'FX', 'SOUND'].forEach((n, i) =>
    kb.append(
      el(
        'label',
        { class: 'lvKnob' },
        el('span', {}, n),
        el('input', {
          type: 'range',
          id: 'lvKn' + i,
          min: 0,
          max: 127,
          value: LV.knobs[i],
          oninput: e => sendKnob(i, +e.target.value),
          ondblclick: () => sendKnob(i, LV.rest[i]),
          title: 'CC ' + (80 + i) + '. Double-click to reset. The MC-707 knob position shows as a marker.'
        }),
        el('i', { class: 'lvki', id: 'lvKi' + i })
      )
    )
  );
  const kt = $('#lvKT');
  if (kt) {
    kt.textContent = '';
    [
      ['all', 'All tracks'],
      ['drums', 'Drums'],
      ['tone', 'Tone parts']
    ].forEach(([v, l]) => kt.append(el('option', { value: v }, l)));
    S.tracks.forEach((t, i) => kt.append(el('option', { value: i }, t.name)));
    kt.value = String(LV.ktarget);
  }
  const sg = $('#lvScG');
  if (sg) {
    sg.textContent = '';
    for (let i = 0; i < 16; i++) {
      const b = el(
        'button',
        {
          class: 'lvScB',
          id: 'lvSc' + i,
          title: 'Scatter pad ' + (i + 1) + ' (MIDI note ' + (LV.scBase + i) + ' on the control channel)'
        },
        String(i + 1)
      );
      b.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        try {
          b.setPointerCapture(ev.pointerId);
        } catch (_) {}
        scatter(i, true);
      });
      b.addEventListener('pointerup', () => scatter(i, false));
      b.addEventListener('pointercancel', () => scatter(i, false));
      sg.append(b);
    }
  }
  const sh = $('#lvScHint');
  if (sh)
    sh.textContent =
      'Sends notes ' +
      LV.scBase +
      '–' +
      (LV.scBase + 15) +
      ' on control channel ' +
      (S.ctrlCh || 16) +
      '. Turn Scatter on in the MC-707.';
}
export function liveRenderSettings() {
  const b = $('#lvSetBody');
  if (!b) return;
  b.textContent = '';
  const chSel = (val, on) => {
    const s = el('select', { onchange: e => on(+e.target.value) });
    s.append(el('option', { value: 0, selected: val === 0 }, 'Any channel'));
    for (let c = 1; c <= 16; c++) s.append(el('option', { value: c, selected: val === c }, 'Channel ' + c));
    return s;
  };
  const noteIn = (val, on) =>
    el('input', {
      type: 'number',
      min: 0,
      max: 127,
      value: val,
      style: 'width:64px',
      onchange: e => on(clamp(Math.round(+e.target.value) || 0, 0, 127))
    });
  b.append(
    el(
      'p',
      { class: 'hint' },
      LV.padLayout === 'kbd'
        ? "Matches the MC-707 pads in keyboard mode: the bottom row plays C D E F G A B C, the top row plays C# D# F# G# A# with Oct −, Step and Oct + in between. Those three send no note, so their pads work from the screen and keyboard only. The app follows the MC-707's Oct buttons automatically."
        : LV.padLayout === 'drum'
          ? "Matches the MC-707 pads with a drum track selected: they send the drum notes (kick 36, snare 38, closed hat 42 …) on that track's channel. Select any drum track on the MC-707 and the pads work. If yours differ, run the Pad test."
          : 'Pads send 16 notes in a row. Use Learn if your pads send something else.'
    )
  );
  b.append(
    el(
      'div',
      { class: 'lvrow' },
      el(
        'label',
        { class: 'lvf' },
        'Pad channel',
        chSel(LV.padCh, v => {
          LV.padCh = v;
          saveLive();
          liveRenderPads();
        })
      ),
      el(
        'label',
        { class: 'lvf' },
        'Pad layout',
        el(
          'select',
          {
            onchange: e => {
              const v = e.target.value;
              if (v === 'custom') return;
              const was = LV.padLayout;
              LV.padLayout = v;
              LV.padFlip = v === 'kbd';
              LV.padNotes = lvLayoutNotes();
              if (JSON.stringify(LV.acts) === JSON.stringify(was === 'kbd' ? LV_ACTS_KBD : LV_ACTS))
                LV.acts = (v === 'kbd' ? LV_ACTS_KBD : LV_ACTS).slice();
              saveLive();
              liveRenderPads();
              liveRenderSettings();
            }
          },
          el('option', { value: 'drum', selected: LV.padLayout === 'drum' }, 'MC-707 drum track (recommended)'),
          el('option', { value: 'grid', selected: LV.padLayout === 'grid' }, '16 notes in a row (other controllers)'),
          el(
            'option',
            { value: 'kbd', selected: LV.padLayout === 'kbd' },
            'MC-707 keyboard mode (white keys on the bottom row)'
          ),
          LV.padLayout === 'custom' ? el('option', { value: 'custom', selected: true }, 'Learned from your pads') : null
        )
      ),
      el(
        'button',
        {
          class: 'btn' + (LV.learn === 'p1' ? ' on' : ''),
          disabled: !MIDI.inp,
          title: MIDI.inp ? 'Press the top-left pad on the MC-707 once' : 'Connect the MC-707 first',
          onclick: () => {
            LV.learn = LV.learn === 'p1' ? -1 : 'p1';
            liveRenderSettings();
            liveRenderPads();
          }
        },
        LV.learn === 'p1' ? 'Now press pad 1 on the MC-707…' : 'Set from pad 1 (one press)'
      ),
      el(
        'button',
        {
          class: 'btn on',
          onclick: padTestOpen,
          title: 'Press pads 1–16 in order and see exactly what the MC-707 sends'
        },
        'Pad test'
      ),
      el(
        'button',
        {
          class: 'btn' + (LV.learn >= 0 ? ' on' : ''),
          disabled: !MIDI.inp,
          title: MIDI.inp ? '' : 'Connect the MC-707 first',
          onclick: () => {
            LV.learn = LV.learn >= 0 ? -1 : 0;
            liveRenderSettings();
            liveRenderPads();
          }
        },
        LV.learn >= 0 ? 'Press pad ' + (LV.learn + 1) + '… (click to stop)' : 'Learn the 16 pads in order'
      ),
      LV.learn >= 0
        ? el(
            'button',
            {
              class: 'btn',
              onclick: () => {
                LV.padNotes[LV.learn] = null;
                LV.learn = LV.learn >= 15 ? -1 : LV.learn + 1;
                saveLive();
                liveRenderPads();
                liveRenderSettings();
              }
            },
            'Skip (pad sends no note)'
          )
        : null,
      el(
        'button',
        {
          class: 'btn',
          onclick: () => {
            LV.padLayout = 'drum';
            LV.padFlip = false;
            LV.padBase = 36;
            LV.padNotes = LV_DRUM_NOTES.slice();
            LV.acts = LV_ACTS.slice();
            LV.padCh = 0;
            saveLive();
            liveRenderPads();
            liveRenderSettings();
          }
        },
        'Reset pads'
      )
    )
  );
  const grid = el('div', { class: 'lvActGrid' });
  const opts = [];
  for (let i = 0; i < 8; i++) opts.push(['s' + i, 'Scene ' + (i + 1) + (LV.scenes[i] ? ': ' + LV.scenes[i].name : '')]);
  [
    'sw:drums',
    'sw:perc',
    'sw:bass',
    'sw:chords',
    'sw:pad',
    'sw:lead',
    'fill',
    'bd',
    'rise:up',
    'rise:down',
    'stut:4',
    'stut:8',
    'stut:16',
    'en:up',
    'en:down',
    'auto',
    'lock',
    'mu:drums',
    'mu:bass',
    'mu:chords',
    'mu:lead',
    'next',
    'prev',
    'stop'
  ].forEach(a => opts.push([a, LV_LABEL[a]]));
  NOTEN.forEach((n, i) => opts.push(['key:' + i, 'Key ' + n]));
  S.tracks.forEach((t, i) => opts.push(['mt:' + i, 'Mute ' + t.name]));
  for (let i = 0; i < 16; i++) opts.push(['sc:' + i, 'Scatter ' + (i + 1) + ' (hold)']);
  for (let i = 0; i < 16; i++) {
    const s = el('select', {
      'aria-label': 'Action for pad ' + (i + 1),
      onchange: e => {
        LV.acts[i] = e.target.value;
        saveLive();
        liveRenderPads();
      }
    });
    opts.forEach(([v, l]) => s.append(el('option', { value: v, selected: LV.acts[i] === v }, l)));
    grid.append(
      el(
        'label',
        { class: 'lvf' },
        'Pad ' +
          (i + 1) +
          ((LV.padLayout === 'kbd') === i < 8 ? ' (bottom row)' : ' (top row)') +
          ' · ' +
          (LV.padNotes[i] == null
            ? LV.padLayout === 'kbd' && i >= 8 && LV_TOPFN[i - 8]
              ? LV_TOPFN[i - 8] + ', screen only'
              : 'no note'
            : noteLbl(LV.padNotes[i])),
        s
      )
    );
  }
  b.append(grid);
  b.append(ravenSection(chSel, noteIn));
  b.append(
    el('h4', {}, 'Knobs and scatter'),
    el(
      'div',
      { class: 'lvrow' },
      ...['FILTER', 'MOD', 'FX', 'SOUND'].map((n, i) =>
        el(
          'label',
          { class: 'lvf' },
          n + ' rest',
          el('input', {
            type: 'number',
            min: 0,
            max: 127,
            value: LV.rest[i],
            style: 'width:60px',
            onchange: e => {
              LV.rest[i] = clamp(Math.round(+e.target.value) || 0, 0, 127);
              saveLive();
            }
          })
        )
      ),
      el(
        'label',
        { class: 'lvf' },
        'Reverb rest',
        el('input', {
          type: 'number',
          min: 0,
          max: 127,
          value: LV.revRest | 0,
          style: 'width:60px',
          onchange: e => {
            LV.revRest = clamp(Math.round(+e.target.value) || 0, 0, 127);
            saveLive();
          }
        })
      ),
      el(
        'label',
        { class: 'lvf' },
        'Scatter notes start at',
        noteIn(LV.scBase, v => {
          LV.scBase = clamp(v, 0, 112);
          saveLive();
          liveRenderKnobs();
        })
      )
    ),
    el(
      'p',
      { class: 'hint' },
      'Rest is where a knob returns after the XY pad, a riser or a reset. The manual does not say where each knob rests on the MC-707, so adjust these to match. FILTER at 64 is a common centre. Reverb rest is the reverb send (CC 91) that Wash, Throw and builds return to, so set it to the send level your tracks use.'
    )
  );
  ctlRenderSettings(b, chSel);
}
function liveRenderLanes(b0, force) {
  const inner = $('#lvInner'),
    labels = $('#lvLabels'),
    view = $('#lvView');
  if (!inner) return;
  const W = 16,
    bw = Math.max(24, Math.floor((view.clientWidth || 640) / W));
  const tickf = lvTickF();
  const segs = lvSegs(tickf);
  if (labels.children.length !== 9 || labels.dataset.dev !== DEV) {
    labels.dataset.dev = DEV;
    labels.textContent = '';
    labels.append(el('div', { class: 'lvHdr' }, ''));
    S.tracks.forEach((t, i) =>
      labels.append(
        el(
          'div',
          { class: 'lvLab' + (devOn(i) ? '' : ' devoff'), id: 'lvLab' + i, style: '--c:' + TRACK_COLORS[i] },
          el('i', { class: 'vu', id: 'lvLVu' + i }),
          el('span', {}, t.name),
          (() => {
            const b = el('button', {
              class: 'thClip lvClip',
              id: 'lvClip' + i,
              onclick: ev => {
                ev.stopPropagation();
                const r = ev.currentTarget.getBoundingClientRect();
                showMenu(r.left, r.bottom + 2, [
                  { label: 'Switch track ' + devNum(i) + ' now (until the next scene)', disabled: true },
                  ...cmPickItems(
                    i,
                    CLIPPIN[i] != null ? CLIPPIN[i] : null,
                    k => {
                      if (k < 0) {
                        delete CLIPPIN[i];
                        delete PCLAST[i];
                        const v = lvTop(i);
                        if (v) autoClip(i, v.f, AU.ctx ? AU.ctx.currentTime : 0);
                        return;
                      }
                      ensureAudio();
                      CLIPPIN[i] = k;
                      sendClip(i, k, AU.ctx.currentTime);
                      if (!MIDI.out) toast('Connect the ' + devNm() + ' to switch its clips');
                    },
                    'Back to automatic'
                  )
                ]);
              }
            });
            cmChipFill(b, i, CMNOW[i] != null ? CMNOW[i] : null);
            return b;
          })()
        )
      )
    );
  }
  S.tracks.forEach((t, i) => {
    const l = $('#lvLab' + i);
    if (l) {
      l.children[1].textContent = t.name;
      l.classList.toggle('muted', lvEffMute(i) || t.mute || lvEmute(i));
    }
  });
  inner.textContent = '';
  inner.style.width = (W + 2) * bw + 'px';
  const hdr = el('div', { class: 'lvHdr', style: 'width:' + (W + 2) * bw + 'px' });
  inner.append(hdr);
  const segAt = tk => {
    let s = segs[0];
    for (const x of segs) if (x.tick <= tk) s = x;
    return s;
  };
  let prevSeg = null;
  for (let k = 0; k < W + 2; k++) {
    const tk = (b0 + k) * 32,
      s = segAt(tk);
    const rel = Math.max(0, Math.floor((tk - s.tick) / 32)) % (LV.scenes[s.idx] ? LV.scenes[s.idx].bars : 8);
    hdr.append(
      el(
        'div',
        { class: 'lvBar' + (s !== prevSeg ? ' sc' : ''), style: 'left:' + k * bw + 'px;width:' + bw + 'px' },
        s !== prevSeg || rel === 0 ? (LV.scenes[s.idx] ? LV.scenes[s.idx].name : '') : String(rel + 1)
      )
    );
    prevSeg = s;
  }
  const pendFill = LV.cues.filter(c => c.type === 'fill'),
    pendSw = LV.cues.filter(c => c.type === 'swap');
  S.tracks.forEach((t, ti) => {
    const row = el('div', {
      class: 'lvRow' + (devOn(ti) ? '' : ' devoff'),
      style: 'width:' + (W + 2) * bw + 'px;--c:' + TRACK_COLORS[ti]
    });
    for (let k = 0; k < W + 2; k++) {
      const tk = (b0 + k) * 32,
        s = segAt(tk),
        id = s.ids[ti];
      if (!id) continue;
      const f = facById(id);
      if (!f) continue;
      const ssc = LV.scenes[s.idx],
        scell = ssc && ssc.cells[ti];
      if (scell && scell.play && !lvPlayOn(scell.play, Math.floor((tk - s.tick) / 32) % ssc.bars, ssc.bars)) continue;
      const phase = Math.floor((tk - s.tick) / 32) % f.bars;
      const isFill = ti === 0 && pendFill.some(c => c.tick <= tk && tk < c.tick + 32);
      row.append(
        el(
          'div',
          {
            class: 'lvCell' + (phase === 0 ? ' st' : '') + (isFill ? ' fill' : ''),
            style: 'left:' + k * bw + 'px;width:' + (bw - 1) + 'px',
            title: f.name
          },
          phase === 0 || isFill ? (isFill ? 'Fill' : f.name) : ''
        )
      );
    }
    pendSw.forEach(c => {
      if (c.ids[ti]) {
        const k = Math.floor(c.tick / 32) - b0;
        if (k >= 0 && k < W + 2) {
          const nf = facById(c.ids[ti]);
          row.append(
            el(
              'div',
              {
                class: 'lvSwap',
                style: 'left:' + k * bw + 'px;width:' + (bw - 1) + 'px',
                title: 'Swap to ' + (nf ? nf.name : '')
              },
              '→ ' + (nf ? nf.name : '')
            )
          );
        }
      }
    });
    inner.append(row);
  });
  const cue = LV.cues.filter(c => c.type === 'scene')[0];
  if (cue) {
    const k = Math.floor(cue.tick / 32) - b0;
    if (k >= 0 && k <= W + 1) inner.append(el('div', { class: 'lvLine', style: 'left:' + k * bw + 'px' }));
  }
  lvUI = { b0, bw, ver: LV.ver };
}
export function liveStatus(tickf) {
  const on = lvOn(),
    sg = on ? lvSegs(tickf) : null;
  let sc = LV.scenes[LV.cur],
    s0 = null;
  if (on && sg) {
    s0 = sg.filter(x => x.tick <= tickf).pop() || sg[0];
    sc = LV.scenes[s0.idx];
  }
  const nm = $('#lvNowName');
  if (!nm) return;
  nm.textContent =
    on && LV.flash && LV.flash.start <= tickf && LV.flash.end > tickf
      ? '⚡ Break: ' + LV.flash.name
      : on && sc
        ? sc.name
        : 'Stopped';
  const root = $('#live');
  if (root && sc) root.style.setProperty('--acc', lvScCol(sc.e, 58));
  const barNo = on && sc ? Math.floor((tickf - s0.tick) / 32) % sc.bars : 0;
  $('#lvNowBar').textContent =
    on && sc
      ? 'bar ' +
        (barNo + 1) +
        ' of ' +
        sc.bars +
        (LV.auto ? ' · loop ' + (Math.floor((tickf - s0.tick) / (sc.bars * 32)) + 1) + '/' + LV.autoReps : '')
      : 'Press Start, or hit a scene pad';
  const pg = $('#lvProg');
  if (pg && sc) {
    if (pg.children.length !== sc.bars) {
      pg.textContent = '';
      for (let i = 0; i < sc.bars; i++) pg.append(el('i', {}));
    }
    [...pg.children].forEach((x, i) => {
      x.classList.toggle('done', on && i < barNo);
      x.classList.toggle('now', on && i === barNo);
    });
  }
  const cue = LV.cues.filter(c => c.type === 'scene')[0],
    ns = cue ? LV.scenes[cue.idx] : null;
  $('#lvNextName').textContent = on && ns ? ns.name : on && LV.auto ? 'Auto' : '—';
  const nb = cue ? Math.max(0, Math.ceil((cue.tick - tickf) / 32)) : 0;
  $('#lvNextIn').textContent = on && cue ? 'in ' + nb + ' bar' + (nb === 1 ? '' : 's') : '';
  const kc = LV.cues.filter(c => c.type === 'key')[0];
  $('#lvKeyShow').textContent = NK(LV.key, LV.mode);
  const ks = $('#lvKey');
  if (ks && +ks.value !== LV.key) ks.value = LV.key;
  const ms = $('#lvMode');
  if (ms && ms.value !== LV.mode) ms.value = LV.mode;
  if (lvKeyRecK !== LV.key + LV.mode + LV.style) {
    lvKeyRecK = LV.key + LV.mode + LV.style;
    liveRenderKeyRec();
  }
  $('#lvKeyNext').textContent = kc ? '→ ' + NK(kc.key, kc.mode || LV.mode) + ' next bar' : '';
  $('#lvBpmShow').textContent = String(Math.round(LV.bpm * LV.rate));
  const bi = $('#lvBpm');
  if (bi && document.activeElement !== bi && +bi.value !== LV.bpm) bi.value = LV.bpm;
  $('#lvRateShow').textContent = LV.rate === 1 ? '' : LV.rate === 0.5 ? 'half speed' : 'double speed';
  const ec = LV.cues.filter(c => c.type === 'energy').pop(),
    en = $('#lvEnergy');
  if (en && document.activeElement !== en) {
    en.value = ec ? ec.n : LV.energy;
    $('#lvEnVal').textContent = (ec ? ec.n : LV.energy) + (ec ? ' →' : '');
  }
  LV.scenes.forEach((s, i) => {
    const c = $('#lvCard' + i);
    if (!c) return;
    let isCur = on && sc === s && !(LV.flash && LV.flash.start <= tickf),
      isQ = on && cue && cue.idx === i,
      qn = nb;
    if (lvIsFlash(s)) {
      const fc = LV.cues.find(x => x.type === 'flash' && x.idx === i);
      isCur = !!(on && LV.flash && LV.flash.idx === i && LV.flash.start <= tickf);
      isQ = !!(on && (fc || (LV.flash && LV.flash.idx === i && LV.flash.start > tickf)));
      qn = fc ? Math.max(0, Math.ceil((fc.tick - tickf) / 32)) : 0;
    }
    c.classList.toggle('cur', !!isCur);
    c.classList.toggle('queued', !!isQ);
    const q = $('#lvCardQ' + i);
    if (q)
      q.textContent = isQ
        ? qn
          ? 'in ' + qn + ' bar' + (qn === 1 ? '' : 's')
          : 'next bar'
        : isCur
          ? lvIsFlash(s)
            ? 'FLASH!'
            : 'playing'
          : '';
  });
  for (let i = 0; i < 16; i++) {
    const a = LV.acts[i],
      b = $('#lvPad' + i);
    if (!b) continue;
    let cur = false,
      q = false;
    if (/^s\d$/.test(a)) {
      const ix = +a.slice(1);
      if (lvIsFlash(LV.scenes[ix])) {
        cur = !!(on && LV.flash && LV.flash.idx === ix && LV.flash.start <= tickf);
        q = !cur && LV.cues.some(c => c.type === 'flash' && c.idx === ix);
      } else {
        cur = !!(on && sc === LV.scenes[ix] && !(LV.flash && LV.flash.start <= tickf));
        q = !!(on && cue && cue.idx === ix);
      }
    } else if (a.startsWith('mu:')) cur = on && (MUG[a.slice(3)] || []).every(lvEffMute);
    else if (a.startsWith('mt:')) cur = on && lvEffMute(+a.slice(3));
    else if (a.startsWith('key:')) cur = LV.key === +a.slice(4);
    else if (a.startsWith('sw:')) q = LV.cues.some(c => c.type === 'swap' && c.group === a.slice(3));
    else if (a === 'fill') q = LV.cues.some(c => c.type === 'fill' && !c.auto);
    else if (a === 'brk') {
      cur = !!(on && LV.flash && LV.flash.start <= tickf && LV.flash.end > tickf);
      q = !cur && LV.cues.some(c => c.type === 'brk');
    } else if (a === 'stop') q = LV.cues.some(c => c.type === 'stop');
    else if (a === 'auto') cur = LV.auto;
    else if (a === 'lock') cur = !!LV.lock;
    else if (a.startsWith('rise:') || a === 'bd') cur = !!LV.rise;
    b.classList.toggle('cur', !!cur);
    b.classList.toggle('queued', !!q);
  }
  for (let i = 0; i < 12; i++) {
    const b = $('#lvK' + i);
    if (b) {
      b.classList.toggle('on', LV.key === i);
      b.classList.toggle('queued', !!(kc && kc.key === i));
    }
  }
  for (let i = 0; i < 8; i++) {
    const b = $('#lvM' + i);
    if (b) b.classList.toggle('off', lvEffMute(i) || lvEmute(i));
  }
}
export function liveFrame(tickf) {
  VZ.tickf = tickf;
  const b0 = Math.floor(tickf / 32),
    k = b0 + '|' + LV.ver;
  if (k !== LV.lastKey) {
    LV.lastKey = k;
    liveRenderLanes(b0);
  }
  const inner = $('#lvInner');
  if (inner && lvUI) inner.style.transform = 'translateX(' + -(tickf / 32 - b0) * lvUI.bw + 'px)';
  liveStatus(tickf);
  const beat = Math.floor((tickf % 32) / 8),
    frac = (tickf % 8) / 8;
  for (let i = 0; i < 4; i++) {
    const d = $('#lvBeat' + i);
    if (d) d.classList.toggle('on', i === beat);
  }
  const root = $('#live');
  if (root) root.style.setProperty('--beat', String(Math.pow(1 - frac, 2.2) * (beat === 0 ? 1 : 0.55)));
  const now = AU.ctx ? AU.ctx.currentTime : 0;
  for (let t = 0; t < 8; t++) {
    const p = LV.pulse[t],
      v = now >= p.time ? Math.max(0, 1 - (now - p.time) / 0.28) * p.v : 0;
    const a = $('#lvVu' + t),
      c = $('#lvLVu' + t);
    if (a) a.style.setProperty('--v', v.toFixed(2));
    if (c) c.style.setProperty('--v', v.toFixed(2));
  }
  if (LV.dropTick != null && tickf >= LV.dropTick) {
    LV.dropTick = null;
    if (root) {
      root.classList.remove('drop');
      void root.offsetWidth;
      root.classList.add('drop');
    }
  }
}
