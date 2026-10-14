// Behaviour tests: saved work loads, every screen opens without errors, and the main features still work.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, closeBrowser, readFixture, ROOT } from './helpers.mjs';

after(closeBrowser);

const SAVED = {
  'mc707-song-mode-v1': readFixture('song-v0.10.json'),
  'mc707-live': readFixture('live-settings-v0.10.json')
};

test('a song and Live settings saved by v0.10.0 load unchanged', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  const r = await page.evaluate(() => {
    const a = window.__app;
    return {
      clips: a.S.clips.length,
      marks: a.S.clipMarks.length,
      scene: a.S.markers[0].scene,
      clipAuto: a.S.clipAuto,
      style: a.LV.style,
      theme: a.LV.theme,
      preset: a.LV.ctl.preset,
      brk: a.LV.brkStyle,
      flags: document.querySelectorAll('.cmk').length
    };
  });
  assert.deepEqual(r, {
    clips: 10,
    marks: 3,
    scene: 2,
    clipAuto: true,
    style: 'neuro',
    theme: 'studio',
    preset: 'flkey61',
    brk: 'roll',
    flags: 3
  });
  assert.deepEqual(errors, []);
});

test('every screen and dialog opens without errors', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  const closeMenus = () => page.evaluate(() => document.querySelectorAll('.cmenu').forEach(m => m.remove()));
  // Song Mode: right-click menus
  for (const sel of ['.rcells', '.clip', '.lane[data-t="5"]', '.thead', '#bPlay']) {
    await page
      .locator(sel)
      .first()
      .click({
        button: 'right',
        position: { '.rcells': { x: 300, y: 8 }, '.lane[data-t="5"]': { x: 900, y: 20 } }[sel]
      });
    assert.ok((await page.locator('.cmenu').count()) > 0, 'right-click menu on ' + sel);
    await closeMenus();
  }
  await page.locator('.clip').first().click();
  await page.click('#grabBtn');
  assert.equal(await page.locator('#grabPop').count(), 1);
  await page.click('#grabPop .grabH .btn');
  await page.evaluate(() => document.querySelector('#bWiz').click());
  await page.waitForTimeout(300);
  assert.equal(await page.isVisible('#wiz'), true);
  await page.evaluate(() => {
    document.querySelector('#wiz').hidden = true;
  });
  // Live Mode
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(300);
  await page.locator('.lvTile').first().click({ button: 'right' });
  assert.ok((await page.locator('.cmenu').count()) > 0);
  await closeMenus();
  await page.locator('.lvPad').first().click({ button: 'right' });
  assert.ok((await page.locator('.cmenu').count()) > 0);
  await closeMenus();
  await page.locator('.lvEdit').first().click();
  assert.equal(await page.isVisible('#lvScEd'), true);
  await page.click('#lvPadSet');
  await page.waitForTimeout(200);
  assert.ok((await page.locator('.rvP').count()) >= 8);
  await page.click('#lvStart');
  await page.waitForTimeout(1500);
  await page.click('#lvLock');
  await page.waitForTimeout(300);
  await page.click('#lvStart');
  for (const th of ['neon', 'graphite', 'daylight', 'paper'])
    await page.evaluate(t => {
      const s = document.querySelector('#lvTheme') || null;
      if (s) {
        s.value = t;
        s.dispatchEvent(new Event('change'));
      }
    }, th);
  await page.click('#lvClipsBtn').catch(async () => {
    await page.evaluate(() =>
      [...document.querySelectorAll('#live button')].find(b => /Clips/.test(b.textContent)).click()
    );
  });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#cmOv').count(), 1);
  await page.locator('.cmPad').nth(2).click({ button: 'right' });
  assert.ok((await page.locator('.cmenu').count()) > 0);
  await closeMenus();
  await page.evaluate(() => document.querySelector('#cmOv').remove());
  assert.deepEqual(errors, []);
});

