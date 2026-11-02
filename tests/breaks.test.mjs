// Live Mode's tape stop, vinyl brake and spinback breaks (live/breaks.js): the loop slows to a stop (notes
// further and further apart, longer, the pitch bending down) or runs backwards with the pitch bending up,
// goes quiet, the pitch comes back to the middle, and the loop drops back in on the downbeat. Mix it up picks
// them too, and the pitch goes back to the middle when you stop mid-break.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* a set playing, then a 2-bar break of `kind`: what went out, tick by tick */
const runBreak = (page, kind) =>
  page.evaluate(async kind => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'deephouse', seed: 3, custom: false, auto: false, brkStyle: kind, brkLen: 64 });
    a.liveBuild();
    document.querySelector('#lvStart').click();
    a.TICKER.stop();
    const step = () => (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    while (a.TR.tick < 32 * 12) step();
    a.live.down('brk');
    a.live.up && a.live.up('brk');
    const cue = LV.cues.find(c => c.type === 'brk');
    if (!cue) return { err: 'no break queued' };
    while (a.TR.tick < cue.tick) step();
    const start = a.TR.tick,
      end = start + 64,
      ticks = [];
    let i = window.__out.length;
    while (a.TR.tick < end + 32) {
      step();
      const out = window.__out.slice(i);
      i = window.__out.length;
      ticks.push({
        rel: a.TR.tick - 1 - start,
        notes: out.filter(b => (b[0] & 0xf0) === 0x90 && b[2] > 0).length,
        bends: out.filter(b => (b[0] & 0xf0) === 0xe0).map(b => b[1] + b[2] * 128)
      });
    }
    a.stopAll();
    return { name: cue.b.name, ticks };
  }, kind);

const sum = (ts, from, to) => ts.filter(t => t.rel >= from && t.rel < to).reduce((n, t) => n + t.notes, 0);
const bends = (ts, from, to) => ts.filter(t => t.rel >= from && t.rel < to).flatMap(t => t.bends);

test('Tape stop: slows to a stop with the pitch sinking, silence, back to the middle, then the drop', async () => {
  const { page, errors } = await openApp();
  const r = await runBreak(page, 'tape');
  assert.ok(!r.err, r.err);
  assert.equal(r.name, 'Tape stop');
  const T = r.ticks;
  /* notes thin out as it slows: more in the first quarter than in the third */
  assert.ok(sum(T, 0, 16) > sum(T, 32, 48), `slowing: ${sum(T, 0, 16)} then ${sum(T, 32, 48)}`);
  assert.equal(sum(T, 50, 64), 0, 'silent once stopped');
  const down = bends(T, 0, 48);
  assert.ok(down.length > 8 && Math.min(...down) < 2000, 'the pitch sinks');
  assert.ok(
    down.every((v, i) => i === 0 || v <= down[i - 1] + 1),
    'and only goes down'
  );
  assert.ok(bends(T, 48, 64).includes(8192), 'back to the middle before the drop');
  assert.ok(sum(T, 64, 96) > 0, 'the loop drops back in');
  assert.deepEqual(errors, []);
});

test('Vinyl brake stops sooner; Spinback bends up and runs backwards; Stop puts the pitch back', async () => {
  const { page, errors } = await openApp();
  const b = await runBreak(page, 'brake');
  assert.equal(b.name, 'Vinyl brake');
  assert.equal(sum(b.ticks, 28, 64), 0, 'a brake is over in under half the break');
  assert.ok(bends(b.ticks, 0, 28).some(v => v < 3000));
  const s = await runBreak(page, 'spin');
  assert.equal(s.name, 'Spinback');
  const up = bends(s.ticks, 0, 32);
  assert.ok(Math.max(...up) > 14000, 'the pitch rises');
  assert.ok(sum(s.ticks, 0, 32) > 0 && sum(s.ticks, 34, 64) === 0, 'rewinds, then silence');
  assert.ok(bends(s.ticks, 32, 64).includes(8192), 'back to the middle');
  /* stopped mid-break: the pitch goes back to the middle on every channel */
  const centred = await page.evaluate(() => {
    const a = window.__app;
    document.querySelector('#lvStart').click();
    window.__out.length = 0;
    a.stopAll();
    return window.__out.filter(b => (b[0] & 0xf0) === 0xe0 && b[1] === 0 && b[2] === 64).length;
  });
  assert.ok(centred >= 16, 'pitch centred on stop (' + centred + ')');
  assert.deepEqual(errors, []);
});

test('Mix it up picks the new breaks too', async () => {
  const { page, errors } = await openApp();
  const kinds = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'techno', seed: 1, custom: false, auto: false, brkStyle: 'mix', brkLen: 32 });
    a.liveBuild();
    document.querySelector('#lvStart').click();
    a.TICKER.stop();
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      a.live.down('brk');
      const c = LV.cues.find(c => c.type === 'brk');
      if (c) seen.add(c.b.kind);
      a.live.down('brk');
    }
    a.stopAll();
    return [...seen];
  });
  for (const k of ['tape', 'brake', 'spin', 'hits']) assert.ok(kinds.includes(k), k + ' in ' + kinds);
  assert.deepEqual(errors, []);
});
