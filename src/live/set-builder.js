// Builds a Live set: picks matching patterns for each scene from the style's pools, every tone part
// on the chords' progression and the lead and pluck kept out of each other's way.
//
// Reads: S, LV, DEV.
import { DEV, devOn, oneKit } from '../core/device.js';
import { S } from '../core/state.js';
import { facById } from '../library/index.js';
import { DEF_ROLES, poolOf, roleInfo, slotOf, trackOf } from '../core/tracks.js';
import { CT_POOL, clipFor, cmFix, patType } from '../services/clip-switch.js';
import { mulberry } from '../core/random.js';
import { LV, lvStyle } from './state.js';
import { lvIsFlash } from './themes.js';
import { lvLoadScenes } from './scene-editor.js';
import { LV_TPL, LV_TPL101, LV_TPL1K } from './scene-templates.js';
import { lvFlavor, lvLively, lvModeFam, lvPool, lvProg } from '../library/pools.js';

const avgPitch = f => f.notes.reduce((a, n) => a + n.n, 0) / Math.max(1, f.notes.length);
/** Two melodic parts that can play together: not both busy, and at least a fifth apart on average. */
const roomFor = (f, g) => !(lvLively(f) > 0.6 && lvLively(g) > 0.6) && Math.abs(avgPitch(f) - avgPitch(g)) >= 7;

