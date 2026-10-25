// Reading an MC-707 project file (.mpj, as the MC-707 saves projects on its SD card). Not documented by
// Roland; worked out from empty projects with known track layouts and a full project (2026). Read only:
// the app never writes one.
//
//   header      2 bytes, "PRJ5", then at 16 a table of sections: 4-letter tag, "MC77", offset, size (LE)
//   PRJa        the project: name (16 chars) at +10, tempo (BPM × 100, 16 bits) at +20; the first 8
//               scenes at +D0, 8 bytes each: the clip (0-15) each track plays; per track t a
//               block at +200 + t × 100 with its kind at +14 (0 tone, 1 drum, 2 looper); then 8 tracks ×
//               17 clip blocks of 5C40 bytes from +10F0 (clip 17 of a track is the track's own sound)
//   clip block  sound name (16 chars) at +0; at +300 the step size (0-5: 1/8, 1/16, 1/32, 1/4T, 1/8T,
//               1/16T) and the number of steps (1-128); from +3D0, 128 steps of 60 bytes: 16 note numbers
//               (FF none), 16 velocities, 16 starts (signed, hundredths of a step), 16 ends (100 ties on), 16
//               sub steps; then the clip's motion (not mapped yet)
//   USDa        the project's samples: "SMPh", then each "SMPd": header size (30), channels, data size
//               (padded to 1 KB), sample count (all channels), file name (16), number, sample rate, then
//               16-bit PCM
//   LPDa        looper recordings: "DIK0", then 256 entries (size, offset from "DIK0", 2 unused); entry
//               track × 16 + clip; 32-bit mono PCM at 44.1 kHz
//
// Plain data only. Reads: nothing.

const PRJ_CLIPS = 0x10f0,
  CLIP_SIZE = 0x5c40,
  STEP0 = 0x3d0,
  STEP_SIZE = 0x60;
/** What a track is, from its kind byte. */
export const MPJ_KINDS = { 0: 'tone', 1: 'drum', 2: 'looper' };

const text = (u8, at, n) =>
  String.fromCharCode(...u8.subarray(at, at + n))
    .replace(/\0.*$/, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .trim();

/** The sections of a project file: {tag: {at, size}}, or null when it is not an MC-707 project. */
export function mpjSections(u8) {
  if (u8.length < 64 || text(u8, 2, 4) !== 'PRJ5') return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength),
    out = {};
  for (let p = 16; p + 16 <= u8.length && p < 16 + 16 * 32; p += 16) {
    const tag = text(u8, p, 4),
      model = text(u8, p + 4, 4);
    if (!/^[A-Z]{3}[a-z]$/.test(tag) && tag !== 'DUMY') break;
    if (tag === 'DUMY') break;
    const at = dv.getUint32(p + 8, true),
      size = dv.getUint32(p + 12, true);
    if (model !== 'MC77' || at + size > u8.length) return null;
    out[tag] = { at, size };
  }
  return out.PRJa ? out : null;
}

/**
 * One clip's steps, as the slots zc-seq's joinNotes takes: [[{note, vel, start, end, sub}…] × steps].
 */
function clipSteps(u8, base, steps) {
  const out = [];
  for (let s = 0; s < steps; s++) {
    const b = base + STEP0 + s * STEP_SIZE,
      slots = [];
    for (let j = 0; j < 16; j++) {
      const note = u8[b + j];
      if (note === 0xff || note > 127) continue;
      const st = u8[b + 0x20 + j];
      slots.push({
        note,
        vel: u8[b + 0x10 + j] || 100,
        start: st > 127 ? st - 256 : st,
        end: u8[b + 0x30 + j],
        sub: u8[b + 0x40 + j] || 0
      });
    }
    out.push(slots);
  }
  return out;
}

/**
 * Read a project: name, tempo, tracks with their sound name and kind, and each clip's step settings,
 * sound name and steps; plus the samples and looper recordings it holds (their place in the file).
 * @param {Uint8Array} u8
 * @returns {{name, bpm, tracks: {kind, sound, clips: ({size, steps, sound, slots, notes}|null)[]}[],
 *   samples: {name, channels, rate, at, count}[], loops: {track, clip, at, bytes}[]} | {error:string}}
 */
