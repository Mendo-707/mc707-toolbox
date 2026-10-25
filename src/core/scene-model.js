// Scene Mode's part of the song (S.scn), laid out as the MC-707 keeps it: each track's 16 clips (a
// pattern, with a transpose and the tone the clip should have), and the scenes in chain order, each a
// length in bars and the clip each track plays. Also what was last written to the MC-707, to show each
// clip and scene as written, changed or new. Saved with the song; a song without scenes has no S.scn.
// Plain data helpers only; Scene Mode (scene/) changes it.
//
//   S.scn = { v: 2,
//             first: 0-127,                         the MC-707 scene the first row goes into
//             clips: [[clip or null] × 16] × 8,     clip = { pat: song pattern id, tr?, tone?: key in tones,
//                                                    pump?: {mode, depth, rel, rest} (core/pump.js) }
//             rows: [{ id, name, bars (1-127), pick: [clip 0-15 or -1] × 8 }],
//             tones: { key: { name, kind: 'tone'|'kit', d: {param: value} } },
//             done: { c: { 't:k': mark }, s: { scene: mark }, p: { 't:k': pump mode } } }   what was written
//                   (p: the motion lane a pump was written into, to clear it when the pump goes)
//
// Songs saved by the first Scene Mode (rows of cells, each with its own pattern) are turned into this
// shape when they load: each track's different cells become its clips in the order they first play.
//
// Reads: nothing (works on the song object it is given).
import { fixPump, kickHits } from './pump.js';

/** The most scenes the MC-707 holds, and the longest scene LENGTH, in bars. */
export const SCN_MAX = 128,
  SCN_BARS = 127;

/** An empty scene. */
export const newRow = (id, name, bars = 8) => ({ id, name, bars, pick: Array(8).fill(-1) });
/** No clips yet: 8 tracks of 16. */
export const emptyClips = () => Array.from({ length: 8 }, () => Array(16).fill(null));

/** Two clips hold the same thing (pattern, transpose and tone). */
export const sameClip = (a, b) =>
  !!a && !!b && a.pat === b.pat && (a.tr || 0) === (b.tr || 0) && (a.tone || '') === (b.tone || '');

/* a short fingerprint of a string */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}
/**
 * What a clip would put on the MC-707 (its notes, length, transpose and tone), as a short mark: the same
 * mark as when it was written means it is unchanged.
 */
export function clipMark(clip, pats, tones) {
  const p = clip && pats[clip.pat];
  if (!p) return '';
  const tn = clip.tone && tones[clip.tone];
  return fnv(JSON.stringify([p.type, p.bars, p.notes, clip.tr || 0, tn ? [tn.kind, tn.d] : 0]));
}
/** What scene row i would put on the MC-707: its clips, and its LENGTH (OFF when it is the last). */
export const sceneMark = (q, i) => fnv(JSON.stringify([q.rows[i].pick, i === q.rows.length - 1 ? 0 : q.rows[i].bars]));

/**
 * Where a pumping clip gets its kicks: the drum clips with kicks that play alongside it, in the scenes that
 * play it (the set most of them have). null when no scene plays it.
 * @returns {{from:number[][], scenes:number[], differ:boolean}|null}  from: [track, clip] pairs
 */
export function pumpSource(q, pats, t, k) {
  const sets = new Map();
  q.rows.forEach((r, i) => {
    if (r.pick[t] !== k) return;
    const from = r.pick
      .map((kk, tt) => [tt, kk])
      .filter(([tt, kk]) => tt !== t && kk >= 0 && q.clips[tt][kk] && kickHits(pats[q.clips[tt][kk].pat]).length);
    const key = JSON.stringify(from);
    if (!sets.has(key)) sets.set(key, { from, scenes: [] });
    sets.get(key).scenes.push(i);
  });
  if (!sets.size) return null;
  const list = [...sets.values()].sort((a, b) => b.scenes.length - a.scenes.length);
  return { ...list[0], differ: list.length > 1 };
}
/** The kicks of a pump source, for kicksUnder: [{hits, period}]. */
export const pumpKicks = (q, pats, src) =>
  src
    ? src.from.map(([tt, kk]) => {
        const p = pats[q.clips[tt][kk].pat];
        return { hits: kickHits(p), period: p.bars * 16 };
      })
    : [];
/** Clip k of track t's mark: what it puts on the MC-707, with its pump and the kicks the pump follows. */
export function clipMarkAt(q, pats, t, k) {
  const c = q.clips[t][k],
    base = clipMark(c, pats, q.tones);
  if (!c || !c.pump) return base;
  return fnv(base + JSON.stringify([c.pump, pumpKicks(q, pats, pumpSource(q, pats, t, k))]));
}

