// Fixes from a tester's notes: the right-click menu on several picked sounds copies all of them, expansion
// tones (.svz) go into a folder named after the file, the MFX presets have ◀ ▶, the editor's Partial menu
// shows only on the pages with a partial, and the track setup says up front to set the MC-707 to match.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Picked sounds, expansion import, MFX preset steps, the Partial menu and the track setup note', async () => {
  const { page, errors } = await openApp();
  await page.setViewportSize({ width: 1500, height: 950 });
  const z = 'window.__app.zen';
  /* 10 tones with different names and values, after 4 KB of other bytes */
  const bytes = await page.evaluate(`(() => {
    const { FW_REC, fwFields, newSound } = ${z}.fw, n = 10, pre = 4096;
    const b = new Uint8Array(pre + n * FW_REC + 512).fill(0xff);
    for (let r = 0; r < n; r++) {
      const o = pre + r * FW_REC, snd = newSound('tone');
      b.fill(0, o, o + FW_REC);
      snd.v['CMN.NAME'] = 'Test Tone ' + r;
      snd.v['CMN.CATEGORY'] = 21;
      snd.v['CMN.LEVEL'] = 90 + r;
      snd.v['PTL1.CUTOFF'] = 500 + r;
      snd.v['PTL0.PIT_CRS'] = -r;
      for (const [k, off, t] of fwFields()) {
        const x = snd.v[k], p = o + off;
        if (t === 'a') for (let i = 0; i < 16; i++) b[p + i] = (x.padEnd(16).charCodeAt(i));
        else if (t === 'b' || t === 'c') b[p] = x & 255;
        else { b[p] = x & 255; b[p + 1] = (x >> 8) & 255; }
      }
    }
    return Array.from(b);
  })()`);
  const dir = mkdtempSync(join(tmpdir(), 'svz-')),
    file = join(dir, 'My Expansion.svz');
  writeFileSync(file, Buffer.from(bytes));

  /* the track setup says to set the MC-707 to match, at the top */
  await page.locator('#menubar .mb', { hasText: 'Settings' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Track setup' }).click();
  await page.locator('.tsMust').waitFor();
  assert.match(await page.locator('.tsMust').textContent(), /match, by hand/);
  await page.locator('.tsBox button', { hasText: 'Done' }).click();
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(500);
  /* the Partial menu: not on Common, there on Oscillator */
  const partBtn = () => page.locator('#zcOv .zcActs button', { hasText: 'Partial ▾' }).count();
  await page.locator('#zcOv .zcTab', { hasText: 'Common' }).click();
  assert.equal(await partBtn(), 0, 'no Partial menu on Common');
  await page.locator('#zcOv .zcTab', { hasText: 'Oscillator' }).click();
  assert.equal(await partBtn(), 1, 'Partial menu on Oscillator');
  /* MFX presets step with ▶ */
  await page.locator('#zcOv .zcTab', { hasText: 'MFX' }).click();
  const presets = page.locator('#zcOv .zcC', { hasText: 'Presets' });
  await presets.locator('.zcStepB.next').click();
  await page.waitForTimeout(200);
  const at1 = await page.locator('#zcOv .zcC', { hasText: 'Presets' }).locator('select').inputValue();
  await page.locator('#zcOv .zcC', { hasText: 'Presets' }).locator('.zcStepB.next').click();
  await page.waitForTimeout(200);
  const at2 = await page.locator('#zcOv .zcC', { hasText: 'Presets' }).locator('select').inputValue();
  assert.equal(+at1, 0);
  assert.equal(+at2, 1, 'the next preset, not the first again');

  /* expansion tones into a folder named after the file */
  await page.evaluate(`${z}.browse()`);
  await page.waitForSelector('#zbOv');
  await page.locator('#zbOv button', { hasText: 'Grab from' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.cmenu >> text=Expansion tones from .svz files').click();
  await (await chooser).setFiles(file);
  await page.locator('[role=dialog] button', { hasText: 'Add' }).click();
  await page.waitForFunction(
    () => window.__app.zen.ZS.list.filter(e => e.folder === 'My Expansion').length === 10,
    null,
    {
      timeout: 10000
    }
  );

  /* several picked, right-click one: Copy to copies all of them */
  const rows = page.locator('#zbOv .zbItem', { hasText: 'Test Tone' });
  await page.locator('#zbOv .zbHead').click();
  await rows.nth(0).click({ modifiers: ['Control'] });
  await rows.nth(1).click({ modifiers: ['Control'] });
  await rows.nth(2).click({ modifiers: ['Control'] });
  await rows.nth(1).click({ button: 'right' });
  await page
    .locator('.cmenu .cmi.sub', { hasText: /^Copy to/ })
    .last()
    .click();
  await page
    .locator('.cmenu button.cmi:visible', { hasText: /^My sounds$/ })
    .last()
    .click();
  await page.waitForFunction(
    () => window.__app.zen.ZS.list.filter(e => e.src === 'mine' && !e.folder && /Test Tone/.test(e.name)).length === 3,
    null,
    { timeout: 8000 }
  );
  await page.keyboard.press('Escape');

  assert.deepEqual(errors, []);
});
