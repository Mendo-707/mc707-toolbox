// Where the five tone parameters that moved sit in a 1632-byte tone record (zen/zc-factory.js FW_MAP).
// The portamento curve and the partial LFO phase lock are at bytes 48 and 49, and fine bend up, fine bend
// down and pitch drift at 1436, 1437 and 1438. An MC-707 at system 1.82 reads them there: tones written
// this way loaded from a .svz file and read back over SysEx with every value as written. Bytes 44 to 47
// are Roland's reserved phrase fields (factory projects hold a phrase number at 18 and 100 at 45), and
// 1435 is unused; reading a tone must not need them and writing one must leave them as they were.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

const MOVED = {
  'CMN.PORTA_CRV': 48,
  'CMN.PTL_LFO_LOCK': 49,
  'SCMN.BEND_RANGE_FINE_UP': 1436,
  'SCMN.BEND_RANGE_FINE_DW': 1437,
  'SCMN.RND_PIT_VAL': 1438
};
/* bytes no tone parameter may use: the reserved phrase fields, and the one unused byte among them */
const KEEP_OUT = [18, 19, 44, 45, 46, 47, 1435];

test('Tone records: the five moved parameters, read, written and kept apart from the reserved bytes', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  const r = await page.evaluate(`(() => {
    const { FW_REC, fwFields, fwTone, fwRecord, newSound } = ${z}.fw;
    const moved = ${JSON.stringify(MOVED)}, keepOut = ${JSON.stringify(KEEP_OUT)};
    const at = {}, used = new Map();
    for (const [k, o, t] of fwFields()) {
      at[k] = o;
      const n = { a: 16, b: 1, c: 1, w: 2, s: 2 }[t];
      for (let i = 0; i < n; i++) used.set(o + i, (used.get(o + i) || []).concat(k));
    }
    const overlaps = [...used].filter(([, ks]) => ks.length > 1).map(([o, ks]) => o + ':' + ks.join('+'));
    const inKeepOut = keepOut.filter(o => used.has(o)).map(o => o + ':' + used.get(o).join('+'));
    /* a record as Roland's files hold it: the five set, phrase data in the reserved bytes */
    const rec = new Uint8Array(FW_REC);
    rec.set([...'Moved Five Test '].map(c => c.charCodeAt(0)), 0);
    const base = fwRecord(newSound('tone'), new Uint8Array(FW_REC));
    rec.set(base.subarray(16), 16);
    rec[18] = 240; rec[45] = 100;
    rec[48] = 2; rec[49] = 1; rec[1436] = 37; rec[1437] = 59; rec[1438] = 200;
    const snd = fwTone(rec, 0);
    const read = snd && Object.fromEntries(Object.keys(moved).map(k => [k, snd.v[k]]));
    /* written over a record with phrase data: the five land at their bytes, the reserved ones stay */
    const back = fwRecord(snd, rec);
    const same = back.every((x, i) => x === rec[i]);
    const changed = newSound('tone');
    Object.assign(changed.v, snd.v, { 'CMN.PORTA_CRV': 1, 'CMN.PTL_LFO_LOCK': 0, 'SCMN.BEND_RANGE_FINE_UP': 100,
      'SCMN.BEND_RANGE_FINE_DW': 100, 'SCMN.RND_PIT_VAL': 255 });
    const out = fwRecord(changed, rec);
    return { at, overlaps, inKeepOut, read, same, five: [out[48], out[49], out[1436], out[1437], out[1438]],
      kept: [out[18], out[45], out[1435]] };
  })()`);
  for (const [k, o] of Object.entries(MOVED)) assert.equal(r.at[k], o, k + ' sits at byte ' + o);
  assert.deepEqual(r.overlaps, [], 'no two parameters share a byte');
  assert.deepEqual(r.inKeepOut, [], 'no parameter uses a reserved byte or byte 1435');
  assert.deepEqual(
    r.read,
    {
      'CMN.PORTA_CRV': 2,
      'CMN.PTL_LFO_LOCK': 1,
      'SCMN.BEND_RANGE_FINE_UP': 37,
      'SCMN.BEND_RANGE_FINE_DW': 59,
      'SCMN.RND_PIT_VAL': 200
    },
    'a record with phrase data reads, with the five as stored'
  );
  assert.ok(r.same, 'reading a record and writing it back over itself changes no byte');
  assert.deepEqual(r.five, [1, 0, 100, 100, 255], 'new values go to bytes 48, 49, 1436, 1437 and 1438');
  assert.deepEqual(r.kept, [240, 100, 0], 'the phrase bytes and byte 1435 keep what they held');
  assert.deepEqual(errors, []);
});

test('Tone records: an expansion file whose tones use the phrase bytes imports them all', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  const r = await page.evaluate(`(() => {
    const { FW_REC, fwRecord, fwTones, newSound } = ${z}.fw, n = 9;
    const b = new Uint8Array(1024 + n * FW_REC);
    for (let i = 0; i < n; i++) {
      const snd = newSound('tone');
      snd.v['CMN.NAME'] = 'Phrase Tone ' + i;
      snd.v['SCMN.RND_PIT_VAL'] = 10 * i;
      const rec = fwRecord(snd, new Uint8Array(FW_REC));
      rec[45] = 100; /* as in tones saved on an MC-707 that use a phrase */
      b.set(rec, 1024 + i * FW_REC);
    }
    return fwTones(b).map(t => [t.name, t.snd.v['SCMN.RND_PIT_VAL']]);
  })()`);
  assert.equal(r.length, 9, 'none is skipped (byte 45 used to be read as the 0 or 1 phase lock and fail)');
  assert.deepEqual(r[4], ['Phrase Tone 4', 40]);
  assert.deepEqual(errors, []);
});
