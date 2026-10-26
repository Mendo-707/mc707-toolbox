// The Slime Lab's bench, under the slime: three ways of working borrowed from sound-design tools.
//
//   Mutate     (after Synplant's seeds and branches) sprouts four variations of the tone, each a small
//              random step on its "genes" (oscillator, filter, amp, motion, pitch, space, effect), with a
//              strength and locks for the genes to keep. Click one to hear it; sprout again from it.
//   Morph      (after A/B snapshots and morphing in Pigments and friends) keeps two snapshots, A and B,
//              and slides the tone between them, or flips between them to compare.
//   Ear test   (after Syntorial's ear training) mixes in a hidden ingredient: flip before and after,
//              taste, and guess which one it was.
//
// Every change goes through the lab's apply (one undo step per action). Reads: ZE.snd. Owns: BENCH,
// localStorage 'mc707-lab-ear' (the ear test score).
import { el, toast } from '../core/dom.js';
import { ZE } from './zc-editor.js';
import { MFX_PARAMS, paramOf } from './zc-tone.js';
import { mfxParams } from './zc-mfx.js';

const BENCH = {
  tab: 'mutate',
  str: 4,
  locks: new Set(),
  kids: [],
  parent: null,
  pick: -1,
  gen: 0,
  A: null,
  B: null,
  t: 0,
  ear: null
};
const EAR_KEY = 'mc707-lab-ear';
let SCORE = { right: 0, tries: 0, streak: 0 };
try {
  SCORE = { ...SCORE, ...JSON.parse(localStorage.getItem(EAR_KEY) || '{}') };
} catch (e) {}
const saveScore = () => {
  try {
    localStorage.setItem(EAR_KEY, JSON.stringify(SCORE));
  } catch (e) {}
};

/* ---- the genes: per partial [block.id, how far it may move as a share of its range] ---- */
const GENES = {
  Oscillator: [
    ['SPTL.PW', 0.25],
    ['SPTL.PWM_DEPTH', 0.2],
    ['SPTL.SSAW_DETUNE', 0.2],
    ['SPTL.FAT', 0.25],
    ['PTL.PIT_FINE', 0.08]
  ],
  Filter: [
    ['PTL.CUTOFF', 0.22],
    ['PTL.RESO', 0.2],
    ['PTL.CUTOFF_KF', 0.15],
    ['FENV.DEPTH', 0.18],
    ['FENV.T1', 0.12],
    ['FENV.T2', 0.18],
    ['FENV.L2', 0.2],
    ['FENV.L3', 0.2]
  ],
  Amp: [
    ['AENV.T1', 0.12],
    ['AENV.T2', 0.18],
    ['AENV.L2', 0.15],
    ['AENV.T3', 0.15],
    ['AENV.L3', 0.15],
    ['AENV.T4', 0.18]
  ],
  Motion: [
    ['LFO.LFO1_RATE', 0.15],
    ['LFO.LFO2_RATE', 0.15],
    ['LFO.LFO1_PIT_DEPTH', 0.04],
    ['LFO.LFO2_TVF_DEPTH', 0.2],
    ['LFO.LFO1_TVA_DEPTH', 0.12],
    ['LFO.LFO2_PAN_DEPTH', 0.2]
  ],
  Pitch: [
    ['PENV.DEPTH', 0.06],
    ['PENV.T1', 0.15],
    ['PTL.PIT_RND', 0.01],
    ['CMN.PORTA_TIME', 0.15],
    ['CMN.ANALOG_FEEL', 0.25]
  ],
  Space: [
    ['PTL.REV_SEND', 0.25],
    ['PTL.CHO_SEND', 0.25],
    ['PTL.PAN_RND', 0.2],
    ['PTL.STEREO_DETN', 0.15]
  ],
  Effect: 'mfx'
};
const GENE_NAMES = Object.keys(GENES);
const num = (v, k) => {
  const x = v[k];
  if (typeof x === 'number') return x;
  const d = paramOf('tone', k);
  return d ? d[0][5] : 0;
};
/* a normal-ish random number around 0 */
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
/** A variation of the tone: {key: value} for the genes that moved. */
function mutate(ctx, strength) {
  const v = ZE.snd.v,
    out = {},
    s = strength / 10;
  for (const g of GENE_NAMES) {
    if (BENCH.locks.has(g)) continue;
    if (GENES[g] === 'mfx') {
      const sp = mfxParams(num(v, 'MFX.mfxType'));
      sp.forEach((p, i) => {
        if (p.kind !== 'R' || Math.random() > 0.5) return;
        const k = MFX_PARAMS[i],
          span = p.hi - p.lo;
        out[k] = Math.round(Math.max(p.lo, Math.min(p.hi, num(v, k) + gauss() * span * 0.2 * s * 2)));
      });
      continue;
    }
    for (const [key, scale] of GENES[g]) {
      const [blk, id] = key.split('.');
      const keys = blk === 'CMN' ? [key] : ctx.parts().map(i => blk + i + '.' + id);
      for (const k of keys) {
        const d = paramOf('tone', k);
        if (!d) continue;
        const cur = num(v, k);
        /* settings that are off move less often, so a variation stays recognisable */
        if (Math.random() > (cur === 0 ? 0.25 : 0.55)) continue;
        const span = d[0][4] - d[0][3];
        out[k] = Math.round(Math.max(d[0][3], Math.min(d[0][4], cur + gauss() * span * scale * s * 2)));
      }
    }
  }
  return Object.fromEntries(Object.entries(out).filter(([k, x]) => x !== num(v, k)));
}
/* the biggest moves of a variation, in a few words */
function gist(ctx, vals, from) {
  return Object.keys(vals)
    .map(k => {
      const d = paramOf('tone', k);
      const span = d ? d[0][4] - d[0][3] : 127;
      return [k, (vals[k] - num(from, k)) / span];
    })
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2)
    .map(([k, dv]) => short(ctx, k) + (dv > 0 ? ' ↑' : ' ↓'))
    .join(' · ');
}
const short = (ctx, k) => {
  if (k.startsWith('MFX.')) {
    const i = MFX_PARAMS.indexOf(k),
      p = mfxParams(num(ZE.snd.v, 'MFX.mfxType'))[i];
    return p ? p.name : 'effect';
  }
  return ctx
    .keyName(k)
    .replace(/ · P\d$/, '')
    .replace(/^(TVF|TVA) /, '')
    .replace('Cutoff Frequency', 'cutoff')
    .replace('Resonance', 'reso');
};

