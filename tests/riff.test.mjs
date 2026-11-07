// Loop rec (live/riff.js), the whole flow: ● Rec (starting a stopped jam) counts down to a bar line, the REC
// badge shows, the track recorded to goes quiet while you play and your notes appear as you play them, then the
// take waits in a card (the set unchanged) until ▶ Play puts it on its track from the next bar, exactly as
// played; ★ makes the scene keep it, ■ Back brings the set's own part back. ■ Stop ends early (the shortest
// length that holds it), Cancel or playing nothing makes no take, playing another track says so, and each take's
// Quantize changes it from the notes as played.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

const SAVED = {
  'mc707-song-mode-v1': readFixture('song-v0.10.json'),
  'mc707-live': readFixture('live-settings-v0.10.json')
};
/* Live Mode with a keyboard (FLkey from the saved settings); the clock run by hand, what you hear being what
   the scheduler has reached; started unless `stopped` */
async function setUp(storage, stopped) {
  const { page, errors } = await openApp({ storage });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#lvMidi').click());
  await page.waitForTimeout(300);
  await page.evaluate(stopped => {
    const a = window.__app;
    a.LV.auto = false;
    a.ensureAudio();
    if (!stopped) a.liveStart(0);
    a.TICKER.stop();
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
    window.__step = n => {
      for (let i = 0; i < n; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    window.__to = t => {
      if (a.TICKER.stop) a.TICKER.stop();
      while (a.TR.tick < t) window.__step(1);
    };
    window.__pick = (label, v) => {
      const s = [...document.querySelectorAll('.riffPanel select')].find(x => x.getAttribute('aria-label') === label);
      s.value = String(v);
      s.dispatchEvent(new Event('change'));
    };
    window.__btn = txt =>
      [...document.querySelectorAll('.riffPanel button')].find(b => b.textContent.trim().startsWith(txt));
    window.__card = () => {
      const c = document.querySelector('.riffCard');
      return c ? c.className.replace('riffCard', '').trim() + ': ' + c.querySelector('.riffStat').textContent : '';
    };
    window.__key0 = () => a.LV.ctl.base + 24;
    window.__play = (d, at, len) => {
      __to(at);
      window.__key([0x90, __key0() + d, 100]);
      __to(at + len);
      window.__key([0x80, __key0() + d, 0]);
    };
  }, !!stopped);
  return { page, errors };
}
const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));

test('Loop rec: from a stopped jam, counts in, records with the track quiet, then the take waits for ▶ Play', async () => {
  const { page, errors } = await setUp(SAVED, true);
  await page.evaluate(() => {
    __pick('Record to', 6);
    __pick('Length', 2);
    __btn('● Rec').click();
    __to(8);
  });
  await frame(page);
  const wait = await page.evaluate(() => ({
    card: __card(),
    playing: window.__app.TR.playing,
    badge: document.querySelector('#lvRecBadge').textContent
  }));
  assert.equal(wait.playing, true, '● Rec starts the jam');
  assert.match(wait.card, /^wait: Get ready: recording Lead in 3 beats/);
  assert.match(wait.badge, /REC in 3/);
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV,
      ch = a.S.tracks[6].ch - 1,
      start = 32;
    /* the app's own Lead notes while recording: none */
    const i0 = window.__out.length;
    __play(0, start, 4);
    const recCard = __card();
    __play(3, start + 8, 4);
    __play(7, start + 16, 8);
    __play(5, start + 32, 2);
    const ownNotes = window.__out
      .slice(i0)
      .filter(b => b[0] === (0x90 | ch) && b[2] > 0 && ![0, 3, 7, 5].includes(b[1] - __key0())).length;
    const shown = document.querySelectorAll('.riffStrip .rlNote').length;
    __to(start + 64 + 1);
    const done = __card();
    const set = LV.voices[6][0] ? LV.voices[6][0].f.riff : null;
    /* ▶ Play from the card: on the next bar */
    __btn('▶ Play').click();
    const cued = !!__btn('Next bar');
    __to(Math.ceil((a.TR.tick + 2) / 32) * 32 + 1);
    const v = LV.voices[6][0];
    const sounded = [];
    const i1 = window.__out.length;
    __step(64);
    for (const b of window.__out.slice(i1)) if (b[0] === (0x90 | ch) && b[2] > 0) sounded.push(b[1] - __key0());
    /* ★ the scene keeps it; ■ Back the set's own part from the next bar */
    __btn('★').click();
    const kept = LV.scenes[LV.cur].cells[6].id === v.f.id;
    __btn('■ Back').click();
    __to(Math.ceil((a.TR.tick + 2) / 32) * 32 + 1);
    const back = !(LV.voices[6][0] && LV.voices[6][0].f.riff);
    a.stopAll();
    return {
      recCard,
      ownNotes,
      shown,
      done,
      set,
      cued,
      notes: v && v.f.notes.map(n => [n.s, n.l, n.n - __key0()]),
      sounded: [...new Set(sounded)].sort((x, y) => x - y),
      kept,
      back
    };
  });
  assert.match(r.recCard, /^rec: Recording Lead: bar 1 of 2/);
  assert.equal(r.ownNotes, 0, 'the Lead’s own part is quiet while recording');
  assert.ok(r.shown >= 3, 'the notes show as they are played (' + r.shown + ')');
  assert.match(r.done, /^done: Take 1 is ready: 4 notes on Lead, 2 bars\. The set is unchanged\./);
  assert.notEqual(r.set, true, 'the set is left as it was');
  assert.equal(r.cued, true, '▶ Play waits for the next bar');
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

