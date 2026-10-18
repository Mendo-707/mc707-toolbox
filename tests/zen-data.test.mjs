// ZenCore data checks that need no browser: every starter tone and every MFX preset only uses real
// parameters, inside their ranges; the step sequencer's patterns fit the STEP LFO.
import { test } from 'node:test';
import assert from 'node:assert/strict';

/* the modules read `window` for the Windows app's bridge; outside a browser there is none */
globalThis.window = globalThis.window || {};
const { paramOf } = await import('../src/zen/zc-tone.js');
const { STARTERS } = await import('../src/zen/zc-starters.js');
const { MORE_STARTERS, starterMenu } = await import('../src/zen/zc-starters-more.js');
const { MFX_PRESETS, mfxPreset } = await import('../src/zen/zc-mfx-presets.js');
const { SEQ_PATTERNS } = await import('../src/zen/zc-stepseq.js');

test('every starter tone uses real parameters, in range, and is in the Starters menu once', () => {
  const all = [...STARTERS, ...MORE_STARTERS];
  for (const [name, make] of all) {
    const snd = make();
    for (const [key, v] of Object.entries(snd.v)) {
      const d = paramOf('tone', key);
      assert.ok(d, name + ': unknown parameter ' + key);
      if (typeof v === 'number') assert.ok(v >= d[0][3] && v <= d[0][4], name + ': ' + key + ' = ' + v);
    }
  }
  const inMenu = starterMenu().flatMap(([, list]) => list.map(x => x[0]));
  assert.equal(inMenu.length, all.length);
  assert.equal(new Set(inMenu).size, all.length, 'no starter twice');
});

test('every MFX preset fits its effect type', () => {
  assert.ok(MFX_PRESETS.length >= 25);
  MFX_PRESETS.forEach((p, i) => {
    const r = mfxPreset(i);
    assert.equal(r.vals.length, 32, p[0]);
    r.vals.forEach(v => assert.ok(Number.isInteger(v) && Math.abs(v) <= 20000, p[0]));
  });
});

test('step sequencer patterns stay inside the STEP LFO range (±72 units, 4 per semitone)', () => {
  for (const [name, notes] of SEQ_PATTERNS) {
    assert.equal(notes.length, 16, name);
    for (const n of notes) if (n != null) assert.ok(Math.abs(n * 4) <= 72, name + ': ' + n);
  }
});
