// Synth mode (zen/zc-synth.js, zen/zc-synth-io.js): eight strips with each track's sound name read from
// the MC-707, which sound a track plays (clip or the track's own), level and pan, a setup file with all
// the sounds, and notes passed through from another input. Against the fake MC-707 in helpers.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Synth mode: strips, names, sound source, level, setup file and notes passed through', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  /* put a named sound into track 4, clip 1 on the fake MC-707 */
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.evaluate(`${z}.browse()`);
  await page.locator('#zbOv .zbChip', { hasText: 'Starters' }).click();
  await page.fill('#zbQ', 'Warm pad');
  await page.locator('#zbOv .zbItem', { hasText: 'Warm pad' }).first().click();
  await page.locator('#zbOv button', { hasText: 'Done' }).click();
  await page.evaluate(`${z}.sendAll()`);
  await page.waitForTimeout(1500);
  await page.locator('#zcOv button', { hasText: 'Done' }).click();
  /* Synth mode */
  await page.click('#menubar .mtab[data-mode=synth]');
  assert.equal(await page.isVisible('#synth'), true);
  assert.equal(await page.isVisible('#main'), false, 'the song screen is hidden');
  assert.equal(await page.locator('#synth .syStrip').count(), 8);
  await page.locator('#synth button', { hasText: 'Read sounds' }).click();
  await page.waitForFunction(
    () => /WARM PAD/i.test(document.querySelectorAll('#synth .syName')[3]?.textContent || ''),
    null,
    { timeout: 30000 }
  );
  /* which sound track 4 plays: the track's own sound sets Sound Source TRACK; a clip sets CLIP and selects it */
  await page.evaluate('window.__out.length = 0');
  await page.locator('#synth .syStrip').nth(3).locator('select.sySlot').selectOption('16');
  await page.waitForTimeout(300);
  const lin = a => (a[0] << 21) | (a[1] << 14) | (a[2] << 7) | a[3];
  const srcAddr = lin([0x10, 0, 8, 0]) + 3 * lin([0, 0, 2, 0]) + 4;
  const dt1To = (out, l) =>
    out.filter(b => b[0] === 0xf0 && b[7] === 0x12 && lin(b.slice(8, 12)) === l).map(b => b[12]);
  assert.deepEqual(dt1To(await page.evaluate('window.__out'), srcAddr), [0], 'Sound Source TRACK');
  await page.evaluate('window.__out.length = 0');
  await page.locator('#synth .syStrip').nth(3).locator('select.sySlot').selectOption('2');
  await page.waitForTimeout(300);
  let out = await page.evaluate('window.__out');
  assert.deepEqual(dt1To(out, srcAddr), [1], 'Sound Source CLIP');
  assert.ok(
    out.some(b => b[0] === 0xc3 && b[1] === 2),
    'clip 3 selected on track 4'
  );
  await page.locator('#synth .syStrip').nth(3).locator('select.sySlot').selectOption('0');
  /* level and pan */
  await page.evaluate('window.__out.length = 0');
  await page.locator('#synth .syStrip').nth(3).locator('input[type=range]').first().fill('90');
  await page.locator('#synth .syStrip').nth(3).locator('input[type=range]').nth(1).fill('30');
  out = await page.evaluate('window.__out');
  assert.ok(
    out.some(b => b[0] === 0xb3 && b[1] === 7 && b[2] === 90),
    'level is CC 7'
  );
  assert.ok(
    out.some(b => b[0] === 0xb3 && b[1] === 10 && b[2] === 30),
    'pan is CC 10'
  );
  /* save the setup: every track's sound, with level and pan */
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    (async () => {
      await page.locator('#synth button', { hasText: 'Setups' }).click();
      await page.locator('.cmenu >> text=Save to a file').click();
    })()
  ]);
  const setup = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  assert.equal(setup.synth, 1);
  assert.equal(setup.tracks.length, 8);
  const t4 = setup.tracks.find(e => e.track === 3);
  assert.match(t4.sound.name, /WARM PAD/i);
  assert.equal(t4.level, 90);
  assert.equal(t4.pan, 30);
  /* notes from another input are passed to the MC-707 */
  await page.locator('#synth select[aria-label="Pass notes through from"]').selectOption({ label: 'FLkey 61 MIDI' });
  await page.evaluate(
    'window.__out.length = 0; window.__key([0x93, 60, 100]); window.__key([0x83, 60, 0]); window.__key([0xf8])'
  );
  out = await page.evaluate('window.__out');
  assert.deepEqual(
    out,
    [
      [0x93, 60, 100],
      [0x83, 60, 0]
    ],
    'notes pass through; clock does not'
  );
  /* or all to one track (a keyboard playing track 2), lighting its strip */
  await page.locator('#synth select[aria-label="Where passed-through notes go"]').selectOption({ label: 'Track 2' });
  await page.evaluate('window.__out.length = 0; window.__key([0x90, 64, 90]); window.__key([0x80, 64, 0])');
  assert.deepEqual(await page.evaluate('window.__out'), [
    [0x91, 64, 90],
    [0x81, 64, 0]
  ]);
  assert.ok(await page.locator('#syAct1.on').count(), 'track 2 lights up');
  await page.locator('#synth select[aria-label="Where passed-through notes go"]').selectOption('own');
  /* mute, solo, reverb and panic */
  await page.evaluate('window.__out.length = 0');
  await page.locator('#synth .syStrip').nth(3).locator('button', { hasText: /^S$/ }).click();
  out = await page.evaluate('window.__out');
  assert.ok(
    out.some(b => b[0] === 0xb0 && b[1] === 7 && b[2] === 0),
    'solo on track 4 silences track 1'
  );
  assert.ok(
    out.some(b => b[0] === 0xb3 && b[1] === 7 && b[2] === 90),
    'and keeps track 4 at its level'
  );
  await page.locator('#synth .syStrip').nth(3).locator('button', { hasText: /^S$/ }).click();
  await page.locator('#synth .syStrip').nth(0).locator('button', { hasText: /^M$/ }).click();
  assert.equal(await page.locator('#synth .syStrip.quiet').count(), 1, 'one muted strip');
  await page.locator('#synth .syStrip').nth(0).locator('button', { hasText: /^M$/ }).click();
  await page.evaluate('window.__out.length = 0');
  await page.locator('#synth .syStrip').nth(3).locator('input[type=range]').nth(2).fill('70');
  await page.locator('#synth button', { hasText: 'Panic' }).click();
  out = await page.evaluate('window.__out');
  assert.ok(
    out.some(b => b[0] === 0xb3 && b[1] === 91 && b[2] === 70),
    'reverb send is CC 91'
  );
  assert.equal(out.filter(b => (b[0] & 0xf0) === 0xb0 && b[1] === 123).length, 8, 'panic: all notes off on all 8');
  /* the song's Space shortcut does nothing here */
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate('window.__app.TR.playing'), false);
  /* leaving Synth mode stops passing notes */
  await page.click('#menubar .mtab[data-mode=song]');
  await page.evaluate('window.__out.length = 0; window.__key([0x93, 62, 100])');
  assert.deepEqual(await page.evaluate('window.__out.filter(b => b[0] === 0x93)'), []);
  assert.deepEqual(errors, []);
});

