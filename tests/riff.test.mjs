// Loop rec (live/riff.js): choose the track and length, ● Rec waits for the next bar (or counts in a bar),
// records what is played (snapped to the timing chosen) into a take, and leaves the set as it was; ▶ Play puts
// the take on its track from the next bar, exactly as played (chord lock and variations leave it), ★ makes the
// scene keep it, ■ Back brings the set's own part back. From a keyboard or the MC-707's own keys (the track
// played first, with "The track I play"). Cancel, or playing nothing, makes no take.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

const SAVED = {
  'mc707-song-mode-v1': readFixture('song-v0.10.json'),
  'mc707-live': readFixture('live-settings-v0.10.json')
};
/* Live Mode with a keyboard, the clock run by hand (what you hear is what the scheduler has reached) */
async function setUp(storage) {
  const { page, errors } = await openApp({ storage });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#lvMidi').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const a = window.__app;
    a.LV.auto = false;
    a.liveStart(0);
    a.TICKER.stop();
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
    window.__step = n => {
      for (let i = 0; i < n; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    window.__to = t => {
      while (a.TR.tick < t) window.__step(1);
    };
    window.__pick = (label, v) => {
      const s = [...document.querySelectorAll('.riffPanel select')].find(x => x.getAttribute('aria-label') === label);
      s.value = String(v);
      s.dispatchEvent(new Event('change'));
    };
    window.__btn = txt =>
      [...document.querySelectorAll('.riffPanel button')].find(b => b.textContent.trim().startsWith(txt));
  });
  return { page, errors };
}

test('Loop rec: a take from the keyboard leaves the set alone until ▶ Play, then plays as played', async () => {
  const { page, errors } = await setUp(SAVED);
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV;
    __step(40);
    /* a melody track that is playing a part */
    const T = [6, 7, 4, 5, 3].find(t => LV.voices[t][0]);
    __pick('Record to', T);
    __pick('Length', 2);
    const before = LV.voices[T][0].f.id;
    __btn('● Rec').click();
    const waiting = document.querySelector('.riffStat').textContent;
    const base = LV.ctl.base,
      key = d => base + 24 + d;
    const play = (d, at, len) => {
      __to(64 + at);
      window.__key([0x90, key(d), 100]);
      __step(len);
      window.__key([0x80, key(d), 0]);
    };
    play(0, 0, 4);
    const recording = document.querySelector('.riffStat').textContent;
    play(3, 7, 4);
    play(7, 16, 8);
    play(5, 32, 2);
    __to(64 + 64 + 1);
    const take = document.querySelector('.riffTakes li');
    const left = LV.voices[T][0] ? LV.voices[T][0].f.id : null;
    /* ▶ Play: from the next bar */
    __btn('▶ Play').click();
    const cued = __btn('Next bar') ? true : false;
    __to(Math.ceil((a.TR.tick + 2) / 32) * 32 + 1);
    const v = LV.voices[T][0];
    const sounded = [];
    const i = window.__out.length;
    __step(64);
    const ch = a.S.tracks[T].ch - 1;
    for (const b of window.__out.slice(i)) if (b[0] === (0x90 | ch) && b[2] > 0) sounded.push(b[1] - key(0));
    /* ★: the scene keeps it; ■ Back: the set's own part from the next bar */
    __btn('★').click();
    const kept = LV.scenes[LV.cur].cells[T].id === v.f.id;
    __btn('■ Back').click();
    __to(Math.ceil((a.TR.tick + 2) / 32) * 32 + 1);
    const back = LV.voices[T][0] && LV.voices[T][0].f.id;
    a.stopAll();
    return {
      waiting,
      recording,
      take: take && take.textContent,
      unchanged: left === before,
      name: a.S.tracks[T].name,
      cued,
      riff: !!(v && v.f.riff),
      notes: v && v.f.notes.map(n => [n.s, n.l, n.n - key(0)]),
      sounded: [...new Set(sounded)].sort((x, y) => x - y),
      kept,
      back: back === before
    };
  });
  assert.match(r.waiting, /next bar/i);
  assert.match(r.recording, new RegExp('Recording ' + r.name + ': bar 1 of 2'));
  assert.match(r.take, new RegExp('Take 1.*' + r.name + ' · 2 bars'));
  assert.equal(r.unchanged, true, 'the set is left as it was');
  assert.equal(r.cued, true, '▶ Play waits for the next bar');
  assert.equal(r.riff, true, 'then the take plays on its track');
  assert.deepEqual(r.notes, [
    [0, 2, 0],
    [4, 2, 3],
    [8, 4, 7],
    [16, 1, 5]
  ]);
  assert.deepEqual(r.sounded, [0, 3, 5, 7], 'exactly as played');
  assert.equal(r.kept, true, '★ the scene keeps it');
  assert.equal(r.back, true, '■ Back brings the set’s own part back');
  assert.deepEqual(errors, []);
});

