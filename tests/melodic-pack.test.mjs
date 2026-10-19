// The melodic pack (src/library/melodic-pack.js): every new part is in time, follows its progression
// (same name, length and key as chords already in the library, so Live Mode fits them together),
// stays in key or on the chord sounding, and adds real rhythmic variety.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';
import { SCALES } from '../src/core/theory.js';

after(closeBrowser);

test('melodic pack: in time, on its progression, in key, and new rhythms', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(SC => {
    const FAC = window.__app.FAC,
      PROG = /((?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3,}b?[ivIV]{1,3}[A-Za-z0-9]*)/,
      pc = n => ((n % 12) + 12) % 12;
    const mx = FAC.filter(f => f.mx),
      src = FAC.filter(f => !f.mx && f.pool === 'chords' && !f.busy && PROG.test(f.name));
    const groups = new Map();
    for (const f of src) {
      const k = f.genre + '|' + PROG.exec(f.name)[1] + '|' + f.bars + '|' + f.keyName;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(f);
    }
    const bad = [],
      ids = new Set(),
      firstIdx = FAC.findIndex(f => f.mx);
    const note = (what, f) => bad.length < 10 && bad.push(what + ': ' + f.id + ' ' + f.name);
    for (const f of mx) {
      if (ids.has(f.id) || !f.id.startsWith('mx')) note('id', f);
      ids.add(f.id);
      const m = PROG.exec(f.name),
        k = m && f.genre + '|' + m[1] + '|' + f.bars + '|' + f.keyName;
      if (!m || !groups.has(k)) {
        note('no matching chords', f);
        continue;
      }
      if (f.type !== 'tone' || !f.notes.length) note('empty', f);
      const T = f.bars * 16;
      if (f.notes.some(n => n.s < 0 || n.s >= T || n.l <= 0 || n.s + n.l > T + 0.01 || n.n < 24 || n.n > 108))
        note('out of time or range', f);
      /* leads: in the scale, or a note of the chord last struck (a borrowed chord such as a major V) */
      if (f.pool === 'lead') {
        const sc = SC[f.key.scale],
          chords = groups.get(k);
        for (const n of f.notes) {
          if (sc.includes(pc(n.n - f.key.root))) continue;
          const ok = chords.some(c => {
            const st = Math.max(...c.notes.filter(x => x.s <= n.s + 0.01).map(x => x.s), -1);
            return c.notes.some(x => x.s === st && pc(x.n) === pc(n.n));
          });
          if (!ok) {
            note('out of key at ' + n.s, f);
            break;
          }
        }
      }
    }
    const rhythm = f => [...new Set(f.notes.filter(n => n.s < 16).map(n => Math.round(n.s * 2)))].join(',');
    const distinct = {};
    for (const p of ['pad', 'pluck', 'lead', 'chords'])
      distinct[p] = new Set(FAC.filter(f => f.pool === p).map(rhythm)).size;
    return { count: mx.length, bad, distinct, after: FAC.slice(firstIdx).every(f => f.mx), groups: groups.size };
  }, SCALES);
  assert.deepEqual(r.bad, []);
  assert.ok(r.count > 10000, 'over 10,000 new parts (' + r.count + ')');
  assert.ok(r.after, 'the pack comes last, after every older pattern, so no older id moves');
  assert.ok(r.distinct.pad >= 20 && r.distinct.pluck >= 20 && r.distinct.lead >= 30, JSON.stringify(r.distinct));
  assert.deepEqual(errors, []);
});
