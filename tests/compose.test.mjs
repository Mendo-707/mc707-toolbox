// The composer (the Song wizard's Compose it now): every style writes a song that fits the MC-707 (Scene Mode's
// 16 clips a track, valid notes), the window puts it in the song and Scene Mode, and the song saves as
// an MC-707 project with every note in.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Compose: every style writes a whole song that fits the MC-707', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { compose } = window.__app.compose,
      styles = window.__app.STYLES.filter(s => s.fam !== 'all'),
      out = [];
    for (const st of styles) {
      const s = compose(st, { minutes: 4, seed: 7 }),
        per = {},
        bad = [];
      for (const [k, p] of Object.entries(s.patterns)) {
        per[p.role] = (per[p.role] || 0) + 1;
        for (const n of p.notes)
          if (
            n.s < 0 ||
            n.s >= p.bars * 16 ||
            n.l < 1 ||
            n.v < 1 ||
            n.v > 127 ||
            (p.type === 'drum' ? n.n > 11 : n.n < 12 || n.n > 108)
          )
            bad.push(k);
      }
      const bars = s.sections.reduce((a, x) => a + x.bars, 0),
        roles = new Set(s.sections.flatMap(x => Object.keys(x.parts)));
      out.push({
        id: st.id,
        bars,
        minutes: (bars * 4) / s.bpm,
        most: Math.max(...Object.values(per)),
        bad: bad.length,
        drums: roles.has('kit'),
        tones: ['bass', 'chords', 'lead'].filter(x => roles.has(x)).length,
        again: JSON.stringify(compose(st, { minutes: 4, seed: 7 }).patterns) === JSON.stringify(s.patterns),
        other: JSON.stringify(compose(st, { minutes: 4, seed: 8 }).patterns) !== JSON.stringify(s.patterns)
      });
    }
    return out;
  });
  assert.ok(r.length >= 40, 'every style: ' + r.length);
  for (const x of r) {
    assert.equal(x.bad, 0, x.id + ': notes in range');
    assert.ok(x.most <= 16, x.id + ': at most 16 patterns a part');
    assert.ok(x.minutes > 2.5 && x.minutes < 6, x.id + ': about the length asked for (' + x.minutes.toFixed(1) + ')');
    assert.ok(x.drums || /ambient/.test(x.id), x.id + ': has drums');
    assert.ok(x.tones >= 2, x.id + ': bass, chords and a lead');
    assert.ok(x.again, x.id + ': the same take comes out the same');
  }
  assert.ok(r.filter(x => x.other).length > r.length / 2, 'another take is a different song');
  assert.deepEqual(errors, []);
});

test('Song wizard › Compose it now: writes the song and its scenes, and it saves as an MC-707 project', async () => {
  const { page, errors } = await openApp();
  const before = await page.evaluate(() => JSON.stringify(window.__app.S.clips));
  await page.locator('#menubar .mb', { hasText: 'Song' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Song wizard' }).click();
  await page.locator('.scard', { hasText: 'Neurofunk' }).click();
  const box = page.locator('.wCompose');
  await box.locator('select[aria-label=Length]').selectOption('3');
  await box.locator('button', { hasText: 'Compose it now' }).click();
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const A = window.__app,
      S = A.S,
      marks = S.markers.map(m => m.name),
      { bytes, song } = await A.mpj.bytes('Composed');
    return {
      bpm: S.bpm,
      clips: S.clips.length,
      pats: Object.keys(S.patterns).length,
      marks,
      rows: S.scn ? S.scn.rows.length : 0,
      lost: song.lost,
      scenes: song.scenes.length,
      size: bytes.length,
      end: Math.max(...S.clips.map(c => c.start + c.len))
    };
  });
  assert.equal(r.bpm, 174);
  assert.ok(r.clips > 30 && r.pats > 15, 'a whole song: ' + r.clips + ' clips');
  assert.ok(r.marks.includes('Drop') && r.marks.includes('Build') && r.marks.includes('Intro'), 'sections marked');
  assert.equal(r.rows, r.marks.length, 'a scene for each section');
  assert.deepEqual(r.lost, [], 'every note goes in the project file');
  assert.equal(r.scenes, r.rows);
  assert.ok(r.end >= 120, 'about three minutes: ' + r.end + ' bars');
  /* one undo step brings the song back */
  await page.locator('#bUndo').click();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__app.S.clips)), before);
  assert.deepEqual(errors, []);
});