/* a mark starting with ! was written, but the MC-707 read it back differently */
const stateOf = (was, now) => (!was ? 'new' : was === now ? 'written' : was === '!' + now ? 'odd' : 'changed');
/**
 * Clip k of track t: 'empty', 'new' (never written), 'written', 'odd' (written, but read back differently)
 * or 'changed' (since it was written).
 */
export function clipState(q, pats, t, k) {
  const c = q.clips[t][k];
  if (!c) return 'empty';
  return stateOf(q.done && q.done.c[t + ':' + k], clipMarkAt(q, pats, t, k));
}
/** Scene row i: 'new', 'written', 'odd' or 'changed'. */
export const sceneState = (q, i) => stateOf(q.done && q.done.s[q.first + i], sceneMark(q, i));

/* the first Scene Mode's rows (a pattern per cell) as clips and picks */
function fromCells(q) {
  const clips = emptyClips(),
    start = Array.isArray(q.start) ? q.start : [];
  const rows = q.rows.map(r => ({ ...r, pick: Array(8).fill(-1) }));
  for (let t = 0; t < 8; t++) {
    let k = Math.max(0, Math.min(15, Math.round(+start[t]) || 0));
    q.rows.forEach((r, i) => {
      const c = r && Array.isArray(r.cells) ? r.cells[t] : null;
      if (!c) return;
      let at = clips[t].findIndex(x => sameClip(x, c));
      if (at < 0 && k < 16) clips[t][(at = k++)] = { ...c };
      rows[i].pick[t] = at;
    });
  }
  return { clips, rows };
}

/**
 * Check S.scn as loaded (fixState): turn the first Scene Mode's shape into this one, then drop what does
 * not fit and keep the rest. Removes it when it has neither scenes nor clips.
 * @param {object} s     the song being fixed
 * @param {object} pats  its checked patterns
 */
export function fixScenes(s, pats) {
  let q = s.scn;
  if (!q || typeof q !== 'object') return void delete s.scn;
  if (Array.isArray(q.rows) && q.rows.some(r => r && Array.isArray(r.cells))) q = { ...q, ...fromCells(q) };
  const tones = {};
  if (q.tones && typeof q.tones === 'object')
    for (const k in q.tones) {
      const t = q.tones[k];
      if (t && (t.kind === 'tone' || t.kind === 'kit') && t.d && typeof t.d === 'object')
        tones[k] = { name: String(t.name || 'Tone').slice(0, 16), kind: t.kind, d: t.d };
    }
  const clips = emptyClips();
  for (let t = 0; t < 8; t++)
    for (let k = 0; k < 16; k++) {
      const c = Array.isArray(q.clips) && Array.isArray(q.clips[t]) ? q.clips[t][k] : null,
        p = c && pats[c.pat];
      if (!p || !s.tracks[t] || p.type !== s.tracks[t].type) continue;
      const o = { pat: c.pat };
      if (Number.isFinite(+c.tr) && +c.tr) o.tr = Math.max(-48, Math.min(48, Math.round(+c.tr)));
      if (typeof c.tone === 'string' && tones[c.tone] && tones[c.tone].kind === (p.type === 'drum' ? 'kit' : 'tone'))
        o.tone = c.tone;
      const pump = fixPump(c.pump);
      if (pump) o.pump = pump;
      clips[t][k] = o;
    }
  const ids = new Set();
  const rows = (Array.isArray(q.rows) ? q.rows : []).slice(0, SCN_MAX).map((r, i) => {
    const id = r && typeof r.id === 'string' && !ids.has(r.id) ? r.id : 'r' + (i + 1) + '_' + ids.size;
    ids.add(id);
    const bars = Math.round(+(r && r.bars));
    return {
      id,
      name: String((r && r.name) || 'Scene').slice(0, 20),
      bars: Number.isFinite(bars) ? Math.max(1, Math.min(SCN_BARS, bars)) : 8,
      pick: Array.from({ length: 8 }, (_, t) => {
        const k = Math.round(+(r && Array.isArray(r.pick) ? r.pick[t] : -1));
        return k >= 0 && k < 16 && clips[t][k] ? k : -1;
      })
    };
  });
  if (!rows.length && !clips.some(l => l.some(Boolean))) return void delete s.scn;
  const first = Math.round(+q.first);
  const marks = o =>
    Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => typeof v === 'string'));
  s.scn = {
    v: 2,
    first: Number.isFinite(first) ? Math.max(0, Math.min(SCN_MAX - 1, first)) : 0,
    clips,
    rows,
    tones,
    done: { c: marks(q.done && q.done.c), s: marks(q.done && q.done.s), p: marks(q.done && q.done.p) }
  };
}

/** How many scenes use clip k of track t. */
export const clipUses = (q, t, k) => q.rows.filter(r => r.pick[t] === k).length;
