// The Master FX strip's level and settings panels (zen/zc-total.js, services/mixer-panel.js): the master
// level, the reverb's and the delay's settings for their type, the master EQ and compressor, read from
// the MC-707 and written back as you change them.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const lin = a => (((a >>> 24) & 0x7f) << 21) | (((a >>> 16) & 0x7f) << 14) | (((a >>> 8) & 0x7f) << 7) | (a & 0x7f);
const nib = v => {
  const x = (v + 0x8000) & 0xffff;
  return [(x >> 12) & 15, (x >> 8) & 15, (x >> 4) & 15, x & 15];
};
const setRange = (loc, v) =>
  loc.evaluate((e, v) => {
    e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test('Master FX: level, reverb and delay settings for their type, master EQ and compressor', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  /* the MC-707 as read on one: Integra reverb (Hall 1, 26 ms, 2.6 s…), a 2Tap delay, EQ and comp flat */
  const REV = lin(0x10002700),
    CHO = lin(0x10002600),
    EQ = lin(0x10003900),
    COMP = lin(0x10003a00);
  const put = (l, b) => page.evaluate(([l, b]) => b.forEach((x, i) => window.__zcMem.set(l + i, x)), [l, b]);
  await put(REV, [1, 1, 100, ...[2, 26, 26, 127, 127, 50, 50, 127, 64].flatMap(nib)]);
  await put(CHO, [1, 8, 90, 0, ...[1, 300, 11, 20, 17, -20, 20, 100, 100].flatMap(nib)]);
  await put(EQ, [64, 64, 64, 64, 64, 64, 10, 17, 17, 17, 20, 1, 1, 1, 0]);
  await put(COMP, [0, 0, 0, 64, 0, 0, 64, 0, 0, 64, 0, 0, 64, 0, 0, 64, 0, 0, 64, 10, 24, 0, 0, 0]);
  await put(lin(0x10000014), [100]);
  const [win] = await Promise.all([page.waitForEvent('popup'), page.click('#bMixer')]);
  const M = win.locator('.mxMaster');
  await M.locator('button', { hasText: 'Read from MC-707' }).click();
  await win.waitForFunction(() => /Reverb level/.test(document.querySelector('.mxMaster').textContent));
  await win.waitForFunction(
    () => document.querySelector('.mxMaster input[aria-label="Master level"]')?.value === '100'
  );
  /* master level */
  await setRange(M.locator('input[aria-label="Master level"]'), 90);
  await page.waitForFunction(l => window.__zcMem.get(l) === 90, lin(0x10000014));
  /* the reverb's settings: Integra's, read back */
  await M.locator('.mxEdit button', { hasText: 'Reverb' }).click();
  await win.waitForSelector('.mpBox');
  await win.waitForFunction(() => /Time\s*2\.6 sec/.test(document.querySelector('.mpBox').textContent));
  assert.match(await win.textContent('.mpBox .mpHead'), /Reverb: Integra/);
  assert.equal(await win.locator('.mpBox select[aria-label="Type"]').inputValue(), '2', 'Hall 1');
  /* Time to 4.0 s: the third slot */
  await setRange(win.locator('.mpBox input[aria-label="Time"]'), 40);
  await page.waitForFunction(l => window.__zcMem.get(l + 3 + 2 * 4 + 2) === 2, REV);
  const slot = (l, i) => page.evaluate(([l, i]) => [0, 1, 2, 3].map(j => window.__zcMem.get(l + i * 4 + j)), [l, i]);
  assert.deepEqual(await slot(REV + 3, 2), nib(40));
  /* the delay's: a 2Tap Pan Delay, feedback negative */
  await M.locator('.mxEdit button', { hasText: 'Delay' }).click();
  await win.waitForFunction(() => /2Tap Pan Delay/.test(document.querySelector('.mpBox .mpHead').textContent));
  await win.waitForFunction(() => /Feedback\s*20 %/.test(document.querySelector('.mpBox').textContent));
  await setRange(win.locator('.mpBox input[aria-label="Feedback"]'), -30);
  await page.waitForTimeout(300);
  assert.deepEqual(await slot(CHO + 4, 3), nib(-30));
  /* master EQ: low +6 dB is 64 + 6 */
  await M.locator('.mxEdit button', { hasText: 'EQ' }).click();
  await win.waitForFunction(() => /Master EQ/.test(document.querySelector('.mpBox .mpHead').textContent));
  await win.waitForFunction(() => /Low\s*0 dB/.test(document.querySelector('.mpBox').textContent));
  await setRange(win.locator('.mpBox input[aria-label="Low"]'), 6);
  await page.waitForFunction(l => window.__zcMem.get(l + 1) === 70, EQ);
  await win.locator('.mpBox select[aria-label="EQ"]').selectOption('1');
  await page.waitForFunction(l => window.__zcMem.get(l + 14) === 1, EQ);
  /* the compressor: low threshold -20 dB, its ratio 4:1 */
  await M.locator('.mxEdit button', { hasText: 'Comp' }).click();
  await win.waitForFunction(() => /Master compressor/.test(document.querySelector('.mpBox .mpHead').textContent));
  await setRange(win.locator('.mpBox input[aria-label="Low threshold"]'), -20);
  await page.waitForFunction(l => window.__zcMem.get(l + 3) === 44, COMP);
  await win.locator('.mpBox select[aria-label="Low ratio"]').selectOption({ label: '4:1' });
  await page.waitForFunction(l => window.__zcMem.get(l + 4) === 3, COMP);
  /* closing */
  await win.locator('.mpBox button[aria-label="Close"]').click();
  assert.equal(await win.locator('.mpBox').count(), 0);
  assert.deepEqual(errors, []);
});
