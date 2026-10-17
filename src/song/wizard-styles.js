// The song wizard's choices: picking a style, its default sections and the patterns that fill them.
//
// Reads: WIZ, FAC, DEV.
import { NOTE_NAMES } from '../core/theory.js';
import { FAC } from '../library/factory.js';
import { DEV, oneKit } from '../core/device.js';
import { facById } from '../library/index.js';
import { SHORT } from './library-panel.js';
import { hashStr, mulberry } from '../core/random.js';
import { DNB_KINDS, HH_KINDS, KIND_TIPS, STRUCT, STYLES } from '../library/styles.js';
import { WIZ } from './wizard-ui.js';
import { lvFlavor, lvPool, lvProg } from '../library/pools.js';

export const kindsOf = fam => (fam === 'dnb' || fam === 'edm' ? DNB_KINDS : HH_KINDS);
STRUCT.edm = STRUCT.dnb;
STRUCT.song = STRUCT.hh;
KIND_TIPS.edm = KIND_TIPS.dnb;
KIND_TIPS.song = KIND_TIPS.hh;
export const KEYTXT = (n, sc) => NOTE_NAMES[n] + ((sc || 'minor') === 'minor' ? ' minor' : ' major');
STYLES.forEach(s => {
  if (!s.genre) s.genre = s.fam === 'dnb' ? 'dnb' : 'hiphop';
});
(function addStyles() {
  const T = (id, fam, name, vibe, bpm, swing, scale, keys, tips, bassName) => ({
    id,
    fam,
    name,
    vibe,
    bpm,
    swing,
    scale,
    keys,
    tips,
    bassName
  });
  const MIN = a => a.map(([r, w]) => [r, w]);
  const list = [
    T(
      'deephouse',
      'edm',
      'Deep house',
      'Warm, soft chords over a steady four-on-the-floor kick.',
      [120, 124, 122],
      52,
      'minor',
      [
        [9, 'Am: warm and the most common deep house key.'],
        [0, 'Cm: dark and smooth.'],
        [2, 'Dm: mellow and open.']
      ],
      [
        'Keep chords soft and slightly behind the kick so the groove can breathe.',
        'The offbeat open hat is the signature. Keep it steady.',
        'Add a shaker layer for movement.'
      ],
      'Sub'
    ),
    T(
      'classichouse',
      'edm',
      'Classic house',
      'Piano-style stabs, bouncy bass and a clap on 2 and 4.',
      [122, 128, 125],
      54,
      'minor',
      [
        [9, 'Am: bright and classic.'],
        [2, 'Dm: soulful.'],
        [7, 'Gm: punchy.']
      ],
      [
        'Short chord stabs on the offbeats are the heart of the sound.',
        'A clap on beats 2 and 4 with a shuffled hat keeps it groovy.'
      ],
      'Bass'
    ),
    T(
      'techhouse',
      'edm',
      'Tech house',
      'Tight, groovy and percussive with a rolling bass.',
      [124, 130, 126],
      50,
      'minor',
      [
        [9, 'Am: tight and common.'],
        [0, 'Cm: dark and driving.'],
        [5, 'Fm: heavy low end.']
      ],
      [
        'Keep the bass short and rolling so it locks to the kick.',
        'Layer percussion (rim, shaker, congas) for the tech groove.'
      ],
      'Bass'
    ),
    T(
      'afrohouse',
      'edm',
      'Afro house',
      'Warm percussion layers with a deep, flowing bassline.',
      [118, 126, 122],
      54,
      'minor',
      [
        [9, 'Am: warm and open.'],
        [2, 'Dm: soulful.'],
        [4, 'Em: bright.']
      ],
      [
        'Percussion does the talking: stack congas, shakers and rims.',
        'Keep chords sparse and let a simple melody float on top.'
      ],
      'Sub'
    ),
    T(
      'techno',
      'edm',
      'Techno',
      'Hard, driving and hypnotic.',
      [128, 142, 135],
      50,
      'minor',
      [
        [9, 'Am: the classic dark tone.'],
        [0, 'Cm: heavy.'],
        [4, 'Em: tense and open.']
      ],
      [
        'Repetition is the point. Change one thing every 8 bars.',
        'A steady rumble bass under a hard kick fills the low end.'
      ],
      'Rumble'
    ),
    T(
      'minimal',
      'edm',
      'Minimal techno',
      'Sparse, hypnotic and full of small details.',
      [122, 132, 128],
      52,
      'minor',
      [
        [9, 'Am: neutral and clean.'],
        [2, 'Dm: subtle.'],
        [0, 'Cm: dark.']
      ],
      ['Use fewer layers and let small changes carry the energy.', 'Leave space. A silent bar is a strong move.'],
      'Bass'
    ),
    T(
      'acidtechno',
      'edm',
      'Acid techno',
      'Squelchy acid lines over a pounding kick.',
      [126, 138, 132],
      50,
      'minor',
      [
        [9, 'Am: the classic acid key.'],
        [0, 'Cm: aggressive.'],
        [4, 'Em: biting.']
      ],
      [
        'The acid line is the star. Automate cutoff (CC 74) to make it squelch.',
        'Keep drums plain so the bassline cuts through.'
      ],
      'Acid'
    ),
    T(
      'ukgarage',
      'edm',
      'UK garage',
      'Skippy 2-step drums with a bouncing sub.',
      [128, 136, 132],
      58,
      'minor',
      [
        [9, 'Am: smooth.'],
        [0, 'Cm: dark and soulful.'],
        [2, 'Dm: warm.']
      ],
      [
        'Use swing (56–60%) and keep the kick off the beat for the 2-step feel.',
        'Chopped chord stabs and shuffled hats finish the sound.'
      ],
      'Sub'
    ),
    T(
      'speedgarage',
      'edm',
      'Speed garage',
      'Faster, heavier garage with a rolling bass.',
      [132, 140, 136],
      56,
      'minor',
      [
        [9, 'Am: tight.'],
        [0, 'Cm: heavy.'],
        [5, 'Fm: deep low end.']
      ],
      ['Keep the bass rolling and the snare crisp.', 'Use fills on the last bar of every 8 for energy.'],
      'Bass'
    ),
    T(
      'dubstep',
      'edm',
      'Dubstep',
      'Half-time weight with a wobbling bass.',
      [138, 142, 140],
      50,
      'minor',
      [
        [5, 'Fm: deep and heavy.'],
        [7, 'Gm: punchy.'],
        [4, 'Em: big sub.']
      ],
      [
        'The snare lands on beat 3, so bass hits can be long and slow.',
        'Automate cutoff (CC 74) for the wobble if your sound does not have an LFO.'
      ],
      'Wobble'
    ),
    T(
      'riddim',
      'edm',
      'Riddim',
      'Minimal, repetitive bass hits with big gaps.',
      [145, 155, 150],
      50,
      'minor',
      [
        [5, 'Fm: weighty.'],
        [7, 'Gm: sharp.'],
        [4, 'Em: deep.']
      ],
      ['Keep the pattern simple and repetitive. The sound design does the work.', 'Leave gaps so each hit lands hard.'],
      'Wobble'
    ),
    T(
      'trance',
      'edm',
      'Trance',
      'Euphoric, driving and melodic with a long build.',
      [134, 142, 138],
      50,
      'minor',
      [
        [9, 'Am: the classic trance key.'],
        [4, 'Em: uplifting.'],
        [2, 'Dm: emotional.']
      ],
      [
        'Build tension with filter and volume automation across a long build.',
        'A rolling offbeat bass keeps the energy up.'
      ],
      'Bass'
    ),
    T(
      'progtrance',
      'edm',
      'Progressive trance',
      'Slower, deeper and more gradual builds.',
      [124, 134, 130],
      50,
      'minor',
      [
        [9, 'Am: warm.'],
        [2, 'Dm: moody.'],
        [7, 'Gm: dark.']
      ],
      [
        'Make changes gradual: fade parts in and out with the Shape editor.',
        'Long pads and a simple arpeggio carry the mood.'
      ],
      'Bass'
    ),
    T(
      'electro',
      'edm',
      'Electro',
      'Robotic bounce and punchy drum machine hits.',
      [118, 130, 125],
      50,
      'minor',
      [
        [9, 'Am: classic.'],
        [0, 'Cm: dark.'],
        [4, 'Em: sharp.']
      ],
      ['Syncopated kicks and a tight clap are the base.', 'A simple, bouncy bass with a synthetic lead works well.'],
      'Bass'
    ),
    T(
      'breakbeat',
      'edm',
      'Breakbeat',
      'Chopped breaks and big funky bass.',
      [125, 138, 130],
      54,
      'minor',
      [
        [9, 'Am: funky.'],
        [0, 'Cm: dark.'],
        [2, 'Dm: warm.']
      ],
      ['The break drives the track, so keep the bass simple.', 'Use ghost snares and a swung hat for the funk.'],
      'Bass'
    ),
    T(
      'funk',
      'song',
      'Funk',
      'Tight pocket, slap-style bass and syncopated chords.',
      [96, 112, 105],
      56,
      'major',
      [
        [0, 'C: bright and easy.'],
        [7, 'G: classic funk.'],
        [5, 'F: warm.']
      ],
      [
        'Keep every part short and syncopated. Space is part of the groove.',
        'Ghost notes on the snare add the pocket.'
      ],
      'Bass'
    ),
    T(
      'disco',
      'song',
      'Disco',
      'Four-on-the-floor, octave bass and sparkling chords.',
      [112, 124, 118],
      52,
      'major',
      [
        [0, 'C: bright.'],
        [7, 'G: classic.'],
        [5, 'F: warm.']
      ],
      [
        'Octave bass and an open hat on the offbeat are the signature.',
        'Keep the kick on every beat and the strings or chords lush.'
      ],
      'Bass'
    ),
    T(
      'nudisco',
      'song',
      'Nu-disco',
      'Modern disco groove with warm synths.',
      [112, 122, 116],
      52,
      'major',
      [
        [0, 'C: bright.'],
        [5, 'F: warm.'],
        [10, 'B♭: smooth.']
      ],
      ['Combine a disco bass with soft synth chords.', 'Use filter automation on the chords to build energy.'],
      'Bass'
    ),
    T(
      'reggae',
      'song',
      'Reggae',
      'One-drop rhythm with a deep, melodic bass.',
      [68, 84, 75],
      56,
      'major',
      [
        [0, 'C: easy and open.'],
        [7, 'G: classic.'],
        [2, 'D: warm.']
      ],
      [
        'The kick and snare land together on beat 3 (the one drop).',
        'Let the bass be melodic and deep, with chord skanks on the offbeats.'
      ],
      'Bass'
    ),
    T(
      'dub',
      'song',
      'Dub',
      'Heavy bass, space and echo.',
      [64, 78, 70],
      54,
      'major',
      [
        [0, 'C: warm.'],
        [7, 'G: open.'],
        [5, 'F: deep.']
      ],
      [
        'Strip parts in and out like a mixing desk. Use mute and fades.',
        'Leave lots of space and let the bass carry the track.'
      ],
      'Sub'
    ),
    T(
      'dancehall',
      'song',
      'Dancehall',
      'Punchy drums with a bouncing riddim.',
      [90, 106, 98],
      52,
      'major',
      [
        [0, 'C: bright.'],
        [7, 'G: punchy.'],
        [9, 'A: sharp.']
      ],
      ['Short, bouncy bass and sparse chords.', 'Use a rim or snare accent pattern that skips around the beat.'],
      'Bass'
    ),
    T(
      'reggaeton',
      'song',
      'Reggaeton',
      'Dembow rhythm and a catchy minor-key hook.',
      [88, 100, 94],
      50,
      'minor',
      [
        [9, 'Am: the classic reggaeton key.'],
        [2, 'Dm: warm.'],
        [7, 'Gm: punchy.']
      ],
      ['The dembow snare pattern is the signature. Keep it steady.', 'Add a simple, singable lead and a deep bass.'],
      '808'
    ),
    T(
      'afrobeats',
      'song',
      'Afrobeats',
      'Warm, syncopated percussion with a pocket bass.',
      [96, 108, 100],
      54,
      'minor',
      [
        [9, 'Am: warm.'],
        [2, 'Dm: soulful.'],
        [4, 'Em: bright.']
      ],
      ['Layer congas, shakers and rim shots for the polyrhythm.', 'Keep chords light and the bass in the pocket.'],
      'Bass'
    ),
    T(
      'synthwave',
      'song',
      'Synthwave',
      'Retro, neon-lit drive with gated drums and big synths.',
      [92, 115, 100],
      50,
      'minor',
      [
        [9, 'Am: the retro default.'],
        [4, 'Em: moody.'],
        [2, 'Dm: warm.']
      ],
      [
        'Gated snare, driving 8th-note bass and big pads define the sound.',
        'Add a simple lead melody and arpeggio over the top.'
      ],
      'Bass'
    ),
    T(
      'pop',
      'song',
      'Pop',
      'Clean, bright and memorable, with strong hooks.',
      [100, 128, 118],
      50,
      'major',
      [
        [0, 'C: bright and easy.'],
        [7, 'G: open and popular.'],
        [2, 'D: sparkling.']
      ],
      [
        'Hooks matter most. Keep the lead simple and repeated.',
        'Use the bridge to change the chords before the final hook.'
      ],
      'Bass'
    ),
    T(
      'indie',
      'song',
      'Indie',
      'Jangly, light and organic.',
      [100, 130, 120],
      52,
      'major',
      [
        [2, 'D: jangly.'],
        [7, 'G: open.'],
        [9, 'A: bright.']
      ],
      ['Keep drums simple and loose, with a gentle swing.', 'Layer a pad and a simple lead for atmosphere.'],
      'Bass'
    ),
    T(
      'ambient',
      'song',
      'Ambient',
      'Slow, spacious pads and sparse percussion.',
      [60, 85, 70],
      50,
      'minor',
      [
        [9, 'Am: calm.'],
        [0, 'Cm: dark.'],
        [2, 'Dm: warm.']
      ],
      [
        'Fade parts in and out slowly with the Shape editor.',
        'Use long pads and sparse hits. Silence is part of the music.'
      ],
      'Sub'
    ),
    T(
      'cinematic',
      'song',
      'Cinematic',
      'Big, slow builds with deep drones and hits.',
      [65, 95, 80],
      50,
      'minor',
      [
        [9, 'Am: emotional.'],
        [0, 'Cm: dramatic.'],
        [2, 'Dm: epic.']
      ],
      [
        'Build energy with long swells: automate volume or filter across the section.',
        'Use deep sub hits and a tom or crash at the big moments.'
      ],
      'Sub'
    ),
    T(
      'phonk',
      'hh',
      'Phonk',
      'Cowbells, distorted 808s and a dark, driving groove.',
      [120, 145, 130],
      50,
      'minor',
      [
        [0, 'Cm: dark and heavy.'],
        [5, 'Fm: deep.'],
        [7, 'Gm: punchy.']
      ],
      ['The cowbell pattern and a heavy 808 define the sound.', 'Keep the melody dark and repetitive.'],
      '808'
    )
  ];
  list.forEach(m => {
    const gf = FAC.find(f => f.gen && f.styles && f.styles.includes(m.id));
    const genre = gf ? gf.genre : 'house';
    const pools = {},
      more = {};
    ['kit', 'hats', 'perc', 'fill', 'intro', 'bass', 'chords', 'pad', 'lead', 'pluck'].forEach(pool => {
      const all = FAC.filter(f => f.gen && f.pool === pool && f.styles.includes(m.id)).map(f => f.id);
      pools[pool] = all.slice(0, 10);
      more[pool] = all;
    });
    STYLES.push({ ...m, genre, pools, more });
    SHORT[m.id] = m.name;
  });
})();

