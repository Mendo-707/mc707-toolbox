// The Slime Lab's Fine-tune side: the real settings behind the knobs, a few to a page (Oscillator, Filter,
// Amp, Motion, Voice, Effects), with the editor's own controls, envelope graphs and previews, one partial
// at a time (the editor's partial bar). Every setting a blend changes is on one of these pages, so a blend
// can be built here by hand. Morph keeps two snapshots and slides between them.
//
// Reads: the editor's ctx (zeCtx), ZE.part. Changes go through that ctx (each one an undo step).
import { el } from '../core/dom.js';
import { ctl, group } from './zc-widgets.js';
import { envGraph } from './zc-env.js';
import { filterCurve, lfoPreview, oscPreview } from './zc-preview.js';
import { pageMfx } from './zc-pages-fx.js';
import { partialBar } from './zc-partbar.js';
import { pk } from './zc-tone.js';

/* the settings on each page: 'BLK.ID' for a partial's own (the partial chosen), whole keys for the tone's */
const OSC_KEYS = {
  type: ['SPTL.OSC_TYPE', 'PTL.LEVEL'],
  va: ['SPTL.VA_FORM', 'SPTL.PW', 'SPTL.PWM_DEPTH'],
  ssaw: ['SPTL.SSAW_DETUNE'],
  pcm: ['PTL.WAV_GID', 'PTL.WAV_NUM_L'],
  more: ['SPTL.FAT', 'PTL.PIT_CRS', 'PTL.PIT_FINE', 'PTL.STEREO_DETN', 'PTL.FXM_SW', 'PTL.FXM_DEPTH'],
  pair: ['SPMT.STRUCT12', 'SPMT.STRUCT34', 'SPMT.RING12_LEVEL', 'SPMT.XMOD12_DEPTH']
};
const FILTER_KEYS = {
  filter: [
    'SPTL.FILTER_TYPE',
    'PTL.FILTER_TYPE',
    'SPTL.VCF_TYPE',
    'SPTL.FILTER_SLOPE',
    'PTL.CUTOFF',
    'PTL.RESO',
    'PTL.CUTOFF_KF',
    'PTL.CUTOFF_VSENS'
  ],
  env: ['FENV.DEPTH', 'FENV.VSENS']
};
const AMP_KEYS = ['PTL.LEVEL_VSENS', 'PTL.PAN', 'PTL.PAN_RND'];
const LFO_IDS = ['FORM', 'RATE_SYNC', 'RATE', 'RATE_NOTE', 'PIT_DEPTH', 'TVF_DEPTH', 'TVA_DEPTH', 'PAN_DEPTH'];
const VOICE_KEYS = {
  play: ['CMN.OCTAVE', 'CMN.MONO_POLY', 'CMN.LEGATO_SW', 'CMN.PORTA_SW', 'CMN.PORTA_MODE', 'CMN.PORTA_TIME'],
  thick: ['SCMN.UNISON_SW', 'SCMN.UNISON_SIZE', 'SCMN.UNISON_DETN'],
  drift: ['CMN.ANALOG_FEEL', 'SCMN.RND_PIT_VAL', 'PTL.PIT_RND'],
  penv: ['PENV.DEPTH']
};
const FX_KEYS = ['PTL.REV_SEND', 'PTL.CHO_SEND'];

/** The pages: [id, tab name, the editor tab with all of its settings]. */
export const FINE_PAGES = [
  ['osc', 'Oscillator', 'osc'],
  ['filter', 'Filter', 'filter'],
  ['amp', 'Amp', 'amp'],
  ['motion', 'Motion', 'lfo'],
  ['voice', 'Voice', 'common'],
  ['fx', 'Effects', 'mfx'],
  ['morph', 'Morph', null]
];
/* which page has a setting (for the blends' guide): by its block and id */
const ON_PAGE = {
  osc: [...Object.values(OSC_KEYS).flat(), 'PMT.*'],
  filter: [...Object.values(FILTER_KEYS).flat(), 'FENV.*'],
  amp: [...AMP_KEYS, 'AENV.*'],
  motion: ['LFO.*'],
  voice: [...Object.values(VOICE_KEYS).flat(), 'PENV.*', 'SCMN.*'],
  fx: [...FX_KEYS, 'MFX.*']
};
/** The Fine-tune page a setting is on ('osc', 'filter'…), or null. key: as stored ('PTL0.CUTOFF'). */
export function pageOf(key) {
  const [blk, id] = key.split('.'),
    b = blk.replace(/\d+$/, '');
  for (const [page, ks] of Object.entries(ON_PAGE))
    if (ks.includes(b + '.' + id) || ks.includes(blk + '.' + id) || ks.includes(b + '.*')) return page;
  return null;
}
export const pageName = id => (FINE_PAGES.find(p => p[0] === id) || [, 'the editor'])[1];

const keyOf = (ctx, k) => (/^(CMN|SCMN|SPMT|PMT|MFX)\./.test(k) ? k : pk(k.split('.')[0], ctx.part, k.split('.')[1]));
const ctls = (ctx, ks) => ks.map(k => ctl(ctx, keyOf(ctx, k)));

