// Note timing on the way to the MC-707: drum notes land on the swung grid, a note-off never cuts the next
// note of its key (swing and humanize move notes past their neighbours), the audio clock's steps do not
// make notes wobble, and the MIDI offset moves everything together.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

/* Play a Live set for `bars` with the clock run by hand; MIDI times read straight from the audio clock. */
const RUN = `async (c) => {
  const a = window.__app, LV = a.LV;
  a.ensureAudio(); await a.connectMidi();
  a.stopAll();
  Object.assign(LV, { human: c.hum, feel: c.feel || 'natural', style: c.style, seed: 3, custom: false, auto: true, chaos: 40, flavor: c.flavor, flavorPick: true });
  a.liveBuild();
  const pn = performance.now.bind(performance);
  performance.now = () => a.AU.ctx.currentTime * 1000;
  window.__out.length = 0; window.__times = [];
  a.liveStart(0); a.TICKER.stop();
  LV.swing = c.swing;
  const t0 = a.TR.nextTime, k0 = a.TR.tick, end = k0 + 32 * c.bars;
  while (a.TR.playing && a.TR.tick < end) { a.processTick(a.TR.tick, a.TR.nextTime); a.advance(); }
  const td = (a.TR.nextTime - t0) / (a.TR.tick - k0);
  const out = window.__out.map((m, i) => [m, window.__times[i], i]);
  performance.now = pn;
  a.stopAll();
  const drum = new Set(a.S.tracks.filter(x => x.type === 'drum').map(x => x.ch - 1));
  const evs = out.filter(x => x[1] != null && x[0].length === 3 && (x[0][0] & 0xe0) === 0x80)
    .map(([m, t, i]) => ({ ch: m[0] & 15, k: (m[0] & 15) * 128 + m[1], on: (m[0] & 0xf0) === 0x90 && m[2] > 0, t, i }))
    .sort((x, y) => x.t - y.t || x.i - y.i);
  /* the MC-707's view: a note-on while its key still sounds was cut short by the late note-off */
  const held = new Map(); let cut = 0, ons = 0; const grid = {};
  for (const e of evs) {
    if (!e.on) { held.set(e.k, false); continue; }
    ons++;
    if (held.get(e.k)) cut++;
    held.set(e.k, true);
    /* (from the tick the swing was set) */
    if (drum.has(e.ch) && e.t / 1000 >= t0 - 1e-6) { const q = ((((e.t / 1000 - t0) / td) % 4) + 4) % 4; const b = (Math.round(q * 50) / 50) % 4; grid[b.toFixed(2)] = (grid[b.toFixed(2)] || 0) + 1; }
  }
  return { ons, cut, grid };
}`;

test('Live: with swing and humanize, no note is cut short by the note before it (composed and library sets)', async () => {
  const { page, errors } = await openApp();
  for (const c of [
    { style: 'deephouse', flavor: 'composed', swing: 62, hum: 0, bars: 48 },
    { style: 'boombap', flavor: 'lively', swing: 62, hum: 60, bars: 48 },
    { style: 'trap', flavor: 'lively', swing: 58, hum: 0, bars: 48 },
    { style: 'techno', flavor: 'composed', swing: 50, hum: 40, bars: 48 }
  ]) {
    const r = await page.evaluate(`(${RUN})(${JSON.stringify(c)})`);
    assert.ok(r.ons > 800, c.style + ': plays (' + r.ons + ')');
    assert.equal(r.cut, 0, c.style + ' ' + c.flavor + ': notes cut short');
  }
  assert.deepEqual(errors, []);
});

test('Live: drum notes land on the grid, the off-beat 16ths moved by the swing and nothing else', async () => {
  const { page, errors } = await openApp();
  const straight = await page.evaluate(
      `(${RUN})(${JSON.stringify({ style: 'deephouse', flavor: 'composed', swing: 50, hum: 0, bars: 32 })})`
    ),
    swung = await page.evaluate(
      `(${RUN})(${JSON.stringify({ style: 'deephouse', flavor: 'composed', swing: 62, hum: 0, bars: 32 })})`
    );
  const share = (g, keys) => keys.reduce((a, k) => a + (g[k] || 0), 0) / Object.values(g).reduce((a, b) => a + b, 0);
  /* a 16th is 2 ticks: straight, the 16ths sit on 0 and 2; at 62% the second is 0.48 of a tick late */
  assert.ok(share(straight.grid, ['0.00', '2.00']) > 0.95, 'straight: ' + JSON.stringify(straight.grid));
  assert.ok(share(swung.grid, ['0.00', '2.48']) > 0.95, 'swung: ' + JSON.stringify(swung.grid));
  assert.ok(!swung.grid['2.00'], 'no off-beat 16th left unswung: ' + JSON.stringify(swung.grid));
  assert.deepEqual(errors, []);
});

test('MIDI times: the audio clock moving in steps does not make notes wobble', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app;
    a.ensureAudio();
    await a.connectMidi();
    /* an audio clock that moves on every 10 ms, read at odd moments in between (like a real sound card) */
    let wall = 1000;
    const pn = performance.now.bind(performance);
    performance.now = () => wall;
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => Math.floor(wall / 10) / 100, configurable: true });
    window.__out.length = 0;
    window.__times = [];
    const at = [];
    for (let i = 0; i < 200; i++) {
      wall += 7.3; /* the scheduler runs */
      const t = 2 + i * 0.05;
      at.push(t);
      a.sendMidi([0x99, 42, 100], t);
    }
    performance.now = pn;
    delete a.AU.ctx.currentTime;
    const ms = window.__times.slice(-150),
      gaps = ms.slice(1).map((x, i) => x - ms[i]);
    return { min: Math.min(...gaps), max: Math.max(...gaps) };
  });
  /* every note 50 ms after the one before, to well under a millisecond */
  assert.ok(r.max - r.min < 0.5, 'gaps from ' + r.min.toFixed(2) + ' to ' + r.max.toFixed(2) + ' ms');
  assert.deepEqual(errors, []);
});

test('MIDI offset: every message moves together, so a clip change still comes before its first note', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app;
    a.ensureAudio();
    await a.connectMidi();
    const run = off => {
      a.S.midiOffset = off;
      window.__out.length = 0;
      window.__times = [];
      const t = a.AU.ctx.currentTime + 1;
      a.sendMidi([0xc0, 3], t - 0.004);
      a.sendMidi([0x90, 60, 100], t);
      a.sendMidi([0x80, 60, 0], t + 0.1);
      return window.__times.slice();
    };
    const zero = run(0),
      early = run(-40),
      late = run(60);
    a.S.midiOffset = 0;
    return { zero, early, late };
  });
  for (const [name, ts, d] of [
    ['early', r.early, -40],
    ['late', r.late, 60]
  ]) {
    assert.ok(ts[0] < ts[1] && ts[1] < ts[2], name + ': program change, note-on, note-off in order');
    ts.forEach((x, i) => assert.ok(Math.abs(x - r.zero[i] - d) < 3, name + ': moved by the offset'));
  }
  assert.deepEqual(errors, []);
});
