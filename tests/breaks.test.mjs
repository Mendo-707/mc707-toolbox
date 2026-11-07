// Live Mode's breaks (live/breaks.js): Mix it up picks among the six there are (Unison hits, Stutter,
// Snare roll, Drop-out, Gate chop, Half-time), and a saved setting for a break that has gone (Tape stop,
// Vinyl brake, Spinback, Reverb wash) comes back as Mix it up.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Mix it up picks the six breaks, and only those', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'techno', seed: 1, custom: false, auto: false, brkStyle: 'mix', brkLen: 32 });
    a.liveBuild();
    document.querySelector('#lvStart').click();
    a.TICKER.stop();
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      a.live.down('brk');
      const c = LV.cues.find(c => c.type === 'brk');
      if (c) seen.add(c.b.kind);
      a.live.down('brk');
    }
    a.stopAll();
    return { kinds: [...seen].sort(), menu: [...document.querySelectorAll('option')].map(o => o.textContent) };
  });
  assert.deepEqual(r.kinds, ['drop', 'gate', 'half', 'hits', 'roll', 'stutter']);
  for (const gone of ['Tape stop', 'Vinyl brake', 'Spinback']) assert.ok(!r.menu.includes(gone), gone + ' is gone');
  assert.deepEqual(errors, []);
});

test('A saved break that has gone comes back as Mix it up', async () => {
  const { page, errors } = await openApp({
    storage: { 'mc707-live': JSON.stringify({ brkStyle: 'tape' }) }
  });
  assert.equal(await page.evaluate(() => window.__app.LV.brkStyle), 'mix');
  assert.deepEqual(errors, []);
});
