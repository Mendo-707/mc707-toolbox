// The effects the mixers choose: each track's effect (the MFX of its sounds: every clip's tone or kit
// and the track's own, so the track keeps it whichever clip plays) and the MC-707's total effects
// (reverb and chorus/delay types and levels, the master Multi FX, the master compressor and EQ on/off).
//
// Where the total effects live comes from Roland's project map for the MV-1, which the MC-707 shares
// with its track blocks twice as far apart (docs/MC707-SYSEX.md): reverb level is confirmed on an
// MC-707; the rest follows the same map. The type lists are the MC-707 Reference Manual's, in its order.
//
// Owns: FXN (what was last chosen or read, for the mixers to show).
// Reads: ZX, DEV, S (track types).
import { S } from '../core/state.js';
import { PCLAST } from '../services/clip-switch.js';
import { TR } from '../services/transport.js';
import { WHOLE_SOUND, reselect, zeQuietly } from './zc-editor.js';
import { DEV } from '../core/device.js';
import { MFX_PARAMS, MFX_RESET_MS, readSound, sendSound } from './zc-tone.js';
import { lin, slotAddr, zxConnect, zxFlush, zxRead, zxWrite } from './zc-sysex.js';
import { MFX_PRESETS, mfxPreset } from './zc-mfx-presets.js';
import { mfxDefaults, mfxNames } from './zc-mfx.js';

/** What the mixers show: per track the effect last sent, and the total effects as last sent or read. */
export const FXN = { track: [], master: null };

const pause = ms => new Promise(r => setTimeout(r, ms));
/* the tone layout puts the MFX block at +0x80 (linear) from the slot, so a "slot" this far before a
   project MFX block writes its keys at the block (the project MFX blocks have the same layout) */
const MFX_AT = 0x80;
const PRJ = {
  mfx: [lin(0x10002000), lin(0x10002200), lin(0x10002400)],
  cho: lin(0x10002600),
  rev: lin(0x10002700),
  eq: lin(0x10003900),
  comp: lin(0x10003a00)
};
/** Reverb types (0 is off on the MC-707's list, which the manual does not show). */
export const REV_TYPES = ['Off', 'Integra', 'Warm Hall', 'Hall', 'GS', 'SRV2000', 'SRV2000 Non-linear', 'GM2 Reverb'];
/** Chorus/delay types. */
export const CHO_TYPES = [
  'Off',
  'Chorus',
  'CE-1',
  'SDD-320',
  'JUNO-106 Chorus',
  'Delay',
  'T-Ctrl Delay',
  'Delay + Tremolo',
  '2Tap Pan Delay',
  '3Tap Pan Delay'
];

/**
 * The effect choices, for a menu: off, the ready-made settings, then every type with its starting values.
 * @returns {{id:string, label:string, group:string}[]}
 */
export function fxChoices() {
  const names = mfxNames();
  return [
    { id: 'off', label: 'Off', group: '' },
    ...MFX_PRESETS.map((p, i) => ({ id: 'p' + i, label: p[0], group: 'Ready-made' })),
    ...names.slice(1).map((n, i) => ({ id: 't' + (i + 1), label: n, group: 'Effect types' }))
  ];
}
/** The type, its 32 values and the switch for a choice id. */
function resolve(id) {
  if (id === 'off') return { type: 0, vals: mfxDefaults(0), sw: 0 };
  if (id[0] === 'p') return { ...mfxPreset(+id.slice(1)), sw: 1 };
  const type = +id.slice(1);
  return { type, vals: mfxDefaults(type), sw: 1 };
}
const labelOf = id => (fxChoices().find(c => c.id === id) || {}).label || '';
/* the effect as a sound holding only its MFX keys */
const mfxSound = (kind, r) => ({
  kind,
  v: {
    'MFX.mfxType': r.type,
    'MFX.mfxSwitch': r.sw,
    ...Object.fromEntries(MFX_PARAMS.map((k, i) => [k, r.vals[i]]))
  },
  known: new Set()
});
const HEAD = new Set(['MFX.mfxType', 'MFX.mfxSwitch']);

/* type and switch to every block first, then (after the MC-707 has reset each new type's settings) the
   settings: two passes, so 17 sounds take a couple of seconds rather than one reset wait each */
/** Select track t's clip again, so the MC-707 takes what was sent (not while the app plays: a clip
    change then could be heard). Only when the app knows which clip is selected. */
export async function refreshClip(t) {
  /* only to the clip the app last chose: an unknown one would change what the MC-707 has selected */
  if (TR.playing || PCLAST[t] == null) return;
  await reselect(t, PCLAST[t]);
}
/* a wait that never holds the mixer for long: the writes go out regardless */
const flushed = () => Promise.race([zxFlush(), pause(8000)]);
async function sendMfx(jobs, r) {
  for (const j of jobs) await sendSound(mfxSound(j.kind, r), j.base, HEAD);
  await flushed();
  await pause(MFX_RESET_MS);
  for (const j of jobs) sendSound(mfxSound(j.kind, r), j.base, new Set(MFX_PARAMS));
  await flushed();
  /* one checked: read back, and the settings sent again if the reset came late */
  const j = jobs[jobs.length - 1],
    copy = mfxSound(j.kind, r);
  const back = await Promise.race([readSound(copy, j.base, new Set(MFX_PARAMS)), pause(6000).then(() => null)]);
  if (back && back.ok && MFX_PARAMS.some((k, i) => copy.v[k] !== r.vals[i])) {
    await pause(MFX_RESET_MS);
    for (const x of jobs) sendSound(mfxSound(x.kind, r), x.base, new Set(MFX_PARAMS));
    await flushed();
  }
}

