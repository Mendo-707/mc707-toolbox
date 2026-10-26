// The mixers' effects: each strip's Effect chooser and the Master FX strip, wired to zen/zc-fx.js through
// hooks.fx (Song and Live Mode cannot import zen). Shared by both mixers.
//
// Reads: hooks.fx (FXN: what was last chosen or read).
import { hooks } from '../core/hooks.js';
import { toast } from '../core/dom.js';
import { masterStrip } from './mixer-strip.js';

const NOT = 'Connect the MC-707 (the ZenCore editor’s link) to change its effects';

/** The track's effect for mixStrip: [s.fx, o.fx], or [null, null] without the effects module. */
export function trackFxFor(t, redraw) {
  const F = hooks.fx;
  if (!F) return [null, null];
  const now = F.now.track[t];
  return [
    { choices: F.choices(), cur: now ? now.id : null, busy: !!(now && now.busy) },
    async id => {
      const run = F.trackFx(t, id);
      redraw();
      const ok = await run.catch(() => false);
      redraw();
      if (!ok) toast(NOT);
    }
  ];
}

let busy = false;
/** The Master FX strip (null without the effects module). */
export function masterFor(redraw) {
  const F = hooks.fx;
  if (!F) return null;
  return masterStrip(
    { choices: F.choices(), rev: F.REV_TYPES, cho: F.CHO_TYPES, m: F.now.master, busy },
    {
      set: async (what, v) => {
        busy = true;
        const run = F.setMaster(what, v);
        /* levels move as you drag: no redraw (it would drop the slider), the others show at once */
        if (!/Level|Send/.test(what)) redraw();
        const ok = await run.catch(() => false);
        busy = false;
        if (!/Level|Send/.test(what)) redraw();
        if (!ok) toast(NOT);
      },
      read: async () => {
        const m = await F.readMaster().catch(() => null);
        if (!m) toast('The MC-707 did not answer: connect it (the ZenCore editor’s link) and try again');
        redraw();
      }
    }
  );
}
