// Factory tones from the MC-707's own system update file (MC707_UPA_up.bin, from Roland's support
// page). The file holds every preset tone as a 1632-byte record; this reads them on your computer and
// turns each into a ZenCore tone the editor can load and send. Nothing from the file is kept in the
// app or sent anywhere: only the tones you import go into this browser's Sound library.
//
// Reads: nothing shared. Pure functions over the file's bytes.
import { newSound, paramOf } from './zc-tone.js';

/** Bytes per tone record in the update file. */
export const FW_REC = 0x660;
/* Where each tone parameter sits in a record: [block key, offset, instances, stride, 'ID:offset+type ...'].
   Types: a = 16 ASCII characters, b = unsigned byte, c = signed byte, w = unsigned 16-bit, s = signed
   16-bit (little-endian). Worked out against tones read back from an MC-707 over SysEx. */
const FW_MAP = [
  [
    'CMN',
    0,
    1,
    0,
    'NAME:0a CATEGORY:16b LEVEL:20b PAN:21c PRIORITY:24b PIT_CRS:25c PIT_FINE:26c OCTAVE:27c ' +
      'STRETCH:28b ANALOG_FEEL:29b MONO_POLY:30b LEGATO_SW:31b RETRIG_INTVL:32b PORTA_SW:33b ' +
      'PORTA_MODE:34b PORTA_TYPE:35b PORTA_START:36b PORTA_TIME:38w BEND_RANGE_UP:40b BEND_RANGE_DW:41b ' +
      'BEND_MODE:42b SOFT_LEVEL_SENS:43b PORTA_CRV:44b PTL_LFO_LOCK:45b'
  ],
  [
    'MFX',
    64,
    1,
    0,
    'mfxType:0b mfxSwitch:1b choSend:2b revSend:3b ctrlSrc1:4b ctrlSens1:5c ctrlSrc2:6b ctrlSens2:7c ' +
      'ctrlSrc3:8b ctrlSens3:9c ctrlSrc4:10b ctrlSens4:11c ctrlAsgn_1:12b ctrlAsgn_2:13b ctrlAsgn_3:14b ' +
      'ctrlAsgn_4:15b param_1:16s param_2:18s param_3:20s param_4:22s param_5:24s param_6:26s ' +
      'param_7:28s param_8:30s param_9:32s param_10:34s param_11:36s param_12:38s param_13:40s ' +
      'param_14:42s param_15:44s param_16:46s param_17:48s param_18:50s param_19:52s param_20:54s ' +
      'param_21:56s param_22:58s param_23:60s param_24:62s param_25:64s param_26:66s param_27:68s ' +
      'param_28:70s param_29:72s param_30:74s param_31:76s param_32:78s'
  ],
  [
    'PMT',
    144,
    1,
    0,
    'VEL_CTRL:4b PMT_LEVEL_CRV:5b PMT1_PTL_SW:8b PMT1_KRANGE_LO:12b PMT1_KRANGE_UP:13b ' +
      'PMT1_KFADE_LO:14b PMT1_KFADE_UP:15b PMT1_VRANGE_LO:16b PMT1_VRANGE_UP:17b PMT1_VFADE_LO:18b ' +
      'PMT1_VFADE_UP:19b PMT2_PTL_SW:20b PMT2_KRANGE_LO:24b PMT2_KRANGE_UP:25b PMT2_KFADE_LO:26b ' +
      'PMT2_KFADE_UP:27b PMT2_VRANGE_LO:28b PMT2_VRANGE_UP:29b PMT2_VFADE_LO:30b PMT2_VFADE_UP:31b ' +
      'PMT3_PTL_SW:32b PMT3_KRANGE_LO:36b PMT3_KRANGE_UP:37b PMT3_KFADE_LO:38b PMT3_KFADE_UP:39b ' +
      'PMT3_VRANGE_LO:40b PMT3_VRANGE_UP:41b PMT3_VFADE_LO:42b PMT3_VFADE_UP:43b PMT4_PTL_SW:44b ' +
      'PMT4_KRANGE_LO:48b PMT4_KRANGE_UP:49b PMT4_KFADE_LO:50b PMT4_KFADE_UP:51b PMT4_VRANGE_LO:52b ' +
      'PMT4_VRANGE_UP:53b PMT4_VFADE_LO:54b PMT4_VFADE_UP:55b'
  ],
  [
    'PTL',
    200,
    4,
    124,
    'LEVEL:0b PIT_CRS:2c PIT_FINE:3c PIT_RND:4w PAN:6c PAN_KF:7c PAN_RND:8b PAN_ALT:9c ENV_MODE:10b ' +
      'DELAY_MODE:11b DLY_TIME_SYNC:12b DLY_TIME_NOTE:13b DLY_TIME:14w CHO_SEND:16b REV_SEND:17b ' +
      'RX_BEND:18b RX_EXPR:19b RX_HOLD:20b REDAMP_SW:21b OUT_ASGN:22b WAV_GTYPE:23b WAV_GID:24w ' +
      'WAV_NUM_L:26w WAV_NUM_R:28w WAV_GAIN:30b FXM_SW:31b FXM_COLOR:32b FXM_DEPTH:33b PIT_KF:34s ' +
      'SOFT_EQ_SENS:36b FILTER_TYPE:37b CUTOFF:40w CUTOFF_KF:42s CUTOFF_VCRV:44b CUTOFF_VSENS:45c ' +
      'RESO:46w RESO_VSENS:48c BIAS_LEVEL:49c BIAS_POS:50b BIAS_DIR:51b LEVEL_VCRV:52b LEVEL_VSENS:53c ' +
      'PENV_TKF:54c FENV_TKF:55c AENV_TKF:56c VIB_PIT_SENS:57c VIB_CUT_SENS:58c VIB_AMP_SENS:59c ' +
      'MCTL1_SRC:60b MCTL1_DST1:61b MCTL1_SENS1:62c MCTL1_DST2:63b MCTL1_SENS2:64c MCTL1_DST3:65b ' +
      'MCTL1_SENS3:66c MCTL1_DST4:67b MCTL1_SENS4:68c MCTL2_SRC:72b MCTL2_DST1:73b MCTL2_SENS1:74c ' +
      'MCTL2_DST2:75b MCTL2_SENS2:76c MCTL2_DST3:77b MCTL2_SENS3:78c MCTL2_DST4:79b MCTL2_SENS4:80c ' +
      'MCTL3_SRC:84b MCTL3_DST1:85b MCTL3_SENS1:86c MCTL3_DST2:87b MCTL3_SENS2:88c MCTL3_DST3:89b ' +
      'MCTL3_SENS3:90c MCTL3_DST4:91b MCTL3_SENS4:92c MCTL4_SRC:96b MCTL4_DST1:97b MCTL4_SENS1:98c ' +
      'MCTL4_DST2:99b MCTL4_SENS2:100c MCTL4_DST3:101b MCTL4_SENS3:102c MCTL4_DST4:103b ' +
      'MCTL4_SENS4:104c DAMP_FREE:108b STEREO_WIDTH:109b STEREO_DETN:110c DF_DCY_OFST:111c ' +
      'TEMPO_SYNC:112b'
  ],
  [
    'PENV',
    696,
    4,
    24,
    'DEPTH:0c VSENS:1c T1_VSENS:2c T4_VSENS:3c T1:4w T2:6w T3:8w T4:10w L0:12s L1:14s L2:16s L3:18s ' +
      'L4:20s VCRV:22b'
  ],
  [
    'FENV',
    792,
    4,
    24,
    'DEPTH:0c VCRV:1b VSENS:2c T1_VSENS:3c T4_VSENS:4c T1:6w T2:8w T3:10w T4:12w L0:14w L1:16w L2:18w ' +
      'L3:20w L4:22w'
  ],
  ['AENV', 888, 4, 16, 'T1_VSENS:0c T4_VSENS:1c T1:2w T2:4w T3:6w T4:8w L1:10w L2:12w L3:14w'],
  [
    'LFO',
    952,
    4,
    104,
    'LFO1_FORM:0b LFO1_RATE_SYNC:1b LFO1_RATE_NOTE:2b LFO1_STEP_MAX:3b LFO1_RATE:4w LFO1_OFST:6c ' +
      'LFO1_RATE_DETN:7b LFO1_DELAY:8w LFO1_DELAY_KF:10c LFO1_FADE_MODE:11b LFO1_FADE:12w ' +
      'LFO1_KEY_TRIG:14b LFO1_PIT_DEPTH:15c LFO1_TVF_DEPTH:16c LFO1_TVA_DEPTH:17c LFO1_PAN_DEPTH:18c ' +
      'LFO1_PHASE_POS:19b LFO1_STEP_1:20c LFO1_STEP_2:21c LFO1_STEP_3:22c LFO1_STEP_4:23c ' +
      'LFO1_STEP_5:24c LFO1_STEP_6:25c LFO1_STEP_7:26c LFO1_STEP_8:27c LFO1_STEP_9:28c LFO1_STEP_10:29c ' +
      'LFO1_STEP_11:30c LFO1_STEP_12:31c LFO1_STEP_13:32c LFO1_STEP_14:33c LFO1_STEP_15:34c ' +
      'LFO1_STEP_16:35c LFO1_STEP_CURVE_1:36b LFO1_STEP_CURVE_2:37b LFO1_STEP_CURVE_3:38b ' +
      'LFO1_STEP_CURVE_4:39b LFO1_STEP_CURVE_5:40b LFO1_STEP_CURVE_6:41b LFO1_STEP_CURVE_7:42b ' +
      'LFO1_STEP_CURVE_8:43b LFO1_STEP_CURVE_9:44b LFO1_STEP_CURVE_10:45b LFO1_STEP_CURVE_11:46b ' +
      'LFO1_STEP_CURVE_12:47b LFO1_STEP_CURVE_13:48b LFO1_STEP_CURVE_14:49b LFO1_STEP_CURVE_15:50b ' +
      'LFO1_STEP_CURVE_16:51b LFO2_FORM:52b LFO2_RATE_SYNC:53b LFO2_RATE_NOTE:54b LFO2_STEP_MAX:55b ' +
      'LFO2_RATE:56w LFO2_OFST:58c LFO2_RATE_DETN:59b LFO2_DELAY:60w LFO2_DELAY_KF:62c ' +
      'LFO2_FADE_MODE:63b LFO2_FADE:64w LFO2_KEY_TRIG:66b LFO2_PIT_DEPTH:67c LFO2_TVF_DEPTH:68c ' +
      'LFO2_TVA_DEPTH:69c LFO2_PAN_DEPTH:70c LFO2_PHASE_POS:71b LFO2_STEP_1:72c LFO2_STEP_2:73c ' +
      'LFO2_STEP_3:74c LFO2_STEP_4:75c LFO2_STEP_5:76c LFO2_STEP_6:77c LFO2_STEP_7:78c LFO2_STEP_8:79c ' +
      'LFO2_STEP_9:80c LFO2_STEP_10:81c LFO2_STEP_11:82c LFO2_STEP_12:83c LFO2_STEP_13:84c ' +
      'LFO2_STEP_14:85c LFO2_STEP_15:86c LFO2_STEP_16:87c LFO2_STEP_CURVE_1:88b LFO2_STEP_CURVE_2:89b ' +
      'LFO2_STEP_CURVE_3:90b LFO2_STEP_CURVE_4:91b LFO2_STEP_CURVE_5:92b LFO2_STEP_CURVE_6:93b ' +
      'LFO2_STEP_CURVE_7:94b LFO2_STEP_CURVE_8:95b LFO2_STEP_CURVE_9:96b LFO2_STEP_CURVE_10:97b ' +
      'LFO2_STEP_CURVE_11:98b LFO2_STEP_CURVE_12:99b LFO2_STEP_CURVE_13:100b LFO2_STEP_CURVE_14:101b ' +
      'LFO2_STEP_CURVE_15:102b LFO2_STEP_CURVE_16:103b'
  ],
  ['EQ', 1368, 4, 16, 'LO_GAIN:0s MID_GAIN:2s HI_GAIN:4s LO_FREQ:6w MID_FREQ:8w HI_FREQ:10w MID_Q:12b SW:13b'],
  [
    'SCMN',
    1432,
    1,
    0,
    'UNISON_SW:0b UNISON_SIZE:1b UNISON_DETN:2b BEND_RANGE_FINE_UP:3b BEND_RANGE_FINE_DW:4b ' +
      'RND_PIT_VAL:5b RND_PIT_NUM:6b CONDITION:7b'
  ],
  [
    'SPMT',
    1440,
    1,
    0,
    'STRUCT12:12b STRUCT34:13b RING12_LEVEL:16b RING34_LEVEL:17b RING_OSC1_LEVEL:18b ' +
      'RING_OSC2_LEVEL:19b RING_OSC3_LEVEL:20b RING_OSC4_LEVEL:21b XMOD12_DEPTH:24w XMOD34_DEPTH:26w ' +
      'XMOD_OSC1_LEVEL:28b XMOD_OSC2_LEVEL:29b XMOD_OSC3_LEVEL:30b XMOD_OSC4_LEVEL:31b PTL_PHS_LOCK:32b ' +
      'XMOD2_12_DEPTH:33b XMOD2_34_DEPTH:34b'
  ],
  [
    'SPTL',
    1488,
    4,
    36,
    'OSC_TYPE:0b VA_FORM:1b SYNC_WAV_NUM:2w PW:4b PWM_DEPTH:5c SSAW_DETUNE:6b CLICK_TYPE:7b ' +
      'HPF_CUTOFF:8w FILTER_TYPE:10b FILTER_SLOPE:11b ADSR_ENV_SW:12b FAT:13b VCF_TYPE:14b OSC_ATT:15b ' +
      'CUTOFF_KF_BP:16b VA_INVERT_SW:17b FENV_FINE_DEPTH:18c PENV_LFO_TRIG_SW:19b FENV_LFO_TRIG_SW:20b ' +
      'AENV_LFO_TRIG_SW:21b PITCH_DOWN_DEPTH:22b VCF_GC:23b'
  ]
];
const SIZE = { a: 16, b: 1, c: 1, w: 2, s: 2 };
let FIELDS = null;
/** Every field: [parameter key, offset in the record, type]. */
export function fwFields() {
  if (FIELDS) return FIELDS;
  FIELDS = [];
  for (const [blk, base, n, stride, list] of FW_MAP)
    for (const f of list.split(' ')) {
      const [, id, off, t] = /^(\w+):(\d+)([a-z])$/.exec(f);
      for (let i = 0; i < n; i++) FIELDS.push([blk + (n > 1 ? i : '') + '.' + id, base + i * stride + +off, t]);
    }
  return FIELDS;
}
function read(b, o, t) {
  if (t === 'b') return b[o];
  if (t === 'c') return (b[o] << 24) >> 24;
  const w = b[o] | (b[o + 1] << 8);
  return t === 's' ? (w << 16) >> 16 : w;
}
const nameAt = (b, o) => {
  let s = '';
  for (let i = 0; i < 16; i++) s += String.fromCharCode(b[o + i]);
  return s.trimEnd();
};
/* a quick look: does a tone record start here? (a printable name, a category, then a level) */
function looksLikeTone(b, o) {
  if (o + FW_REC > b.length) return false;
  for (let i = 0; i < 16; i++) if (b[o + i] < 32 || b[o + i] > 126) return false;
  return b[o + 16] <= 49 && !b[o + 17] && !b[o + 18] && !b[o + 19] && b[o + 20] <= 127 && b[o + 64] < 128;
}

