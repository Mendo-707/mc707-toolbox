// The Slime Lab: sound design for ZenCore tones, simple to start and as deep as you want, one screen in
// three depths (after Drift, the OP-XY and Analog Lab's fixed knobs, Synplant's variations and Syntorial's
// step-by-step lessons):
//   Start      a starting sound: a blank tone, or a classic one (acid, Reese, wobble and 808 basses,
//              supersaw and sync leads, a pad, keys, a pluck, brass) built from scratch, in one go or
//              step by step with the reason for each step (Show me how).
//   Shape      the scope (a picture of the tone, zc-lab-scope.js), five knobs that are the same on every
//              sound (Bright, Body, Shape, Motion, Space: zc-lab-knobs.js) and variations to pick by ear
//              (zc-lab-bench.js); the Learn side explains whatever you touch.
//   Fine-tune  the real settings behind it all, a few to a page, and Morph (zc-lab-fine.js).
// Taste keys play the tone on the MC-707 (changes go to it as they are made when the editor is live), and
// Before plays the tone as it was when the lab opened. Every change is one undo step in the editor. Save
// (Ctrl+S) names the tone and keeps it in My sounds, in the Sound browser.
//
// Reads and changes: ZE.snd (through zeBrew and the editor's ctx). Owns: LAB (the lab's state),
// localStorage 'mc707-lab' (blends made, Show me how, the side and page shown).
import { $, el, toast } from '../core/dom.js';
import { ZE, audition, zeBrew, zeCtx, zeLive, zeLoad, zeRender, zeUndo } from './zc-editor.js';
import { MFX_PARAMS, paramOf } from './zc-tone.js';
import { tone } from './zc-starters.js';
import { BLENDS } from './zc-lab-blends.js';
import { brewer, ing } from './zc-lab-moves.js';
import { KNOBS, knob, knobEl, knobWord } from './zc-lab-knobs.js';
import { scopeDraw, scopeEl, scopeStale } from './zc-lab-scope.js';
import { morphBox, varsBox, varsForget } from './zc-lab-bench.js';
import { FINE_PAGES, fineBox, pageName, pageOf } from './zc-lab-fine.js';
import { soundAdd, soundsLoad } from './zc-sounds.js';
import { DEV, DEVS } from '../core/device.js';

const LAB = {
  log: [],
  found: new Set(),
  chain: Promise.resolve(),
  start: 0,
  latch: false,
  guide: null,
  target: null,
  dragN: 0,
  how: false,
  side: 'learn',
  page: 'filter',
  focus: null,
  last: null,
  snap0: null,
  back: {},
  drag: null
};
const STORE = 'mc707-lab';
try {
  const s = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (s) {
    LAB.found = new Set(s.found || []);
    LAB.how = !!s.how;
    if (s.side === 'fine' || s.side === 'learn') LAB.side = s.side;
    if (FINE_PAGES.some(p => p[0] === s.page)) LAB.page = s.page;
  }
} catch (e) {}
const save = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
    localStorage.setItem(
      STORE,
      JSON.stringify({ ...s, found: [...LAB.found], how: LAB.how, side: LAB.side, page: LAB.page })
    );
  } catch (e) {}
};
/* replaceChildren writes null out as text: skip the missing parts */
const put = (box, ...kids) => box && box.replaceChildren(...kids.flat().filter(k => k != null && k !== false));
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
const btn = (label, fn, title, on) =>
  el('button', { type: 'button', class: 'btn sm' + (on ? ' on' : ''), title: title || '', onclick: fn }, label);

/* ---- the partials: the ones switched on (the first when none reads as on); a blend step may pick one ---- */
const onParts = () => {
  const on = [0, 1, 2, 3].filter(i => ZE.snd.v['PMT.PMT' + (i + 1) + '_PTL_SW'] === 1);
  return on.length ? on : [0];
};
function parts() {
  const on = onParts();
  return LAB.target != null && on.includes(LAB.target) ? [LAB.target] : on;
}
const keyName = k => {
  const d = paramOf('tone', k);
  const m = /^([A-Z]+)(\d)?\./.exec(k);
  const part = m && m[2] != null ? ' · P' + (+m[2] + 1) : '';
  const blk = m ? { AENV: 'Amp env ', FENV: 'Filter env ', PENV: 'Pitch env ', LFO: '' }[m[1]] || '' : '';
  const name = (d ? d[0][7] : k).replace(/^(TVA|TVF|Pitch) Env /, '');
  return blk + name + part;
};
const shown = (k, v) => {
  const d = paramOf('tone', k);
  const list = d && d[0][8] && d[0][8].v;
  return String(list ? (list[v] ?? v) : v);
};

