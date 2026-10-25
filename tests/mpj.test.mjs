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
    u8 = new Uint8Array(usd + size),
    dv = new DataView(u8.buffer);
  const put = (o, s) => [...s].forEach((c, i) => (u8[o + i] = c.charCodeAt(0)));
  put(2, 'PRJ5');
  put(16, 'PRJaMC77');
  dv.setUint32(24, at, true);
  dv.setUint32(28, PRJ, true);
  put(32, 'USDaMC77');
  dv.setUint32(40, usd, true);
  dv.setUint32(44, size, true);
  put(48, 'DUMYMC77');
  put(at + 0x10, 'Test Song       ');
  dv.setUint16(at + 0x20, 9500, true);
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
  assert.match(r.bad, /not an MC-707 project/);
  /* the window */
  await page.evaluate(() => window.__app.mpj.open(window.__mpj, 'Test.mpj'));
  const text = await page.textContent('#mpjOv');
  assert.match(text, /MC-707 project: Test Song/);
  assert.match(text, /95 BPM · 2 clips with notes · 1 sample/);
  assert.match(text, /Looper track/);
  /* the sample saves as a WAV */
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#mpjOv .mpjSmp button:has-text("Save WAV")')
  ]);
  assert.equal(dl.suggestedFilename(), '01 Hit.wav');
  /* into Scene Mode */
  await page.click('#mpjOv button:has-text("Bring the clips into Scene Mode")');
  await page.waitForFunction(() =>
    /Brought in 2 clips from Test Song at 95 BPM/.test(document.getElementById('toast').textContent)
  );
  const got = await page.evaluate(() => {
    const S = window.__app.S,
      p = k => S.patterns[S.scn.clips[k[0]][k[1]].pat];
    return {
      bpm: S.bpm,
      kick: p([0, 1]).notes.map(n => [n.s, n.n, n.v]),
      bass: [p([3, 0]).bars, p([3, 0]).notes.map(n => [n.s, n.n, Math.round(n.l * 100) / 100])],
      name: S.tracks[0].name,
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
  assert.equal(got.mode, 'scene');
  assert.deepEqual(errors, []);
});
