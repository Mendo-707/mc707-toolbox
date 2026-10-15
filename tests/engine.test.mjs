// Engine snapshots: these guard the code moves in the module migration.
// Each test fingerprints something the app produces and compares it with tests/baselines/.
// A difference means behaviour changed. If the change is intended, re-run with UPDATE_BASELINES=1.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, fnv, checkBaseline, readFixture } from './helpers.mjs';

after(closeBrowser);

const same = (name, value) => {
  const r = checkBaseline(name, value);
  if (r.written) return;
  assert.deepEqual(r.got, r.want, `${name} differs from tests/baselines/${name}.json`);
};

/* Play the song (or live set) without the clock: process ticks one by one and collect every MIDI message. */
const OFFLINE = `async (o) => {
  const a = window.__app; a.ensureAudio(); await a.connectMidi();
  window.__out.length = 0;
  if (o.mode === 'song') { a.S.cursor = 0; a.S.loop.on = false; a.startSong(); }
  else { const LV = a.LV; LV.style = o.style; LV.seed = o.seed; LV.custom = false; LV.auto = !!o.auto; LV.vary = o.vary; a.liveBuild(); a.liveStart(0); }
  a.TICKER.stop();
  const end = a.TR.tick + o.ticks;
  while (a.TR.playing && !a.TR.ending && a.TR.tick < end) { a.processTick(a.TR.tick, a.TR.nextTime); a.advance(); }
  a.stopAll();
  return window.__out.slice();
}`;

test('factory pattern library is unchanged (ids, names, notes)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const FAC = window.__app.FAC,
      pools = {},
      rows = [];
    for (const f of FAC) {
      pools[f.pool || '-'] = (pools[f.pool || '-'] || 0) + 1;
      rows.push(
        JSON.stringify([
          f.id,
          f.name,
          f.type,
          f.genre,
          f.bars,
          f.pool || '',
          f.role || '',
          f.keyName || '',
          f.bpm ?? '',
          f.styles || null,
          f.notes.map(n => [n.s, n.l, n.n, n.v])
        ])
      );
    }
    return { count: FAC.length, pools, rows };
  });
  // hash in chunks of 500 patterns, so a failure points at roughly where the change is
  const chunks = [];
  for (let i = 0; i < r.rows.length; i += 500) chunks.push(fnv(r.rows.slice(i, i + 500).join('\n')));
  same('factory', { count: r.count, pools: r.pools, chunks });
  assert.deepEqual(errors, []);
});

test('a saved song plays the same MIDI (16 bars)', async () => {
  const { page, errors } = await openApp({ storage: { 'mc707-song-mode-v1': readFixture('song-v0.10.json') } });
  const out = await page.evaluate(`(${OFFLINE})({mode:'song',ticks:512})`);
  const pcs = out.filter(m => (m[0] & 0xf0) === 0xc0);
  same('song-midi', { messages: out.length, programChanges: pcs, hash: fnv(JSON.stringify(out)) });
  assert.ok(out.length > 500, 'the song should send notes');
  assert.deepEqual(errors, []);
});

const STYLES = ['liquid', 'neuro', 'trap', 'deephouse', 'acidtechno', 'reggae', 'pop'];

test('Live scenes are built the same way for each style', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(styles => {
    const a = window.__app,
      LV = a.LV,
      out = {};
    for (const st of styles) {
      LV.style = st;
      LV.seed = 3;
      LV.custom = false;
      a.liveBuild();
      out[st] = LV.scenes.map(sc => [
        sc.name,
        sc.bars,
        sc.e,
        sc.fx || '',
        Object.entries(sc.cells).map(([t, c]) => [t, c.id, c.play || ''])
      ]);
    }
    return out;
  }, STYLES);
  const fp = {};
  for (const st of STYLES) fp[st] = { scenes: r[st].length, hash: fnv(JSON.stringify(r[st])) };
  same('live-scenes', fp);
  assert.deepEqual(errors, []);
});

test('a Live set with auto-pilot plays the same MIDI (32 bars)', async () => {
  const { page, errors } = await openApp();
  const out = await page.evaluate(`(${OFFLINE})({mode:'live',style:'liquid',seed:5,auto:true,vary:60,ticks:1024})`);
  same('live-midi', { messages: out.length, hash: fnv(JSON.stringify(out)) });
  assert.ok(out.length > 500);
  assert.deepEqual(errors, []);
});

test('trap hat rolls land between ticks, and Extreme variation changes the repeats', async () => {
  const { page, errors } = await openApp();
  const run = vary =>
    page.evaluate(`(async () => {
      const a = window.__app; a.ensureAudio(); await a.connectMidi();
      window.__out.length = 0; window.__times = [];
      const LV = a.LV; LV.style = 'trap'; LV.seed = 3; LV.custom = false; LV.auto = false; LV.bpm = 140; LV.vary = ${vary};
      a.liveBuild(); a.liveStart(0); a.TICKER.stop();
      const end = a.TR.tick + 512;
      while (a.TR.playing && !a.TR.ending && a.TR.tick < end) { a.processTick(a.TR.tick, a.TR.nextTime); a.advance(); }
      a.stopAll();
      return window.__out.map((m, i) => [m[0], m[1], window.__times[i]]).filter(m => (m[0] & 0xf0) === 0x90 && m[2] != null);
    })()`);
  const high = await run(100),
    extreme = await run(125);
  const tick = 60000 / 140 / 8,
    times = [...new Set(high.map(m => Math.round(m[2])))].sort((a, b) => a - b),
    between = times.slice(1).filter((t, i) => t - times[i] > tick * 0.3 && t - times[i] < tick * 0.8);
  assert.ok(between.length > 4, 'triplet or 64th notes fall between the 32nd-note ticks');
  assert.notDeepEqual(
    extreme.map(m => m.slice(0, 2)),
    high.map(m => m.slice(0, 2)),
    'Extreme plays different notes from High'
  );
  assert.deepEqual(errors, []);
});