/* ---- changes: one undo step per action (a drag is one action), sent at most every 60 ms ---- */
let dragT = 0,
  dragJob = null;
function dragged(tag, fn) {
  dragJob = [tag, fn];
  if (dragT) return;
  dragT = setTimeout(() => {
    dragT = 0;
    const [t, f] = dragJob;
    dragJob = null;
    f(t);
  }, 60);
}
/** Change the tone: vals {key: value} as part of the undo step tag; label says what it was. */
function apply(tag, vals, label, from = null) {
  const before = Object.fromEntries(Object.keys(vals).map(k => [k, ZE.snd.v[k]]));
  const keys = zeBrew(vals, tag);
  if (!keys.length) return [];
  const last = LAB.last;
  if (last && last.tag === tag) {
    last.label = label;
    for (const k of keys) last.ch.some(c => c[0] === k) || last.ch.push([k, before[k], ZE.snd.v[k]]);
    for (const c of last.ch) c[2] = ZE.snd.v[c[0]];
  } else LAB.last = { tag, label, from, ch: keys.map(k => [k, before[k], ZE.snd.v[k]]) };
  draw();
  return keys;
}
const later = fn => (LAB.chain = LAB.chain.then(fn).catch(() => {}));

/* ---- the knobs ---- */
const KN = {};
function knobChange(k, x, final) {
  LAB.drag = final ? null : k.id;
  const tag = 'knob:' + k.id + ':' + LAB.dragN;
  const go = t => {
    const b = brewer(onParts());
    k.set(b, x);
    apply(t, b.out, k.name + ' ' + Math.round(x * 100), k.id);
    if (LAB.focus === k.id) drawLearn();
  };
  if (final) {
    clearTimeout(dragT);
    dragT = 0;
    dragJob = null;
    go(tag);
    LAB.dragN++;
    if (NOTE && LAB.latch) retrigger();
  } else dragged(tag, go);
}
function knobsEl() {
  return el(
    'div',
    { class: 'labKnobs', role: 'group', 'aria-label': 'Knobs' },
    ...KNOBS.map(k => {
      const e = knobEl(k, {
        change: (x, final) => knobChange(k, x, final),
        focus: hover => focusKnob(k.id, hover),
        back: () => LAB.back[k.id] ?? 0.5
      });
      KN[k.id] = e;
      return e;
    })
  );
}
function focusKnob(id, hover) {
  if (hover && LAB.guide && !LAB.guide.away) return;
  if (LAB.focus === id) return;
  LAB.focus = id;
  if (LAB.guide && !hover) LAB.guide.away = true;
  drawLearn();
}