test('Loop rec: ■ Stop ends early, Cancel and nothing played make no take, Again, Discard', async () => {
  const { page, errors } = await setUp(SAVED);
  const r = await page.evaluate(() => {
    const a = window.__app;
    __pick('Record to', 6);
    __pick('Length', 8);
    __step(8);
    /* cancel while counting in */
    __btn('● Rec').click();
    __btn('Cancel').click();
    const afterCancel = document.querySelectorAll('.riffTakes li').length;
    /* nothing played */
    __btn('● Rec').click();
    const s1 = Math.ceil((a.TR.tick + 16) / 32) * 32;
    __to(s1 + 8 * 32 + 1);
    const afterEmpty = document.querySelectorAll('.riffTakes li').length;
    /* two bars of an 8-bar recording, then ■ Stop: a 2-bar take */
    __btn('● Rec').click();
    const s2 = Math.ceil((a.TR.tick + 16) / 32) * 32;
    __play(0, s2, 4);
    __play(4, s2 + 40, 4);
    __to(s2 + 50);
    if (!__btn('■ Stop'))
      return {
        err: __card() + ' | ' + [...document.querySelectorAll('.riffPanel button')].map(b => b.textContent).join(',')
      };
    __btn('■ Stop').click();
    if (!__btn('↺ Again'))
      return {
        err:
          'after stop: ' +
          __card() +
          ' | ' +
          [...document.querySelectorAll('.riffPanel button')].map(b => b.textContent).join(',')
      };
    const take = JSON.parse(localStorage.getItem('mc707-live-riffs')).pop();
    const card = __card();
    /* ↺ Again records again; ✕ Discard throws the take away */
    __btn('↺ Again').click();
    const again = __card();
    __btn('Cancel').click();
    const before = document.querySelectorAll('.riffTakes li').length;
    __btn('✕ Discard').click();
    const after = document.querySelectorAll('.riffTakes li').length;
    a.stopAll();
    return { afterCancel, afterEmpty, bars: take.bars, notes: take.notes.length, card, again, before, after };
  });
  assert.ok(!r.err, r.err);
  assert.equal(r.afterCancel, 0);
  assert.equal(r.afterEmpty, 0, 'nothing played: no take');
  assert.equal(r.bars, 2, '■ Stop: the shortest length that holds it');
  assert.equal(r.notes, 2);
  assert.match(r.card, /^done: Take 1 is ready/);
  assert.match(r.again, /^wait:/);
  assert.equal(r.after, r.before - 1, '✕ Discard');
  assert.deepEqual(errors, []);
});

