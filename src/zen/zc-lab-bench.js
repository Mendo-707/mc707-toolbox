// The Slime Lab's variations and morph, two ways of working borrowed from other sound-design tools.
//
//   Variations  (after Synplant's seed and branches) six variations of the tone, each a small random step on
//               its "genes" (oscillator, filter, amp, motion, pitch, space, effect), as far as you choose, keeping
//               the genes you lock. Click one to hear it (the tone becomes it); Grow from it sprouts six more.
//   Morph       (after the A/B snapshots and morphing of Pigments and friends) keeps two snapshots, A and B,
//               and slides the tone between them, or flips between them to compare.
//
// Every change goes through the lab's apply (one undo step per action). Reads: ZE.snd. Owns: BENCH.
import { el, toast } from '../core/dom.js';
import { ZE } from './zc-editor.js';
import { MFX_PARAMS, paramOf } from './zc-tone.js';
import { mfxParams } from './zc-mfx.js';
import { miniSvg } from './zc-lab-scope.js';

const BENCH = {
  str: 4,
  locks: new Set(),
  kids: [],
  parent: null,
  pick: -1,
  gen: 0,
  A: null,
  B: null,
  t: 0
};
const KIDS = 6;
const STRENGTH = [
  [2, 'Subtle'],
  [4, 'Medium'],
  [7, 'Wild']
];

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

/** Forget the variations (a new tone, a starting sound: they belong to the old one). */
export function varsForget() {
  BENCH.kids = [];
  BENCH.pick = -1;
}
/* six new variations of the tone as it is now */
function sprout(ctx) {
  BENCH.parent = { ...ZE.snd.v };
  BENCH.gen++;
  BENCH.pick = -1;
  BENCH.kids = Array.from({ length: KIDS }, () => {
    const vals = mutate(ctx, BENCH.str);
    return { vals, gist: gist(ctx, vals, BENCH.parent) };
  });
  ctx.redraw();
}
/* hear a variation: the tone becomes it (one undo step for the whole generation); -1 is the parent */
function pickKid(ctx, i) {
  const tag = 'mutate:' + BENCH.gen;
  const back = Object.fromEntries(
    [...new Set(BENCH.kids.flatMap(k => Object.keys(k.vals)))].map(k => [k, num(BENCH.parent, k)])
  );
  const vals = i < 0 ? back : { ...back, ...BENCH.kids[i].vals };
  ctx.apply(tag, vals, i < 0 ? 'Variations: back to where they grew from' : 'Variation ' + (i + 1));
  BENCH.pick = i;
  ctx.redraw();
  ctx.hear();
}
/** The variations: six small pictures of the tone, how far they go, the genes kept. */
export function varsBox(ctx) {
  const ps = ctx.parts();
  const kid = (i, name, what, vals) => {
    const b = el(
      'button',
      {
        type: 'button',
        class: 'lxKid' + (BENCH.pick === i ? ' on' : ''),
        title: (i < 0 ? 'Back to the tone they grew from' : 'Hear this variation: ' + what) + ' (click)',
        onclick: () => pickKid(ctx, i)
      },
      el('span', { class: 'lxPic' }),
      el('b', {}, name),
      el('small', {}, what)
    );
    b.firstChild.innerHTML = miniSvg(vals, ps);
    return b;
  };
  const strength = el(
    'div',
    { class: 'lxSeg', role: 'group', 'aria-label': 'How far the variations go' },
    ...STRENGTH.map(([n, label]) =>
      el(
        'button',
        {
          type: 'button',
          class: BENCH.str === n ? 'on' : '',
          'aria-pressed': String(BENCH.str === n),
          title: label + ' variations',
          onclick: () => ((BENCH.str = n), ctx.redraw())
        },
        label
      )
    )
  );
  const lock = g =>
    el(
      'button',
      {
        type: 'button',
        class: 'lxLock' + (BENCH.locks.has(g) ? ' on' : ''),
        'aria-pressed': String(BENCH.locks.has(g)),
        title: BENCH.locks.has(g) ? g + ' is kept: variations leave it alone' : 'Keep ' + g + ' as it is in variations',
        onclick: () => {
          if (BENCH.locks.has(g)) BENCH.locks.delete(g);
          else BENCH.locks.add(g);
          ctx.redraw();
        }
      },
      g
    );
  const kids = BENCH.kids.length
    ? [
        kid(-1, 'Before', 'as it was', BENCH.parent),
        ...BENCH.kids.map((k, i) => kid(i, String(i + 1), k.gist || 'tiny change', { ...BENCH.parent, ...k.vals }))
      ]
    : [];
  return el(
    'div',
    { class: 'lxBox' },
    el(
      'div',
      { class: 'lxTop' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn on lxGrow',
          onclick: () => sprout(ctx),
          title: 'Six new variations of the tone as it is now'
        },
        BENCH.kids.length ? (BENCH.pick >= 0 ? 'Grow from ' + (BENCH.pick + 1) : 'Grow again') : 'Grow variations'
      ),
      strength,
      el('details', { class: 'lxKeep' }, el('summary', {}, 'Keep…'), el('div', {}, ...GENE_NAMES.map(lock)))
    ),
    kids.length
      ? el('div', { class: 'lxKids' }, ...kids)
      : el(
          'p',
          { class: 'hint lxNone' },
          'Not sure where to go? Grow six variations of your sound, click through them by ear, and grow again from the one you like.'
        )
  );
}

/* Morph: snapshots A and B, and the tone between them */
export function morphBox(ctx) {
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
    ctx.apply(tag, out, 'Morph ' + Math.round(t * 100) + '% to B');
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
        ? 'Keep the tone as A, change it (the knobs, a starting sound, a variation, Fine-tune), keep it as B, then slide between them or flip to compare.'
        : ks.length
          ? ks.length + ' settings differ. Numbers slide; waves, types and switches change halfway.'
          : 'A and B are the same: change the tone and keep it again.'
    )
  );
}
