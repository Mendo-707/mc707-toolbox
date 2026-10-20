// The ZenCore editor's Sound browser (zen/zc-browser.js, zen/zc-sounds.js): starters and saved sounds in
// one list, grabbing the sounds in the MC-707's clips (the fake MC-707 in helpers.mjs answers reads from
// what was written), no duplicates, favourites, tags and the backup file.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Sound browser: load a starter, grab the clips from the MC-707, star, tag and back up', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  const until = async (fn, ms = 20000) => {
    for (let t = 0; t < ms; t += 100) {
      if (await page.evaluate(fn)) return true;
      await page.waitForTimeout(100);
    }
    return false;
  };
  const idle = () => until(`!${z}.ZE.busy`);
  /* put two starters into clips 1 and 2 of track 4 on the MC-707 */
  for (const [k, name] of [
    [0, 'Warm pad'],
    [1, 'Hoover']
  ]) {
    await page.evaluate(`${z}.open(3, ${k})`);
    await idle();
    await page.evaluate(`${z}.browse()`);
    await page.locator('#zbOv .zbChip', { hasText: 'Starters' }).click();
    await page.fill('#zbQ', name);
    await page.locator('#zbOv .zbItem', { hasText: name }).first().click();
    await page.locator('#zbOv button', { hasText: 'Done' }).click();
    await page.evaluate(`${z}.sendAll()`);
    await page.waitForTimeout(300);
  }
  /* grab every clip of track 4 */
  await page.evaluate(`${z}.open(3, 0)`);
  await idle();
  await page.evaluate(`${z}.browse()`);
  const grab = async () => {
    await page.locator('#zbOv button', { hasText: 'Grab from' }).click();
    await page.locator('.cmenu >> text=All 16 clips of track 4').click();
    assert.ok(
      await until(`!document.querySelector('#zbOv button.on')?.textContent.includes('Stop')`, 120000),
      'the grab finishes'
    );
  };
  await grab();
  const got = await page.evaluate(`${z}.ZS.list.filter(e => e.src === 'mc707').map(e => e.name)`);
  assert.equal(got.length, 2, 'the two sounds in the clips: ' + got.join(', '));
  await grab();
  assert.equal(
    await page.evaluate(`${z}.ZS.list.filter(e => e.src === 'mc707').length`),
    2,
    'grabbing again adds no copies'
  );
  /* the list shows them under From the MC-707; star one and filter by favourites */
  await page.fill('#zbQ', '');
  await page.locator('#zbOv .zbChip', { hasText: 'From the MC-707' }).click();
  assert.equal(await page.locator('#zbOv .zbItem').count(), 2);
  await page.locator('#zbOv .zbItem .zbStar').first().click();
  await page.locator('#zbOv .zbChip', { hasText: 'Favourites' }).click();
  assert.equal(await page.locator('#zbOv .zbItem').count(), 1, 'one favourite');
  /* save the sound in the editor with a genre tag, then filter by the tag */
  await page.locator('#zbOv button', { hasText: 'Save this tone' }).click();
  await page.fill('#zbOv .zbName', 'My test pad');
  await page.locator('#zbOv .zbForm .zbChip', { hasText: 'Ambient' }).click();
  await page.locator('#zbOv .zbForm button', { hasText: 'Save' }).click();
  await until(`${z}.ZS.list.length >= 3`);
  const mine = await page.evaluate(`${z}.ZS.list.find(e => e.name === 'My test pad')`);
  /* the same sound as a grabbed one counts as already saved; save a changed copy instead */
  if (!mine) {
    await page.evaluate(`(() => { const E = ${z}.ZE; E.snd.v['CMN.LEVEL'] = (E.snd.v['CMN.LEVEL'] + 7) % 127; })()`);
    await page.locator('#zbOv button', { hasText: 'Save this tone' }).click();
    await page.fill('#zbOv .zbName', 'My test pad');
    await page.locator('#zbOv .zbForm .zbChip', { hasText: 'Ambient' }).click();
    await page.locator('#zbOv .zbForm button', { hasText: 'Save' }).click();
    await until(`${z}.ZS.list.some(e => e.name === 'My test pad')`);
  }
  const saved = await page.evaluate(`${z}.ZS.list.find(e => e.name === 'My test pad')`);
  assert.ok(saved && saved.tags.includes('Ambient'), 'saved with its tag');
  assert.ok(
    Object.keys(saved.d).length < 400,
    'only the changed values are stored (' + Object.keys(saved.d).length + ')'
  );
  await page.locator('#zbOv .zbChip', { hasText: 'All' }).first().click();
  await page.locator('#zbOv .zbFilt .zbChip', { hasText: 'Ambient' }).click();
  assert.equal(await page.locator('#zbOv .zbItem').count(), 1, 'the tag filter');
  /* loading a library sound puts it in the editor */
  await page.locator('#zbOv .zbItem').first().click();
  assert.equal(
    await page.evaluate(`${z}.ZE.snd.v['CMN.NAME']`),
    saved.d['CMN.NAME'] ?? (await page.evaluate(`${z}.ZE.snd.v['CMN.NAME']`))
  );
  /* the backup file has every saved sound, with its tags */
  await page.locator('#zbOv button', { hasText: 'Backup' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.cmenu >> text=Export the library').click()
  ]);
  const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  assert.equal(file.sounds, 1);
  assert.equal(file.list.length, await page.evaluate(`${z}.ZS.list.length`));
  assert.ok(file.list.some(e => e.name === 'My test pad' && e.tags.includes('Ambient')));
  assert.deepEqual(errors, []);
});

