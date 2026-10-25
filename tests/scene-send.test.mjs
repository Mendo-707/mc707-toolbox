// Send song to MC-707 scenes (zen/zc-scenes.js): the song cut into sections, each written into a
// scene (each track's clip) with its LENGTH in bars, the last one OFF, then read back.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const TRK = (0x10 << 21) | (0x08 << 7),
  LEN = (0x10 << 21) + 0x4c;

test('Scenes: the song becomes chained scenes, one per change of patterns', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  const secs = await page.evaluate(() => {
    const A = window.__app,
      S = A.S;
    const pat = (id, type) => ({
      id,
      name: id,
      type,
      bars: 1,
      notes: [{ s: 0, l: 1, n: type === 'drum' ? 0 : 60, v: 100 }]
    });
    S.patterns = { p1: pat('p1', 'drum'), p2: pat('p2', 'tone'), p3: pat('p3', 'tone') };
    S.clips = [
      { id: 'c1', t: 0, start: 0, len: 10, off: 0, pat: 'p1' },
      { id: 'c2', t: 3, start: 0, len: 4, off: 0, pat: 'p2' },
      { id: 'c3', t: 3, start: 4, len: 4, off: 0, pat: 'p3' },
      { id: 'c4', t: 3, start: 8, len: 2, off: 0, pat: 'p2', tr: 5 },
      /* a muted clip plays nothing */
      { id: 'c5', t: 5, start: 0, len: 10, off: 0, pat: 'p3', mute: true }
    ];
    S.tracks[3].type = 'tone';
    A.renderAll();
    return A.seq.sections(A.seq.songPlan()).map(x => [x.a, x.bars, x.clips[0], x.clips[3], x.clips[5]]);
  });
  assert.deepEqual(secs, [
    [0, 4, 0, 0, -1],
    [4, 4, 0, 1, -1],
    [8, 2, 0, 2, -1]
  ]);
  await page.evaluate('window.__out.length = 0');
  /* not awaited: it ends on the summary dialog */
  await page.evaluate(() => {
    const A = window.__app;
    A.seq.sendSong(A.seq.songPlan(), { clips: false, scenes: { first: 2 } });
  });
  const dlg = page.locator('[role=dialog][aria-modal]', { hasText: 'Sent the song to MC-707 scenes' });
  await dlg.waitFor({ timeout: 20000 });
  assert.match(await dlg.textContent(), /Scenes 1-3 to 1-5 written, read back and checked/);
  const mem = await page.evaluate(
    ([TRK, LEN]) => {
      const m = window.__zcMem,
        run = (l, n) => Array.from({ length: n }, (_, i) => m.get(l + i) ?? null);
      return {
        t1: run(TRK + 0x3e, 6),
        t4: run(TRK + 3 * 0x100 + 0x3e, 6),
        t6: run(TRK + 5 * 0x100 + 0x3e + 2, 3),
        len: run(LEN, 6)
      };
    },
    [TRK, LEN]
  );
  assert.deepEqual(mem.t1.slice(2, 5), [1, 1, 1], 'track 1 plays clip 1 throughout');
  assert.deepEqual(mem.t4.slice(2, 5), [1, 2, 3], 'track 4: clip 1, clip 2, then the transposed copy');
  assert.deepEqual(mem.t6, [0, 0, 0], 'the muted track plays nothing');
  assert.deepEqual(mem.len.slice(2, 5), [4, 4, 0], 'lengths in bars, the last scene stays');
  assert.equal(mem.len[1] ?? null, null, 'scenes before the first are left alone');
  await dlg.locator('button', { hasText: 'OK' }).click();
  /* the dialog lists the scenes */
  await page.evaluate(() => window.__app.hooks && document.querySelector('#scOv')?.remove());
  await page.evaluate(() => window.__app.seq.song(true));
  const ov = page.locator('#scOv');
  await ov.waitFor();
  assert.match(await ov.textContent(), /Scene 1-1bars 1–4 · 4 bars/);
  assert.match(await ov.textContent(), /Scene 1-3bars 9–10, then stays/);
  assert.deepEqual(errors, []);
});
