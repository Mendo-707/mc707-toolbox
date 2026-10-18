// The pages of the tone editor: Common, Oscillator, Filter, Amp, Pitch, LFO, Matrix, Partials and
// EQ. Each page shows the partial chosen in the editor (ctx.part, 0-3).
//
// Reads: the sound through the editor's ctx.
import { el } from '../core/dom.js';
import { ctl, group } from './zc-widgets.js';
import { envGraph, stepGraph } from './zc-env.js';
import { filterCurve, lfoPreview, oscPreview } from './zc-preview.js';
import { pk } from './zc-tone.js';

const at = (ctx, blk, ids, o) =>
  ids.map(id => ctl(ctx, pk(blk, ['CMN', 'PMT', 'SCMN', 'SPMT', 'MFX'].includes(blk) ? null : ctx.part, id), o));
const row = (...kids) => el('div', { class: 'zcRow' }, ...kids);

export function pageCommon(ctx) {
  const c = ids => at(ctx, 'CMN', ids);
  return el(
    'div',
    {},
    group('Tone', ctl(ctx, 'CMN.NAME', { wide: true }), ...c(['CATEGORY', 'LEVEL', 'PAN', 'PRIORITY', 'ANALOG_FEEL'])),
    group('Tuning', ...c(['OCTAVE', 'PIT_CRS', 'PIT_FINE', 'STRETCH'])),
    group('Voice', ...c(['MONO_POLY', 'LEGATO_SW', 'RETRIG_INTVL', 'SOFT_LEVEL_SENS', 'PTL_LFO_LOCK'])),
    group('Portamento', ...c(['PORTA_SW', 'PORTA_TIME', 'PORTA_MODE', 'PORTA_TYPE', 'PORTA_START', 'PORTA_CRV'])),
    group(
      'Pitch bend',
      ...c(['BEND_RANGE_UP', 'BEND_RANGE_DW', 'BEND_MODE']),
      ...at(ctx, 'SCMN', ['BEND_RANGE_FINE_UP', 'BEND_RANGE_FINE_DW'])
    ),
    group(
      'Unison and drift',
      ...at(ctx, 'SCMN', ['UNISON_SW', 'UNISON_SIZE', 'UNISON_DETN', 'RND_PIT_VAL', 'RND_PIT_NUM', 'CONDITION'])
    )
  );
}

export function pageOsc(ctx) {
  const ty = ctx.get(pk('SPTL', ctx.part, 'OSC_TYPE'));
  const s = ids => at(ctx, 'SPTL', ids),
    p = ids => at(ctx, 'PTL', ids);
  const wave = group('PCM wave', ...p(['WAV_GTYPE', 'WAV_GID', 'WAV_NUM_L', 'WAV_NUM_R', 'WAV_GAIN', 'TEMPO_SYNC']));
  wave.append(
    el(
      'p',
      { class: 'hint' },
      'Wave numbers are the MC-707’s own wave list. Change the number and play a note to hear it (Roland has not published the names).'
    )
  );
  return el(
    'div',
    {},
    group('Oscillator', ...s(['OSC_TYPE']), ...p(['LEVEL']), el('div', { class: 'zcWide' }, oscPreview(ctx))),
    ty === 1 ? group('VA waveform', ...s(['VA_FORM', 'VA_INVERT_SW', 'PW', 'PWM_DEPTH'])) : null,
    ty === 3 ? group('SuperSAW', ...s(['SSAW_DETUNE'])) : null,
    ty === 2 ? group('PCM-Sync', ...s(['SYNC_WAV_NUM'])) : null,
    ty === 0 || ty === 2 ? wave : null,
    group('FXM (cross modulation of the wave)', ...p(['FXM_SW', 'FXM_COLOR', 'FXM_DEPTH'])),
    group('Pitch', ...p(['PIT_CRS', 'PIT_FINE', 'PIT_RND', 'PIT_KF']), ...s(['PITCH_DOWN_DEPTH'])),
    group('Sound', ...s(['CLICK_TYPE', 'OSC_ATT']), ...p(['STEREO_WIDTH', 'STEREO_DETN']))
  );
}

