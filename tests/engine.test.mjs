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

test('Start Jam plays intro loops into the first scene; End Jam winds down and stops', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV;
    a.ensureAudio();
    await a.connectMidi();
    LV.style = 'deephouse';
    LV.seed = 2;
    LV.custom = false;
    LV.auto = false;
    a.liveBuild();
    document.querySelector('#lvStart').click();
    a.TICKER.stop();
    const run = n => {
      const end = a.TR.tick + n;
      while (a.TR.playing && !a.TR.ending && a.TR.tick < end) {
        a.processTick(a.TR.tick, a.TR.nextTime);
        a.advance();
      }
    };
    run(32 * 10);
    const intro = LV.hist.filter(h => /^Intro/.test(h.label || '')).length,
      inScene = !LV.jam && LV.hist.some(h => !h.label && h.tick > 0);
    document.querySelector('#lvStart').click();
    const outro = !!(LV.jam && LV.jam.kind === 'out');
    run(32 * 14);
    const ended = a.TR.ending || !a.TR.playing;
    a.stopAll();
    return { intro, inScene, outro, ended };
  });
  assert.ok(r.intro >= 2, 'at least two intro loops');
  assert.ok(r.inScene, 'the first scene follows the intro');
  assert.ok(r.outro && r.ended, 'End Jam plays an outro and stops');
  assert.deepEqual(errors, []);
});

test('Song Mode clips can start and end between steps (down to 1/256 bar)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app,
      S = a.S;
    a.ensureAudio();
    await a.connectMidi();
    /* freeze both clocks, so MIDI times come straight from the player's schedule (no wall-clock jitter) */
    Object.defineProperty(a.AU.ctx, 'currentTime', { get: () => 0, configurable: true });
    performance.now = () => 0;
    /* a reference clip on track 1 and the same 16-step pattern on track 2, placed finely */
    const run = (start, len, off) => {
      S.clips = [];
      S.patterns.pf = {
        id: 'pf',
        type: 'drum',
        name: 'x',
        bars: 1,
        notes: Array.from({ length: 16 }, (_, i) => ({ s: i, l: 1, n: 0, v: 100 }))
      };
      S.clips.push(
        { id: 'ref', t: 0, start: 1, len: 1, off: 0, pat: 'pf' },
        { id: 'cf', t: 1, start, len, off, pat: 'pf' }
      );
      S.cursor = 0;
      S.loop.on = false;
      window.__out.length = 0;
      window.__times = [];
      a.startSong();
      a.TICKER.stop();
      while (a.TR.playing && !a.TR.ending && a.TR.tick < 96) {
        a.processTick(a.TR.tick, a.TR.nextTime);
        a.advance();
      }
      a.stopAll();
      const on = ch =>
        window.__out
          .map((b, i) => [b, window.__times[i]])
          .filter(([b]) => b[0] === (0x90 | ch) && b[2] > 0)
          .map(x => x[1]);
      const ref = on(0),
        f = on(S.tracks[1].ch - 1),
        bar = (60 / S.bpm) * 4 * 1000;
      /* in 1/256 bars after the reference clip's first note */
      return [f.length, Math.round(((f[0] - ref[0]) / bar) * 256)];
    };
    const out = {
      grid: run(1, 1, 0),
      late64: run(1 + 1 / 64, 1 - 1 / 32, 0),
      late256: run(1 + 1 / 256, 1, 0),
      off64: run(1, 1, 1 / 64)
    };
    delete a.AU.ctx.currentTime;
    delete performance.now;
    return out;
  });
  assert.deepEqual(r, { grid: [16, 0], late64: [16, 4], late256: [16, 1], off64: [16, 12] });
  assert.deepEqual(errors, []);
});

