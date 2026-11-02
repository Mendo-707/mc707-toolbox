// Loop your own riff (live/riff.js): Record riff waits for the next bar, records what is played on the solo
// track for the bars chosen (snapped to 16ths), then the riff loops on that track at once, exactly as played
// (chord lock leaves it), the scene keeps it, and it is kept for next time; from a keyboard's solo track or
// the MC-707's own keys (the track played first). Cancel leaves the part as it was.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

const SAVED = {
  'mc707-song-mode-v1': readFixture('song-v0.10.json'),
  'mc707-live': readFixture('live-settings-v0.10.json')
};

test('Record riff: two bars played on the keyboard loop as the track’s part, as played', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#lvMidi').click());
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    LV.auto = false;
    LV.ctl.soloT = 6;
    a.liveStart(0);
    a.TICKER.stop();
    /* what you hear is what the scheduler has reached (no look-ahead here) */
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
    const step = n => {
      for (let i = 0; i < n; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    step(40);
    const btn = () => document.querySelector('#lvCtlBar .riffBtn');
    const idle = btn().textContent;
    btn().click();
    const armed = btn().textContent;
    /* up to the next bar line, where recording starts */
    while (a.TR.tick < 64) step(1);
    const base = LV.ctl.base,
      key = d => base + 24 + d;
    /* four notes: on the 1st 16th, the 5th (a touch early), the 9th held a beat, the 2nd bar's first */
    const play = (d, at, len) => {
      while (a.TR.tick < 64 + at) step(1);
      window.__key([0x90, key(d), 100]);
      step(len);
      window.__key([0x80, key(d), 0]);
    };
    play(0, 0, 4);
    const recording = btn().textContent;
    play(3, 7, 4);
    play(7, 16, 8);
    play(5, 32, 2);
    const sounded = [];
    let i;
    while (a.TR.tick <= 64 + 64) step(1);
    const v = LV.voices[6][0];
    /* the next two bars: what the lead plays now */
    i = window.__out.length;
    step(64);
    const ch = a.S.tracks[6].ch - 1;
    for (const b of window.__out.slice(i)) if (b[0] === (0x90 | ch) && b[2] > 0) sounded.push(b[1]);
    a.stopAll();
    return {
      idle,
      armed,
      recording,
      after: btn().textContent,
      riff: !!(v && v.f.riff),
      bars: v && v.f.bars,
      notes: v && v.f.notes.map(n => [n.s, n.l, n.n - key(0)]),
      kept: LV.scenes[LV.cur].cells[6] && LV.scenes[LV.cur].cells[6].id === v.f.id,
      stored: JSON.parse(localStorage.getItem('mc707-live-riffs') || '[]').length,
      sounded: [...new Set(sounded)].sort((x, y) => x - y).map(n => n - key(0))
    };
  });
  assert.match(r.idle, /Record riff/);
  assert.match(r.armed, /Next bar/);
  assert.match(r.recording, /Recording/);
  assert.match(r.after, /Record riff/);
  assert.equal(r.riff, true, 'the riff is the lead’s part');
  assert.equal(r.bars, 2);
  assert.deepEqual(
    r.notes,
    [
      [0, 2, 0],
      [4, 2, 3],
      [8, 4, 7],
      [16, 1, 5]
    ],
    'snapped to 16ths, lengths kept'
  );
  assert.equal(r.kept, true, 'the scene keeps it');
  assert.equal(r.stored, 1, 'kept for next time');
  assert.deepEqual(r.sounded, [0, 3, 5, 7], 'it plays exactly what was played');
  assert.deepEqual(errors, []);
});

test('Record riff: cancel leaves the part, nothing played makes no riff', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#lvMidi').click());
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV;
    LV.auto = false;
    LV.ctl.soloT = 6;
    a.liveStart(0);
    a.TICKER.stop();
    const step = n => {
      for (let i = 0; i < n; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    step(8);
    const was = LV.voices[6][0] && LV.voices[6][0].f.id;
    document.querySelector('#lvCtlBar .riffBtn').click();
    document.querySelector('#lvCtlBar .riffBtn').click();
    step(32 * 6);
    const afterCancel = LV.voices[6][0] && LV.voices[6][0].f.id;
    document.querySelector('#lvCtlBar .riffBtn').click();
    step(32 * 4);
    const afterEmpty = LV.voices[6][0] && LV.voices[6][0].f.id;
    a.stopAll();
    return { was, afterCancel, afterEmpty };
  });
  assert.equal(r.afterCancel, r.was);
  assert.equal(r.afterEmpty, r.was);
  assert.deepEqual(errors, []);
});

test('Record riff on the MC-707’s own keys: the track you play is the one that gets the riff', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    document.querySelector('[data-mode="live"]:not(body)').click();
    Object.assign(LV, { style: 'deephouse', seed: 2, custom: false, auto: false, perfOn: true });
    a.liveBuild();
    a.liveStart(0);
    a.TICKER.stop();
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
    const step = n => {
      for (let i = 0; i < n; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    step(8);
    const len = document.querySelector('.lvRiffRow .riffBars');
    len.value = '1';
    len.dispatchEvent(new Event('change'));
    document.querySelector('.lvRiffRow .riffBtn').click();
    while (a.TR.tick < 32) step(1);
    /* the MC-707's keys on the pluck's channel, a note on each beat (above Raven mode's key and mute keys) */
    const ch = a.S.tracks[7].ch - 1;
    for (let b = 0; b < 4; b++) {
      while (a.TR.tick < 32 + b * 8) step(1);
      window.__inject([0x90 | ch, 84 + b * 2, 90]);
      step(2);
      window.__inject([0x80 | ch, 84 + b * 2, 0]);
    }
    while (a.TR.tick <= 32 + 64) step(1);
    const v = LV.voices[7][0];
    a.stopAll();
    return { riff: !!(v && v.f.riff), notes: v && v.f.notes.map(n => [n.s, n.n]) };
  });
  assert.equal(r.riff, true, 'the pluck plays your riff');
  assert.deepEqual(r.notes, [
    [0, 84],
    [4, 86],
    [8, 88],
    [12, 90]
  ]);
  assert.deepEqual(errors, []);
});
