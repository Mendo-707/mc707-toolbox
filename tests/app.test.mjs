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
  await page.evaluate(() => document.querySelector('#lvPadSet').click()); // Live › Settings and mapping
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
  await page.locator('.zcOpen').click();
  assert.equal(await page.locator('#zcOv').count(), 1, 'Edit ZenCore opens the editor');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#zcOv').count(), 0);
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
  await page.evaluate(() => document.querySelector('#lvMidi').click()); // Live › Connect MC-707
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

test('a library pattern opens in the editor, is placed, saved to My patterns; K flips clips', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(() => {
    document.querySelector('#wiz').hidden = true;
  });
  const count = () => page.evaluate(() => Object.keys(window.__app.S.patterns).length);
  const n0 = await count();
  await page.locator('#libList .li').nth(2).click();
  assert.equal(await page.isVisible('.edView'), true, 'the library pattern is in the editor');
  assert.equal(await count(), n0, 'just looking adds nothing to the song');
  const g = await page.locator('#edGrid').boundingBox();
  await page.mouse.click(g.x + 26 * 3 + 5, g.y + 26 * 2 + 5);
  assert.equal(await count(), n0 + 1, 'the first edit keeps an edited copy');
  await page.locator('.edView button', { hasText: 'Save to My patterns' }).click();
  await page.waitForSelector('[role=dialog] input');
  await page.waitForTimeout(100);
  await page.keyboard.type('Mine 1');
  await page.keyboard.press('Enter');
  const clips = await page.evaluate(() => window.__app.S.clips.length);
  await page.locator('.edView button', { hasText: 'Place at playhead' }).click();
  assert.equal(await page.evaluate(() => window.__app.S.clips.length), clips + 1);
  await page.locator('#libTabs button', { hasText: 'Mine' }).click();
  assert.equal(await page.locator('#libList .li b').first().innerText(), 'Mine 1');
  await page.evaluate(() => {
    const S = window.__app.S;
    S.clipMap = S.clipMap || [];
    S.clipMap[0] = { n: 2, types: ['drums', 'drums'], names: ['', ''] };
  });
  await page.locator('.lane[data-t="0"] .clip').first().click();
  await page.evaluate(() => (window.__app.S.cursor = 4));
  await page.keyboard.press('Shift+K');
  await page.evaluate(() => (window.__app.S.cursor = 6));
  await page.keyboard.press('Shift+K');
  assert.deepEqual(await page.evaluate(() => window.__app.S.clipMarks), [
    { t: 0, bar: 4, k: 1 },
    { t: 0, bar: 6, k: 0 }
  ]);
  assert.deepEqual(errors, []);
});