test('Compose: every take plays its parts its own way (drums, bass and chords are not the same each time)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { compose } = window.__app.compose,
      out = {};
    const sig = p => p.notes.map(n => n.s + ':' + n.n + ':' + n.l).join(' ');
    for (const id of ['liquid', 'trap', 'deephouse', 'techno', 'boombap', 'pop']) {
      const st = window.__app.STYLES.find(s => s.id === id),
        per = {};
      for (let seed = 1; seed <= 8; seed++)
        for (const p of Object.values(compose(st, { minutes: 3, seed }).patterns))
          if (['kit', 'bass', 'chords'].includes(p.role) && /^([ABC]|verse)$/.test(p.variant))
            (per[p.role] = per[p.role] || new Set()).add(p.variant + sig(p));
      out[id] = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.size]));
    }
    return out;
  });
  for (const [id, roles] of Object.entries(r))
    for (const [role, n] of Object.entries(roles)) {
      /* the A, B, C and verse parts over 8 takes */
      assert.ok(n >= (role === 'kit' ? 14 : 10), id + ' ' + role + ': ' + n + ' different in 8 takes');
    }
  assert.deepEqual(errors, []);
});

test('Compose: new material for every take (progressions, basslines and melodies are made, not just picked)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { compose } = window.__app.compose,
      out = {};
    const at = p => (p ? p.notes.map(n => n.s).join() : '');
    const all = p => (p ? p.notes.map(n => n.s + ':' + n.n).join() : '');
    for (const id of ['liquid', 'deephouse', 'boombap', 'pop']) {
      const st = window.__app.STYLES.find(s => s.id === id),
        n = { prog: new Set(), bass: new Set(), lead: new Set() };
      for (let seed = 1; seed <= 60; seed++) {
        const s = compose(st, { minutes: 2, seed });
        n.prog.add(s.prog);
        n.bass.add(at(s.patterns['bass:A'] || s.patterns['bass:verse']));
        n.lead.add(all(s.patterns['lead:hook'] || s.patterns['lead:A']));
      }
      out[id] = [n.prog.size, n.bass.size, n.lead.size];
    }
    return out;
  });
  for (const [id, [prog, bass, lead]] of Object.entries(r)) {
    assert.ok(prog >= 25, id + ': ' + prog + ' progressions in 60 takes');
    assert.ok(bass >= 20, id + ': ' + bass + ' bass rhythms in 60 takes');
    assert.ok(lead >= 55, id + ': ' + lead + ' melodies in 60 takes');
  }
  assert.deepEqual(errors, []);
});

test('Compose: Dark and Hard moods: minor and dark chord moves, harder hits, shorter bass and stabs', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { compose } = window.__app.compose,
      out = {};
    for (const [name, m] of Object.entries({ plain: {}, banger: { dark: 0.9, edge: 0.95 } })) {
      let bright = 0,
        major = 0,
        kv = 0,
        kn = 0,
        bl = 0,
        bn = 0;
      for (const id of ['liquid', 'deephouse', 'pop', 'trance'])
        for (let seed = 1; seed <= 20; seed++) {
          const s = compose(
              window.__app.STYLES.find(x => x.id === id),
              { minutes: 2, seed, ...m }
            ),
            toks = String(s.prog).split(':').pop().split('.');
          if (s.scale === 'major') major++;
          for (let i = 1; i < toks.length; i++) if (toks[i - 1] === '7' && toks[i] === '1') bright++;
          for (const p of Object.values(s.patterns)) {
            if (p.role === 'kit') for (const n of p.notes) if (n.n === 0) ((kv += n.v), kn++);
            if (p.role === 'bass' && /^[ABC]$/.test(p.variant)) for (const n of p.notes) ((bl += n.l), bn++);
          }
        }
      out[name] = { bright, major, kick: kv / kn, bass: bl / bn };
    }
    return out;
  });
  assert.equal(r.banger.major, 0, 'the dark is never in a major key');
  assert.ok(
    r.banger.bright < r.plain.bright && r.banger.bright <= 2,
    'hardly a bright seven-to-one: ' + JSON.stringify(r)
  );
  assert.ok(r.banger.kick > r.plain.kick + 4, 'harder kicks');
  assert.ok(r.banger.bass < r.plain.bass * 0.8, 'shorter, punchier bass');
  assert.deepEqual(errors, []);
});

