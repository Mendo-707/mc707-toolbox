// Live Mode with Patterns set to Composed (live/set-builder.js): the set is written by the composer, every
// tone part on one progression, the seven scenes with their jobs (a build in the Lift, a hook in the Peaks,
// a halftime Switch), swaps moving between the composed variants, and the jam playing it with auto-pilot.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Live Mode, Patterns: Composed: a set written from one progression, played with auto-pilot', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelector('#lvSetDet').open = true;
  });
  await page.locator('#lvFlavor').selectOption('composed');
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV,
      S = a.S;
    a.ensureAudio();
    a.TICKER.stop();
    const sc = LV.scenes,
      f = id => a.facById(id),
      progs = new Set(),
      names = sc.map(s => s.name);
    for (const s of sc)
      for (const t in s.cells) {
        const p = f(s.cells[t].id);
        if (p && p.type === 'tone') progs.add(p._prog);
      }
    const lift = sc.find(s => s.kind === 'build'),
      peak = sc.find(s => s.name === 'Peak'),
      tone = t => S.tracks[t].type === 'tone';
    const swaps = [0, 1, 2, 3, 4, 5, 6, 7].map(t => a.liveSwapIds(t).every(id => f(id) && f(id).composed));
    /* play it: auto-pilot on, 64 bars */
    LV.auto = true;
    a.live.jamStart();
    const seen = new Set();
    let notes = 0;
    for (let n = 0; n < 64 * 32; n++) {
      a.processTick(a.TR.tick, a.TR.nextTime);
      a.advance();
      seen.add(LV.cur);
    }
    notes = window.__out ? window.__out.length : 0;
    a.stopAll();
    return {
      names,
      progs: progs.size,
      composed: sc.every(s => Object.values(s.cells).every(c => f(c.id) && f(c.id).composed)),
      liftEnds: lift && Object.values(lift.cells).every(c => !f(c.id).notes.some(x => x.s >= f(c.id).bars * 16 - 4)),
      hook: peak && Object.keys(peak.cells).some(t => tone(+t) && f(peak.cells[t].id).name.startsWith('Hook')),
      swaps: swaps.every(Boolean),
      scenes: seen.size
    };
  });
  assert.deepEqual(r.names, ['Groove', 'Lift', 'Peak', 'Stripped', 'Groove B', 'Switch', 'Peak B']);
  assert.equal(r.progs, 1, 'every tone part on one progression');
  assert.ok(r.composed, 'every part composed');
  assert.ok(r.liftEnds, 'the Lift stops dead a beat before the drop');
  assert.ok(r.hook, 'the Peak has the hook');
  assert.ok(r.swaps, 'swaps move between composed parts');
  assert.ok(r.scenes >= 3, 'auto-pilot moves through the set: ' + r.scenes + ' scenes');
  assert.deepEqual(errors, []);
});

test('Auto-pilot switched on late, or with a cue of yours waiting at its moment, still moves on', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV;
    Object.assign(LV, { style: 'liquid', seed: 3, custom: false, auto: false, chaos: 30, flavor: 'lively' });
    a.liveBuild();
    a.ensureAudio();
    a.TICKER.stop();
    a.live.jamStart();
    const step = n => {
      for (let i = 0; i < n; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    /* 40 bars with auto-pilot off (the jam's intro, then past the moment it picks the next scene), then on */
    step(40 * 32);
    const first = LV.cur;
    LV.auto = true;
    let moved = null;
    for (let b = 0; b < 32 && moved == null; b++) {
      step(32);
      if (LV.cur !== first) moved = b + 1;
    }
    /* a cue waiting at the moment: auto-pilot picks up once it has gone */
    const at = LV.cur,
      sc = LV.scenes[at],
      total = sc.bars * 32 * LV.autoReps;
    while (a.TR.tick - LV.sceneStart < total - 64 - 1) step(1);
    LV.cues.push({ type: 'blend', tick: a.TR.tick + 1e9 });
    step(4 * 32);
    LV.cues = LV.cues.filter(c => c.type !== 'blend');
    let again = null;
    for (let b = 0; b < 32 && again == null; b++) {
      step(32);
      if (LV.cur !== at) again = b + 1;
    }
    a.stopAll();
    return { moved, again };
  });
  assert.ok(r.moved && r.moved <= 8, 'moves on at the end of the loop playing: ' + r.moved);
  assert.ok(r.again && r.again <= 8, 'moves on once the cue has gone: ' + r.again);
  assert.deepEqual(errors, []);
});

