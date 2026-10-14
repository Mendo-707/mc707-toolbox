// Builds a Live set: picks matching patterns for each scene from the style's pools.
//
// Reads: S, LV, DEV.
import { DEV, devOn, oneKit } from '../core/device.js';
import { S } from '../core/state.js';
import { TRACK_POOLS, facById } from '../library/index.js';
import { CT_POOL, cmFix, patType } from '../services/clip-switch.js';
import { mulberry } from '../core/random.js';
import { LV, lvStyle } from './state.js';
import { lvIsFlash } from './themes.js';
import { lvLoadScenes } from './scene-editor.js';
import { LV_TPL, LV_TPL101, LV_TPL1K } from './scene-templates.js';
import { lvFlavor, lvModeFam, lvPool, lvProg } from '../library/pools.js';

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
    const cf = facById(o[4]),
      prog = cf && lvProg(cf),
      pb = cf && cf.bars;
    const fit = p => (prog && take(p, f => lvProg(f) === prog && f.bars === pb)) || take(p, f => !lvProg(f)) || take(p);
    o[3] = fit('bass');
    o[5] = fit('pad');
    o[7] = fit('pluck');
    o[6] = take('lead');
    o[0] = take('kit');
    o[1] = take('hats');
    o[2] = take('perc');
    if (oneKit()) {
      o[0] = take('full') || o[0];
      o[1] = o[2] = null;
    }
    if (DEV === '101') o[5] = o[7] = null;
    return o;
  };
  const sets = { A: mkSet(), B: mkSet() },
    scenes = [];
  const MOVE = ['h2', 'alt', 'rest', 'odd'];
  for (const [name, kind, bars, e, fx, parts] of DEV === '101' ? LV_TPL101 : oneKit() ? LV_TPL1K : LV_TPL) {
    const cells = {};
    for (const t in parts) {
      const [set, play0] = parts[t].split(':');
      let id,
        pool = TRACK_POOLS[t];
      if (set === 'R') {
        id = take('build', f => f.bars === bars) || take('build');
        pool = 'build';
      }
      if (+t === 0 && oneKit() && set !== 'R') pool = 'full';
      if (!id) id = sets[set === 'R' ? 'A' : set][t];
      if (!id || !facById(id)) continue;
      let play = play0;
      if (+t >= 3 && r() < 0.25) play = play ? (r() < 0.5 ? null : play) : MOVE[Math.floor(r() * MOVE.length)];
      cells[t] = { id, pool };
      if (play) cells[t].play = play;
    }
    if (!Object.keys(cells).length)
      [0, 1, 3].forEach(t => {
        if (sets.A[t]) cells[t] = { id: sets.A[t], pool: TRACK_POOLS[t] };
      });
    const sc = { kind, name, bars, e, cells };
    if (fx) sc.fx = fx;
    scenes.push(sc);
  }
  if (S.clipAuto) {
    /* a track with clips of another kind (e.g. a lead sound on the Chords track) switches to it in the B scenes, then back */
    for (const t of [3, 4, 5, 6, 7]) {
      if (!devOn(t)) continue;
      const mm = cmFix()[t],
        own = patType({ pool: TRACK_POOLS[t] });
      const alt = mm.types.slice(0, mm.n).find(ty => CT_POOL[ty] && ty !== own);
      if (!alt) continue;
      scenes.forEach(sc => {
        if (/ B$/.test(sc.name) && sc.cells[t]) {
          const id = take(CT_POOL[alt]);
          if (id) sc.cells[t] = { id, pool: CT_POOL[alt], play: sc.cells[t].play };
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
    pool = t === 0 && oneKit() ? 'full' : TRACK_POOLS[t];
  return lvFlavor(lvPool(st, pool), LV.flavor).filter(id => {
    const f = facById(id);
    return f && (t < 3 ? f.type === 'drum' : f.type === 'tone');
  });
}
