// Live Mode's leads and plucks (library/melody-fit.js, live/chord-lock.js): the automatic picks leave out
// lines that clash with their chords and triplet or dotted lines in straight styles, and Chord lock moves
// the notes that land on a beat against the chord, so fewer lead and pluck notes rub against it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Live sets pick leads and plucks that fit the chords and the beat', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV,
      M = a.melody,
      byId = new Map(a.FAC.map(f => [f.id, f])),
      bad = [];
    for (const style of ['deephouse', 'techno', 'liquid', 'trance', 'classichouse', 'bigbeat'])
      for (const seed of [1, 2, 3]) {
        Object.assign(LV, { style, seed, custom: false, mood: null });
        LV.mode = null;
        a.liveBuild();
        for (const sc of LV.scenes)
          for (const t of [6, 7]) {
            const f = sc.cells[t] && byId.get(sc.cells[t].id);
            if (!f) continue;
            if (M.clashes(f)) bad.push(style + ' clashes: ' + f.name);
            if (M.isTriplet(f)) bad.push(style + ' triplets: ' + f.name);
            if (M.isDotted(f) && style !== 'trance') bad.push(style + ' dotted: ' + f.name);
          }
      }
    return bad;
  });
  assert.deepEqual(r, []);
  assert.deepEqual(errors, []);
});

/* 64 bars of a set with auto-pilot; how many lead and pluck notes start a half-step from a chord note */
const RUB = `async ({ style, seed, lock }) => {
  const a = window.__app, LV = a.LV; a.ensureAudio(); await a.connectMidi();
  window.__out.length = 0; window.__times = [];
  Object.assign(LV, { style, seed, custom: false, auto: true, vary: 50, chordLock: lock }); LV.mode = null;
  a.liveBuild(); a.liveStart(0); a.TICKER.stop();
  const end = a.TR.tick + 32 * 64;
  while (a.TR.playing && a.TR.tick < end) { a.processTick(a.TR.tick, a.TR.nextTime); a.advance(); }
  a.stopAll();
  const ch = t => a.S.tracks[t].ch - 1, H = [3, 4, 5].map(ch), M = [6, 7].map(ch);
  const ev = window.__out.map((m, i) => [window.__times[i], m]).filter(([, m]) => m.length === 3 && (m[0] & 0xe0) === 0x80)
    .sort((x, y) => x[0] - y[0] || ((x[1][0] & 0xf0) === 0x80 ? -1 : 1));
  const on = new Map(); let n = 0, rub = 0;
  for (const [, m] of ev) {
    const c = m[0] & 15, isOn = (m[0] & 0xf0) === 0x90 && m[2] > 0;
    if (H.includes(c)) { if (isOn) on.set(c + ':' + m[1], m[1] % 12); else on.delete(c + ':' + m[1]); continue; }
    if (!M.includes(c) || !isOn) continue;
    const pcs = new Set(on.values()); if (pcs.size < 2) continue;
    n++; const pc = m[1] % 12;
    if (!pcs.has(pc) && (pcs.has((pc + 1) % 12) || pcs.has((pc + 11) % 12))) rub++;
  }
  return { n, rub };
}`;
test('Chord lock: fewer lead and pluck notes rub against the chord', async () => {
  let off = 0,
    on = 0;
  for (const [style, seed] of [
    ['classichouse', 1],
    ['techno', 1]
  ]) {
    for (const lock of [false, true]) {
      const { page, errors } = await openApp();
      const r = await page.evaluate(`(${RUB})(${JSON.stringify({ style, seed, lock })})`);
      assert.ok(r.n > 50, 'leads and plucks play');
      if (lock) on += r.rub / r.n;
      else off += r.rub / r.n;
      assert.deepEqual(errors, []);
    }
  }
  assert.ok(on < off * 0.6, 'with Chord lock ' + on.toFixed(3) + ' against ' + off.toFixed(3));
});
