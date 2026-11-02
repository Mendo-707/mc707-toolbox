// The MC-707 dropping off USB and coming back (ui/link-watch.js) in Song and Synth Mode: a warning while it
// is gone; when it is back, notes released, the song's mix sent again, where the song is and Continue for
// an MC-707 following the clock, Synth Mode's mix sent again, and its MIDI in listened to again. (Live
// Mode's return is in engine.test.mjs.)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* unplug, then plug back in: the mock's ports change state, and the browser tells the app (statechange) */
const unplug = page =>
  page.evaluate(async () => {
    const acc = await navigator.requestMIDIAccess();
    acc.outputs.get('o1').state = 'disconnected';
    acc.inputs.get('i1').state = 'disconnected';
    acc.inputs.get('i1').onmidimessage = null;
    await window.__app.connectMidi();
  });
const plugIn = page =>
  page.evaluate(async () => {
    const acc = await navigator.requestMIDIAccess();
    acc.outputs.get('o1').state = 'connected';
    acc.inputs.get('i1').state = 'connected';
    window.__out.length = 0;
    await window.__app.connectMidi();
  });

test('Reconnect in Song Mode: the mix again, the position and Continue, and MIDI in heard again', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => {
    const a = window.__app;
    a.ensureAudio();
    await a.connectMidi();
    a.S.clock = true;
    a.S.midiIn = 'i1';
    a.S.tracks[3].cc = { ...a.S.tracks[3].cc, 7: 77 };
  });
  await page.click('#bPlay');
  await page.evaluate(() => {
    const a = window.__app,
      end = a.TR.tick + 200;
    while (a.TR.tick < end) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
  });
  await unplug(page);
  assert.match(await page.locator('#linkWarn').textContent(), /disconnected/);
  await plugIn(page);
  const r = await page.evaluate(() => {
    const out = window.__out,
      a = window.__app,
      ch = a.S.tracks[3].ch - 1,
      i = out.findIndex(b => b[0] === 0xf2);
    return {
      hidden: document.querySelector('#linkWarn').hidden,
      notesOff: out.some(b => (b[0] & 0xf0) === 0xb0 && b[1] === 123),
      level: out.some(b => b[0] === (0xb0 | ch) && b[1] === 7 && b[2] === 77),
      spp: i >= 0 ? out[i][1] + out[i][2] * 128 : -1,
      cont: i >= 0 && out[i + 1] && out[i + 1][0] === 0xfb,
      tick: a.TR.tick,
      listening: typeof navigator.requestMIDIAccess === 'function'
    };
  });
  assert.equal(r.hidden, true, 'the warning goes');
  assert.ok(r.notesOff, 'notes released');
  assert.ok(r.level, 'the song’s mix sent again');
  assert.ok(Math.abs(r.spp - Math.round(r.tick / 2)) <= 1, 'where the song is, in 16ths (' + r.spp + ')');
  assert.ok(r.cont, 'then Continue');
  /* its pads are heard again */
  const heard = await page.evaluate(async () => {
    const acc = await navigator.requestMIDIAccess();
    return typeof acc.inputs.get('i1').onmidimessage === 'function';
  });
  assert.ok(heard, 'MIDI in listened to again');
  await page.click('#bPlay');
  assert.deepEqual(errors, []);
});

test('Reconnect in Synth Mode: the mix sent again', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate(() => document.querySelector('[data-mode="synth"]:not(body)').click());
  await page.waitForTimeout(300);
  await unplug(page);
  await plugIn(page);
  const levels = await page.evaluate(() => window.__out.filter(b => (b[0] & 0xf0) === 0xb0 && b[1] === 7).length);
  assert.ok(levels >= 8, 'every track’s level (' + levels + ')');
  assert.deepEqual(errors, []);
});
