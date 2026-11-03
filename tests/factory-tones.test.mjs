// Factory tones from the MC-707 update file (zen/zc-factory.js, zen/zc-factory-ui.js). No Roland file is
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
    return Array.from(b);
  })()`);
  const dir = mkdtempSync(join(tmpdir(), 'fw-')),
    file = join(dir, 'MC707_UPA_up.bin');
  writeFileSync(file, Buffer.from(bytes));

  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(500);
  await page.evaluate(`${z}.browse()`);
  await page.locator('#zbOv button', { hasText: 'Grab from' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.cmenu >> text=Factory tones and kits from the MC-707 update file').click();
  await (await chooser).setFiles(file);
  for (let t = 0; t < 100 && !(await page.evaluate(`${z}.ZS.list.some(e => e.src === 'factory')`)); t++)
    await page.waitForTimeout(100);
  const got = await page.evaluate(
    `${z}.ZS.list.filter(e => e.src === 'factory').map(e => [e.name, e.type, e.d, e.bank, e.no])`
  );
  assert.equal(got.length, 10, 'ten tones');
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
  /* remove them */
  await page.locator('#zbOv button', { hasText: 'Grab from' }).click();
  await page.locator('.cmenu >> text=Remove the factory tones and kits').click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(`${z}.ZS.list.filter(e => e.src === 'factory').length`), 0);
  assert.deepEqual(errors, []);
});

test('Factory kits: read from an update file as their bytes (record and each key’s instrument)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { fwKits, fwKitBytes } = window.__app.zen.fw,
      KIT = 0xd00,
      INST = 216,
      name = (b, o, s) => [...s.padEnd(16)].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
    /* an instrument table (Off, then 4 drums) and 9 kits (the last INIT KIT), among other bytes */
    const b = new Uint8Array(4096 + 5 * INST + 512 + 9 * KIT + 512).fill(0xff),
      table = 4096,
      kits = table + 5 * INST + 512;
    ['Off', 'Kick A', 'Snare A', 'Hat A', 'Clap A'].forEach((n, i) => {
      b.fill(i, table + i * INST, table + (i + 1) * INST);
      name(b, table + i * INST, n);
    });
    for (let k = 0; k < 9; k++) {
      const o = kits + k * KIT;
      b.fill(0, o, o + KIT);
      name(b, o, k === 8 ? 'INIT KIT' : 'Kit ' + k);
      /* keys 36-39 play instruments 1-4 (rotated by kit) */
      for (let i = 0; i < 4; i++) b[o + 0xa0 + (21 + i) * 20] = ((i + k) % 4) + 1;
    }
    const got = fwKits(b),
      k2 = got.find(x => x.name === 'Kit 2'),
      bytes = fwKitBytes(k2.mpj),
      instName = i => String.fromCharCode(...bytes.keys.subarray(i * INST, i * INST + 16)).trim();
    return {
      names: got.map(x => x.name),
      banks: [...new Set(got.map(x => x.bank))],
      rec: String.fromCharCode(...bytes.rec.subarray(0, 16)).trim(),
      recSize: bytes.rec.length,
      keys: [0, 21, 22, 23, 24, 87].map(instName),
      keysSize: bytes.keys.length
    };
  });
  assert.deepEqual(
    r.names,
    ['Kit 0', 'Kit 1', 'Kit 2', 'Kit 3', 'Kit 4', 'Kit 5', 'Kit 6', 'Kit 7'],
    'INIT KIT left out'
  );
  assert.deepEqual(r.banks, ['K']);
  assert.equal(r.rec, 'Kit 2');
  assert.equal(r.recSize, 0xd00);
  assert.deepEqual(r.keys, ['Off', 'Hat A', 'Clap A', 'Kick A', 'Snare A', 'Off'], 'each key gets its instrument');
  assert.equal(r.keysSize, 88 * 216);
  assert.deepEqual(errors, []);
});