/* ---- the screen ---- */
/** Open the Slime Lab over the ZenCore editor (tones only). */
export function labOpen() {
  const box = $('#zcOv .zcBox');
  if (!ZE.snd || ZE.kind !== 'tone' || !box) return toast('The Slime Lab works on tones: pick a tone track');
  labClose(true);
  const ov = el('div', { id: 'labOv', role: 'dialog', 'aria-label': 'Slime Lab', tabindex: '-1' });
  /* keys the lab doesn't use stop here, so the app's shortcuts behind it don't see them */
  ov.addEventListener('keydown', e => e.stopPropagation());
  ov.append(
    headEl(),
    startEl(),
    el(
      'div',
      { class: 'labBody' },
      el(
        'div',
        { class: 'labMain' },
        el(
          'section',
          { class: 'labPanel labScopeP', 'aria-label': 'Your sound' },
          el('h3', { class: 'labH' }, 'Your sound', el('span', { class: 'labRead', id: 'labRead' })),
          scopeEl()
        ),
        knobsEl(),
        el(
          'section',
          { class: 'labPanel labVarsP', 'aria-label': 'Variations' },
          el('h3', { class: 'labH' }, 'Variations'),
          el('div', { id: 'labVars' })
        ),
        tasteEl()
      ),
      el(
        'aside',
        { class: 'labSide' },
        el(
          'div',
          { class: 'labSideTabs', role: 'tablist' },
          sideTab('learn', 'Learn', 'What the thing you touch does, and the step-by-step guide'),
          sideTab('fine', 'Fine-tune', 'The real settings behind the knobs, page by page')
        ),
        el('div', { class: 'labSideBody', id: 'labSide' })
      )
    )
  );
  box.append(ov);
  LAB.log = [];
  LAB.last = null;
  LAB.focus = null;
  LAB.guide = null;
  LAB.target = null;
  LAB.start = ZE.undo.length;
  LAB.snap0 = { ...ZE.snd.v };
  varsForget();
  setBack();
  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKeyUp, true);
  draw();
  drawSide();
  ov.focus();
  requestAnimationFrame(() => ov.classList.add('in'));
}
function headEl() {
  const before = el(
    'button',
    {
      type: 'button',
      class: 'btn sm labBefore',
      title: 'Hold to hear the sound as it was when the lab opened (key: Q)'
    },
    'Hold: before'
  );
  before.addEventListener('pointerdown', e => {
    e.preventDefault();
    compare(true);
    const up = () => {
      compare(false);
      for (const ev of ['pointerup', 'pointercancel', 'blur']) removeEventListener(ev, up);
    };
    for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, up);
  });
  return el(
    'div',
    { class: 'zcHead labHead' },
    el('div', { class: 'zcTitle' }, el('b', {}, 'Slime Lab'), el('span', { class: 'zcSnd', id: 'labName' })),
    el('span', { class: 'labLive', id: 'labLive' }),
    el(
      'div',
      { class: 'labTools' },
      btn('Undo', undo, 'Take back the last change (Ctrl+Z)'),
      btn('Redo', redo, 'Put it back (Ctrl+Shift+Z)'),
      before,
      btn('Start over', startOver, 'Back to the tone as it was when the lab opened'),
      btn('Save…', saveOpen, 'Name the tone and keep it in My sounds (Ctrl+S)'),
      btn('Back to editor', () => labClose(), 'Back to the editor (Esc)', true)
    )
  );
}
/* the starting sounds, by what they are */
const STARTS = [
  ['Bass', ['acid', 'reese', 'wob', 'sub808']],
  ['Lead', ['trance', 'sync']],
  ['Pad', ['pad']],
  ['Keys', ['keys']],
  ['Pluck', ['pluck']],
  ['Stab', ['brass']]
];
const short = r => r.name.replace(/ (Bass|Lead|Pad|Keys|Pluck|Stab)$/, '');
function startEl() {
  const blend = id => BLENDS.find(r => r.id === id);
  return el(
    'div',
    { class: 'labStart', id: 'labStart' },
    el('span', { class: 'labStartK' }, 'Start from'),
    el(
      'button',
      {
        type: 'button',
        class: 'lsChip blank',
        title: 'A blank tone: one saw wave on partial 1, nothing else set (one undo step)',
        onclick: () => newTone()
      },
      'Blank'
    ),
    ...STARTS.map(([g, ids]) =>
      el(
        'span',
        { class: 'lsGroup' },
        el('small', {}, g),
        ...ids.map(blend).map(r =>
          el(
            'button',
            {
              type: 'button',
              class: 'lsChip' + (LAB.found.has(r.id) ? ' got' : ''),
              'data-id': r.id,
              title: r.about + ' (replaces this tone; Undo brings it back)',
              onclick: () => blendStart(r, !LAB.how)
            },
            short(r)
          )
        )
      )
    ),
    el(
      'label',
      { class: 'lsHow', title: 'Build the starting sound one step at a time, with the reason for each step' },
      el('input', {
        type: 'checkbox',
        checked: LAB.how,
        onchange: e => {
          LAB.how = e.target.checked;
          save();
        }
      }),
      'Show me how'
    )
  );
}
function sideTab(id, label, title) {
  return el(
    'button',
    {
      type: 'button',
      role: 'tab',
      class: 'labSideTab',
      'data-side': id,
      title,
      onclick: () => {
        LAB.side = id;
        save();
        drawSide();
      }
    },
    label
  );
}
const KEYS = { z: 24, x: 36, c: 48, v: 60, b: 72 };
function tasteEl() {
  return el(
    'div',
    { class: 'labTaste', role: 'group', 'aria-label': 'Taste' },
    ...[
      ['C1', 24, 'Sub'],
      ['C2', 36, 'Bass'],
      ['C3', 48, 'Low'],
      ['C4', 60, 'Mid'],
      ['C5', 72, 'High']
    ].map(([n, m, where], i) =>
      el(
        'button',
        {
          type: 'button',
          class: 'labKey',
          'data-n': m,
          title: 'Hold to hear ' + n + ' (key ' + 'ZXCVB'[i] + ')',
          onpointerdown: e => keyDown(m, e.currentTarget)
        },
        el('kbd', {}, 'ZXCVB'[i]),
        el('b', {}, n),
        el('small', {}, where)
      )
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'labLatch' + (LAB.latch ? ' on' : ''),
        id: 'labLatch',
        'aria-pressed': String(LAB.latch),
        title: 'Keep the note playing while you turn knobs (each change plays it again)',
        onclick: latch
      },
      el('i', {}),
      el('b', {}, 'Hold'),
      el('small', {}, 'keep playing')
    )
  );
}

