// The tutorial (ui/tutorial.js): from the start screen and Help, seven chapters with what to set on the
// MC-707 and in the app, Next and Back, and a button that takes you to the place it talks about.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Tutorial: chapters for connecting, tracks and every mode, from the start screen and Help', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-start': '1' } });
  await page.locator('#startOv button', { hasText: 'Tutorial' }).click();
  await page.locator('#tutOv').waitFor();
  assert.equal(await page.locator('#startOv').count(), 0, 'the start screen makes way');
  assert.equal(await page.locator('.tutCh').count(), 7);
  assert.match(await page.locator('.tutBody').textContent(), /Rx Auto Channel/);
  await page.locator('.tutFoot button', { hasText: 'Next' }).click();
  assert.match(await page.locator('.tutBody h3').textContent(), /Tracks/);
  await page.locator('.tutCh', { hasText: 'Live Mode' }).click();
  assert.match(await page.locator('.tutBody').textContent(), /Tx MIDI Note/);
  await page.locator('.tutActs button', { hasText: 'Go to Live Mode' }).click();
  assert.equal(await page.locator('#tutOv').count(), 0);
  assert.equal(await page.evaluate(() => document.body.dataset.mode), 'live');
  /* Help › Tutorial opens it again, at the chapter read last */
  await page.locator('#menubar .mb', { hasText: 'Help' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Tutorial' }).click();
  assert.match(await page.locator('.tutBody h3').textContent(), /Live Mode/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#tutOv').count(), 0);
  assert.deepEqual(errors, []);
});