test('ZenCore editor: edits go out as Roland SysEx, a sound reads back, MFX and kits open', async () => {
  const { page, errors } = await openApp();
  const hex = b => b.map(x => x.toString(16).padStart(2, '0')).join(' ');
  const sysex = n => page.evaluate(n => window.__out.slice(n).filter(b => b[0] === 0xf0 && b[7] === 0x12), n);
  const idle = () =>
    page.waitForFunction(() => !/Reading/.test(document.querySelector('#zcStat').textContent), null, {
      timeout: 20000
    });
  /* track 4, clip 1: the fake MC-707 is empty, so the first read finds nothing and gives up quickly */
  await page.evaluate(() => window.__app.zen.open(3, 0));
  await idle();
  assert.match(await page.textContent('#zcStat'), /did not answer/);
  /* a cutoff change is one DT1 at track 4 clip 1's partial 1 (30 66 20 32), value 500 in four nibbles */
  await page.locator('.zcTab', { hasText: 'Filter' }).click();
  let n = await page.evaluate(() => window.__out.length);
  await page.evaluate(() => {
    const r = [...document.querySelectorAll('.zcC')]
      .find(c => c.textContent.startsWith('Cutoff'))
      .querySelector('input[type=range]');
    r.value = 500;
    r.dispatchEvent(new Event('input'));
    r.dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(80);
  assert.deepEqual((await sysex(n)).map(hex), ['f0 41 10 00 00 00 5d 12 30 66 20 32 00 01 0f 04 04 f7']);
  /* once the edits settle, the clip is selected again (program change 0 on track 4's channel) so the
     MC-707 redraws its screen; with the Screen switch off it is not */
  const pcs = n =>
    page.evaluate(
      n =>
        window.__out
          .slice(n)
          .filter(b => (b[0] & 0xf0) === 0xc0)
          .map(b => b.join(',')),
      n
    );
  await page.waitForTimeout(600);
  assert.deepEqual(await pcs(n), ['195,0']);
  await page.locator('.zcActs button', { hasText: 'Screen' }).click();
  n = await page.evaluate(() => window.__out.length);
  await page.evaluate(() => {
    const r = [...document.querySelectorAll('.zcC')]
      .find(c => c.textContent.startsWith('Cutoff'))
      .querySelector('input[type=range]');
    r.value = 600;
    r.dispatchEvent(new Event('input'));
    r.dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(600);
  assert.equal((await sysex(n)).length, 1);
  assert.deepEqual(await pcs(n), []);
  await page.locator('.zcActs button', { hasText: 'Screen' }).click();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(600);
  /* undo sends the old value back */
  n = await page.evaluate(() => window.__out.length);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(80);
  assert.deepEqual((await sysex(n)).map(hex), ['f0 41 10 00 00 00 5d 12 30 66 20 32 00 03 0f 0f 77 f7']);
  /* a starter goes to the MC-707 whole; scrambled here and read back, every value matches */
  await page.locator('.zcActs button', { hasText: 'Starters' }).click();
  await page.locator('.cmenu .cmi', { hasText: 'Sub 808' }).click();
  await page.waitForTimeout(600);
  const want = await page.evaluate(() => ({ ...window.__app.zen.ZE.snd.v }));
  await page.evaluate(() => {
    const E = window.__app.zen.ZE;
    for (const k in E.snd.v) if (typeof E.snd.v[k] === 'number') E.snd.v[k] = 0;
  });
  await page.locator('.zcActs button', { hasText: 'Read from' }).click();
  await idle();
  assert.match(await page.textContent('#zcStat'), /Read 1151 of 1151 values/);
  const got = await page.evaluate(() => window.__app.zen.ZE.snd.v);
  assert.deepEqual(
    Object.keys(want).filter(k => want[k] !== got[k]),
    []
  );
  /* MFX: choosing Delay writes the type (30 66 01 00 = 37) and shows its parameters */
  await page.locator('.zcTab', { hasText: 'MFX' }).click();
  n = await page.evaluate(() => window.__out.length);
  await page.selectOption('.zcG select', '37');
  await page.waitForTimeout(500);
  assert.ok((await sysex(n)).map(hex).includes('f0 41 10 00 00 00 5d 12 30 66 01 00 25 44 f7'));
  assert.ok((await page.locator('.zcG legend', { hasText: 'Delay' }).count()) > 0);
  /* a drum track opens the kit editor with all 88 keys */
  await page.evaluate(() => window.__app.zen.open(0, 0));
  await idle();
  await page.locator('.zcTab', { hasText: 'Keys' }).click();
  assert.equal(await page.locator('.zcKey').count(), 88);
  await page.locator('.zcActs button', { hasText: 'Done' }).click();
  assert.equal(await page.locator('#zcOv').count(), 0);
  assert.deepEqual(errors, []);
});

test('ZenCore editor reads a whole tone from an MC-707 that splits replies and sends strays', async () => {
  const { page, errors } = await openApp();
  const idle = () =>
    page.waitForFunction(() => !/Reading/.test(document.querySelector('#zcStat').textContent), null, {
      timeout: 30000
    });
  await page.evaluate(() => window.__app.zen.open(3, 0));
  await idle();
  await page.locator('.zcActs button', { hasText: 'Starters' }).click();
  await page.locator('.cmenu .cmi', { hasText: 'Saw lead' }).click();
  await page.waitForTimeout(600);
  const want = await page.evaluate(() => ({ ...window.__app.zen.ZE.snd.v }));
  /* from now on the fake MC-707 answers like the real one */
  await page.evaluate(() => {
    window.__zcReal = true;
    window.__zcReqs = 0;
    const E = window.__app.zen.ZE;
    for (const k in E.snd.v) if (typeof E.snd.v[k] === 'number') E.snd.v[k] = 0;
  });
  await page.locator('.zcActs button', { hasText: 'Read from' }).click();
  await idle();
  assert.match(await page.textContent('#zcStat'), /Read 1151 of 1151 values/);
  const got = await page.evaluate(() => window.__app.zen.ZE.snd.v);
  assert.deepEqual(
    Object.keys(want).filter(k => want[k] !== got[k]),
    [],
    'every value read back correctly'
  );
  /* one request per run, no slow one-by-one fallback */
  const reqs = await page.evaluate(() => window.__zcReqs);
  assert.ok(reqs <= 70, 'read in ' + reqs + ' requests');
  assert.deepEqual(errors, []);
});

test('ZenCore editor on the MC-101: its own track numbers, model byte, and it learns the byte that answers', async () => {
  const { page, errors } = await openApp({ storage: { 'mc-device': '101' } });
  const hex = b => b.map(x => x.toString(16).padStart(2, '0')).join(' ');
  const sysex = n => page.evaluate(n => window.__out.slice(n).filter(b => b[0] === 0xf0 && b[7] === 0x12), n);
  const idle = () =>
    page.waitForFunction(() => !/Reading/.test(document.querySelector('#zcStat').textContent), null, {
      timeout: 20000
    });
  const cutoff = async v => {
    await page.evaluate(v => {
      const r = [...document.querySelectorAll('.zcC')]
        .find(c => c.textContent.startsWith('Cutoff'))
        .querySelector('input[type=range]');
      r.value = v;
      r.dispatchEvent(new Event('input'));
      r.dispatchEvent(new Event('change'));
    }, v);
    await page.waitForTimeout(80);
  };
  /* this fake MC-101 only answers reads sent with the MC-707's model byte */
  await page.evaluate(async () => {
    const acc = await navigator.requestMIDIAccess();
    const o = [...acc.outputs.values()][0],
      send = o.send;
    o.send = (b, t) => (b[0] === 0xf0 && b[7] === 0x11 && b[6] !== 0x5d ? window.__out.push([...b]) : send(b, t));
  });
  /* app track 4 is the MC-101's track 2 (device index 1), so its clip 1 is at 30 22 00 00 */
  await page.evaluate(() => window.__app.zen.open(3, 0));
  await idle();
  const opts = await page.$$eval('.zcTarget select:first-child option', o => o.map(x => x.textContent));
  assert.equal(opts.length, 4, 'four tracks to pick from');
  await page.locator('.zcTab', { hasText: 'Filter' }).click();
  let n = await page.evaluate(() => window.__out.length);
  await cutoff(500);
  assert.deepEqual((await sysex(n)).map(hex), ['f0 41 10 00 00 00 5e 12 30 22 20 32 00 01 0f 04 48 f7']);
  /* a read: the 0x5E request gets no answer, the 0x5D one does, and from then on everything uses 0x5D */
  await page.locator('.zcActs button', { hasText: 'Starters' }).click();
  await page.locator('.cmenu .cmi', { hasText: 'Sub 808' }).click();
  await page.waitForTimeout(600);
  await page.locator('.zcActs button', { hasText: 'Read from' }).click();
  await idle();
  assert.match(await page.textContent('#zcStat'), /Read \d+ of \d+ values/);
  n = await page.evaluate(() => window.__out.length);
  await cutoff(300);
  const w = (await sysex(n)).map(hex);
  assert.equal(w.length, 1);
  assert.match(w[0], /^f0 41 10 00 00 00 5d 12 30 22 20 32 /);
  assert.deepEqual(errors, []);
});

test('the start screen opens the last session or Live Mode, which asks for a genre', async () => {
  const { page, errors } = await openApp({
    storage: { ...SAVED, 'mc707-start': '1', 'mc707-live-pick': '1' }
  });
  await page.waitForSelector('#startOv');
  const cards = await page.$$eval('.stCard b', b => b.map(x => x.textContent));
  assert.deepEqual(cards, ['Load last session', 'Blank song', 'Empty template', 'Song wizard', 'Live Mode']);
  const clips = await page.evaluate(() => window.__app.S.clips.length);
  assert.ok(clips > 0, 'the saved song is loaded behind the screen');
  await page.locator('.stCard', { hasText: 'Empty template' }).click();
  assert.equal(await page.evaluate(() => window.__app.S.clips.length), 0);
  assert.equal(await page.evaluate(() => window.__app.S.markers.length), 7);
  /* File › Start screen, then Live Mode: the genre picker opens and builds a set in the chosen style */
  await page.locator('#menubar .mb', { hasText: 'File' }).click();
  await page.locator('.mdrop:not([hidden]) button', { hasText: 'Start screen' }).click();
  await page.locator('.stCard', { hasText: 'Live Mode' }).click();
  await page.waitForSelector('#lvPickOv');
  await page.locator('.lpStyle', { hasText: 'Acid techno' }).click();
  assert.equal(await page.locator('#lvPickOv').count(), 0);
  assert.equal(await page.evaluate(() => document.querySelector('#lvStyle').value), 'acidtechno');
  assert.deepEqual(errors, []);
});

test('track setup: 8 drum or 8 tone tracks, and the wizard and Live Mode follow it', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  const types = () => page.evaluate(() => window.__app.S.tracks.map(t => t.type).join(','));
  assert.equal(await types(), 'drum,drum,drum,tone,tone,tone,tone,tone', 'the default is 3 drum + 5 tone');
  const openSetup = async () => {
    await page.locator('#menubar .mb', { hasText: 'Settings' }).click();
    await page.locator('.mdrop:not([hidden]) button', { hasText: 'Track setup' }).click();
    await page.waitForSelector('#tsOv');
  };
  const pick = async name => {
    await page.locator('#tsOv .tsPresets .btn', { hasText: name }).click();
    const ask = page.locator('button', { hasText: 'Change and remove them' });
    if (await ask.count()) await ask.click();
    await page.waitForTimeout(150);
  };
  const check = async (want, label) => {
    assert.equal(await types(), want, label);
    const bad = await page.evaluate(() => {
      const { S, LV } = window.__app;
      const out = [];
      S.clips.forEach(c => S.tracks[c.t].type !== S.patterns[c.pat].type && out.push('song ' + c.t));
      (LV.scenes || []).forEach(sc =>
        Object.entries(sc.cells || {}).forEach(([t, c]) => {
          const p = c && window.__app.FAC.find(f => f.id === c.id);
          if (p && p.type !== S.tracks[t].type) out.push('live ' + t + ' ' + c.id);
        })
      );
      return out;
    });
    assert.deepEqual(bad, [], label + ': every clip fits its track');
  };
  await openSetup();
  for (const [name, want] of [
    ['8 drums', 'drum,drum,drum,drum,drum,drum,drum,drum'],
    ['8 tone', 'tone,tone,tone,tone,tone,tone,tone,tone'],
    ['4 drums + 4 tone', 'drum,drum,drum,drum,tone,tone,tone,tone']
  ]) {
    await pick(name);
    await check(want, name);
    /* the song wizard builds a song on this layout */
    await page.click('#tsOv .cmHead .btn');
    await page.evaluate(() => document.querySelector('#bWiz').click());
    await page.locator('#wiz .scard', { hasText: 'Acid techno' }).first().click();
    for (let i = 0; i < 6 && !(await page.locator('#wizFoot button', { hasText: 'Create song' }).count()); i++)
      await page.locator('#wizFoot button', { hasText: 'Next' }).click();
    await page.locator('#wizFoot button', { hasText: 'Create song' }).click();
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => window.__app.S.clips.length > 0), name + ': the wizard made a song');
    await check(want, name + ' after the wizard');
    /* Live Mode plays it */
    await page.evaluate(() => {
      window.__app.liveBuild();
      window.__app.liveStart();
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__app.stopAll());
    await check(want, name + ' in Live Mode');
    await openSetup();
  }
  await pick('Default');
  assert.equal(await types(), 'drum,drum,drum,tone,tone,tone,tone,tone');
  assert.equal(await page.evaluate(() => window.__app.S.tracks.some(t => t.role)), false, 'the default saves no roles');
  assert.deepEqual(errors, []);
});
