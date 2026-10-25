// Scene Mode (src/scene/): the clips board and the scene chain made from the song, kept with it (and
// the first Scene Mode's songs turned into this shape), laid back out as a song, written to the MC-707 a
// clip, a scene, what changed or everything at a time, and the screen's editor, menus and guide.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const TRK = (0x10 << 21) | (0x08 << 7),
  LEN = (0x10 << 21) + 0x4c;

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
const states = page =>
  page.evaluate(() =>
    [...document.querySelectorAll('#scene .sbClip:not(.empty)')].map(
      b => b.dataset.t + ':' + b.dataset.k + ' ' + b.className.match(/\b(new|written|changed)\b/)[1]
    )
  );

test('Scene Mode: clips and scenes from the song, kept with it (older songs converted), and back to a song', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(seedSong);
  await fromSong(page);
  const q = await page.evaluate(() => {
    const q = window.__app.S.scn;
    return {
      clips: q.clips.map(l => l.filter(Boolean).map(c => c.pat + (c.tr ? c.tr : ''))),
      rows: q.rows.map(r => [r.name, r.bars, r.pick.join(' ')])
    };
  });
  assert.deepEqual(q.clips, [['p1'], [], [], ['p2', 'p37'], [], [], ['p4'], []]);
  assert.deepEqual(q.rows, [
    ['Intro', 4, '0 -1 -1 0 -1 -1 -1 -1'],
    ['Drop', 4, '0 -1 -1 1 -1 -1 0 -1']
  ]);
  /* the board and the chain show them */
  assert.equal(await page.locator('#scene .sbClip:not(.empty)').count(), 4);
  assert.equal(await page.locator('#scene .scRowC').count(), 2);
  assert.match(await page.locator('#scene .scRowC').nth(1).textContent(), /1-2/);
  /* a song saved by the first Scene Mode (a pattern per cell) loads as clips and picks */
  const old = await page.evaluate(() => {
    const A = window.__app,
      s = JSON.parse(JSON.stringify(A.S));
    s.scn = {
      first: 2,
      start: [0, 0, 0, 4, 0, 0, 0, 0],
      rows: [
        { id: 'a', name: 'A', bars: 4, cells: [{ pat: 'p1' }, null, null, { pat: 'p2' }, null, null, null, null] },
        {
          id: 'b',
          name: 'B',
          bars: 500,
          cells: [{ pat: 'p1' }, { pat: 'p2' }, { pat: 'nope' }, { pat: 'p3', tr: 7 }, null, null, null, null]
        }
      ],
      tones: {}
    };
    const f = A.fixState(s).scn;
    return [f.v, f.first, f.clips[3][4], f.clips[3][5], f.rows.map(r => r.pick.join(' ')), f.rows[1].bars];
  });
  assert.deepEqual(old, [
    2,
    2,
    { pat: 'p2' },
    { pat: 'p3', tr: 7 },
    ['0 -1 -1 4 -1 -1 -1 -1', '0 -1 -1 5 -1 -1 -1 -1'],
    127
  ]);
  /* back to a song: one clip per run of the same clip, a marker per scene */
  await page.evaluate(() => {
    const A = window.__app;
    A.scene.edit(q => (q.rows[1].bars = 6));
    A.S.clips = [];
    return A.scene.toSong();
  });
  const song = await page.evaluate(() =>
    window.__app.S.clips.map(c => [c.t, c.start, c.len, c.pat, c.tr || 0]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  );
  assert.deepEqual(song, [
    [0, 0, 10, 'p1', 0],
    [3, 0, 4, 'p2', 0],
    [3, 4, 6, 'p3', 7],
    [6, 4, 6, 'p4', 0]
  ]);
  assert.deepEqual(errors, []);
});

