// Extra patterns for Live Mode: fills, builds and drop impacts for every genre.
//
// Reads: FAC.
import { FAC } from './factory.js';

/* ===== Live Mode expansion: fills, builds and impacts for every genre ===== */
(function () {
  /* drum lanes: 0 kick, 1 rim, 2 snare, 3 clap, 4 closed hat, 5 open hat, 6 low tom, 7 mid tom, 8 high tom, 9 crash, 10 ride, 11 perc */
  const G = {
    dnb: { k: [0, 10], s: [4, 12], fs: 12, roll: true },
    hiphop: { k: [0, 7, 10], s: [4, 12], fs: 12, roll: false },
    house: { four: 1, s: [4, 12], fs: 8, roll: true },
    techno: { four: 1, s: [], fs: 8, roll: true },
    garage: { k: [0, 7, 10], s: [4, 12], fs: 12, roll: true },
    dubstep: { k: [0, 3], s: [8], fs: 12, roll: false },
    trance: { four: 1, s: [4, 12], fs: 8, roll: true },
    electro: { k: [0, 6, 10], s: [4, 12], fs: 12, roll: true },
    funk: { k: [0, 7, 10], s: [4, 12], fs: 12, roll: false },
    reggae: { k: [8], s: [8], fs: 12, roll: false },
    latin: { k: [0, 6, 8, 14], s: [3, 6, 11, 14], fs: 12, roll: false },
    synth: { four: 1, s: [4, 12], fs: 12, roll: false },
    pop: { four: 1, s: [4, 12], fs: 12, roll: false },
    ambient: { k: [0, 10], s: [8], fs: 12, roll: false },
    rock: { k: [0, 8, 10], s: [4, 12], fs: 12, roll: false }
  };
  const NAME = {
    dnb: 'DnB',
    hiphop: 'Hip hop',
    house: 'House',
    techno: 'Techno',
    garage: 'Garage',
    dubstep: 'Dubstep',
    trance: 'Trance',
    electro: 'Electro',
    funk: 'Funk',
    reggae: 'Reggae',
    latin: 'Latin',
    synth: 'Synthwave',
    pop: 'Pop',
    ambient: 'Ambient',
    rock: 'Rock'
  };
  let uid = 0;
  const push = o => FAC.push(Object.assign({ id: 'lx' + uid++, key: null, keyName: null, styles: null, bpm: null }, o));
  const ramp = (i, n, a, b) => Math.round(a + (b - a) * (n <= 1 ? 1 : i / (n - 1)));
  for (const g in G) {
    const q = G[g],
      nm = NAME[g];
    const groove = upto => {
      const ns = [];
      const ks = q.four ? [0, 4, 8, 12] : q.k;
      ks.forEach(s => {
        if (s < upto) ns.push({ s, l: 1, n: 0, v: 112 });
      });
      q.s.forEach(s => {
        if (s < upto) ns.push({ s, l: 1, n: 2, v: 104 });
      });
      for (let s = 0; s < upto; s += 2) ns.push({ s, l: 1, n: 4, v: s % 4 ? 66 : 82 });
      return ns;
    };
    const fills = [
      [
        'Snare 16ths',
        fs => {
          const ns = groove(fs);
          for (let s = fs, i = 0; s < 16; s++, i++) ns.push({ s, l: 1, n: 2, v: ramp(i, 16 - fs, 72, 122) });
          return ns;
        }
      ],
      [
        'Snare Roll',
        fs => {
          const ns = groove(12);
          const st = q.roll ? 0.5 : 1;
          const n = Math.round(4 / st);
          for (let i = 0; i < n; i++) ns.push({ s: 12 + i * st, l: st, n: 2, v: ramp(i, n, 60, 124) });
          return ns;
        }
      ],
      [
        'Tom Run',
        fs => {
          const ns = groove(fs);
          const L = [8, 8, 7, 7, 6, 6, 6, 0];
          for (let s = fs, i = 0; s < 16; s++, i++)
            ns.push({
              s,
              l: 1,
              n: L[Math.min(L.length - 1, Math.floor((i * L.length) / (16 - fs)))],
              v: ramp(i, 16 - fs, 90, 120)
            });
          return ns;
        }
      ],
      [
        'Clap Build',
        fs => {
          const ns = groove(8);
          [8, 10, 12, 13, 14, 15].forEach((s, i) => ns.push({ s, l: 1, n: 3, v: ramp(i, 6, 70, 124) }));
          return ns;
        }
      ],
      [
        'Kick Stutter',
        fs => {
          const ns = groove(12);
          [12, 13, 14].forEach((s, i) => ns.push({ s, l: 1, n: 0, v: ramp(i, 3, 95, 120) }));
          ns.push({ s: 15, l: 1, n: 2, v: 124 });
          return ns;
        }
      ],
      [
        'Flam Crack',
        fs => {
          const ns = groove(12);
          [
            [12, 2, 110],
            [14, 2, 100],
            [14, 3, 96],
            [15, 2, 124],
            [15, 3, 120]
          ].forEach(([s, n, v]) => ns.push({ s, l: 1, n, v }));
          if (q.roll) ns.push({ s: 15.5, l: 0.5, n: 2, v: 118 });
          return ns;
        }
      ],
      [
        'Drop-out',
        fs => {
          const ns = groove(8);
          ns.push({ s: 15, l: 1, n: 2, v: 126 }, { s: 15, l: 1, n: 3, v: 116 });
          return ns;
        }
      ],
      [
        'Mixed',
        fs => {
          const ns = groove(12);
          [
            [12, 2, 104],
            [13, 2, 96],
            [14, 8, 108],
            [14, 0, 112],
            [15, 7, 116],
            [15, 3, 122]
          ].forEach(([s, n, v]) => ns.push({ s, l: 1, n, v }));
          return ns;
        }
      ]
    ];
    fills.forEach(([fn, mk]) =>
      push({
        name: nm + ' Fill: ' + fn,
        type: 'drum',
        genre: g,
        bars: 1,
        notes: mk(q.fs),
        role: 'Fill',
        pool: 'fill'
      })
    );
    /* builds: density doubles towards the drop, velocity climbs, the last bar rolls */
    const builds = [
      ['Snare', [2]],
      ['Clap', [3]],
      ['Snare + Clap', [2, 3]],
      ['Snare + Toms', [2]],
      ...(q.four || g === 'techno' ? [['Kick', [0]]] : [['Rim', [1]]])
    ];
    [4, 8].forEach(N =>
      builds.forEach(([bn, lanes]) => {
        const ns = [];
        const total = N * 16;
        for (let b = 0; b < N; b++) {
          const p = N === 8 ? [4, 4, 4, 4, 2, 2, 1, q.roll ? 0.5 : 1][b] : [4, 2, 1, q.roll ? 0.5 : 1][b];
          for (let s = 0; s < 16; s += p) {
            const at = b * 16 + s;
            const v = ramp(at, total, 44, 124);
            lanes.forEach(n => ns.push({ s: at, l: Math.min(p, 1), n, v: n === 3 ? Math.max(40, v - 8) : v }));
          }
          if (bn === 'Snare + Toms' && b === N - 1) {
            [6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8].forEach((n, i) =>
              ns.push({ s: b * 16 + i, l: 1, n, v: ramp(i, 16, 96, 124) })
            );
          }
        }
        ns.push({ s: 0, l: 1, n: 9, v: 96 });
        push({
          name: nm + ' Build: ' + bn + ' (' + N + ' bars)',
          type: 'drum',
          genre: g,
          bars: N,
          notes: ns,
          role: 'Build',
          pool: 'build'
        });
      })
    );
    /* impacts: one hit on beat 1 for the start of a drop */
    [
      [
        'Crash + Kick',
        [
          [0, 9, 127],
          [0, 0, 127]
        ]
      ],
      [
        'Crash + Clap',
        [
          [0, 9, 127],
          [0, 3, 124],
          [0, 0, 120]
        ]
      ],
      [
        'Crash + Snare',
        [
          [0, 9, 127],
          [0, 2, 124],
          [0, 0, 124]
        ]
      ]
    ].forEach(([inm, hits]) =>
      push({
        name: nm + ' Impact: ' + inm,
        type: 'drum',
        genre: g,
        bars: 1,
        notes: hits.map(([s, n, v]) => ({ s, l: 1, n, v })),
        role: 'Impact',
        pool: 'impact'
      })
    );
  }
})();
