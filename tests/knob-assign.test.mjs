// The mixers' KNOB ASSIGN choosers (zen/zc-knobs.js, services/mixer-fx.js): each strip's four knobs show
// what they control on the MC-707, read from the track's own structure, and choosing another writes it
// there and into the track's 16 clips, as four half-bytes keeping the high byte read.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const lin = a => (((a >>> 24) & 0x7f) << 21) | (((a >>> 16) & 0x7f) << 14) | (((a >>> 8) & 0x7f) << 7) | (a & 0x7f);
/* track 1's own structure follows its 16 clips: 21 00 00 00; its clip 1 is 20 00 00 00 */
const at = (desc, n) => lin(desc) + lin(0x10000) + 0x29 + n * 0x3c;

test('Mixer knobs: what C1-C4 control, read from the MC-707 and set for the whole track', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  /* the MC-707 as seen: track 1 (a drum track) on Cutoff, Decay, Reverb Send and Coarse Tune */
  await page.evaluate(
    ([l, vals]) => vals.forEach((v, n) => [2, 0, v >> 4, v & 15].forEach((b, i) => window.__zcMem.set(l[n] + i, b))),
    [[0, 1, 2, 3].map(n => at(0x21000000, n)), [0x0a, 0x0d, 0x15, 0x03]]
  );
  const [win] = await Promise.all([page.waitForEvent('popup'), page.click('#bMixer')]);
  await win.waitForSelector('.mxStrip .mxKSel');
  const sels = win.locator('.mxStrip').first().locator('.mxKSel');
  assert.equal(await sels.count(), 4, 'a chooser per knob');
  await win.waitForFunction(() => document.querySelector('.mxStrip .mxKSel').selectedOptions[0].textContent === 'Cutoff');
  const shown = await sels.evaluateAll(s => s.map(x => x.selectedOptions[0].textContent));
  assert.deepEqual(shown, ['Cutoff', 'Decay', 'Reverb Send', 'Coarse Tune'], 'read from the MC-707');
  /* a drum track has no tone-only choices */
  assert.equal(await sels.first().locator('option', { hasText: 'Portamento' }).count(), 0);
  /* C1 to Resonance: the track's own structure and every clip */
  await sels.first().selectOption({ label: 'Resonance' });
  await page.waitForFunction(l => window.__zcMem.get(l + 3) === 0x0b, at(0x20780000, 0));
  const read = l => page.evaluate(l => [0, 1, 2, 3].map(i => window.__zcMem.get(l + i)), l);
  assert.deepEqual(await read(at(0x21000000, 0)), [2, 0, 0, 0x0b], 'the track: Resonance, high byte kept');
  assert.deepEqual(await read(at(0x20000000, 0)), [2, 0, 0, 0x0b], 'clip 1');
  assert.deepEqual(await read(at(0x20780000, 0)), [2, 0, 0, 0x0b], 'clip 16');
  /* SYS-Ctrl1 is past 127: two half-bytes */
  await sels.nth(1).selectOption({ label: 'SYS-Ctrl1' });
  await page.waitForFunction(l => window.__zcMem.get(l + 2) === 0x0a, at(0x20780000, 1));
  assert.deepEqual(await read(at(0x21000000, 1)), [2, 0, 0x0a, 0x01]);
  assert.deepEqual(errors, []);
});