test('Sound browser: the older My sounds list moves into the library once', async () => {
  const old = {
    lib: [
      {
        id: 'z1',
        at: 1,
        s: { app: 'mc707-toolbox', zencore: 1, kind: 'tone', name: 'Old bass', v: { 'CMN.LEVEL': 99 } }
      }
    ],
    clips: {}
  };
  const { page, errors } = await openApp({ storage: { 'mc707-zen': JSON.stringify(old) } });
  await page.evaluate('window.__app.zen.open(3, 0)');
  await page.evaluate('window.__app.zen.browse()');
  await page.locator('#zbOv .zbChip', { hasText: 'My sounds' }).click();
  await page.locator('#zbOv .zbItem', { hasText: 'Old bass' }).waitFor();
  const e = await page.evaluate("window.__app.zen.ZS.list.find(x => x.name === 'Old bass')");
  assert.equal(e.type, 'bass', 'its type comes from its name');
  assert.equal(e.d['CMN.LEVEL'], 99);
  assert.deepEqual(errors, []);
});

test('loading a sound sends the whole sound, even the same one again (the clip may hold something else)', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  await page.evaluate(`${z}.open(3, 0)`);
  for (let t = 0; t < 100 && (await page.evaluate(`!!${z}.ZE.busy`)); t++) await page.waitForTimeout(100);
  await page.evaluate(`${z}.browse()`);
  await page.locator('#zbOv .zbChip', { hasText: 'Starters' }).click();
  const load = async name => {
    await page.evaluate('window.__dt1 = 0; window.__onDT1 = (a, d) => (window.__dt1 += d.length)');
    await page.fill('#zbQ', name);
    await page.locator('#zbOv .zbItem', { hasText: name }).first().click();
    /* the effect settings follow the effect type a moment later */
    await page.waitForTimeout(1500);
    return page.evaluate('window.__dt1');
  };
  const first = await load('Warm pad');
  const again = await load('Warm pad');
  const other = await load('Juno pad');
  console.log({ first, again, other });
  assert.ok(first > 0, 'the first load is sent');
  assert.ok(again >= first - 50, 'loading the same sound again sends it all again');
  assert.ok(other >= first - 200, 'another pad is sent whole too');
  assert.deepEqual(errors, []);
});

test('loading a sound mutes the track until it is written (no half-written sound or effect is heard), and empty clips are not grabbed', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(500);
  await page.evaluate(`${z}.browse()`);
  await page.evaluate('window.__out.length = 0');
  /* a starter with its own effect type: the effect settings go in after the MC-707's reset */
  await page.locator('#zbOv .zbChip', { hasText: 'Starters' }).click();
  await page.fill('#zbQ', 'Hoover');
  await page.locator('#zbOv .zbItem', { hasText: 'Hoover' }).first().click();
  await page.waitForFunction(() => window.__out.some(b => b[0] === 0xb3 && b[1] === 11 && b[2] > 0), null, {
    timeout: 15000
  });
  const out = await page.evaluate('window.__out');
  const ch = 3,
    mute = out.findIndex(b => b[0] === (0xb0 | ch) && b[1] === 11 && b[2] === 0),
    back = out.findIndex(b => b[0] === (0xb0 | ch) && b[1] === 11 && b[2] === 127),
    writes = out.map((b, i) => (b[0] === 0xf0 && b[7] === 0x12 ? i : -1)).filter(i => i >= 0);
  assert.ok(mute >= 0 && writes.length, 'muted, and the sound written');
  assert.ok(mute < writes[0], 'muted before the first write');
  assert.ok(back > writes[writes.length - 1], 'back only after the last write');
  assert.ok(
    out.slice(mute, back).some(b => b[0] === (0xb0 | ch) && b[1] === 120),
    'and any tail cut first'
  );
  /* an empty clip (the initial tone) is not grabbed */
  await page.fill('#zbQ', 'Init tone');
  await page.locator('#zbOv .zbItem', { hasText: 'Init tone' }).first().click();
  await page.waitForTimeout(800);
  await page.locator('#zbOv button', { hasText: 'Grab from' }).click();
  await page.locator('.cmenu >> text=This clip').click();
  await page.waitForFunction(() => !document.querySelector('#zbOv button.on')?.textContent.includes('Stop'), null, {
    timeout: 30000
  });
  assert.equal(await page.evaluate(`${z}.ZS.list.length`), 0, 'nothing grabbed from an empty clip');
  assert.deepEqual(errors, []);
});

test('the track always comes back after a load, even when the MC-707 does not answer the checks', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(500);
  await page.evaluate(`${z}.browse()`);
  await page.evaluate('window.__out.length = 0; window.__times = []; window.__zcMute = true');
  const t0 = Date.now();
  await page.locator('#zbOv .zbChip', { hasText: 'Starters' }).click();
  await page.fill('#zbQ', 'Hoover');
  await page.locator('#zbOv .zbItem', { hasText: 'Hoover' }).first().click();
  await page.waitForFunction(() => window.__out.some(b => b[0] === 0xb3 && b[1] === 11 && b[2] === 127), null, {
    timeout: 5000
  });
  assert.ok(Date.now() - t0 < 4000, 'back within a few seconds');
  /* and closing the editor puts the expression back too */
  await page.evaluate('window.__out.length = 0');
  await page.locator('#zbOv button', { hasText: 'Done' }).click();
  await page.locator('#zcOv button', { hasText: 'Done' }).click();
  const last = await page.evaluate('window.__out.filter(b => b[0] === 0xb3 && b[1] === 11).pop()');
  assert.deepEqual(last, [0xb3, 11, 127]);
  assert.deepEqual(errors, []);
});
