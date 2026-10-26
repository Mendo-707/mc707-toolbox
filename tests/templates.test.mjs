// MC-707 project templates (ui/templates.js): the template that matches the Track setup, the steps to put
// them on the MC-707, and the way in from Help, Track setup and Scene Mode's guide.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, closeBrowser, ROOT } from './helpers.mjs';

after(closeBrowser);

test('Templates: the zip is in the repository, and the window names the one for the Track setup', async () => {
  assert.ok(fs.statSync(path.join(ROOT, 'templates', 'MC707-Project-Templates.zip')).size > 100000);
  const { page, errors } = await openApp();
  await page.locator('#menubar .mb', { hasText: 'MC-707' }).first().click();
  await page.locator('.mdrop:not([hidden]) button', { hasText: 'Project templates' }).first().click();
  const text = await page.textContent('#tplOv');
  assert.match(text, /For your Track setup \(3 drum, 5 tone\): 3 Drum 5 Tone Tracks\./);
  assert.match(text, /STORAGE MODE/);
  assert.match(text, /PROJECT › WRITE/);
  /* a layout whose drum tracks are not first is told so */
  await page.evaluate(() => {
    const S = window.__app.S;
    [S.tracks[0].type, S.tracks[3].type] = ['tone', 'drum'];
  });
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('#tplOv')?.remove());
  await page.locator('#menubar .mb', { hasText: 'MC-707' }).first().click();
  await page.locator('.mdrop:not([hidden]) button', { hasText: 'Project templates' }).first().click();
  assert.match(await page.textContent('#tplOv'), /yours are elsewhere/);
  assert.deepEqual(errors, []);
});
