// Organising the Sound browser (zen/zc-browser.js, zen/zc-sounds.js): your own folders, picking several
// sounds with Ctrl- and Shift-click to tag them, set their category, copy or move them, the tag filter,
// and the browser's Done (back to the tracks) and Edit in ZenCore (back to the editor). Also the ◀ ▶
// beside the editor's long lists, and no reverb send in Synth Mode.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const z = 'window.__app.zen';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* click through a menu: submenus by label, then the item */
async function pick(page, ...path) {
  for (const label of path.slice(0, -1))
    await page
      .locator('.cmenu .cmi.sub', { hasText: new RegExp('^' + esc(label)) })
      .last()
      .click();
  await page
    .locator('.cmenu button.cmi', { hasText: new RegExp('^(✓ )?' + esc(path.at(-1)) + '$') })
    .last()
    .click();
}
const answer = async (page, text) => {
  await page.waitForFunction(
    () => document.activeElement?.tagName === 'INPUT' && !document.activeElement.closest('#zbOv')
  );
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};
const row = (page, name) => page.locator('#zbOv .zbItem', { hasText: name }).first();
const lib = page =>
  page.evaluate(
    `${z}.ZS.list.filter(e => e.src === 'mine').map(e => ({ name: e.name, folder: e.folder || '', tags: e.tags, cat: e.d['CMN.CATEGORY'] | 0 }))`
  );