test('Live fades ramp each track down and always leave it back at full level', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV,
      S = a.S;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'liquid', seed: 5, custom: false, auto: true, vary: 60, entry: 'long', buildFx: false });
    a.liveBuild();
    window.__out.length = 0;
    a.liveStart(0);
    a.TICKER.stop();
    const step = n => {
      const end = a.TR.tick + n;
      while (a.TR.playing && !a.TR.ending && a.TR.tick < end) {
        a.processTick(a.TR.tick, a.TR.nextTime);
        a.advance();
      }
    };
    const fadedT = new Set(),
      watch = n => {
        const end = a.TR.tick + n;
        while (a.TR.playing && !a.TR.ending && a.TR.tick < end) {
          a.processTick(a.TR.tick, a.TR.nextTime);
          (LV.autos || []).forEach(m => m.tag === 'fade' && m.tracks.forEach(t => fadedT.add(S.tracks[t].ch)));
          a.advance();
        }
      };
    watch(32 * 16);
    for (let i = 1; i < 4; i++) {
      a.liveScene(i, a.TR.tick);
      watch(32 * 8);
    }
    LV.cues.push({ type: 'stop', tick: a.TR.tick + 32 });
    LV.cues.sort((x, y) => x.tick - y.tick);
    step(32 * 6);
    a.stopAll();
    const ex = {};
    window.__out.forEach(b => {
      if ((b[0] & 0xf0) === 0xb0 && b[1] === 11) (ex[(b[0] & 15) + 1] = ex[(b[0] & 15) + 1] || []).push(b[2]);
    });
    return {
      tracks: fadedT.size,
      wentDown: [...fadedT].every(ch => ex[ch] && Math.min(...ex[ch]) < 20),
      endFull: Object.values(ex).every(v => v[v.length - 1] === 127),
      left: Object.keys(LV.low || {}).length
    };
  });
  assert.ok(r.tracks >= 1, 'pads and chords fade');
  assert.ok(r.wentDown, 'each fade goes down');
  assert.ok(r.endFull, 'every track ends at full level');
  assert.equal(r.left, 0);
  assert.deepEqual(errors, []);
});

test('fills end on the downbeat they lead into; bass and melodies never fade, pads still do', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV,
      S = a.S;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, {
      style: 'liquid',
      seed: 5,
      custom: false,
      auto: true,
      vary: 100,
      entry: 'long',
      buildFx: false
    });
    a.liveBuild();
    window.__out.length = 0;
    a.liveStart(0);
    a.TICKER.stop();
    const fills = [],
      scenes = [];
    let lastFill = null;
    const fadedT = new Set(),
      end = a.TR.tick + 32 * 64;
    while (a.TR.playing && !a.TR.ending && a.TR.tick < end) {
      a.processTick(a.TR.tick, a.TR.nextTime);
      if (LV.fill && LV.fill !== lastFill) fills.push([LV.fill.start, LV.fill.end]);
      lastFill = LV.fill;
      if (scenes[scenes.length - 1] !== LV.sceneStart) scenes.push(LV.sceneStart);
      (LV.autos || []).forEach(m => m.tag === 'fade' && m.tracks.forEach(t => fadedT.add(t)));
      a.advance();
    }
    a.stopAll();
    const faded = [...fadedT].map(t => (S.tracks[t].type === 'tone' ? a.lvFadeKind(t) : 'drum'));
    return { fills, faded };
  });
  assert.ok(r.fills.length >= 2, 'some fills played');
  for (const [s, e] of r.fills) {
    assert.equal(e - s, 32, 'a fill lasts one bar');
    assert.equal(e % 32, 0, 'and ends on a bar line');
  }
  assert.ok(!r.faded.includes('cut'), 'bass and melodies are never faded');
  assert.ok(r.faded.includes('pad') || r.faded.includes('chords'), 'pads and chords still fade');
  assert.deepEqual(errors, []);
});

