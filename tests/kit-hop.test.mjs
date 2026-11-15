// Three full kits (live/kit-hop.js): the beat stays on a kit and moves to another now and then (a
// turnaround, a flick, a switch at eight bars), always on the beat, most in drum and bass; with the setting
// off it stays on its tracks. And the half time is a
// touch now: two bars of the Switch, never left there by a swap.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Three full kits: the beat stays on a kit and moves now and then, on the beat; more in drum and bass', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  const plans = style =>
    page.evaluate(st => {
      const a = window.__app,
        LV = a.LV,
        out = [];
      a.S.threeKits = true;
      for (let seed = 1; seed <= 12; seed++) {
        Object.assign(LV, { style: st, flavor: 'composed', flavorPick: true, custom: false, seed });
        a.liveBuild();
        for (const sc of LV.scenes) out.push({ kind: sc.kind, segs: sc.hop ? sc.hop.segs : null });
      }
      a.S.threeKits = false;
      return out;
    }, style);
  const dnb = await plans('liquid'),
    house = await plans('deephouse');
  const moves = ps => ps.reduce((n, p) => n + (p.segs ? p.segs.length : 0), 0);
  assert.ok(
    dnb.every(p => p.segs),
    'every scene has a plan'
  );
  /* on the beat, and no more than one move in two bars (16 bars a plan: at most 8) */
  for (const p of [...dnb, ...house]) {
    for (const [a, b] of p.segs)
      assert.ok(a % 8 === 0 && b % 8 === 0 && b > a, 'on the beat: ' + JSON.stringify(p.segs));
    assert.ok(p.segs.length <= 8, 'not choppy: ' + JSON.stringify(p.segs));
  }
  const peaks = dnb.filter(p => p.kind === 'peak');
  assert.ok(peaks.filter(p => p.segs.length).length >= peaks.length / 2, 'drum and bass peaks move: ' + moves(peaks));
  assert.ok(moves(dnb) > 2 * moves(house), 'drum and bass moves more than house: ' + moves(dnb) + ' / ' + moves(house));
  assert.ok(
    house.filter(p => p.kind === 'groove' && !p.segs.length).length >=
      house.filter(p => p.kind === 'groove').length / 2,
    'a house groove mostly keeps its kit'
  );
  assert.ok(
    dnb.every(p => p.kind !== 'build' || !p.segs.length),
    'a lift keeps its kit'
  );
  /* played: the beat's kicks go out on the kits the plan says */
  const played = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    a.S.threeKits = true;
    Object.assign(LV, { style: 'liquid', flavor: 'composed', custom: false, auto: false, vary: 0 });
    let idx = -1;
    for (let seed = 1; idx < 0 && seed < 40; seed++) {
      LV.seed = seed;
      a.liveBuild();
      idx = LV.scenes.findIndex(s => s.kind === 'peak' && s.hop.segs.length);
    }
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
    const plan = LV.scenes[idx].hop,
      ks = [0, 1, 2].map(t => a.S.tracks[t].ch - 1);
    window.__out.length = 0;
    const at = [];
    a.liveStart(idx);
    a.TICKER.stop();
    while (a.TR.tick < 16 * 32) {
      const n0 = window.__out.length;
      a.processTick(a.TR.tick, a.TR.nextTime);
      for (const m of window.__out.slice(n0))
        if ((m[0] & 0xf0) === 0x90 && m[1] === 36 && m[2] > 0) at.push([a.TR.tick, ks.indexOf(m[0] & 15)]);
      a.advance();
    }
    a.stopAll();
    a.S.threeKits = false;
    return { plan, at };
  });
  const kitAt = r => {
    let k = played.plan.base;
    for (const [a, b, kk] of played.plan.segs) if (a <= r % 512 && r % 512 < b) k = kk;
    return k;
  };
  assert.ok(played.at.length > 20);
  /* (Drums 3 also plays a peak's own percussion part: at each moment, one kick is on the planned kit) */
  for (const tk of new Set(played.at.map(x => x[0])))
    assert.ok(
      played.at.some(x => x[0] === tk && x[1] === kitAt(tk)),
      'the kick at ' + tk + ' on the planned kit: ' + JSON.stringify(played.plan)
    );
  assert.ok(new Set(played.at.map(x => x[1])).size >= 2, 'the beat moved');
  /* off: no plan, and Drums 2 has no hats part of its own with three kits on */
  const cells = await page.evaluate(() => {
    const a = window.__app;
    a.liveBuild();
    const off = a.LV.scenes.every(s => !s.hop);
    a.S.threeKits = true;
    a.liveBuild();
    const r = a.LV.scenes.map(s =>
      Object.keys(s.cells)
        .map(Number)
        .filter(t => t < 3)
    );
    a.S.threeKits = false;
    a.liveBuild();
    return { off, r };
  });
  assert.ok(cells.off, 'no plan with the setting off');
  assert.ok(
    cells.r.every(ts => !ts.includes(1)),
    'Drums 2 is free for the beat: ' + JSON.stringify(cells.r)
  );
  /* the timeline draws the beat on the kits it moves to */
  const drawn = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.S.threeKits = true;
    Object.assign(LV, { style: 'liquid', flavor: 'composed', custom: false });
    let idx = -1;
    for (let seed = 1; idx < 0 && seed < 40; seed++) {
      LV.seed = seed;
      a.liveBuild();
      idx = LV.scenes.findIndex(s => s.hop.segs.some(x => x[0] < 4 * 32));
    }
    a.liveStart(idx);
    a.TICKER.stop();
    for (let i = 0; i < 40; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    LV.ver++;
    await new Promise(r => setTimeout(r, 400));
    const n = document.querySelectorAll('.lvCell.hop, .lvCell.chop').length;
    a.stopAll();
    a.S.threeKits = false;
    return n;
  });
  assert.ok(drawn > 0, 'the moving beat shows on the timeline');
  assert.deepEqual(errors, []);
});

test('Half time is a touch: the Switch has two bars of it, and swaps never land on it', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV;
    Object.assign(LV, { style: 'liquid', flavor: 'composed', flavorPick: true, custom: false, seed: 7 });
    a.liveBuild();
    const sw = LV.scenes.find(s => s.name === 'Switch'),
      kt = a.S.tracks.findIndex(x => x.type === 'drum'),
      f = a.facById(sw.cells[kt].id),
      snares = b =>
        f.notes.filter(n => [2, 3].includes(n.n) && n.v >= 85 && Math.floor(n.s / 16) === b).map(n => n.s % 16);
    const swaps = [0, 1, 2, 3, 4, 5, 6, 7].flatMap(t => a.liveSwapIds(t) || []);
    return { bar1: snares(0), bar5: snares(4), bar7: snares(6), half: swaps.filter(id => /-half(~|$)/.test(id)) };
  });
  assert.ok(r.bar1.includes(4) && r.bar1.includes(12), 'the Switch opens on the groove: ' + r.bar1);
  assert.ok(r.bar5.includes(8) && !r.bar5.includes(4), 'two bars of half time: ' + r.bar5);
  assert.ok(r.bar7.includes(4) && r.bar7.includes(12), 'and back: ' + r.bar7);
  assert.deepEqual(r.half, [], 'no half time among the swaps');
  assert.deepEqual(errors, []);
});
