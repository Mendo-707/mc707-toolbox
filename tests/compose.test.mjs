// The composer (Song › Compose a song): every style writes a song that fits the MC-707 (Scene Mode's
// 16 clips a track, valid notes), the window puts it in the song and Scene Mode, and the song saves as
// an MC-707 project with every note in.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Compose: every style writes a whole song that fits the MC-707', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { compose } = window.__app.compose,
      styles = window.__app.STYLES.filter(s => s.fam !== 'all'),
      out = [];
    for (const st of styles) {
      const s = compose(st, { minutes: 4, seed: 7 }),
        per = {},
        bad = [];
      for (const [k, p] of Object.entries(s.patterns)) {
        per[p.role] = (per[p.role] || 0) + 1;
        for (const n of p.notes)
          if (
            n.s < 0 ||
            n.s >= p.bars * 16 ||
            n.l < 1 ||
            n.v < 1 ||
            n.v > 127 ||
            (p.type === 'drum' ? n.n > 11 : n.n < 12 || n.n > 108)
          )
            bad.push(k);
      }
      const bars = s.sections.reduce((a, x) => a + x.bars, 0),
        roles = new Set(s.sections.flatMap(x => Object.keys(x.parts)));
      out.push({
        id: st.id,
        bars,
        minutes: (bars * 4) / s.bpm,
        most: Math.max(...Object.values(per)),
        bad: bad.length,
        drums: roles.has('kit'),
        tones: ['bass', 'chords', 'lead'].filter(x => roles.has(x)).length,
        again: JSON.stringify(compose(st, { minutes: 4, seed: 7 }).patterns) === JSON.stringify(s.patterns),
        other: JSON.stringify(compose(st, { minutes: 4, seed: 8 }).patterns) !== JSON.stringify(s.patterns)
      });
    }
    return out;
  });
  assert.ok(r.length >= 40, 'every style: ' + r.length);
  for (const x of r) {
    assert.equal(x.bad, 0, x.id + ': notes in range');
    assert.ok(x.most <= 16, x.id + ': at most 16 patterns a part');
    assert.ok(x.minutes > 2.5 && x.minutes < 6, x.id + ': about the length asked for (' + x.minutes.toFixed(1) + ')');
    assert.ok(x.drums || /ambient/.test(x.id), x.id + ': has drums');
    assert.ok(x.tones >= 2, x.id + ': bass, chords and a lead');
    assert.ok(x.again, x.id + ': the same take comes out the same');
  }
  assert.ok(r.filter(x => x.other).length > r.length / 2, 'another take is a different song');
  assert.deepEqual(errors, []);
});

test('Compose a song: the window writes the song and its scenes, and it saves as an MC-707 project', async () => {
  const { page, errors } = await openApp();
  const before = await page.evaluate(() => JSON.stringify(window.__app.S.clips));
  await page.locator('#menubar .mb', { hasText: 'Song' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Compose a song' }).click();
  const dlg = page.locator('[role=dialog]', { hasText: 'Compose a song' });
  await dlg.locator('select').first().selectOption('neuro');
  await dlg.locator('select').nth(2).selectOption('3');
  await dlg.locator('button', { hasText: 'Compose' }).last().click();
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const A = window.__app,
      S = A.S,
      marks = S.markers.map(m => m.name),
      { bytes, song } = await A.mpj.bytes('Composed');
    return {
      bpm: S.bpm,
      clips: S.clips.length,
      pats: Object.keys(S.patterns).length,
      marks,
      rows: S.scn ? S.scn.rows.length : 0,
      lost: song.lost,
      scenes: song.scenes.length,
      size: bytes.length,
      end: Math.max(...S.clips.map(c => c.start + c.len))
    };
  });
  assert.equal(r.bpm, 174);
  assert.ok(r.clips > 30 && r.pats > 15, 'a whole song: ' + r.clips + ' clips');
  assert.ok(r.marks.includes('Drop') && r.marks.includes('Build') && r.marks.includes('Intro'), 'sections marked');
  assert.equal(r.rows, r.marks.length, 'a scene for each section');
  assert.deepEqual(r.lost, [], 'every note goes in the project file');
  assert.equal(r.scenes, r.rows);
  assert.ok(r.end >= 120, 'about three minutes: ' + r.end + ' bars');
  /* one undo step brings the song back */
  await page.locator('#bUndo').click();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__app.S.clips)), before);
  assert.deepEqual(errors, []);
});
