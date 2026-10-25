// Fill tones (ui/fill-tones.js): every clip on the Your MC-707 clips screen gets a sound for its job from
// the genre's pool, different ones across a track's clips; they go into the MC-707 clips with the tracks
// set to play their clips' own sounds; the pools are editable and can go back to the suggestions.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const TRK = (0x10 << 21) | (0x08 << 7);

/* some of the factory tones the House suggestions name, as if added from the update file */
const seed = page =>
  page.evaluate(() => {
    const A = window.__app,
      ZS = A.zen.ZS;
    ZS.ready = true;
    for (const x of [
      'D-681 House Bs',
      'B-113 Round Bass',
      'E-7 House Piano',
      'D-1 JP8 Strings1',
      'D-920 Bell Lead 2',
      'D-552 SEQ 6',
      'D-741 Acid Bs 1',
      'D-686 TB Bass 1'
    ]) {
      const m = /^([A-Z])-(\d+) (.*)$/.exec(x);
      ZS.list.push({
        id: 'f' + m[1] + m[2],
        src: 'factory',
        bank: m[1],
        no: +m[2],
        name: m[3],
        kind: 'tone',
        type: 'bass',
        tags: [],
        d: { 'CMN.NAME': m[3] }
      });
    }
    localStorage.setItem('mc707-fill-genre', 'house');
    /* track 4: two bass clips and an acid one */
    const S = A.S;
    S.clipMap = null;
  });

test('Fill tones: suggestions by genre and job, sent into the clips with Sound Source CLIP', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await seed(page);
  await page.locator('#menubar .mb', { hasText: 'Settings' }).first().click();
  await page.locator('.mdrop:not([hidden]) button', { hasText: 'Your MC-707 clips' }).first().click();
  await page.evaluate(() => {
    const m = window.__app.S.clipMap[3];
    m.n = 3;
    m.types = ['bass', 'bass', 'acid', ...m.types.slice(3)];
  });
  await page.click('#cmOv button:has-text("Fill tones")');
  await page.waitForSelector('#ftOv');
  const picks = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#ftOv .ftTrk')].map(s =>
        [...s.querySelectorAll('.ftClip')].map(c => [
          c.querySelector('.ftRole').textContent,
          c.querySelector('select').selectedOptions[0].textContent,
          c.querySelector('input').checked
        ])
      )
    );
  const p = await picks();
  assert.equal(p.length, 8);
  assert.deepEqual(p[0], [['Drums', 'Nothing in the pool', false]], 'drum clips keep their kit');
  const bass = p[3];
  assert.equal(bass.length, 3);
  assert.ok(['House Bs', 'Round Bass'].includes(bass[0][1]) && ['House Bs', 'Round Bass'].includes(bass[1][1]));
  assert.notEqual(bass[0][1], bass[1][1], 'two different basses');
  assert.ok(['Acid Bs 1', 'TB Bass 1'].includes(bass[2][1]), 'the acid clip gets an acid bass');
  assert.deepEqual(p[4][0].slice(0, 2), ['Chords', 'House Piano']);
  assert.match(await page.textContent('#ftOv .ftActs .btn.on'), /Send 7 sounds/);
  assert.equal(await page.locator('#ftOv .ftWarn').count(), 0, 'no factory tones warning when they are in');
  /* send */
  await page.click('#ftOv .ftActs .btn.on');
  await page.waitForFunction(() => /Sent 7 sounds/.test(document.getElementById('toast').textContent), null, {
    timeout: 60000
  });
  const src = await page.evaluate(TRK => [3, 4, 0].map(t => window.__zcMem.get(TRK + t * 0x100 + 4)), TRK);
  assert.deepEqual(src.slice(0, 2), [1, 1], 'tone tracks play their clips’ sounds');
  assert.notEqual(src[2], 1, 'a drum track with nothing sent is left alone');
  assert.equal(
    await page.evaluate(() => window.__app.S.clipMap[4].names[0]),
    'House Piano',
    'the clips screen shows the name'
  );
  assert.deepEqual(errors, []);
});

test('Fill tones: the pools are editable per genre and job, and go back to the suggestions', async () => {
  const { page, errors } = await openApp();
  await seed(page);
  await page.locator('#menubar .mb', { hasText: 'Settings' }).first().click();
  await page.locator('.mdrop:not([hidden]) button', { hasText: 'Fill tones' }).first().click();
  await page.waitForSelector('#ftOv');
  await page.click('#ftOv button:has-text("Edit the pools")');
  const items = () =>
    page.evaluate(() => [...document.querySelectorAll('#fpOv .ftItem span:first-child')].map(s => s.textContent));
  assert.deepEqual(await items(), ['House Bs', 'Round Bass'], 'House bass: the suggestions');
  await page.click('#fpOv .ftItem:first-child button');
  assert.deepEqual(await items(), ['Round Bass']);
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('mc707-tone-pools'))).house.bass, [
    'B-113 Round Bass'
  ]);
  await page.click('#fpOv button:has-text("Back to the suggestions")');
  assert.deepEqual(await items(), ['House Bs', 'Round Bass']);
  /* another genre, another job */
  await page.selectOption('#fpOv select[aria-label=Genre]', 'techno');
  await page.click('#fpOv .ftRoles button:has-text("Acid")');
  assert.ok((await items()).includes('Acid Bs 1'));
  await page.click('#fpOv button:has-text("Done")');
  /* the window offers the same pool in each clip's list */
  assert.ok(
    await page.locator('#ftOv select[aria-label="Track 4 clip 1 sound"] option', { hasText: 'Round Bass' }).count()
  );
  assert.deepEqual(errors, []);
});
