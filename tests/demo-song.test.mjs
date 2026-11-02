// The demo song (library/demo-song.js): its clips spell MC 707 / 101 TOOLBOX across the arrangement, five
// tracks high between a beat above and an arp below, every clip a pattern for its track's job, and it plays.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Demo song: the clips spell MC 707 / 101 TOOLBOX, and it plays', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(() => document.querySelector('#fDemo').click());
  const r = await page.evaluate(() => {
    const a = window.__app,
      S = a.S;
    /* the lettering read back from the clips: one text row per track 2-6 */
    const w = Math.max(...S.clips.map(c => c.start + c.len));
    const rows = [1, 2, 3, 4, 5].map(t => {
      const row = Array(w).fill(' ');
      for (const c of S.clips) if (c.t === t) for (let x = c.start; x < c.start + c.len; x++) row[x] = '#';
      return row.join('').trimEnd();
    });
    const types = S.clips.every(c => (S.patterns[c.pat].type === 'drum') === (S.tracks[c.t].type === 'drum'));
    return {
      rows,
      types,
      beat: S.clips.some(c => c.t === 0 && c.len === w),
      bpm: S.bpm,
      loop: S.loop.end,
      bars: S.bars
    };
  });
  /* the first letters, M and C: a 5-wide M, a gap, a 3-wide C */
  assert.deepEqual(
    r.rows.map(x => x.slice(1, 10).trimEnd()),
    ['#   # ###', '## ## #', '# # # #', '#   # #', '#   # ###']
  );
  assert.ok(r.types, 'drum patterns on drum tracks, tone patterns on tone tracks');
  assert.ok(r.beat, 'a beat runs the whole way along the top');
  assert.ok(r.loop >= 70 && r.bars >= r.loop, 'the song is as long as the text');
  /* it plays */
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate('window.__out.length = 0');
  await page.click('#bPlay');
  await page.evaluate(() => {
    const a = window.__app;
    a.TICKER.stop();
    for (let i = 0; i < 32 * 6; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
  });
  assert.ok(await page.evaluate(() => window.__out.some(b => (b[0] & 0xf0) === 0x90 && b[2] > 0)));
  await page.click('#bPlay');
  assert.deepEqual(errors, []);
});
