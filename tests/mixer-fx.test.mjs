// The mixers' effects (zen/zc-fx.js, services/mixer-fx.js): each strip's Effect goes into the MFX of every
// clip's sound and the track's own, and the Master FX strip sets the MC-707's total effects (reverb and
// chorus/delay types and levels, the master Multi FX, compressor and EQ) and reads them back.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const lin = a => (((a >>> 24) & 0x7f) << 21) | (((a >>> 16) & 0x7f) << 14) | (((a >>> 8) & 0x7f) << 7) | (a & 0x7f);
const mem = (page, l, n = 1) =>
  page.evaluate(([l, n]) => Array.from({ length: n }, (_, i) => window.__zcMem.get(l + i)), [l, n]);

test('Mixer effects: a track’s effect in all its sounds, and the master FX', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  const [win] = await Promise.all([page.waitForEvent('popup'), page.click('#bMixer')]);
  await win.waitForSelector('.mxMaster');
  /* track 4 gets the dotted ping-pong delay */
  const sel = win.locator('.mxStrip').nth(3).locator('.mxFx select');
  /* the list fills when it is opened */
  await sel.focus();
  const label = await sel.locator('option', { hasText: 'Delay: dotted 1/8 ping-pong' }).getAttribute('value');
  await sel.selectOption(label);
  await win.waitForFunction(() => !document.querySelector('.mxFx.busy'), null, { timeout: 20000 });
  const slots = await page.evaluate(() => [0, 7, 16].map(k => window.__app.zen.slotAddr('tone', 3, k) + 0x80));
  for (const at of slots) {
    const [type, sw] = await mem(page, at, 2);
    assert.ok(type > 0, 'an effect type in clip ' + at);
    assert.equal(sw, 1, 'switched on');
  }
  assert.equal(await sel.inputValue(), label, 'the strip shows it');
  /* the master strip: reverb type, level, chorus off, Multi FX, comp */
  const M = win.locator('.mxMaster');
  await M.locator('select[aria-label="Reverb type"]').focus();
  await M.locator('select[aria-label="Reverb type"]').selectOption({ label: 'Hall' });
  await page.waitForTimeout(300);
  assert.deepEqual(await mem(page, lin(0x10002700), 2), [1, 3], 'reverb on, type Hall');
  await M.locator('input[aria-label="Reverb level"]').evaluate(e => {
    e.value = 90;
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  assert.deepEqual(await mem(page, lin(0x10002702)), [90]);
  await M.locator('select[aria-label="Chorus or delay type"]').focus();
  await M.locator('select[aria-label="Chorus or delay type"]').selectOption({ label: 'Off' });
  await page.waitForTimeout(300);
  assert.equal((await mem(page, lin(0x10002600)))[0], 0, 'chorus switched off');
  await win.locator('.mxMaster select[aria-label="Master Multi FX"]').focus();
  await win.locator('.mxMaster select[aria-label="Master Multi FX"]').selectOption({ label: 'Isolator' });
  await page.waitForTimeout(1500);
  const [mt, msw] = await mem(page, lin(0x10002000), 2);
  assert.ok(mt > 0 && msw === 1, 'master Multi FX set');
  await win.locator('.mxMaster button', { hasText: 'Comp' }).click();
  await page.waitForTimeout(300);
  assert.equal((await mem(page, lin(0x10003a00)))[0], 1, 'compressor on');
  /* read back */
  await page.evaluate(
    ([a, b]) => (window.__zcMem.set(a, 1), window.__zcMem.set(b, 2)),
    [lin(0x10002700), lin(0x10002701)]
  );
  await win.locator('.mxMaster button', { hasText: 'Read from MC-707' }).click();
  await win.waitForFunction(
    () =>
      document.querySelector('.mxMaster select[aria-label="Reverb type"]').selectedOptions[0].textContent ===
      'Warm Hall'
  );
  assert.deepEqual(errors, []);
});
