// Song backups in the desktop app (ui/backups.js, core/state.js): every autosave also goes to a backup file;
// a song that will not load at start is offered back from the latest backup (which the demo song does not
// overwrite while the question is open); File › Recover a backup brings one back, and Undo takes it back.
// The desktop app's file side (main.js) is stood in for here, as in mixers.test.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

/* the desktop app's backup calls, kept in memory: window.__bk is the files, newest written last */
const host = song => {
  /* the saved song broken as the app starts (once: a reload in the test keeps what the app saved) */
  if (song && !sessionStorage.getItem('__bkInit')) {
    localStorage.setItem('mc707-song-mode-v1', '{broken');
    sessionStorage.setItem('__bkInit', '1');
  }
  window.__bk = song ? [{ name: 'latest.json', at: Date.now() - 3600e3, text: song }] : [];
  window.__bkWrites = 0;
  window.toolbox = {
    backupWrite: async text => {
      window.__bkWrites++;
      const b = window.__bk.find(x => x.name === 'latest.json');
      if (b) Object.assign(b, { text, at: Date.now() });
      else window.__bk.push({ name: 'latest.json', at: Date.now(), text });
      return true;
    },
    backupList: async () =>
      window.__bk.map(b => ({ name: b.name, at: b.at, size: b.text.length })).sort((a, b) => b.at - a.at),
    backupRead: async name => window.__bk.find(b => b.name === name).text,
    backupFolder: async () => ''
  };
};
const SONG = readFixture('song-v0.10.json');
const clipsOf = text => JSON.parse(text).clips.length;

test('Backups: a song that will not load is offered back, untouched by the demo while you choose', async () => {
  const { page, errors } = await openApp();
  await page.addInitScript(host, SONG);
  await page.reload();
  await page.waitForFunction(() => window.__app);
  const dlg = page.locator('[role=dialog]', { hasText: 'Bring back your last song?' });
  await dlg.waitFor({ timeout: 5000 });
  /* the demo song autosaved meanwhile, but not over the backup */
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate('window.__bkWrites'), 0, 'no backup written while it asks');
  await dlg.locator('button', { hasText: 'Bring it back' }).click();
  await page.waitForFunction(n => window.__app.S.clips.length === n, clipsOf(SONG));
  /* backing up again, now from the song brought back */
  await page.waitForFunction(() => window.__bkWrites > 0);
  assert.equal(await page.evaluate(() => JSON.parse(window.__bk[0].text).clips.length), clipsOf(SONG));
  /* Undo takes you back to the song you had (the demo) */
  const restored = await page.evaluate(() => JSON.stringify(window.__app.S.clips));
  const back = await page.evaluate(() => (window.__app.undoSong(), JSON.stringify(window.__app.S.clips)));
  assert.notEqual(back, restored, 'Undo takes it back');
  assert.deepEqual(errors, []);
});

test('Backups: autosave writes one, and File › Recover a backup brings it back', async () => {
  const { page, errors } = await openApp();
  await page.addInitScript(host, null);
  await page.reload();
  await page.waitForFunction(() => window.__app);
  const had = await page.evaluate(() => window.__app.S.clips.length);
  /* a change: autosave, and the backup */
  await page.evaluate(() => {
    window.__app.S.bpm = 133;
    window.__app.autosave();
  });
  await page.waitForFunction(() => window.__bkWrites > 0);
  assert.equal(await page.evaluate(() => JSON.parse(window.__bk[0].text).bpm), 133);
  /* a different song, then recover the backup */
  await page.evaluate(() => {
    window.__app.S.bpm = 90;
    window.__app.S.clips.length = 0;
  });
  await page.locator('#menubar .mb', { hasText: 'File' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Recover a backup' }).click();
  const dlg = page.locator('[role=dialog]', { hasText: 'Recover a backup' });
  assert.match(await dlg.textContent(), /Latest autosave/);
  await dlg.locator('button', { hasText: 'Bring it back' }).click();
  await page.waitForFunction(n => window.__app.S.clips.length === n, had);
  assert.equal(await page.evaluate('window.__app.S.bpm'), 133);
  assert.deepEqual(errors, []);
});
