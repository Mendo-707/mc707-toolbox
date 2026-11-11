// The connection pill in the top bar (the same in every mode), Song Mode's Compose button and thin empty
// editor, Scene Mode's wording with nothing to write, the Template builder (Escape, the song's tempo and
// genre the first time, its card on the start screen), and Live's loop panels at the top of their column.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

test('The top bar shows the connection in every mode; click connects', async () => {
  const { page, errors } = await openApp();
  const pill = page.locator('#mConn');
  /* (Synth Mode connects by itself, so it is not in this round) */
  for (const m of ['song', 'scene', 'live']) {
    await page.click('#menubar .mtab[data-mode=' + m + ']');
    assert.match(await pill.textContent(), /Not connected/, m);
    assert.ok(await pill.isVisible(), m);
  }
  await page.click('#menubar .mtab[data-mode=song]');
  await pill.click();
  await page.waitForFunction(
    () =>
      /connected/.test(document.querySelector('#mConn').textContent) &&
      document.querySelector('#mConn').classList.contains('on')
  );
  assert.match(await pill.textContent(), /^● .+ connected$/);
  assert.deepEqual(errors, []);
});

test('Song Mode: Compose opens the Song wizard; with no pattern selected the editor is a strip', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-song-mode-v1': readFixture('song-v0.10.json') } });
  const h = await page.evaluate(() => ({
    empty: document.querySelector('#editor').classList.contains('empty'),
    ed: document.querySelector('#editor').getBoundingClientRect().height,
    arr: document.querySelector('#arr').getBoundingClientRect().height
  }));
  assert.ok(h.empty && h.ed < 90, 'a thin strip: ' + h.ed);
  assert.ok(h.arr > 500, 'the arrangement has the room: ' + h.arr);
  await page.click('#bCompose');
  assert.equal(await page.isVisible('#wiz'), true);
  await page.evaluate(() => (document.querySelector('#wiz').hidden = true));
  /* a clip selected: the editor is back at its size */
  await page.locator('#arrInner .clip').first().click();
  const ed = await page.evaluate(() => document.querySelector('#editor').getBoundingClientRect().height);
  assert.ok(ed > 200, 'the editor opens: ' + ed);
  assert.deepEqual(errors, []);
});

test('Scene Mode with nothing in it does not say All written', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=scene]');
  const top = await page.locator('.scnTop').textContent();
  assert.match(top, /Nothing to write yet/);
  assert.doesNotMatch(top, /All written/);
  assert.deepEqual(errors, []);
});

test('Template builder: Escape closes it at once; the first time it takes the song’s tempo and genre; the start screen has it', async () => {
  const { page, errors } = await openApp({
    storage: { 'mc707-song-mode-v1': readFixture('song-v0.10.json'), 'mc707-start': '1' }
  });
  await page.locator('#startOv .stCard', { hasText: 'Template builder' }).click();
  await page.locator('#tbOv .tbRow').first().waitFor();
  const tb = await page.evaluate(() => [window.__app.tpl.TB.bpm, window.__app.tpl.TB.genre, window.__app.S.bpm]);
  assert.equal(tb[0], tb[2], 'the song’s tempo');
  assert.equal(tb[1], 'dnb', 'the genre nearest to 174');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#tbOv'));
  assert.deepEqual(errors, []);
});

test('Live Mode: LoopCompose and Loop rec open the right column', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  const ids = await page.evaluate(() => [...document.querySelector('.lvRight').children].slice(0, 2).map(e => e.id));
  assert.deepEqual(ids, ['lvF-loopcompose', 'lvF-looprec']);
  assert.ok(await page.locator('.lcPanel button', { hasText: '● Start' }).isVisible());
  assert.deepEqual(errors, []);
});