test('Loop rec: count-in, 8ths, play straight away; cancel or nothing played makes no take', async () => {
  const { page, errors } = await setUp(SAVED);
  /* Settings › Loop rec */
  await page.evaluate(() => {
    document.querySelector('#lvSetDet').open = true;
  });
  const set = page.locator('#lvSetBody');
  await set.locator('select[aria-label="Timing"]').selectOption('8');
  await set.locator('select[aria-label="Recording starts"]').selectOption('count');
  await set.locator('label', { hasText: 'Play a take straight away' }).locator('input').check();
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV;
    __pick('Record to', 6);
    __pick('Length', 1);
    __step(8);
    const was = LV.voices[6][0] && LV.voices[6][0].f.id;
    /* cancel, then nothing played */
    __btn('● Rec').click();
    __btn('■ Cancel').click();
    __step(32 * 3);
    const afterCancel = LV.voices[6][0] && LV.voices[6][0].f.id;
    const t0 = Math.ceil((a.TR.tick + 4) / 32) * 32;
    __btn('● Rec').click();
    const counting = document.querySelector('.riffStat').textContent;
    __to(t0 + 32 + 32 + 1);
    const afterEmpty = LV.voices[6][0] && LV.voices[6][0].f.id;
    /* counted in: recording starts a bar after the next bar line; a note a 16th late snaps to the 8th */
    const t1 = Math.ceil((a.TR.tick + 4) / 32) * 32;
    __btn('● Rec').click();
    const key = LV.ctl.base + 24;
    __to(t1 + 32 + 2);
    window.__key([0x90, key, 100]);
    __step(4);
    window.__key([0x80, key, 0]);
    __to(t1 + 64 + 1);
    const v = LV.voices[6][0];
    a.stopAll();
    return { was, afterCancel, afterEmpty, counting, straight: !!(v && v.f.riff), notes: v && v.f.notes.map(n => n.s) };
  });
  assert.equal(r.afterCancel, r.was);
  assert.equal(r.afterEmpty, r.was);
  assert.match(r.counting, /Count-in/);
  assert.equal(r.straight, true, 'plays straight away when set to');
  assert.deepEqual(r.notes, [2], 'a 16th late, snapped to the 8th');
  assert.deepEqual(errors, []);
});

test('Loop rec on the MC-707’s own keys: “The track I play” records the track played first', async () => {
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
    const pick = (label, v) => {
      const s = [...document.querySelectorAll('.riffPanel select')].find(x => x.getAttribute('aria-label') === label);
      s.value = String(v);
      s.dispatchEvent(new Event('change'));
    };
    pick('Record to', -1);
    pick('Length', 1);
    step(8);
    [...document.querySelectorAll('.riffPanel button')].find(b => /Rec/.test(b.textContent)).click();
    while (a.TR.tick < 32) step(1);
    /* the MC-707's keys on the pluck's channel, a note on each beat (above Raven mode's key and mute keys) */
    const ch = a.S.tracks[7].ch - 1;
    for (let b = 0; b < 4; b++) {
      while (a.TR.tick < 32 + b * 8) step(1);
      window.__inject([0x90 | ch, 84 + b * 2, 90]);
      step(2);
      window.__inject([0x80 | ch, 84 + b * 2, 0]);
    }
    while (a.TR.tick <= 32 + 32) step(1);
    const take = document.querySelector('.riffTakes li').textContent;
    a.stopAll();
    return {
      take,
      notes: JSON.parse(localStorage.getItem('mc707-live-riffs'))
        .pop()
        .notes.map(n => [n.s, n.n])
    };
  });
  assert.match(r.take, /Pluck/);
  assert.deepEqual(r.notes, [
    [0, 84],
    [4, 86],
    [8, 88],
    [12, 90]
  ]);
  assert.deepEqual(errors, []);
});
