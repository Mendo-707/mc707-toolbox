// The ZenCore editor's partial bar (zen/zc-partbar.js): each partial switches on or off in one click,
// the change goes into the sound (and to the MC-707), and undo brings it back.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('ZenCore editor: switch a partial on or off from the partial bar', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.locator('#zcOv .zcTab', { hasText: 'Oscillator' }).click();
  const sw = i => page.evaluate(`${z}.ZE.snd.v['PMT.PMT${i}_PTL_SW']`);
  const before = await sw(2);
  await page.locator('#zcOv .zcOnSw', { hasText: '2' }).click();
  await page.waitForFunction(b => window.__app.zen.ZE.snd.v['PMT.PMT2_PTL_SW'] === (b ? 0 : 1), before);
  assert.equal(await page.locator('#zcOv .zcOnSw.on', { hasText: '2' }).count(), before ? 0 : 1, 'the switch shows it');
  await page.locator('#zcOv .zcOnSw', { hasText: '2' }).click();
  assert.equal(await sw(2), before, 'and back');
  /* undo takes the last change back */
  await page.locator('#zcOv .zcOnSw', { hasText: '3' }).click();
  const after3 = await sw(3);
  await page.keyboard.press('Control+z');
  await page.waitForFunction(a => window.__app.zen.ZE.snd.v['PMT.PMT3_PTL_SW'] !== a, after3);
  assert.deepEqual(errors, []);
});
