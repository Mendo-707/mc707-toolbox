// MC-707 › Template builder: a track layout with a sound in every clip, saved as an MC-707 project. Without
// factory sounds the starters fill the tone tracks; with them (stand-ins here: no Roland file is in the
// repo) the drum tracks get kits, no clip repeats a sound, and the project holds the layout, each clip's
// name and Sound Source CLIP on every track.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const openBuilder = async page => {
  await page.locator('#menubar .mb', { hasText: 'MC-707' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Template builder' }).click();
  await page.locator('#tbOv .tbRow').first().waitFor();
};

test('Template builder: without factory sounds, the starters fill the tone tracks', async () => {
  const { page, errors } = await openApp();
  await openBuilder(page);
  assert.ok(await page.locator('#tbOv .tbWarn').isVisible(), 'says where the factory sounds come from');
  assert.ok(await page.locator('#tbOv label', { hasText: 'Starters' }).locator('input').isChecked());
  const r = await page.evaluate(async () => {
    const A = window.__app,
      m = await A.tpl.bytes();
    return { clips: m.clips, read: A.tpl.read(m.bytes) };
  });
  assert.ok(r.clips >= 20, 'tone clips: ' + r.clips);
  assert.deepEqual(
    r.read.map(t => t.kind),
    ['drum', 'drum', 'drum', 'tone', 'tone', 'tone', 'tone', 'tone']
  );
  assert.ok(
    r.read.slice(0, 3).every(t => t.clips.every(c => c === null)),
    'no kits without the factory sounds'
  );
  assert.ok(r.read[3].clips.filter(Boolean).length > 0);
  assert.deepEqual(errors, []);
});

test('Template builder: a layout of kits and tones, every clip its own sound, saved as an MC-707 project', async () => {
  const { page, errors } = await openApp();
  /* the Sound library loaded first (opening the builder does), then stand-in factory sounds: kits and
     30 tones in each part's category (70 kits: the MC-707 has 132) */
  await openBuilder(page);
  await page.locator('#tbOv button', { hasText: 'Close' }).click();
  await page.evaluate(() => {
    const { ZS, fw } = window.__app.zen,
      KIT = 0xd00,
      INST = 216,
      name = (b, o, s) => [...s.padEnd(16)].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
    const b = new Uint8Array(4096 + 2 * INST + 512 + 71 * KIT + 512).fill(0xff),
      table = 4096,
      kits = table + 2 * INST + 512;
    ['Off', 'Kick A'].forEach((n, i) => {
      b.fill(i, table + i * INST, table + (i + 1) * INST);
      name(b, table + i * INST, n);
    });
    for (let k = 0; k < 71; k++) {
      const o = kits + k * KIT;
      b.fill(0, o, o + KIT);
      name(b, o, k === 70 ? 'INIT KIT' : 'Test Kit ' + k);
      b[o + 0xa0 + 21 * 20] = 1;
    }
    for (const k of fw.fwKits(b)) ZS.list.push({ ...k, id: 'f:' + k.name, kind: 'kit', src: 'factory' });
    const cats = { 'Synth Bass': 21, 'E.Piano1': 4, 'Synth Pad/Str': 36, 'Synth Lead': 34, 'Synth Seq/Pop': 40 };
    for (const [cat, n] of Object.entries(cats))
      for (let i = 0; i < 30; i++)
        ZS.list.push({
          id: 'f:' + cat + i,
          name: cat.slice(0, 9) + ' T' + i,
          kind: 'tone',
          src: 'factory',
          d: { 'CMN.NAME': cat.slice(0, 9) + ' T' + i, 'CMN.CATEGORY': n }
        });
    window.__app.tpl.TB.tracks.forEach(x => (x.names = []));
  });
  await openBuilder(page);
  assert.equal(await page.locator('#tbOv .tbWarn').count(), 0, 'factory sounds are in');
  /* 4 drum + 4 tone */
  await page.locator('#tbOv select[aria-label="Track layout"]').selectOption('4+4');
  await page.locator('#tbOv input[aria-label="Project name"]').fill('my kit test');
  const r = await page.evaluate(async () => {
    const A = window.__app,
      m = await A.tpl.bytes();
    return { clips: m.clips, read: A.tpl.read(m.bytes) };
  });
  assert.equal(r.clips, 128, 'all 16 clips on all 8 tracks');
  assert.deepEqual(
    r.read.map(t => t.kind),
    ['drum', 'drum', 'drum', 'drum', 'tone', 'tone', 'tone', 'tone']
  );
  assert.ok(
    r.read.every(t => t.src === 1),
    'Sound Source CLIP on every track'
  );
  for (const t of r.read) assert.equal(new Set(t.clips).size, 16, 'no sound twice on a track');
  const tones = r.read.slice(4).flatMap(t => t.clips);
  assert.equal(new Set(tones).size, 64, 'no tone on two tracks');
  assert.match(r.read[4].clips[0], /bas/i, 'the bass track gets basses');

  /* one sound on a track, fewer clips */
  await page.locator('#tbOv .tbRow').nth(5).locator('select').nth(1).selectOption('4');
  await page.locator('#tbOv .tbRow').nth(5).locator('label.tbSame input').check();
  const one = await page.evaluate(async () => window.__app.tpl.read((await window.__app.tpl.bytes()).bytes)[5].clips);
  assert.equal(one.filter(Boolean).length, 4);
  assert.equal(new Set(one.filter(Boolean)).size, 1);

  /* Save: the file goes where you pick (the MC-707's drive), and the app's Track setup follows */
  await page.evaluate(() => {
    window.__saved = null;
    window.showSaveFilePicker = async o => ({
      name: o.suggestedName,
      createWritable: async () => ({ write: async b => (window.__saved = b.length), close: async () => {} })
    });
  });
  await page.locator('#tbOv button', { hasText: 'Save to the MC-707' }).click();
  /* the app's song has clips on a track that becomes a drum track: it asks first */
  await page.locator('button', { hasText: 'Change and remove them' }).click();
  await page.locator('text=Saved MY KIT TEST.mpj').waitFor();
  const after = await page.evaluate(() => ({ saved: window.__saved, types: window.__app.S.tracks.map(t => t.type) }));
  assert.ok(after.saved > 8e6, 'the whole project written');
  assert.deepEqual(after.types, ['drum', 'drum', 'drum', 'drum', 'tone', 'tone', 'tone', 'tone']);
  assert.deepEqual(errors, []);
});
