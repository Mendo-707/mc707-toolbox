// Reading an MC-707 project file (core/mpj.js, ui/mpj-open.js): a project made here in the layout the
// MC-707 saves (sections, tempo, track kinds, clip steps, a sample), shown, its clips brought into Scene
// Mode, and its sample as a WAV.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* a small project: 95 BPM, track 1 drum with a kick on steps 1 and 9 of a 16-step clip 2, track 4 tone with
   C4 held 2 steps in clip 1 (32 steps), track 5 a looper, and one mono sample */
function makeProject() {
  const PRJ = 6504592,
    at = 160,
    usd = at + PRJ,
    smp = 64,
    size = 0x30 + 0x30 + 1024,
    lpd = usd + size,
    lsize = 16 + 4112 + 64 * 4,
    u8 = new Uint8Array(lpd + lsize),
    dv = new DataView(u8.buffer);
  const put = (o, s) => [...s].forEach((c, i) => (u8[o + i] = c.charCodeAt(0)));
  put(2, 'PRJ5');
  put(16, 'PRJaMC77');
  dv.setUint32(24, at, true);
  dv.setUint32(28, PRJ, true);
  put(32, 'USDaMC77');
  dv.setUint32(40, usd, true);
  dv.setUint32(44, size, true);
  put(48, 'LPDaMC77');
  dv.setUint32(56, lpd, true);
  dv.setUint32(60, lsize, true);
  put(64, 'DUMYMC77');
  /* a looper recording in track 5's clip 2 (entry 4 × 16 + 1): 64 samples, 32-bit mono, a ramp */
  put(lpd + 16, 'DIK0');
  dv.setUint32(lpd + 16 + 16 + 65 * 16, 64 * 4, true);
  dv.setUint32(lpd + 16 + 16 + 65 * 16 + 4, 4112, true);
  for (let i = 0; i < 64; i++)
    dv.setUint32(lpd + 16 + 4112 + i * 4, (i < 32 ? 0x80000000 : 0) + Math.abs(i - 32) * 0x2000000, true);
  put(at + 0x10, 'Test Song       ');
  dv.setUint16(at + 0x20, 9500, true);
  /* scenes as a new project has them (scene n plays clip n, kept 1-16 in each track's block at +90),
     but scene 1 plays clip 2 on track 1 and is 4 bars long; scene 2-2 (the 18th) plays the bass */
  for (let sc = 0; sc < 8; sc++) for (let t = 0; t < 8; t++) u8[at + 0x200 + t * 0x100 + 0x90 + sc] = sc + 1;
  u8[at + 0x200 + 0x90] = 2;
  u8[at + 0x50] = 4;
  u8[at + 0x200 + 3 * 0x100 + 0x90 + 17] = 1;
  u8[at + 0x50 + 17] = 8;
  /* the MV-1's 8 scenes at +D0 stay as a new project has them, unused */
  for (let sc = 0; sc < 8; sc++) for (let t = 0; t < 8; t++) u8[at + 0xd0 + sc * 8 + t] = sc;
  const kinds = [1, 1, 1, 0, 2, 0, 0, 0];
  kinds.forEach((k, t) => (u8[at + 0x214 + t * 0x100] = k));
  const clip = (t, k) => at + 0x10f0 + (t * 17 + k) * 0x5c40;
  for (let t = 0; t < 8; t++)
    for (let k = 0; k < 17; k++) {
      const b = clip(t, k);
      u8[b + 0x300] = 1;
      u8[b + 0x301] = 16;
      for (let s = 0; s < 128; s++) u8.fill(0xff, b + 0x3d0 + s * 0x60, b + 0x3d0 + s * 0x60 + 16);
    }
  put(clip(0, 16), 'TEST KIT');
  put(clip(3, 0), 'SUB BASS 1');
  const note = (b, s, j, n, v, end) => {
    const o = b + 0x3d0 + s * 0x60;
    u8[o + j] = n;
    u8[o + 0x10 + j] = v;
    u8[o + 0x30 + j] = end;
  };
  note(clip(0, 1), 0, 0, 36, 110, 50);
  note(clip(0, 1), 8, 0, 36, 90, 50);
  u8[clip(3, 0) + 0x301] = 32;
  note(clip(3, 0), 0, 0, 60, 100, 100);
  note(clip(3, 0), 1, 0, 60, 100, 100);
  note(clip(3, 0), 2, 0, 60, 100, 10);
  /* the sample */
  put(usd + 0x10, 'SMPh');
  put(usd + 0x30, 'SMPd');
  dv.setUint16(usd + 0x34, 0x30, true);
  dv.setUint16(usd + 0x36, 1, true);
  dv.setUint32(usd + 0x38, 1024, true);
  dv.setUint32(usd + 0x3c, smp, true);
  put(usd + 0x40, 'Hit.wav');
  dv.setUint32(usd + 0x54, 44100, true);
  for (let i = 0; i < smp; i++) dv.setInt16(usd + 0x60 + i * 2, i < 32 ? 16000 : -16000, true);
  return u8;
}

