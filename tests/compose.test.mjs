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

test('Compose: each genre keeps its conventions (backbeat, kick, bass register, skank, plucks)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { composer } = window.__app.compose,
      out = {};
    for (const st of window.__app.STYLES) {
      const o = (out[st.id] = {
        sn: {},
        four: 0,
        bars: 0,
        bass: [],
        skank: 0,
        chordOn: 0,
        pluck: 0,
        maj7: 0,
        fine: 0,
        offRise: 0,
        roll: 0
      });
      for (const seed of [3, 11, 29]) {
        const c = composer(st, { seed, minutes: 4 }),
          P = (role, v) => {
            const k = c.make(role, v);
            return k ? c.patterns[k].notes : [];
          };
        const kit = P('kit', 'A');
        for (let b = 0; b < 8; b++) {
          const at = lanes =>
            new Set(kit.filter(n => Math.floor(n.s / 16) === b && lanes.includes(n.n) && n.v >= 85).map(n => n.s % 16));
          for (const s of at([2, 3])) o.sn[s] = (o.sn[s] || 0) + 1;
          if ([0, 4, 8, 12].every(s => at([0]).has(s))) o.four++;
          o.bars++;
        }
        o.fine += P('hats', 'A').filter(n => n.s % 1).length;
        for (const v of ['A', 'B', 'C']) o.bass.push(...P('bass', v).map(n => n.n));
        for (const n of P('chords', 'A')) (o.chordOn++, n.s % 4 >= 2 && o.skank++);
        o.pluck += P('pluck', 'drop').length / 8 / 3;
        if (c.scale === 'major') o.maj7 += c.chords.filter(x => x.tones[1] === 4 && x.tones.includes(11)).length;
        /* the Lift: the riser's held notes are the bar's chord's own; a snare roll only where it belongs */
        for (const n of P('pluck', 'rise').filter(n => n.l >= 16)) {
          const ch = c.chords[Math.floor(n.s / 16) % c.chords.length];
          if (!ch.tones.some(t => (ch.root + t) % 12 === n.n % 12)) o.offRise++;
        }
        o.roll += P('perc', 'build').filter(n => n.n === 2).length / 3;
      }
      o.bass.sort((a, b) => a - b);
      o.bassMed = o.bass[o.bass.length >> 1];
      o.bassLo = o.bass[0];
      delete o.bass;
    }
    return out;
  });
  /* the backbeat: on 2 and 4, or on 3 where the genre is counted in half time */
  const ON3 = ['halftime', 'trap', 'drill', 'dubstep', 'riddim', 'reggae', 'dub', 'cinematic'],
    OTHER = ['dancehall', 'reggaeton', 'ambient'];
  for (const [id, o] of Object.entries(r)) {
    if (OTHER.includes(id)) continue;
    const want = ON3.includes(id) ? [8] : [4, 12];
    /* (the last bar of a groove is its fill) */
    for (const s of want)
      assert.ok((o.sn[s] || 0) >= o.bars - 6, id + ': the backbeat on step ' + s + ' ' + JSON.stringify(o.sn));
    if (!ON3.includes(id)) assert.ok((o.sn[8] || 0) < o.bars / 2, id + ': no half-time snare ' + JSON.stringify(o.sn));
    /* a bass sits low: its middle note under C3, nothing under C1 */
    assert.ok(o.bassMed <= 47 && o.bassLo >= 24, id + ': bass register ' + o.bassLo + ' to middle ' + o.bassMed);
  }
  for (const id of ['deephouse', 'classichouse', 'techhouse', 'techno', 'minimal', 'trance', 'disco', 'reggaeton'])
    assert.ok(r[id].four >= r[id].bars - 3, id + ': four on the floor (' + r[id].four + '/' + r[id].bars + ')');
  /* Memphis is counted slow: hats finer than 16ths (the rolls), the snare on 2 and 4 (checked above) */
  assert.ok(r.memphis.fine > 0, 'memphis: 32nd hat rolls');
  /* the skank is on the offbeats */
  for (const id of ['reggae', 'dub'])
    assert.equal(r[id].skank, r[id].chordOn, id + ': the skank on the “and” of each beat');
  /* funk vamps on dominant sevenths, not major sevenths */
  assert.equal(r.funk.maj7, 0, 'funk: no major sevenths on its major chords');
  /* a running arp where the genre has one, a few notes elsewhere */
  for (const id of ['trance', 'deephouse', 'synthwave', 'disco'])
    assert.ok(r[id].pluck >= 7, id + ': an arp (' + r[id].pluck + ')');
  for (const id of ['trap', 'drill', 'techno', 'minimal', 'dub', 'boombap', 'dubstep', 'neuro'])
    assert.ok(r[id].pluck <= 5, id + ': a sparse pluck (' + r[id].pluck + ')');
  for (const [id, o] of Object.entries(r)) assert.equal(o.offRise, 0, id + ': the riser holds notes of the chords');
  for (const id of ['lofi', 'boombap', 'neosoul', 'reggae', 'dub', 'funk'])
    assert.ok(r[id].roll <= 4, id + ': no snare-roll riser (' + r[id].roll + ')');
  for (const id of ['techno', 'trance', 'neuro', 'deephouse'])
    assert.ok(r[id].roll > 30, id + ': a snare roll into the drop');
  assert.deepEqual(errors, []);
});

test('Compose: a build has four shapes of its kick, perc, bass and riser, all on the chords', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const { composer } = window.__app.compose,
      out = { same: [], off: [], empty: [], long: [] };
    for (const st of window.__app.STYLES) {
      const c = composer(st, { seed: 5, minutes: 4 });
      for (const [role, base] of [
        ['kit', 'build'],
        ['perc', 'build'],
        ['bass', 'build'],
        ['pluck', 'rise']
      ]) {
        const sigs = new Set();
        for (let k = 0; k < 4; k++) {
          const key = c.make(role, base + (k || ''));
          if (!key) {
            /* (a style whose own build leaves a part out, ambient's kick, has no shapes of it to mix in) */
            if (k) out.empty.push(st.id + ' ' + role + k);
            else break;
            continue;
          }
          const ns = c.patterns[key].notes;
          sigs.add(JSON.stringify(ns.map(n => [n.s, n.n])));
          if (ns.some(n => n.s + 0 >= 128 || n.l < 1)) out.long.push(st.id + ' ' + role + k);
          /* a shape's held or repeated notes are the bar's chord's own (its last-bar climb is in the key) */
          if (k && (role === 'bass' || role === 'pluck'))
            for (const n of ns.filter(n => n.s < 112)) {
              /* (a pickup on the last 8th may belong to the chord it leads into) */
              const bar = Math.floor(n.s / 16),
                on = b => {
                  const ch = c.chords[b % c.chords.length];
                  return ch.tones.some(t => (ch.root + t) % 12 === n.n % 12);
                };
              if (!on(bar) && !(n.s % 16 >= 14 && on(bar + 1))) out.off.push(st.id + ' ' + role + k + '@' + n.s);
            }
        }
        if (sigs.size && sigs.size < 4) out.same.push(st.id + ' ' + role + ' ' + sigs.size);
      }
    }
    return out;
  });
  assert.deepEqual(r.empty, [], 'every shape writes something');
  assert.deepEqual(r.same, [], 'four different shapes of each part');
  assert.deepEqual(r.off, [], 'bass and riser shapes stay on the chords');
  assert.deepEqual(r.long, []);
  assert.deepEqual(errors, []);
});
