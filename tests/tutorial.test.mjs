// The tutorials (ui/tutorial.js): a list of them (Basic setup, then one per mode) from the start screen and
// Help; each goes page by page (on the MC-707, then in the app) with Next and Back, number keys, steps to
// tick (kept, with progress on the list), Show me pointing at a step's control, and buttons that take you to
// the place it talks about.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Tutorials: Basic setup and one per mode, from the start screen and Help', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-start': '1' } });
  await page.locator('#startOv button', { hasText: 'Tutorials' }).click();
  await page.locator('#tutOv').waitFor();
  assert.equal(await page.locator('#startOv').count(), 0, 'the start screen makes way');
  assert.equal(await page.locator('.tutCard').count(), 6, 'Basic setup and five modes');
  assert.match(await page.locator('.tutCard.big').textContent(), /Basic setup/);
  /* Basic setup: Connect and Tracks, each on the device then in the app */
  await page.locator('.tutCard.big').click();
  assert.equal(await page.locator('.tutPg').count(), 4);
  assert.match(await page.locator('.tutBody').textContent(), /Rx Auto Channel/);
  await page.locator('.tutFoot button', { hasText: 'Next' }).click();
  assert.match(await page.locator('.tutBody').textContent(), /Auto-connect/);
  await page.locator('.tutPg').nth(3).click();
  assert.match(await page.locator('.tutFoot').textContent(), /Done: pick a mode/);
  await page.locator('.tutFoot button', { hasText: 'Done' }).click();
  assert.equal(await page.locator('.tutCard').count(), 6, 'back at the list');
  /* a mode's tutorial on its own */
  await page.locator('.tutCard', { hasText: 'Live Mode' }).click();
  assert.equal(await page.locator('.tutPg').count(), 2);
  assert.match(await page.locator('.tutBody').textContent(), /Tx MIDI Note/);
  assert.match(await page.locator('.tutNote').textContent(), /Basic setup/, 'points to Basic setup first');
  await page.locator('.tutFoot button', { hasText: 'Next' }).click();
  await page.locator('.tutActs button', { hasText: 'Go to Live Mode' }).click();
  assert.equal(await page.locator('#tutOv').count(), 0);
  assert.equal(await page.evaluate(() => document.body.dataset.mode), 'live');
  /* Help › Tutorial: this mode opens the mode's own */
  await page.locator('#menubar .mb', { hasText: 'Help' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'this mode' }).click();
  assert.match(await page.locator('.tutBox .cmHead h3').textContent(), /Live Mode/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#tutOv').count(), 0);
  assert.deepEqual(errors, []);
});

test('Tutorials: ticked steps are kept, number keys jump, Show me points at the control', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-start': '1' } });
  await page.locator('#startOv button', { hasText: 'Tutorials' }).click();
  await page.locator('.tutCard', { hasText: 'Song Mode' }).click();
  const boxes = page.locator('.tutSteps input[type=checkbox]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  assert.equal(await page.locator('.tutPg.on .tutN').textContent(), '✓', 'a finished page shows ✓');
  await page.locator('.tutBody').focus();
  await page.keyboard.press('2');
  assert.match(await page.locator('.tutSub').textContent(), /In the app/);
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('.tutSub').textContent(), /On the MC-707/);
  /* Show me: on Live Mode's app page, a ring round Start Jam, and back to the same page */
  await page.locator('.cmHead button', { hasText: 'All tutorials' }).click();
  assert.match(await page.locator('.tutCard', { hasText: 'Song Mode' }).textContent(), new RegExp(n + ' of \\d+'));
  await page.locator('.tutCard', { hasText: 'Live Mode' }).click();
  await page.locator('.tutPg').nth(1).click();
  await page.locator('.tutShow').first().click();
  await page.locator('#tutSpot .tutRing').waitFor();
  assert.equal(await page.locator('#tutOv').count(), 0);
  assert.equal(await page.evaluate(() => document.body.dataset.mode), 'live');
  const ring = await page.locator('.tutRing').boundingBox(),
    btn = await page.locator('#lvStart').boundingBox();
  assert.ok(ring.x <= btn.x && ring.x + ring.width >= btn.x + btn.width, 'the ring is round Start Jam');
  await page.locator('.tutBack').click();
  assert.match(await page.locator('.tutSub').textContent(), /In the app/);
  assert.match(await page.locator('.tutBox .cmHead h3').textContent(), /Live Mode/);
  assert.deepEqual(errors, []);
});
