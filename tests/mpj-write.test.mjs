// Save as MC-707 project (scene/save-mpj.js, core/mpj-write.js): File › Save as MC-707 project makes a project
// file from Roland's empty project for the Track setup with the song's name, tempo, clips and scenes (the
// chain on, stopping on the last), which reads back (core/mpj.js) with every clip's notes as Scene Mode would
// write them over USB.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

test('Save as MC-707 project: the song’s clips, scenes, name and tempo, read back from the file', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-song-mode-v1': readFixture('song-v0.10.json') } });
  await page.locator('#menubar .mb', { hasText: 'File' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Save as MC-707 project' }).click();
  const ask = page.locator('[role=dialog]', { hasText: 'Save as MC-707 project' });
  await ask.waitFor();
  assert.match(await ask.textContent(), /\d+ clips and \d+ scenes from the song/);
  await ask.locator('input').fill('Test Song 1');
  const [dl] = await Promise.all([page.waitForEvent('download'), ask.locator('button', { hasText: 'Save' }).click()]);
  assert.equal(dl.suggestedFilename(), 'Test Song 1.mpj');
  const file = await dl.path();
  const b64 = fs.readFileSync(file).toString('base64');
  await page.locator('[role=dialog]', { hasText: 'Saved Test Song 1.mpj' }).waitFor();
  const r = await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const a = window.__app,
      back = a.mpj.read(bytes),
      song = a.mpj.song('Test Song 1');
    const notesIn = c => c.slots.reduce((n, s) => n + s.length, 0);
    return {
      size: bytes.length,
      name: back.name,
      bpm: back.bpm,
      wantBpm: a.S.bpm,
      kinds: back.tracks.map(t => t.kind),
      wantKinds: a.S.tracks.map(t => (t.type === 'drum' ? 'drum' : 'tone')),
      clips: song.clips.map(c => [c.t, c.k, c.size, c.steps, notesIn(c)].join()),
      backClips: song.clips.map(c => {
        const b = back.tracks[c.t].clips[c.k];
        return [c.t, c.k, b.size, b.steps, b.notes].join();
      }),
      scenes: song.scenes.map((s, i) => [i === song.scenes.length - 1 ? 0 : s.bars, ...s.pick].join()),
      backScenes: back.scenes.slice(0, song.scenes.length).map(s => [s.bars, ...s.pick].join()),
      lost: song.lost,
      chain: back.chain,
      /* each clip's header as the MC-707 saves a recorded clip (FF in an empty one, which shows no clip) */
      headers: song.clips.map(c => {
        const b = 0xa0 + 0x10f0 + (c.t * 17 + c.k) * 0x5c40,
          drum = back.tracks[c.t].kind === 'drum';
        return [
          bytes[b + 0x12] === (drum ? 1 : 0),
          bytes[b + 0xac] === 9,
          bytes[b + 0xf4] === (drum ? 12 : 160)
        ].join();
      })
    };
  }, b64);
  assert.equal(r.size, 8153568, 'a whole MC-707 project');
  assert.equal(r.name, 'Test Song 1');
  assert.equal(r.bpm, r.wantBpm);
  assert.deepEqual(r.kinds, r.wantKinds, 'the Track setup’s drum and tone tracks');
  assert.ok(r.clips.length > 3, 'clips went in (' + r.clips.length + ')');
  assert.deepEqual(r.backClips, r.clips, 'every clip reads back with its step size, steps and notes');
  assert.deepEqual(r.backScenes, r.scenes, 'the scenes: clips picked and chain lengths, the last OFF');
  assert.equal(r.chain, true, 'the scene chain is on');
  for (const h of r.headers) assert.equal(h, 'true,true,true', 'every clip has its header, so the MC-707 sees a clip');
  assert.deepEqual(errors, []);
});

