// A clip's motion lanes (zen/zc-motion.js, layout from Ada Locriana's mctools_sidechain) and the Motion test:
// read which lanes hold motion, write the test shape into one lane, read it back.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Motion: lanes are 8 values a step, at the clip + 04 00 00 + step and lane, none as FF', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const M = window.__app.motion;
    return {
      a: M.motionAddr(0, 0, 0, 3),
      b: M.motionAddr(0, 0, 2, 0) - M.motionAddr(0, 0, 0, 0),
      enc: M.encodeMotion([0, 127, -1, 64, 5, -1, -1, 100]),
      dec: M.decodeMotion(M.encodeMotion([0, 127, -1, 64, 5, -1, -1, 100])),
      thin: M.motionThin([5, 5, 6, 6, 6, 7]),
      shape: M.testShape(4)
    };
  });
  /* 20 04 00 30 packed is 0x4010030 linear */
  assert.equal(r.a, (0x20 << 21) | (0x04 << 14) | (0x00 << 7) | 0x30);
  assert.equal(r.b, 2 << 7, 'steps are 01 00 apart');
  assert.deepEqual(r.enc, [0, 0, 7, 15, 15, 15, 4, 0, 0, 5, 15, 15, 15, 15, 6, 4]);
  assert.deepEqual(r.dec, [0, 127, -1, 64, 5, -1, -1, 100]);
  assert.deepEqual(r.thin, [5, -1, 6, -1, -1, 7]);
  assert.equal(r.shape.length, 32);
  assert.equal(r.shape[0], 0);
  assert.equal(Math.max(...r.shape), 127);
  assert.deepEqual(errors, []);
});

test('Motion test: reads which lanes hold motion, writes the test shape to C4 and reads it back', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  /* a 4-step clip on track 4, clip 2: no motion but some on C2 */
  await page.evaluate(() => {
    const Q = window.__app.seq,
      M = window.__app.motion,
      mem = window.__zcMem,
      put = (l, b) => b.forEach((x, i) => mem.set(l + i, x));
    put(Q.paramAddr(3, 1), [1, 0, 4]);
    for (let s = 0; s < 4; s++)
      for (let l = 0; l < 8; l++)
        put(M.motionAddr(3, 1, s, l), M.encodeMotion(l === 1 && s === 2 ? [90, -1, -1, -1, 40, -1, -1, -1] : []));
    M.motionTestOpen();
  });
  await page.selectOption('#mtOv select[aria-label=Track]', '3');
  await page.selectOption('#mtOv select[aria-label=Clip]', '1');
  await page.click('#mtOv button:has-text("Read every lane")');
  await page.waitForFunction(() => /Lane 8: /.test(document.querySelector('#mtOv .sfOut').textContent), null, {
    timeout: 30000
  });
  const read = await page.textContent('#mtOv .sfOut');
  assert.match(read, /C1: no motion/);
  assert.match(read, /C2: 2 values, 40 to 90 \(first at step 3: 90\)/);
  assert.match(read, /C4: no motion/);
  await page.click('#mtOv button:has-text("Write test shape")');
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.waitForFunction(
    () => /Wrote the test shape/.test(document.querySelector('#mtOv .sfOut').textContent),
    null,
    { timeout: 30000 }
  );
  assert.match(await page.textContent('#mtOv .sfOut'), /C4 of track 4 clip 2: read back the same/);
  const got = await page.evaluate(() => {
    const M = window.__app.motion,
      mem = window.__zcMem;
    return M.decodeMotion(Array.from({ length: 16 }, (_, i) => mem.get(M.motionAddr(3, 1, 0, 3) + i)));
  });
  assert.equal(got[0], 0, 'starts at 0');
  /* C2 is left alone */
  const c2 = await page.evaluate(() => {
    const M = window.__app.motion,
      mem = window.__zcMem;
    return M.decodeMotion(Array.from({ length: 16 }, (_, i) => mem.get(M.motionAddr(3, 1, 2, 1) + i)));
  });
  assert.deepEqual(c2, [90, -1, -1, -1, 40, -1, -1, -1]);
  assert.deepEqual(errors, []);
});
