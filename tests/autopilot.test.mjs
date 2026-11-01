// Auto-pilot (live/autopilot.js) and the lead pack (library/lead-pack.js): over a long set the scenes follow
// an arc instead of going round the list, a lift builds into the peak, fresh patterns come in now and then,
// a key lift goes back home with them, and the lead pack's parts land on their chords in straight time.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Auto-pilot: an arc of scenes, builds into peaks, fresh patterns and key lifts that come home', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV,
      TR = a.TR;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'techno', seed: 3, custom: false, auto: true, chaos: 60 });
    LV.mode = null;
    a.liveBuild();
    const home = LV.key;
    a.live.jamStart();
    a.TICKER.stop();
    const end = TR.tick + Math.round((14 * LV.bpm) / 4) * 32;
    const seq = [],
      keys = new Set();
    let last = -1,
      builds = 0,
      fresh = 0,
      sets = LV.scenes;
    while (TR.playing && TR.tick < end) {
      if (TR.tick % 32 === 0) {
        if (LV.cur !== last) seq.push(LV.scenes[(last = LV.cur)].name);
        if (LV.bov) builds++;
        if (LV.scenes !== sets) (fresh++, (sets = LV.scenes));
        keys.add(LV.key);
      }
      a.processTick(TR.tick, TR.nextTime);
      a.advance();
    }
    a.stopAll();
    return { seq, builds, fresh, keys: [...keys], home, keyNow: LV.key };
  });
  const order = ['Groove', 'Lift', 'Peak', 'Stripped', 'Groove B', 'Tool', 'Peak B'];
  const cycle = r.seq.slice(1).every((n, i) => order.indexOf(n) === (order.indexOf(r.seq[i]) + 1) % order.length);
  assert.ok(!cycle, 'not just round the list: ' + r.seq.join(' > '));
  assert.ok(r.seq.length > 30, 'scenes change: ' + r.seq.length);
  assert.ok(r.builds > 0, 'a lift builds into its peak');
  assert.ok(r.fresh >= 1, 'fresh patterns come in');
  assert.ok(r.keys.length > 1, 'the key lifts now and then');
  assert.ok(
    r.keys.every(k => (k - r.home + 12) % 12 <= 4),
    'never more than two tones from home'
  );
  assert.deepEqual(errors, []);
});

test('Lead pack: every progression gets hooks and plucks on its chords, in straight time', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const a = window.__app,
      M = a.melody,
      L = a.FAC.filter(f => /^lp\d/.test(f.id));
    let n = 0,
      tones = 0;
    for (const f of L) {
      const s = M.score(f);
      if (s) (n++, (tones += s.tones));
    }
    return {
      count: L.length,
      leads: L.filter(f => f.pool === 'lead').length,
      plucks: L.filter(f => f.pool === 'pluck').length,
      tones: tones / n,
      offGrid: L.filter(f => M.isTriplet(f) || M.isDotted(f)).length,
      named: L.every(f => /(?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3,}/.test(f.name) && f.key && f.bars >= 1)
    };
  });
  assert.ok(r.leads > 1500 && r.plucks > 1000, JSON.stringify(r));
  assert.ok(r.tones > 0.9, 'strong beats on chord tones: ' + r.tones);
  assert.equal(r.offGrid, 0);
  assert.ok(r.named, 'each part names its progression and keeps its key');
  assert.deepEqual(errors, []);
});