/* a small static slime for a variation, its shape from the values (stretch, lumps) and a seed */
function mini(color, seed, wide = 0.5, lumpy = 0.5) {
  let r = seed * 9301 + 49297;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const id = 'lsm' + Math.round(seed * 1000) + '_' + Math.round(Math.random() * 1e6);
  const lobes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.6,
      d = 9 + lumpy * 8 + rnd() * 4;
    return `<circle cx="${30 + Math.cos(a) * d * (1 + wide * 0.4)}" cy="${30 + Math.sin(a) * d * 0.85}" r="${8 + rnd() * 5}"/>`;
  }).join('');
  return (
    `<svg viewBox="0 0 60 56" class="lbMini" aria-hidden="true"><defs><filter id="${id}"><feGaussianBlur stdDeviation="3.4"/>` +
    `<feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9"/></filter></defs>` +
    `<ellipse cx="30" cy="50" rx="${18 + wide * 6}" ry="3" fill="#000" opacity=".55"/>` +
    `<g filter="url(#${id})" fill="${color}"><circle cx="30" cy="30" r="15"/>${lobes}<circle cx="30" cy="42" r="10"/></g>` +
    `<ellipse cx="23" cy="22" rx="5" ry="2.4" fill="#fff" opacity=".45" transform="rotate(-25 23 22)"/></svg>`
  );
}
const KID_COLS = ['#39ff7a', '#5ef2d6', '#b4ff5e', '#7af0ff'];

/* ---- the bench ---- */
/**
 * The bench element, redrawn by the lab.
 * @param {object} ctx  the lab: apply(tag, vals, id, label), tag(), parts(), keyName(k), shown(k, v),
 *   ingredients() [{id, name}], mixQuiet(id, amount, tag) -> keys, select(id), redraw()
 */
export function benchBox(ctx) {
  const tab = (id, label, title) =>
    el(
      'button',
      {
        type: 'button',
        class: 'lbTab' + (BENCH.tab === id ? ' on' : ''),
        title,
        onclick: () => ((BENCH.tab = id), ctx.redraw())
      },
      label
    );
  const body = BENCH.tab === 'mutate' ? mutateBox(ctx) : BENCH.tab === 'morph' ? morphBox(ctx) : earBox(ctx);
  return el(
    'fieldset',
    { class: 'zcG labBench' },
    el('legend', {}, 'Bench'),
    el(
      'div',
      { class: 'lbTabs' },
      tab('mutate', 'Mutate', 'Sprout four variations of the tone and pick the one you like'),
      tab('morph', 'Morph A ↔ B', 'Keep two snapshots and slide between them'),
      tab('ear', 'Ear test', 'Guess the hidden ingredient by ear')
    ),
    body
  );
}