/**
 * Give track t an effect: every clip's sound and the track's own (17 sounds), so it stays whichever
 * clip plays. Resolves false when the MC-707 is not connected, 'slow' when it had not finished after 20 s.
 */
export async function trackFx(t, id) {
  const was = FXN.track[t];
  const now = (FXN.track[t] = { id, label: labelOf(id), busy: true });
  try {
    if (!(await zxConnect())) {
      FXN.track[t] = was;
      return false;
    }
    const kind = S.tracks[t].type === 'drum' ? 'kit' : 'tone';
    const jobs = Array.from({ length: 17 }, (_, k) => ({ kind, k, base: slotAddr(kind, t, k) })),
      r = resolve(id);
    /* The MC-707 plays a new type with the wrong settings for a moment (it resets them after the type
       changes): the track is muted while the sound it plays takes the effect, and selected again so it
       plays it. That is the clip the app last chose and the track's own sound; when the app does not know
       the clip, all of them. The other clips take it afterwards, unheard. */
    const k0 = PCLAST[t],
      heard = k0 == null ? jobs : jobs.filter(j => j.k === k0 || j.k === 16),
      rest = jobs.filter(j => !heard.includes(j));
    const run = async () => {
      await zeQuietly(
        () => sendMfx(heard, r),
        t,
        () => refreshClip(t),
        WHOLE_SOUND
      );
      if (rest.length) await sendMfx(rest, r);
      return true;
    };
    /* never stuck on "sending": the writes take a few seconds; past 20 the strip lets go */
    return await Promise.race([run(), pause(20000).then(() => 'slow')]);
  } finally {
    now.busy = false;
  }
}

/* ---- the total effects ---- */
const masterOk = () => DEV !== '101';
/** The total effects now, read from the MC-707 (null when it does not answer). */
export async function readMaster() {
  if (!masterOk() || !(await zxConnect())) return null;
  const rev = await zxRead(PRJ.rev, 3),
    cho = await zxRead(PRJ.cho, 4),
    mfx = await zxRead(PRJ.mfx[0], 2),
    comp = await zxRead(PRJ.comp, 1),
    eq = await zxRead(PRJ.eq + 14, 1);
  if (!rev && !cho && !mfx) return null;
  FXN.master = {
    rev: rev ? { sw: rev[0], type: rev[1], level: rev[2] } : null,
    cho: cho ? { sw: cho[0], type: cho[1], level: cho[2], send: cho[3] } : null,
    mfx: mfx ? { type: mfx[0], sw: mfx[1], id: mfx[1] ? 't' + mfx[0] : 'off' } : null,
    comp: comp ? comp[0] : null,
    eq: eq ? eq[0] : null
  };
  return FXN.master;
}
const M = () => (FXN.master = FXN.master || { rev: null, cho: null, mfx: null, comp: null, eq: null });
/**
 * Set one of the total effects.
 * what: 'revType' | 'revLevel' | 'choType' | 'choLevel' | 'choSend' | 'comp' | 'eq' (with a number), or
 * 'mfx' with a choice id. Resolves false when the MC-707 is not connected.
 */
export async function setMaster(what, v) {
  if (!masterOk() || !(await zxConnect())) return false;
  const m = M();
  if (what === 'revType') {
    /* type 0 is off: the switch follows */
    zxWrite(PRJ.rev, [v ? 1 : 0, v || m.rev?.type || 1]);
    m.rev = { ...(m.rev || {}), sw: v ? 1 : 0, type: v || m.rev?.type || 1 };
  } else if (what === 'revLevel') {
    zxWrite(PRJ.rev + 2, [v]);
    m.rev = { ...(m.rev || {}), level: v };
  } else if (what === 'choType') {
    zxWrite(PRJ.cho, [v ? 1 : 0, v || m.cho?.type || 1]);
    m.cho = { ...(m.cho || {}), sw: v ? 1 : 0, type: v || m.cho?.type || 1 };
  } else if (what === 'choLevel') {
    zxWrite(PRJ.cho + 2, [v]);
    m.cho = { ...(m.cho || {}), level: v };
  } else if (what === 'choSend') {
    zxWrite(PRJ.cho + 3, [v]);
    m.cho = { ...(m.cho || {}), send: v };
  } else if (what === 'comp') {
    zxWrite(PRJ.comp, [v ? 1 : 0]);
    m.comp = v ? 1 : 0;
  } else if (what === 'eq') {
    zxWrite(PRJ.eq + 14, [v ? 1 : 0]);
    m.eq = v ? 1 : 0;
  } else if (what === 'mfx') {
    const r = resolve(v);
    m.mfx = { type: r.type, sw: r.sw, id: v, label: labelOf(v) };
    await sendMfx([{ kind: 'tone', base: PRJ.mfx[0] - MFX_AT }], r);
  }
  await zxFlush();
  return true;
}
