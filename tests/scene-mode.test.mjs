// Scene Mode (src/scene/): scenes made from the song, kept with the song, laid back out as a song, and
// sent to the MC-707 (clips with their tones, then the scenes and their chain lengths).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const TRK = (0x10 << 21) | (0x08 << 7),
  LEN = (0x10 << 21) + 0x4c;

/* a small song: a beat throughout, a bass that changes at bar 4, a lead from bar 4 */
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
  A.renderAll();
}

test('Scene Mode: scenes from the song, kept with it, and laid back out as a song', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(seedSong);
  const rows = await page.evaluate(() => {
    const A = window.__app;
    A.scene.setMode('scene');
    A.scene.edit(q => (q.rows = A.scene.fromSong()));
    return A.S.scn.rows.map(r => [r.name, r.bars, r.cells.map(c => (c ? c.pat + (c.tr ? c.tr : '') : '-')).join(' ')]);
  });
  assert.deepEqual(rows, [
    ['Intro', 4, 'p1 - - p2 - - - -'],
    ['Drop', 4, 'p1 - - p37 - - p4 -']
  ]);
  /* the grid shows them, with the MC-707 scene numbers */
  assert.equal(await page.locator('#scene .scnRow').count(), 2);
  assert.match(await page.locator('#scene .scnRow').nth(1).textContent(), /1-2/);
  /* saved and loaded with the song; a cell whose pattern is gone, or on the wrong kind of track, is dropped */
  const fixed = await page.evaluate(() => {
    const A = window.__app,
      s = JSON.parse(JSON.stringify(A.S));
    s.scn.rows[0].cells[1] = { pat: 'p2' };
    s.scn.rows[0].cells[2] = { pat: 'nope' };
    s.scn.rows[1].bars = 500;
    const f = A.fixState(s);
    return [f.scn.rows[0].cells[1], f.scn.rows[0].cells[2], f.scn.rows[1].bars, f.scn.rows[1].cells[3]];
  });
  assert.deepEqual(fixed, [null, null, 127, { pat: 'p3', tr: 7 }]);
  /* back to a song: one clip per run of the same cell, a marker per scene */
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

test('Scene Mode: send writes the clips, their tones, the scenes and the chain lengths', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate(seedSong);
  await page.evaluate(() => {
    const A = window.__app;
    A.scene.setMode('scene');
    A.scene.edit(q => (q.rows = A.scene.fromSong()));
    A.scene.setFirst(16);
    /* the lead gets a tone */
    A.scene.setTone(1, 6, { name: 'Scene Lead', kind: 'tone', d: { 'CMN.NAME': 'Scene Lead' } });
  });
  const plan = await page.evaluate(() => window.__app.scene.plan().items.map(x => [x.t, x.k, x.cell.pat]));
  assert.deepEqual(plan, [
    [0, 0, 'p1'],
    [3, 0, 'p2'],
    [3, 1, 'p3'],
    [6, 0, 'p4']
  ]);
  /* empty clips on the fake MC-707, as a new project has */
  await page.evaluate(() => {
    const Q = window.__app.seq,
      mem = window.__zcMem,
      put = (l, b) => b.forEach((x, i) => mem.set(l + i, x));
    for (const [t, k] of [
      [0, 0],
      [3, 0],
      [3, 1],
      [6, 0]
    ]) {
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
  });
  await page.evaluate('window.__out.length = 0');
  /* not awaited: it ends on the summary dialog */
  await page.evaluate(() => {
    window.__app.scene.send({ replace: true, tones: true, name: true });
  });
  const dlg = page.locator('[role=dialog][aria-modal]', { hasText: 'Sent the scenes to the MC-707' });
  await dlg.waitFor({ timeout: 60000 });
  const text = await dlg.textContent();
  assert.match(text, /Scenes 2-1 to 2-2 written, read back and checked/);
  assert.match(text, /track 7 clip 1: p4 ♪ Scene Lead/);
  assert.match(text, /track 4 clip 2: p3 \+7/);
  const mem = await page.evaluate(
    ([TRK, LEN]) => {
      const m = window.__zcMem,
        run = (l, n) => Array.from({ length: n }, (_, i) => m.get(l + i) ?? null);
      return {
        t1: run(TRK + 0x3e + 16, 2),
        t4: run(TRK + 3 * 0x100 + 0x3e + 16, 2),
        t7: run(TRK + 6 * 0x100 + 0x3e + 16, 2),
        len: run(LEN + 16, 2),
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
  assert.equal(mem.src7, 1, 'the track with a tone plays its clips’ sounds');
  assert.equal(mem.src4, null, 'a track without tones is left alone');
  /* the tone went into track 7 clip 1's tone slot (30 00 00 00 + (6 × 17) × 00 02 00 00) */
  const toneAt = (0x30 << 21) + 6 * 17 * (2 << 14);
  const name = await page.evaluate(
    at => String.fromCharCode(...Array.from({ length: 10 }, (_, i) => window.__zcMem.get(at + i) || 32)),
    toneAt
  );
  assert.equal(name, 'Scene Lead');
  assert.deepEqual(errors, []);
});

test('Scene Mode: the screen adds a scene and fills a cell from the pattern picker', async () => {
  const { page, errors } = await openApp();
  await page.locator('.mtab', { hasText: 'Scene Mode' }).click();
  await page.locator('#scene .scnEmpty button', { hasText: 'Add the first scene' }).click();
  await page.locator('#scene .scnCell.empty').nth(3).click();
  const pick = page.locator('#spOv');
  await pick.waitFor();
  assert.match(await pick.textContent(), /Pattern for track 4/);
  const first = await pick.locator('.spRow b').first().textContent();
  await pick.locator('.spRow').first().click();
  await page.waitForFunction(() => !document.querySelector('#spOv'));
  assert.equal(await page.locator('#scene .scnCell').nth(3).locator('b').textContent(), first);
  /* Space plays the scenes, and again stops */
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__app.TR.playing && window.__app.TR.mode === 'scenes');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__app.TR.playing);
  assert.deepEqual(errors, []);
});

test('Scene Mode: a cell opens Song Mode’s pattern editor docked under the scenes, and expands', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(seedSong);
  await page.locator('.mtab', { hasText: 'Scene Mode' }).click();
  await page.locator('#scene button', { hasText: 'Make scenes from the song' }).click();
  /* track 4 in the second scene: p3, transposed +7 */
  await page.locator('#scene .scnCell[data-row="1"][data-t="3"]').click();
  const dock = page.locator('#scene .scnDock');
  await dock.waitFor();
  assert.equal(await page.evaluate(() => document.getElementById('editor').closest('.scnDock') !== null), true);
  assert.match(await dock.locator('.scnDockHead').textContent(), /Scene 1-2 · 4 Bass/);
  assert.equal(await page.locator('#edName').inputValue(), 'p3');
  /* the shared pattern gets its own copy for this cell */
  assert.match(await dock.locator('.scnDockHead').textContent(), /Shared with 1 Song Mode clip/);
  await dock.locator('button', { hasText: 'Make it this cell’s own' }).click();
  const own = await page.evaluate(() => window.__app.S.scn.rows[1].cells[3]);
  assert.notEqual(own.pat, 'p3');
  assert.equal(own.tr, 7);
  assert.doesNotMatch(await dock.locator('.scnDockHead').textContent(), /Shared with/);
  /* transpose from the head */
  await dock.locator('.scnTr button', { hasText: '+' }).click();
  assert.equal(await page.evaluate(() => window.__app.S.scn.rows[1].cells[3].tr), 8);
  /* expand: the track's column and the editor; another scene from the column */
  await dock.locator('button', { hasText: 'Expand' }).click();
  await page.locator('#scene .scnCol').waitFor();
  assert.equal(await page.locator('#scene .scnGrid').count(), 0);
  await page.locator('#scene .scnColCell').first().click();
  assert.match(await page.locator('.scnDockHead').textContent(), /Scene 1-1 · 4 Bass/);
  assert.equal(await page.locator('#edName').inputValue(), 'p2');
  /* close: the grid comes back and the editor goes home to Song Mode */
  await page.locator('.scnDockHead button', { hasText: 'Close' }).click();
  await page.locator('#scene .scnGrid').waitFor();
  assert.equal(await page.evaluate(() => document.getElementById('editor').parentNode.id), 'work');
  assert.deepEqual(errors, []);
});

test('Scene Mode: the Sound tab docks the ZenCore editor for the cell’s clip and keeps its changes in the cell', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(seedSong);
  await page.locator('.mtab', { hasText: 'Scene Mode' }).click();
  await page.locator('#scene button', { hasText: 'Make scenes from the song' }).click();
  /* track 4 in scene 1-2 is its second clip (p3 +7) */
  await page.locator('#scene .scnCell[data-row="1"][data-t="3"]').click();
  await page.locator('.scnTabs button', { hasText: 'Sound' }).click();
  await page.locator('#scene .scnDock #zcOv').waitFor();
  assert.match(await page.locator('.scnDockHead').textContent(), /track 4 clip 2 on the MC-707/);
  assert.deepEqual(await page.evaluate(() => [window.__app.zen.ZE.t, window.__app.zen.ZE.k]), [3, 1]);
  /* an edit in the editor (as a control makes one), then back to the notes: the cell keeps the sound */
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
      c = q.rows[1].cells[3];
    return [q.tones[c.tone].name, q.tones[c.tone].kind];
  });
  assert.deepEqual(tone, ['My Bass', 'tone']);
  assert.match(await page.locator('#scene .scnCell[data-row="1"][data-t="3"]').textContent(), /♪ My Bass/);
  /* Done inside the editor goes back to the notes too */
  await page.locator('.scnTabs button', { hasText: 'Sound' }).click();
  await page.locator('#scene .scnDock #zcOv').waitFor();
  await page.locator('#zcOv button', { hasText: 'Done' }).click();
  await page.locator('.scnDock #editor').waitFor();
  assert.deepEqual(errors, []);
});