/* hear a variation: the tone becomes it (one undo step for the whole generation); -1 is the parent */
function pickKid(ctx, i) {
  const tag = 'mutate:' + BENCH.gen;
  const back = Object.fromEntries(
    [...new Set(BENCH.kids.flatMap(k => Object.keys(k.vals)))].map(k => [k, num(BENCH.parent, k)])
  );
  const vals = i < 0 ? back : { ...back, ...BENCH.kids[i].vals };
  ctx.apply(tag, vals, 'drift', i < 0 ? 'Mutate: back to the parent' : 'Mutate: variation ' + (i + 1));
  BENCH.pick = i;
  ctx.redraw();
}
/**
 * Something dropped on the slime from the bench: a variation ('kid:n') gloops in and the tone becomes it.
 * Resolves true when it was the bench's.
 */
export async function benchDrop(ctx, data) {
  const m = /^kid:(-?\d)$/.exec(data || '');
  if (!m || !BENCH.kids.length) return false;
  const i = +m[1];
  await ctx.gloop(i < 0 ? '#9aa59e' : BENCH.kids[i].col);
  pickKid(ctx, i);
  return true;
}

/* Mutate: four variations, each a small step from the parent */
function mutateBox(ctx) {
  const sprout = () => {
    BENCH.parent = { ...ZE.snd.v };
    BENCH.gen++;
    BENCH.pick = -1;
    BENCH.kids = Array.from({ length: 4 }, (_, i) => {
      const vals = mutate(ctx, BENCH.str);
      return { vals, gist: gist(ctx, vals, BENCH.parent), seed: Math.random(), col: KID_COLS[i] };
    });
    ctx.redraw();
  };
  const pick = i => pickKid(ctx, i);
  const lock = g =>
    el(
      'button',
      {
        type: 'button',
        class: 'lbLock' + (BENCH.locks.has(g) ? ' on' : ''),
        title: BENCH.locks.has(g) ? g + ' is locked: variations keep it' : 'Lock ' + g + ' so variations keep it',
        onclick: () => {
          if (BENCH.locks.has(g)) BENCH.locks.delete(g);
          else BENCH.locks.add(g);
          ctx.redraw();
        }
      },
      (BENCH.locks.has(g) ? '🔒 ' : '') + g
    );
  const strength = el('input', {
    type: 'range',
    min: 1,
    max: 10,
    value: BENCH.str,
    'aria-label': 'How far the variations go',
    oninput: e => {
      BENCH.str = +e.target.value;
      e.target.parentNode.querySelector('.zcV').textContent = strLabel();
    }
  });
  const strLabel = () => (BENCH.str <= 3 ? 'Subtle' : BENCH.str <= 6 ? 'Medium' : 'Wild') + ' · ' + BENCH.str;
  const kids = BENCH.kids.length
    ? el(
        'div',
        { class: 'lbKids' },
        kidBtn(-1, 'Parent', 'As it was', '#9aa59e', 0.42),
        ...BENCH.kids.map((k, i) => kidBtn(i, 'Variation ' + (i + 1), k.gist || 'tiny change', k.col, k.seed))
      )
    : el(
        'p',
        { class: 'hint' },
        'Sprout four variations of the tone. Click one to hear it, keep the one you like, and sprout again from it: sound design by breeding.'
      );
  function kidBtn(i, name, what, col, seed) {
    const b = el(
      'button',
      {
        type: 'button',
        class: 'lbKid' + (BENCH.pick === i ? ' on' : ''),
        draggable: 'true',
        title:
          (i < 0 ? 'Back to the tone you sprouted from' : 'Hear this variation: ' + what) +
          '. Click, or drag it onto the slime.',
        onclick: () => pick(i),
        ondragstart: e => {
          e.dataTransfer.setData('text/plain', 'kid:' + i);
          e.dataTransfer.effectAllowed = 'copy';
          const m = e.currentTarget.querySelector('.lbMiniW');
          if (m && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(m, 23, 21);
        }
      },
      el('span', { class: 'lbMiniW' }),
      el('b', {}, name),
      el('small', {}, what)
    );
    b.firstChild.innerHTML = mini(col, seed, Math.random(), Math.random());
    return b;
  }
  return el(
    'div',
    { class: 'lbBody' },
    el(
      'div',
      { class: 'lbRow' },
      el(
        'label',
        { class: 'zcC lbStr' },
        el('span', { class: 'zcL' }, 'How far'),
        el('span', { class: 'zcV' }, strLabel()),
        strength
      ),
      el(
        'button',
        { type: 'button', class: 'btn on', onclick: sprout, title: 'Four new variations of the tone as it is now' },
        BENCH.kids.length ? 'Sprout again' : 'Sprout'
      )
    ),
    el('div', { class: 'lbLocks' }, el('span', { class: 'zcL' }, 'Keep'), ...GENE_NAMES.map(lock)),
    kids
  );
}

/* Morph: snapshots A and B, and the tone between them */
function morphBox(ctx) {
  const snap = slot => {
    BENCH[slot] = { ...ZE.snd.v };
    BENCH.t = slot === 'A' ? 0 : 1;
    toast('Snapshot ' + slot + ' kept: the tone as it is now');
    ctx.redraw();
  };
  const diff = () =>
    BENCH.A && BENCH.B ? Object.keys(BENCH.B).filter(k => k in BENCH.A && BENCH.A[k] !== BENCH.B[k]) : [];
  const ks = diff();
  /* between A and B: numbers slide, choices (a wave, a filter type, an effect type) switch halfway */
  const at = (t, tag) => {
    const A = BENCH.A,
      B = BENCH.B,
      fxSame = A['MFX.mfxType'] === B['MFX.mfxType'],
      out = {};
    for (const k of ks) {
      const d = paramOf('tone', k),
        a = A[k],
        b = B[k];
      const step =
        typeof a !== 'number' || typeof b !== 'number' || (d && d[0][8]) || (k.startsWith('MFX.') && !fxSame);
      out[k] = step ? (t < 0.5 ? a : b) : Math.round(a + (b - a) * t);
    }
    ctx.apply(tag, out, 'shimmer', 'Morph ' + Math.round(t * 100) + '% to B');
  };
  const slider = el('input', {
    type: 'range',
    min: 0,
    max: 100,
    value: Math.round(BENCH.t * 100),
    disabled: !ks.length,
    'aria-label': 'Morph from A to B',
    oninput: e => {
      BENCH.t = +e.target.value / 100;
      e.target.parentNode.querySelector('.zcV').textContent = Math.round(BENCH.t * 100) + '% B';
      const tag = 'morph:' + ctx.dragN();
      ctx.dragged(tag, t => at(BENCH.t, t));
    },
    onchange: () => ctx.dragDone()
  });
  const flip = t => () => {
    BENCH.t = t;
    at(t, ctx.tag());
    ctx.redraw();
  };
  return el(
    'div',
    { class: 'lbBody' },
    el(
      'div',
      { class: 'lbRow' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn' + (BENCH.A ? ' on' : ''),
          onclick: () => snap('A'),
          title: 'Keep the tone as it is now as A'
        },
        BENCH.A ? 'A ✓ (keep again)' : 'Keep as A'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn' + (BENCH.B ? ' on' : ''),
          onclick: () => snap('B'),
          title: 'Keep the tone as it is now as B'
        },
        BENCH.B ? 'B ✓ (keep again)' : 'Keep as B'
      ),
      el('button', { type: 'button', class: 'btn', disabled: !ks.length, onclick: flip(0), title: 'Hear A' }, 'Hear A'),
      el('button', { type: 'button', class: 'btn', disabled: !ks.length, onclick: flip(1), title: 'Hear B' }, 'Hear B')
    ),
    el(
      'label',
      { class: 'zcC lbMorph' },
      el('span', { class: 'zcL' }, 'A ↔ B'),
      el('span', { class: 'zcV' }, Math.round(BENCH.t * 100) + '% B'),
      slider
    ),
    el(
      'p',
      { class: 'hint' },
      !BENCH.A || !BENCH.B
        ? 'Keep the tone as A, change it (ingredients, a blend, a mutation), keep it as B, then slide between them or flip to compare.'
        : ks.length
          ? ks.length + ' settings differ. Numbers slide; waves, types and switches change halfway.'
          : 'A and B are the same: change the tone and keep it again.'
    )
  );
}