test('Synth mode: a saved setup sends each sound back to its track and slot', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=synth]');
  const setup = {
    app: 'mc707-toolbox',
    synth: 1,
    tracks: [
      {
        track: 4,
        slot: 5,
        level: 77,
        pan: 64,
        sound: { zencore: 1, kind: 'tone', name: 'TEST TONE', v: { 'CMN.NAME': 'TEST TONE       ', 'CMN.LEVEL': 99 } }
      }
    ]
  };
  await page.evaluate('window.__out.length = 0');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#synth button', { hasText: 'Setups' }).click();
  await page.locator('.cmenu >> text=Open a file').click();
  await (
    await chooser
  ).setFiles({ name: 'setup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(setup)) });
  await page.waitForFunction(() => window.__out.some(b => b[0] === 0xb4 && b[1] === 7 && b[2] === 77), null, {
    timeout: 20000
  });
  const out = await page.evaluate('window.__out');
  const lin = a => (a[0] << 21) | (a[1] << 14) | (a[2] << 7) | a[3];
  const slot = lin([0x30, 0, 0, 0]) + (4 * 17 + 5) * lin([0, 2, 0, 0]);
  const name = out.find(b => b[0] === 0xf0 && b[7] === 0x12 && lin(b.slice(8, 12)) === slot);
  assert.ok(name, 'the sound is written to track 5, clip 6');
  assert.equal(String.fromCharCode(...name.slice(12, 21)), 'TEST TONE');
  const mute = out.findIndex(b => b[0] === 0xb4 && b[1] === 11 && b[2] === 0),
    back = out.findIndex(b => b[0] === 0xb4 && b[1] === 11 && b[2] === 127);
  assert.ok(mute >= 0 && back > out.indexOf(name), 'quiet while it goes in');
  assert.ok(
    out.some(b => b[0] === 0xc4 && b[1] === 5),
    'and clip 6 is selected'
  );
  assert.match(await page.locator('#synth .syName').nth(4).textContent(), /TEST TONE/);
  assert.deepEqual(errors, []);
});