/** The tone at byte o, or null when a value is out of range (not a tone record after all). */
export function fwTone(b, o) {
  const snd = newSound('tone');
  for (const [k, off, t] of fwFields()) {
    if (t === 'a') {
      snd.v[k] = nameAt(b, o + off);
      continue;
    }
    const [p] = paramOf('tone', k),
      x = read(b, o + off, t);
    if (x < p[3] || x > p[4]) return null;
    snd.v[k] = x;
  }
  return snd;
}

/**
 * Find the tone records in an update file: runs of at least 8 records back to back. Returns
 * [start, count] for each run, in file order.
 * @param {Uint8Array} b
 */
export function fwScan(b) {
  const out = [];
  for (let o = 0; o + FW_REC * 8 <= b.length; o += 4) {
    if (!looksLikeTone(b, o)) continue;
    let n = 0;
    while (looksLikeTone(b, o + n * FW_REC)) n++;
    if (n < 8) continue;
    out.push([o, n]);
    o += n * FW_REC - 4;
  }
  return out;
}

/* ZEN-Core's preset tone banks, known by their first tone (the MC-707 numbers each bank from 1) */
const BANKS = {
  SysCtrlDeepEcho2: 'A',
  'AX Classic Lead': 'B',
  'SL-JP8 1': 'C',
  'JP8 Strings1': 'D',
  '128voicePno': 'E'
};
/** Bank names, by letter. */
export const FW_BANK_NAMES = {
  A: 'Factory Presets',
  B: 'AX Collection',
  C: 'Synth Legend',
  D: 'Basic Synth',
  E: 'XV Collection'
};

/**
 * The factory tones in an update file: [{name, snd, bank, no}], skipping blank ones and records that
 * do not decode. bank is a letter (A-E for the known banks, then F on for any others), no from 1.
 */
export function fwTones(b) {
  const out = [],
    runs = fwScan(b),
    used = new Set();
  const banks = runs.map(([o]) => BANKS[nameAt(b, o)] || null);
  banks.forEach(x => x && used.add(x));
  let next = 'F';
  runs.forEach(([o, n], r) => {
    let bank = banks[r];
    if (!bank || banks.indexOf(bank) !== r) {
      while (used.has(next)) next = String.fromCharCode(next.charCodeAt(0) + 1);
      used.add((bank = next));
    }
    for (let i = 0; i < n; i++) {
      const snd = fwTone(b, o + i * FW_REC);
      if (!snd) continue;
      const name = snd.v['CMN.NAME'];
      if (!name || /^init tone$/i.test(name)) continue;
      out.push({ name, snd, bank, no: i + 1 });
    }
  });
  return out;
}
