// The scene finder (zen/zc-scan.js): a read-only scan of the MC-707's memory, and the bytes that changed
// between two scans.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Scene finder: two scans list the changed bytes, sending only read requests', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  /* a project block, and a track's 17th slot that answers */
  await page.evaluate(() => {
    const mem = window.__zcMem;
    for (let i = 0; i < 300; i++) mem.set((0x10 << 21) + i, i & 0x7f);
    for (let i = 0; i < 16; i++) mem.set((0x21 << 21) + i, 7);
  });
  await page.evaluate('window.__out.length = 0');
  const diff = await page.evaluate(async () => {
    const S = window.__app.seq.scan;
    S.reset();
    const a = await S.once(null, 40);
    const mem = window.__zcMem;
    mem.set((0x10 << 21) + 0x45, 4);
    mem.set((0x10 << 21) + 0x46, 9);
    mem.set((0x21 << 21) + 3, 1);
    const b = await S.once(null, 40);
    return S.diff(a, b);
  });
  assert.deepEqual(diff, ['10 00 00 45: 45 46 → 04 09', '21 00 00 03: 07 → 01']);
  const sent = await page.evaluate(() => window.__out.filter(b => b[0] === 0xf0 && b[1] === 0x41).map(b => b[7]));
  assert.ok(sent.length > 0 && sent.every(x => x === 0x11), 'only data requests (RQ1), never a write');
  /* the dialog opens from the Song menu's command */
  await page.evaluate(() => window.__app.seq.scan.open());
  await page.locator('#sfOv', { hasText: 'Read-only' }).waitFor();
  assert.deepEqual(errors, []);
});
