// Factory tones and kits from the MC-707 update file (zen/zc-factory.js, zc-factory-kits.js, zc-factory-ui.js). No Roland file is
// in the repo: the test writes a small stand-in with the same record layout (a few tones back to back
// among other bytes), imports it through the Sound browser, and checks the values come back.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Factory tones: read tones from an update file into the Sound browser, and remove them', async () => {
  const { page, errors } = await openApp();
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
    /* then 5 kits (A0 is key 0) */
    const { FW_KIT_REC, fwKitFields } = ${z}.fw, k0 = b.length - 512;
    const kb = new Uint8Array(b.length + 5 * FW_KIT_REC + 512).fill(0xff);
    kb.set(b.subarray(0, k0));
    for (let r = 0; r < 5; r++) {
      const o = k0 + r * FW_KIT_REC, snd = newSound('kit');
      kb.fill(0, o, o + FW_KIT_REC);
      snd.v['KCMN.NAME'] = 'Test Kit ' + r;
      snd.v['KPTL15.INST_NUM'] = 100 + r;
      snd.v['KPTL15.PAN'] = -r;
      snd.v['KEQ15.LO_GAIN'] = -10 * r;
      for (const [k, off, t] of fwKitFields()) {
        const x = snd.v[k], p = o + off;
        if (t === 'a') for (let i = 0; i < 16; i++) kb[p + i] = x.padEnd(16).charCodeAt(i);
        else if (t === 'b' || t === 'c' || t === 'o') kb[p] = x & 255;
        else { kb[p] = x & 255; kb[p + 1] = (x >> 8) & 255; }
      }
    }
    return Array.from(kb);
  })()`);
  const dir = mkdtempSync(join(tmpdir(), 'fw-')),
    file = join(dir, 'MC707_UPA_up.bin');
  writeFileSync(file, Buffer.from(bytes));

  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(500);
  await page.evaluate(`${z}.browse()`);
  await page.locator('#zbOv button', { hasText: 'Grab from' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.cmenu >> text=Factory sounds from the MC-707 update file').click();
  await (await chooser).setFiles(file);
  for (let t = 0; t < 100 && !(await page.evaluate(`${z}.ZS.list.some(e => e.src === 'factory')`)); t++)
    await page.waitForTimeout(100);
  const got = await page.evaluate(
    `${z}.ZS.list.filter(e => e.src === 'factory' && e.kind === 'tone').map(e => [e.name, e.type, e.d, e.bank, e.no])`
  );
  assert.equal(got.length, 10, 'ten tones');
  assert.equal(await page.evaluate(`${z}.ZS.list.filter(e => e.src === 'factory').length`), 15, 'and five kits');
  const kit = await page.evaluate(`${z}.ZS.list.find(e => e.name === 'Test Kit 3')`);
  assert.ok(kit && kit.kind === 'kit', 'kits read as kits');
  assert.deepEqual(
    [kit.d['KPTL15.INST_NUM'], kit.d['KPTL15.PAN'], kit.d['KEQ15.LO_GAIN'], kit.no],
    [103, -3, -30, 4],
    'key 36 instrument, pan and EQ, and the kit number'
  );
  const t3 = got.find(g => g[0] === 'Test Tone 3');
  assert.ok(t3, 'names read');
  assert.equal(t3[1], 'bass', 'type from the category (Synth Bass)');
  assert.equal(t3[2]['CMN.LEVEL'], 93);
  assert.equal(t3[2]['PTL1.CUTOFF'], 503);
  assert.equal(t3[2]['PTL0.PIT_CRS'], -3, 'signed values');
  assert.deepEqual([t3[3], t3[4]], ['F', 4], 'an unknown bank gets the next free letter; numbered from 1');
  /* shown under Factory, and kept out of the backup file */
  assert.ok(await page.locator('#zbOv .zbChip.on', { hasText: 'Factory' }).count(), 'the Factory bank is picked');
  assert.equal(await page.locator('#zbOv .zbItem').count(), 10);
  assert.equal(await page.locator('#zbOv .zbItem .zbNo').first().textContent(), '0001', 'numbered as on the MC-707');
  /* the category tree, sorting and ratings */
  await page.locator('#zbOv .zbCt', { hasText: 'Synth Bass' }).click();
  assert.equal(await page.locator('#zbOv .zbItem').count(), 10, 'all ten are Synth Bass');
  await page.locator('#zbOv .zbTh button', { hasText: 'Name' }).click();
  await page.locator('#zbOv .zbTh button', { hasText: 'Name' }).click();
  assert.equal(
    await page.locator('#zbOv .zbItem .zbNm').first().textContent(),
    'Test Tone 9',
    'sorted by name, reversed'
  );
  await page.locator('#zbOv .zbItem', { hasText: 'Test Tone 7' }).locator('.zbStar').nth(1).click();
  assert.equal(await page.locator('#zbOv .zbItem', { hasText: 'Test Tone 7' }).locator('.zbStar.on').count(), 2);
  await page.locator('#zbOv .zbChip', { hasText: 'Favourites' }).click();
  assert.equal(await page.locator('#zbOv .zbItem').count(), 1, 'a rated tone is a favourite');
  await page.locator('#zbOv .zbChip', { hasText: 'Factory' }).first().click();
  /* ↑ ↓ step through the list, loading each */
  await page.locator('#zbOv .zbItem', { hasText: 'Test Tone 2' }).click();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(`${z}.ZE.snd.v['CMN.NAME']`),
    'Test Tone 1',
    'the next one down is loaded (still sorted by name, reversed)'
  );
  assert.ok(
    !(await page.evaluate(
      `JSON.parse(${z}.libraryJSON ? ${z}.libraryJSON() : '{"list":[]}').list.some(e => e.src === 'factory')`
    ))
  );
  /* a kit: each key's instrument number goes after its group, in a second pass (the MC-707 checks the
     number against the group already set) */
  await page.locator('#zbOv button', { hasText: 'Done' }).click();
  await page.evaluate(`${z}.open(0, 0)`);
  await page.waitForTimeout(500);
  await page.evaluate(`${z}.browse()`);
  await page.evaluate('window.__out.length = 0');
  await page.locator('#zbOv .zbItem', { hasText: 'Test Kit 3' }).click();
  await page.waitForFunction(() => window.__out.some(b => b[0] === 0xb0 && b[1] === 11 && b[2] > 0), null, {
    timeout: 15000
  });
  const dt1 = await page.evaluate(`window.__out.filter(b => b[0] === 0xf0 && b[7] === 0x12).map(b => b.length - 14)`);
  const last = dt1.slice(-88);
  assert.ok(dt1.length > 176, 'the whole kit is sent');
  assert.ok(
    last.every(n => n === 4),
    'the last 88 writes are the instrument numbers alone (4 bytes each): ' + last.slice(0, 6)
  );
  assert.equal(await page.evaluate(`${z}.ZE.snd.v['KPTL15.INST_NUM']`), 103);
  await page.evaluate(`${z}.browse()`);
  /* remove them */
  await page.locator('#zbOv button', { hasText: 'Grab from' }).click();
  await page.locator('.cmenu >> text=Remove the factory sounds').click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(`${z}.ZS.list.filter(e => e.src === 'factory').length`), 0);
  assert.deepEqual(errors, []);
});
