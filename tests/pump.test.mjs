// The sidechain pump (core/pump.js, scene/pump.js, written by scene/write.js): the compressor-style shape,
// kicks from the scene's kit clips repeated under the clip, and the move written into the clip's motion
// (SOUND lane for Volume), cleared again when the pump goes. Idea and motion layout from Ada Locriana.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* a small song: a beat throughout, a bass that changes at bar 4 (transposed), a lead from bar 4 */
function seedSong() {
  const A = window.__app,
    S = A.S;
  const pat = (id, type, bars = 1) => ({
    id,
    name: id,
    type,
    bars,
    notes: [{ s: 0, l: 1, n: type === 'drum' ? 0 : 48, v: 100 }]
  });
  S.bpm = 120;
  S.patterns = { p1: pat('p1', 'drum'), p2: pat('p2', 'tone', 2), p3: pat('p3', 'tone'), p4: pat('p4', 'tone') };
  S.clips = [
    { id: 'c1', t: 0, start: 0, len: 8, off: 0, pat: 'p1' },
    { id: 'c2', t: 3, start: 0, len: 4, off: 0, pat: 'p2' },
    { id: 'c3', t: 3, start: 4, len: 4, off: 0, pat: 'p3', tr: 7 },
    { id: 'c4', t: 6, start: 4, len: 4, off: 0, pat: 'p4' }
  ];
  S.markers = [
    { bar: 0, name: 'Intro' },
    { bar: 4, name: 'Drop' }
  ];
  delete S.scn;
  A.renderAll();
}
/* make the scenes from the song, in Scene Mode */
const fromSong = page =>
  page.evaluate(() => {
    const A = window.__app,
      made = A.scene.fromSong();
    A.scene.setMode('scene');
    A.scene.edit(q => ((q.rows = made.rows), (q.clips = made.clips)));
  });
/* empty clips on the fake MC-707, as a new project has */
const emptyClips = (page, list) =>
  page.evaluate(list => {
    const Q = window.__app.seq,
      mem = window.__zcMem,
      put = (l, b) => b.forEach((x, i) => mem.set(l + i, x));
    for (const [t, k] of list) {
      put(Q.paramAddr(t, k), [1, 1, 0]);
      put(Q.clipAddr(t, k), Array(16).fill(32));
      for (let s = 0; s < 16; s++) {
        const a = Q.stepAddr(t, k, s);
        put(a + 0x10, Array(32).fill(15));
        put(a + 0x30, Array(16).fill(0x50));
        put(a + 0x40, Array(32).fill(0));
        put(a + 0x60, Array(16).fill(0x50));
        put(a + 0x70, Array(16).fill(0));
      }
    }
  }, list);

test('Pump: the shape dips on the kick, eases back, wraps at the loop, and leaves ghost kicks alone', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const P = window.__app.pump;
    const pump = { mode: 'level', depth: 'medium', rel: '1/8', rest: 100 };
    const kicks = P.kicksUnder(
      [
        {
          hits: P.kickHits({
            type: 'drum',
            notes: [
              { s: 0, n: 0, v: 100 },
              { s: 8, n: 0, v: 30 },
              { s: 4, n: 2, v: 100 }
            ]
          }),
          period: 16
        }
      ],
      32
    );
    const v = P.pumpValues(pump, kicks, 32, 1);
    const v8 = P.pumpValues(pump, kicks, 16, 2);
    return {
      kicks,
      at0: v[0],
      at2_5: v[20],
      at8: v[64],
      last: v[255],
      len: v.length,
      v8_0: v8[0],
      v8len: v8.length,
      light: P.pumpValues({ ...pump, depth: 'light' }, kicks, 32, 1)[0]
    };
  });
  assert.deepEqual(
    r.kicks,
    [
      { s: 0, v: 100 },
      { s: 16, v: 100 }
    ],
    'the kick repeats under the longer clip; the ghost kick and the snare are not kicks'
  );
  assert.equal(r.len, 256);
  assert.equal(r.at0, 40, 'down to 60% under the rest on the kick');
  assert.ok(r.at2_5 >= 95 && r.at2_5 < 100, 'nearly back after an 8th: ' + r.at2_5);
  assert.equal(r.at8, 100, 'at rest between kicks');
  assert.equal(r.last, 70, 'half down one point before the loop comes round to the kick');
  assert.deepEqual([r.v8_0, r.v8len], [40, 128], 'the same in 1/8 steps');
  assert.equal(r.light, 65);
  assert.deepEqual(errors, []);
});

test('Pump: a clip with a pump writes it into its motion with the clip, and clears it when the pump goes', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate(seedSong);
  await fromSong(page);
  await emptyClips(page, [[3, 0]]);
  await page.evaluate(() =>
    window.__app.scene.setPump(3, 0, { mode: 'level', depth: 'medium', rel: '1/8', rest: 100 })
  );
  /* the window shows where the kicks come from */
  await page.click('.sbClip[data-t="3"][data-k="0"]', { button: 'right' });
  await page.getByText('Pump (sidechain)…').first().click();
  assert.match(await page.textContent('#pmOv'), /Follows the kicks in track 1 clip 1/);
  assert.equal(await page.locator('#pmOv .pmKick').count(), 2, 'a kick in each of the 2 bars');
  await page.click('#pmOv button:has-text("Done")');
  const lane = (s, l) =>
    page.evaluate(
      ([s, l]) => {
        const M = window.__app.motion,
          mem = window.__zcMem;
        return M.decodeMotion(Array.from({ length: 16 }, (_, i) => mem.get(M.motionAddr(3, 0, s, l) + i)));
      },
      [s, l]
    );
  await page.evaluate(() => window.__app.scene.writeOneClip(3, 0));
  await page.waitForFunction(() => /Wrote 1 clip/.test(document.getElementById('toast').textContent), null, {
    timeout: 60000
  });
  assert.deepEqual(
    await lane(0, 3),
    [40, -1, -1, -1, -1, 50, 59, 66],
    'the SOUND lane is down for a 32nd on the kick, then eases back'
  );
  assert.equal((await lane(16, 3))[0], 40, 'and again on the kick in bar 2');
  assert.equal(await page.evaluate(() => window.__app.S.scn.done.p['3:0']), 'level');
  assert.match(await page.locator('.sbClip[data-t="3"][data-k="0"]').getAttribute('class'), /written/);
  /* the kicks change: the pumping clip needs writing again */
  await page.evaluate(() => {
    const A = window.__app;
    A.scene.edit(() => A.S.patterns.p1.notes.push({ s: 8, l: 1, n: 0, v: 100 }));
  });
  assert.match(await page.locator('.sbClip[data-t="3"][data-k="0"]').getAttribute('class'), /changed/);
  /* the pump goes: its lane is cleared */
  await page.evaluate(() => window.__app.scene.setPump(3, 0, null));
  await page.evaluate(() => (document.getElementById('toast').textContent = ''));
  await page.evaluate(() => window.__app.scene.writeOneClip(3, 0));
  await page.waitForFunction(() => /Wrote 1 clip/.test(document.getElementById('toast').textContent), null, {
    timeout: 60000
  });
  assert.deepEqual(await lane(0, 3), Array(8).fill(-1));
  assert.equal(await page.evaluate(() => window.__app.S.scn.done.p['3:0']), undefined);
  assert.deepEqual(errors, []);
});