export function liveBuild() {
  const st = lvStyle();
  LV.style = st.id;
  if (!LV.mode) LV.mode = lvModeFam(st.scale);
  LV.fillIds = lvPool(st, 'fill');
  if (LV.custom && lvLoadScenes()) {
    if (LV.cur >= LV.scenes.length || lvIsFlash(LV.scenes[LV.cur])) LV.cur = 0;
    LV.ver++;
    return;
  }
  LV.custom = false;
  const r = mulberry(LV.seed ^ 0x5bd1e995),
    P = {},
    A = {},
    at = {};
  const shuf = a => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const take = (pool, pred) => {
    if (!P[pool]) {
      A[pool] = shuf(lvPool(st, pool));
      P[pool] = shuf(lvFlavor(A[pool], LV.flavor));
    }
    for (const arr of pred ? [P[pool], A[pool]] : [P[pool]]) {
      if (!arr.length) continue;
      at[pool] = at[pool] || 0;
      for (let k = 0; k < arr.length; k++) {
        const id = arr[(at[pool] + k) % arr.length];
        if (!pred || pred(facById(id))) {
          at[pool] = (at[pool] + k + 1) % arr.length;
          return id;
        }
      }
    }
    return null;
  };
  /* two matching sets of parts: bass, pad and pluck follow the chords' progression */
  const bassKeys = new Set(
    lvPool(st, 'bass')
      .map(facById)
      .filter(f => f && lvProg(f))
      .map(f => lvProg(f) + '|' + f.bars)
  );
  const mkSet = () => {
    const o = {};
    o[4] = take('chords', f => lvProg(f) && bassKeys.has(lvProg(f) + '|' + f.bars)) || take('chords');
    let cf = facById(o[4]);
    /* chords that follow no progression: the bass sets it instead */
    if (!(cf && lvProg(cf))) {
      const b = take('bass', f => lvProg(f));
      if (b) {
        o[3] = b;
        cf = facById(b);
      }
    }
    const prog = cf && lvProg(cf),
      pb = cf && cf.bars;
    /* every tone part follows the chords' progression, or follows none; a melody from another progression
       would clash, so a part is left out rather than picked from another one (except the bass) */
    const fit = (p, ok = () => true) =>
      (prog && take(p, f => lvProg(f) === prog && f.bars === pb && ok(f))) ||
      take(p, f => !lvProg(f) && ok(f)) ||
      (prog && take(p, f => lvProg(f) === prog && f.bars === pb)) ||
      take(p, f => !lvProg(f)) ||
      (p === 'bass' || !prog ? take(p) : null);
    o[3] = o[3] || fit('bass');
    o[5] = fit('pad');
    o[6] = fit('lead');
    /* the pluck makes room for the lead: not both busy, and not in the same register */
    const lead = facById(o[6]);
    o[7] = fit('pluck', f => !lead || roomFor(f, lead));
    o[0] = take('kit');
    o[1] = take('hats');
    o[2] = take('perc');
    if (oneKit()) {
      o[0] = take('full') || o[0];
      o[1] = o[2] = null;
    }
    if (DEV === '101') o[5] = o[7] = null;
    /* o is by slot (the default layout's jobs); give each track its part. A second track doing the
       same job, or a track with its own pool (acid), gets a pattern of its own that fits too. */
    const tr = { chords: o[4] },
      seen = new Set();
    for (let t = 0; t < 8; t++) {
      const s = slotOf(t),
        pool = poolOf(t),
        own = !seen.has(s) && pool === roleInfo(DEF_ROLES[s])[4];
      seen.add(s);
      if (own || (s === 0 && oneKit())) tr[t] = o[s];
      else tr[t] = S.tracks[t].type === 'drum' ? take(pool) : fit(pool);
    }
    return tr;
  };
  const sets = { A: mkSet(), B: mkSet() },
    scenes = [];
  const MOVE = ['h2', 'alt', 'rest', 'odd'];
  for (const [name, kind, bars, e, fx, parts] of DEV === '101' ? LV_TPL101 : oneKit() ? LV_TPL1K : LV_TPL) {
    const cells = {};
    for (let t = 0; t < 8; t++) {
      const spec = parts[slotOf(t)];
      if (!spec) continue;
      const [set, play0] = spec.split(':');
      let id,
        pool = poolOf(t);
      if (set === 'R') {
        id = take('build', f => f.bars === bars) || take('build');
        pool = 'build';
      }
      if (t === trackOf(0) && oneKit() && set !== 'R') pool = 'full';
      if (!id) id = sets[set === 'R' ? 'A' : set][t];
      if (!id || !facById(id)) continue;
      let play = play0;
      if (S.tracks[t].type === 'tone' && r() < 0.25)
        play = play ? (r() < 0.5 ? null : play) : MOVE[Math.floor(r() * MOVE.length)];
      cells[t] = { id, pool };
      if (play) cells[t].play = play;
    }
    if (!Object.keys(cells).length)
      [0, 1, 3].map(trackOf).forEach(t => {
        if (t >= 0 && sets.A[t]) cells[t] = { id: sets.A[t], pool: poolOf(t) };
      });
    /* a lead and a pluck that would crowd each other take turns: the lead asks in the first half, the pluck answers */
    const tL = trackOf(6),
      tP = trackOf(7),
      ld = cells[tL] && facById(cells[tL].id),
      pk = cells[tP] && facById(cells[tP].id);
    if (ld && pk && bars >= 4 && !roomFor(ld, pk)) {
      cells[tL].play = 'h1';
      cells[tP].play = 'h2';
    }
    const sc = { kind, name, bars, e, cells };
    if (fx) sc.fx = fx;
    scenes.push(sc);
  }
  {
    /* a track with clips of another kind (e.g. a lead sound on the Chords track) switches to it in the B scenes, then back.
       Live Mode picks the clip itself, whatever Song Mode's automatic switching is set to. */
    for (let t = 0; t < 8; t++) {
      if (!devOn(t) || S.tracks[t].type !== 'tone') continue;
      const mm = cmFix()[t],
        own = patType({ pool: poolOf(t) });
      const alt = mm.types.slice(0, mm.n).find(ty => CT_POOL[ty] && ty !== own);
      if (!alt) continue;
      scenes.forEach(sc => {
        if (/ B$/.test(sc.name) && sc.cells[t]) {
          const cb = facById(sets.B.chords),
            pB = cb && lvProg(cb);
          const id = take(CT_POOL[alt], f => !pB || !lvProg(f) || (lvProg(f) === pB && f.bars === cb.bars));
          if (id) sc.cells[t] = { id, pool: CT_POOL[alt], play: sc.cells[t].play, clip: clipFor(t, alt) };
        }
      });
    }
  }
  LV.scenes = scenes;
  LV.fillIds = lvPool(st, 'fill');
  if (LV.cur >= scenes.length) LV.cur = 0;
  LV.ver++;
}
export function liveSwapIds(t) {
  const st = lvStyle(),
    pool = t === trackOf(0) && oneKit() ? 'full' : poolOf(t);
  return lvFlavor(lvPool(st, pool), LV.flavor).filter(id => {
    const f = facById(id);
    return f && f.type === S.tracks[t].type;
  });
}