test('Composed is the default (a set on the old default moves to it), and the Wobble, Chop and Lift moves send their knobs', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-live': JSON.stringify({ flavor: 'lively' }) } });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    const flavor = LV.flavor,
      groups = [...document.querySelectorAll('#lvFlavor optgroup')].map(g => g.label);
    a.ensureAudio();
    await a.connectMidi();
    a.live.jamStart();
    a.TICKER.stop();
    const sent = [];
    const real = a.MIDI.out.send.bind(a.MIDI.out);
    a.MIDI.out.send = (m, t) => {
      if ((m[0] & 0xf0) === 0xb0) sent.push([(m[0] & 15) + 1, m[1], m[2]]);
      return real(m, t);
    };
    const run = (label, bars) => {
      [...document.querySelectorAll('.lvMain button')].find(b => b.textContent === label).click();
      for (let i = 0; i < bars * 32; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    const out = {};
    for (const [label, cc] of [
      ['Wobble', 80],
      ['Chop', 11],
      ['Lift', 71]
    ]) {
      sent.length = 0;
      run(label, 4);
      const v = sent.filter(m => m[1] === cc).map(m => m[2]);
      out[label] = { moved: new Set(v).size > 3, back: v.length ? v[v.length - 1] : null };
    }
    a.stopAll();
    return { flavor, groups, out };
  });
  assert.equal(r.flavor, 'composed', 'Composed by default');
  assert.deepEqual(r.groups, ['From the pattern library']);
  for (const k of ['Wobble', 'Chop', 'Lift']) assert.ok(r.out[k].moved, k + ' moves its knob');
  assert.deepEqual(errors, []);
});

test('A composed set has four takes of each part: bigger swap pools, and a scene that comes round again plays parts another way', async () => {
  const { page, errors } = await openApp({
    storage: { 'mc707-live': JSON.stringify({ flavor: 'composed', flavorPick: true, style: 'liquid' }) }
  });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
    const kitT = a.S.tracks.findIndex(t => t.type === 'drum'),
      bassT = a.S.tracks.findIndex(t => t.type === 'tone');
    const out = { kitPool: a.liveSwapIds(kitT).length, bassPool: a.liveSwapIds(bassT).length };
    const ids = () =>
      Object.values(LV.scenes[0].cells)
        .map(c => c.id)
        .join();
    const run = vary => {
      LV.vary = vary;
      LV.auto = false;
      a.liveStart(0);
      a.TICKER.stop();
      const first = ids();
      let changed = 0;
      for (let i = 0; i < 6; i++) {
        a.liveScene(0, a.TR.tick, true);
        if (ids() !== first) changed++;
      }
      /* every part it plays is on the set's one progression */
      const progs = new Set(
        Object.values(LV.scenes[0].cells)
          .map(c => a.facById(c.id))
          .filter(f => f && f.type === 'tone')
          .map(f => f._prog)
      );
      a.stopAll();
      return { changed, progs: progs.size };
    };
    out.off = run(0);
    a.liveBuild();
    out.high = run(80);
    return out;
  });
  assert.ok(r.kitPool >= 12, 'kit swaps to choose from: ' + r.kitPool);
  assert.ok(r.bassPool >= 12, 'bass swaps to choose from: ' + r.bassPool);
  assert.equal(r.off.changed, 0, 'Variation at 0 holds every scene as written');
  assert.ok(r.high.changed >= 4, 'the scene comes back another way: ' + r.high.changed);
  assert.equal(r.high.progs, 1, 'still one progression');
  assert.deepEqual(errors, []);
});
