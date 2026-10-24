// The mixers (song/song-mixer.js, live/live-mixer.js, services/mixer-strip.js, services/popout.js): each
// opens in a window of its own; Song's is the song's mix (saved, undoable, sent as CCs), Live's is Live's
// own (kept apart from the song's, sent at Start, mutes on the beat while playing).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* move a range input in the mixer window to v */
const setRange = (loc, v) =>
  loc.evaluate((e, v) => {
    e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  }, v);
const ccSent = (page, ch, n, v) =>
  page.evaluate(([ch, n, v]) => window.__out.some(b => b[0] === (0xb0 | ch) && b[1] === n && b[2] === v), [ch, n, v]);

test('Song mixer: a window of its own; level, pan, sends, velocity, mute and solo go into the song and to the MC-707', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  const [win] = await Promise.all([page.waitForEvent('popup'), page.click('#bMixer')]);
  await win.waitForSelector('.mxStrip');
  assert.equal(await win.locator('.mxStrip').count(), 8, 'a strip per track');
  assert.ok((await win.title()).includes('Song mixer'));
  await page.evaluate('window.__out.length = 0');
  /* track 4: level, pan and reverb */
  const s4 = win.locator('.mxStrip').nth(3);
  await setRange(s4.locator('.mxFader'), 80);
  await setRange(s4.locator('.mxKnob').nth(0), 30);
  await setRange(s4.locator('.mxKnob').nth(1), 50);
  const cc = await page.evaluate('window.__app.S.tracks[3].cc');
  assert.deepEqual([cc[7], cc[10], cc[91]], [80, 30, 50], 'saved in the song');
  const ch = (await page.evaluate('window.__app.S.tracks[3].ch')) - 1;
  assert.ok(await ccSent(page, ch, 7, 80), 'level sent as CC 7');
  assert.ok(await ccSent(page, ch, 10, 30), 'pan sent as CC 10');
  /* undo takes the reverb back, and the window follows */
  await page.keyboard.press('Control+z');
  await win.waitForFunction(
    () => document.querySelectorAll('.mxStrip')[3].querySelectorAll('.mxKnob')[1].value === '0'
  );
  /* mute from the window; the song's track header follows */
  await s4.locator('.mxTg.mute').click();
  assert.equal(await page.evaluate('window.__app.S.tracks[3].mute'), true);
  await page.waitForFunction(() => document.querySelectorAll('#arrInner .ms.m.on').length === 1);
  /* a mute in the song shows in the window */
  await page.evaluate(() => {
    window.__app.S.tracks[5].solo = true;
  });
  await win.waitForFunction(() => document.querySelectorAll('.mxStrip')[5].classList.contains('solo'));
  /* Space in the window starts the song */
  await win.locator('.mxTitle').click();
  await win.keyboard.press('Space');
  await page.waitForFunction(() => window.__app.TR.playing, null, { timeout: 5000 });
  await win.waitForFunction(() => [...document.querySelectorAll('.mxLight')].some(l => +l.style.opacity > 0.3), null, {
    timeout: 8000
  });
  await page.keyboard.press('Space');
  /* closing the window and opening it again */
  await win.close();
  const [win2] = await Promise.all([page.waitForEvent('popup'), page.click('#bMixer')]);
  await win2.waitForSelector('.mxStrip');
  assert.equal(await win2.locator('.mxStrip').nth(3).locator('.mxFader').inputValue(), '80');
  assert.deepEqual(errors, []);
});

test('Live mixer: its own mix, sent at Start, mutes on the beat', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
  await page.click('#menubar .mtab[data-mode=live]');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('.lvGenreOv,.gpOv').forEach(e => e.remove()));
  const [win] = await Promise.all([page.waitForEvent('popup'), page.click('#lvMixer')]);
  await win.waitForSelector('.mxStrip');
  assert.ok((await win.title()).includes('Live mixer'));
  /* Live's level for track 2 is its own: the song's stays as it was */
  const s2 = win.locator('.mxStrip').nth(1);
  await setRange(s2.locator('.mxFader'), 64);
  assert.equal(await page.evaluate('JSON.parse(localStorage.getItem("mc707-live")).mix.lvl[1]'), 64, 'saved with Live');
  assert.equal(await page.evaluate('(window.__app.S.tracks[1].cc || {})[7]'), undefined, 'the song’s mix untouched');
  /* Start sends Live's mix */
  await page.evaluate('window.__out.length = 0');
  await page.evaluate(() => document.querySelector('#lvStart').click());
  await page.waitForFunction(() => window.__app.TR.playing, null, { timeout: 5000 });
  const ch = (await page.evaluate('window.__app.S.tracks[1].ch')) - 1;
  await page.waitForFunction(
    ([ch]) => window.__out.some(b => b[0] === (0xb0 | ch) && b[1] === 7 && b[2] === 64),
    [ch],
    {
      timeout: 3000
    }
  );
  /* a mute waits for the beat (blinking), then lands */
  await s2.locator('.mxTg.mute').click();
  await win.waitForFunction(() => document.querySelectorAll('.mxStrip')[1].querySelector('.mxTg.mute.on'));
  await page.waitForFunction(() => window.__app.LV.mute[1] === true, null, { timeout: 4000 });
  /* solo track 1: the others go quiet; again: they come back */
  await win.locator('.mxStrip').nth(0).locator('.mxTg.solo').click();
  await page.waitForFunction(() => [2, 3, 4, 5, 6, 7].every(t => window.__app.LV.mute[t]), null, { timeout: 4000 });
  await win.locator('.mxStrip').nth(0).locator('.mxTg.solo').click();
  await page.waitForFunction(() => [2, 3, 4, 5, 6, 7].every(t => !window.__app.LV.mute[t]), null, { timeout: 4000 });
  assert.equal(await page.evaluate('window.__app.LV.mute[1]'), true, 'a track muted before the solo stays muted');
  await page.evaluate(() => document.querySelector('#lvStart').click());
  assert.deepEqual(errors, []);
});

test('Mixers in the Windows app: borderless, dragged by the header, with pin, minimise and close', async () => {
  const { page, errors } = await openApp();
  /* stand in for the Windows app's window controls (preload.js) */
  await page.addInitScript(() => {
    window.__pop = [];
    window.toolbox = { popWin: async (name, act, on) => (window.__pop.push([name, act, on]), !!on) };
  });
  await page.reload();
  await page.waitForFunction(() => window.__app);
  const [win] = await Promise.all([page.waitForEvent('popup'), page.click('#bMixer')]);
  await win.waitForSelector('.mxStrip');
  assert.equal(await win.evaluate(() => document.body.classList.contains('popFrameless')), true);
  assert.equal(
    await win.evaluate(() => getComputedStyle(document.querySelector('.mxTop')).getPropertyValue('-webkit-app-region')),
    'drag',
    'the header drags the window'
  );
  await win.locator('.popWb.pin').click();
  await win.waitForSelector('.popWb.pin.on');
  await win.locator('.popWb.min').click();
  assert.deepEqual(await page.evaluate('window.__pop'), [
    ['mc707-song-mixer', 'top', true],
    ['mc707-song-mixer', 'min', undefined]
  ]);
  await win.locator('.popWb.x').click();
  await win.waitForEvent('close', { timeout: 3000 }).catch(() => {});
  assert.equal(win.isClosed(), true, 'closed');
  assert.deepEqual(errors, []);
});
