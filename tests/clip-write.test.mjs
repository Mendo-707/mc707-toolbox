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

test('Clip write: drum lanes become drum notes; over 16 bars is refused', async () => {
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
  const long = { name: 'Long', type: 'drum', bars: 32, notes: [] };
  await page.evaluate(([p]) => window.__app.seq.write(p, 0, 3), [long]);
  await toastHas(page, 'up to 16 bars');
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

test('Clip write: Replace writes over a clip with notes, all 128 steps, and names the clip', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page, 5, 2, 16, [{ step: 2, note: 62 }]);
  /* a name field of 12 characters (the reply says how long it is) */
  await page.evaluate(() => {
    const a = window.__app.seq.clipAddr(5, 2);
    for (let i = 12; i < 16; i++) window.__zcMem.delete(a + i);
  });
  const p = { name: 'Deep riff number one', type: 'tone', bars: 1, notes: [{ s: 0, l: 1, n: 60, v: 100 }] };
  await page.evaluate(([p]) => window.__app.seq.write(p, 5, 2, { replace: true, name: true }), [p]);
  await toastHas(page, 'Replaced the notes in track 6 clip 3 with 1 notes, read back and checked');
  const [s2, s127, nm] = await page.evaluate(() => [
    window.__app.seq.stepAddr(5, 2, 2),
    window.__app.seq.stepAddr(5, 2, 127),
    window.__app.seq.clipAddr(5, 2)
  ]);
  assert.deepEqual([await byte(page, s2 + 0x10), await byte(page, s2 + 0x11)], [15, 15], 'the old note is gone');
  assert.equal(await byte(page, s127 + 0x10), 15, 'the last of the 128 steps is cleared too');
  const name = await page.evaluate(
    ([a]) => String.fromCharCode(...Array.from({ length: 12 }, (_, i) => window.__zcMem.get(a + i))),
    [nm]
  );
  assert.equal(name, 'Deep riff nu', 'as many characters as the field holds');
  assert.equal(await byte(page, nm + 12), undefined, 'nothing written past the name field');
  assert.deepEqual(errors, []);
});

test('Clip write: Song › Send patterns to MC-707 clips puts each track’s patterns in its clips', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate(() => {
    const S = window.__app.S;
    S.clips = [];
    S.patterns.pA = { id: 'pA', name: 'Riff A', type: 'tone', bars: 1, notes: [{ s: 0, l: 1, n: 60, v: 100 }] };
    S.patterns.pB = { id: 'pB', name: 'Riff B', type: 'tone', bars: 1, notes: [{ s: 2, l: 1, n: 64, v: 90 }] };
    const c = (id, start, pat, tr) => ({ id, t: 3, start, len: 1, off: 0, pat, ...(tr ? { tr } : {}) });
    S.clips.push(c('c1', 0, 'pA'), c('c2', 1, 'pB'), c('c3', 2, 'pA'), c('c4', 3, 'pA', 12));
  });
  for (const k of [2, 3, 4]) await seed(page, 3, k, 16);
  await page.locator('#menubar .mb', { hasText: 'Song' }).first().click();
  await page.locator('.mdrop:not([hidden]) button', { hasText: 'Send patterns to MC-707 clips' }).click();
  await page.waitForSelector('#scOv');
  await page.locator('#scOv select[aria-label="First clip for track 4"]').selectOption('2');
  assert.match(
    await page.locator('#scOv .scRow').first().textContent(),
    /clip 3: Riff A · clip 4: Riff B · clip 5: Riff A \+12/
  );
  await page.locator('#scOv button', { hasText: 'Send' }).click();
  const dlg = page.locator('[role=dialog][aria-modal]', { hasText: 'Sent 3 patterns to MC-707 clips' });
  await dlg.waitFor({ timeout: 60000 });
  const note = k =>
    page.evaluate(
      ([k]) => {
        const a = window.__app.seq.stepAddr(3, k, 0);
        return window.__zcMem.get(a + 0x10) * 16 + window.__zcMem.get(a + 0x11);
      },
      [k]
    );
  assert.equal(await note(2), 60, 'Riff A in clip 3');
  assert.equal(await note(4), 72, 'Riff A +12 in clip 5');
  const b = await page.evaluate(() => {
    const a = window.__app.seq.stepAddr(3, 3, 2);
    return window.__zcMem.get(a + 0x10) * 16 + window.__zcMem.get(a + 0x11);
  });
  assert.equal(b, 64, 'Riff B in clip 4, on its third step');
  await dlg.locator('button', { hasText: 'OK' }).click();
  assert.deepEqual(errors, []);
});

test('Clip write: while writing, a panel shows it, playback stops and cannot start, and Cancel stops it', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page, 3, 9, 16, [{ step: 1, note: 60 }]);
  /* the song is playing when the write starts: it stops */
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__app.TR.playing);
  const p = { name: 'Slow one', type: 'tone', bars: 1, notes: [{ s: 0, l: 1, n: 60, v: 100 }] };
  await page.evaluate(
    ([p]) => {
      window.__app.seq.write(p, 3, 9, { replace: true });
    },
    [p]
  );
  await page.waitForSelector('#wpPanel');
  assert.equal(await page.evaluate(() => window.__app.TR.playing), false, 'playback stopped for the write');
  /* Play is refused while it writes */
  await page.keyboard.press('Space');
  await toastHas(page, 'Still writing to the MC-707');
  assert.equal(await page.evaluate(() => window.__app.TR.playing), false);
  /* Cancel stops it part-way (replacing writes all 128 steps, so it is still going) */
  await page.waitForFunction(() => /Step \d+ of 128/.test(document.querySelector('#wpPanel')?.textContent || ''));
  await page.locator('#wpPanel button', { hasText: 'Cancel' }).click();
  await toastHas(page, 'Stopped part-way: clip 10 is only partly written');
  await page.waitForFunction(() => !document.querySelector('#wpPanel'));
  /* and playback works again */
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__app.TR.playing);
  await page.keyboard.press('Space');
  assert.deepEqual(errors, []);
});

test('Clip write: a 16-bar pattern goes in 1/8 steps, 16ths kept as half-step starts', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page, 6, 0, 16);
  const p = {
    name: 'Long line',
    type: 'tone',
    bars: 16,
    notes: [
      { s: 0, l: 1, n: 60, v: 100 },
      { s: 1, l: 1, n: 62, v: 100 },
      { s: 128, l: 8, n: 67, v: 90 },
      { s: 255, l: 1, n: 72, v: 80 }
    ]
  };
  await page.evaluate(([p]) => window.__app.seq.write(p, 6, 0), [p]);
  await toastHas(page, 'Wrote 4 notes to track 7 clip 1, read back and checked');
  const [pa, s1, s127] = await page.evaluate(() => [
    window.__app.seq.paramAddr(6, 0),
    window.__app.seq.stepAddr(6, 0, 1),
    window.__app.seq.stepAddr(6, 0, 127)
  ]);
  assert.deepEqual(
    [await byte(page, pa), await byte(page, pa + 1), await byte(page, pa + 2)],
    [0, 8, 0],
    '128 steps of 1/8'
  );
  /* the second 16th, D4, goes in its nearest step (step 2), half a step early (start -50 = CE) */
  assert.deepEqual(
    [
      await byte(page, s1 + 0x10),
      await byte(page, s1 + 0x11),
      await byte(page, s1 + 0x40),
      await byte(page, s1 + 0x41)
    ],
    [3, 14, 12, 14]
  );
  assert.deepEqual([await byte(page, s127 + 0x40), await byte(page, s127 + 0x41)], [3, 2], 'the last 16th');
  assert.deepEqual(errors, []);
});