test('MC-707 project file: read, shown, clips into Scene Mode, samples as WAV', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(src => {
    const u8 = new Function('return (' + src + ')()')();
    const m = window.__app.mpj.read(u8);
    window.__mpj = u8;
    return {
      name: m.name,
      bpm: m.bpm,
      kinds: m.tracks.map(t => t.kind),
      sound: m.tracks[0].sound,
      clip: m.tracks[3].clips[0] && [
        m.tracks[3].clips[0].sound,
        m.tracks[3].clips[0].steps,
        m.tracks[3].clips[0].notes
      ],
      kick: m.tracks[0].clips[1].slots[8],
      samples: m.samples.map(s => [s.name, s.channels, s.count, s.rate]),
      loops: m.loops.map(l => [l.track, l.clip, l.bytes]),
      loop: Array.from(window.__app.mpj.loopAudio(u8, m.loops[0])[0].slice(30, 34)),
      scenes: m.scenes.slice(0, 2),
      scene18: m.scenes[17].pick[3],
      bad: window.__app.mpj.read(new Uint8Array(100)).error
    };
  }, makeProject.toString());
  assert.equal(r.name, 'Test Song');
  assert.equal(r.bpm, 95);
  assert.deepEqual(r.kinds, ['drum', 'drum', 'drum', 'tone', 'looper', 'tone', 'tone', 'tone']);
  assert.equal(r.sound, 'TEST KIT');
  assert.deepEqual(r.clip, ['SUB BASS 1', 32, 3]);
  assert.deepEqual(r.kick, [{ note: 36, vel: 90, start: 0, end: 50, sub: 0 }]);
  assert.deepEqual(r.samples, [['Hit.wav', 1, 64, 44100]]);
  assert.deepEqual(r.loops, [[4, 1, 256]], 'the looper recording in track 5 clip 2');
  assert.deepEqual(r.loop, [-0.03125, -0.015625, 0, 0.015625], '32-bit mono samples, sign and magnitude');
  assert.deepEqual(r.scenes, [
    { pick: [1, 0, 0, 0, 0, 0, 0, 0], bars: 4 },
    { pick: [1, 1, 1, 1, 1, 1, 1, 1], bars: 0 }
  ]);
  assert.equal(r.scene18, 0, 'scene 2-2 plays the bass clip 1');
  assert.match(r.bad, /not an MC-707 project/);
  /* the window */
  await page.evaluate(() => window.__app.mpj.open(window.__mpj, 'Test.mpj'));
  const text = await page.textContent('#mpjOv');
  assert.match(text, /MC-707 project: Test Song/);
  assert.match(text, /95 BPM · 2 clips with notes · 1 sample/);
  assert.match(text, /Looper track/);
  assert.match(text, /Looper recordings\s*▶\s*Track 5 · clip 2/);
  assert.equal(
    await page.locator('#mpjOv .mpjScn').count(),
    18,
    'scenes 1-1 to 2-2, the last that plays a clip with notes'
  );
  assert.match(await page.locator('#mpjOv .mpjScn').first().textContent(), /4 bars/);
  /* the sample saves as a WAV */
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#mpjOv .mpjSmp', { hasText: 'Hit' }).locator('button', { hasText: 'Save WAV' }).click()
  ]);
  assert.equal(dl.suggestedFilename(), '01 Hit.wav');
  /* into Scene Mode */
  await page.click('#mpjOv button:has-text("Bring the clips into Scene Mode")');
  await page.waitForFunction(() =>
    /Brought in 2 clips and 18 scenes from Test Song at 95 BPM/.test(document.getElementById('toast').textContent)
  );
  const got = await page.evaluate(() => {
    const S = window.__app.S,
      p = k => S.patterns[S.scn.clips[k[0]][k[1]].pat];
    return {
      bpm: S.bpm,
      kick: p([0, 1]).notes.map(n => [n.s, n.n, n.v]),
      bass: [p([3, 0]).bars, p([3, 0]).notes.map(n => [n.s, n.n, Math.round(n.l * 100) / 100])],
      name: S.tracks[0].name,
      rows: S.scn.rows.map(r => [r.name, r.bars, r.pick.join()]),
      mode: document.body.dataset.mode
    };
  });
  assert.equal(got.bpm, 95);
  assert.deepEqual(
    got.kick,
    [
      [0, 0, 110],
      [8, 0, 90]
    ],
    'kick on lane 1 at steps 1 and 9'
  );
  assert.deepEqual(got.bass, [2, [[0, 60, 2.1]]], 'one C4 tied over two steps and a bit, in a 2-bar clip');
  assert.equal(got.name, 'TEST KIT');
  assert.equal(got.rows.length, 18);
  assert.deepEqual(
    got.rows.slice(0, 2),
    [
      ['Scene 1-1', 4, '1,-1,-1,0,-1,-1,-1,-1'],
      ['Scene 1-2', 1, '1,-1,-1,-1,-1,-1,-1,-1']
    ],
    'its chain length, or its longest clip when OFF'
  );
  assert.deepEqual(got.rows[17], ['Scene 2-2', 8, '-1,-1,-1,0,-1,-1,-1,-1']);
  assert.equal(got.mode, 'scene');
  assert.deepEqual(errors, []);
});