/** Where each knob goes back to on a double-click: where it was when the lab opened or the sound started. */
function setBack() {
  const ps = onParts();
  for (const k of KNOBS) LAB.back[k.id] = k.read(ZE.snd.v, ps);
}
/* everything that follows the tone: name, link, knobs, scope, reading, variations */
function draw() {
  if (!$('#labOv')) return;
  $('#labName').textContent = ZE.snd.v['CMN.NAME'] || 'INIT TONE';
  const live = zeLive(),
    lv = $('#labLive');
  lv.textContent = live ? 'Live: changes go to the MC-707' : 'Not live: changes stay in the editor';
  lv.classList.toggle('on', live);
  const ps = onParts(),
    x = {};
  for (const k of KNOBS) {
    x[k.id] = k.read(ZE.snd.v, ps);
    if (LAB.drag !== k.id && KN[k.id]) KN[k.id].show(x[k.id]);
  }
  const sc = $('#labOv .lsScope');
  scopeStale(sc);
  scopeDraw(sc, ZE.snd.v, ps, tasteAt());
  $('#labRead').textContent = reading(x);
  drawVars();
}
/* the tone in a few words, from the knobs */
function reading(x) {
  const v = ZE.snd.v,
    words = [];
  for (const k of KNOBS) {
    const w = knobWord(k, x[k.id]);
    if (w !== 'Some' && w !== 'Held') words.push(w.toLowerCase());
  }
  const role =
    v['CMN.OCTAVE'] < 0
      ? 'a bass'
      : x.shape < 0.35
        ? 'a pad or a swell'
        : x.shape > 0.7
          ? 'a pluck or a stab'
          : v['CMN.MONO_POLY'] === 0
            ? 'a lead line'
            : 'keys or chords';
  return '· ' + (words.length ? words.join(', ') : 'plain') + ': ' + role;
}
const VCTX = {
  apply: (tag, vals, label) => apply(tag, vals, label),
  parts: () => onParts(),
  keyName: k => keyName(k),
  redraw: () => drawVars(),
  hear: () => NOTE && LAB.latch && retrigger(),
  tag: () => 'bench:' + LAB.dragN++,
  dragN: () => LAB.dragN,
  dragged: (tag, fn) => dragged(tag, fn),
  dragDone: () => LAB.dragN++
};
function drawVars() {
  put($('#labVars'), varsBox(VCTX));
}
/* the side: Learn or Fine-tune */
function drawSide() {
  document
    .querySelectorAll('#labOv .labSideTab')
    .forEach(b => b.setAttribute('aria-selected', String(b.dataset.side === LAB.side)));
  if (LAB.side === 'fine') drawFine();
  else drawLearn();
}
function drawFine() {
  const box = $('#labSide');
  if (!box || LAB.side !== 'fine') return;
  const scroll = box.querySelector('.lfPage') ? box.querySelector('.lfPage').scrollTop : 0;
  const c = zeCtx(),
    ctx = {
      ...c,
      part: ZE.part,
      set: (k, v, final) => {
        c.set(k, v, final);
        if (final) after();
        else liveScope();
      },
      commit: () => (c.commit(), after()),
      mfxType: (t, vals) => (c.mfxType(t, vals), after())
    };
  put(
    box,
    fineBox(ctx, {
      page: LAB.page,
      go: id => ((LAB.page = id), save(), drawFine()),
      redraw: () => drawFine(),
      editor: tab => ((ZE.tab = tab), labClose()),
      morph: () => morphBox(VCTX)
    })
  );
  const pg = box.querySelector('.lfPage');
  if (pg) pg.scrollTop = scroll;
}
/* after a Fine-tune change: the knobs and scope follow, and the page redraws for settings that depend on it */
function after() {
  draw();
  drawFine();
  if (NOTE && LAB.latch) retrigger();
}
let liveT = 0;
function liveScope() {
  if (liveT) return;
  liveT = requestAnimationFrame(() => {
    liveT = 0;
    draw();
  });
}