test('Synth mode: a setup kept in the browser comes back after a reload', async () => {
  const { page, errors } = await openApp();
  await page.evaluate('window.__app.zen.open(3, 0)');
  await page.waitForTimeout(400);
  await page.evaluate('window.__app.zen.sendAll()');
  await page.waitForTimeout(1500);
  await page.locator('#zcOv button', { hasText: 'Done' }).click();
  await page.click('#menubar .mtab[data-mode=synth]');
  await page.locator('#synth button', { hasText: 'Setups' }).click();
  await page.locator('.cmenu >> text=Keep in this browser').click();
  await page.fill('[role=dialog] input', 'Gig rig');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Gig rig/.test(localStorage.getItem('mc707-synth-setups') || ''), null, {
    timeout: 120000
  });
  const kept = await page.evaluate("JSON.parse(localStorage.getItem('mc707-synth-setups'))");
  assert.equal(kept[0].name, 'Gig rig');
  const t4 = kept[0].setup.tracks.find(e => e.track === 3);
  assert.ok(t4.sound && Object.keys(t4.sound.v).length < 300, 'stored small: only what differs');
  await page.reload();
  await page.click('#menubar .mtab[data-mode=synth]');
  await page.locator('#synth button', { hasText: 'Setups' }).click();
  await page.locator('.cmenu >> text=Gig rig').hover();
  await page.locator('.cmenu >> text=Send to the').click();
  await page.waitForFunction(() => window.__out.some(b => b[0] === 0xb3 && b[1] === 11 && b[2] === 127), null, {
    timeout: 20000
  });
  assert.deepEqual(errors, []);
});

test('Synth mode: quick settings read a page from the MC-707 and move every playing partial together', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  /* a starter with more than one partial on track 4, clip 1 */
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.evaluate(`${z}.browse()`);
  await page.locator('#zbOv .zbChip', { hasText: 'Starters' }).click();
  await page.fill('#zbQ', 'Supersaw');
  await page.locator('#zbOv .zbItem', { hasText: 'Supersaw' }).first().click();
  await page.locator('#zbOv button', { hasText: 'Done' }).click();
  await page.evaluate(`${z}.sendAll()`);
  await page.waitForTimeout(1500);
  const before = await page.evaluate(
    `(() => { const v = ${z}.ZE.snd.v; return [0,1,2,3].map(i => [v['PMT.PMT' + (i + 1) + '_PTL_SW'], v['PTL' + i + '.CUTOFF']]); })()`
  );
  await page.locator('#zcOv button', { hasText: 'Done' }).click();
  /* Synth Mode: the Filter page on track 4 */
  await page.click('#menubar .mtab[data-mode=synth]');
  const strip = page.locator('#synth .syStrip').nth(3);
  await strip.locator('select.syQMenu').selectOption('filter');
  const cut = strip.locator('.syQ', { hasText: 'Cutoff' }).locator('input[type=range]');
  await page.waitForFunction(el => !el.disabled, await cut.elementHandle(), { timeout: 20000 });
  const ref = before.find(([sw]) => sw === 1)[1];
  assert.equal(+(await cut.inputValue()), ref, 'the slider shows the first playing partial');
  const target = Math.max(0, ref - 200);
  await cut.fill(String(target));
  await page.waitForTimeout(400);
  /* the editor reads the clip back: every playing partial moved by the same amount */
  await page.click('#menubar .mtab[data-mode=song]');
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForFunction(() => !window.__app.zen.ZE.busy, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const after = await page.evaluate(`[0,1,2,3].map(i => ${z}.ZE.snd.v['PTL' + i + '.CUTOFF'])`);
  before.forEach(([sw, v], i) =>
    assert.equal(after[i], sw === 1 ? Math.max(0, v + (target - ref)) : v, 'partial ' + (i + 1))
  );
  /* the page stays open next time */
  assert.equal(await page.evaluate("JSON.parse(localStorage.getItem('mc707-synth')).page[3]"), 'filter');
  assert.deepEqual(errors, []);
});