test('Loop rec: count-in, Quantize 1/8, play straight away, keep the track playing', async () => {
  const { page, errors } = await setUp(SAVED);
  await page.locator('.riffPanel select[aria-label="Quantize"]').selectOption('8');
  await page.evaluate(() => {
    document.querySelector('#lvSetDet').open = true;
  });
  const set = page.locator('#lvSetBody');
  await set.locator('select[aria-label="Recording starts"]').selectOption('count');
  await set.locator('label', { hasText: 'Play a take straight away' }).locator('input').check();
  await set.locator('label', { hasText: 'Quiet the track while recording' }).locator('input').uncheck();
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV;
    __pick('Record to', 6);
    __pick('Length', 1);
    __step(8);
    const t1 = Math.ceil((a.TR.tick + 16) / 32) * 32;
    __btn('● Rec').click();
    __step(1);
    const counting = __card();
    /* counted in: recording starts a bar after the next bar line; a note a 16th late snaps to the 8th */
    __play(0, t1 + 32 + 2, 4);
    __to(t1 + 64 + 1);
    const v = LV.voices[6][0];
    a.stopAll();
    return { counting, straight: !!(v && v.f.riff), notes: v && v.f.notes.map(n => n.s) };
  });
  assert.match(r.counting, /Count-in/);
  assert.equal(r.straight, true, 'plays straight away when set to');
  assert.deepEqual(r.notes, [2], 'a 16th late, snapped to the 8th');
  assert.deepEqual(errors, []);
});

test('Loop rec on the MC-707’s keys: the track played first, and playing another track says so', async () => {
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
    const to = t => {
      while (a.TR.tick < t) step(1);
    };
    const pick = (label, v) => {
      const s = [...document.querySelectorAll('.riffPanel select')].find(x => x.getAttribute('aria-label') === label);
      s.value = String(v);
      s.dispatchEvent(new Event('change'));
    };
    const rec = () => [...document.querySelectorAll('.riffPanel button')].find(b => /Rec/.test(b.textContent)).click();
    /* the MC-707's keys on a channel, a note on each beat (above Raven mode's key and mute keys) */
    const keys = (t, from) => {
      const ch = a.S.tracks[t].ch - 1;
      for (let b = 0; b < 4; b++) {
        to(from + b * 8);
        window.__inject([0x90 | ch, 84 + b * 2, 90]);
        step(2);
        window.__inject([0x80 | ch, 84 + b * 2, 0]);
      }
    };
    pick('Record to', -1);
    pick('Length', 1);
    step(8);
    rec();
    let s = Math.ceil((a.TR.tick + 16) / 32) * 32;
    keys(7, s);
    to(s + 33);
    const take = document.querySelector('.riffTakes li').textContent;
    const notes = JSON.parse(localStorage.getItem('mc707-live-riffs'))
      .pop()
      .notes.map(n => [n.s, n.n]);
    /* recording the Lead, playing the Pluck: it says so */
    pick('Record to', 6);
    rec();
    s = Math.ceil((a.TR.tick + 16) / 32) * 32;
    to(s + 1);
    window.__inject([0x90 | (a.S.tracks[7].ch - 1), 86, 90]);
    const warn = (document.querySelector('.riffWarn') || {}).textContent || '';
    a.stopAll();
    return { take, notes, warn };
  });
  assert.match(r.take, /Pluck/);
  assert.deepEqual(r.notes, [
    [0, 84],
    [4, 86],
    [8, 88],
    [12, 90]
  ]);
  assert.match(r.warn, /You played on Pluck, but this records Lead/);
  assert.deepEqual(errors, []);
});

