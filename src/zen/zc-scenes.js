// MC-707 scenes and the scene chain, so a song plays on the MC-707 by itself (found with the scene
// finder, zc-scan.js, on an MC-707 with system 1.71 or later):
//   which clip track t plays in scene s (0-127): the track's settings + 3E + s, clip 1-16 (0 = none)
//   how many bars scene s plays before the chain moves on: 10 00 00 4C + s (0 = OFF: it stays)
// The chain plays scenes in order and stops moving at a scene whose LENGTH is OFF. Its CHAIN switch
// is not mapped yet, so it is turned on on the MC-707.
//
// Owns: nothing (the song is S; the clip each pattern goes to comes from zc-seq.js's songPlan).
// Reads: S, DEV.
import { S } from '../core/state.js';
import { DEVS, DEV } from '../core/device.js';
import { lin, trackSetAddr, zxFlush, zxRead, zxWrite } from './zc-sysex.js';

export const SCENES = 128;
/** The longest LENGTH a scene takes, in bars. */
export const MAX_LEN = 127;
/** Where scene s keeps track t's clip (linear address). */
export const sceneClipAddr = (t, s) => trackSetAddr(t) + 0x3e + s;
/** Where scene s keeps its chain LENGTH (linear address). */
export const sceneLenAddr = s => lin(0x10000000) + 0x4c + s;
/** "1-1" … "8-16": scene s as the MC-707 shows it with Call Scene TYPE2 (8 banks of 16). */
export const sceneName = s => Math.floor(s / 16) + 1 + '-' + ((s % 16) + 1);

/**
 * The song as scenes: it is cut wherever a track's pattern changes (on whole bars), runs that play the
 * same clips are joined, and runs longer than 127 bars are split. Silence before the first clip and
 * after the last is left out.
 * @param {{t:number, items:{k:number, key:string, skip?:string}[]}[]} plan  zc-seq.js's songPlan
 * @returns {{a:number, bars:number, clips:Record<number, number>}[]}  a = first bar; clips: app track → clip 0-15, or -1 for none
 */
export function songSections(plan) {
  const kOf = new Map(plan.map(r => [r.t, new Map(r.items.filter(i => !i.skip).map(i => [i.key, i.k]))]));
  const tracks = DEVS[DEV].tracks;
  const live = S.clips.filter(c => tracks.includes(c.t) && !c.mute && !S.tracks[c.t].mute && S.patterns[c.pat]);
  const cuts = [...new Set(live.flatMap(c => [Math.round(c.start), Math.round(c.start + c.len)]))].sort(
    (a, b) => a - b
  );
  const segs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i],
      b = cuts[i + 1],
      mid = a + 0.5,
      clips = {};
    for (const t of tracks) {
      const c = live.find(c => c.t === t && mid >= c.start && mid < c.start + c.len),
        p = c && S.patterns[c.pat],
        key = p && c.pat + ':' + (p.type === 'tone' ? c.tr || 0 : 0),
        m = kOf.get(t);
      clips[t] = m && m.has(key) ? m.get(key) : -1;
    }
    const prev = segs[segs.length - 1];
    if (prev && tracks.every(t => prev.clips[t] === clips[t])) prev.b = b;
    else segs.push({ a, b, clips });
  }
  const empty = s => tracks.every(t => s.clips[t] < 0);
  while (segs.length && empty(segs[0])) segs.shift();
  while (segs.length && empty(segs[segs.length - 1])) segs.pop();
  const out = [];
  for (const s of segs)
    for (let a = s.a; a < s.b; a += MAX_LEN) out.push({ a, bars: Math.min(MAX_LEN, s.b - a), clips: s.clips });
  return out;
}

/* write or read a run of bytes without crossing a 128-byte page (one address byte) */
function writeRun(l, data) {
  for (let i = 0; i < data.length; ) {
    const n = Math.min(128 - ((l + i) % 128), data.length - i);
    zxWrite(l + i, data.slice(i, i + n));
    i += n;
  }
}
async function readRun(l, n) {
  const out = [];
  for (let i = 0; i < n; ) {
    const m = Math.min(128 - ((l + i) % 128), n - i),
      r = await zxRead(l + i, m, 600, true);
    if (!Array.isArray(r) || r.length < m) return null;
    out.push(...r.slice(0, m));
    i += m;
  }
  return out;
}
/**
 * Write sections as scenes from scene `first` on: each track's clip, and each scene's LENGTH (the last
 * one OFF, so the chain stays on it), then read them back. With only (row indexes), only those scenes'
 * clips are written; the lengths always go, since each depends on where the chain ends.
 * @returns {Promise<{ok:boolean, checked:boolean, why?:string}>}
 */
export async function writeScenes(list, first, only = null) {
  if (!list.length) return { ok: false, checked: false, why: 'the song has nothing to play' };
  if (first + list.length > SCENES) return { ok: false, checked: false, why: 'more scenes than the MC-707 has' };
  const want = new Map();
  for (const t of DEVS[DEV].tracks)
    if (only) for (const i of only) want.set(sceneClipAddr(t, first + i), [list[i].clips[t] + 1]);
    else
      want.set(
        sceneClipAddr(t, first),
        list.map(x => x.clips[t] + 1)
      );
  want.set(
    sceneLenAddr(first),
    list.map((x, i) => (i === list.length - 1 ? 0 : x.bars))
  );
  for (const [l, data] of want) writeRun(l, data);
  await zxFlush();
  for (const [l, data] of want) {
    const got = await readRun(l, data.length);
    if (!got || got.some((v, i) => v !== data[i])) return { ok: true, checked: false };
  }
  return { ok: true, checked: true };
}