test('Scene Mode: ▦ Clips shows the clips each track uses, starts a track later, and checks them on the MC-707', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.evaluate(seedSong);
  await page.locator('.mtab', { hasText: 'Scene Mode' }).click();
  await page.locator('#scene button', { hasText: 'Make scenes from the song' }).click();
  const lit = t =>
    page.evaluate(
      t => [...document.querySelectorAll('#scene .scnTrk')[t].querySelectorAll('.scnPad.use')].map(p => +p.textContent),
      t
    );
  assert.deepEqual(await lit(3), [1, 2]);
  /* track 4 from clip 5: its cells move to clips 5 and 6 */
  await page.locator('#scene .scnTrk').nth(3).locator('select').selectOption('4');
  assert.deepEqual(await lit(3), [5, 6]);
  assert.deepEqual(
    await page.evaluate(() =>
      window.__app.scene
        .plan()
        .items.filter(x => x.t === 3)
        .map(x => x.k)
    ),
    [4, 5]
  );
  /* the check: clip 5 holds a note on the fake MC-707, clip 6 is empty */
  await page.evaluate(() => {
    const Q = window.__app.seq,
      mem = window.__zcMem,
      put = (l, b) => b.forEach((x, i) => mem.set(l + i, x));
    for (const k of [4, 5]) {
      put(Q.paramAddr(3, k), [1, 1, 0]);
      put(Q.clipAddr(3, k), Array(16).fill(32));
      for (let s = 0; s < 16; s++) put(Q.stepAddr(3, k, s) + 0x10, Array(32).fill(15));
    }
    put(Q.stepAddr(3, 4, 2) + 0x10, [3, 0]);
  });
  await page.evaluate(() => {
    const A = window.__app;
    for (const t of [0, 6])
      for (const k of [0, 1]) {
        const mem = window.__zcMem,
          put = (l, b) => b.forEach((x, i) => mem.set(l + i, x));
        put(A.seq.paramAddr(t, k), [1, 1, 0]);
        put(A.seq.clipAddr(t, k), Array(16).fill(32));
        for (let s = 0; s < 16; s++) put(A.seq.stepAddr(t, k, s) + 0x10, Array(32).fill(15));
      }
  });
  await page.locator('#scene .scnClipSum button', { hasText: 'Check the MC-707' }).click();
  await page.locator('#scene .scnClipSum', { hasText: 'hold notes' }).first().waitFor({ timeout: 30000 });
  const busy = await page.evaluate(() =>
    [...document.querySelectorAll('#scene .scnTrk')[3].querySelectorAll('.scnPad.busy')].map(p => +p.textContent)
  );
  assert.deepEqual(busy, [5]);
  /* ▦ Clips hides them */
  await page.locator('#scene .scnTop button', { hasText: 'Clips' }).click();
  assert.equal(await page.locator('#scene .scnPads').count(), 0);
  assert.deepEqual(errors, []);
});
