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
    /* (long enough for the key lift, a one-in-three chance out of each breakdown, to come up) */
    const end = TR.tick + Math.round((24 * LV.bpm) / 4) * 32;
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

test('Auto-pilot: the journey suits the genre, and scenes play different lengths', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  const run = style =>
    page.evaluate(async st => {
      const a = window.__app,
        LV = a.LV;
      a.ensureAudio();
      await a.connectMidi();
      a.stopAll();
      Object.assign(LV, {
        style: st,
        flavor: 'composed',
        flavorPick: true,
        custom: false,
        auto: true,
        seed: 3,
        chaos: 40
      });
      a.liveBuild();
      Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
      a.liveStart(0);
      a.TICKER.stop();
      const seq = [];
      while (a.TR.tick < 200 * 32) {
        if (a.TR.tick % 32 === 0) {
          const k = LV.scenes[LV.cur].kind,
            last = seq[seq.length - 1];
          if (last && last[0] === LV.cur) last[2]++;
          else seq.push([LV.cur, k, 1]);
        }
        a.processTick(a.TR.tick, a.TR.nextTime);
        a.advance();
      }
      a.stopAll();
      return seq.slice(0, -1);
    }, style);
  const dnb = await run('liquid'),
    hiphop = await run('boombap'),
    house = await run('deephouse'),
    ambient = await run('ambient');
  const kinds = s => s.map(x => x[1]);
  /* drum and bass: lifts into peaks, again and again */
  assert.ok(kinds(dnb).filter(k => k === 'build').length >= 2, 'drum and bass builds: ' + kinds(dnb));
  /* hip hop: verse then hook, no lift before the first hook */
  assert.deepEqual(kinds(hiphop).slice(0, 2), ['groove', 'peak'], 'verse then hook: ' + kinds(hiphop));
  assert.ok(kinds(hiphop).filter(k => k === 'build').length <= 1, 'one lift at most: ' + kinds(hiphop));
  /* house: grooves twice before the first lift */
  assert.deepEqual(kinds(house).slice(0, 2), ['groove', 'groove'], 'grooves first: ' + kinds(house));
  /* ambient: no lift */
  assert.ok(!kinds(ambient).includes('build'), 'ambient drifts: ' + kinds(ambient));
  /* lengths: an 8-bar scene does not always play the same number of loops */
  const lens = [dnb, hiphop, house, ambient].flatMap(s => s.filter(x => x[1] !== 'build').map(x => x[2]));
  assert.ok(new Set(lens).size >= 3, 'scene lengths vary: ' + [...new Set(lens)]);
  assert.deepEqual(errors, []);
});
