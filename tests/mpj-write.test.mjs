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
      chain: back.chain
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
  assert.deepEqual(errors, []);
});