export function readMpj(u8) {
  const sec = mpjSections(u8);
  if (!sec) return { error: 'That is not an MC-707 project file (.mpj)' };
  const P = sec.PRJa.at,
    dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (sec.PRJa.size < PRJ_CLIPS + 136 * CLIP_SIZE) return { error: 'The project file is shorter than expected' };
  const tracks = [];
  for (let t = 0; t < 8; t++) {
    const kind = MPJ_KINDS[u8[P + 0x214 + t * 0x100]] || 'empty',
      clips = [];
    for (let k = 0; k < 16; k++) {
      const base = P + PRJ_CLIPS + (t * 17 + k) * CLIP_SIZE,
        size = u8[base + 0x300],
        steps = u8[base + 0x301];
      if (kind === 'looper' || !(steps >= 1 && steps <= 128) || size > 5) {
        clips.push(null);
        continue;
      }
      const slots = clipSteps(u8, base, steps);
      clips.push({ size, steps, sound: text(u8, base, 16), slots, notes: slots.reduce((n, s) => n + s.length, 0) });
    }
    tracks.push({ kind, sound: text(u8, P + PRJ_CLIPS + (t * 17 + 16) * CLIP_SIZE, 16), clips });
  }
  /* samples */
  const samples = [];
  if (sec.USDa) {
    const end = sec.USDa.at + sec.USDa.size;
    let p = sec.USDa.at + 0x30;
    while (p + 0x30 <= end && text(u8, p, 4) === 'SMPd') {
      const hs = dv.getUint16(p + 4, true),
        ch = dv.getUint16(p + 6, true),
        size = dv.getUint32(p + 8, true),
        count = dv.getUint32(p + 12, true),
        rate = dv.getUint32(p + 36, true);
      if (!hs || p + hs + count * 2 > end || ch < 1 || ch > 2) break;
      samples.push({
        name: text(u8, p + 16, 16) || 'Sample ' + (samples.length + 1),
        channels: ch,
        rate,
        at: p + hs,
        count
      });
      p += hs + size;
    }
  }
  /* looper recordings */
  const loops = [];
  if (sec.LPDa && text(u8, sec.LPDa.at + 16, 4) === 'DIK0') {
    const D = sec.LPDa.at + 16,
      end = sec.LPDa.at + sec.LPDa.size,
      seen = new Set();
    for (let e = 0; e < 128; e++) {
      const bytes = dv.getUint32(D + 16 + e * 16, true),
        off = dv.getUint32(D + 16 + e * 16 + 4, true);
      if (!bytes || bytes % 4 || D + off + bytes > end || seen.has(off)) continue;
      seen.add(off);
      loops.push({ track: e >> 4, clip: e & 15, at: D + off, bytes });
    }
  }
  /* the first 8 scenes: the clip each track plays (an empty template has scene n playing clip n) */
  const scenes = Array.from({ length: 8 }, (_, s) =>
    Array.from({ length: 8 }, (_, t) => {
      const k = u8[P + 0xd0 + s * 8 + t];
      return k < 16 ? k : -1;
    })
  );
  return {
    name: text(u8, P + 0x10, 16),
    scenes,
    bpm: dv.getUint16(P + 0x20, true) / 100,
    tracks,
    samples,
    loops
  };
}

/** A sample's audio as Float32 channels. */
export function sampleAudio(u8, s) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength),
    frames = Math.floor(s.count / s.channels),
    ch = Array.from({ length: s.channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < s.channels; c++) ch[c][i] = dv.getInt16(s.at + (i * s.channels + c) * 2, true) / 32768;
  return ch;
}
/** A looper recording's audio as one Float32 channel (32-bit mono at 44.1 kHz). */
export function loopAudio(u8, l) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength),
    frames = Math.floor(l.bytes / 4),
    M = new Float32Array(frames);
  for (let i = 0; i < frames; i++) M[i] = dv.getInt32(l.at + i * 4, true) / 2147483648;
  return [M];
}
/** Float32 channels as a WAV file (16 or 24-bit). */
export function wavBytes(chs, rate, bits = 16) {
  const n = chs[0].length,
    c = chs.length,
    bps = bits / 8,
    out = new Uint8Array(44 + n * c * bps),
    dv = new DataView(out.buffer);
  const w = (o, s) => [...s].forEach((x, i) => dv.setUint8(o + i, x.charCodeAt(0)));
  w(0, 'RIFF');
  dv.setUint32(4, 36 + n * c * bps, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, c, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * c * bps, true);
  dv.setUint16(32, c * bps, true);
  dv.setUint16(34, bits, true);
  w(36, 'data');
  dv.setUint32(40, n * c * bps, true);
  let p = 44;
  for (let i = 0; i < n; i++)
    for (let k = 0; k < c; k++) {
      const x = Math.max(-1, Math.min(1, chs[k][i]));
      if (bits === 16) {
        dv.setInt16(p, Math.round(x < 0 ? x * 32768 : x * 32767), true);
        p += 2;
      } else {
        const v = Math.round(x < 0 ? x * 8388608 : x * 8388607);
        out[p++] = v & 255;
        out[p++] = (v >> 8) & 255;
        out[p++] = (v >> 16) & 255;
      }
    }
  return out;
}