/* Ear test: a hidden ingredient; flip before and after and guess it */
const EAR_POOL = [
  'sun',
  'moon',
  'squelch',
  'ghost',
  'pluck',
  'swell',
  'mist',
  'punch',
  'wobble',
  'vibrato',
  'tremolo',
  'swirl',
  'abyss',
  'feather',
  'drift',
  'swarm',
  'shimmer',
  'space',
  'od',
  'chorus',
  'phaser',
  'square',
  'sine',
  'ssaw'
];
function earBox(ctx) {
  const E = BENCH.ear;
  const start = () => {
    const before = { ...ZE.snd.v };
    const pool = [...EAR_POOL].sort(() => Math.random() - 0.5);
    for (const id of pool) {
      const tag = ctx.tag();
      const keys = ctx.mixQuiet(id, 7, tag);
      if (!keys.length) continue;
      const after = Object.fromEntries(keys.map(k => [k, ZE.snd.v[k]]));
      const others = EAR_POOL.filter(x => x !== id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      BENCH.ear = {
        id,
        tag,
        keys,
        before: Object.fromEntries(keys.map(k => [k, before[k]])),
        after,
        side: 'after',
        options: [id, ...others].sort(() => Math.random() - 0.5),
        answer: null
      };
      return ctx.redraw();
    }
    toast('Nothing to hide: every ingredient is already as far as it goes on this tone');
  };
  const side = s => () => {
    ctx.apply(E.tag, s === 'before' ? E.before : E.after, 'ghost', 'Ear test (' + s + ')');
    E.side = s;
    ctx.redraw();
  };
  const guess = id => {
    if (E.answer) return;
    E.answer = id;
    SCORE.tries++;
    if (id === E.id) {
      SCORE.right++;
      SCORE.streak++;
    } else SCORE.streak = 0;
    saveScore();
    /* the tone ends up with the ingredient in, and the lab shows what it was */
    if (E.side !== 'after') ctx.apply(E.tag, E.after, E.id, 'Ear test');
    ctx.select(E.id);
    ctx.redraw();
  };
  const score = el(
    'span',
    { class: 'lbScore' },
    SCORE.tries
      ? SCORE.right + ' / ' + SCORE.tries + ' right' + (SCORE.streak > 1 ? ' · streak ' + SCORE.streak : '')
      : 'No score yet'
  );
  if (!E)
    return el(
      'div',
      { class: 'lbBody' },
      el(
        'p',
        { class: 'hint' },
        'The lab mixes a hidden ingredient into your tone. Flip between before and after, taste with the keys, and guess what it was. Training your ears to name what you hear is the core skill of sound design.'
      ),
      el(
        'div',
        { class: 'lbRow' },
        el('button', { type: 'button', class: 'btn on', onclick: start }, 'New challenge'),
        score
      )
    );
  const name = id => (ctx.ingredients().find(p => p.id === id) || { name: id }).name;
  return el(
    'div',
    { class: 'lbBody' },
    el(
      'div',
      { class: 'lbRow' },
      el(
        'button',
        { type: 'button', class: 'btn' + (E.side === 'before' ? ' on' : ''), onclick: side('before') },
        'Before'
      ),
      el(
        'button',
        { type: 'button', class: 'btn' + (E.side === 'after' ? ' on' : ''), onclick: side('after') },
        'After'
      ),
      el('span', { class: 'hint' }, 'Flip, taste, then guess:'),
      score
    ),
    el(
      'div',
      { class: 'lbGuess' },
      ...E.options.map(id =>
        el(
          'button',
          {
            type: 'button',
            class: 'btn' + (E.answer ? (id === E.id ? ' right' : id === E.answer ? ' wrong' : '') : ''),
            disabled: !!E.answer,
            onclick: () => guess(id)
          },
          name(id)
        )
      )
    ),
    E.answer
      ? el(
          'div',
          { class: 'lbRow' },
          el(
            'b',
            { class: E.answer === E.id ? 'lbYes' : 'lbNo' },
            E.answer === E.id ? 'Right: ' + name(E.id) + '.' : 'It was ' + name(E.id) + '.'
          ),
          el('span', { class: 'hint' }, 'Learn shows what it does. It stays in (Undo takes it out).'),
          el('button', { type: 'button', class: 'btn on', onclick: start }, 'Next challenge')
        )
      : null
  );
}
