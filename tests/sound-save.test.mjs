// Saving to the Sound browser (zen/zc-browser.js, zen/zc-sounds.js): a save you ask for always lands
// in My sounds, even when the same sound is elsewhere in the library, and the browser shows it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Sound browser: Save this tone, again with a tag, and Save a copy all land in My sounds', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  const mine = () => page.evaluate(`${z}.ZS.list.filter(e => e.src === 'mine').map(e => e.name + ':' + e.tags)`);
  const save = async (name, tag) => {
    await page.locator('#zbOv button', { hasText: 'Save this tone' }).click();
    await page.fill('#zbOv .zbName', name);
    if (tag) {
      await page.locator('#zbOv .zbForm .zbChip', { hasText: '+ tag' }).click();
      await page.waitForFunction(
        () => document.activeElement?.tagName === 'INPUT' && !document.activeElement.closest('#zbOv')
      );
      await page.keyboard.type(tag);
      await page.locator('button', { hasText: /^Add$/ }).click();
    }
    await page.locator('#zbOv .zbForm button', { hasText: 'Save' }).click();
    await page.waitForTimeout(300);
  };
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.evaluate(`${z}.browse()`);
  await page.waitForSelector('#zbOv');
  /* the Factory or Starters bank picked: the saved sound still shows, in My sounds */
  await page.locator('#zbOv .zbBk', { hasText: 'Starters' }).click();
  await save('Test one');
  assert.deepEqual(await mine(), ['Test one:']);
  await page.waitForSelector('#zbOv .zbItem.cur:has-text("Test one")');
  /* the same sound again, under another name and with a tag: a second entry */
  await save('Test two', 'mytag');
  assert.deepEqual((await mine()).sort(), ['Test one:', 'Test two:mytag']);
  await page.waitForSelector('#zbOv .zbItem.cur:has-text("Test two")');
  /* the same sound under the same name: not twice, and it is picked */
  await save('Test one');
  assert.equal((await mine()).length, 2);
  await page.waitForSelector('#zbOv .zbItem.cur:has-text("Test one")');
  /* Save a copy of a starter */
  await page.locator('#zbOv .zbBk', { hasText: 'Starters' }).click();
  await page.locator('#zbOv .zbItem', { hasText: 'Acid bass' }).click({ button: 'right' });
  await page.locator('.cmenu button, .cmenu [role=menuitem], .cmenu div', { hasText: 'Save a copy' }).first().click();
  await page.waitForTimeout(300);
  assert.ok((await mine()).some(x => x.startsWith('Acid bass')));
  await page.waitForSelector('#zbOv .zbItem.cur:has-text("Acid bass")');
  assert.deepEqual(errors, []);
});
