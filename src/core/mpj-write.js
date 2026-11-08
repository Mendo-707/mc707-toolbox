// Writing an MC-707 project file (.mpj), to load on the MC-707 with no computer (PROJECT › LOAD). It starts
// from Roland's empty project for the track layout (core/mpj-templates.js: the project with 8 tone tracks,
// and the bytes another layout changes; a drum track takes its blocks from the 8-drum project), then sets
// what core/mpj.js reads back: the project name and tempo, each clip's header (so the MC-707 sees a clip), step size, number of steps and steps,
// which clip each track plays in each scene, and each scene's chain LENGTH (the last OFF, so the chain stops
// there, as Scene Mode writes them), and the chain switched on (+143, as the MC-707 saves a project that
// was playing its chain). Every track with clips plays its clips' sounds (Sound Source CLIP): a clip's
// tone or kit goes in its slot (mpjToneAt, mpjKitAt), the others get the template's (a piano, the TR-808
// and TR-909 kits). Motion stays the template's: its place in the file is not mapped yet.
//
// A step is 0x60 bytes, 16 slots each: notes (FF empty), velocities (80 empty), starts (signed hundredths of
// a step), ends (hundredths, 100 carries on into the next step; 80 empty), sub steps, then 16 bytes left as
// the MC-707 saves them (0). The same layout Scene Mode writes over USB (zen/zc-seq.js stepWrites).
//
// Plain data only (gzip through the browser's DecompressionStream). Reads: nothing.
import { BASE, DIFF, MPJ_SIZE } from './mpj-templates.js';
import { mpjSections } from './mpj.js';

const PRJ_CLIPS = 0x10f0,
  TONES = 0x3112f0,
  TONE_BLOCK = 0x6c60,
  TONE_REC = 0x660,
  KITS = 0x3475f0,
  KIT_BLOCK = 0xdd00,
  KIT_REC = 0xd00,
  KEYS = 0x3b5df0,
  OWN = 16,
  KEYS_BLOCK = 0x4ee40,
  KEYS_REC = 0x4a40,
  CLIP_SIZE = 0x5c40,
  STEP0 = 0x3d0,
  STEP_SIZE = 0x60;
/* the bytes of a clip's header that make it a clip (offset: value), by track kind */
const CLIP_ON = {
  drum: { 0x12: 1, 0xac: 9, 0xad: 32, 0xf4: 12, 0xf5: 32, 0x13c: 20, 0x13d: 32, 0x184: 2, 0x185: 32 },
  tone: { 0x12: 0, 0xac: 9, 0xad: 32, 0xf4: 160, 0xf5: 32, 0x13c: 20, 0x13d: 32, 0x184: 12, 0x185: 32 }
};

async function gunzip(b64) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/* apply [offset u32, length u16, bytes] runs to u8; keep(offset) picks which */
function applyRuns(u8, runs, keep) {
  const dv = new DataView(runs.buffer, runs.byteOffset, runs.byteLength);
  for (let p = 0; p + 6 <= runs.length; ) {
    const at = dv.getUint32(p, true),
      n = dv.getUint16(p + 4, true);
    if (!keep || keep(at)) u8.set(runs.subarray(p + 6, p + 6 + n), at);
    p += 6 + n;
  }
}
/*
 * The track a byte of the project belongs to (for a drum track taken from the 8-drum project), or -1: its
 * block in PRJa (+200 + t × 100), its 17 clips, and its three sound blocks further on (worked out from
 * Roland's templates: the 0- and 8-drum projects only differ there, and putting them together this way
 * gives back the 2-drum project byte for byte).
 */
function trackAt(off, P) {
  const x = off - P;
  if (x >= 0x200 && x < 0xa00) return (x - 0x200) >> 8;
  if (x >= PRJ_CLIPS && x < PRJ_CLIPS + 136 * CLIP_SIZE) return Math.floor((x - PRJ_CLIPS) / CLIP_SIZE / 17);
  for (const [start, stride] of [
    [TONES, TONE_BLOCK],
    [KITS, KIT_BLOCK],
    [KEYS, KEYS_BLOCK]
  ])
    if (x >= start && x < start + 8 * stride) return Math.floor((x - start) / stride);
  return -1;
}

