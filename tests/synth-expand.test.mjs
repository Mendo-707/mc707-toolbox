// Synth mode's expanded track (zen/zc-synth.js): Expand shrinks the other strips to a rail and docks the
// ZenCore editor in the screen; a rail track switches to it, and closing goes back to all eight strips.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Synth mode: expand a track to edit it in full beside the others', async () => {
  const { page, errors } = await openApp();
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.click('#menubar .mtab[data-mode=synth]');
  await page.locator('#synth .syStrip').nth(1).locator('.syExpBtn').click();
  await page.waitForSelector('#synth .syDock #zcOv .zcBox');
  assert.equal(await page.locator('#synth .syStrip').count(), 1, 'only the expanded strip stays full');
  assert.equal(await page.locator('#synth .syMini').count(), 7, 'the others shrink to the rail');
  assert.equal(await page.locator('body > #zcOv').count(), 0, 'docked, not over the app');
  assert.equal(await page.evaluate('window.__app.zen.ZE.t'), 1);
  const box = await page.locator('#synth .syDock .zcBox').boundingBox();
  assert.ok(box.width > 700 && box.height > 600, 'the editor fills the screen: ' + JSON.stringify(box));
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  /* a rail track: the editor moves to it */
  await page.locator('#synth .syMini').nth(3).click();
  await page.waitForFunction(() => window.__app.zen.ZE.t === 4);
  await page.waitForFunction(() => document.querySelector('#synth .syStrip .syNum')?.textContent === '5');
  assert.equal(await page.locator('#synth .syDock #zcOv').count(), 1);
  /* Escape closes the editor and brings back all eight */
  await page.locator('#synth .syDock .zcTab').first().click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('#synth .syStrip').length === 8, null, { timeout: 3000 });
  assert.equal(await page.locator('#zcOv').count(), 0);
  /* Collapse does too; leaving Synth mode closes a docked editor */
  await page.locator('#synth .syStrip').nth(0).locator('.syExpBtn').click();
  await page.waitForSelector('#synth .syDock #zcOv');
  await page.locator('#synth .syExpBtn.on').click();
  await page.waitForFunction(() => document.querySelectorAll('#synth .syStrip').length === 8, null, { timeout: 3000 });
  await page.locator('#synth .syStrip').nth(2).locator('.syExpBtn').click();
  await page.waitForSelector('#synth .syDock #zcOv');
  await page.click('#menubar .mtab[data-mode=song]');
  assert.equal(await page.locator('#zcOv').count(), 0, 'closed on leaving');
  assert.deepEqual(errors, []);
});
