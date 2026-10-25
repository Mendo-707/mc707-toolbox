// Reading a clip's notes from the MC-707 (zen/zc-seq.js; layout from Ada Locriana's mctools_seq):
// the clips screen's READ NOTES puts them in My patterns, and only read requests go to the MC-707.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* put a clip in the fake MC-707's memory: steps is [[{note, vel, start, end, sub}…] per step] */
async function seedClip(page, t, k, size, steps) {
  await page.evaluate(
    ([t, k, size, steps]) => {
      const S = window.__app.seq,
        mem = window.__zcMem;
      const put = (l, bytes) => bytes.forEach((b, i) => mem.set(l + i, b));
      const nib = v => [((v & 0xff) >> 4) & 15, v & 15];
      put(S.paramAddr(t, k), [size, (steps.length >> 4) & 15, steps.length & 15, 0]);
      put(S.clipAddr(t, k), [...'MY CLIP'].map(c => c.charCodeAt(0)).concat(Array(9).fill(32)));
      steps.forEach((slots, s) => {
        const a = S.stepAddr(t, k, s),
          f = Array.from({ length: 16 }, (_, i) => slots[i] || null);
        put(
          a + 0x10,
          f.slice(0, 8).flatMap(x => nib(x ? x.note : 0xff))
        );
        put(
          a + 0x20,
          f.slice(8).flatMap(x => nib(x ? x.note : 0xff))
        );
        put(
          a + 0x30,
          f.map(x => (x ? x.vel : 0x50))
        );
        put(
          a + 0x40,
          f.slice(0, 8).flatMap(x => nib(x ? x.start : 0))
        );
        put(
          a + 0x50,
          f.slice(8).flatMap(x => nib(x ? x.start : 0))
        );
        put(
          a + 0x60,
          f.map(x => (x ? x.end : 0x50))
        );
        put(
          a + 0x70,
          f.map(x => (x ? x.sub || 0 : 0))
        );
      });
    },
    [t, k, size, steps]
  );
}
const mine = page => page.evaluate(() => JSON.parse(localStorage.getItem('mc707-user-patterns') || '[]'));

test('Clip notes: addresses follow the MC-707 layout', async () => {
  const { page, errors } = await openApp();
  const hex = await page.evaluate(() =>
    [
      [0, 0],
      [0, 15],
      [1, 0],
      [1, 15],
      [7, 0]
    ].map(([d, k]) => window.__app.seq.clipPacked(d, k).toString(16))
  );
  assert.deepEqual(hex, ['20000000', '20780000', '21080000', '22000000', '27380000']);
  assert.deepEqual(errors, []);
});

test('Clip notes: READ NOTES reads a tone clip into My patterns, sending only read requests', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  const n = (note, vel, start, end) => ({ note, vel, start, end });
  /* 16 steps of 1/16: a short C4, an E4 held 2.5 steps, a G4 + B4 chord off the grid */
  const steps = Array.from({ length: 16 }, () => []);
  steps[0] = [n(60, 100, 0, 50)];
  steps[4] = [n(64, 90, 0, 100)];
  steps[5] = [n(64, 90, 0, 100)];
  steps[6] = [n(64, 90, 0, 50)];
  steps[8] = [n(67, 110, 25, 75), n(71, 70, 25, 75)];
  await seedClip(page, 3, 0, 1, steps);
  await page.evaluate('window.__out.length = 0');
  await page.click('#bClips');
  await page.locator('.lcdCmdI', { hasText: 'READ NOTES' }).click();
  await page.waitForFunction(() => (localStorage.getItem('mc707-user-patterns') || '').includes('MY CLIP'), null, {
    timeout: 20000
  });
  const [p] = await mine(page);
  assert.equal(p.name, 'MY CLIP');
  assert.equal(p.type, 'tone');
  assert.equal(p.bars, 1);
  assert.deepEqual(
    p.notes.map(x => [x.s, x.l, x.n, x.v]),
    [
      [0, 0.5, 60, 100],
      [4, 2.5, 64, 90],
      [8.25, 0.5, 67, 110],
      [8.25, 0.5, 71, 70]
    ]
  );
  const sent = await page.evaluate(() => window.__out.filter(b => b[0] === 0xf0 && b[1] === 0x41).map(b => b[7]));
  assert.ok(sent.length > 0 && sent.every(x => x === 0x11), 'only data requests (RQ1), never a write');
  assert.deepEqual(errors, []);
});

test('Clip notes: a drum clip uses the drum map, 1/8 steps double up, and a note with no lane is left out', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  const steps = Array.from({ length: 8 }, () => []);
  steps[0] = [{ note: 36, vel: 120, start: 0, end: 30 }];
  steps[2] = [{ note: 99, vel: 100, start: 0, end: 30 }];
  steps[4] = [{ note: 38, vel: 100, start: 0, end: 30 }];
  await seedClip(page, 0, 2, 0, steps);
  await page.evaluate(() => window.__app.seq.read(0, 2));
  await page.waitForFunction(() => (localStorage.getItem('mc707-user-patterns') || '').includes('MY CLIP'), null, {
    timeout: 20000
  });
  const [p] = await mine(page);
  assert.equal(p.type, 'drum');
  assert.equal(p.bars, 1, '8 steps of 1/8 = one bar');
  assert.deepEqual(
    p.notes.map(x => [x.s, x.n]),
    [
      [0, 0],
      [8, 2]
    ],
    'kick on lane 0, snare on lane 2 at the half bar'
  );
  assert.deepEqual(errors, []);
});

test('Clip notes: a reply from an unexpected address still counts, and a silent MC-707 shows what was sent', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  const steps = Array.from({ length: 4 }, () => []);
  steps[1] = [{ note: 62, vel: 99, start: 0, end: 80 }];
  await seedClip(page, 4, 1, 1, steps);
  /* replies whose address is not the one asked for, as the MC-707 may send for this area */
  await page.evaluate(() => (window.__zcOdd = true));
  await page.evaluate(() => window.__app.seq.read(4, 1));
  await page.waitForFunction(() => (localStorage.getItem('mc707-user-patterns') || '').includes('MY CLIP'), null, {
    timeout: 20000
  });
  const [p] = await mine(page);
  assert.deepEqual(
    p.notes.map(x => [x.s, x.n, x.v]),
    [[1, 62, 99]]
  );
  /* nothing answers: the dialog shows the messages that went out, to report */
  await page.evaluate(() => ((window.__zcOdd = false), (window.__zcMute = true)));
  /* not awaited: the read waits for the dialog to close */
  await page.evaluate(() => {
    window.__app.seq.read(5, 3);
  });
  const dlg = page.locator('[role=dialog][aria-modal]', { hasText: 'Reading the clip’s notes did not work' });
  await dlg.waitFor({ timeout: 20000 });
  const text = await dlg.textContent();
  assert.match(text, /→ f0 41 10 00 00 00 5d 11/, 'the read requests are listed');
  assert.match(text, /track 6 clip 4/);
  await dlg.locator('button', { hasText: 'Close' }).last().click();
  assert.deepEqual(errors, []);
});