function oscPage(ctx) {
  const ty = ctx.get(keyOf(ctx, 'SPTL.OSC_TYPE'));
  return [
    group('Oscillator', ...ctls(ctx, OSC_KEYS.type), el('div', { class: 'zcWide' }, oscPreview(ctx))),
    ty === 1 ? group('Wave', ...ctls(ctx, OSC_KEYS.va)) : null,
    ty === 3 ? group('SuperSAW', ...ctls(ctx, OSC_KEYS.ssaw)) : null,
    ty === 0 || ty === 2 ? group('PCM wave', ...ctls(ctx, OSC_KEYS.pcm)) : null,
    group('Body and pitch', ...ctls(ctx, OSC_KEYS.more)),
    group('Partials together (sync, ring, cross-mod)', ...ctls(ctx, OSC_KEYS.pair))
  ];
}
function filterPage(ctx) {
  const vcf = ctx.get(keyOf(ctx, 'SPTL.FILTER_TYPE')) === 1;
  /* the filter model first; a VCF has its type and slope, the TVF its filter type */
  const ks = FILTER_KEYS.filter
    .slice(1)
    .filter(k => (vcf ? k !== 'PTL.FILTER_TYPE' : !/VCF_TYPE|FILTER_SLOPE/.test(k)));
  return [
    group(
      'Filter',
      ctl(ctx, keyOf(ctx, 'SPTL.FILTER_TYPE'), { label: 'Filter model' }),
      ...ctls(ctx, ks),
      el('div', { class: 'zcWide' }, filterCurve(ctx))
    ),
    group(
      'Filter envelope',
      envGraph(ctx, 'FENV' + ctx.part, ['L0', 'L1', 'L2', 'L3', 'L4']),
      ...ctls(ctx, FILTER_KEYS.env)
    )
  ];
}
function ampPage(ctx) {
  return [
    group('Amp envelope', envGraph(ctx, 'AENV' + ctx.part, [null, 'L1', 'L2', 'L3', null])),
    group('Level and pan', ...ctls(ctx, AMP_KEYS))
  ];
}
function motionPage(ctx) {
  const one = n => {
    const ids = LFO_IDS.filter(id =>
      ctx.get(pk('LFO', ctx.part, 'LFO' + n + '_RATE_SYNC')) ? id !== 'RATE' : id !== 'RATE_NOTE'
    );
    return group(
      'LFO ' + n,
      el('div', { class: 'zcWide' }, lfoPreview(ctx, n)),
      ...ids.map(id => ctl(ctx, pk('LFO', ctx.part, 'LFO' + n + '_' + id)))
    );
  };
  return [one(1), one(2)];
}
function voicePage(ctx) {
  return [
    group('Playing', ...ctls(ctx, VOICE_KEYS.play)),
    group('Unison', ...ctls(ctx, VOICE_KEYS.thick)),
    group('Drift', ...ctls(ctx, VOICE_KEYS.drift)),
    group(
      'Pitch envelope',
      envGraph(ctx, 'PENV' + ctx.part, ['L0', 'L1', 'L2', 'L3', 'L4']),
      ...ctls(ctx, VOICE_KEYS.penv)
    )
  ];
}
function fxPage(ctx) {
  return [group('Reverb and delay sends', ...ctls(ctx, FX_KEYS)), pageMfx(ctx)];
}
const BUILD = { osc: oscPage, filter: filterPage, amp: ampPage, motion: motionPage, voice: voicePage, fx: fxPage };

/**
 * The Fine-tune side.
 * @param {object} ctx  the editor's ctx, with part (the partial shown)
 * @param {object} lab  {page, go(page), redraw(), editor(tab), morph() -> the Morph element}
 */
export function fineBox(ctx, lab) {
  const page = FINE_PAGES.find(p => p[0] === lab.page) || FINE_PAGES[0];
  const tabs = el(
    'nav',
    { class: 'lfTabs', 'aria-label': 'Fine-tune pages' },
    ...FINE_PAGES.map(([id, name]) =>
      el(
        'button',
        {
          type: 'button',
          class: 'lfTab' + (id === page[0] ? ' on' : ''),
          'aria-pressed': String(id === page[0]),
          onclick: () => lab.go(id)
        },
        name
      )
    )
  );
  const body =
    page[0] === 'morph'
      ? [lab.morph()]
      : [
          page[0] === 'fx' || page[0] === 'voice'
            ? null
            : partialBar(ctx.ze, lab.redraw, (k, v) => ctx.set(k, v, true)),
          ...BUILD[page[0]](ctx)
        ];
  return el(
    'div',
    { class: 'lfBox' },
    tabs,
    el('div', { class: 'lfPage zcPage' }, ...body.filter(Boolean)),
    page[2]
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn sm lfAll',
            onclick: () => lab.editor(page[2]),
            title: 'Every ' + page[1].toLowerCase() + ' setting, in the full editor'
          },
          'All ' + page[1].toLowerCase() + ' settings in the editor ›'
        )
      : null
  );
}
