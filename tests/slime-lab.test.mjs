// The ZenCore editor's Slime Lab (zen/zc-lab.js): ingredients change the tone as one undo step each, a blend
// builds its sound from a clean slate, Works on keeps a change to one partial, and Esc goes back to the editor.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Slime Lab: mix in, blends, partials and back', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  const v = k => page.evaluate(`${z}.ZE.snd.v[${JSON.stringify(k)}]`);
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.locator('#zcOv button', { hasText: 'Slime Lab' }).click();
  await page.locator('#labOv').waitFor();
  /* an ingredient: one undo step, in the list */
  const u0 = await page.evaluate(`${z}.ZE.undo.length`);
  await page.locator('#labOv .liBtn[data-id="moon"]').dblclick();
  await page.waitForFunction(n => window.__app.zen.ZE.undo.length === n + 1, u0, { timeout: 8000 });
  assert.ok((await v('PTL0.CUTOFF')) < 1023, 'Darken lowers the cutoff');
  assert.equal(await page.locator('#labOv .lgChip').count(), 1);
  /* a blend from a clean slate */
  await page.locator('#labOv .lbRow', { hasText: 'Acid Bass' }).locator('button', { hasText: 'Make' }).click();
  await page.waitForFunction(() => /Done/.test(document.querySelector('#labLearn .llGo')?.textContent || ''), null, {
    timeout: 30000
  });
  assert.equal((await v('CMN.NAME')).trim(), 'ACID BASS');
  assert.equal(await v('CMN.MONO_POLY'), 0);
  assert.equal(await v('PTL0.RESO'), 800);
  assert.equal(await v('MFX.mfxType'), 29, 'overdrive');
  /* Works on partial 2 only */
  await page.locator('#labOv .lbRow', { hasText: 'Reese Bass' }).locator('button', { hasText: 'Make' }).click();
  await page.waitForFunction(() => /Done/.test(document.querySelector('#labLearn .llGo')?.textContent || ''), null, {
    timeout: 30000
  });
  await page.locator('#labTarget button', { hasText: /^2$/ }).click();
  const c0 = await v('PTL0.CUTOFF');
  await page.locator('#labOv .liBtn[data-id="sun"]').dblclick();
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['PTL1.CUTOFF'] > 500, null, { timeout: 8000 });
  assert.equal(await v('PTL0.CUTOFF'), c0, 'partial 1 untouched');
  /* Esc: back to the editor */
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#labOv').count(), 0);
  assert.equal(await page.locator('#zcOv').count(), 1);
  assert.deepEqual(errors, []);
});
