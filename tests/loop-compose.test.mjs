// LoopCompose (live/loop-compose.js): ● Start plays the composer's beat alone and records your loop from the
// next bar; the key and chords are found in it, every other part is written on them, your loop stays on its
// track and the set comes in two bars later. ● New loop strips back to the drums and your loops, records
// another, and a fresh set around both comes in. ■ End leaves the loops playing.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, readFixture } from './helpers.mjs';

after(closeBrowser);

const SAVED = {
  'mc707-song-mode-v1': readFixture('song-v0.10.json'),
  'mc707-live': readFixture('live-settings-v0.10.json')
};

test('LoopCompose: a bass loop, the set written on its chords, then a new loop and a fresh set', async () => {
  const { page, errors } = await openApp({ storage: SAVED });
  await page.click('#menubar .mtab[data-mode=live]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#lvMidi').click());
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => a.TR.nextTime, configurable: true });
    const step = n => {
      for (let i = 0; i < n; i++) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
    };
    const to = t => {
      if (a.TICKER.stop) a.TICKER.stop();
      while (a.TR.tick < t) step(1);
    };
    const pick = (label, v) => {
      const s = document.querySelector('.lcPanel select[aria-label="' + label + '"]');
      s.value = String(v);
      s.dispatchEvent(new Event('change'));
    };
    const btn = txt =>
      [...document.querySelectorAll('.lcPanel button')].find(b => b.textContent.trim().startsWith(txt));
    /* a key on the keyboard as a pitch class of the set's key, in the octave around the keyboard's middle */
    const key0 = () => LV.ctl.base + 24;
    const note = semis => {
      const k = key0(),
        want = (LV.key + semis) % 12;
      return k + ((want - (k % 12) + 12) % 12);
    };
    const play = (semis, at, len, oct = 0) => {
      to(at);
      const n = note(semis) + oct;
      window.__key([0x90, n, 100]);
      to(at + len);
      window.__key([0x80, n, 0]);
    };
    const out = {};
    const tones = a.S.tracks
      .map((t, i) => [i, t.type])
      .filter(x => x[1] === 'tone')
      .map(x => x[0]);
    const bassT = tones[0],
      leadT = tones[tones.length - 2];
    out.key = LV.key;
    out.mode = LV.mode;
    /* 1. ● Start from a stopped jam: the beat alone, then a 4-bar loop: i, i, VI, v (roots, low) */
    pick('LoopCompose track', bassT);
    pick('LoopCompose length', 4);
    btn('● Start').click();
    if (a.TICKER.stop) a.TICKER.stop();
    out.playing = a.TR.playing;
    out.beatOnly =
      LV.scenes[LV.cur].kind === 'lc' && Object.keys(LV.scenes[LV.cur].cells).every(t => a.S.tracks[t].type !== 'tone');
    out.flavor = LV.flavor;
    const s0 = 32;
    play(0, s0, 6);
    play(0, s0 + 8, 4);
    play(0, s0 + 32, 12);
    play(7, s0 + 48, 8);
    play(8, s0 + 64, 12);
    play(8, s0 + 80, 8);
    play(7, s0 + 96, 10);
    play(10, s0 + 112, 8);
    to(s0 + 128 + 1);
    out.info = document.querySelector('.lcInfo') && document.querySelector('.lcInfo').textContent;
    out.lc1 = LV.lc && { prog: LV.lc.prog, key: LV.lc.key, scale: LV.lc.scale };
    out.pinned1 = LV.pin[bassT] && LV.voices[bassT][0] && LV.voices[bassT][0].f.riff;
    /* two bars later the set (its first scene) comes in, on the loop's chords */
    to(s0 + 128 + 64 + 1);
    const parts = t => LV.voices[t][0] && LV.voices[t][0].f;
    out.cur = LV.cur;
    out.others = tones
      .filter(t => t !== bassT && parts(t))
      .map(t => ({ t, prog: parts(t)._prog, key: parts(t).key && parts(t).key.root }));
    out.bassStill = !!(parts(bassT) && parts(bassT).riff);
    /* the loop sounds as played: same notes after the key was set from it */
    const loopF = parts(bassT);
    out.shift = loopF && loopF.key.root === LV.key;
    const seed1 = LV.seed;
    /* 2. ● New loop on another track: down to the drums and the bass loop while recording */
    pick('LoopCompose track', leadT);
    btn('● New loop').click();
    const b2 = Math.ceil((a.TR.tick + 16) / 32) * 32;
    to(b2 + 1);
    out.strip = tones.filter(t => t !== bassT && LV.voices[t].some(v => v.env.v1 > 0)).length;
    out.bassKept = !!(parts(bassT) && parts(bassT).riff);
    const s2 = b2 + 32;
    play(3, s2, 4);
    play(7, s2 + 8, 4);
    play(10, s2 + 16, 8);
    play(8, s2 + 64, 8);
    play(0, s2 + 96, 8);
    to(s2 + 128 + 64 + 1);
    out.lc2 = LV.lc && { prog: LV.lc.prog, loops: Object.keys(LV.lc.loops).map(Number) };
    out.newSeed = LV.seed !== seed1;
    out.both = [bassT, leadT].every(t => parts(t) && parts(t).riff);
    out.others2 = tones.filter(t => t !== bassT && t !== leadT && parts(t)).map(t => parts(t)._prog);
    /* 3. ■ End: the loops play on, the chords are the style's own again */
    btn('■ End').click();
    out.end = { lc: LV.lc, flavor: LV.flavor, both: [bassT, leadT].every(t => parts(t) && parts(t).riff) };
    a.stopAll();
    return out;
  });
  assert.equal(r.playing, true, '● Start starts the jam');
  assert.ok(r.beatOnly, 'the beat plays alone');
  assert.equal(r.flavor, 'composed');
  assert.ok(r.lc1, 'the chords were found');
  assert.equal(r.lc1.key, r.key, 'a loop in the set’s key keeps it');
  assert.deepEqual(r.lc1.prog.slice(0, 3), [1, 1, 6], 'i, i, VI: ' + JSON.stringify(r.lc1.prog));
  assert.ok(r.pinned1, 'the loop is on its track');
  assert.match(r.info, /minor: .+ – .+ – .+ – .+Take \d+ on /, 'the panel shows the key, chords and loop: ' + r.info);
  assert.ok(r.others.length >= 2, 'the set comes in: ' + JSON.stringify(r.others));
  assert.ok(r.others.length >= 1, 'other parts play: ' + JSON.stringify(r.others));
  for (const o of r.others) assert.match(o.prog, /-u[ia]1\.1\.6\./, 'written on the loop’s chords');
  assert.ok(r.bassStill, 'the loop plays on');
  assert.ok(r.shift, 'the loop is in the set’s key');
  assert.equal(r.strip, 0, 'only the drums and the bass loop while recording the new loop');
  assert.ok(r.bassKept);
  assert.equal(r.lc2.loops.length, 2);
  assert.ok(r.newSeed, 'a new loop brings new patterns');
  assert.ok(r.both, 'both loops play');
  for (const p of r.others2) assert.match(p, /-u[ia]\d/);
  assert.equal(r.end.lc, null);
  assert.ok(r.end.both, 'the loops stay after ■ End');
  assert.deepEqual(errors, []);
});