test('Song Mode: clip changes chase from the middle, glue joins clips', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  const r = await page.evaluate(async () => {
    const a = window.__app,
      S = a.S;
    a.ensureAudio();
    await a.connectMidi();
    window.__out.length = 0;
    S.cursor = 3;
    a.startSong();
    a.TICKER.stop();
    a.stopAll();
    const pcs = window.__out.filter(m => (m[0] & 0xf0) === 0xc0);
    // glue: split a clip in two touching halves, then glue them back
    const c = S.clips.find(x => x.len >= 2),
      n0 = S.clips.length,
      half = c.len / 2;
    S.clips.push({ ...c, id: 'cX', start: c.start + half, len: half, off: (c.off || 0) + half });
    c.len = half;
    a.glueClips(a.glueRun(c, 'next'));
    return { pcs, glued: S.clips.length === n0 };
  });
  const has = (st, v) => r.pcs.some(m => m[0] === st && m[1] === v);
  assert.ok(has(0xc3, 1) && has(0xc4, 1), 'tracks 4 and 5 switch to clip 2 when playing from bar 4');
  assert.equal(r.glued, true);
  assert.deepEqual(errors, []);
});

test('Live Mode: lock holds the loop, a controller keyboard mutes and solos', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.click('#lvMidi');
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    LV.vary = 100;
    LV.auto = true;
    a.liveStart(0);
    a.TICKER.stop();
    const step = n => {
      for (let i = 0; i < n; i++) {
        a.processTick(a.TR.tick, a.TR.nextTime);
        a.advance();
      }
    };
    step(64);
    document.querySelector('#lvLock').click();
    const ids0 = JSON.stringify(LV.voices.map(v => v.map(x => x.f.id)));
    step(32 * 24);
    const held = JSON.stringify(LV.voices.map(v => v.map(x => x.f.id))) === ids0;
    // controller keyboard (FLkey preset from the saved settings): lowest octave = mutes, hold mode
    const base = LV.ctl.base;
    window.__key([0x90, base + 3, 100]);
    step(16);
    const muted = !!LV.mute[3];
    window.__key([0x80, base + 3, 0]);
    step(16);
    const back = !LV.mute[3];
    window.__out.length = 0;
    window.__key([0x90, base + 30, 90]);
    const solo = window.__out.find(m => (m[0] & 0xf0) === 0x90);
    a.stopAll();
    return { held, muted, back, soloCh: solo ? (solo[0] & 15) + 1 : null };
  });
  assert.equal(r.held, true, 'locked loop keeps its patterns');
  assert.equal(r.muted, true, 'holding a mute key mutes Bass');
  assert.equal(r.back, true, 'releasing it brings Bass back');
  assert.equal(r.soloCh, 4, 'keys above the zones play the Bass track (channel 4)');
  assert.deepEqual(errors, []);
});

test('MC-101 mode hides the unused tracks', async () => {
  const { page, errors } = await openApp({ storage: { ...SAVED, 'mc-device': '101' } });
  const r = await page.evaluate(() => [...document.querySelectorAll('.trow')].map(t => t.classList.contains('devoff')));
  assert.deepEqual(r, [false, true, true, false, false, true, false, true]);
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.click('#lvStart');
  await page.waitForTimeout(800);
  await page.click('#lvStart');
  assert.deepEqual(errors, []);
});

test('a new project and undo replace the whole song', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  const clips = () => page.evaluate(() => window.__app.S.clips.length);
  assert.equal(await clips(), 10);
  await page.locator('#arr').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+n');
  await page.waitForTimeout(200);
  const ok = page.locator('[role=dialog] button.on');
  if (await ok.count()) await ok.first().click();
  await page.waitForTimeout(200);
  assert.equal(await clips(), 0, 'Ctrl+N starts an empty project');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  assert.equal(await clips(), 10, 'Ctrl+Z brings the song back');
  assert.equal(await page.locator('.clip').count(), 10, 'and the arrangement shows it');
  assert.deepEqual(errors, []);
});

test('every hook in core/hooks.js is filled in when the app starts', async () => {
  // Lower modules call up the layers through hooks; a hook left empty would only fail when that path runs.
  const listed = [
    ...fs.readFileSync(path.join(ROOT, 'src', 'core', 'hooks.js'), 'utf8').matchAll(/^\/\/ {3}(\w+)\s+src\//gm)
  ].map(m => m[1]);
  assert.ok(listed.length > 0, 'hooks.js lists its hooks');
  const { page, errors } = await openApp();
  const missing = await page.evaluate(names => names.filter(n => typeof window.__app.hooks[n] !== 'function'), listed);
  assert.deepEqual(missing, []);
  assert.deepEqual(errors, []);
});