/* ---- Learn: the idea behind what you touch, the welcome, or the guide ---- */
function drawLearn() {
  const box = $('#labSide');
  if (!box || LAB.side !== 'learn') return;
  if (LAB.guide && !LAB.guide.away) return drawGuide(box);
  const k = knob(LAB.focus);
  const back = LAB.guide
    ? btn('◂ Back to ' + LAB.guide.r.name, () => ((LAB.guide.away = false), drawLearn()), 'Back to the guide')
    : null;
  if (!k) return put(box, back, welcome());
  const last = LAB.last && LAB.last.from === k.id ? LAB.last : null;
  box.style.setProperty('--kc', k.c);
  put(
    box,
    back,
    el(
      'div',
      { class: 'llTop' },
      el('i', { class: 'llDot' }),
      el('b', {}, k.name),
      el('small', {}, k.ends.join(' ↔ '))
    ),
    el('p', {}, k.what),
    el('p', {}, el('span', { class: 'llK' }, 'Hear it in'), k.hear),
    el('p', {}, el('span', { class: 'llK' }, 'Tip'), k.tip),
    last
      ? changes('What it just changed', last.ch, 10)
      : el('p', { class: 'hint' }, 'Turn it to see exactly which settings it changes.'),
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm llGoFine',
        onclick: () => {
          LAB.side = 'fine';
          LAB.page = k.page;
          save();
          drawSide();
        }
      },
      'Fine-tune the settings behind it: ' + pageName(k.page) + ' ›'
    )
  );
}
function welcome() {
  return el(
    'div',
    { class: 'llWelcome' },
    el('h4', {}, 'Three ways in'),
    el(
      'ol',
      {},
      el(
        'li',
        {},
        el('b', {}, 'Start from a sound'),
        ' above: a blank tone, or a classic built from scratch. Tick ',
        el('i', {}, 'Show me how'),
        ' to build it step by step and learn why.'
      ),
      el(
        'li',
        {},
        el('b', {}, 'Turn the five knobs'),
        '. They are the same on every sound. Touch one and this panel explains it.'
      ),
      el('li', {}, el('b', {}, 'Grow variations'), ' and pick the one you like by ear, then grow again from it.')
    ),
    el(
      'p',
      { class: 'hint' },
      'Hold a Taste key (Z X C V B) to hear it, or Hold to keep a note playing. Fine-tune has every setting behind the knobs, a page at a time. Hold: before plays the sound you started with.'
    )
  );
}
/* a list of changed settings: name, before, after (and which Fine-tune page has it) */
function changes(title, ch, max) {
  return el(
    'div',
    { class: 'llDid' },
    el('span', { class: 'llK' }, title),
    ...ch
      .slice(0, max)
      .map(([k, a, b]) =>
        el(
          'div',
          { class: 'llCh', title: pageOf(k) ? 'In Fine-tune › ' + pageName(pageOf(k)) : 'In the editor' },
          el('span', {}, keyName(k)),
          el('s', {}, shown(k, a)),
          el('b', {}, shown(k, b))
        )
      ),
    ch.length > max ? el('small', { class: 'hint' }, '…and ' + (ch.length - max) + ' more') : null
  );
}

/* ---- undo, redo, start over, before ---- */
function undo() {
  later(() => {
    if (!ZE.undo.length) return toast('Nothing to undo');
    zeUndo();
    const x = LAB.log.length && LAB.log[LAB.log.length - 1].n === ZE.undo.length + 1 ? LAB.log.pop() : null;
    if (x && LAB.guide) {
      if (x.slate) LAB.guide = null;
      else LAB.guide.i = LAB.guide.done = Math.max(0, LAB.guide.done - 1);
    }
    LAB.last = null;
    draw();
    drawSide();
  });
}
function redo() {
  later(() => {
    if (!ZE.redo.length) return;
    zeUndo(true);
    draw();
    drawSide();
  });
}
function startOver() {
  later(() => {
    const n = ZE.undo.length - LAB.start;
    if (n <= 0) return toast('Nothing changed yet');
    for (let i = 0; i < n; i++) zeUndo();
    LAB.log = [];
    LAB.guide = null;
    LAB.last = null;
    varsForget();
    draw();
    drawSide();
    toast('Back to the tone as it was when the lab opened');
  });
}
/* Before: the tone as it was when the lab opened, while held (taken back on release, redo kept) */
const CMP = { on: false, redo: null };
function compare(on) {
  if (on === CMP.on || !LAB.snap0) return;
  if (on) {
    const vals = {};
    for (const k in LAB.snap0)
      if (LAB.snap0[k] !== ZE.snd.v[k] && typeof LAB.snap0[k] === 'number') vals[k] = LAB.snap0[k];
    if (!Object.keys(vals).length) return toast('No change yet: this is the sound you started with');
    CMP.redo = ZE.redo.slice();
    zeBrew(vals, 'before:' + LAB.dragN++);
    CMP.on = true;
  } else {
    CMP.on = false;
    zeUndo();
    ZE.redo = CMP.redo;
  }
  $('#labOv .labBefore')?.classList.toggle('down', on);
  draw();
  if (NOTE) retrigger();
  else if (on) noteOn(48, null);
}