/**
 * An empty project for a track layout: Roland's template when there is one (drums first), otherwise put
 * together track by track.
 * @param {('drum'|'tone')[]} kinds  the 8 tracks
 * @returns {Promise<Uint8Array>}
 */
export async function mpjBlank(kinds) {
  const u8 = await gunzip(BASE);
  if (u8.length !== MPJ_SIZE) throw new Error('The project template did not unpack');
  const n = kinds.filter(k => k === 'drum').length,
    first = kinds.every((k, i) => (k === 'drum') === i < n);
  if (!n) return u8;
  if (first && DIFF[n]) {
    applyRuns(u8, await gunzip(DIFF[n]));
    return u8;
  }
  const P = mpjSections(u8).PRJa.at;
  applyRuns(u8, await gunzip(DIFF[8]), at => kinds[trackAt(at, P)] === 'drum');
  return u8;
}

/**
 * Where a tone track's sound slot starts in a project: slot k (0-15) is clip k's sound (played with the
 * track's Sound Source on CLIP), slot 16 the track's own (Sound Source TRACK, as Roland's templates have
 * it). The same numbering as over USB (zen/zc-sysex.js slotAddr); an MC-707 showed track 1 the name
 * written one track's 17 slots further on when the own sound was taken to come first.
 * Each holds a tone as a 1632-byte record, the layout of the MC-707's update file (zen/zc-factory.js).
 */
export const mpjToneAt = (u8, t, slot) => mpjSections(u8).PRJa.at + TONES + t * TONE_BLOCK + slot * TONE_REC;
/**
 * A drum track's kit slot, numbered the same way: the kit's 3328-byte record (mpjKitAt) and a copy of
 * each of its 88 keys' drum instruments, 216 bytes each (mpjKeysAt). See zen/zc-factory.js fwKits.
 */
export const mpjKitAt = (u8, t, slot) => mpjSections(u8).PRJa.at + KITS + t * KIT_BLOCK + slot * KIT_REC;
export const mpjKeysAt = (u8, t, slot) => mpjSections(u8).PRJa.at + KEYS + t * KEYS_BLOCK + slot * KEYS_REC;

/** Printable ASCII, padded with spaces. */
const putText = (u8, at, s, n) => {
  /* accents off (Für shows as Fur, not F r) */
  const t = String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (let i = 0; i < n; i++) {
    const c = t.charCodeAt(i);
    u8[at + i] = c >= 32 && c < 127 ? c : 32;
  }
};

/**
 * Fill a project: its name and tempo, the clips' steps, and the scenes.
 * @param {Uint8Array} u8  from mpjBlank
 * @param {{name:string, bpm:number,
 *   clips: {t:number, k:number, size:number, steps:number, slots:{note,vel,start,end,sub}[][], name?:string}[],
 *   scenes: {bars:number, pick:number[]}[], first?:number,
 *   sounds?: {t:number, k:number, kind:'tone'|'kit', rec:Uint8Array, keys?:Uint8Array}[]}} song
 *   pick: the clip (0-15) each of the 8 tracks plays, -1 none; scenes go in from scene `first` (0-127);
 *   sounds: a clip's tone as a record (zen/zc-factory.js fwRecord) on a tone track, or its kit (record
 *   and keys, fwKitBytes) on a drum track
 * @returns {Uint8Array} u8
 */
