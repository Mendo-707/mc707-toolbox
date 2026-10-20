// Factory drum kits from the MC-707's system update file (see zc-factory.js for the tones). Each kit is a
// 3328-byte record: the kit's common settings, its effect, 6 compressors, then 88 keys (A0 up) and each
// key's EQ. Read on your computer; nothing from the file is kept in the app.
//
// Reads: nothing shared. Pure functions over the file's bytes.
import { decodeAt, fieldsOf, nameAt } from './zc-factory.js';

/** Bytes per kit record. */
export const FW_KIT_REC = 0xd00;
/* Where each kit parameter sits: as the tone table in zc-factory.js; o = a key's output assign (0-6 in the
   file, dry or the effect over SysEx). Every one of the file's 133 kits decodes inside the ranges. */
const KIT_MAP = [
  ['KCMN', 0, 1, 0, 'NAME:0a PHRASE:18w LEVEL:20b PHRASE_VEL_RATE:23b PHRASE_VEL_SHIFT:24c'],
  [
    'MFX',
    28,
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
  ['KCMP', 112, 6, 8, 'SW:0b ATTCK:1b RELEASE:2b THRESHOLD:3c RATIO:4b KNEE:5b POSTGAIN:6c OUT_ASGN:7b'],
  [
    'KPTL',
    160,
    88,
    20,
    'INST_NUM:0w INST_GTYPE:2b INST_GID:4w LEVEL:6b PAN:8c CHO_SEND:9b REV_SEND:10b MUTE_GRP:11b ' +
      'OUT_ASGN:12o KEY_OFST:13c PIT_FINE_OFST:14c CUTOFF_OFST:15c RESO_OFST:16c TVA_ATK_OFST:17c ' +
      'TVA_DCY_OFST:18c TVA_REL_OFST:19c'
  ],
  ['KEQ', 1920, 88, 16, 'LO_GAIN:0s MID_GAIN:2s HI_GAIN:4s LO_FREQ:6w MID_FREQ:8w HI_FREQ:10w MID_Q:12b SW:13b']
];
let FIELDS = null;
/** Every kit field: [parameter key, offset in the record, type]. */
export const fwKitFields = () => FIELDS || (FIELDS = fieldsOf(KIT_MAP));

/* a quick look: a printable name, a level, a phrase velocity rate of 1-200, and sane first keys */
function looksLikeKit(b, o) {
  if (o + FW_KIT_REC > b.length) return false;
  for (let i = 0; i < 16; i++) if (b[o + i] < 32 || b[o + i] > 126) return false;
  if (b[o + 20] > 127 || !b[o + 23] || b[o + 23] > 200 || b[o + 21] || b[o + 22]) return false;
  for (let k = 0; k < 88; k += 29) if (b[o + 160 + k * 20 + 2] > 2 || b[o + 160 + k * 20 + 12] > 6) return false;
  return true;
}
/** The kit at byte o, or null when it does not decode. */
export const fwKit = (b, o) => decodeAt('kit', fwKitFields(), b, o);

/* the kit lists, known by their first kit */
const BANKS = { 'Standard Kit': 'KA', 'TR-909 3': 'KB' };

/**
 * The factory kits in an update file: [{name, snd, bank, no}], in runs of at least 4 kits back to back.
 * bank: KA (the ZEN-Core kits), KB (the MC-707's own), then KC on for any others; no from 1.
 * @param {Uint8Array} b
 */
export function fwKits(b) {
  const out = [];
  let next = 'C';
  for (let o = 0; o + FW_KIT_REC * 4 <= b.length; o += 4) {
    if (!looksLikeKit(b, o)) continue;
    const kits = [];
    for (let p = o, s; looksLikeKit(b, p) && (s = fwKit(b, p)); p += FW_KIT_REC) kits.push(s);
    if (kits.length < 4) continue;
    const bank = BANKS[nameAt(b, o)] || 'K' + next;
    if (!BANKS[nameAt(b, o)]) next = String.fromCharCode(next.charCodeAt(0) + 1);
    kits.forEach((snd, i) => {
      const name = snd.v['KCMN.NAME'];
      if (name && !/^init kit$/i.test(name)) out.push({ name, snd, bank, no: i + 1 });
    });
    o += kits.length * FW_KIT_REC - 4;
  }
  return out;
}