export function defaultSecs(st, presetId) {
  const list = STRUCT[st.fam];
  const def =
    list.find(x => x.id === presetId) ||
    list.find(x => x.id === (st.fam === 'dnb' || st.fam === 'edm' ? 'club' : 'full')) ||
    list[0];
  const K = kindsOf(st.fam);
  return def.secs.map(([k, b]) => ({ kind: k, bars: b, name: K[k].name }));
}
export function defaultWiz(id) {
  const st = STYLES.find(s => s.id === id);
  const preset = st.fam === 'dnb' || st.fam === 'edm' ? 'club' : 'full';
  return {
    style: id,
    seed: Math.floor(Math.random() * 1e6) + 1,
    bump: {},
    ov: {},
    bpm: st.bpm[2],
    swing: st.swing,
    key: st.keys[0][0],
    preset,
    secs: defaultSecs(st, preset),
    layers: Array(8).fill(true),
    fills: true,
    fillEvery: 8,
    complexity: 2,
    flavor: 'lively',
    modulate: { on: false, semi: 2 }
  };
}
export function chooseStyle(id) {
  Object.assign(WIZ, defaultWiz(id));
}
export function wizPlan(w) {
  const st = STYLES.find(s => s.id === w.style);
  const kinds = kindsOf(st.fam);
  let secs = (w.secs && w.secs.length ? w.secs : defaultSecs(st)).filter(x => kinds[x.kind]).map(x => ({ ...x }));
  if (w.complexity >= 3) {
    const out = [];
    secs.forEach(s => {
      if (s.bars >= 16 && s.bars % 8 === 0 && !/intro|outro/.test(s.kind)) {
        for (let i = 0; i < s.bars / 8; i++)
          out.push({ kind: s.kind, bars: 8, name: s.name + (i ? ' ' + (i + 1) : '') });
      } else out.push(s);
    });
    secs = out;
  }
  const picks = {};
  for (const pool of new Set([...Object.keys(st.pools), 'fill', 'build', 'impact', ...(oneKit() ? ['full'] : [])])) {
    const arr = lvFlavor(lvPool(st, pool), w.flavor || 'mixed').slice();
    const r = mulberry(hashStr(st.id + pool) ^ w.seed ^ ((w.bump[pool] || 0) * 7919));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    picks[pool] = arr;
  }
  const pickFrom = (spec, occ) => {
    const m = /^([a-z]+)(\d?)$/.exec(spec);
    const base = m[1];
    const v = (m[2] ? +m[2] - 1 : 0) + (occ - 1);
    const arr = picks[base];
    if (!arr || !arr.length) return { base, id: null };
    return { base, id: arr[v % arr.length] };
  };
  const occ = {};
  const sections = [];
  let start = 0,
    fillN = 0;
  secs.forEach((sec, si) => {
    occ[sec.kind] = (occ[sec.kind] || 0) + 1;
    const K = kinds[sec.kind];
    const cells = {};
    for (let t = 0; t < 8; t++) {
      const spec = K.rows[t];
      if (!spec || !w.layers[t]) continue;
      if (w.complexity === 1 && (t === 2 || t === 7)) continue;
      const pk = pickFrom(spec, occ[sec.kind]);
      if (!pk.id) continue;
      if (t === 4 && K.rows[3] && picks.bass) {
        const bk = new Set(
          picks.bass
            .map(facById)
            .filter(f => f && lvProg(f))
            .map(f => lvProg(f) + '|' + f.bars)
        );
        const arr = picks[pk.base];
        const i0 = arr.indexOf(pk.id);
        for (let k = 0; k < arr.length; k++) {
          const g = facById(arr[(i0 + k) % arr.length]);
          if (g && lvProg(g) && bk.has(lvProg(g) + '|' + g.bars)) {
            pk.id = g.id;
            break;
          }
        }
      }
      const ovv = w.ov[si + ':' + t];
      cells[t] = { id: ovv !== undefined ? (ovv === '' ? null : ovv) : pk.id, pool: pk.base, auto: pk.id };
    }
    if (oneKit()) {
      const fk = picks.full && picks.full.length ? picks.full[(occ[sec.kind] - 1 + si) % picks.full.length] : null,
        ov0 = w.ov[si + ':0'];
      if (cells[0] && fk) {
        cells[0].pool = 'full';
        cells[0].auto = fk;
        if (ov0 === undefined) cells[0].id = fk;
      }
      delete cells[1];
      delete cells[2];
    }
    if (DEV === '101') {
      delete cells[5];
      delete cells[7];
    }
    const fch = cells[4] && cells[4].id && facById(cells[4].id),
      prog = lvProg(fch);
    if (prog)
      [3, 5, 7].forEach(t => {
        const c = cells[t];
        if (!c || !c.id || w.ov[si + ':' + t] !== undefined) return;
        const f = facById(c.id);
        if (f && lvProg(f) === prog && f.bars === fch.bars) return;
        const ok = id => {
          const g = facById(id);
          return g && lvProg(g) === prog && g.bars === fch.bars;
        };
        const alt = (picks[c.pool] || []).find(ok) || lvPool(st, c.pool).find(ok);
        if (alt) {
          c.id = alt;
          c.auto = alt;
        }
      });
    sections.push({
      kind: sec.kind,
      name: sec.name || K.name,
      bars: sec.bars,
      start,
      si,
      cells,
      e: K.e,
      fills: []
    });
    start += sec.bars;
  });
  const fe = w.complexity >= 3 ? Math.min(w.fillEvery || 8, 4) : w.fillEvery || 8;
  sections.forEach((sec, i) => {
    const next = sections[i + 1];
    const c0 = sec.cells[0];
    if (!w.fills || !c0 || !c0.id || (c0.pool !== 'kit' && c0.pool !== 'full') || !picks.fill || !picks.fill.length)
      return;
    const set = new Set();
    if (w.complexity === 1) {
      if (next && next.e > sec.e && sec.bars >= 2) set.add(sec.bars - 1);
    } else {
      for (let b = fe; b <= sec.bars; b += fe) if (b < sec.bars || next) set.add(b - 1);
      if (sec.bars % fe !== 0 && sec.bars >= 4 && next) set.add(sec.bars - 1);
    }
    [...set]
      .filter(x => x > 0)
      .sort((a, b) => a - b)
      .forEach(bar => sec.fills.push({ bar, id: picks.fill[fillN++ % picks.fill.length] }));
  });
  if (w.fills && w.complexity >= 2 && (DEV === '101' || w.layers[2] !== false) && picks.build && picks.build.length) {
    let bn = 0;
    sections.forEach((sec, i) => {
      const next = sections[i + 1];
      if (!next || sec.bars < 4) return;
      if (!(sec.kind === 'build' || next.e - sec.e >= 3)) return;
      const len = sec.bars >= 8 ? 8 : 4,
        id = picks.build.find(x => facById(x).bars === len) || picks.build[0];
      sec.build = { bar: sec.bars - len, len, id };
      if (picks.impact && picks.impact.length) next.impact = picks.impact[bn++ % picks.impact.length];
    });
  }
  return { sections, total: start, st };
}
