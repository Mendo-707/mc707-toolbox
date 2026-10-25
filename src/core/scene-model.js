// Scene Mode's part of the song (S.scn): the scenes in order, each a length in bars and, per track, the
// pattern it plays (with a transpose) and the tone the MC-707 clip should have. Saved with the song;
// a song without scenes has no S.scn. Plain data helpers only; Scene Mode (scene/) changes it.
//
//   S.scn = { first: 0-127,                      the MC-707 scene the first row goes into
//             rows: [{ id, name, bars (1-127), cells: [cell or null] × 8 }],
//             tones: { key: { name, kind: 'tone'|'kit', d: {param: value} } } }
//   cell  = { pat: song pattern id, tr?: semitones, tone?: key in tones }
//
// Reads: nothing (works on the song object it is given).

/** The most scenes the MC-707 holds, and the longest scene LENGTH, in bars. */
export const SCN_MAX = 128,
  SCN_BARS = 127;

/** An empty row. */
export const newRow = (id, name, bars = 8) => ({ id, name, bars, cells: Array(8).fill(null) });

/** Two cells play the same clip (same pattern, transpose and tone). */
export const sameCell = (a, b) =>
  !!a && !!b && a.pat === b.pat && (a.tr || 0) === (b.tr || 0) && (a.tone || '') === (b.tone || '');

/**
 * Check S.scn as loaded (fixState): drop what does not fit, keep the rest. Removes it when it is empty.
 * @param {object} s     the song being fixed
 * @param {object} pats  its checked patterns
 */
export function fixScenes(s, pats) {
  const q = s.scn;
  if (!q || typeof q !== 'object') return void delete s.scn;
  const tones = {};
  if (q.tones && typeof q.tones === 'object')
    for (const k in q.tones) {
      const t = q.tones[k];
      if (t && (t.kind === 'tone' || t.kind === 'kit') && t.d && typeof t.d === 'object')
        tones[k] = { name: String(t.name || 'Tone').slice(0, 16), kind: t.kind, d: t.d };
    }
  const ids = new Set();
  const rows = (Array.isArray(q.rows) ? q.rows : []).slice(0, SCN_MAX).map((r, i) => {
    let id = r && typeof r.id === 'string' && !ids.has(r.id) ? r.id : 'r' + (i + 1) + '_' + ids.size;
    ids.add(id);
    const cells = Array.from({ length: 8 }, (_, t) => {
      const c = r && Array.isArray(r.cells) ? r.cells[t] : null,
        p = c && pats[c.pat];
      if (!p || !s.tracks[t] || p.type !== s.tracks[t].type) return null;
      const o = { pat: c.pat };
      if (Number.isFinite(+c.tr) && +c.tr) o.tr = Math.max(-48, Math.min(48, Math.round(+c.tr)));
      if (typeof c.tone === 'string' && tones[c.tone] && tones[c.tone].kind === (p.type === 'drum' ? 'kit' : 'tone'))
        o.tone = c.tone;
      return o;
    });
    const bars = Math.round(+(r && r.bars));
    return {
      id,
      name: String((r && r.name) || 'Scene').slice(0, 20),
      bars: Number.isFinite(bars) ? Math.max(1, Math.min(SCN_BARS, bars)) : 8,
      cells
    };
  });
  if (!rows.length) return void delete s.scn;
  const first = Math.round(+q.first);
  s.scn = { first: Number.isFinite(first) ? Math.max(0, Math.min(SCN_MAX - 1, first)) : 0, rows, tones };
}

/**
 * Which MC-707 clip each cell goes into: per track, every different clip (pattern, transpose and tone) in
 * the order it first plays gets the next clip from 0. Clips past 16 are left out (-1) and counted.
 * @returns {{clip: number[][], items: {t:number, k:number, cell:object, row:number}[], over: number[]}}
 *          clip[row][track] is 0-15 or -1 (nothing plays); over[track] counts clips that did not fit
 */
export function scnClips(q) {
  const clip = q.rows.map(() => Array(8).fill(-1)),
    items = [],
    over = Array(8).fill(0);
  for (let t = 0; t < 8; t++) {
    const seen = [];
    q.rows.forEach((r, i) => {
      const c = r.cells[t];
      if (!c) return;
      let k = seen.findIndex(x => sameCell(x, c));
      if (k < 0) {
        if (seen.length >= 16) return void over[t]++;
        k = seen.push(c) - 1;
        items.push({ t, k, cell: c, row: i });
      }
      clip[i][t] = k;
    });
  }
  return { clip, items, over };
}
