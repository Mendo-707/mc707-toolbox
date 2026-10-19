// Mood (library/mood.js, live/mood-ui.js) and the Big Beat genre (library/bigbeat-pack.js).
// Off changes nothing (the engine baselines guard that); an intense mood picks harder parts, plays
// harder and faster than a calm one, a dark mood picks darker parts than a bright one, and Big Beat
// builds full Live sets and wizard songs from its own patterns.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

test('mood: intense picks harder parts and plays harder and faster than calm; dark is darker than bright', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV,
      TR = a.TR,
      by = new Map(a.FAC.map(f => [f.id, f]));
    a.ensureAudio();
    await a.connectMidi();
    const M = { angry: { i: 95, c: 8 }, chill: { i: 18, c: 68 }, euphoric: { i: 88, c: 92 }, off: null };
    const out = {};
    for (const [name, m] of Object.entries(M)) {
      const o = (out[name] = { ti: [], tc: [], di: [], bpm: [], vel: [] });
      for (const style of ['neuro', 'trap', 'deephouse', 'acidtechno', 'pop', 'bigbeat'])
        for (let seed = 1; seed <= 3; seed++) {
          const st = a.STYLES.find(s => s.id === style);
          Object.assign(LV, { style, seed, custom: false, bpm: st.bpm[2], auto: false });
          a.live.moodSet(m, true);
          o.bpm.push(LV.bpm / st.bpm[2]);
          for (const sc of LV.scenes)
            for (const c of Object.values(sc.cells)) {
              const f = by.get(c.id);
              if (!f) continue;
              const mo = a.live.moodOf(f);
              if (f.type === 'drum') o.di.push(mo.i);
              else (o.ti.push(mo.i), o.tc.push(mo.c));
            }
          if (seed === 1) {
            window.__out.length = 0;
            a.liveStart(0);
            a.TICKER.stop();
            for (let n = 0; n < 256 && TR.playing; n++) (a.processTick(TR.tick, TR.nextTime), a.advance());
            a.stopAll();
            window.__out.forEach(b => (b[0] & 0xf0) === 0x90 && b[2] > 0 && o.vel.push(b[2]));
          }
        }
    }
    return out;
  });
  const A = k => Object.fromEntries(Object.entries(r).map(([n, o]) => [n, avg(o[k])]));
  const ti = A('ti'),
    tc = A('tc'),
    di = A('di'),
    bpm = A('bpm'),
    vel = A('vel');
  console.log(JSON.stringify({ ti, tc, di, bpm, vel }));
  assert.ok(ti.angry > ti.chill + 0.05, 'intense picks busier, harder melodic parts');
  assert.ok(di.angry > di.chill, 'and harder drums');
  assert.ok(tc.angry < tc.euphoric - 0.05 && tc.angry < tc.chill, 'dark picks darker parts than bright');
  assert.ok(bpm.angry > bpm.chill, 'intense is faster than calm');
  assert.ok(vel.angry > vel.off && vel.off > vel.chill, 'intense plays harder, calm softer');
  assert.deepEqual(errors, []);
});

test('Big Beat: its own breaks, riffs and fills fill a Live set and a wizard song', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  const r = await page.evaluate(() => {
    const a = window.__app,
      LV = a.LV,
      FAC = a.FAC,
      by = new Map(FAC.map(f => [f.id, f]));
    const bb = FAC.filter(f => f.genre === 'bigbeat'),
      pools = {};
    bb.forEach(f => (pools[f.pool] = (pools[f.pool] || 0) + 1));
    const bad = bb.filter(
      f =>
        !(f.mx ? /^mxbigbeat/ : /^(bb|fk-bigbeat-)/).test(f.id) ||
        !f.notes.length ||
        f.notes.some(n => n.s < 0 || n.s >= f.bars * 16 || n.l <= 0 || n.n < 0 || n.n > 127)
    );
    Object.assign(LV, { style: 'bigbeat', seed: 4, custom: false, bpm: 128 });
    a.live.moodSet(null, true);
    const used = new Set();
    for (const sc of LV.scenes) for (const [t, c] of Object.entries(sc.cells)) used.add(t + ':' + by.get(c.id).genre);
    const plan = a.wiz.plan(a.wiz.def('bigbeat'));
    const wizIds = (JSON.stringify(plan.sections).match(/"(bb\d+|mxbigbeat\d+)"/g) || []).length;
    return {
      count: bb.length,
      ids: new Set(bb.map(f => f.id)).size,
      pools,
      bad: bad.slice(0, 5).map(f => f.id + ' ' + f.name),
      used: [...used],
      wizIds,
      style: !!a.STYLES.find(s => s.id === 'bigbeat')
    };
  });
  assert.ok(r.style, 'the Big Beat style exists');
  assert.equal(r.ids, r.count, 'ids are unique');
  assert.deepEqual(r.bad, []);
  for (const p of [
    'kit',
    'hats',
    'perc',
    'fill',
    'intro',
    'build',
    'impact',
    'bass',
    'chords',
    'pad',
    'lead',
    'pluck',
    'full'
  ])
    assert.ok(r.pools[p] > 0, 'has a ' + p + ' pool');
  for (let t = 0; t < 8; t++) assert.ok(r.used.includes(t + ':bigbeat'), 'track ' + (t + 1) + ' plays Big Beat parts');
  assert.ok(
    r.used.every(u => u.endsWith(':bigbeat')),
    'only Big Beat parts: ' + r.used.join(' ')
  );
  assert.ok(r.wizIds > 20, 'the song wizard fills a song from them');
  assert.deepEqual(errors, []);
});