test('Save as MC-707 project: Scene Mode’s clip tones go in their slots, the track playing its clips’ sounds', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-song-mode-v1': readFixture('song-v0.10.json') } });
  const r = await page.evaluate(async () => {
    const A = window.__app,
      made = A.scene.fromSong();
    A.scene.setMode('scene');
    A.scene.edit(q => ((q.rows = made.rows), (q.clips = made.clips)));
    const t = A.S.tracks.findIndex((x, i) => x.type !== 'drum' && made.clips[i] && made.clips[i][0]);
    A.scene.setTone(t, 0, { name: 'Scene Lead', kind: 'tone', d: { 'CMN.NAME': 'Scene Lead', 'CMN.LEVEL': 90 } });
    const { bytes } = await A.mpj.bytes('Tones'),
      P = 0xa0,
      slot = s => P + 0x3178f0 + t * 0x6c60 + s * 0x660,
      name = at => String.fromCharCode(...bytes.subarray(at, at + 16)).trim(),
      other = A.S.tracks.findIndex((x, i) => i !== t && x.type !== 'drum');
    return {
      clip: name(slot(1)),
      level: bytes[slot(1) + 20],
      own: name(slot(0)),
      source: bytes[P + 0x200 + t * 0x100 + 0x15],
      otherSource: bytes[P + 0x200 + other * 0x100 + 0x15],
      otherOwn: name(P + 0x3178f0 + other * 0x6c60),
      otherClip: name(P + 0x3178f0 + other * 0x6c60 + 0x660)
    };
  });
  assert.equal(r.clip, 'Scene Lead', 'clip 1’s tone in its slot (k + 1)');
  assert.equal(r.level, 90, 'with its values');
  assert.equal(r.own, 'Scene Lead', 'and as the track’s own sound');
  assert.equal(r.source, 1, 'the track plays its clips’ sounds (Sound Source CLIP)');
  assert.equal(r.otherSource, 1, 'every track with clips plays its clips’ sounds');
  assert.equal(r.otherOwn, 'JD-800 Piano', 'a track with no tones keeps the template’s sound');
  assert.equal(r.otherClip, 'JD-800 Piano', 'and its clips get it, so none is silent');
  assert.deepEqual(errors, []);
});

test('Save as MC-707 project: a factory kit on a drum clip goes in its slot, record and keys', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-song-mode-v1': readFixture('song-v0.10.json') } });
  const r = await page.evaluate(async () => {
    const A = window.__app,
      made = A.scene.fromSong();
    A.scene.setMode('scene');
    A.scene.edit(q => ((q.rows = made.rows), (q.clips = made.clips)));
    const t = A.S.tracks.findIndex((x, i) => x.type === 'drum' && made.clips[i] && made.clips[i][0]);
    const rec = new Uint8Array(0xd00);
    [...'Test Kit'.padEnd(16)].forEach((c, i) => (rec[i] = c.charCodeAt(0)));
    rec[0xa0 + 21 * 20] = 1;
    const inst = n => btoa(String.fromCharCode(...[...(n.padEnd(16) + ' '.repeat(200))].map(c => c.charCodeAt(0))));
    const b64 = u => btoa(String.fromCharCode(...u));
    A.scene.setTone(t, 0, {
      name: 'Test Kit',
      kind: 'kit',
      d: { 'KCMN.NAME': 'Test Kit' },
      mpj: { rec: b64(rec), inst: { 0: inst('Off'), 1: inst('Test Kick') } }
    });
    const { bytes, song } = await A.mpj.bytes('Kits'),
      P = 0xa0,
      name = at => String.fromCharCode(...bytes.subarray(at, at + 16)).trim(),
      kit = s => P + 0x3545f0 + t * 0xdd00 + s * 0xd00,
      keys = s => P + 0x4001f0 + t * 0x4ee40 + s * 0x4a40;
    return {
      kit: name(kit(1)),
      own: name(kit(0)),
      key0: name(keys(1)),
      key21: name(keys(1) + 21 * 216),
      source: bytes[P + 0x200 + t * 0x100 + 0x15],
      lost: song.lost,
      /* a reload keeps the kit's bytes */
      kept: !!Object.values(A.S.scn.tones).find(x => x.kind === 'kit').mpj
    };
  });
  assert.equal(r.kit, 'Test Kit', 'clip 1’s kit record in its slot (k + 1)');
  assert.equal(r.own, 'Test Kit', 'and as the track’s own kit');
  assert.deepEqual([r.key0, r.key21], ['Off', 'Test Kick'], 'each key’s instrument copied in');
  assert.equal(r.source, 1, 'the drum track plays its clips’ sounds');
  assert.deepEqual(r.lost, []);
  assert.ok(r.kept, 'Scene Mode keeps the kit’s bytes');
  assert.deepEqual(errors, []);
});