test('Sound browser: folders, picking several, tags, category, copy and move', async () => {
  const { page, errors } = await openApp();
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.evaluate(`${z}.browse()`);
  await page.waitForSelector('#zbOv');
  for (const name of ['Alpha', 'Bravo', 'Charlie']) {
    await page.locator('#zbOv button', { hasText: 'Save this tone' }).click();
    await page.fill('#zbOv .zbName', name);
    await page.locator('#zbOv .zbForm button', { hasText: 'Save' }).click();
    await page.waitForTimeout(150);
  }
  assert.equal((await lib(page)).length, 3);
  /* pick: Ctrl-click one, Shift-click the range */
  await page.locator('#zbOv .zbHead').click();
  await row(page, 'Alpha').click({ modifiers: ['Control'] });
  await row(page, 'Charlie').click({ modifiers: ['Shift'] });
  assert.equal(await page.locator('#zbOv .zbItem.sel').count(), 3);
  assert.match(await page.locator('#zbOv .zbSelBar').textContent(), /3 picked/);
  /* tag them all, and the tag filter shows them */
  await page.locator('#zbOv .zbSelBar button', { hasText: 'Tag ▾' }).click();
  await pick(page, 'Add tag', 'New tag…');
  await answer(page, 'grimy');
  await page.waitForFunction(() => document.querySelectorAll('#zbOv .zbItem .zbTg').length >= 3);
  assert.ok((await lib(page)).every(e => e.tags.includes('grimy')));
  /* the category, as the MC-707 will show it */
  await page.locator('#zbOv .zbSelBar button', { hasText: 'Category ▾' }).click();
  await pick(page, 'Bass', 'Synth Bass');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#zbOv .zbItem.sel .zbCat')].every(c => c.textContent === 'Synth Bass')
  );
  const cats = await page.evaluate(() =>
    [...document.querySelectorAll('#zbOv .zbItem.sel .zbCat')].map(c => c.textContent)
  );
  assert.deepEqual(cats, ['Synth Bass', 'Synth Bass', 'Synth Bass']);
  /* copy into a new folder: still in My sounds, and in the folder */
  await page.locator('#zbOv .zbSelBar button', { hasText: 'Copy to ▾' }).click();
  await pick(page, 'New folder…');
  await answer(page, 'Basses');
  await page.waitForTimeout(300);
  let l = await lib(page);
  assert.equal(l.filter(e => e.folder === 'Basses').length, 3);
  assert.equal(l.filter(e => !e.folder).length, 3);
  if (process.env.SHOT) {
    await page.locator('#zbOv .zbBk', { hasText: 'My sounds' }).click();
    await page.screenshot({ path: process.env.SHOT });
  }
  /* the folder in the banks, with its count */
  await page.locator('#zbOv .zbBk', { hasText: 'Basses' }).click();
  assert.equal(await page.locator('#zbOv .zbItem').count(), 3);
  /* the tag filter in the middle column */
  await page.locator('#zbOv .zbTagF', { hasText: 'grimy' }).click();
  assert.equal(await page.locator('#zbOv .zbItem').count(), 3);
  await page.locator('#zbOv .zbTagF', { hasText: 'Any' }).click();
  /* move one of the folder's sounds back to My sounds (right-click › Move to) */
  await page.locator('#zbOv .zbSelBar button', { hasText: 'Clear' }).click();
  await row(page, 'Alpha').click({ button: 'right' });
  await pick(page, 'Move to', 'My sounds');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#zbOv .zbItem').count(), 2);
  /* a starter copied into the folder */
  await page.locator('#zbOv .zbBk', { hasText: 'Starters' }).click();
  await row(page, 'Acid bass').click({ button: 'right' });
  await pick(page, 'Copy to', '📁 Basses');
  await page.waitForTimeout(300);
  l = await lib(page);
  assert.ok(l.some(e => e.name === 'Acid bass' && e.folder === 'Basses'));
  /* a backup keeps the folders */
  const back = JSON.parse(await page.evaluate(`${z}.libraryJSON()`));
  assert.ok(back.folders.includes('Basses'));
  assert.ok(back.list.some(e => e.folder === 'Basses'));
  /* rename the folder, then remove it: its sounds go back to My sounds */
  await page.locator('#zbOv .zbBk', { hasText: 'Basses' }).click({ button: 'right' });
  await pick(page, 'Rename…');
  await page.waitForFunction(
    () => document.activeElement?.tagName === 'INPUT' && !document.activeElement.closest('#zbOv')
  );
  await page.keyboard.press('Control+a');
  await answer(page, 'Low end');
  await page.waitForSelector('#zbOv .zbBk:has-text("Low end")');
  assert.equal((await lib(page)).filter(e => e.folder === 'Low end').length, 3);
  await page.locator('#zbOv .zbBk', { hasText: 'Low end' }).click({ button: 'right' });
  await pick(page, 'Remove the folder…');
  await page.locator('button', { hasText: /^Remove$/ }).click();
  await page.waitForTimeout(200);
  l = await lib(page);
  assert.equal(l.length, 7, 'no sound deleted (3 saved, 3 copies, 1 starter copied)');
  assert.ok(l.every(e => !e.folder));
  assert.equal(await page.locator('#zbOv .zbBk', { hasText: 'Low end' }).count(), 0);
  /* Edit in ZenCore: back to the editor; Done: back to the tracks */
  await page.locator('#zbOv button', { hasText: 'Edit in ZenCore' }).click();
  assert.equal(await page.locator('#zbOv').count(), 0);
  assert.equal(await page.locator('#zcOv').count(), 1);
  await page.evaluate(`${z}.browse()`);
  await page.locator('#zbOv button', { hasText: /^Done$/ }).click();
  assert.equal(await page.locator('#zbOv, #zcOv').count(), 0);
  assert.deepEqual(errors, []);
});

test('ZenCore editor: ◀ ▶ step through a long list such as the MFX type', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.locator('#zcOv .zcTab', { hasText: 'MFX' }).click();
  const type = () => page.evaluate(`${z}.ZE.snd.v['MFX.mfxType']`);
  const t0 = await type();
  await page.locator('#zcOv .zcC:has-text("Type") .zcStepB.next').click();
  await page.waitForFunction(t => window.__app.zen.ZE.snd.v['MFX.mfxType'] === t + 1, t0);
  await page.locator('#zcOv .zcC:has-text("Type") .zcStepB.next').click();
  await page.locator('#zcOv .zcC:has-text("Type") .zcStepB.prev').click();
  await page.waitForFunction(t => window.__app.zen.ZE.snd.v['MFX.mfxType'] === t + 1, t0);
  /* short lists keep a plain menu */
  assert.ok((await page.locator('#zcOv .zcStep').count()) >= 1);
  assert.deepEqual(errors, []);
});

test('Synth Mode: no reverb send on the strips', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=synth]');
  await page.waitForSelector('#synth .syStrip');
  const labels = await page.locator('#synth .syStrip').first().locator('.syMix').textContent();
  assert.match(labels, /Level/);
  assert.match(labels, /Pan/);
  assert.doesNotMatch(labels, /Reverb/);
  assert.deepEqual(errors, []);
});
