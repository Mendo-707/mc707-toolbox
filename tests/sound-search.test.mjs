// The Sound browser's search (zen/zc-browse-data.js searchHit): every word in any order, punctuation and
// spaces don't matter, instrument and source words work, Esc clears it, and a search that finds nothing in
// the bank or category says when it would find sounds elsewhere.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Sound browser: search finds sounds however you type them', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.evaluate(`${z}.browse()`);
  await page.locator('#zbOv .zbItem').first().waitFor();
  const names = async q => {
    await page.fill('#zbQ', q);
    return page.$$eval('#zbOv .zbItem', r => r.map(x => x.textContent));
  };
  const has = (l, s) => l.some(t => t.toLowerCase().includes(s));
  assert.ok(has(await names('saw lead'), 'saw lead'), 'two words');
  assert.ok(has(await names('lead saw'), 'saw lead'), 'any order');
  assert.ok(has(await names('SUPERSAW'), 'supersaw'), 'any case');
  assert.ok(has(await names('super saw'), 'supersaw'), 'a space inside a word');
  assert.ok(has(await names('sub-808'), '808'), 'punctuation');
  assert.ok((await names('bass')).length >= 3, 'an instrument word');
  assert.ok((await names('starter acid')).length >= 1, 'a source word');
  assert.equal((await names('zzqx')).length, 0);
  assert.match(await page.locator('#zbOv .zbEmpty').textContent(), /Nothing matches/);
  /* Esc clears the search, and the browser stays open */
  await page.locator('#zbQ').press('Escape');
  assert.equal(await page.inputValue('#zbQ'), '');
  assert.equal(await page.locator('#zbOv').count(), 1);
  assert.deepEqual(errors, []);
});