test('More takes of one song: the same chords, other melodies, and the drums turned (downbeat and backbeat kept)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { composer, compose } = window.__app.compose,
      out = {
        kits: 0,
        kitSame: 0,
        hatSame: 0,
        back: 0,
        down: 0,
        bassSame: 0,
        n: 0,
        chords: 0,
        second: 0,
        songs: 0,
        clips: 0
      };
    const pos = p => JSON.stringify(p.notes.map(n => [n.s, n.n])),
      strong = p =>
        p.notes
          .filter(n => (n.n === 2 || n.n === 3) && n.v >= 70 && n.s < 48)
          .map(n => n.s)
          .join();
    for (const id of ['liquid', 'neuro', 'boombap', 'trap', 'deephouse', 'techno', 'pop', 'lofi'])
      for (const seed of [1, 2, 3]) {
        const st = window.__app.STYLES.find(x => x.id === id),
          c = composer(st, { seed, key: 5 }),
          plain = composer(st, { seed: seed + 500, key: 5, like: c }),
          d = composer(st, { seed: seed + 500, key: 5, like: c, turn: 2 });
        out.n++;
        if (JSON.stringify(d.chords) === JSON.stringify(c.chords) && d.scale === c.scale && d.prog === c.prog)
          out.chords++;
        for (const v of ['A', 'B']) {
          const a = plain.patterns[plain.make('kit', v)],
            b = d.patterns[d.make('kit', v)];
          out.kits++;
          if (pos(a) === pos(b)) out.kitSame++;
          if (strong(a) === strong(b)) out.back++;
          if (b.notes.some(n => n.n === 0 && n.s === 0)) out.down++;
          const ha = plain.make('hats', v),
            hb = d.make('hats', v);
          if (ha && hb && pos(plain.patterns[ha]) === pos(d.patterns[hb])) out.hatSame++;
        }
        if (pos(c.patterns[c.make('bass', 'A')]) === pos(d.patterns[d.make('bass', 'A')])) out.bassSame++;
        /* a whole song: a main groove that comes back in the second half is turned, within 16 clips a track */
        const s = compose(st, { seed, minutes: 4 });
        out.songs++;
        if (Object.keys(s.patterns).some(k => /^kit:[ABC]~1$/.test(k))) out.second++;
        out.clips = Math.max(out.clips, new Set(s.sections.map(x => x.parts.kit).filter(Boolean)).size);
      }
    return out;
  });
  assert.equal(r.chords, r.n, 'every take keeps the chords');
  assert.equal(r.back, r.kits, 'the backbeat stays');
  assert.equal(r.down, r.kits, 'the downbeat kick stays');
  assert.ok(r.kitSame <= r.kits * 0.1, 'turned kits differ: ' + JSON.stringify(r));
  assert.ok(r.hatSame <= r.kits * 0.15, 'turned hats differ: ' + JSON.stringify(r));
  assert.ok(r.bassSame <= 2, 'another take, another bassline');
  assert.ok(r.second >= r.songs * 0.6, 'songs bring a groove back turned: ' + JSON.stringify(r));
  assert.ok(r.clips <= 12, 'kit patterns in a song: ' + r.clips);
  assert.deepEqual(errors, []);
});
