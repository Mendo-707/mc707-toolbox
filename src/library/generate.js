import { KEYS } from '../core/theory.js';
import { D, FAC } from './factory.js';

/* ===== Generated library: kits, layers, fills, chords, basslines, arps, leads, pads ===== */
(function genLibrary() {
  const rng = (seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  })(20261011);
  const shuffle = a => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const SH = {
    liquid: 'Liquid',
    neuro: 'Neuro',
    jungle: 'Jungle',
    jumpup: 'Jump-up',
    halftime: 'Halftime',
    boombap: 'Boom bap',
    trap: 'Trap',
    lofi: 'Lo-fi',
    gfunk: 'G-funk',
    drill: 'Drill',
    neosoul: 'Neo-soul',
    memphis: 'Memphis'
  };
  const GTAG = { dnb: 'DnB', hiphop: 'HH' };
  const GK = ['Fm', 'Gm', 'Cm', 'Am', 'Dm', 'Em'];
  let kc = 0;
  const nextKey = () => GK[kc++ % GK.length];
  const seen = new Set(FAC.map(f => f.type + JSON.stringify(f.notes.map(n => [n.s, n.l, n.n, n.v]))));
  let uid = 1;
  const add = o => {
    const sig = o.type + JSON.stringify(o.notes.map(n => [n.s, n.l, n.n, n.v]));
    if (!o.notes.length || seen.has(sig)) return false;
    seen.add(sig);
    FAC.push({
      id: 'g' + uid++,
      name: o.name,
      type: o.type,
      genre: o.genre,
      bpm: o.bpm,
      bars: o.bars,
      notes: o.notes,
      key: o.keyName ? KEYS[o.keyName] : null,
      keyName: o.keyName || '',
      role: o.role,
      styles: o.styles,
      pool: o.pool,
      gen: true
    });
    return true;
  };
  const dots = n => '.'.repeat(n);
  const merge = (...ds) => Object.assign({}, ...ds);
  const concat = (a, b) => {
    const out = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => {
      out[k] = (a[k] || dots(16)) + (b[k] || dots(16));
    });
    return out;
  };

  /* ---- drum components ---- */
  const DNB = {
    genre: 'dnb',
    styles: {
      liquid: { bpm: 174, k: [0, 1, 2, 8], s: [0, 1, 2, 5, 6], h: [1, 2, 3, 4, 5, 6], x: [0, 2, 3] },
      neuro: { bpm: 174, k: [0, 4, 7, 3, 5, 8], s: [0, 3, 5, 6], h: [0, 4, 7, 8, 2], x: [0, 3, 1] },
      jungle: { bpm: 168, k: [0, 2, 5, 9, 6], s: [1, 2, 3, 6], h: [5, 3, 0, 8], x: [1, 2, 4] },
      jumpup: { bpm: 174, k: [2, 3, 4, 0, 1], s: [0, 5, 3], h: [0, 4, 2, 1], x: [1, 3, 0] },
      halftime: { bpm: 174, k: [2, 3, 8, 1], s: [4, 5, 6], h: [0, 4, 3, 6], x: [0, 3, 4] }
    },
    K: [
      ['2-Step', { k: 'x.........x.....' }],
      ['Sync', { k: 'x.........x..x..' }],
      ['Roll', { k: 'x.....x...x.....' }],
      ['Stomp', { k: 'x.......x.x.....' }],
      ['Skip', { k: 'x.....x...x...x.' }],
      ['Late', { k: 'x..........x....' }],
      ['Double', { k: 'x.x.......x.....' }],
      ['Tech', { k: 'x....x..x.......' }],
      ['Heavy', { k: 'x.........x.x...' }],
      ['Shuffle', { k: 'x..x......x.....' }]
    ],
    K2: [{ k: 'x.........x..x..' }, { k: 'x.....x...x.x...' }, { k: 'x.........x.x.x.' }, { k: 'x.x.......x.....' }],
    S: [
      ['Back', { s: '....x.......x...' }],
      ['Ghost', { s: '....x..g.g..x..g' }],
      ['Roll', { s: '....x.g.g.g.x.g.' }],
      ['Late', { s: '....x.......x..x' }],
      ['Half', { s: '........x.......' }],
      ['Clap', { s: '....x.......x...', c: '....x.......x...' }],
      ['Rim', { s: '....x.......x...', rim: '..g...g...g...g.' }]
    ],
    S2: [{ s: '....x..g....x.xx' }, { s: '....x...x.x.xxxx' }, { s: '....x.g.....x.gx' }],
    H: [
      ['8ths', { h: 'x.x.x.x.x.x.x.x.' }],
      ['16ths', { h: 'xoxoxoxoxoxoxoxo' }],
      ['Accent', { h: 'XoxoXoxoXoxoXoxo' }],
      ['Shuf', { h: 'x..xx..xx..xx..x' }],
      ['8ths+Open', { h: 'x.x.x.x.x.x.x.x.', oh: '......o.......o.' }],
      ['Ride', { rd: 'x.x.x.x.x.x.x.x.' }],
      ['Soft', { h: 'o.o.o.o.o.o.o.o.' }],
      ['Offbeat', { h: '..x...x...x...x.' }],
      ['Rolling', { h: 'x.xxx.xxx.xxx.xx' }]
    ],
    X: [
      ['', {}],
      [' +Cow', { pc: '..x...x...x...x.' }],
      [' +Toms', { lt: '.....x.......x..', mt: '.........x......', ht: '.......x......x.' }],
      [' +Clap', { c: '....x.......x...' }],
      [' +Rim', { rim: '..g...g.g...g.g.' }]
    ],
    perc: [
      ['Cowbell Offbeat', { pc: '..x...x...x...x.' }],
      ['Cowbell 8ths', { pc: 'x.x.x.x.x.x.x.x.' }],
      ['Rim Ghosts', { rim: '..g...g.g...g.g.' }],
      ['Tom Run', { lt: '.....x.......x..', mt: '.........x......', ht: '.......x......x.' }],
      ['Clap Backbeat', { c: '....x.......x...' }],
      ['Open Hat Offbeat', { oh: '..o...o...o...o.' }],
      ['Open Hat Late', { oh: '......o.......o.' }],
      ['Crash Downbeat', { cr: 'x...............' }],
      ['Ride Bell Accents', { rd: 'x...x...x...x...' }],
      ['Rim Skip', { rim: '...x......x..x..' }],
      ['Tom Fill Tail', { lt: '............x.x.', mt: '..........x.....', ht: '........x.......' }],
      ['Shaker 16ths', { pc: 'xoxoxoxoxoxoxoxo' }]
    ]
  };
  const HHF = {
    genre: 'hiphop',
    styles: {
      boombap: { bpm: 90, k: [0, 1, 2, 7, 6], s: [0, 3, 2, 5], h: [1, 2, 0, 8, 9], x: [0, 1, 2, 3] },
      trap: { bpm: 140, k: [3, 4, 8, 9, 5], s: [1, 6, 2], h: [3, 4, 5, 9], x: [0, 1, 3, 4] },
      lofi: { bpm: 78, k: [1, 0, 9, 7, 4], s: [0, 3, 4], h: [2, 7, 1, 8], x: [0, 2, 3] },
      gfunk: { bpm: 94, k: [6, 2, 1, 0], s: [2, 0, 5], h: [1, 2, 9, 0], x: [0, 3, 1] },
      drill: { bpm: 142, k: [5, 4, 3], s: [1, 6, 5], h: [5, 3, 4], x: [0, 2, 3] },
      neosoul: { bpm: 80, k: [1, 9, 4, 7], s: [0, 4, 5, 3], h: [2, 7, 1, 8], x: [0, 2, 3] },
      memphis: { bpm: 75, k: [3, 8, 1, 9], s: [1, 6, 2], h: [7, 0, 2, 3], x: [1, 2, 4] }
    },
    K: [
      ['Boom Bap', { k: 'x......g..x.....' }],
      ['Lazy', { k: 'x.......x.x.....' }],
      ['Bounce', { k: 'x..x....x.x.....' }],
      ['Trap', { k: 'x.....x.x.......' }],
      ['Sparse', { k: 'x.........x.....' }],
      ['Drill', { k: 'x.........x...x.' }],
      ['West', { k: 'x..x....x..x....' }],
      ['Dilla', { k: 'x.....x...x.g...' }],
      ['Heavy', { k: 'x..x..x.x..x....' }],
      ['Late', { k: 'x.......x...x...' }]
    ],
    K2: [{ k: 'x.....x...x...x.' }, { k: 'x.......g.x..x..' }, { k: 'x.........x.x...' }, { k: 'x.....x.x.......' }],
    S: [
      ['Back', { s: '....x.......x...' }],
      ['Half', { s: '........x.......' }],
      ['Clap', { s: '....x.......x...', c: '....x.......x...' }],
      ['Ghost', { s: '....x..g....x..g' }],
      ['Late', { s: '....x......x...g' }],
      ['Rim', { s: '....x.......x...', rim: '....x.......x...' }],
      ['Half+Clap', { s: '........x.......', c: '........x.......' }]
    ],
    S2: [{ s: '....x.......x.xx' }, { s: '........x.x.xxxx' }, { s: '....x..g....x..x' }],
    H: [
      ['8ths', { h: 'x.x.x.x.x.x.x.x.' }],
      ['Swung', { h: 'x.o.x.o.x.o.x.o.' }],
      ['Lazy', { h: 'o.x.o.x.o.x.o.x.' }],
      ['Trap', { h: 'xoxoxoxoxoxxxxxx' }],
      ['Rolls', { h: 'xoxoxoxoxoxoxoxx' }],
      ['Triplet', { h: 'x.xxx.xxx.xxx.xx' }],
      ['Sparse', { h: 'x...x...x...x...' }],
      ['Soft 8ths', { h: 'o.o.o.o.o.o.o.o.' }],
      ['Ride', { rd: 'x.x.xx..x.x.xx..' }],
      ['8ths+Open', { h: 'x.x.x.x.x.x.x.x.', oh: '..............o.' }]
    ],
    X: [
      ['', {}],
      [' +Cow', { pc: '..x...x...x...x.' }],
      [' +Rim', { rim: '..g...g.g...g.g.' }],
      [' +Open', { oh: '......o.......o.' }],
      [' +Crash', { cr: 'x...............' }]
    ],
    perc: [
      ['Cowbell', { pc: '..x...x...x...x.' }],
      ['Cowbell Busy', { pc: 'x.x.x.x.x.x.x.x.' }],
      ['Rim Ghosts', { rim: '..g...g.g...g.g.' }],
      ['Clap Backbeat', { c: '....x.......x...' }],
      ['Clap Half-Time', { c: '........x.......' }],
      ['Open Hat Offbeat', { oh: '..o...o...o...o.' }],
      ['Open Hat Late', { oh: '..............o.' }],
      ['Crash Downbeat', { cr: 'x...............' }],
      ['Tom Run', { lt: '.............x.x', mt: '..........x.....', ht: '........x.......' }],
      ['Shaker 16ths', { pc: 'xoxoxoxoxoxoxoxo' }],
      ['Rim Skip', { rim: '...x......x..x..' }],
      ['Snap Layer', { c: '....o.......o..o' }]
    ]
  };
  const FILLS = {
    snare: [
      '........x.x.xxxx',
      '..x.x.x.xxxxxxxx',
      '............xxxx',
      '........xxxxxxxx',
      '....x...x.x.x.xx',
      '..........x.xxxx',
      'x...x...x.x.xxxx',
      '....x.x.x.x.x.xx'
    ],
    add: [
      ['', {}],
      [' +Toms', { ht: '........x.......', mt: '..........x.....', lt: '............x.x.' }],
      [' +Kick', { k: 'x.....x.......x.' }],
      [' +Kick+Toms', { k: 'x...............', ht: '........x.......', mt: '..........x.....' }]
    ]
  };

  function genKits(F, per) {
    for (const sid in F.styles) {
      const cfg = F.styles[sid];
      const combos = [];
      cfg.k.forEach(ki => cfg.s.forEach(si => cfg.h.forEach(hi => cfg.x.forEach(xi => combos.push([ki, si, hi, xi])))));
      let n = 0;
      for (const [ki, si, hi, xi] of shuffle(combos)) {
        if (n >= per) break;
        const [kn, kd] = F.K[ki],
          [sn, sd] = F.S[si],
          [hn, hd] = F.H[hi],
          [xn, xd] = F.X[xi];
        const a = merge(kd, sd, hd, xd);
        let lanes = a,
          bars = 1;
        if (n % 2 === 1) {
          const k2 = F.K2[Math.floor(rng() * F.K2.length)],
            s2 = F.S2[Math.floor(rng() * F.S2.length)];
          lanes = concat(a, merge(k2, s2, hd, xd));
          bars = 2;
        }
        if (
          add({
            name: SH[sid] + ': ' + kn + ' / ' + sn + ' / ' + hn + xn,
            type: 'drum',
            genre: F.genre,
            bpm: cfg.bpm,
            bars,
            notes: D(bars, lanes).notes,
            role: 'Full kit',
            styles: [sid],
            pool: 'kit'
          })
        )
          n++;
      }
    }
  }
  function genLayers(F) {
    const all = Object.keys(F.styles);
    const bpm = F.styles[all[0]].bpm;
    const tag = (F.tag || GTAG[F.genre] || F.genre) + ' ';
    const put = (name, role, pool, lanes, bars) =>
      add({
        name: tag + name,
        type: 'drum',
        genre: F.genre,
        bpm,
        bars,
        notes: D(bars, lanes).notes,
        role,
        styles: all,
        pool
      });
    F.K.forEach(([n, d]) => {
      put('Kick: ' + n, 'Kick', '', d, 1);
      [0, 1].forEach(i =>
        put('Kick: ' + n + ' + Turn ' + (i + 1), 'Kick', '', concat(d, F.K2[(i * 2 + n.length) % F.K2.length]), 2)
      );
    });
    F.S.forEach(([n, d]) => {
      put('Snare: ' + n, 'Snare', '', d, 1);
      put('Snare: ' + n + ' + Turn', 'Snare', '', concat(d, F.S2[n.length % F.S2.length]), 2);
    });
    F.H.forEach(([n, d]) => put('Hats: ' + n, 'Hats', 'hats', d, 1));
    F.H.forEach(([n, d], i) => {
      if (i % 2 === 0) put('Hats: ' + n + ' + Variation', 'Hats', 'hats', concat(d, F.H[(i + 3) % F.H.length][1]), 2);
    });
    F.perc.forEach(([n, d]) => put('Perc: ' + n, 'Perc', 'perc', d, 1));
  }
  function genFills(F) {
    const all = Object.keys(F.styles);
    const bpm = F.styles[all[0]].bpm;
    let i = 0;
    FILLS.snare.forEach(sn =>
      FILLS.add.forEach(([an, ad]) => {
        i++;
        add({
          name: (F.tag || GTAG[F.genre] || F.genre) + ' Fill ' + i + an,
          type: 'drum',
          genre: F.genre,
          bpm,
          bars: 1,
          notes: D(1, merge({ s: sn }, ad)).notes,
          role: 'Fill',
          styles: all,
          pool: 'fill'
        });
      })
    );
  }
  genKits(DNB, 14);
  genKits(HHF, 14);
  genLayers(DNB);
  genLayers(HHF);
  genFills(DNB);
  genFills(HHF);

  /* ---- tone components ---- */
  const QUAL = {
    m: [0, 3, 7],
    M: [0, 4, 7],
    m7: [0, 3, 7, 10],
    M7: [0, 4, 7, 11],
    7: [0, 4, 7, 10],
    m9: [0, 3, 7, 10, 14],
    m7b5: [0, 3, 6, 10]
  };
  const PROGS = [
    [
      'i-VI-III-VII',
      [
        [0, 'm7'],
        [8, 'M7'],
        [3, 'M7'],
        [10, '7']
      ]
    ],
    [
      'i-VII-VI-VII',
      [
        [0, 'm'],
        [10, 'M'],
        [8, 'M'],
        [10, 'M']
      ]
    ],
    [
      'i-iv-VII-III',
      [
        [0, 'm7'],
        [5, 'm7'],
        [10, '7'],
        [3, 'M7']
      ]
    ],
    [
      'i-III-VII-VI',
      [
        [0, 'm'],
        [3, 'M'],
        [10, 'M'],
        [8, 'M']
      ]
    ],
    [
      'i-VI-iv-V',
      [
        [0, 'm9'],
        [8, 'M7'],
        [5, 'm7'],
        [7, '7']
      ]
    ],
    [
      'i-iv-i-V',
      [
        [0, 'm7'],
        [5, 'm7'],
        [0, 'm7'],
        [7, '7']
      ]
    ],
    [
      'i-v-VI-iv',
      [
        [0, 'm'],
        [7, 'm'],
        [8, 'M'],
        [5, 'm']
      ]
    ],
    [
      'ii-V-i-VI',
      [
        [2, 'm7b5'],
        [7, '7'],
        [0, 'm9'],
        [8, 'M7']
      ]
    ],
    [
      'VI-VII-i-i',
      [
        [8, 'M7'],
        [10, '7'],
        [0, 'm7'],
        [0, 'm7']
      ]
    ],
    [
      'i-i-VI-VII',
      [
        [0, 'm'],
        [0, 'm'],
        [8, 'M'],
        [10, 'M']
      ]
    ],
    [
      'i-iv-VI-VII',
      [
        [0, 'm7'],
        [5, 'm7'],
        [8, 'M7'],
        [10, '7']
      ]
    ],
    [
      'i-VII-iv-v',
      [
        [0, 'm7'],
        [10, 'M'],
        [5, 'm7'],
        [7, 'm7']
      ]
    ]
  ];
  const CR = [
    ['Whole', [[0, 16, 100]]],
    [
      'Half',
      [
        [0, 8, 100],
        [8, 8, 88]
      ]
    ],
    [
      'Stabs',
      [
        [0, 2, 100],
        [3, 1, 85],
        [6, 1, 85],
        [10, 1, 85],
        [14, 1, 80]
      ]
    ],
    [
      'Offbeat',
      [
        [2, 2, 95],
        [6, 2, 90],
        [10, 2, 95],
        [14, 2, 90]
      ]
    ],
    [
      'Push',
      [
        [0, 3, 100],
        [6, 2, 90],
        [10, 3, 95]
      ]
    ],
    ['Pulse', [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, s % 4 ? 80 : 100])],
    [
      'Comp',
      [
        [0, 6, 100],
        [8, 2, 85],
        [10, 6, 92]
      ]
    ],
    [
      'Lazy',
      [
        [1, 5, 95],
        [8, 2, 80],
        [11, 5, 90]
      ]
    ],
    [
      'Tight',
      [
        [0, 1, 100],
        [3, 1, 85],
        [6, 1, 90],
        [8, 1, 85],
        [11, 1, 90]
      ]
    ],
    [
      'Sustain+',
      [
        [0, 12, 100],
        [12, 4, 70]
      ]
    ],
    [
      'Sync',
      [
        [0, 4, 100],
        [5, 3, 88],
        [10, 6, 95]
      ]
    ],
    [
      'Chop',
      [
        [0, 1, 100],
        [2, 1, 80],
        [3, 1, 90],
        [6, 1, 85],
        [8, 1, 100],
        [10, 1, 80],
        [11, 1, 90]
      ]
    ]
  ];
  const BT_DNB = [
    [
      'Two-Step',
      [
        [0, 3, 0],
        [6, 2, 0],
        [10, 4, 0]
      ],
      ['liquid', 'neuro', 'jumpup']
    ],
    [
      'Roll',
      [
        [0, 2, 0],
        [2, 2, 0],
        [4, 2, 0],
        [8, 2, 0],
        [10, 2, 0],
        [12, 2, 7],
        [14, 2, 0]
      ],
      ['liquid', 'jumpup']
    ],
    [
      'Long',
      [
        [0, 12, 0, 110],
        [12, 4, 7]
      ],
      ['neuro', 'halftime']
    ],
    [
      'Octave Pump',
      [
        [0, 2, 0],
        [3, 1, 12],
        [4, 2, 0],
        [7, 1, 12],
        [10, 2, 0],
        [13, 1, 12],
        [14, 2, 0]
      ],
      ['jumpup', 'neuro']
    ],
    [
      'Skank',
      [
        [0, 3, 0],
        [6, 2, 0],
        [10, 2, 3],
        [12, 4, 7]
      ],
      ['jungle', 'liquid']
    ],
    [
      'Reggae',
      [
        [0, 6, 0],
        [8, 4, 0],
        [12, 4, 7]
      ],
      ['jungle']
    ],
    ['Stab', [0, 2, 4, 6, 8, 10, 12].map(s => [s, 1, 0]).concat([[14, 1, 7]]), ['neuro', 'jumpup']],
    [
      'Half',
      [
        [0, 8, 0, 120],
        [10, 4, 3]
      ],
      ['halftime', 'neuro']
    ],
    [
      'Walk',
      [
        [0, 4, 0],
        [4, 2, 3],
        [6, 2, 7],
        [8, 4, 5],
        [12, 2, 7],
        [14, 2, 3]
      ],
      ['liquid', 'jungle']
    ],
    [
      'Syncopated',
      [
        [0, 2, 0],
        [3, 2, 0],
        [6, 3, 0],
        [10, 2, 7],
        [13, 3, 0]
      ],
      ['neuro', 'jungle', 'jumpup']
    ],
    [
      'Growl',
      [
        [0, 3, 0, 120],
        [4, 1, 12],
        [6, 2, 0],
        [8, 3, -2, 120],
        [12, 1, 10],
        [14, 2, -2]
      ],
      ['neuro']
    ]
  ];
  const BT_HH = [
    [
      '808 Long',
      [
        [0, 10, 0, 120],
        [12, 4, 0]
      ],
      ['trap', 'memphis', 'drill']
    ],
    [
      '808 Slide',
      [
        [0, 5, 0, 120],
        [6, 2, 0],
        [8, 3, 3],
        [12, 4, -2]
      ],
      ['trap', 'drill']
    ],
    [
      'Boom Bap',
      [
        [0, 3, 0],
        [4, 2, 0],
        [7, 1, 3],
        [10, 3, 5],
        [14, 2, 7]
      ],
      ['boombap', 'lofi']
    ],
    [
      'Bounce',
      [
        [0, 2, 0],
        [3, 1, 0],
        [4, 2, 3],
        [6, 2, 0],
        [8, 2, 7],
        [10, 2, 5],
        [12, 4, 0]
      ],
      ['gfunk', 'boombap']
    ],
    [
      'Walking',
      [
        [0, 4, 0],
        [4, 2, 3],
        [6, 2, 7],
        [8, 4, 5],
        [12, 2, 7],
        [14, 2, 3]
      ],
      ['boombap', 'neosoul', 'gfunk']
    ],
    ['Sub Hold', [[0, 16, 0]], ['memphis', 'trap']],
    [
      'Dilla',
      [
        [0, 3, 0],
        [4, 1, 3],
        [6, 2, 7],
        [9, 2, 5],
        [12, 3, 3]
      ],
      ['lofi', 'neosoul', 'boombap']
    ],
    [
      'Trap Sparse',
      [
        [0, 6, 0, 120],
        [8, 2, 0],
        [10, 2, 3],
        [12, 4, 7]
      ],
      ['trap', 'memphis']
    ],
    [
      'Drill Slide',
      [
        [0, 5, 0, 120],
        [6, 2, 0],
        [8, 3, 5],
        [12, 4, 3]
      ],
      ['drill']
    ],
    [
      'Funk',
      [
        [0, 2, 0],
        [3, 1, 0],
        [4, 2, 7],
        [6, 2, 0],
        [8, 2, 0],
        [10, 1, 12],
        [11, 1, 7],
        [12, 4, 0]
      ],
      ['gfunk']
    ],
    [
      'Lazy',
      [
        [0, 12, 0],
        [12, 4, 7]
      ],
      ['lofi', 'neosoul']
    ],
    [
      'Slow Jam',
      [
        [0, 6, 0],
        [8, 4, 3],
        [12, 4, 5]
      ],
      ['neosoul', 'lofi']
    ]
  ];
  const ARPS = [
    ['Up', [0, 1, 2, 3]],
    ['Down', [3, 2, 1, 0]],
    ['Up-Down', [0, 1, 2, 3, 2, 1]],
    ['Skip', [0, 2, 1, 3]],
    ['Broken', [0, 2, 1, 2]],
    ['Wide', [0, 2, 3, 1, 3, 2]]
  ];
  const RH = [
    [
      'Phrase',
      [
        [0, 3],
        [4, 1],
        [6, 2],
        [8, 4],
        [16, 3],
        [20, 1],
        [22, 2],
        [24, 8]
      ]
    ],
    [
      'Eighths',
      [
        [0, 2],
        [2, 2],
        [4, 2],
        [8, 2],
        [10, 2],
        [12, 4],
        [16, 2],
        [18, 2],
        [20, 2],
        [24, 4],
        [28, 4]
      ]
    ],
    [
      'Synco',
      [
        [0, 1],
        [3, 1],
        [6, 2],
        [8, 1],
        [11, 1],
        [14, 2],
        [16, 1],
        [19, 1],
        [22, 2],
        [24, 8]
      ]
    ],
    [
      'Long',
      [
        [0, 6],
        [6, 2],
        [8, 6],
        [14, 2],
        [16, 8],
        [24, 8]
      ]
    ],
    [
      'Run',
      [
        [0, 1],
        [1, 1],
        [2, 1],
        [3, 1],
        [6, 2],
        [8, 4],
        [16, 1],
        [17, 1],
        [18, 1],
        [19, 1],
        [22, 2],
        [24, 8]
      ]
    ],
    [
      'Call',
      [
        [0, 2],
        [2, 2],
        [4, 4],
        [10, 2],
        [12, 2],
        [14, 2],
        [16, 2],
        [18, 2],
        [20, 4],
        [26, 2],
        [28, 4]
      ]
    ]
  ];
  const CO = [
    ['Climb', [4, 2, 3, 0, 2, 4, 3, 2]],
    ['Wave', [0, 2, 4, 2, 0, -1, 0, 2]],
    ['Fall', [7, 6, 4, 2, 4, 2, 0, 2]],
    ['Zig', [2, 4, 6, 4, 2, 4, 2, 0]],
    ['Pedal', [4, 4, 2, 3, 0, 0, -2, 0]],
    ['Leap', [0, 3, 2, 4, 3, 5, 4, 2]]
  ];
  const SC = {
    Minor: [0, 2, 3, 5, 7, 8, 10],
    Dorian: [0, 2, 3, 5, 7, 9, 10],
    Phrygian: [0, 1, 3, 5, 7, 8, 10]
  };
  const PADV = [
    ['Open Fifths', [0, 7, 12, 19], 36],
    ['Sus2', [0, 2, 7, 14], 36],
    ['Wide Minor', [0, 7, 15, 19], 36],
    ['Cluster', [0, 2, 3, 7], 48],
    ['Triad+9', [0, 3, 7, 14], 36]
  ];
  const FAMS = {
    dnb: { genre: 'dnb', styles: ['liquid', 'neuro', 'jungle', 'jumpup', 'halftime'], bpm: 174, BT: BT_DNB },
    hh: {
      genre: 'hiphop',
      styles: ['boombap', 'trap', 'lofi', 'gfunk', 'drill', 'neosoul', 'memphis'],
      bpm: 90,
      BT: BT_HH
    }
  };
  const pickStyles = (F, n) => shuffle(F.styles).slice(0, n);
  const tones = (R, off, q, center) => {
    const base = R + off + 48;
    const ns = QUAL[q].map(i => base + i);
    const m = ns.reduce((a, b) => a + b, 0) / ns.length;
    const sh = Math.round((center - m) / 12) * 12;
    return ns.map(n => n + sh);
  };
  const rootAbs = (R, off) => 24 + ((((R + off) % 12) + 12) % 12);

  for (const fk in FAMS) {
    const F = FAMS[fk];
    /* chords */
    shuffle(PROGS.flatMap((p, pi) => CR.map((r, ri) => [pi, ri])))
      .slice(0, 72)
      .forEach(([pi, ri]) => {
        const [pn, prog] = PROGS[pi],
          [rn, rhy] = CR[ri];
        const bars = ri % 2 === 0 ? 4 : 2;
        const kn = nextKey(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const [off, q] = prog[b % 4];
          const ts = tones(R, off, q, 62);
          for (const [st, len, v] of rhy) for (const n of ts) notes.push({ s: b * 16 + st, l: len, n, v });
        }
        add({
          name: 'Chords: ' + pn + ' ' + rn,
          type: 'tone',
          genre: F.genre,
          bpm: F.bpm,
          bars,
          notes,
          keyName: kn,
          role: 'Chords',
          styles: pickStyles(F, 3),
          pool: 'chords'
        });
      });
    /* basslines */
    shuffle(PROGS.flatMap((p, pi) => F.BT.map((t, ti) => [pi, ti])))
      .slice(0, 72)
      .forEach(([pi, ti]) => {
        const [pn, prog] = PROGS[pi],
          [tn, tm, tstyles] = F.BT[ti];
        const bars = pi % 2 === 0 ? 4 : 2;
        const kn = nextKey(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const root = rootAbs(R, prog[b % 4][0]);
          for (const [st, len, iv, v] of tm) notes.push({ s: b * 16 + st, l: len, n: root + iv, v: v || 100 });
        }
        add({
          name: 'Bass: ' + pn + ' ' + tn,
          type: 'tone',
          genre: F.genre,
          bpm: F.bpm,
          bars,
          notes,
          keyName: kn,
          role: 'Bass',
          styles: tstyles,
          pool: 'bass'
        });
      });
    /* arps (plucks) */
    shuffle(
      PROGS.flatMap((p, pi) =>
        ARPS.flatMap((a, ai) => [
          [pi, ai, 1],
          [pi, ai, 2]
        ])
      )
    )
      .slice(0, 60)
      .forEach(([pi, ai, rate], i) => {
        const [pn, prog] = PROGS[pi],
          [an, pat] = ARPS[ai];
        const bars = i % 2 ? 2 : 4;
        const kn = nextKey(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const [off, q] = prog[b % 4];
          const ts = tones(R, off, q, 72).sort((x, y) => x - y);
          for (let s = 0; s < 16; s += rate) {
            const idx = pat[(s / rate) % pat.length];
            notes.push({
              s: b * 16 + s,
              l: rate,
              n: ts[idx % ts.length] + 12 * Math.floor(idx / ts.length),
              v: s % 4 === 0 ? 100 : 80
            });
          }
        }
        add({
          name: 'Arp: ' + an + ' ' + (rate === 1 ? '16ths' : '8ths') + ' ' + pn,
          type: 'tone',
          genre: F.genre,
          bpm: F.bpm,
          bars,
          notes,
          keyName: kn,
          role: 'Lead',
          styles: pickStyles(F, 3),
          pool: 'pluck'
        });
      });
    /* lead motifs */
    shuffle(Object.keys(SC).flatMap(m => RH.flatMap((r, ri) => CO.map((c, ci) => [m, ri, ci]))))
      .slice(0, 50)
      .forEach(([m, ri, ci]) => {
        const [rn, rhy] = RH[ri],
          [cn, con] = CO[ci];
        const kn = nextKey(),
          R = KEYS[kn].root;
        const sc = SC[m];
        const notes = [];
        rhy.forEach(([st, len], i) => {
          const d = con[i % con.length];
          const idx = ((d % 7) + 7) % 7;
          notes.push({
            s: st,
            l: len,
            n: 60 + R + sc[idx] + 12 * Math.floor(d / 7),
            v: i % 3 === 0 ? 100 : 88
          });
        });
        add({
          name: 'Lead: ' + rn + ' / ' + cn + ' (' + m + ')',
          type: 'tone',
          genre: F.genre,
          bpm: F.bpm,
          bars: 2,
          notes,
          keyName: kn,
          role: 'Lead',
          styles: pickStyles(F, 3),
          pool: 'lead'
        });
      });
    /* pads */
    shuffle(PROGS.flatMap((p, pi) => PADV.map((v, vi) => [pi, vi])))
      .slice(0, 30)
      .forEach(([pi, vi]) => {
        const [pn, prog] = PROGS[pi],
          [vn, iv, base] = PADV[vi];
        const kn = nextKey(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < 4; b++) {
          const off = prog[b % 4][0];
          let ns = iv.map(i => R + off + base + i);
          const m = ns.reduce((a, c) => a + c, 0) / ns.length;
          const sh = Math.round((55 - m) / 12) * 12;
          ns = ns.map(n => n + sh);
          ns.forEach(n => notes.push({ s: b * 16, l: 16, n, v: 90 }));
        }
        add({
          name: 'Pad: ' + vn + ' ' + pn,
          type: 'tone',
          genre: F.genre,
          bpm: F.bpm,
          bars: 4,
          notes,
          keyName: kn,
          role: 'Pad',
          styles: pickStyles(F, 3),
          pool: 'pad'
        });
      });
  }
  /* ===== more genres: house, techno, garage, dubstep, trance, electro, funk, reggae, latin, synth, pop, ambient, rock, phonk ===== */
  Object.assign(KEYS, {
    C: { root: 0, scale: 'major' },
    G: { root: 7, scale: 'major' },
    D: { root: 2, scale: 'major' },
    A: { root: 9, scale: 'major' },
    E: { root: 4, scale: 'major' },
    F: { root: 5, scale: 'major' },
    Bb: { root: 10, scale: 'major' }
  });
  Object.assign(SC, {
    Major: [0, 2, 4, 5, 7, 9, 11],
    Mixolydian: [0, 2, 4, 5, 7, 9, 10],
    Lydian: [0, 2, 4, 6, 7, 9, 11]
  });
  Object.assign(QUAL, { M9: [0, 4, 7, 11, 14], 6: [0, 4, 7, 9] });
  const PROGS_MAJ = [
    [
      'I-V-vi-IV',
      [
        [0, 'M'],
        [7, 'M'],
        [9, 'm'],
        [5, 'M']
      ]
    ],
    [
      'vi-IV-I-V',
      [
        [9, 'm'],
        [5, 'M'],
        [0, 'M'],
        [7, 'M']
      ]
    ],
    [
      'I-vi-IV-V',
      [
        [0, 'M'],
        [9, 'm'],
        [5, 'M'],
        [7, 'M']
      ]
    ],
    [
      'ii-V-I-vi',
      [
        [2, 'm7'],
        [7, '7'],
        [0, 'M7'],
        [9, 'm7']
      ]
    ],
    [
      'I-IV-V-IV',
      [
        [0, 'M'],
        [5, 'M'],
        [7, 'M'],
        [5, 'M']
      ]
    ],
    [
      'I-iii-IV-V',
      [
        [0, 'M'],
        [4, 'm'],
        [5, 'M'],
        [7, 'M']
      ]
    ],
    [
      'I-V-IV-V',
      [
        [0, 'M'],
        [7, 'M'],
        [5, 'M'],
        [7, 'M']
      ]
    ],
    [
      'I-IV-vi-V',
      [
        [0, 'M'],
        [5, 'M'],
        [9, 'm'],
        [7, 'M']
      ]
    ],
    [
      'I-bVII-IV-I',
      [
        [0, 'M'],
        [10, 'M'],
        [5, 'M'],
        [0, 'M']
      ]
    ],
    [
      'IV-V-iii-vi',
      [
        [5, 'M7'],
        [7, '7'],
        [4, 'm7'],
        [9, 'm7']
      ]
    ],
    [
      'I-vi-ii-V',
      [
        [0, 'M7'],
        [9, 'm7'],
        [2, 'm7'],
        [7, '7']
      ]
    ],
    [
      'IMaj9-vi9-IV-V',
      [
        [0, 'M9'],
        [9, 'm9'],
        [5, 'M7'],
        [7, '7']
      ]
    ]
  ];
  const L = (on, gh, ac) => {
    const a = Array(16).fill('.');
    (on || []).forEach(i => {
      a[i] = 'x';
    });
    (gh || []).forEach(i => {
      a[i] = 'g';
    });
    (ac || []).forEach(i => {
      a[i] = 'X';
    });
    return a.join('');
  };
  const ev = (n, o = 0) => {
    const a = [];
    for (let i = o; i < 16; i += n) a.push(i);
    return a;
  };
  const NB = (steps, len, iv = 0, v) => steps.map(s => [s, len, iv, v]);
  const OCT = [
    [0, 2, 0],
    [2, 2, 12],
    [4, 2, 0],
    [6, 2, 12],
    [8, 2, 0],
    [10, 2, 12],
    [12, 2, 0],
    [14, 2, 12]
  ];
  const WALK = [
    [0, 4, 0],
    [4, 2, 3],
    [6, 2, 7],
    [8, 4, 5],
    [12, 2, 7],
    [14, 2, 3]
  ];
  const WALKM = [
    [0, 4, 0],
    [4, 2, 4],
    [6, 2, 7],
    [8, 4, 5],
    [12, 2, 7],
    [14, 2, 4]
  ];
  const ACID = [
    [0, 1, 0],
    [1, 1, 12],
    [3, 1, 0],
    [4, 1, 3],
    [6, 1, 0],
    [7, 1, 7],
    [9, 1, 0],
    [10, 1, 12],
    [12, 1, 0],
    [14, 1, 10]
  ];
  const FUNKB = [
    [0, 2, 0],
    [3, 1, 0],
    [4, 2, 7],
    [6, 2, 0],
    [8, 2, 0],
    [10, 1, 12],
    [11, 1, 7],
    [12, 4, 0]
  ];
  const SHAK = [['Shaker 16ths', { pc: L(ev(1), [], [0, 4, 8, 12]) }]];
  const FIVE = (h, tr) => tr;
  const FAMX = [];
  const fam = (id, tag, genre, o) => {
    o.K = o.K.map(([n, d]) => [n, typeof d === 'string' ? { k: d } : d]);
    FAMX.push({ id, tag, genre, ...o });
  };
  const HOUSEH = [
    ['Offbeat Open', { oh: L([2, 6, 10, 14]) }],
    ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
    ['8ths', { h: L(ev(2)) }],
    ['Offbeat+16ths', { oh: L([2, 6, 10, 14]), h: L([], [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]) }],
    ['Shuffle', { h: L([0, 3, 4, 7, 8, 11, 12, 15]) }],
    ['Closed Offbeat', { h: L([2, 6, 10, 14]) }],
    ['Ride Offbeat', { rd: L([2, 6, 10, 14]) }]
  ];
  const HOUSEX = [
    ['', {}],
    [' +Shaker', { pc: L([], ev(1)) }],
    [' +Rim', { rim: L([], [3, 7, 11, 15]) }],
    [' +Perc', { pc: L([3, 6, 11, 14]) }]
  ];
  const FOUR = [
    ['Four', L(ev(4))],
    ['Four Ghost', L(ev(4), [15])],
    ['Shuffle', L(ev(4), [6])],
    ['Broken', L([0, 4, 8, 11])],
    ['Skip', L(ev(4), [10])],
    ['Half', L([0, 8, 12])]
  ];
  const FOUR2 = [{ k: L(ev(4), [14]) }, { k: L([0, 4, 8, 10, 12]) }, { k: L(ev(4), [7]) }];
  const CLAPS = [
    ['Clap', { c: L([4, 12]) }],
    ['Clap+Snare', { c: L([4, 12]), s: L([], [4, 12]) }],
    ['Clap Ghost', { c: L([4, 12], [10]) }],
    ['Snare', { s: L([4, 12]) }],
    ['Rim+Clap', { rim: L([4, 12]), c: L([12]) }]
  ];
  const CLAPS2 = [{ c: L([4, 12], [14, 15]) }, { c: L([4, 12]), s: L([13, 14, 15]) }, { c: L([4, 12], [7, 10]) }];
  fam('house', 'House', 'house', {
    sids: ['deephouse', 'classichouse', 'techhouse', 'afrohouse'],
    styles: {
      deephouse: { bpm: 122, k: [0, 1, 2], s: [0, 2, 4], h: [0, 2, 5], x: [0, 1, 2] },
      classichouse: { bpm: 125, k: [0, 3, 4], s: [0, 1, 3], h: [1, 3, 4], x: [0, 3] },
      techhouse: { bpm: 126, k: [0, 1, 5], s: [1, 3, 4], h: [1, 3, 6], x: [0, 1, 3] },
      afrohouse: { bpm: 122, k: [0, 2, 4], s: [2, 4, 0], h: [4, 5, 2], x: [1, 2, 3] }
    },
    K: FOUR,
    K2: FOUR2,
    S: CLAPS,
    S2: CLAPS2,
    H: HOUSEH,
    X: HOUSEX,
    perc: [
      ...SHAK,
      ['Congas', { lt: L([3, 6, 11]), mt: L([7, 14]) }],
      ['Rim Offbeat', { rim: L([2, 6, 10, 14]) }],
      ['Cowbell', { pc: L([3, 7, 11, 15]) }],
      ['Clap Echo', { c: L([4, 12], [7, 15]) }],
      ['Open Hat 16th', { oh: L([3, 7, 11, 15]) }],
      ['Tom Groove', { ht: L([5, 13]), mt: L([9]), lt: L([14]) }],
      ['Crash', { cr: L([0]) }]
    ],
    BT: [
      ['Offbeat', NB([2, 6, 10, 14], 2)],
      ['Rolling', NB([0, 2, 3, 6, 8, 10, 11, 14], 1)],
      ['Pump', NB([0, 3, 6, 10, 12], 2)],
      ['Four Walk', [...NB(ev(4), 3), [14, 2, 7]]],
      [
        'Bounce',
        [
          [0, 2, 0],
          [3, 1, 0],
          [6, 2, 7],
          [10, 2, 0],
          [13, 2, 12]
        ]
      ],
      [
        'Sub Long',
        [
          [0, 12, 0, 110],
          [12, 4, 7]
        ]
      ],
      ['Syncopated', NB([0, 3, 6, 9, 12], 2)],
      ['Acid-ish', NB([0, 2, 3, 5, 7, 8, 10, 12, 14], 1)]
    ],
    progs: 'min',
    keys: ['Am', 'Cm', 'Dm', 'Fm', 'Gm', 'Em'],
    modes: ['Minor', 'Dorian'],
    counts: { chords: 36, bass: 36, arps: 20, leads: 20, pads: 12 }
  });
  fam('techno', 'Techno', 'techno', {
    sids: ['techno', 'minimal', 'acidtechno'],
    styles: {
      techno: { bpm: 135, k: [0, 1, 5], s: [0, 1, 2], h: [0, 3, 4], x: [0, 1, 2] },
      minimal: { bpm: 128, k: [3, 1, 4], s: [3, 4, 1], h: [2, 5, 1], x: [1, 2, 3] },
      acidtechno: { bpm: 132, k: [1, 2, 4], s: [0, 2, 3], h: [3, 1, 0], x: [0, 2, 3] }
    },
    K: [
      ['Four', L(ev(4), [], [0])],
      ['Four Hard', L(ev(4))],
      ['Rolling', L(ev(4), [3, 7, 11, 15])],
      ['Minimal', L(ev(4), [14])],
      ['Syncopated', L([0, 4, 8, 10, 12])],
      ['Stomp', L(ev(4), [2, 6])]
    ],
    K2: [{ k: L(ev(4), [15]) }, { k: L([0, 4, 8, 10, 12]) }, { k: L(ev(4), [3]) }],
    S: [
      ['Clap', { c: L([4, 12]) }],
      ['Rim Clap', { rim: L([4, 12]), c: L([12]) }],
      ['Snare', { s: L([4, 12]) }],
      ['Off Rim', { rim: L([2, 6, 10, 14]) }],
      ['Clap Ghost', { c: L([4, 12], [14]) }]
    ],
    S2: [{ c: L([4, 12], [15]) }, { c: L([4, 12]), rim: L([13, 14, 15]) }, { c: L([4], [], [12]) }],
    H: [
      ['Offbeat', { oh: L([2, 6, 10, 14]) }],
      ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Closed 8ths', { h: L(ev(2)) }],
      ['Rolling 16ths', { h: L([0, 1, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15]) }],
      ['Open+Closed', { oh: L([2, 6, 10, 14]), h: L(ev(4)) }],
      ['Ride 16ths', { rd: L(ev(1), [], [0, 4, 8, 12]) }]
    ],
    X: [
      ['', {}],
      [' +Rim', { rim: L([], [3, 7, 11, 15]) }],
      [' +Perc', { pc: L([3, 5, 8, 11, 14]) }],
      [' +Clap Off', { c: L([], [7, 15]) }]
    ],
    perc: [
      ['Industrial Perc', { pc: L([1, 3, 6, 9, 11, 14]) }],
      ['Tom Rumble', { lt: L([0, 3, 6, 8, 11, 14]), mt: L([2, 10]) }],
      ['Rim 16ths', { rim: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Cowbell Off', { pc: L([2, 6, 10, 14]) }],
      ['Hat Layer', { h: L(ev(2, 1)) }],
      ['Crash', { cr: L([0]) }],
      ['Clap Skip', { c: L([4, 12], [7]) }],
      ['Shaker', { pc: L(ev(1), [], [2, 6, 10, 14]) }]
    ],
    BT: [
      ['Rolling Sub', NB([0, 2, 3, 5, 6, 8, 10, 11, 13, 14], 1)],
      ['Offbeat', NB([2, 6, 10, 14], 2)],
      ['Acid Run', ACID],
      ['Driving', NB(ev(2), 2)],
      ['Sparse', NB([0, 6, 10], 3)],
      ['Rumble', [[0, 16, 0, 100]]],
      [
        'Sidechain Pump',
        [
          [2, 3, 0],
          [6, 3, 0],
          [10, 3, 0],
          [14, 2, 0]
        ]
      ],
      ['Pulse', NB(ev(1), 1, 0, 90)]
    ],
    progs: 'min',
    keys: ['Am', 'Cm', 'Dm', 'Em', 'Gm'],
    modes: ['Minor', 'Phrygian'],
    counts: { chords: 30, bass: 36, arps: 24, leads: 20, pads: 12 }
  });
  fam('garage', 'UKG', 'garage', {
    sids: ['ukgarage', 'speedgarage'],
    styles: {
      ukgarage: { bpm: 132, k: [0, 1, 2], s: [0, 1, 2], h: [0, 1, 3], x: [0, 1, 2] },
      speedgarage: { bpm: 136, k: [3, 4, 0], s: [2, 3, 4], h: [2, 3, 5], x: [1, 2, 3] }
    },
    K: [
      ['2-Step', L([0, 10])],
      ['2-Step Skip', L([0, 10], [3])],
      ['Broken', L([0, 7, 10])],
      ['Four Skip', L(ev(4), [10])],
      ['Double', L([0, 3, 10])],
      ['Late', L([0, 11])]
    ],
    K2: [{ k: L([0, 10], [14]) }, { k: L([0, 6, 10]) }, { k: L([0, 3, 10, 14]) }],
    S: [
      ['Snare', { s: L([4, 12]) }],
      ['Snare Ghost', { s: L([4, 12], [7, 15]) }],
      ['Clap Snare', { s: L([4, 12]), c: L([4, 12]) }],
      ['Late Snare', { s: L([4, 13]) }],
      ['Rim', { s: L([4, 12]), rim: L([], [2, 6, 10, 14]) }]
    ],
    S2: [{ s: L([4, 12], [9, 14, 15]) }, { s: L([4], [], [12]), c: L([14, 15]) }, { s: L([4, 12], [10]) }],
    H: [
      ['Shuffle 8ths', { h: L([0, 3, 4, 7, 8, 11, 12, 15]) }],
      ['16ths Swing', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Open Offbeat', { oh: L([2, 6, 10, 14]), h: L(ev(4)) }],
      ['Skippy', { h: L([0, 2, 3, 6, 8, 10, 11, 14]) }],
      ['Ride', { rd: L(ev(2)) }],
      ['Shaker', { h: L([], ev(1)), oh: L([6, 14]) }]
    ],
    X: [
      ['', {}],
      [' +Rim', { rim: L([], [3, 7, 11, 15]) }],
      [' +Shaker', { pc: L([], ev(1)) }],
      [' +Toms', { lt: L([13]), mt: L([11]) }]
    ],
    perc: [
      ['Shaker Swing', { pc: L(ev(1), [], [3, 7, 11, 15]) }],
      ['Rim Offbeat', { rim: L([2, 6, 10, 14]) }],
      ['Cowbell', { pc: L([3, 10]) }],
      ['Clap Echo', { c: L([4, 12], [6, 14]) }],
      ['Open Hat', { oh: L([6, 14]) }],
      ['Tom Syncopation', { lt: L([3, 9, 13]), ht: L([5, 11]) }],
      ['Crash', { cr: L([0]) }],
      ['Skip Hats', { h: L([2, 5, 8, 11, 14]) }]
    ],
    BT: [
      [
        'Wobble Sub',
        [
          [0, 3, 0],
          [4, 2, 0],
          [10, 3, 0],
          [14, 2, 7]
        ]
      ],
      ['2-Step Bass', NB([0, 3, 6, 10, 13], 2)],
      ['Skip', NB([0, 3, 7, 10], 3)],
      [
        'Long Sub',
        [
          [0, 12, 0, 110],
          [12, 4, 5]
        ]
      ],
      [
        'Reese Hold',
        [
          [0, 8, 0, 110],
          [8, 8, 3, 100]
        ]
      ],
      ['Chop', NB([0, 2, 5, 8, 10, 13], 2)],
      [
        'Walk',
        [
          [0, 4, 0],
          [4, 4, 3],
          [8, 4, 5],
          [12, 4, 7]
        ]
      ],
      ['Pump', NB([0, 6, 10], 4)]
    ],
    progs: 'min',
    keys: ['Am', 'Cm', 'Dm', 'Fm'],
    modes: ['Minor', 'Dorian'],
    counts: { chords: 30, bass: 30, arps: 16, leads: 16, pads: 10 }
  });
  fam('dubstep', 'Dubstep', 'dubstep', {
    sids: ['dubstep', 'riddim'],
    styles: {
      dubstep: { bpm: 140, k: [0, 1, 4], s: [0, 1, 3], h: [0, 1, 3], x: [0, 1, 2] },
      riddim: { bpm: 150, k: [1, 2, 0], s: [0, 2, 4], h: [1, 3, 5], x: [1, 2, 3] }
    },
    K: [
      ['Half', L([0, 10])],
      ['Half Skip', L([0, 6, 10])],
      ['Half Double', L([0, 2, 10])],
      ['Sparse', L([0])],
      ['Late', L([0, 11])]
    ],
    K2: [{ k: L([0, 10], [14]) }, { k: L([0, 6, 10, 14]) }, { k: L([0, 2, 10]) }],
    S: [
      ['Half Snare', { s: L([8]) }],
      ['Snare+Clap', { s: L([8]), c: L([8]) }],
      ['Rimshot', { s: L([8]), rim: L([], [2, 6, 10, 14]) }],
      ['Ghost', { s: L([8], [14]) }],
      ['Double', { s: L([8, 9]) }]
    ],
    S2: [{ s: L([8], [12, 14, 15]) }, { s: L([8]), c: L([14, 15]) }, { s: L([8], [11]) }],
    H: [
      ['8ths', { h: L(ev(2)) }],
      ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Open Offbeat', { oh: L([4, 12]), h: L(ev(2)) }],
      ['Sparse', { h: L(ev(4)) }],
      ['Shuffle', { h: L([0, 3, 6, 8, 11, 14]) }],
      ['Rides', { rd: L(ev(4)) }]
    ],
    X: [
      ['', {}],
      [' +Rim', { rim: L([], [3, 7, 11, 15]) }],
      [' +Perc', { pc: L([2, 6, 10, 14]) }],
      [' +Clap', { c: L([], [4, 12]) }]
    ],
    perc: [
      ['Bass Perc', { lt: L([0, 10]), mt: L([5]) }],
      ['Rim 16ths', { rim: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Cowbell', { pc: L([2, 6, 10, 14]) }],
      ['Clap Echo', { c: L([8], [10, 14]) }],
      ['Crash', { cr: L([0]) }],
      ['Tom Roll', { ht: L([12, 13, 14, 15]) }],
      ['Shaker', { pc: L(ev(1), [], [0, 8]) }],
      ['Open Hat', { oh: L([6, 14]) }]
    ],
    BT: [
      [
        'Wobble',
        [
          [0, 8, 0, 115],
          [8, 6, 0],
          [14, 2, -2]
        ]
      ],
      ['Riddim Stab', NB([0, 3, 6, 8, 11, 14], 2)],
      [
        'Growl Hold',
        [
          [0, 12, 0, 120],
          [12, 4, 3]
        ]
      ],
      ['Triplet', NB([0, 3, 6, 9, 12], 3)],
      [
        'Neuro Step',
        [
          [0, 3, 0, 120],
          [4, 2, 12],
          [8, 3, -2, 120],
          [12, 4, 10]
        ]
      ],
      ['Sub Drop', [[0, 16, 0, 127]]],
      ['Chop', NB(ev(4), 2, 0, 115)],
      [
        'Slide',
        [
          [0, 6, 0, 120],
          [6, 2, 3],
          [8, 6, 5],
          [14, 2, 7]
        ]
      ]
    ],
    progs: 'min',
    keys: ['Fm', 'Gm', 'Em', 'Am', 'Cm'],
    modes: ['Minor', 'Phrygian'],
    counts: { chords: 24, bass: 36, arps: 12, leads: 20, pads: 10 }
  });
  fam('trance', 'Trance', 'trance', {
    sids: ['trance', 'progtrance'],
    styles: {
      trance: { bpm: 138, k: [0, 1, 3], s: [0, 1, 3], h: [0, 2, 3], x: [0, 1, 3] },
      progtrance: { bpm: 130, k: [1, 2, 4], s: [2, 4, 0], h: [1, 3, 4], x: [0, 1, 2] }
    },
    K: [
      ['Four', L(ev(4), [], [0])],
      ['Four Plain', L(ev(4))],
      ['Four Ghost', L(ev(4), [15])],
      ['Rolling', L(ev(4), [3, 7, 11, 15])],
      ['Punch', L(ev(4), [14])]
    ],
    K2: [{ k: L(ev(4), [15]) }, { k: L(ev(4), [3]) }, { k: L([0, 4, 8, 10, 12]) }],
    S: [
      ['Clap', { c: L([4, 12]) }],
      ['Snare+Clap', { s: L([4, 12]), c: L([4, 12]) }],
      ['Snare', { s: L([4, 12]) }],
      ['Clap Roll', { c: L([4, 12], [14, 15]) }],
      ['Rim', { rim: L([4, 12]), c: L([12]) }]
    ],
    S2: [{ s: L([4, 12]), c: L([13, 14, 15]) }, { c: L([4, 12], [10, 14, 15]) }, { s: L([4, 10, 12], [15]) }],
    H: [
      ['Offbeat Open', { oh: L([2, 6, 10, 14]) }],
      ['16ths', { h: L(ev(1)) }],
      ['Offbeat+16ths', { oh: L([2, 6, 10, 14]), h: L([], [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]) }],
      ['8ths', { h: L(ev(2)) }],
      ['Ride Offbeat', { rd: L([2, 6, 10, 14]) }]
    ],
    X: [
      ['', {}],
      [' +Shaker', { pc: L([], ev(1)) }],
      [' +Rim', { rim: L([], [3, 7, 11, 15]) }],
      [' +Crash', { cr: L([0]) }]
    ],
    perc: [
      ['Shaker 16ths', { pc: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Rim Skip', { rim: L([3, 7, 11, 15]) }],
      ['Crash Downbeat', { cr: L([0]) }],
      ['Clap Echo', { c: L([4, 12], [7, 15]) }],
      ['Tom Fill Tail', { ht: L([12]), mt: L([13]), lt: L([14, 15]) }],
      ['Open Hat', { oh: L([3, 7, 11, 15]) }],
      ['Cowbell', { pc: L([2, 6, 10, 14]) }],
      ['Ride Bell', { rd: L(ev(4)) }]
    ],
    BT: [
      ['Rolling Offbeat', NB([2, 6, 10, 14], 2)],
      ['16th Bass', NB([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15], 1)],
      ['Octave Pulse', NB(ev(1), 1).map((n, i) => [n[0], 1, i % 2 ? 12 : 0])],
      ['Gallop', NB([0, 3, 4, 7, 8, 11, 12, 15], 1)],
      [
        'Long',
        [
          [0, 12, 0],
          [12, 4, 7]
        ]
      ],
      [
        'Offbeat Long',
        [
          [2, 3, 0],
          [6, 3, 0],
          [10, 3, 0],
          [14, 2, 0]
        ]
      ],
      ['Pump', NB(ev(4), 3)],
      [
        'Walk',
        [
          [0, 4, 0],
          [4, 4, 7],
          [8, 4, 5],
          [12, 4, 3]
        ]
      ]
    ],
    progs: 'min',
    keys: ['Am', 'Em', 'Dm', 'Gm', 'Cm'],
    modes: ['Minor', 'Dorian'],
    counts: { chords: 36, bass: 30, arps: 30, leads: 30, pads: 16 }
  });
  fam('electro', 'Electro', 'electro', {
    sids: ['electro', 'breakbeat'],
    styles: {
      electro: { bpm: 125, k: [0, 2, 4], s: [0, 1, 2], h: [0, 1, 2], x: [0, 1, 2] },
      breakbeat: { bpm: 130, k: [1, 5, 2], s: [2, 3, 4], h: [2, 4, 0], x: [1, 3, 0] }
    },
    K: [
      ['Electro', L([0, 3, 10])],
      ['Break', L([0, 10])],
      ['Funky', L([0, 3, 6, 10])],
      ['Miami', L([0, 4, 6, 10, 12])],
      ['Sync', L([0, 3, 8, 11])],
      ['Boom', L([0, 3, 7, 10])]
    ],
    K2: [{ k: L([0, 3, 10], [14]) }, { k: L([0, 6, 10]) }, { k: L([0, 3, 6, 11]) }],
    S: [
      ['Snare', { s: L([4, 12]) }],
      ['Clap Snare', { s: L([4, 12]), c: L([4, 12]) }],
      ['Ghosts', { s: L([4, 12], [7, 10, 15]) }],
      ['Late', { s: L([4, 13]) }],
      ['Rim Clap', { rim: L([4, 12]), c: L([12]) }]
    ],
    S2: [{ s: L([4, 12], [9, 11, 14]) }, { s: L([4, 12]), c: L([13, 14, 15]) }, { s: L([4], [], [12]), rim: L([15]) }],
    H: [
      ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Offbeat Open', { oh: L([2, 6, 10, 14]), h: L(ev(2)) }],
      ['Skip', { h: L([0, 2, 3, 6, 8, 10, 11, 14]) }],
      ['8ths', { h: L(ev(2)) }],
      ['Shuffle', { h: L([0, 3, 4, 7, 8, 11, 12, 15]) }]
    ],
    X: [
      ['', {}],
      [' +Cow', { pc: L([3, 7, 11, 15]) }],
      [' +Toms', { lt: L([13]), mt: L([14]), ht: L([15]) }],
      [' +Rim', { rim: L([], [3, 7, 11, 15]) }]
    ],
    perc: [
      ['Cowbell', { pc: L([3, 7, 11, 15]) }],
      ['Electro Toms', { lt: L([2, 10]), mt: L([6, 14]), ht: L([12]) }],
      ['Clap Echo', { c: L([4, 12], [6, 14]) }],
      ['Rim 16ths', { rim: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Shaker', { pc: L(ev(1), [], [0, 8]) }],
      ['Crash', { cr: L([0]) }],
      ['Open Hat', { oh: L([6, 14]) }],
      ['Conga', { lt: L([3, 6, 11]), mt: L([7, 14]) }]
    ],
    BT: [
      [
        'Electro Bounce',
        [
          [0, 2, 0],
          [3, 1, 0],
          [6, 2, 7],
          [10, 2, 0],
          [13, 2, 5]
        ]
      ],
      ['Sync', NB([0, 3, 6, 9, 12], 2)],
      ['Acid', ACID],
      ['Pulse', NB(ev(2), 2)],
      ['Funk', FUNKB],
      [
        'Long',
        [
          [0, 12, 0],
          [12, 4, 5]
        ]
      ],
      ['Offbeat', NB([2, 6, 10, 14], 2)],
      ['Chop', NB([0, 4, 6, 10, 12], 2)]
    ],
    progs: 'min',
    keys: ['Am', 'Cm', 'Em', 'Gm', 'Dm'],
    modes: ['Minor', 'Dorian'],
    counts: { chords: 30, bass: 30, arps: 24, leads: 20, pads: 10 }
  });
  const FUNKK = [
    ['Funk', L([0, 3, 6, 10], [14])],
    ['Four', L(ev(4))],
    ['Disco', L(ev(4), [], [0])],
    ['Syncopated', L([0, 3, 8, 11])],
    ['Offbeat', L([0, 6, 10, 13])],
    ['Boogie', L([0, 4, 7, 8, 12])]
  ];
  fam('funk', 'Funk', 'funk', {
    sids: ['funk', 'disco', 'nudisco'],
    styles: {
      funk: { bpm: 105, k: [0, 3, 4], s: [1, 3, 0], h: [3, 0, 5], x: [0, 2, 3] },
      disco: { bpm: 118, k: [1, 2, 5], s: [0, 2, 4], h: [1, 0, 4], x: [0, 1, 3] },
      nudisco: { bpm: 116, k: [2, 1, 3], s: [2, 0, 1], h: [1, 4, 2], x: [1, 2, 3] }
    },
    K: FUNKK,
    K2: [{ k: L([0, 3, 6, 10, 14]) }, { k: L(ev(4), [15]) }, { k: L([0, 3, 8, 10, 13]) }],
    S: [
      ['Backbeat', { s: L([4, 12]) }],
      ['Ghost', { s: L([4, 12], [1, 7, 9, 15]) }],
      ['Clap Snare', { s: L([4, 12]), c: L([4, 12]) }],
      ['Funk', { s: L([4, 12], [3, 9, 14]) }],
      ['Rim', { rim: L([4, 12]), s: L([], [15]) }]
    ],
    S2: [{ s: L([4, 12], [9, 11, 14, 15]) }, { s: L([4], [], [12]), c: L([13, 15]) }, { s: L([4, 12], [7, 10]) }],
    H: [
      ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Open Disco', { oh: L([2, 6, 10, 14]), h: L(ev(4)) }],
      ['8ths', { h: L(ev(2)) }],
      ['Funk 16ths', { h: L([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]) }],
      ['Ride', { rd: L(ev(2)) }],
      ['Shuffle', { h: L([0, 3, 4, 7, 8, 11, 12, 15]) }]
    ],
    X: [
      ['', {}],
      [' +Cow', { pc: L([3, 7, 11, 15]) }],
      [' +Rim', { rim: L([], [2, 6, 10, 14]) }],
      [' +Clap', { c: L([4, 12]) }]
    ],
    perc: [
      ['Tambourine', { pc: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Congas', { lt: L([3, 6, 11]), mt: L([7, 14]) }],
      ['Cowbell', { pc: L([3, 7, 11, 15]) }],
      ['Clap Echo', { c: L([4, 12], [7, 15]) }],
      ['Rim Skip', { rim: L([3, 10, 13]) }],
      ['Open Hat', { oh: L([2, 6, 10, 14]) }],
      ['Tom Fill', { ht: L([12]), mt: L([13]), lt: L([14, 15]) }],
      ['Shaker', { pc: L(ev(1), [], [0, 8]) }]
    ],
    BT: [
      ['Funk Slap', FUNKB],
      ['Disco Octaves', OCT],
      ['Walking', WALKM],
      ['Pocket', NB([0, 3, 6, 10, 12], 2)],
      ['Offbeat', NB([2, 6, 10, 14], 2)],
      [
        'Boogie',
        [
          [0, 3, 0],
          [4, 2, 0],
          [7, 2, 5],
          [10, 2, 7],
          [13, 3, 0]
        ]
      ],
      [
        'Long',
        [
          [0, 12, 0],
          [12, 4, 7]
        ]
      ],
      ['Syncopated', NB([0, 3, 8, 11, 14], 2)]
    ],
    progs: 'maj',
    keys: ['C', 'G', 'F', 'D', 'A', 'Bb'],
    modes: ['Major', 'Mixolydian'],
    counts: { chords: 40, bass: 36, arps: 20, leads: 24, pads: 12 }
  });
  fam('reggae', 'Reggae', 'reggae', {
    sids: ['reggae', 'dub', 'dancehall'],
    styles: {
      reggae: { bpm: 75, k: [0, 1, 3], s: [0, 1, 2], h: [0, 1, 3], x: [0, 1, 3] },
      dub: { bpm: 70, k: [0, 5, 1], s: [1, 0, 2], h: [1, 5, 3], x: [1, 2, 3] },
      dancehall: { bpm: 98, k: [4, 3, 1], s: [4, 3, 2], h: [2, 0, 4], x: [0, 2, 3] }
    },
    K: [
      ['One Drop', L([8])],
      ['One Drop Ghost', L([8], [10])],
      ['Rockers', L(ev(4))],
      ['Steppers', L(ev(4), [6])],
      ['Dancehall', L([0, 3, 6, 10])],
      ['Sparse', L([8], [0])]
    ],
    K2: [{ k: L([8], [14]) }, { k: L([0, 8]) }, { k: L(ev(4), [15]) }],
    S: [
      ['Rim One Drop', { rim: L([8]) }],
      ['Snare One Drop', { s: L([8]) }],
      ['Cross Stick', { rim: L([4, 12]) }],
      ['Snare Back', { s: L([4, 12]) }],
      ['Dancehall Snare', { s: L([3, 6, 10, 14]) }]
    ],
    S2: [{ rim: L([8], [14, 15]) }, { s: L([8]), rim: L([13, 15]) }, { rim: L([4, 12], [10]) }],
    H: [
      ['8ths', { h: L(ev(2)) }],
      ['Skank Hat', { h: L([2, 6, 10, 14]) }],
      ['16ths Soft', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Open Offbeat', { oh: L([2, 10]), h: L(ev(2)) }],
      ['Shuffle', { h: L([0, 3, 4, 7, 8, 11, 12, 15]) }],
      ['Ride', { rd: L(ev(2)) }]
    ],
    X: [
      ['', {}],
      [' +Shaker', { pc: L([], ev(1)) }],
      [' +Perc', { pc: L([3, 7, 11, 15]) }],
      [' +Rim', { rim: L([4, 12], [6]) }]
    ],
    perc: [
      ['Shaker', { pc: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Cowbell', { pc: L([4, 12]) }],
      ['Rim Offbeat', { rim: L([2, 6, 10, 14]) }],
      ['Conga', { lt: L([3, 6, 11]), mt: L([7, 14]) }],
      ['Clap Echo', { c: L([8], [10, 14]) }],
      ['Open Hat', { oh: L([6, 14]) }],
      ['Tom Fill', { ht: L([12]), mt: L([13]), lt: L([14, 15]) }],
      ['Crash', { cr: L([0]) }]
    ],
    BT: [
      [
        'Dub Root',
        [
          [0, 6, 0],
          [8, 4, 0],
          [12, 4, 7]
        ]
      ],
      [
        'One Drop Bass',
        [
          [0, 3, 0],
          [6, 2, 7],
          [8, 4, 0],
          [12, 2, 3]
        ]
      ],
      [
        'Skank Walk',
        [
          [0, 4, 0],
          [4, 2, 4],
          [6, 2, 5],
          [8, 4, 7],
          [12, 4, 5]
        ]
      ],
      ['Dancehall', NB([0, 3, 6, 10, 12], 2)],
      ['Long', [[0, 16, 0]]],
      ['Bubble', NB(ev(2), 1)],
      [
        'Rocker',
        [
          [0, 2, 0],
          [3, 2, 0],
          [6, 2, 7],
          [8, 2, 0],
          [11, 2, 5],
          [14, 2, 7]
        ]
      ],
      [
        'Sub Drop',
        [
          [0, 8, 0, 115],
          [8, 8, 5]
        ]
      ]
    ],
    progs: 'maj',
    keys: ['C', 'G', 'D', 'F', 'A'],
    modes: ['Major', 'Mixolydian'],
    counts: { chords: 30, bass: 36, arps: 12, leads: 16, pads: 12 }
  });
  fam('latin', 'Latin', 'latin', {
    sids: ['reggaeton', 'afrobeats'],
    styles: {
      reggaeton: { bpm: 94, k: [0, 1, 5], s: [0, 1, 4], h: [0, 2, 4], x: [0, 1, 2] },
      afrobeats: { bpm: 100, k: [3, 4, 2], s: [3, 2, 4], h: [3, 4, 1], x: [1, 2, 3] }
    },
    K: [
      ['Dembow', L(ev(4))],
      ['Dembow Ghost', L(ev(4), [15])],
      ['Half', L([0, 8])],
      ['Afro', L([0, 6, 10])],
      ['Afro Sync', L([0, 3, 6, 10, 13])],
      ['Bounce', L([0, 4, 8, 11])]
    ],
    K2: [{ k: L(ev(4), [14]) }, { k: L([0, 3, 6, 10]) }, { k: L([0, 6, 8, 11]) }],
    S: [
      ['Dembow', { s: L([3, 6, 11, 14]) }],
      ['Dembow Clap', { c: L([3, 6, 11, 14]) }],
      ['Backbeat', { s: L([4, 12]) }],
      ['Afro Rim', { rim: L([3, 7, 10, 14]) }],
      ['Snare Clap', { s: L([3, 6, 11, 14]), c: L([4, 12]) }]
    ],
    S2: [{ s: L([3, 6, 11, 14], [15]) }, { c: L([3, 6, 11], [13, 14, 15]) }, { s: L([3, 6, 10, 14]) }],
    H: [
      ['8ths', { h: L(ev(2)) }],
      ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Offbeat Open', { oh: L([2, 6, 10, 14]) }],
      ['Shaker 16th', { pc: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Skip', { h: L([0, 2, 3, 6, 8, 10, 11, 14]) }],
      ['Rolling', { h: L([0, 1, 2, 4, 6, 7, 8, 10, 12, 14, 15]) }]
    ],
    X: [
      ['', {}],
      [' +Cow', { pc: L([3, 7, 11, 15]) }],
      [' +Conga', { lt: L([3, 10]), mt: L([7, 14]) }],
      [' +Rim', { rim: L([], [2, 6, 10, 14]) }]
    ],
    perc: [
      ['Congas', { lt: L([3, 6, 11]), mt: L([7, 14]) }],
      ['Cowbell', { pc: L([3, 7, 11, 15]) }],
      ['Clave Rim', { rim: L([0, 3, 6, 10, 12]) }],
      ['Shaker', { pc: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Clap Echo', { c: L([4, 12], [7, 15]) }],
      ['Open Hat', { oh: L([6, 14]) }],
      ['Tom Fill', { ht: L([12]), mt: L([13]), lt: L([14, 15]) }],
      ['Crash', { cr: L([0]) }]
    ],
    BT: [
      [
        'Dembow Bass',
        [
          [0, 3, 0],
          [4, 2, 0],
          [8, 3, 0],
          [12, 2, 7]
        ]
      ],
      [
        'Tresillo',
        [
          [0, 3, 0],
          [3, 3, 0],
          [6, 2, 7],
          [8, 3, 0],
          [11, 3, 5],
          [14, 2, 7]
        ]
      ],
      ['Afro Pocket', NB([0, 3, 6, 10, 12], 2)],
      [
        'Long',
        [
          [0, 12, 0],
          [12, 4, 5]
        ]
      ],
      ['Bounce', NB([0, 3, 8, 11], 3)],
      [
        'Walk',
        [
          [0, 4, 0],
          [4, 4, 3],
          [8, 4, 5],
          [12, 4, 7]
        ]
      ],
      ['Offbeat', NB([2, 6, 10, 14], 2)],
      [
        '808 Slide',
        [
          [0, 6, 0, 120],
          [6, 2, 0],
          [8, 6, 5],
          [14, 2, 7]
        ]
      ]
    ],
    progs: 'min',
    keys: ['Am', 'Dm', 'Gm', 'Cm', 'Em'],
    modes: ['Minor', 'Dorian'],
    counts: { chords: 36, bass: 36, arps: 20, leads: 24, pads: 10 }
  });
  const SYNK = [
    ['Four', L(ev(4))],
    ['Retro', L(ev(4), [10])],
    ['Pop', L([0, 8, 10])],
    ['Drive', L(ev(4), [15])],
    ['Half', L([0, 8])],
    ['Pump', L([0, 3, 8, 11])]
  ];
  const SYNS = [
    ['Backbeat', { s: L([4, 12]) }],
    ['Gated', { s: L([4, 12]), c: L([4, 12]) }],
    ['Clap', { c: L([4, 12]) }],
    ['Snare Ghost', { s: L([4, 12], [15]) }],
    ['Snap', { c: L([4, 12]), rim: L([4, 12]) }]
  ];
  const SYNH = [
    ['8ths', { h: L(ev(2)) }],
    ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
    ['Open Offbeat', { oh: L([2, 6, 10, 14]), h: L(ev(4)) }],
    ['Closed Offbeat', { h: L([2, 6, 10, 14]) }],
    ['Ride 8ths', { rd: L(ev(2)) }]
  ];
  const SYNX = [
    ['', {}],
    [' +Toms', { lt: L([13]), mt: L([14]), ht: L([15]) }],
    [' +Cow', { pc: L([3, 7, 11, 15]) }],
    [' +Crash', { cr: L([0]) }]
  ];
  const SYNP = [
    ['Gated Toms', { lt: L([12, 13]), mt: L([14]), ht: L([15]) }],
    ['Cowbell', { pc: L([3, 7, 11, 15]) }],
    ['Tambourine', { pc: L(ev(1), [], [0, 4, 8, 12]) }],
    ['Clap Echo', { c: L([4, 12], [7, 15]) }],
    ['Crash', { cr: L([0]) }],
    ['Rim 16ths', { rim: L(ev(1), [], [0, 4, 8, 12]) }],
    ['Open Hat', { oh: L([6, 14]) }],
    ['Snare Roll', { s: L([12, 13, 14, 15]) }]
  ];
  const SYNK2 = [{ k: L(ev(4), [14]) }, { k: L([0, 4, 8, 10]) }, { k: L([0, 8], [14]) }];
  const SYNS2 = [{ s: L([4, 12], [14, 15]) }, { s: L([4, 12]), c: L([13, 14, 15]) }, { s: L([4, 10, 12]) }];
  fam('synth', 'Synth', 'synth', {
    sids: ['synthwave'],
    styles: { synthwave: { bpm: 100, k: [0, 1, 3], s: [1, 0, 2], h: [0, 1, 3], x: [0, 1, 3] } },
    K: SYNK,
    K2: SYNK2,
    S: SYNS,
    S2: SYNS2,
    H: SYNH,
    X: SYNX,
    perc: SYNP,
    BT: [
      ['Driving 8ths', NB(ev(2), 2)],
      ['Octave 8ths', OCT],
      ['Pulse', NB(ev(1), 1, 0, 90)],
      ['Offbeat', NB([2, 6, 10, 14], 2)],
      [
        'Long',
        [
          [0, 12, 0],
          [12, 4, 7]
        ]
      ],
      [
        'Arp Bass',
        [
          [0, 2, 0],
          [2, 2, 7],
          [4, 2, 12],
          [6, 2, 7],
          [8, 2, 0],
          [10, 2, 7],
          [12, 2, 12],
          [14, 2, 7]
        ]
      ],
      ['Pop Pocket', NB([0, 3, 6, 8, 11], 2)],
      ['Sustain', [[0, 16, 0]]]
    ],
    progs: 'min',
    keys: ['Am', 'Em', 'Dm', 'Cm', 'Gm'],
    modes: ['Minor', 'Dorian'],
    counts: { chords: 36, bass: 30, arps: 30, leads: 30, pads: 20 }
  });
  fam('pop', 'Pop', 'pop', {
    sids: ['pop', 'indie'],
    styles: {
      pop: { bpm: 118, k: [0, 2, 5], s: [0, 1, 2], h: [0, 1, 3], x: [0, 1, 3] },
      indie: { bpm: 120, k: [1, 3, 0], s: [0, 3, 4], h: [1, 4, 3], x: [0, 2, 3] }
    },
    K: SYNK,
    K2: SYNK2,
    S: SYNS,
    S2: SYNS2,
    H: SYNH,
    X: SYNX,
    perc: SYNP,
    BT: [
      ['Root 8ths', NB(ev(2), 2)],
      ['Pop Pocket', NB([0, 3, 6, 8, 11], 2)],
      [
        'Long',
        [
          [0, 12, 0],
          [12, 4, 7]
        ]
      ],
      ['Walk', WALKM],
      ['Syncopated', NB([0, 3, 6, 10, 13], 2)],
      ['Octave', OCT],
      ['Offbeat', NB([2, 6, 10, 14], 2)],
      ['Pedal', NB(ev(2), 2)]
    ],
    progs: 'maj',
    keys: ['C', 'G', 'D', 'F', 'A'],
    modes: ['Major', 'Mixolydian', 'Lydian'],
    counts: { chords: 40, bass: 30, arps: 24, leads: 30, pads: 14 }
  });
  fam('ambient', 'Ambient', 'ambient', {
    sids: ['ambient', 'cinematic'],
    styles: {
      ambient: { bpm: 70, k: [0, 1, 3], s: [0, 1, 3], h: [0, 1, 2], x: [0, 1, 2] },
      cinematic: { bpm: 80, k: [1, 2, 4], s: [1, 2, 0], h: [2, 0, 3], x: [1, 2, 0] }
    },
    K: [
      ['Pulse', L([0])],
      ['Heartbeat', L([0, 3])],
      ['Slow', L([0, 8])],
      ['Deep', L([0], [10])],
      ['Sparse', L([0, 12])]
    ],
    K2: [{ k: L([0], [8]) }, { k: L([0, 3], [10]) }, { k: L([0, 12]) }],
    S: [
      ['Soft Rim', { rim: L([8]) }],
      ['Distant Snare', { s: L([8]) }],
      ['Clap Wash', { c: L([8]) }],
      ['Brush', { s: L([], [4, 12]) }]
    ],
    S2: [{ rim: L([8], [12]) }, { s: L([8], [14]) }, { c: L([8], [11, 15]) }],
    H: [
      ['Slow Shaker', { pc: L([], [0, 4, 8, 12]) }],
      ['Soft Hat', { h: L([], [2, 6, 10, 14]) }],
      ['Ride Wash', { rd: L([0, 8]) }],
      ['Open Sparse', { oh: L([6]) }]
    ],
    X: [
      ['', {}],
      [' +Tom', { lt: L([12]) }],
      [' +Crash', { cr: L([0]) }]
    ],
    perc: [
      ['Metal Hits', { pc: L([0, 10]) }],
      ['Tom Swells', { lt: L([0]), mt: L([8]) }],
      ['Rim Sparse', { rim: L([4, 12]) }],
      ['Crash Slow', { cr: L([0]) }],
      ['Shaker Soft', { pc: L([], ev(2)) }],
      ['Clap Soft', { c: L([8]) }]
    ],
    BT: [
      ['Drone', [[0, 16, 0, 100]]],
      [
        'Slow Pulse',
        [
          [0, 8, 0],
          [8, 8, 7]
        ]
      ],
      [
        'Swell',
        [
          [0, 12, 0, 90],
          [12, 4, 5, 80]
        ]
      ],
      [
        'Sub Hits',
        [
          [0, 4, 0, 110],
          [8, 4, 0, 100]
        ]
      ],
      [
        'Moving',
        [
          [0, 8, 0],
          [8, 4, 3],
          [12, 4, 5]
        ]
      ],
      [
        'Octave Drone',
        [
          [0, 16, 0],
          [0, 16, 12, 80]
        ]
      ]
    ],
    progs: 'min',
    keys: ['Am', 'Cm', 'Dm', 'Em'],
    modes: ['Minor', 'Dorian', 'Phrygian'],
    counts: { chords: 30, bass: 18, arps: 20, leads: 20, pads: 30 }
  });
  fam('rock', 'Rock', 'rock', {
    sids: ['rock', 'punk'],
    styles: {
      rock: { bpm: 120, k: [0, 2, 3], s: [0, 1, 4], h: [0, 1, 3], x: [0, 1, 3] },
      punk: { bpm: 170, k: [1, 4, 2], s: [0, 3, 1], h: [0, 1, 5], x: [0, 3, 1] }
    },
    K: [
      ['Rock', L([0, 6, 8, 14])],
      ['Four', L(ev(4))],
      ['Driving', L(ev(4), [14])],
      ['Half', L([0, 8, 10])],
      ['Punk', L(ev(4), [], [0])],
      ['Syncopated', L([0, 3, 6, 8, 11])]
    ],
    K2: [{ k: L([0, 6, 8, 14], [15]) }, { k: L(ev(4), [15]) }, { k: L([0, 3, 6, 8, 10]) }],
    S: [
      ['Backbeat', { s: L([4, 12]) }],
      ['Ghost', { s: L([4, 12], [7, 15]) }],
      ['Rim Click', { rim: L([4, 12]) }],
      ['Fill End', { s: L([4, 12], [14, 15]) }],
      ['Clap Layer', { s: L([4, 12]), c: L([4, 12]) }]
    ],
    S2: [{ s: L([4, 12], [13, 14, 15]) }, { s: L([4], [], [12]), rim: L([14, 15]) }, { s: L([4, 12], [9, 11]) }],
    H: [
      ['8ths', { h: L(ev(2)) }],
      ['Open 8ths', { oh: L(ev(2)) }],
      ['16ths', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Ride 8ths', { rd: L(ev(2)) }],
      ['Quarter Ride', { rd: L(ev(4)) }],
      ['Crash+8ths', { h: L(ev(2)), cr: L([0]) }]
    ],
    X: [
      ['', {}],
      [' +Cow', { pc: L([2, 6, 10, 14]) }],
      [' +Toms', { lt: L([13]), mt: L([14]), ht: L([15]) }],
      [' +Crash', { cr: L([0]) }]
    ],
    perc: [
      ['Tambourine', { pc: L(ev(2), [], [0, 4, 8, 12]) }],
      ['Cowbell', { pc: L(ev(4)) }],
      ['Tom Fill', { ht: L([12]), mt: L([13]), lt: L([14, 15]) }],
      ['Crash', { cr: L([0]) }],
      ['Clap Layer', { c: L([4, 12]) }],
      ['Open Hat', { oh: L([14]) }],
      ['Rim', { rim: L([4, 12]) }],
      ['Ride Bell', { rd: L(ev(4)) }]
    ],
    BT: [
      ['Root 8ths', NB(ev(2), 2)],
      ['Pedal', NB(ev(1), 1)],
      ['Walk', WALKM],
      ['Rock Pocket', NB([0, 3, 6, 8, 11, 14], 2)],
      [
        'Long',
        [
          [0, 12, 0],
          [12, 4, 7]
        ]
      ],
      ['Syncopated', NB([0, 3, 6, 10, 13], 2)],
      ['Octave', OCT],
      ['Driving 8ths', NB(ev(2), 2)]
    ],
    progs: 'maj',
    keys: ['E', 'A', 'D', 'G', 'C'],
    modes: ['Major', 'Mixolydian'],
    counts: { chords: 36, bass: 30, arps: 16, leads: 30, pads: 10 }
  });
  fam('phonk', 'Phonk', 'hiphop', {
    sids: ['phonk'],
    styles: { phonk: { bpm: 130, k: [0, 1, 3], s: [0, 1, 2], h: [0, 1, 2], x: [0, 1, 2] } },
    K: [
      ['Phonk', L([0, 3, 6, 10])],
      ['Cowbell Drive', L([0, 6, 10])],
      ['Half', L([0, 10])],
      ['Heavy', L([0, 3, 8, 11])],
      ['Skip', L([0, 6, 8, 14])]
    ],
    K2: [{ k: L([0, 3, 6, 10], [14]) }, { k: L([0, 6, 10, 12]) }, { k: L([0, 3, 8, 10]) }],
    S: [
      ['Clap Snare', { s: L([8]), c: L([8]) }],
      ['Snare', { s: L([8]) }],
      ['Snare Ghost', { s: L([8], [14]) }],
      ['Double', { s: L([8, 9]) }],
      ['Rim', { rim: L([8]), c: L([8]) }]
    ],
    S2: [{ s: L([8], [13, 14, 15]) }, { s: L([8]), c: L([14, 15]) }, { s: L([8], [11]) }],
    H: [
      ['Rolling', { h: L(ev(1), [], [0, 4, 8, 12]) }],
      ['Trap Hats', { h: L([0, 2, 4, 6, 8, 10, 12, 13, 14, 15]) }],
      ['Open Offbeat', { oh: L([4, 12]), h: L(ev(2)) }],
      ['Sparse', { h: L(ev(4)) }]
    ],
    X: [
      ['', {}],
      [' +Cowbell', { pc: L([2, 6, 10, 14], [], [0]) }],
      [' +Cowbell Busy', { pc: L(ev(2)) }],
      [' +Rim', { rim: L([], [3, 7, 11, 15]) }]
    ],
    perc: [
      ['Phonk Cowbell', { pc: L([0, 3, 6, 10, 12]) }],
      ['Cowbell Busy', { pc: L(ev(2)) }],
      ['Clap Echo', { c: L([8], [10, 14]) }],
      ['Rim Ghost', { rim: L([], [3, 7, 11, 15]) }],
      ['Crash', { cr: L([0]) }],
      ['Open Hat', { oh: L([6, 14]) }]
    ],
    BT: [
      [
        '808 Phonk',
        [
          [0, 6, 0, 125],
          [6, 2, 0],
          [8, 6, 3],
          [14, 2, 7]
        ]
      ],
      [
        '808 Slide',
        [
          [0, 5, 0, 120],
          [6, 2, 0],
          [8, 3, 3],
          [12, 4, -2]
        ]
      ],
      ['Sub Hold', [[0, 16, 0]]],
      ['Memphis', NB([0, 3, 6, 10, 12], 2)],
      [
        'Drift',
        [
          [0, 4, 0, 120],
          [4, 4, 5],
          [8, 4, 3],
          [12, 4, 7]
        ]
      ],
      [
        'Sparse',
        [
          [0, 8, 0, 120],
          [10, 4, 5]
        ]
      ]
    ],
    progs: 'min',
    keys: ['Cm', 'Fm', 'Gm', 'Am'],
    modes: ['Minor', 'Phrygian'],
    counts: { chords: 24, bass: 30, arps: 12, leads: 20, pads: 10 }
  });

  const SHN = {
    deephouse: 'Deep house',
    classichouse: 'Classic house',
    techhouse: 'Tech house',
    afrohouse: 'Afro house',
    techno: 'Techno',
    minimal: 'Minimal',
    acidtechno: 'Acid techno',
    ukgarage: 'UK garage',
    speedgarage: 'Speed garage',
    dubstep: 'Dubstep',
    riddim: 'Riddim',
    trance: 'Trance',
    progtrance: 'Prog trance',
    electro: 'Electro',
    breakbeat: 'Breakbeat',
    funk: 'Funk',
    disco: 'Disco',
    nudisco: 'Nu-disco',
    reggae: 'Reggae',
    dub: 'Dub',
    dancehall: 'Dancehall',
    reggaeton: 'Reggaeton',
    afrobeats: 'Afrobeats',
    synthwave: 'Synthwave',
    pop: 'Pop',
    indie: 'Indie',
    ambient: 'Ambient',
    cinematic: 'Cinematic',
    rock: 'Rock',
    punk: 'Punk',
    phonk: 'Phonk'
  };
  Object.assign(SH, SHN);
  FAMX.forEach(F => {
    genKits(F, 12);
    genLayers(F);
    genFills(F);
    /* intro kits */
    const sids = F.sids;
    const bpm = F.styles[sids[0]].bpm;
    const mk = (name, lanes) =>
      add({
        name: F.tag + ' Intro: ' + name,
        type: 'drum',
        genre: F.genre,
        bpm,
        bars: 1,
        notes: D(1, lanes).notes,
        role: 'Full kit',
        styles: sids,
        pool: 'intro'
      });
    mk(F.K[0][0], F.K[0][1]);
    F.H.slice(0, 3).forEach(h => mk(F.K[0][0] + ' / ' + h[0], merge(F.K[0][1], h[1])));
    mk(F.perc[0][0] + ' / ' + F.H[0][0], merge(F.perc[0][1], F.H[0][1]));
    mk(F.K[1][0] + ' / ' + F.perc[1][0], merge(F.K[1][1], F.perc[1][1]));
    /* tone */
    const PG = F.progs === 'maj' ? PROGS_MAJ : PROGS;
    const C = F.counts;
    const KS = F.keys;
    let kk = 0;
    const nk = () => KS[kk++ % KS.length];
    const tag = F.tag + ' ';
    const pick = n => shuffle(sids).slice(0, n);
    shuffle(PG.flatMap((p, pi) => CR.map((r, ri) => [pi, ri])))
      .slice(0, C.chords)
      .forEach(([pi, ri]) => {
        const [pn, prog] = PG[pi],
          [rn, rhy] = CR[ri];
        const bars = ri % 2 === 0 ? 4 : 2;
        const kn = nk(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const [off, q] = prog[b % 4];
          const ts = tones(R, off, q, 62);
          for (const [st, len, v] of rhy) for (const n of ts) notes.push({ s: b * 16 + st, l: len, n, v });
        }
        add({
          name: tag + 'Chords: ' + pn + ' ' + rn,
          type: 'tone',
          genre: F.genre,
          bpm,
          bars,
          notes,
          keyName: kn,
          role: 'Chords',
          styles: pick(3),
          pool: 'chords'
        });
      });
    shuffle(PG.flatMap((p, pi) => F.BT.map((t, ti) => [pi, ti])))
      .slice(0, C.bass)
      .forEach(([pi, ti]) => {
        const [pn, prog] = PG[pi],
          [tn, tm] = F.BT[ti];
        const bars = pi % 2 === 0 ? 4 : 2;
        const kn = nk(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const root = rootAbs(R, prog[b % 4][0]);
          for (const [st, len, iv, v] of tm) notes.push({ s: b * 16 + st, l: len, n: root + iv, v: v || 100 });
        }
        add({
          name: tag + 'Bass: ' + pn + ' ' + tn,
          type: 'tone',
          genre: F.genre,
          bpm,
          bars,
          notes,
          keyName: kn,
          role: 'Bass',
          styles: pick(2),
          pool: 'bass'
        });
      });
    shuffle(
      PG.flatMap((p, pi) =>
        ARPS.flatMap((a, ai) => [
          [pi, ai, 1],
          [pi, ai, 2]
        ])
      )
    )
      .slice(0, C.arps)
      .forEach(([pi, ai, rate], i) => {
        const [pn, prog] = PG[pi],
          [an, pat] = ARPS[ai];
        const bars = i % 2 ? 2 : 4;
        const kn = nk(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const [off, q] = prog[b % 4];
          const ts = tones(R, off, q, 72).sort((x, y) => x - y);
          for (let s = 0; s < 16; s += rate) {
            const idx = pat[(s / rate) % pat.length];
            notes.push({
              s: b * 16 + s,
              l: rate,
              n: ts[idx % ts.length] + 12 * Math.floor(idx / ts.length),
              v: s % 4 === 0 ? 100 : 80
            });
          }
        }
        add({
          name: tag + 'Arp: ' + an + ' ' + (rate === 1 ? '16ths' : '8ths') + ' ' + pn,
          type: 'tone',
          genre: F.genre,
          bpm,
          bars,
          notes,
          keyName: kn,
          role: 'Lead',
          styles: pick(3),
          pool: 'pluck'
        });
      });
    shuffle(F.modes.flatMap(m => RH.flatMap((r, ri) => CO.map((c, ci) => [m, ri, ci]))))
      .slice(0, C.leads)
      .forEach(([m, ri, ci]) => {
        const [rn, rhy] = RH[ri],
          [cn, con] = CO[ci];
        const kn = nk(),
          R = KEYS[kn].root;
        const sc = SC[m];
        const notes = [];
        rhy.forEach(([st, len], i) => {
          const d = con[i % con.length];
          const idx = ((d % 7) + 7) % 7;
          notes.push({
            s: st,
            l: len,
            n: 60 + R + sc[idx] + 12 * Math.floor(d / 7),
            v: i % 3 === 0 ? 100 : 88
          });
        });
        add({
          name: tag + 'Lead: ' + rn + ' / ' + cn + ' (' + m + ')',
          type: 'tone',
          genre: F.genre,
          bpm,
          bars: 2,
          notes,
          keyName: kn,
          role: 'Lead',
          styles: pick(3),
          pool: 'lead'
        });
      });
    shuffle(PG.flatMap((p, pi) => PADV.map((v, vi) => [pi, vi])))
      .slice(0, C.pads)
      .forEach(([pi, vi]) => {
        const [pn, prog] = PG[pi],
          [vn, iv, base] = PADV[vi];
        const kn = nk(),
          R = KEYS[kn].root;
        const notes = [];
        for (let b = 0; b < 4; b++) {
          const off = prog[b % 4][0];
          let ns = iv.map(i => R + off + base + i);
          const m = ns.reduce((a, c) => a + c, 0) / ns.length;
          const sh = Math.round((55 - m) / 12) * 12;
          ns = ns.map(n => n + sh);
          ns.forEach(n => notes.push({ s: b * 16, l: 16, n, v: 90 }));
        }
        add({
          name: tag + 'Pad: ' + vn + ' ' + pn,
          type: 'tone',
          genre: F.genre,
          bpm,
          bars: 4,
          notes,
          keyName: kn,
          role: 'Pad',
          styles: pick(3),
          pool: 'pad'
        });
      });
  });
  /* make every name unique */
  const cnt = {};
  FAC.forEach(f => {
    cnt[f.name] = (cnt[f.name] || 0) + 1;
  });
  const used = new Set();
  FAC.forEach(f => {
    if (cnt[f.name] > 1) f.name += ' (' + (GTAG[f.genre] || f.genre) + ')';
    let n = f.name,
      i = 2;
    while (used.has(n)) n = f.name + ' #' + i++;
    f.name = n;
    used.add(n);
  });
})();