test('Scene Mode: write everything, then only what changed; marks show written, changed and new', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate(seedSong);
  await fromSong(page);
  await page.evaluate(() => {
    const A = window.__app;
    A.scene.setFirst(16);
    A.scene.setTone(6, 0, { name: 'Scene Lead', kind: 'tone', d: { 'CMN.NAME': 'Scene Lead' } });
  });
  await emptyClips(page, [
    [0, 0],
    [3, 0],
    [3, 1],
    [6, 0]
  ]);
  assert.deepEqual(await states(page), ['0:0 new', '3:0 new', '3:1 new', '6:0 new']);
  assert.match(await page.locator('.scnTop').textContent(), /Write 6 changes/);
  await page.evaluate(() => window.__app.scene.writeAll());
  await page.waitForFunction(
    () => /Wrote 4 clips and 2 scenes/.test(document.getElementById('toast').textContent),
    null,
    { timeout: 90000 }
  );
  assert.deepEqual(await states(page), ['0:0 written', '3:0 written', '3:1 written', '6:0 written']);
  assert.match(await page.locator('.scnTop').textContent(), /All written/);
  const mem = await page.evaluate(
    ([TRK, LEN]) => {
      const m = window.__zcMem,
        run = (l, n) => Array.from({ length: n }, (_, i) => m.get(l + i) ?? null);
      return {
        t1: run(TRK + 0x3e + 16, 2),
        t4: run(TRK + 3 * 0x100 + 0x3e + 16, 2),
        t7: run(TRK + 6 * 0x100 + 0x3e + 16, 2),
        len: run(LEN + 16, 2),
        tempo: run((0x10 << 21) + 0x10, 4),
        src7: m.get(TRK + 6 * 0x100 + 4),
        src4: m.get(TRK + 3 * 0x100 + 4) ?? null
      };
    },
    [TRK, LEN]
  );
  assert.deepEqual(mem.t1, [1, 1]);
  assert.deepEqual(mem.t4, [1, 2]);
  assert.deepEqual(mem.t7, [0, 1], 'no lead in the first scene');
  assert.deepEqual(mem.len, [4, 0], 'four bars, then the last scene stays');
  assert.deepEqual(mem.tempo, [2, 14, 14, 0], '120 BPM as 12000 in half-bytes');
  assert.equal(mem.src7, 1, 'the track with a tone plays its clips’ sounds');
  assert.equal(mem.src4, null, 'a track without tones is left alone');
  const toneAt = (0x30 << 21) + 6 * 17 * (2 << 14);
  const name = await page.evaluate(
    at => String.fromCharCode(...Array.from({ length: 10 }, (_, i) => window.__zcMem.get(at + i) || 32)),
    toneAt
  );
  assert.equal(name, 'Scene Lead');
  /* a change: that clip and nothing else is waiting; Write changed writes it alone */
  await page.evaluate(() => window.__app.scene.setTranspose(3, 1, 5));
  assert.deepEqual(await states(page), ['0:0 written', '3:0 written', '3:1 changed', '6:0 written']);
  assert.deepEqual(await page.evaluate(() => window.__app.scene.pending()), { clips: [[3, 1]], scenes: [] });
  await page.evaluate(() => window.__app.scene.writeChanged());
  await page.waitForFunction(
    () => /Wrote 1 clip to the MC-707/.test(document.getElementById('toast').textContent),
    null,
    { timeout: 60000 }
  );
  assert.deepEqual(await states(page), ['0:0 written', '3:0 written', '3:1 written', '6:0 written']);
  /* a scene's length changes: that scene only */
  await page.evaluate(() => window.__app.scene.setBars(0, 8));
  assert.deepEqual(await page.evaluate(() => window.__app.scene.pending()), { clips: [], scenes: [0] });
  assert.match(await page.locator('#scene .scRowC').nth(0).locator('.scMark').textContent(), /●/);
  assert.deepEqual(errors, []);
});

test('Scene Mode: the screen fills a clip from the picker, opens it in the editor, and expands', async () => {
  const { page, errors } = await openApp();
  await page.locator('.mtab', { hasText: 'Scene Mode' }).click();
  await page.locator('#scene .scnEmpty button', { hasText: 'Start with an empty scene' }).click();
  await page.locator('#scene .sbClip[data-t="3"][data-k="0"]').click();
  const pick = page.locator('#spOv');
  await pick.waitFor();
  assert.match(await pick.textContent(), /Pattern for track 4/);
  const first = await pick.locator('.spRow b').first().textContent();
  await pick.locator('.spRow').first().click();
  /* the new clip goes into the selected scene, which played nothing there, and opens in the editor */
  await page.locator('#scene .scnDock #editor').waitFor();
  assert.equal(await page.locator('#edName').inputValue(), first);
  assert.equal(await page.evaluate(() => window.__app.S.scn.rows[0].pick[3]), 0);
  assert.equal(await page.locator('#scene .scRowC .scChip').nth(3).textContent(), '1');
  await page.locator('.scnDockHead button', { hasText: 'Expand' }).click();
  assert.equal(await page.locator('#scene .sbRow:not(.sbHead)').count(), 1, 'the board keeps only this track');
  await page.locator('.scnDockHead button', { hasText: 'Close' }).click();
  assert.equal(await page.evaluate(() => document.getElementById('editor').parentNode.id), 'work');
  /* Space plays the chain, and again stops */
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__app.TR.playing && window.__app.TR.mode === 'scenes');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__app.TR.playing);
  assert.deepEqual(errors, []);
});

