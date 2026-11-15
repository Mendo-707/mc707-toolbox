// Three full kits (live/kit-hop.js): the beat moves between Drums 1, 2 and 3, fast in drum and bass, a
// whole scene at a time in house; with the setting off it stays on its tracks. And the half time is a
// touch now: two bars of the Switch, never left there by a swap.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* Play each scene of a composed set for 8 bars; per scene, which drum channels the kicks went to (the beat:
   Drums 3 still plays the builds' rolls and the peaks' percussion as parts of their own), and
   how often the channel changed */
const RUN = `async (c) => {
  const a = window.__app, LV = a.LV;
  a.ensureAudio(); await a.connectMidi();
  a.stopAll();
  a.S.threeKits = c.three; a.S.oneKit = false;
  /* (Variation off: its Breaks hit every kit at once, on purpose) */
  Object.assign(LV, { style: c.style, flavor: 'composed', flavorPick: true, custom: false, seed: 7, auto: false, vary: 0 });
  a.liveBuild();
  Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
  const drums = [0, 1, 2].map(s => a.S.tracks.findIndex((x, t) => x.type === 'drum' && t === s)).map(t => a.S.tracks[t].ch - 1);
  const out = [];
  a.liveStart(0); a.TICKER.stop();
  for (let i = 0; i < LV.scenes.length; i++) {
    const sc = LV.scenes[i];
    if (i) { a.liveCue(i); while (LV.cur !== i) { a.processTick(a.TR.tick, a.TR.nextTime); a.advance(); } }
    window.__out.length = 0;
    const end = a.TR.tick + 8 * 32;
    while (a.TR.tick < end) { a.processTick(a.TR.tick, a.TR.nextTime); a.advance(); }
    const chs = window.__out.filter(m => (m[0] & 0xf0) === 0x90 && m[2] > 0 && drums.includes(m[0] & 15) && m[1] === 36).map(m => m[0] & 15);
    let moves = 0; for (let j = 1; j < chs.length; j++) if (chs[j] !== chs[j - 1]) moves++;
    out.push({ name: sc.name, kind: sc.kind, hop: sc.hop || null, used: [...new Set(chs)].length, moves, n: chs.length });
  }
  a.stopAll();
  return out;
}`;

test('Three full kits: the beat moves between the drum tracks, fast in drum and bass and slow in house', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  const dnb = await page.evaluate(`(${RUN})(${JSON.stringify({ style: 'liquid', three: true })})`);
  const peak = dnb.filter(s => s.kind === 'peak' && s.n > 20);
  assert.ok(peak.length, JSON.stringify(dnb));
  for (const s of peak)
    assert.ok(s.used >= 2 && s.moves >= 6, 'drum and bass peak chops between kits: ' + JSON.stringify(s));
  /* the scenes start on different kits */
  const house = await page.evaluate(`(${RUN})(${JSON.stringify({ style: 'deephouse', three: true })})`);
  const grooves = house.filter(s => s.kind === 'groove' && s.n > 20);
  for (const s of grooves) assert.equal(s.used, 1, 'a house groove keeps one kit: ' + JSON.stringify(s));
  assert.ok(new Set(house.map(s => s.hop)).size >= 1);
  /* off: the kick, snare and hats stay on their own tracks, as before */
  const off = await page.evaluate(`(${RUN})(${JSON.stringify({ style: 'liquid', three: false })})`);
  assert.ok(
    off.every(s => !s.hop),
    'no plan with the setting off'
  );
  /* with three kits on, Drums 2 plays no hats part of its own (the hats are in the beat) */
  const cells = await page.evaluate(() => {
    const a = window.__app;
    a.S.threeKits = true;
    a.liveBuild();
    const r = a.LV.scenes.map(s =>
      Object.keys(s.cells)
        .map(Number)
        .filter(t => t < 3)
    );
    a.S.threeKits = false;
    a.liveBuild();
    return r;
  });
  assert.ok(
    cells.every(ts => !ts.includes(1)),
    'Drums 2 is free for the beat: ' + JSON.stringify(cells)
  );
  /* the timeline draws the beat on the kits it moves to */
  const drawn = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.S.threeKits = true;
    Object.assign(LV, { style: 'liquid', flavor: 'composed', custom: false, seed: 7 });
    a.liveBuild();
    a.liveStart(LV.scenes.findIndex(s => s.hop === 'half' || s.hop === 'beat' || s.hop === 'bar'));
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
