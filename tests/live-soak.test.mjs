// Live Mode soak test: long simulated sets with random pad presses (scenes, breaks, builds, swaps, mutes,
// key and energy changes, stutter, moves, moods, End Jam and New patterns), checking what a gig depends on:
// nothing throws, the clock always moves, every note is released, every effect goes back to rest, and
// nothing grows without limit. SOAK_MINUTES sets the length of each set (default 8 minutes of music).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const MINUTES = +(process.env.SOAK_MINUTES || 8);

const SOAK = `async ({ style, seed, minutes }) => {
  const a = window.__app, LV = a.LV, S = a.S, TR = a.TR, L = a.live;
  a.ensureAudio(); await a.connectMidi();
  let r = seed >>> 0;
  const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pick = x => x[Math.floor(rnd() * x.length)];
  Object.assign(LV, { style, seed: 1 + (seed % 9), custom: false, auto: true, vary: 60, buildFx: true });
  a.liveBuild();
  window.__out.length = 0; window.__times = [];
  const errors = [], grew = [], held = [];
  let stuckClock = 0, presses = 0, restarts = 0;
  const safe = (what, f) => { try { f(); } catch (e) { if (errors.length < 8) errors.push(what + ': ' + (e && e.stack || e)); } };
  safe('start', () => L.jamStart());
  const bpm = LV.bpm, ticks = Math.round(minutes * bpm / 4) * 32;
  const ACTS = ['s0','s1','s2','s3','s4','s5','s6','s0','s1','s2','brk','brk','fill','fill','bd','next','prev',
    'sw:drums','sw:bass','sw:chords','sw:lead','sw:perc','mt:0','mt:3','mt:4','mt:6','en:up','en:down',
    'key:2','key:5','key:7','key:0','rise:up','rise:down','lock','lock','auto'];
  const MOVES = ['wash', 'throw', 'dip', 'pump', 'pump', 'pan', 'pan'];
  let hold = null, next = 16;
  for (let n = 0; n < ticks; n++) {
    if (!TR.playing) { restarts++; safe('restart', () => { a.stopAll(); L.jamStart(); }); }
    if (n === next) {
      next = n + 4 + Math.floor(rnd() * 60);
      presses++;
      const x = rnd();
      if (hold) { safe('up ' + hold, () => L.up(hold)); hold = null; }
      if (x < 0.62) { const act = pick(ACTS); safe(act, () => L.down(act)); }
      else if (x < 0.70) { hold = pick(['stut:4', 'stut:8', 'stut:16']); safe(hold, () => L.down(hold)); }
      else if (x < 0.78) { const m = pick(MOVES); safe('move ' + m, () => L.move(m)); }
      else if (x < 0.84) { LV.vary = pick([0, 30, 60, 100, 125]); LV.entry = pick(['hard', 'smooth', 'slow', 'long', 'vlong']); }
      else if (x < 0.88) { LV.dropStyle = pick(['smooth', 'hard', 'gap']); LV.brkLen = pick([16, 32, 64]); LV.brkStyle = pick(['mix', 'hits', 'stutter', 'roll', 'drop']); }
      else if (x < 0.92) safe('blend', () => L.blend());
      else if (x < 0.95) safe('jamEnd', () => L.jamEnd());
      else if (x < 0.97) { LV.chaos = pick([0, 40, 80]); LV.buildFx = rnd() < 0.8; LV.human = pick([0, 30, 70, 100]); LV.feel = pick(['natural', 'laidback', 'pushed', 'drunk']); L.humApply(); L.moodSet(pick([null, { i: 95, c: 8 }, { i: 18, c: 68 }, { i: 88, c: 92 }, { i: 50, c: 20 }]), true); }
      else safe('stopCue', () => L.down('stop'));
    }
    const before = TR.tick;
    safe('tick ' + TR.tick, () => { a.processTick(TR.tick, TR.nextTime); a.advance(); });
    if (TR.playing && TR.tick === before) stuckClock++;
    if (n % 32 === 0) {
      const sizes = { cues: LV.cues.length, autos: (LV.autos || []).length, hist: LV.hist.length, log: LV.log.length,
        fadeEnds: (LV.fadeEnds || []).length, bars: LV.bars.size, voices: Math.max(...LV.voices.map(v => v.length)) };
      const lim = { cues: 40, autos: 40, hist: 16, log: 600, fadeEnds: 8, bars: 48, voices: 3 };
      for (const k in lim) if (sizes[k] > lim[k] && grew.length < 8) grew.push(k + ' = ' + sizes[k] + ' at tick ' + n);
    }
  }
  if (hold) safe('up', () => L.up(hold));
  /* the end of the set: everything stops, as Stop does */
  const endTime = window.__times.reduce((m, t) => (t != null && t > m ? t : m), 0);
  safe('stop', () => a.stopAll());
  const out = window.__out, times = window.__times;
  /* every note-on gets its note-off: walk each channel and note in time order */
  const ev = new Map(), bar = (60 / bpm) * 4 * 1000;
  out.forEach((b, i) => {
    const t = b[0] & 0xf0;
    if (t !== 0x90 && t !== 0x80) return;
    const k = (b[0] & 15) + ':' + b[1], on = t === 0x90 && b[2] > 0;
    if (!ev.has(k)) ev.set(k, []);
    ev.get(k).push([times[i] ?? 0, on ? 1 : 0, i]);
  });
  /* the app's all-notes-off (CC 123) on a channel also releases everything on it */
  const allOff = new Map();
  out.forEach((b, i) => { if ((b[0] & 0xf0) === 0xb0 && (b[1] === 123 || b[1] === 120)) { const c = b[0] & 15; if (!allOff.has(c)) allOff.set(c, []); allOff.get(c).push(times[i] ?? 0); } });
  for (const [k, list] of ev) {
    list.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const ch = +k.split(':')[0], offs = allOff.get(ch) || [];
    let onAt = null;
    for (const [t, on] of list) {
      if (on) { if (onAt == null) onAt = t; }
      else if (onAt != null) { if (t - onAt > 16 * bar && held.length < 8) held.push(k + ' held ' + Math.round((t - onAt) / bar) + ' bars'); onAt = null; }
    }
    if (onAt != null && !offs.some(t => t >= onAt) && held.length < 8) held.push(k + ' never released');
  }
  /* every effect is back at rest after Stop */
  const last = new Map();
  out.forEach(b => { if ((b[0] & 0xf0) === 0xb0) last.set((b[0] & 15) + ':' + b[1], b[2]); });
  const offRest = [];
  for (const [k, v] of last) {
    const [ch, cc] = k.split(':').map(Number), t = S.tracks.findIndex(x => x.ch === ch + 1);
    if (t < 0 || ![10, 11, 71, 80, 81, 82, 83, 91].includes(cc)) continue;
    const rest = L.restCC(t, cc);
    if (Math.abs(v - rest) > 1 && offRest.length < 8) offRest.push('track ' + (t + 1) + ' CC' + cc + ' = ' + v + ' (rest ' + rest + ')');
  }
  return { ticks, presses, restarts, errors, grew, held, offRest, stuckClock, messages: out.length };
}`;

for (const [style, seed] of [
  ['deephouse', 11],
  ['trap', 23],
  ['liquid', 37],
  ['acidtechno', 41],
  ['pop', 53],
  ['bigbeat', 67]
]) {
  test('Live soak: ' + MINUTES + ' minutes of ' + style + ' with random pad presses', async () => {
    const { page, errors } = await openApp();
    await page.click('#menubar .mtab[data-mode=live]');
    const r = await page.evaluate(`(${SOAK})(${JSON.stringify({ style, seed, minutes: MINUTES })})`);
    console.log(style, JSON.stringify({ presses: r.presses, restarts: r.restarts, messages: r.messages }));
    assert.deepEqual(r.errors, [], 'nothing throws');
    assert.equal(r.stuckClock, 0, 'the clock always moves');
    assert.deepEqual(r.held, [], 'every note is released');
    assert.deepEqual(r.offRest, [], 'every effect is back at rest after Stop');
    assert.deepEqual(r.grew, [], 'nothing grows without limit');
    assert.ok(r.presses > 50);
    assert.deepEqual(errors, []);
  });
}