test('Scene Mode: the Sound tab docks the ZenCore editor for the clip and keeps its changes as its tone', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(seedSong);
  await fromSong(page);
  await page.locator('#scene .sbClip[data-t="3"][data-k="1"]').click();
  await page.locator('.scnTabs button', { hasText: 'Sound' }).click();
  await page.locator('#scene .scnDock #zcOv').waitFor();
  assert.match(await page.locator('.scnDockHead').textContent(), /track 4 clip 2 on the MC-707/);
  assert.deepEqual(await page.evaluate(() => [window.__app.zen.ZE.t, window.__app.zen.ZE.k]), [3, 1]);
  await page.evaluate(() => {
    const ZE = window.__app.zen.ZE;
    ZE.undo.push({});
    ZE.snd.v['CMN.NAME'] = 'My Bass';
  });
  await page.locator('.scnTabs button', { hasText: 'Notes' }).click();
  await page.locator('.scnDock #editor').waitFor();
  assert.equal(await page.evaluate(() => !!document.querySelector('#zcOv')), false);
  const tone = await page.evaluate(() => {
    const q = window.__app.S.scn,
      c = q.clips[3][1];
    return [q.tones[c.tone].name, q.tones[c.tone].kind];
  });
  assert.deepEqual(tone, ['My Bass', 'tone']);
  assert.match(await page.locator('#scene .sbClip[data-t="3"][data-k="1"]').textContent(), /♪ My Bass/);
  await page.locator('.scnTabs button', { hasText: 'Sound' }).click();
  await page.locator('#scene .scnDock #zcOv').waitFor();
  await page.locator('#zcOv button', { hasText: 'Done' }).click();
  await page.locator('.scnDock #editor').waitFor();
  assert.deepEqual(errors, []);
});

test('Scene Mode: chips choose a scene’s clips; clip, scene and track menus; the steps and the guide', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(seedSong);
  await fromSong(page);
  /* scene 1-1's bass chip: clip 2 instead */
  await page.locator('#scene .scRowC').nth(0).locator('.scChip').nth(3).click();
  await page.locator('.cmenu .cmi', { hasText: 'Clip 2: p3' }).click();
  assert.equal(await page.evaluate(() => window.__app.S.scn.rows[0].pick[3]), 1);
  /* a clip's menu: swap it with clip 5, and the scenes follow */
  await page.locator('#scene .sbClip[data-t="3"][data-k="1"]').click({ button: 'right' });
  await page.locator('.cmenu .cmi.sub', { hasText: 'Move or swap with' }).click();
  await page.locator('.cmenu .subm .cmi', { hasText: 'clip 5' }).first().click();
  assert.deepEqual(
    await page.evaluate(() => [
      window.__app.S.scn.clips[3][4].pat,
      window.__app.S.scn.rows[0].pick[3],
      window.__app.S.scn.rows[1].pick[3]
    ]),
    ['p3', 4, 4]
  );
  /* a scene's menu: add one before it */
  await page
    .locator('#scene .scRowC')
    .nth(1)
    .click({ button: 'right', position: { x: 4, y: 4 } });
  await page.locator('.cmenu .cmi', { hasText: 'Add a scene before it' }).click();
  assert.equal(await page.locator('#scene .scRowC').count(), 3);
  /* a track's menu */
  await page.locator('#scene .sbTrk').nth(1).click({ button: 'right' });
  assert.match(await page.locator('.cmenu').textContent(), /Check its 16 clips/);
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  /* the steps: clips and scenes done, writing waiting, not connected */
  const top = await page.locator('.scnTop').textContent();
  assert.match(top, /Clips4 filled/);
  assert.match(top, /Write\d+ waiting/);
  assert.match(top, /Not connected/);
  await page.locator('.stStep', { hasText: 'On the MC-707' }).click();
  const guide = page.locator('#sgOv');
  await guide.waitFor();
  assert.match(await guide.textContent(), /C1 CHAIN to ON/);
  assert.match(await guide.textContent(), /Call Scene to TYPE2/);
  await guide.locator('button', { hasText: 'Got it' }).click();
  assert.deepEqual(errors, []);
});

test('Scene Mode: Auto-write writes a change a moment after it is made', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate(seedSong);
  await fromSong(page);
  await emptyClips(page, [
    [0, 0],
    [3, 0],
    [3, 1],
    [6, 0]
  ]);
  await page.evaluate(() => window.__app.scene.writeAll());
  await page.waitForFunction(() => /Wrote 4 clips/.test(document.getElementById('toast').textContent), null, {
    timeout: 90000
  });
  await page.locator('.scWrite button').last().click();
  await page.locator('.cmenu .cmi', { hasText: 'Auto-write changes' }).click();
  assert.match(await page.locator('.scnTop').textContent(), /Auto/);
  await page.evaluate(() => window.__app.scene.setBars(0, 2));
  await page.waitForFunction(() => window.__app.scene.pending().scenes.length === 0, null, { timeout: 20000 });
  assert.equal(await page.evaluate(n => window.__zcMem.get(n), LEN), 2);
  /* off again, for the other tests */
  await page.locator('.scWrite button').last().click();
  await page.locator('.cmenu .cmi', { hasText: 'Auto-write changes' }).click();
  assert.deepEqual(errors, []);
});