export function pageFilter(ctx) {
  const s = ids => at(ctx, 'SPTL', ids),
    p = ids => at(ctx, 'PTL', ids),
    f = ids => at(ctx, 'FENV', ids);
  const vcf = ctx.get(pk('SPTL', ctx.part, 'FILTER_TYPE')) === 1;
  return el(
    'div',
    {},
    group(
      'Filter',
      ctl(ctx, pk('SPTL', ctx.part, 'FILTER_TYPE'), { label: 'Filter model' }),
      ...(vcf ? s(['VCF_TYPE', 'FILTER_SLOPE', 'VCF_GC']) : p(['FILTER_TYPE'])),
      ...p(['CUTOFF', 'RESO', 'CUTOFF_KF']),
      ...s(['CUTOFF_KF_BP', 'HPF_CUTOFF', 'FAT']),
      el('div', { class: 'zcWide' }, filterCurve(ctx))
    ),
    group('Velocity', ...p(['CUTOFF_VCRV', 'CUTOFF_VSENS', 'RESO_VSENS'])),
    group(
      'Filter envelope',
      envGraph(ctx, pk('FENV', ctx.part, '').slice(0, -1), ['L0', 'L1', 'L2', 'L3', 'L4']),
      el(
        'div',
        { class: 'zcCols' },
        ...f(['DEPTH', 'VCRV', 'VSENS', 'T1_VSENS', 'T4_VSENS']),
        ...s(['FENV_FINE_DEPTH']),
        ...p(['FENV_TKF'])
      )
    ),
    group('Vibrato on the filter', ...p(['VIB_CUT_SENS', 'SOFT_EQ_SENS']))
  );
}

export function pageAmp(ctx) {
  const p = ids => at(ctx, 'PTL', ids),
    a = ids => at(ctx, 'AENV', ids);
  return el(
    'div',
    {},
    group(
      'Amp envelope',
      envGraph(ctx, pk('AENV', ctx.part, '').slice(0, -1), [null, 'L1', 'L2', 'L3', null]),
      el(
        'div',
        { class: 'zcCols' },
        ...a(['T1_VSENS', 'T4_VSENS']),
        ...p(['ENV_MODE', 'AENV_TKF']),
        ...at(ctx, 'SPTL', ['ADSR_ENV_SW'])
      )
    ),
    group('Level', ...p(['LEVEL', 'LEVEL_VCRV', 'LEVEL_VSENS', 'BIAS_LEVEL', 'BIAS_POS', 'BIAS_DIR', 'VIB_AMP_SENS'])),
    group('Pan', ...p(['PAN', 'PAN_KF', 'PAN_RND', 'PAN_ALT'])),
    group('Effects and output', ...p(['CHO_SEND', 'REV_SEND', 'OUT_ASGN'])),
    group('Delay (start of the partial)', ...p(['DELAY_MODE', 'DLY_TIME_SYNC', 'DLY_TIME_NOTE', 'DLY_TIME'])),
    group('Receive', ...p(['RX_BEND', 'RX_EXPR', 'RX_HOLD', 'REDAMP_SW', 'DAMP_FREE', 'DF_DCY_OFST']))
  );
}

export function pagePitch(ctx) {
  const e = ids => at(ctx, 'PENV', ids);
  return el(
    'div',
    {},
    group(
      'Pitch envelope',
      envGraph(ctx, pk('PENV', ctx.part, '').slice(0, -1), ['L0', 'L1', 'L2', 'L3', 'L4']),
      el(
        'div',
        { class: 'zcCols' },
        ...e(['DEPTH', 'VCRV', 'VSENS', 'T1_VSENS', 'T4_VSENS']),
        ...at(ctx, 'PTL', ['PENV_TKF'])
      )
    ),
    group('Vibrato on the pitch', ...at(ctx, 'PTL', ['VIB_PIT_SENS']))
  );
}