test('Raven mode: a track you play is left alone (no pattern, no effects) until 4 bars after your last note', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV,
      S = a.S;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'liquid', seed: 5, custom: false, auto: true, vary: 60, buildFx: true, perfOn: true });
    a.liveBuild();
    a.liveStart(0);
    a.TICKER.stop();
    const t = 6,
      ch = S.tracks[t].ch;
    let note = 100;
    while (
      LV.padNotes.includes(note) ||
      (note >= LV.keyBase && note < LV.keyBase + 12) ||
      (note >= LV.muteBase && note < LV.muteBase + 12)
    )
      note++;
    const step = n => {
      const end = a.TR.tick + n;
      while (a.TR.playing && !a.TR.ending && a.TR.tick < end) {
        a.processTick(a.TR.tick, a.TR.nextTime);
        a.advance();
      }
    };
    /* the app's messages to the lead's channel: notes and effects */
    const count = from => {
      const m = window.__out.slice(from).filter(b => (b[0] & 15) === ch - 1);
      return {
        notes: m.filter(b => (b[0] & 0xf0) === 0x90 && b[2] > 0 && b[1] !== note).length,
        cc: m.filter(b => (b[0] & 0xf0) === 0xb0).length
      };
    };
    step(32 * 4);
    /* play a short phrase on the lead track for 4 bars, then a rising build is fired on every track */
    window.__out.length = 0;
    const pre = window.__out.length;
    for (let i = 0; i < 8; i++) {
      window.__inject([0x90 | (ch - 1), note, 100]);
      step(8);
      window.__inject([0x80 | (ch - 1), note, 0]);
      step(8);
    }
    a.liveBuildDrop();
    const ownedMid = a.lvUserOwns(t);
    step(32 * 3);
    const during = count(pre),
      stillOwned = a.lvUserOwns(t);
    const mark = window.__out.length;
    step(32 * 3);
    const back = !a.lvUserOwns(t),
      after = count(mark);
    a.stopAll();
    return { ownedMid, stillOwned, during, back, after };
  });
  assert.ok(r.ownedMid && r.stillOwned, 'the track is yours while you play and for a while after');
  assert.equal(r.during.notes, 0, 'the app plays no pattern notes on it');
  assert.ok(r.during.cc <= 4, 'only the reset to rest is sent, no build effects (' + r.during.cc + ')');
  assert.ok(r.back, 'the app takes it back 4 bars after your last note');
  assert.ok(r.after.notes > 0, 'and plays its pattern again');
  assert.deepEqual(errors, []);
});

test('on stage: a freeze does not burst, a broken tick does not stop the music, a pulled cable comes back in time', async () => {
  const { page, errors } = await openApp();
  await page.click('#menubar .mtab[data-mode=live]');
  const r = await page.evaluate(async () => {
    const a = window.__app,
      LV = a.LV,
      TR = a.TR;
    a.ensureAudio();
    await a.connectMidi();
    Object.assign(LV, { style: 'deephouse', seed: 3, custom: false, auto: false });
    a.liveBuild();
    a.liveStart(0);
    a.TICKER.stop();
    /* a 2-second freeze: the clock is 2 s behind; one scheduler run must not fire 2 s of ticks */
    const tick0 = TR.tick;
    TR.nextTime -= 2;
    a.sched();
    const freeze = { ticks: TR.tick - tick0, late: TR.late || 0 };
    /* a broken pattern on one track: the tick fails, the clock moves on, the others keep playing */
    const t0 = TR.tick;
    LV.voices[3] = [{ f: null, start: 0, env: { v0: 1, v1: 1, t0: 0, t1: 0 } }];
    for (let i = 0; i < 40; i++) {
      try {
        a.sched();
      } catch (e) {
        return { thrown: String(e) };
      }
      TR.nextTime -= 0.1;
    }
    const broken = { moved: TR.tick > t0, errs: TR.errs || 0 };
    LV.voices[3] = [];
    /* the cable: unplugged, then back */
    const acc = await navigator.requestMIDIAccess();
    const port = acc.outputs.get('o1');
    port.state = 'disconnected';
    await a.connectMidi();
    const warn = document.querySelector('#linkWarn');
    const lost = !!warn && !warn.hidden && /disconnected/.test(warn.textContent);
    port.state = 'connected';
    window.__out.length = 0;
    await a.connectMidi();
    const back = {
      hidden: warn.hidden,
      notesOff: window.__out.some(b => (b[0] & 0xf0) === 0xb0 && b[1] === 123),
      levels: window.__out.filter(b => (b[0] & 0xf0) === 0xb0 && b[1] === 11 && b[2] === 127).length,
      playing: TR.playing
    };
    a.stopAll();
    return { freeze, broken, lost, back };
  });
  assert.ok(!r.thrown, 'the scheduler never throws: ' + r.thrown);
  assert.ok(
    r.freeze.ticks < 20,
    'after a freeze it carries on instead of firing every missed tick (' + r.freeze.ticks + ')'
  );
  assert.ok(r.freeze.late >= 1);
  assert.ok(r.broken.moved && r.broken.errs > 0, 'a broken tick is logged and the clock moves on');
  assert.ok(r.lost, 'unplugging shows the warning');
  assert.ok(
    r.back.hidden && r.back.notesOff && r.back.playing,
    'plugging back in hides it, releases notes, carries on'
  );
  assert.ok(r.back.levels >= 3, 'track levels are sent again (' + r.back.levels + ')');
  assert.ok(errors.length <= 1, 'only the deliberate broken tick reports an error: ' + errors.join(' | '));
});
