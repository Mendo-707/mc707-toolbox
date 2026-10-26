// The menu bar (each menu in the modes it belongs to, no repeats, submenus), Help › About, the right-click
// menus added for Synth Mode, the Sound browser, the mood pad and the ZenCore controls, and hover help.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApp, closeBrowser } from './helpers.mjs';
import { VERSION } from '../src/core/version.js';

after(closeBrowser);

test('the version in the app matches package.json', () => {
  assert.equal(VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
});

test('menus: the right ones in each mode, nothing repeated in a menu, submenus and About', async () => {
  const { page, errors } = await openApp();
  const shown = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#menubar .mb')].filter(b => b.offsetParent).map(b => b.textContent)
    );
  const want = {
    song: ['File', 'Edit', 'Song', 'MC-707', 'Settings', 'View', 'Help'],
    live: ['File', 'Live', 'MC-707', 'Settings', 'View', 'Help'],
    synth: ['File', 'Synth', 'MC-707', 'Settings', 'View', 'Help']
  };
  for (const m of ['song', 'live', 'synth']) {
    await page.click('#menubar .mtab[data-mode=' + m + ']');
    await page.keyboard.press('Escape');
    assert.deepEqual(await shown(), want[m], m);
  }
  const dupes = await page.evaluate(() =>
    [...document.querySelectorAll('#menubar .mdrop')].flatMap(d => {
      const l = [...d.querySelectorAll('.mi > span:first-child')].map(s => s.textContent);
      return l.filter((x, i) => l.indexOf(x) !== i);
    })
  );
  assert.deepEqual(dupes, [], 'no item twice in one menu');
  /* a submenu: File › Folders */
  await page.click('#menubar .mtab[data-mode=song]');
  await page.locator('#menubar .mb', { hasText: 'File' }).click();
  await page.locator('#menubar .mi', { hasText: 'Folders' }).click();
  assert.ok(await page.locator('.cmenu .cmi', { hasText: 'Open project folder' }).count());
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 300);
  /* Help › About */
  await page.locator('#menubar .mb', { hasText: 'Help' }).click();
  await page.locator('#menubar .mi', { hasText: 'About MC-707 Toolbox' }).click();
  assert.match(await page.locator('#aboutOv').textContent(), new RegExp('Version ' + VERSION.replace(/\./g, '\\.')));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#aboutOv').count(), 0, 'Escape closes it');
  assert.deepEqual(errors, []);
});

test('right-click menus: Synth strips, the mood pad and the ZenCore controls; hover help appears', async () => {
  const { page, errors } = await openApp();
  /* Synth strip */
  await page.click('#menubar .mtab[data-mode=synth]');
  await page
    .locator('#synth .syStrip')
    .nth(4)
    .click({ button: 'right', position: { x: 60, y: 14 } });
  assert.ok(await page.locator('.cmenu', { hasText: 'Copy this sound to' }).count(), 'strip menu');
  await page.locator('.cmenu .cmi', { hasText: 'Solo' }).click();
  assert.equal(await page.locator('#synth .syStrip.solo').count(), 1);
  /* mood pad */
  await page.click('#menubar .mtab[data-mode=live]');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('.lvGenreOv,.gpOv').forEach(e => e.remove()));
  await page.locator('#lvMoodPad').click({ button: 'right' });
  await page.locator('.cmenu .cmi', { hasText: 'Angry' }).click();
  assert.equal(await page.inputValue('#lvMood'), 'angry');
  /* hover help reaches Live Mode's controls */
  await page.waitForFunction(() => !!document.querySelector('#lvQ').title, null, { timeout: 5000 });
  /* a ZenCore control: the same value on all four partials */
  await page.click('#menubar .mtab[data-mode=song]');
  await page.evaluate('window.__app.zen.open(3, 0)');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#zcOv .zcTab')].find(b => /filter/i.test(b.textContent));
    if (t) t.click();
  });
  const box = page.locator('#zcOv .zcC', { hasText: 'Cutoff' }).first();
  await box.locator('input[type=range]').fill('33');
  await box.locator('input[type=range]').dispatchEvent('change');
  await box.click({ button: 'right', position: { x: 4, y: 4 } });
  await page.locator('.cmenu .cmi', { hasText: 'Same on all four partials' }).click();
  const v = await page.evaluate(() => [0, 1, 2, 3].map(i => window.__app.zen.ZE.snd.v['PTL' + i + '.CUTOFF']));
  assert.deepEqual(v, [33, 33, 33, 33]);
  assert.deepEqual(errors, []);
});