export function mpjFill(u8, song) {
  const P = mpjSections(u8).PRJa.at,
    dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  putText(u8, P + 0x10, song.name, 16);
  dv.setUint16(P + 0x20, Math.max(2000, Math.min(30000, Math.round(song.bpm * 100))), true);
  for (const c of song.clips) {
    const base = P + PRJ_CLIPS + (c.t * 17 + c.k) * CLIP_SIZE,
      drum = u8[P + 0x200 + c.t * 0x100 + 0x14] === 1;
    /* the clip's header as the MC-707 saves a clip it recorded (FF throughout in an empty clip, which the
       MC-707 shows as no clip, notes or not): read from projects saved on the MC-707 */
    for (const [o, v] of Object.entries(drum ? CLIP_ON.drum : CLIP_ON.tone)) u8[base + +o] = v;
    u8[base + 0x300] = c.size;
    u8[base + 0x301] = c.steps;
    for (let s = 0; s < 128; s++) {
      const o = base + STEP0 + s * STEP_SIZE,
        slots = (s < c.steps && c.slots[s]) || [];
      for (let j = 0; j < 16; j++) {
        const x = slots[j];
        u8[o + j] = x ? x.note : 0xff;
        u8[o + 0x10 + j] = x ? x.vel : 0x50;
        u8[o + 0x20 + j] = x ? x.start & 0xff : 0;
        u8[o + 0x30 + j] = x ? x.end : 0x50;
        u8[o + 0x40 + j] = x ? x.sub || 0 : 0;
      }
    }
  }
  /* the sounds: every track with clips plays its clips' sounds (Sound Source CLIP, +15, so each clip can
     have its own tone or kit). A clip given a sound gets it in its slot; the others get the track's own
     (the template's), so none is silent. A track's own sound becomes its first given one. */
  for (let t = 0; t < 8; t++) {
    const mine = song.clips.filter(c => c.t === t);
    /* the clip's name, as the MC-707 shows it on the pads */
    for (const c of mine) if (c.name) putText(u8, P + PRJ_CLIPS + (c.t * 17 + c.k) * CLIP_SIZE, c.name, 16);
    if (!mine.length) continue;
    const drum = u8[P + 0x200 + t * 0x100 + 0x14] === 1,
      parts = drum
        ? [
            [mpjKitAt, KIT_REC, 'rec'],
            [mpjKeysAt, KEYS_REC, 'keys']
          ]
        : [[mpjToneAt, TONE_REC, 'rec']],
      given = (song.sounds || []).filter(x => x.t === t && (x.kind === 'kit') === drum);
    for (const [at, size] of parts) {
      const own = u8.slice(at(u8, t, OWN), at(u8, t, OWN) + size);
      for (const c of mine) u8.set(own, at(u8, t, c.k));
    }
    for (const x of given) for (const [at, , key] of parts) u8.set(x[key], at(u8, t, x.k));
    if (given.length) for (const [at, , key] of parts) u8.set(given[0][key], at(u8, t, OWN));
    u8[P + 0x200 + t * 0x100 + 0x15] = 1;
  }
  const first = song.first || 0;
  /* the scene chain switched on (CHAIN ON, +143), so the scenes follow one another by themselves */
  if (song.scenes.length > 1 && song.chain !== false) u8[P + 0x143] = 1;
  const last = Math.min(song.scenes.length, 128 - first) - 1;
  song.scenes.forEach((sc, i) => {
    const s = first + i;
    if (s > 127) return;
    /* the chain moves on after LENGTH bars; the last scene is OFF, so it stays there (without the
       chain, every scene keeps its length) */
    u8[P + 0x50 + s] = i === last && song.chain !== false ? 0 : Math.max(1, Math.min(127, sc.bars));
    for (let t = 0; t < 8; t++) u8[P + 0x200 + t * 0x100 + 0x90 + s] = sc.pick[t] >= 0 ? sc.pick[t] + 1 : 0;
  });
  return u8;
}

/**
 * What a project holds, read back (for checks): each track's kind ('drum'/'tone') and Sound Source
 * (1 = CLIP), its clips' names (null where empty), and each scene's clip picks (1-16, 0 none).
 */
export function mpjRead(u8) {
  const P = mpjSections(u8).PRJa.at,
    text = o =>
      String.fromCharCode(...u8.subarray(o, o + 16))
        .replace(/[\0\xff]+$/, '')
        .trimEnd();
  return Array.from({ length: 8 }, (_, t) => {
    const o = P + 0x200 + t * 0x100;
    return {
      kind: u8[o + 0x14] === 1 ? 'drum' : 'tone',
      src: u8[o + 0x15],
      clips: Array.from({ length: 16 }, (_, k) => {
        const c = P + PRJ_CLIPS + (t * 17 + k) * CLIP_SIZE;
        return u8[c + 0x12] === 0xff ? null : text(c);
      }),
      picks: Array.from(u8.subarray(o + 0x90, o + 0x90 + 16))
    };
  });
}
