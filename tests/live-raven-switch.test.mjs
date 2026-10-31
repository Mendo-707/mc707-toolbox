// Live Mode's Raven switch (live/raven.js): turning it on or off keeps the app on screen. Its hidden checkbox
// once had nothing holding it, so focusing it scrolled the whole window away and left a blank screen.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Raven mode switch: the window never scrolls away', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  await page.evaluate(() => document.querySelector('#lvPadSet').click());
  const sw = page.locator('.rvSwitch input');
  const before = await sw.isChecked();
  await page.evaluate(() => {
    const i = document.querySelector('.rvSwitch input');
    i.focus();
    i.click();
  });
  await page.waitForTimeout(200);
  assert.notEqual(await page.locator('.rvSwitch input').isChecked(), before, 'it switched');
  const scrolled = await page.evaluate(() => [document.documentElement.scrollTop, document.body.scrollTop, scrollY]);
  assert.deepEqual(scrolled, [0, 0, 0], 'the window itself did not scroll');
  const top = await page.evaluate(() => document.querySelector('#menubar').getBoundingClientRect().top);
  assert.equal(top, 0, 'the menu bar is still at the top');
  assert.deepEqual(errors, []);
});