/* ---- a blank tone, and the starting sounds (blends): a run of lab moves, each with its reason ---- */
/** A blank tone: a saw wave on partial 1 (one undo step). Resolves once it is in. */
function newTone(why = true, name = 'INIT TONE') {
  noteOffIfHeld();
  LAB.target = null;
  return later(async () => {
    if (!$('#labOv')) return;
    await zeLoad(tone(name, () => {}));
    LAB.log.push({ n: ZE.undo.length, slate: true, ch: [] });
    LAB.last = null;
    varsForget();
    setBack();
    draw();
    drawSide();
    if (why) toast('A blank tone: one saw wave on partial 1 (Undo brings the old one back)');
  });
}
/* a step's values, as its settings would be set by hand on the partials it works on */
const dialKeys = k => {
  if (/^(CMN|SCMN|SPMT|PMT|MFX)\./.test(k) || /^[A-Z]+\d\./.test(k)) return [k];
  const [blk, id] = k.split('.');
  return parts().map(i => blk + i + '.' + id);
};
function dialVals(dial) {
  const out = {};
  for (const [k, x] of Object.entries(dial)) {
    if (/^mfx\d+$/.test(k)) out[MFX_PARAMS[+k.slice(3)]] = x;
    else for (const kk of dialKeys(k)) if (paramOf('tone', kk)) out[kk] = x;
  }
  return out;
}
/** Start a starting sound: a blank tone, then (auto) every step, or (guided) one per Next. */
function blendStart(r, auto) {
  LAB.guide = { r, i: 0, done: 0, auto, away: false };
  LAB.focus = null;
  if (!auto) {
    LAB.side = 'learn';
    drawSide();
  }
  document.querySelectorAll('#labOv .lsChip').forEach(c => c.classList.toggle('on', c.dataset.id === r.id));
  newTone(false, r.name.toUpperCase().slice(0, 16));
  drawLearn();
  if (auto) runSteps(r, 0);
  return LAB.chain;
}
/* one step (resolves once it is in the tone): a move at an amount and settings, on the partials it names */
function blendStep(r, i) {
  const g = LAB.guide;
  if (!g || g.r !== r || i !== g.i || i >= r.steps.length) return Promise.resolve();
  const st = r.steps[i],
    p = ing(st.ing);
  g.i = i + 1;
  g.away = false;
  drawLearn();
  return later(async () => {
    if (!$('#labOv')) return;
    LAB.target = st.on ?? null;
    const tag = 'blend:' + r.id + ':' + i + ':' + LAB.dragN++,
      ch = [];
    const go = vals => {
      const before = Object.fromEntries(Object.keys(vals).map(k => [k, ZE.snd.v[k]]));
      for (const k of zeBrew(vals, tag)) {
        const c = ch.find(x => x[0] === k);
        if (c) c[2] = ZE.snd.v[k];
        else ch.push([k, before[k], ZE.snd.v[k]]);
      }
    };
    if (st.amt) {
      const b = brewer(parts());
      p.brew(b, st.amt / 10);
      go(b.out);
    }
    /* the settings after the move, so a new layer's partial counts as on */
    go(dialVals(st.dial));
    LAB.target = null;
    LAB.log.push({ n: ZE.undo.length, guide: true, ch, title: st.title });
    g.done = i + 1;
    if (g.done >= r.steps.length) made(r);
    setBack();
    draw();
    drawLearn();
    if (NOTE && LAB.latch) retrigger();
  });
}
function made(r) {
  LAB.found.add(r.id);
  save();
  document.querySelectorAll('#labOv .lsChip').forEach(c => c.classList.toggle('got', LAB.found.has(c.dataset.id)));
  if (LAB.guide && LAB.guide.auto && !LAB.guide.finish) {
    toast(r.name + ' is ready: taste it on ' + noteName(r.note) + ', then shape it with the knobs');
    LAB.guide = null;
    drawLearn();
  }
}
const noteName = n => 'C' + (n / 12 - 1);
/* the steps from i on, one after another */
async function runSteps(r, from) {
  await LAB.chain;
  for (let i = from; i < r.steps.length; i++) {
    if (!LAB.guide || LAB.guide.r !== r || !$('#labOv')) return;
    await wait(still() || LAB.guide.auto ? 0 : 260);
    await blendStep(r, i);
  }
}
/* what a step sets, page by page in Fine-tune, so it can be done by hand */
function stepHow(ch) {
  const by = {};
  for (const [k, , b] of ch) {
    const pg = pageName(pageOf(k));
    (by[pg] = by[pg] || []).push(keyName(k) + ' ' + shown(k, b));
  }
  return Object.entries(by).map(([pg, xs]) => el('div', {}, el('b', {}, pg + ': '), xs.join(', ')));
}
/* the Learn side while a sound is built step by step: its steps, this step's reason and what it set */
function drawGuide(box) {
  const g = LAB.guide,
    r = g.r,
    done = g.done >= r.steps.length,
    busy = g.i > g.done;
  const last = [...LAB.log].reverse().find(x => x.guide);
  const step = g.done ? r.steps[g.done - 1] : null;
  box.style.removeProperty('--kc');
  put(
    box,
    el('div', { class: 'llTop' }, el('i', { class: 'llDot' }), el('b', {}, r.name), el('small', {}, 'step by step')),
    el('p', { class: 'llAbout' }, r.about),
    el(
      'ol',
      { class: 'lgSteps' },
      el('li', { class: LAB.log.some(x => x.slate) ? 'done' : 'now' }, 'Blank tone'),
      ...r.steps.map((st, i) => el('li', { class: i < g.done ? 'done' : i === g.done ? 'next' : '' }, st.title))
    ),
    step
      ? el(
          'div',
          { class: 'llStep' },
          el('span', { class: 'llK' }, 'Step ' + (g.done + 1) + ' of ' + (r.steps.length + 1) + ' · ' + step.title),
          el('p', {}, step.why),
          last && last.ch.length
            ? el(
                'div',
                { class: 'llHow' },
                el('span', { class: 'llK' }, 'To do it by hand, in Fine-tune'),
                ...stepHow(last.ch)
              )
            : null
        )
      : el(
          'p',
          { class: 'hint' },
          'Every starting sound begins from a blank tone: one saw wave on partial 1, so it sounds the same whatever was loaded. Each step is a few settings you could set in Fine-tune yourself; the guide shows which.'
        ),
    el(
      'div',
      { class: 'llGo' },
      btn('Taste ' + noteName(r.note), () => {}, 'Hold to hear it'),
      done
        ? btn('Done', () => ((LAB.guide = null), drawLearn()), 'Close the guide', true)
        : g.auto || busy
          ? el('span', { class: 'hint' }, 'Building…')
          : btn('Next: ' + r.steps[g.i].title, () => blendStep(r, g.i), 'Take the next step', true),
      done || g.auto ? null : btn('Finish', () => finish(r), 'Do the remaining steps in one go')
    )
  );
  box.querySelector('.llGo .btn').addEventListener('pointerdown', e => keyDown(r.note, e.currentTarget));
}
function finish(r) {
  const g = LAB.guide;
  if (!g) return;
  g.auto = true;
  g.finish = true;
  g.away = false;
  drawLearn();
  runSteps(r, g.i);
}

