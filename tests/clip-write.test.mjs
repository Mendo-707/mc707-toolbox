// Writing a pattern into an MC-707 clip (zen/zc-seq.js, layout from Ada Locriana's mctools_seq): only an
// empty clip, long notes tied across steps, drum lanes through the drum map, then read back to check.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* an empty clip (or one with notes) in the fake MC-707: steps of 1/16 */
async function seed(page, t, k, n, notes = []) {
  await page.evaluate(
    ([t, k, n, notes]) => {
      const S = window.__app.seq,
        mem = window.__zcMem,
        put = (l, b) => b.forEach((x, i) => mem.set(l + i, x)),
        nib = v => [((v & 0xff) >> 4) & 15, v & 15];
      put(S.paramAddr(t, k), [1, (n >> 4) & 15, n & 15]);
      put(S.clipAddr(t, k), Array(16).fill(32));
      for (let s = 0; s < n; s++) {
        const a = S.stepAddr(t, k, s),
          at = notes.filter(x => x.step === s);
        put(a + 0x10, Array.from({ length: 8 }, (_, i) => nib(at[i] ? at[i].note : 0xff)).flat());
        put(a + 0x20, Array(16).fill(15));
        put(a + 0x30, Array(16).fill(0x50));
        put(a + 0x40, Array(16).fill(0));
        put(a + 0x50, Array(16).fill(0));
        put(a + 0x60, Array(16).fill(0x50));
        put(a + 0x70, Array(16).fill(0));
      }
    },
    [t, k, n, notes]
  );
}
const toastHas = (page, s) => page.waitForFunction(t => document.body.innerText.includes(t), s, { timeout: 30000 });
const byte = (page, l) => page.evaluate(l => window.__zcMem.get(l), l);
const dt1s = page => page.evaluate(() => window.__out.filter(b => b[0] === 0xf0 && b[1] === 0x41 && b[7] === 0x12));

test('Clip write: a pattern goes into an empty clip, ties across steps, and reads back the same', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page, 3, 1, 16);
  await page.evaluate('window.__out.length = 0');
  const p = {
    name: 'Test riff',
    type: 'tone',
    bars: 1,
    notes: [
      { s: 0, l: 0.5, n: 60, v: 100 },
      { s: 4, l: 2.5, n: 64, v: 90 },
      { s: 8.25, l: 0.5, n: 67, v: 110 },
      { s: 8.25, l: 0.5, n: 71, v: 70 }
    ]
  };
  await page.evaluate(([p]) => window.__app.seq.write(p, 3, 1), [p]);
  await toastHas(page, 'read back and checked');
  const step = s => page.evaluate(([s]) => window.__app.seq.stepAddr(3, 1, s), [s]);
  const s0 = await step(0),
    s4 = await step(4),
    s5 = await step(5),
    s6 = await step(6),
    s8 = await step(8);
  /* C4 = 3C as 03 0C in slot 1, ending at 50 */
  assert.deepEqual(
    [await byte(page, s0 + 0x10), await byte(page, s0 + 0x11), await byte(page, s0 + 0x60)],
    [3, 12, 50]
  );
  /* E4 held 2.5 steps: end 100, 100, then 50 */
  assert.deepEqual(
    [await byte(page, s4 + 0x60), await byte(page, s5 + 0x60), await byte(page, s6 + 0x60)],
    [100, 100, 50]
  );
  /* the chord: two slots in step 9, both starting 25 in */
  assert.deepEqual(
    [
      await byte(page, s8 + 0x10),
      await byte(page, s8 + 0x11),
      await byte(page, s8 + 0x12),
      await byte(page, s8 + 0x13)
    ],
    [4, 3, 4, 7]
  );
  assert.deepEqual([await byte(page, s8 + 0x40), await byte(page, s8 + 0x41)], [1, 9], 'start 25 = 0x19');
  /* only the clip's step settings and steps were written */
  const [lo, hi] = await page.evaluate(() => [
    window.__app.seq.paramAddr(3, 1),
    window.__app.seq.stepAddr(3, 1, 15) + 0x80
  ]);
  const writes = await dt1s(page);
  assert.ok(writes.length >= 16 * 7, 'every step written');
  const lin = a => (a[0] << 21) | (a[1] << 14) | (a[2] << 7) | a[3];
  assert.ok(
    writes.map(b => lin(b.slice(8, 12))).every(l => l === lo || (l >= lo && l < hi)),
    'only the clip: its step settings and its 16 steps'
  );
  assert.deepEqual(errors, []);
});

test('Clip write: a clip that holds notes is left alone', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page, 4, 0, 16, [{ step: 2, note: 62 }]);
  await page.evaluate('window.__out.length = 0');
  const p = { name: 'X', type: 'tone', bars: 1, notes: [{ s: 0, l: 1, n: 60, v: 100 }] };
  await page.evaluate(([p]) => window.__app.seq.write(p, 4, 0), [p]);
  await toastHas(page, 'already has notes');
  assert.equal((await dt1s(page)).length, 0, 'nothing written');
  assert.deepEqual(errors, []);
});

test('Clip write: drum lanes become drum notes; over 8 bars is refused', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page, 0, 3, 16);
  const kick = await page.evaluate(() => window.__app.S.drumMap[0]);
  const p = { name: 'Beat', type: 'drum', bars: 1, notes: [{ s: 0, l: 0.25, n: 0, v: 120 }] };
  await page.evaluate(([p]) => window.__app.seq.write(p, 0, 3), [p]);
  await toastHas(page, 'read back and checked');
  const a = await page.evaluate(() => window.__app.seq.stepAddr(0, 3, 0));
  assert.equal(
    (await byte(page, a + 0x10)) * 16 + (await byte(page, a + 0x11)),
    kick,
    'lane 0 written as the kick note'
  );
  const long = { name: 'Long', type: 'drum', bars: 16, notes: [] };
  await page.evaluate(([p]) => window.__app.seq.write(p, 0, 3), [long]);
  await toastHas(page, 'up to 8 bars');
  assert.deepEqual(errors, []);
});

test('Clip read: reading the same clip again replaces the copy in My patterns', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page, 3, 6, 16, [{ step: 0, note: 65 }]);
  const count = () => page.evaluate(() => JSON.parse(localStorage.getItem('mc707-user-patterns') || '[]').length);
  await page.evaluate(() => window.__app.seq.read(3, 6));
  await page.waitForFunction(() => (localStorage.getItem('mc707-user-patterns') || '[]') !== '[]');
  await page.evaluate(() => window.__app.seq.read(3, 6));
  await page.waitForTimeout(1500);
  assert.equal(await count(), 1);
  assert.deepEqual(errors, []);
});

test('Clip write: the editor’s → MC-707 clip button asks where, then writes', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.locator('#libList .li').first().click();
  await page.locator('.edView button', { hasText: '→ MC-707 clip' }).click();
  await page.waitForSelector('#cwOv');
  const t = +(await page.locator('#cwOv select').first().inputValue());
  await seed(page, t, 4, 16);
  await page.locator('#cwOv select').nth(1).selectOption('4');
  await page.locator('#cwOv button', { hasText: 'Write' }).click();
  assert.equal(await page.locator('#cwOv').count(), 0);
  await toastHas(page, 'clip 5, read back and checked');
  assert.deepEqual(errors, []);
});
