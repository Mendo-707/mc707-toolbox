// Connecting by itself (ui/auto-connect.js): as the desktop app opens with an MC-707 plugged in, it connects
// fully with no button pressed (notes out, its pads and keys in, the clock the first time), and one plugged in
// later is connected the same way. Settings › Connect to the MC-707 by itself turns it off. In a browser the
// app never asks for MIDI as it opens.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

/* the desktop app (window.toolbox), and the MC-707 unplugged as it opens when `late` */
const desktop = late => {
  window.toolbox = {};
  if (late && !sessionStorage.getItem('__late')) {
    sessionStorage.setItem('__late', '1');
    const req = navigator.requestMIDIAccess;
    navigator.requestMIDIAccess = async o => {
      const acc = await req(o);
      if (!window.__plugged) {
        acc.outputs.get('o1').state = 'disconnected';
        acc.inputs.get('i1').state = 'disconnected';
      }
      return acc;
    };
  }
};
const state = page =>
  page.evaluate(() => {
    const a = window.__app;
    return {
      out: a.MIDI && a.MIDI.out ? a.MIDI.out.name : null,
      inp: a.MIDI && a.MIDI.inp ? a.MIDI.inp.name : null,
      clock: !!a.S.clock,
      toast: [...document.querySelectorAll('#toast, .toast')].map(t => t.textContent).join(' ')
    };
  });

test('Auto-connect: the desktop app connects to the MC-707 fully as it opens', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-autoconnect': '1' } });
  await page.addInitScript(desktop, false);
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.MIDI && window.__app.MIDI.inp, null, {
    timeout: 8000
  });
  const r = await state(page);
  assert.equal(r.out, 'MC-707 MIDI 1', 'notes out');
  assert.equal(r.inp, 'MC-707 MIDI 1', 'pads and keys in');
  assert.equal(r.clock, true, 'the MC-707 follows the clock');
  assert.match(r.toast, /MC-707 MIDI 1 connected: notes, pads and keys, clock and sounds/);
  /* turned off, the next start leaves it to you */
  await page.locator('#menubar .mb', { hasText: 'Settings' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Connect to the MC-707 by itself' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('mc707-autoconnect')), '0');
  await page.reload();
  await page.waitForFunction(() => window.__app);
  await page.waitForTimeout(800);
  assert.equal((await state(page)).out, null, 'off: not connected until you say');
  assert.deepEqual(errors, []);
});

test('Auto-connect: an MC-707 plugged in later is connected the same way; a browser never asks at launch', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-autoconnect': '1' } });
  await page.addInitScript(desktop, true);
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.MIDI && window.__app.MIDI.access, null, {
    timeout: 8000
  });
  assert.equal((await state(page)).out, null, 'nothing plugged in yet');
  /* plugged in: the browser says the ports changed */
  await page.evaluate(async () => {
    window.__plugged = true;
    const acc = window.__app.MIDI.access;
    acc.outputs.get('o1').state = 'connected';
    acc.inputs.get('i1').state = 'connected';
    acc.onstatechange && acc.onstatechange({});
  });
  await page.waitForFunction(() => window.__app.MIDI.inp, null, { timeout: 5000 });
  assert.equal((await state(page)).out, 'MC-707 MIDI 1');
  /* a browser (no desktop app) where MIDI is not allowed yet: no prompt as it opens */
  const b = await openApp({ storage: { 'mc707-autoconnect': '1' } });
  await b.page.waitForTimeout(800);
  const asked = await b.page.evaluate(() => !!(window.__app.MIDI && window.__app.MIDI.access));
  const granted = await b.page.evaluate(async () => {
    try {
      return (await navigator.permissions.query({ name: 'midi' })).state;
    } catch (e) {
      return 'unknown';
    }
  });
  if (granted !== 'granted') assert.equal(asked, false, 'no MIDI asked for (' + granted + ')');
  assert.deepEqual(errors, []);
  assert.deepEqual(b.errors, []);
});

test('Auto-connect: an MC-707 plugged in wins over a remembered port that is now a keyboard; your own pick stays', async () => {
  const song = JSON.parse(readFixture('song-v0.10.json'));
  song.midiOut = 'k1';
  const { page, errors } = await openApp({
    storage: { 'mc707-autoconnect': '1', 'mc707-song-mode-v1': JSON.stringify(song) }
  });
  await page.addInitScript(() => {
    window.toolbox = {};
    /* a keyboard on the port id the song remembers, listed before the MC-707 */
    const req = navigator.requestMIDIAccess;
    navigator.requestMIDIAccess = async o => {
      const acc = await req(o);
      const kb = { id: 'k1', name: 'KeyLab 49 MIDI', state: 'connected', send() {}, open: async () => {} };
      acc.outputs = new Map([['k1', kb], ...acc.outputs]);
      return acc;
    };
  });
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.MIDI && window.__app.MIDI.out, null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__app.MIDI.out.name), 'MC-707 MIDI 1', 'the MC-707, not the keyboard');
  /* picked by hand: it stays, even when the ports are looked at again */
  const kept = await page.evaluate(() => {
    const sel = document.querySelector('#midiOut');
    sel.value = 'k1';
    sel.dispatchEvent(new Event('change'));
    window.__app.refreshOuts();
    return window.__app.MIDI.out.name;
  });
  assert.equal(kept, 'KeyLab 49 MIDI');
  assert.deepEqual(errors, []);
});