/* ---- saving: the tone takes the name (on the MC-707 too, when live) and goes into My sounds ---- */
function saveOpen() {
  if ($('#labSave')) return $('#labSave input').focus();
  const at = [...document.querySelectorAll('#labOv .labTools button')].find(b => b.textContent === 'Save…');
  const name = el('input', {
    type: 'text',
    maxlength: 16,
    value: (ZE.snd.v['CMN.NAME'] || '').trim(),
    placeholder: 'Name (up to 16 letters)',
    'aria-label': 'Name'
  });
  const shut = () => box.remove();
  const go = async () => {
    const n = name.value.trim() || 'My Tone';
    shut();
    if (n !== (ZE.snd.v['CMN.NAME'] || '').trim()) {
      const c = zeCtx();
      c.set('CMN.NAME', n, true);
      after();
    }
    await soundsLoad();
    const e = await soundAdd(ZE.snd, { name: n, src: 'mine', mine: true });
    toast(e ? 'Saved ' + n + ' to My sounds' : n + ' is already in My sounds, just as it is');
  };
  const box = el(
    'div',
    {
      id: 'labSave',
      class: 'labSave',
      onkeydown: e => {
        if (e.key === 'Enter') (e.preventDefault(), e.stopPropagation(), go());
        else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), shut());
      }
    },
    el('b', {}, 'Save this tone'),
    name,
    el(
      'p',
      { class: 'hint' },
      'It goes into My sounds (the Sound browser), to use on any track or song. To keep it in this project on the ' +
        DEVS[DEV].name +
        ' too, save the project there.'
    ),
    el('div', { class: 'labSaveBtns' }, btn('Cancel', shut), btn('Save', go, 'Save to My sounds', true))
  );
  (at ? at.parentElement : $('#labOv')).append(box);
  name.focus();
  name.select();
}

