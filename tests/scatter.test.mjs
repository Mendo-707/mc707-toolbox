// Scatter in the app (live/scatter.js): holding a Scatter pad plays Live Mode's own loop out of order (here:
// Skip leaves out every other 16th, Stop-go a beat on and a beat off, Repeat 1/16 the same 16th over and
// over), only on the parts chosen, and letting go puts it back; the MC-707's own Scatter is only sent when
// switched on.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Scatter: held pads change the app’s loop on the parts chosen, and letting go puts it back', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(() => document.querySelector('[data-mode="live"]:not(body)').click());
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'techno', seed: 3, custom: false, auto: false, vary: 0, scatTo: 'all', scHw: false });
    a.liveBuild();
    a.liveStart(0);
    a.TICKER.stop();
    const step = () => (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    const chOf = new Map(a.S.tracks.map((t, i) => [t.ch - 1, i]));
    /* the note-ons sent on each tick: [[tick, track, note], ...] */
    const run = n => {
      const out = [];
      for (let k = 0; k < n; k++) {
        const t0 = a.TR.tick,
          i = window.__out.length;
        step();
        for (const b of window.__out.slice(i))
          if ((b[0] & 0xf0) === 0x90 && b[2] > 0 && chOf.has(b[0] & 15)) out.push([t0, chOf.get(b[0] & 15), b[1]]);
      }
      return out;
    };
    const pad = name => document.querySelector('#lvSc' + a.SCATTERS.findIndex(s => s[1] === name));
    const hold = (name, n) => {
      pad(name).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const out = run(n);
      pad(name).dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      return out;
    };
    while (a.TR.tick < 32 * 4) step();
    const normal = run(64);
    const skip = hold('Skip', 64);
    const stop = hold('Stop-go', 64);
    const rep = hold('Repeat 1/16', 32);
    const back = run(64);
    /* drums only: the melodic parts carry on as written while Skip holds */
    LV.scatTo = 'drums';
    const drumsOnly = hold('Skip', 64);
    const ctrl = window.__out.filter(b => b[0] === (0x90 | ((a.S.ctrlCh || 16) - 1))).length;
    a.stopAll();
    return { normal, skip, stop, rep, back, drumsOnly, ctrl, tone: a.S.tracks.map(t => t.type === 'tone') };
  });
  const odd16 = ev => ev.filter(([t]) => Math.floor(t / 2) % 2 === 1);
  assert.ok(odd16(r.normal).length > 0, 'the loop has notes on the off 16ths');
  assert.equal(odd16(r.skip).length, 0, 'Skip leaves out every other 16th');
  assert.ok(r.skip.length > 0, 'and plays the rest');
  const t0 = r.stop[0] ? r.stop[0][0] - (r.stop[0][0] % 8) : 0;
  assert.equal(
    r.stop.filter(([t]) => Math.floor((t - t0) / 8) % 2 === 1).length,
    0,
    'Stop-go: silent every other beat'
  );
  /* Repeat 1/16: every 16th sends the same notes */
  const per16 = new Map();
  for (const [t, tr, n] of r.rep) {
    const k = Math.floor(t / 2);
    per16.set(k, [...(per16.get(k) || []), tr + ':' + n].sort().join());
  }
  assert.ok(per16.size >= 8 && new Set(per16.values()).size === 1, 'Repeat 1/16: the same 16th over and over');
  assert.ok(odd16(r.back).length > 0, 'let go: the loop is back');
  assert.ok(
    odd16(r.drumsOnly).some(([, tr]) => r.tone[tr]) && !odd16(r.drumsOnly).some(([, tr]) => !r.tone[tr]),
    'drums only: the melodic parts are left alone'
  );
  assert.equal(r.ctrl, 0, 'the MC-707’s Scatter is not sent unless switched on');
  assert.deepEqual(errors, []);
});