test('Loop rec: Quantize a take again, from the notes as played (triplets too, and back to Off)', async () => {
  const { page, errors } = await setUp(SAVED);
  await page.locator('.riffPanel select[aria-label="Quantize"]').selectOption('off');
  const played = await page.evaluate(() => {
    const a = window.__app;
    __pick('Record to', 6);
    __pick('Length', 1);
    __step(8);
    __btn('● Rec').click();
    const s = Math.ceil((a.TR.tick + 16) / 32) * 32;
    /* a bit loose: a 32nd late, on time, a 32nd early, and the last a 32nd before the loop comes round */
    for (const [at, d] of [
      [1, 0],
      [8, 2],
      [15, 4],
      [31, 5]
    ])
      __play(d, s + at, 1);
    __to(s + 32 + 1);
    a.stopAll();
    return JSON.parse(localStorage.getItem('mc707-live-riffs'))
      .pop()
      .notes.map(n => n.s);
  });
  assert.deepEqual(played, [0.5, 4, 7.5, 15.5], 'Off: as played, to a 32nd');
  const q = page.locator('.riffTakes li').first().locator('select.riffQ');
  const notes = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('mc707-live-riffs'))
        .pop()
        .notes.map(n => n.s)
    );
  await q.selectOption('16');
  /* 7.5 rounds up to 8; the last goes round to the loop's start */
  assert.deepEqual(await notes(), [0, 1, 4, 8]);
  await q.selectOption('16t');
  assert.deepEqual(
    (await notes()).map(x => Math.round(x * 3)),
    [2, 12, 22, 46],
    'onto 16th triplets (thirds of a 16th: the last stays on the final triplet)'
  );
  await page.locator('.riffTakes li').first().locator('select.riffQ').selectOption('off');
  assert.deepEqual(await notes(), [0.5, 4, 7.5, 15.5], 'back as played');
  assert.deepEqual(errors, []);
});

test('Loop rec: a take you play stays through scene changes, swaps, the energy and a restart, until ■ Back', async () => {
  const { page, errors } = await setUp(SAVED);
  await page.evaluate(() => {
    document.querySelector('#lvSetDet').open = true;
  });
  await page.locator('#lvSetBody label', { hasText: 'Play a take straight away' }).locator('input').check();
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV,
      t = 6;
    __pick('Record to', t);
    __pick('Length', 1);
    __step(8);
    const t1 = Math.ceil((a.TR.tick + 16) / 32) * 32;
    __btn('● Rec').click();
    __play(0, t1 + 2, 4);
    __to(t1 + 40);
    const take = LV.voices[t][0] && LV.voices[t][0].f;
    const on = () => !!(LV.voices[t][0] && LV.voices[t][0].f.id === take.id);
    const out = { take: !!(take && take.riff), pinned: LV.pin[t] === take.id };
    /* another scene, a swap of every part, the energy right down, then stop and start again */
    const other = (LV.cur + 1) % LV.scenes.length;
    a.liveScene(other, a.TR.tick);
    out.scene = on();
    out.under = LV.pinUnder[t] === (LV.scenes[other].cells[t] ? LV.scenes[other].cells[t].id : null);
    for (const sc of LV.scenes)
      if (sc.cells[t] && sc.cells[t].id !== take.id) a.liveScene(LV.scenes.indexOf(sc), a.TR.tick);
    out.scenes = on();
    LV.energy = 0;
    out.energy = !a.lvEmute(t);
    a.stopAll();
    a.liveStart(0);
    out.restart = on();
    /* ■ Back: the part of the scene playing now, from the next bar */
    const want = LV.scenes[LV.cur].cells[t] ? LV.scenes[LV.cur].cells[t].id : null;
    LV.energy = 9;
    __btn('■ Back').click();
    __to(Math.ceil((a.TR.tick + 2) / 32) * 32 + 4);
    out.back = !on() && !LV.pin[t];
    out.backTo = want ? !!(LV.voices[t][0] && LV.voices[t][0].f.id === want) : !LV.voices[t].length;
    a.stopAll();
    return out;
  });
  assert.deepEqual(r, {
    take: true,
    pinned: true,
    scene: true,
    under: true,
    scenes: true,
    energy: true,
    restart: true,
    back: true,
    backTo: true
  });
  assert.deepEqual(errors, []);
});