/* ---- keys ---- */
function onKey(e) {
  if (!$('#labOv')) return removeEventListener('keydown', onKey, true);
  const typing =
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
  const k = e.key.toLowerCase(),
    mod = e.ctrlKey || e.metaKey || e.altKey;
  const stop = () => (e.stopPropagation(), e.preventDefault());
  if (e.key === 'Escape') {
    stop();
    if ($('#labSave')) $('#labSave').remove();
    else labClose();
  } else if ((e.ctrlKey || e.metaKey) && k === 's') {
    stop();
    saveOpen();
  } else if ((e.ctrlKey || e.metaKey) && k === 'z') {
    if (typing) return;
    stop();
    if (e.shiftKey) redo();
    else undo();
  } else if (typing || mod) return;
  else if (k in KEYS) {
    stop();
    if (!e.repeat) keyDown(KEYS[k], $('#labOv .labKey[data-n="' + KEYS[k] + '"]'), true);
  } else if (k === 'q') {
    stop();
    if (!e.repeat) compare(true);
  } else if (!$('#labOv').contains(e.target)) e.stopPropagation();
}
function onKeyUp(e) {
  if (!$('#labOv')) return removeEventListener('keyup', onKeyUp, true);
  const k = e.key.toLowerCase();
  if (k in KEYS && !LAB.latch && NOTE && NOTE.n === KEYS[k]) noteOff();
  if (k === 'q') compare(false);
}
/** Close the lab and show the editor with the changes. */
export function labClose(quiet) {
  const ov = $('#labOv');
  removeEventListener('keydown', onKey, true);
  removeEventListener('keyup', onKeyUp, true);
  if (!ov) return;
  if (CMP.on) compare(false);
  noteOff();
  LAB.latch = false;
  ov.remove();
  cancelAnimationFrame(TASTE.raf);
  TASTE.raf = 0;
  if (!quiet) zeRender();
}
function noteOffIfHeld() {
  if (NOTE && !LAB.latch) noteOff();
}

/* ---- tasting: a note plays and the scope follows it ---- */
let NOTE = null; /* {n, off, key} */
const TASTE = { t0: 0, up: null, raf: 0, last: 0 };
function tasteAt() {
  if (!TASTE.t0) return null;
  const now = performance.now();
  return { t: (now - TASTE.t0) / 1000, r: TASTE.up == null ? null : (now - TASTE.up) / 1000 };
}
function tasteFrame(now) {
  const sc = document.querySelector('#labOv .lsScope');
  if (!sc || !TASTE.t0) return (TASTE.raf = 0);
  TASTE.raf = requestAnimationFrame(tasteFrame);
  if (now - TASTE.last < 33) return;
  TASTE.last = now;
  const at = tasteAt();
  /* the note has died away: one last still picture */
  if (at.r != null && at.r > 8) {
    TASTE.t0 = 0;
    scopeDraw(sc, ZE.snd.v, onParts(), null);
    return;
  }
  scopeDraw(sc, ZE.snd.v, onParts(), still() ? null : at);
}
function noteOn(n, key) {
  noteOff();
  const off = audition(n, true);
  NOTE = { n, off, key };
  if (key) key.classList.add('down');
  TASTE.t0 = performance.now();
  TASTE.up = null;
  if (!TASTE.raf) TASTE.raf = requestAnimationFrame(tasteFrame);
}
function noteOff() {
  if (!NOTE) return;
  const x = NOTE;
  NOTE = null;
  try {
    x.off();
  } catch (e) {}
  if (x.key) x.key.classList.remove('down');
  if (TASTE.t0) TASTE.up = performance.now();
}
function retrigger() {
  const { n, key } = NOTE;
  noteOn(n, key);
}
/* a Taste key (pointer, or Z-B on the keyboard): held, or with Hold on, on until pressed again */
function keyDown(n, key, fromKeyboard) {
  if (LAB.latch && NOTE && NOTE.n === n) return noteOff();
  noteOn(n, key);
  if (LAB.latch || fromKeyboard) return;
  const up = () => {
    if (NOTE && NOTE.n === n && !LAB.latch) noteOff();
    for (const ev of ['pointerup', 'pointercancel', 'blur']) removeEventListener(ev, up);
  };
  for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, up);
}
function latch() {
  LAB.latch = !LAB.latch;
  const b = $('#labLatch');
  if (b) {
    b.classList.toggle('on', LAB.latch);
    b.setAttribute('aria-pressed', String(LAB.latch));
  }
  if (!LAB.latch) noteOff();
  else if (!NOTE) noteOn(48, $('#labOv .labKey[data-n="48"]'));
}