export function pageLfo(ctx) {
  const one = n => {
    const pre = 'LFO' + n + '_',
      l = ids =>
        at(
          ctx,
          'LFO',
          ids.map(i => pre + i)
        );
    const step = ctx.get(pk('LFO', ctx.part, pre + 'FORM')) === 10;
    return group(
      'LFO ' + n,
      el('div', { class: 'zcWide' }, lfoPreview(ctx, n)),
      ...l(['FORM', 'RATE_SYNC']),
      ...(ctx.get(pk('LFO', ctx.part, pre + 'RATE_SYNC')) ? l(['RATE_NOTE']) : l(['RATE'])),
      ...l([
        'PIT_DEPTH',
        'TVF_DEPTH',
        'TVA_DEPTH',
        'PAN_DEPTH',
        'OFST',
        'RATE_DETN',
        'DELAY',
        'DELAY_KF',
        'FADE_MODE',
        'FADE',
        'KEY_TRIG',
        'PHASE_POS'
      ]),
      step
        ? el(
            'div',
            { class: 'zcWide' },
            ...l(['STEP_MAX']),
            stepGraph(ctx, pk('LFO', ctx.part, pre)),
            ...l(['STEP_CURVE_1'])
          )
        : null
    );
  };
  return el(
    'div',
    {},
    el('div', { class: 'zcCols2' }, one(1), one(2)),
    group('Envelopes restart the LFO', ...at(ctx, 'SPTL', ['PENV_LFO_TRIG_SW', 'FENV_LFO_TRIG_SW', 'AENV_LFO_TRIG_SW']))
  );
}

export function pageMatrix(ctx) {
  const rows = [1, 2, 3, 4].map(m => {
    const pre = 'MCTL' + m + '_',
      c = id => ctl(ctx, pk('PTL', ctx.part, pre + id));
    return group('Control ' + m, c('SRC'), ...[1, 2, 3, 4].flatMap(i => [c('DST' + i), c('SENS' + i)]));
  });
  return el(
    'div',
    {},
    el(
      'p',
      { class: 'hint' },
      'Each control takes a source (a CC, velocity, an LFO or envelope…) and sends it to up to four destinations.'
    ),
    ...rows
  );
}

export function pagePartials(ctx) {
  const cols = [1, 2, 3, 4].map(i => {
    const c = id => ctl(ctx, 'PMT.PMT' + i + '_' + id);
    return group(
      'Partial ' + i,
      c('PTL_SW'),
      c('KRANGE_LO'),
      c('KRANGE_UP'),
      c('KFADE_LO'),
      c('KFADE_UP'),
      c('VRANGE_LO'),
      c('VRANGE_UP'),
      c('VFADE_LO'),
      c('VFADE_UP')
    );
  });
  const sp = ids => at(ctx, 'SPMT', ids);
  return el(
    'div',
    {},
    group('Mix', ...at(ctx, 'PMT', ['VEL_CTRL', 'PMT_LEVEL_CRV'])),
    el('div', { class: 'zcCols4' }, ...cols),
    group(
      'Structure 1-2',
      ...sp([
        'STRUCT12',
        'RING12_LEVEL',
        'XMOD12_DEPTH',
        'XMOD2_12_DEPTH',
        'RING_OSC1_LEVEL',
        'RING_OSC2_LEVEL',
        'XMOD_OSC1_LEVEL',
        'XMOD_OSC2_LEVEL'
      ])
    ),
    group(
      'Structure 3-4',
      ...sp([
        'STRUCT34',
        'RING34_LEVEL',
        'XMOD34_DEPTH',
        'XMOD2_34_DEPTH',
        'RING_OSC3_LEVEL',
        'RING_OSC4_LEVEL',
        'XMOD_OSC3_LEVEL',
        'XMOD_OSC4_LEVEL'
      ])
    ),
    group('Phase', ...sp(['PTL_PHS_LOCK']))
  );
}

export function pageEq(ctx, blk = 'EQ', inst = ctx.part) {
  const e = id => ctl(ctx, pk(blk, inst, id));
  return group(
    'EQ',
    e('SW'),
    e('LO_FREQ'),
    e('LO_GAIN'),
    e('MID_FREQ'),
    e('MID_GAIN'),
    e('MID_Q'),
    e('HI_FREQ'),
    e('HI_GAIN')
  );
}
