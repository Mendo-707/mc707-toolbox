// The harmony pack: 20 unusual progressions (lament basses, chromatic mediants, the Neapolitan,
// Picardy endings, tritone substitutes, the royal road, the Mario cadence, backdoor and gospel turns)
// in 8- and 16-bar phrases, with chord changes that don't all land on the bar: 3+3+2 splits,
// long-short holds, half-bar turnarounds and pushed changes that arrive an eighth early. Each one
// comes with matching chords, basslines, a pad, an arp and a lead for every genre.
//
// Reads: FAC.
import { KEYS } from '../core/theory.js';
import { FAC } from './factory.js';

/* Patterns built on the same progression share its name (the Roman numerals), so Live Mode and the song
   wizard keep them together. Ids start with 'hx' and come after every older pattern, full kits included. */
/** Add the pack to the library. Called once by finishLibrary() (pools.js), after the full kits, so every
    older pattern keeps its place. */
export function addHarmonyPack() {
  let seed = 20261018;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const shuf = a => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const Q = {
    m: [0, 3, 7],
    M: [0, 4, 7],
    m7: [0, 3, 7, 10],
    M7: [0, 4, 7, 11],
    7: [0, 4, 7, 10],
    m9: [0, 3, 7, 10, 14],
    m11: [0, 3, 7, 10, 14, 17],
    M9: [0, 4, 7, 11, 14],
    9: [0, 4, 7, 10, 14],
    13: [0, 4, 10, 14, 21],
    m6: [0, 3, 7, 9],
    m7b5: [0, 3, 6, 10],
    '7b9': [0, 4, 7, 10, 13],
    '7sus4': [0, 5, 7, 10],
    sus4: [0, 5, 7],
    add9: [0, 4, 7, 14],
    madd9: [0, 3, 7, 14]
  };
  /* [title, progression (Roman numerals), chords as [semitones from the key's root, quality, beats, bass note
     if not the root], options: push = every change arrives an eighth early, timing = how it is split] */
  const MIN = [
    [
      'Lament',
      'i-v6-iv6-V7',
      [
        [0, 'm9', 8],
        [7, 'm', 8, 10],
        [5, 'm7', 8, 8],
        [7, '7', 8]
      ],
      { timing: '2 bars each' }
    ],
    [
      'Mediant Shift',
      'im9-bVIM7-IIIM-V7sus4-V7',
      [
        [0, 'm9', 8],
        [8, 'M7', 8],
        [4, 'M', 8],
        [7, '7sus4', 4],
        [7, '7', 4]
      ],
      { timing: 'sus resolves late' }
    ],
    [
      'Neapolitan',
      'i-iv-bIIM7-V7-im9-bVIM7-bIIM7-V7b9',
      [
        [0, 'm', 6],
        [5, 'm', 2],
        [1, 'M7', 6],
        [7, '7', 2],
        [0, 'm9', 6],
        [8, 'M7', 2],
        [1, 'M7', 4],
        [7, '7b9', 4]
      ],
      { timing: 'long-short' }
    ],
    [
      'Picardy',
      'i-iv-bVII-bIII-bVI-iim7b5-V7-Iadd9',
      [
        [0, 'm', 8],
        [5, 'm', 8],
        [10, 'M', 8],
        [3, 'M7', 8],
        [8, 'M7', 8],
        [2, 'm7b5', 8],
        [7, '7', 8],
        [0, 'add9', 8]
      ],
      { timing: '16 bars, major ending' }
    ],
    [
      'Dorian Drift',
      'im7-IV7-bVIIM7-bIIIM7-bVIM7-V7sus4-im7-IV9-bVIIM7-bIIIM7-bIIM7-V7',
      [
        [0, 'm7', 3],
        [5, '7', 3],
        [10, 'M7', 2],
        [3, 'M7', 3],
        [8, 'M7', 3],
        [7, '7sus4', 2],
        [0, 'm7', 3],
        [5, '9', 3],
        [10, 'M7', 2],
        [3, 'M7', 3],
        [1, 'M7', 3],
        [7, '7', 2]
      ],
      { timing: '3+3+2' }
    ],
    [
      'Tritone Sub',
      'im9-bII7-im9-bVI7-V7b9-im11-bII7-bVIM7-V7b9',
      [
        [0, 'm9', 6],
        [1, '7', 2],
        [0, 'm9', 4],
        [8, '7', 2],
        [7, '7b9', 2],
        [0, 'm11', 6],
        [1, '7', 2],
        [8, 'M7', 4],
        [7, '7b9', 4]
      ],
      { timing: 'long-short' }
    ],
    [
      'Dorian Light',
      'im9-II-bVIIadd9-IV',
      [
        [0, 'm9', 8],
        [2, 'M', 8],
        [10, 'add9', 8],
        [5, 'M', 8]
      ],
      { push: true, timing: 'pushed' }
    ],
    [
      'Long Night',
      'i-bVI-bIII-bVII-iv-bVI-bVII-V7sus4-V7',
      [
        [0, 'm', 8],
        [8, 'M', 8],
        [3, 'M', 8],
        [10, 'M', 8],
        [5, 'm7', 8],
        [8, 'M7', 8],
        [10, 'M', 8],
        [7, '7sus4', 4],
        [7, '7', 4]
      ],
      { timing: '16 bars' }
    ],
    [
      'Push Minor',
      'im7-bVIIadd9-bVIM7-vm7',
      [
        [0, 'm7', 8],
        [10, 'add9', 8],
        [8, 'M7', 8],
        [7, 'm7', 8]
      ],
      { push: true, timing: 'pushed' }
    ],
    [
      'Slow Fast',
      'im9-bIIIM7-bVIIadd9-ivm9',
      [
        [0, 'm9', 12],
        [3, 'M7', 4],
        [10, 'add9', 12],
        [5, 'm9', 4]
      ],
      { timing: '3 bars + 1' }
    ]
  ];
  const MAJ = [
    [
      'Royal Road',
      'IVM7-V7-iiim7-vim7-IVM7-V7-Iadd9',
      [
        [5, 'M7', 4],
        [7, '7', 4],
        [4, 'm7', 4],
        [9, 'm7', 4],
        [5, 'M7', 4],
        [7, '7', 4],
        [0, 'add9', 8]
      ],
      { timing: 'bar each, long home' }
    ],
    [
      'Mario Cadence',
      'I-bVI-bVII-I-bVI-bVII-Iadd9',
      [
        [0, 'M', 8],
        [8, 'M', 4],
        [10, 'M', 4],
        [0, 'M', 8],
        [8, 'M', 2],
        [10, 'M', 2],
        [0, 'add9', 4]
      ],
      { timing: 'speeds up' }
    ],
    [
      'Lydian Float',
      'IM7-II-IVM7-Iadd9',
      [
        [0, 'M7', 8],
        [2, 'M', 8],
        [5, 'M7', 8],
        [0, 'add9', 8]
      ],
      { push: true, timing: 'pushed' }
    ],
    [
      'Backdoor',
      'IVM7-ivm6-bVII9-IM7',
      [
        [5, 'M7', 8],
        [5, 'm6', 8],
        [10, '9', 8],
        [0, 'M7', 8]
      ],
      { timing: '2 bars each' }
    ],
    [
      'Hollywood',
      'I-III-IV-iv',
      [
        [0, 'M', 8],
        [4, 'M', 8],
        [5, 'M', 8],
        [5, 'm', 8]
      ],
      { timing: '2 bars each' }
    ],
    [
      'Neo Soul',
      'IM9-iiim7-vim9-II9-iim9-V13-IM7-bVII9',
      [
        [0, 'M9', 4],
        [4, 'm7', 4],
        [9, 'm9', 4],
        [2, '9', 4],
        [2, 'm9', 4],
        [7, '13', 4],
        [0, 'M7', 6],
        [10, '9', 2]
      ],
      { push: true, timing: 'pushed' }
    ],
    [
      'Gospel Turn',
      'I-I7-IV-ivm6-I-vim7-iim7-V7sus4',
      [
        [0, 'M', 4],
        [0, '7', 4],
        [5, 'M', 4],
        [5, 'm6', 4],
        [0, 'M', 4],
        [9, 'm7', 4],
        [2, 'm7', 4],
        [7, '7sus4', 4]
      ],
      { timing: 'bar each' }
    ],
    [
      'Mixo Cascade',
      'I-bVIIadd9-IVadd9-I-bVII-IV-Isus4-I',
      [
        [0, 'M', 3],
        [10, 'add9', 3],
        [5, 'add9', 2],
        [0, 'M', 8],
        [10, 'M', 3],
        [5, 'M', 3],
        [0, 'sus4', 2],
        [0, 'M', 8]
      ],
      { timing: '3+3+2' }
    ],
    [
      'Journey',
      'I-vi-IV-V-bVI-bVII-Iadd9-Isus4',
      [
        [0, 'M', 8],
        [9, 'm', 8],
        [5, 'M', 8],
        [7, 'M', 8],
        [8, 'M', 8],
        [10, 'M', 8],
        [0, 'add9', 8],
        [0, 'sus4', 8]
      ],
      { timing: '16 bars' }
    ],
    [
      'Mediant Glow',
      'IM7-bIIIM7-bVIM7-bIIM7',
      [
        [0, 'M7', 8],
        [3, 'M7', 8],
        [8, 'M7', 8],
        [1, 'M7', 8]
      ],
      { timing: '2 bars each' }
    ]
  ];
  /* chord rhythms over one bar (16 steps): [start, length, velocity, look ahead to the next chord] */
  const CR = [
    ['Hold', null],
    [
      'Charleston',
      [
        [0, 3, 104],
        [6, 2, 92]
      ]
    ],
    [
      'Push Stab',
      [
        [0, 2, 100],
        [7, 1, 84],
        [14, 2, 96, 2]
      ]
    ],
    [
      '3-3-2',
      [
        [0, 5, 102],
        [6, 5, 90],
        [12, 3, 96]
      ]
    ],
    [
      'Skank',
      [
        [2, 1, 92],
        [6, 1, 88],
        [10, 1, 92],
        [14, 1, 88]
      ]
    ],
    [
      'Long Short',
      [
        [0, 10, 100],
        [11, 4, 86]
      ]
    ],
    [
      'Dotted',
      [
        [0, 2, 102],
        [3, 2, 86],
        [6, 2, 92],
        [9, 2, 86],
        [12, 3, 96]
      ]
    ],
    [
      'Halftime',
      [
        [0, 7, 100],
        [8, 7, 90]
      ]
    ]
  ];
  /* bass grooves (16 steps): R root (or the slash bass), O octave, 5 fifth, 3 third, 7 seventh,
     A approach note into the next chord */
  const BG = [
    [
      'Follow',
      [
        [0, 6, 'R', 112],
        [6, 2, 'O', 92],
        [8, 6, 'R', 104],
        [14, 2, 'A', 96]
      ]
    ],
    [
      'Tumble',
      [
        [0, 3, 'R', 112],
        [3, 3, 'R', 90],
        [6, 2, '5', 96],
        [8, 3, 'O', 100],
        [11, 3, '7', 90],
        [14, 2, 'A', 96]
      ]
    ],
    [
      'Pocket',
      [
        [0, 2, 'R', 112],
        [3, 1, 'R', 82],
        [6, 1, '3', 90],
        [7, 3, '5', 96],
        [10, 2, 'O', 94],
        [13, 1, '5', 84],
        [14, 2, 'A', 98]
      ]
    ],
    ['Sustain', [[0, 16, 'R', 108]]],
    [
      'Octaves',
      [
        [0, 2, 'R', 110],
        [2, 2, 'O', 90],
        [4, 2, 'R', 100],
        [6, 2, 'O', 88],
        [8, 2, 'R', 104],
        [10, 2, 'O', 90],
        [12, 2, '5', 96],
        [14, 2, 'O', 92]
      ]
    ]
  ];
  const thin = iv => {
    iv = iv.slice();
    if (iv.length > 4 && iv.includes(7)) iv.splice(iv.indexOf(7), 1);
    while (iv.length > 4) iv.splice(iv.length - 2, 1);
    return iv;
  };
  /* the voicing of a chord that moves least from the previous one, kept near a centre note */
  function voice(R, off, iv, center, prev) {
    iv = thin(iv);
    let best = null,
      bc = 1e9;
    for (let r = 0; r < iv.length; r++)
      for (let k = -2; k <= 2; k++) {
        const ns = iv.map((x, i) => R + off + x + (i < r ? 12 : 0) + 12 * k + 48).sort((a, b) => a - b);
        const m = ns.reduce((a, b) => a + b, 0) / ns.length;
        let c = Math.abs(m - center) * (prev ? 0.7 : 2) + (ns[ns.length - 1] - ns[0] > 19 ? 6 : 0);
        if (prev) c += ns.reduce((a, n) => a + Math.min(...prev.map(p => Math.abs(p - n))), 0);
        if (c < bc) {
          bc = c;
          best = ns;
        }
      }
    return best;
  }
  /* the chord segments in steps; with push every change moves an eighth (2 steps) earlier, and the first
     chord also arrives early at the end of the loop */
  function segsOf(P, R, center) {
    const [, , list, opt] = P;
    let at = 0;
    const segs = list.map(([off, q, beats, bass]) => {
      const s = { s: at * 4, e: (at + beats) * 4, off, q, bass: bass == null ? off : bass };
      at += beats;
      return s;
    });
    if (opt.push) {
      for (let i = 1; i < segs.length; i++) {
        segs[i].s -= 2;
        segs[i - 1].e -= 2;
      }
      const last = segs[segs.length - 1],
        f = segs[0];
      last.e -= 2;
      segs.push({ ...f, s: last.e, e: last.e + 2, wrap: true });
    }
    let prev = null;
    for (let pass = 0; pass < 2; pass++)
      segs.forEach(g => {
        g.v = voice(R, g.off, Q[g.q], center, prev);
        prev = g.v;
      });
    const w = segs.find(g => g.wrap);
    if (w) w.v = segs[0].v;
    return segs;
  }
  const segAt = (segs, total, s) => {
    s = ((s % total) + total) % total;
    return segs.find(g => s >= g.s && s < g.e) || segs[0];
  };
  const segNext = (segs, g) => {
    const real = segs.filter(x => !x.wrap);
    return real[(real.indexOf(g.wrap ? real[0] : g) + 1) % real.length];
  };
  /* lay a one-bar cell across the phrase, splitting any note that crosses a chord change so the new chord sounds */
  function tile(total, hits, segs, emit, bass) {
    for (let base = 0; base < total; base += 16)
      for (const h of hits) {
        let s = base + h[0];
        if (s >= total) continue;
        let l = Math.min(h[1], total - s);
        const look = bass ? 0 : h[3] || 0;
        while (l > 0) {
          const g = segAt(segs, total, s + look),
            end = look ? l : Math.min(l, g.e - (s % total));
          emit(s, Math.max(1, end), h, g);
          if (look) break;
          s += end;
          l -= end;
        }
      }
  }
  /* lead motifs over two bars: [step, length, move] where move is a step through the scale (C = land on a
     chord tone) */
  const MOT = [
    [
      'Call',
      [
        [0, 3, 'C'],
        [3, 1, 1],
        [4, 4, 'C'],
        [10, 2, -1],
        [12, 4, 'C'],
        [20, 2, 1],
        [22, 2, 1],
        [24, 6, 'C']
      ]
    ],
    [
      'Rise',
      [
        [2, 2, 'C'],
        [4, 2, 1],
        [6, 2, 1],
        [8, 6, 'C'],
        [16, 3, 'C'],
        [19, 3, -1],
        [22, 2, -1],
        [24, 8, 'C']
      ]
    ],
    [
      'Hook',
      [
        [0, 2, 'C'],
        [2, 2, 'C'],
        [6, 2, 1],
        [8, 4, 'C'],
        [14, 2, -2],
        [16, 2, 'C'],
        [18, 2, 'C'],
        [22, 2, -1],
        [24, 6, 'C']
      ]
    ],
    [
      'Answer',
      [
        [4, 2, 'C'],
        [6, 2, -1],
        [8, 6, 'C'],
        [20, 2, 'C'],
        [22, 2, 1],
        [24, 2, 1],
        [26, 6, 'C']
      ]
    ]
  ];
  const SC = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
  function lead(segs, total, R, scale, mot) {
    const sc = [];
    for (let n = 55; n <= 91; n++) if (SC[scale].includes((((n - R) % 12) + 12) % 12)) sc.push(n);
    const notes = [];
    let cur = 72 + (R % 12);
    for (let base = 0; base < total; base += 32) {
      const answer = (base / 32) % 2 === 1;
      for (const [o, l, mv] of mot) {
        const s = base + o;
        if (s >= total) continue;
        const g = segAt(segs, total, s);
        if (mv === 'C') {
          /* the chord tone nearest the line, a little higher in the answering phrase */
          const tones = [];
          g.v.forEach(n => [-12, 0, 12].forEach(k => tones.push(n + k + 12)));
          const aim = cur + (answer ? 2 : 0);
          cur = tones.filter(n => n >= 64 && n <= 86).sort((a, b) => Math.abs(a - aim) - Math.abs(b - aim))[0] || cur;
        } else {
          let i = sc.findIndex(n => n >= cur);
          if (i < 0) i = sc.length - 1;
          cur = sc[Math.max(0, Math.min(sc.length - 1, i + (answer ? -mv : mv)))];
        }
        notes.push({ s, l: Math.min(l, total - s), n: cur, v: o % 8 === 0 ? 104 : 90 });
      }
    }
    return notes;
  }
  let uid = 0;
  const genres = [...new Set(FAC.filter(f => f.pool === 'chords').map(f => f.genre))];
  for (const g of genres) {
    /* the genre's own keys in this scale, taken from its chord patterns ({keyName, key}) */
    const keysOf = sc => {
      const m = new Map();
      FAC.forEach(f => {
        if (f.genre === g && f.pool === 'chords' && f.keyName && f.key && f.key.scale === sc && !m.has(f.keyName))
          m.set(f.keyName, { keyName: f.keyName, key: { root: f.key.root, scale: sc } });
      });
      return [...m.values()];
    };
    const km = keysOf('minor'),
      kM = keysOf('major');
    /* every genre gets the minor progressions; the major ones go to genres that use major keys */
    const plan = [
      ...MIN.map(p => [p, km.length ? km : [{ keyName: 'Am', key: KEYS.Am }], 'minor']),
      ...(kM.length ? MAJ.map(p => [p, kM, 'major']) : [])
    ];
    const cr = shuf(CR),
      bg = shuf(BG);
    let ci = 0,
      bi = 0,
      ki = 0,
      mi = 0;
    const push = o =>
      FAC.push(Object.assign({ id: 'hx' + g + uid++, genre: g, styles: null, bpm: null, type: 'tone' }, o));
    for (const [P, keys, scale] of plan) {
      const [title, pn, list, opt] = P,
        beats = list.reduce((a, c) => a + c[2], 0),
        bars = beats / 4,
        total = bars * 16,
        K = keys[ki++ % keys.length],
        R = K.key.root,
        tag = title + ' ' + pn,
        how = ' (' + opt.timing + ')';
      const segs = segsOf(P, R, 62);
      /* chords: three rhythms, always including the plain hold so the timing of the changes is clear */
      const rhythms = [CR[0], cr[ci++ % cr.length], cr[ci++ % cr.length]].filter((c, i, a) => a.indexOf(c) === i);
      if (rhythms.length < 3) rhythms.push(cr[ci++ % cr.length]);
      for (const c of rhythms) {
        const notes = [];
        if (!c[1])
          segs.forEach(sg => sg.v.forEach((n, i) => notes.push({ s: sg.s, l: sg.e - sg.s, n, v: i ? 88 : 96 })));
        else tile(total, c[1], segs, (s, l, h, sg) => sg.v.forEach(n => notes.push({ s, l, n, v: h[2] })));
        push({
          name: 'Chords: ' + tag + ' ' + c[0] + how,
          bars,
          notes,
          ...K,
          role: 'Chords',
          pool: 'chords',
          lively: c[0] !== 'Hold'
        });
      }
      /* basslines: two grooves; the root follows a slash chord's own bass note */
      for (let n = 0; n < 2; n++) {
        const b = bg[bi++ % bg.length],
          notes = [];
        const note = (tok, sg) => {
          const root = 36 + ((((R + sg.off) % 12) + 12) % 12),
            low = 36 + ((((R + sg.bass) % 12) + 12) % 12),
            iv = Q[sg.q],
            nx = segNext(segs, sg),
            nr = 36 + ((((R + nx.bass) % 12) + 12) % 12);
          switch (tok) {
            case 'R':
              return low;
            case 'O':
              return low + 12;
            case '5':
              return root + (iv[2] || 7);
            case '3':
              return root + iv[1];
            case '7':
              return root + (iv[3] != null && iv[3] < 12 ? iv[3] : 12);
            case 'A':
              return nr === low ? low + 7 : nr < low ? nr + 1 : nr - 1;
          }
          return low;
        };
        tile(total, b[1], segs, (s, l, h, sg) => notes.push({ s, l, n: note(h[2], sg), v: h[3] }), 1);
        push({
          name: 'Bass: ' + tag + ' ' + b[0] + how,
          bars,
          notes,
          ...K,
          role: 'Bass',
          pool: 'bass',
          lively: b[0] !== 'Sustain'
        });
      }
      /* pad: the voice-led chords held through each change */
      {
        const pv = segsOf(P, R, 57),
          notes = [];
        pv.forEach(sg =>
          sg.v.forEach((n, i) => notes.push({ s: sg.s, l: sg.e - sg.s, n, v: i === sg.v.length - 1 ? 92 : 82 }))
        );
        push({ name: 'Pad: ' + tag + how, bars, notes, ...K, role: 'Pad', pool: 'pad' });
      }
      /* arp: chord tones, following every change */
      {
        const A = [
          ['Ripple', 'xxx.xxx.xx.xxxx.', [0, 1, 2, 3, 2, 1, 0, 1, 3, 2]],
          ['Gallop', 'x.xxx.xxx.xxx.xx', [0, 2, 1, 3, 1, 2, 0, 3]],
          ['Spiral', 'xxxxxxxxxxxxxxxx', [0, 1, 2, 3, 4, 3, 2, 1]],
          ['Skip', 'x..x..x.x..x..x.', [0, 3, 1, 4, 2, 0]]
        ];
        const [an, mask, seq] = A[(ki + uid) % A.length],
          pv = segsOf(P, R, 70),
          notes = [];
        let k = 0;
        for (let s = 0; s < total; s++) {
          if (mask[s % 16] !== 'x') continue;
          const sg = segAt(pv, total, s),
            ts = sg.v,
            idx = seq[k++ % seq.length];
          notes.push({
            s,
            l: 1,
            n: ts[idx % ts.length] + 12 * Math.floor(idx / ts.length),
            v: s % 4 === 0 ? 102 : s % 2 ? 76 : 88
          });
        }
        push({ name: 'Arp: ' + an + ' ' + tag + how, bars, notes, ...K, role: 'Lead', pool: 'pluck', lively: true });
      }
      /* lead: a two-bar call and its answer, landing on the chord's own notes */
      {
        const m = MOT[mi++ % MOT.length];
        push({
          name: 'Lead: ' + m[0] + ' ' + tag + how,
          bars,
          notes: lead(segs, total, R, scale, m[1]),
          ...K,
          role: 'Lead',
          pool: 'lead',
          lively: true
        });
      }
    }
  }
}
