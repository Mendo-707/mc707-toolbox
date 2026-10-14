// The hand-written factory patterns (drums and tone parts for drum and bass and hip hop). FAC, the
// list every factory pattern goes into, is created here.
//
// Owns: FAC (the pattern library).
import { KEYS, LANE_KEY, parseNote } from '../core/theory.js';

const FAC_ERR = [];
export const D = (bars, lanes) => {
  const notes = [];
  for (const key in lanes) {
    const str = lanes[key].replace(/[\s|]/g, '');
    if (str.length !== 16 * bars) FAC_ERR.push(key + ':' + str.length + '/' + 16 * bars);
    for (let i = 0; i < str.length; i++) {
      const v = { x: 100, X: 127, o: 68, g: 42 }[str[i]];
      if (v) notes.push({ s: i, l: 1, n: LANE_KEY[key], v });
    }
  }
  return { bars, notes };
};
const T = (bars, str) => ({
  bars,
  notes: str
    .trim()
    .split(/\s+/)
    .flatMap(tok => {
      const [s, l, ns, v] = tok.split(':');
      return ns.split('+').map(n => ({ s: +s, l: +l, n: parseNote(n), v: v ? +v : 100 }));
    })
});
export const FAC = [];
const fp = (id, name, type, genre, bpm, data, meta = {}) =>
  FAC.push({
    id,
    name,
    type,
    genre,
    bpm,
    bars: data.bars,
    notes: data.notes,
    key: meta.key ? KEYS[meta.key] : null,
    keyName: meta.key || '',
    role: meta.role || (type === 'drum' ? 'Full kit' : '')
  });

/* Drum and bass drums */
fp(
  'dnb-twostep',
  'Two-Step',
  'drum',
  'dnb',
  174,
  D(1, { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', oh: '..............o.' })
);
fp(
  'dnb-ghost',
  'Two-Step Ghosts',
  'drum',
  'dnb',
  174,
  D(1, { k: 'x.........x.....', s: '....x..g.g..x..g', h: 'xoxoxoxoxoxoxoxo', oh: '.......x.......x' })
);
fp(
  'dnb-amen',
  'Amen-Style Break',
  'drum',
  'dnb',
  172,
  D(2, {
    k: 'x.x.......xx....|..x.......xx...x',
    s: '....x..g.g..x..g|....x..g.x..x...',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.'
  })
);
fp(
  'dnb-jungle',
  'Jungle Roller',
  'drum',
  'dnb',
  168,
  D(2, {
    k: 'x.........x.....|.x........x.....',
    s: '....x.g..g..x.g.|....x.g..g..x.xx',
    rd: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
    h: '..x...x...x...x.|..x...x...x...xx'
  })
);
fp(
  'dnb-liquid',
  'Liquid Roller',
  'drum',
  'dnb',
  174,
  D(2, {
    k: 'x.........x.....|x.......x.x.....',
    s: '....x.......x...|....x.......x...',
    h: 'xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxx',
    oh: '..........o.....|......o.......o.'
  })
);
fp(
  'dnb-neuro',
  'Neuro Stomp',
  'drum',
  'dnb',
  174,
  D(2, {
    k: 'x....x..x.......|x....x....x.....',
    s: '....x.......x...|....x.......x..x',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
    oh: '..............o.|......o.......o.'
  })
);
fp(
  'dnb-halftime',
  'Half-Time Roll',
  'drum',
  'dnb',
  174,
  D(2, {
    k: 'x.........x.....|x.....x...x.....',
    s: '........x.......|........x.......',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.xx'
  })
);
fp(
  'dnb-tech',
  'Techstep Clap',
  'drum',
  'dnb',
  174,
  D(1, {
    k: 'x.........x.....',
    s: '....x.......x...',
    c: '....x.......x...',
    h: 'xoxoxoxoxoxoxoxo',
    pc: '...x.....x...x..'
  })
);
fp(
  'dnb-fill',
  'Snare Fill',
  'drum',
  'dnb',
  174,
  D(1, { k: 'x.....x.......x.', s: '....x...x.x.xxxx', cr: 'x...............' }),
  { role: 'Fill' }
);
fp(
  'dnb-shuffle',
  'Breakbeat Shuffle',
  'drum',
  'dnb',
  172,
  D(2, {
    k: 'x.....x...x.....|x.....x...x..x..',
    s: '....x.......x...|....x.g.....x..g',
    h: 'x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx'
  })
);

/* Hip hop drums */
fp(
  'hh-boombap',
  'Boom Bap',
  'drum',
  'hiphop',
  90,
  D(2, {
    k: 'x......g..x.....|x.......g.x..x..',
    s: '....x.......x...|....x.......x...',
    h: 'x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.xo',
    oh: '..............o.|................'
  })
);
fp(
  'hh-bapghost',
  'Boom Bap Ghost Snares',
  'drum',
  'hiphop',
  92,
  D(2, {
    k: 'x.........x.....|x.....x...x.....',
    s: '....x..g....x..g|....x.g.....x...',
    h: 'o.x.o.x.o.x.o.x.|o.x.o.x.o.x.o.x.'
  })
);
fp(
  'hh-trap',
  'Trap Half-Time',
  'drum',
  'hiphop',
  140,
  D(2, {
    k: 'x.........x.....|x.....x.....x...',
    s: '........x.......|........x.......',
    c: '........x.......|........x.......',
    h: 'xoxoxoxoxoxoxxxx|xoxoxoxoxxxxxoXo',
    oh: '......x.........|..............x.'
  })
);
fp(
  'hh-lofi',
  'Lo-fi Dusty',
  'drum',
  'hiphop',
  78,
  D(2, {
    k: 'x.....g...x.....|x.......g.x..g..',
    s: '....x.......x...|....x.......x...',
    rim: '..............g.|......g.........',
    h: 'o.o.o.o.o.o.o.o.|o.o.o.o.o.o.o.o.'
  })
);
fp(
  'hh-gfunk',
  'G-Funk Bounce',
  'drum',
  'hiphop',
  94,
  D(1, {
    k: 'x..x....x..x....',
    s: '....x.......x...',
    c: '....x.......x...',
    h: 'x.x.x.x.x.x.x.x.',
    oh: '......x.......x.'
  })
);
fp(
  'hh-dilla',
  'Dilla Drunk',
  'drum',
  'hiphop',
  88,
  D(1, { k: 'x.....x...x.g...', s: '....x......x...g', h: 'x.xxx.x.x.xxx.x.' })
);
fp(
  'hh-drill',
  'Drill Slide',
  'drum',
  'hiphop',
  144,
  D(1, { k: 'x.........x..x..', s: '........x.......', rim: '..x.........x...', h: 'x.xxx.xxx.xxx.xx' })
);
fp(
  'hh-funk',
  'Funk Break',
  'drum',
  'hiphop',
  98,
  D(2, {
    k: 'x.x.....x.x....x|x.x.....x.x.x...',
    s: '....x..g.g..x..g|....x..g.g..x...',
    h: 'xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo',
    oh: '..............x.|..............x.'
  })
);
fp('hh-fill', 'Hip Hop Fill', 'drum', 'hiphop', 90, D(1, { s: '............xxxx', mt: '........x.x.....' }), {
  role: 'Fill'
});

/* Drum and bass tone parts (F minor) */
fp('dnb-sub', 'Sub Two-Step', 'tone', 'dnb', 174, T(2, '0:3:F1 6:2:F1 10:4:Ab1 16:3:F1 22:2:C2 26:2:Bb1 28:3:Ab1'), {
  key: 'Fm',
  role: 'Bass'
});
fp('dnb-reese', 'Reese Sustain', 'tone', 'dnb', 174, T(2, '0:16:F1:105 16:8:Db1 24:8:Eb1'), {
  key: 'Fm',
  role: 'Bass'
});
fp('dnb-oct', 'Octave Pump', 'tone', 'dnb', 174, T(1, '0:2:F1 3:1:F2 4:2:F1 7:1:F2 10:2:Ab1 13:1:Ab2 14:2:C2'), {
  key: 'Fm',
  role: 'Bass'
});
fp(
  'dnb-liquid-ch',
  'Liquid Chords',
  'tone',
  'dnb',
  174,
  T(2, '0:6:F3+Ab3+C4+Eb4+G4 8:2:F3+Ab3+C4+Eb4+G4:80 16:6:Db3+F3+Ab3+C4+Eb4 24:6:Eb3+G3+Bb3+D4'),
  { key: 'Fm', role: 'Chords' }
);
fp(
  'dnb-stabs',
  'Offbeat Stabs',
  'tone',
  'dnb',
  174,
  T(1, '3:1:F3+Ab3+C4 6:1:F3+Ab3+C4:80 11:1:Db3+F3+Ab3 14:1:Db3+F3+Ab3:80'),
  { key: 'Fm', role: 'Chords' }
);
fp(
  'dnb-pad',
  'Pad Wash',
  'tone',
  'dnb',
  174,
  T(4, '0:16:F3+Ab3+C4+Eb4 16:16:Db3+F3+Ab3+C4 32:16:Ab3+C4+Eb4+G4 48:16:Eb3+G3+Bb3+D4:90'),
  { key: 'Fm', role: 'Pad' }
);
fp(
  'dnb-arp',
  'Arp Lead',
  'tone',
  'dnb',
  174,
  T(
    1,
    '0:1:F4 1:1:Ab4 2:1:C5 3:1:Eb5 4:1:C5 5:1:Ab4 6:1:F4 7:1:Ab4 8:1:Db5 9:1:C5 10:1:Ab4 11:1:F4 12:1:Eb5 13:1:C5 14:1:Ab4 15:1:C5'
  ),
  { key: 'Fm', role: 'Lead' }
);
fp(
  'dnb-pluck',
  'Pluck Riff',
  'tone',
  'dnb',
  174,
  T(2, '0:1:C5 3:1:Eb5 6:1:F5 8:2:Eb5 12:1:C5 16:1:Ab4 19:1:C5 22:1:Eb5 24:2:Db5 28:2:C5'),
  { key: 'Fm', role: 'Lead' }
);

/* Hip hop tone parts */
fp(
  'hh-bassbap',
  'Boom Bap Bass',
  'tone',
  'hiphop',
  90,
  T(2, '0:3:G1 4:2:G1 7:1:Bb1 10:3:C2 14:2:D2 16:3:G1 20:2:G1 23:1:D2 26:3:Eb2 30:2:D2'),
  { key: 'Gm', role: 'Bass' }
);
fp('hh-808', '808 Slide', 'tone', 'hiphop', 140, T(2, '0:7:F1:120 8:3:F1 12:4:Eb1 16:7:F1:120 24:4:Db1 28:4:C1'), {
  key: 'Fm',
  role: 'Bass'
});
fp('hh-trapsub', 'Trap Sub', 'tone', 'hiphop', 140, T(1, '0:6:C1:120 8:2:C1 10:2:Eb1 12:4:G1'), {
  key: 'Cm',
  role: 'Bass'
});
fp(
  'hh-gfbass',
  'G-Funk Bass',
  'tone',
  'hiphop',
  94,
  T(1, '0:2:G1 2:2:G1 4:2:D2 6:2:G1 8:2:G1 10:2:Bb1 12:2:C2 14:2:D2'),
  { key: 'Gm', role: 'Bass' }
);
fp(
  'hh-soul',
  'Soul Chops',
  'tone',
  'hiphop',
  88,
  T(2, '0:6:A3+C4+E4+G4 10:2:A3+C4+E4+G4:80 16:6:D3+F3+A3+C4 26:4:E3+G#3+B3+D4'),
  { key: 'Am', role: 'Chords' }
);
fp(
  'hh-rhodes',
  'Dusty Rhodes',
  'tone',
  'hiphop',
  82,
  T(2, '0:8:C3+Eb3+G3+Bb3+D4 8:6:Ab3+C4+Eb4+G4 16:8:F3+Ab3+C4+Eb4+G4 24:8:G3+B3+D4+F4'),
  { key: 'Cm', role: 'Chords' }
);
fp(
  'hh-strings',
  'Dark Strings',
  'tone',
  'hiphop',
  90,
  T(4, '0:16:C3+Eb3+G3 16:16:Ab2+C3+Eb3 32:16:Bb2+D3+F3 48:16:G2+Bb2+D3:90'),
  { key: 'Cm', role: 'Pad' }
);
fp(
  'hh-piano',
  'Piano Hook',
  'tone',
  'hiphop',
  88,
  T(2, '0:2:G4 2:2:Eb5 4:3:D5 8:2:C5 10:2:Bb4 12:4:G4 16:2:G4 18:2:Eb5 20:3:F5 24:2:Eb5 26:2:D5 28:4:C5'),
  { key: 'Cm', role: 'Lead' }
);
fp('hh-bell', 'Bell Melody', 'tone', 'hiphop', 90, T(1, '0:1:G5 3:1:Eb5 6:1:D5 8:1:Bb4 11:1:C5 14:2:D5'), {
  key: 'Cm',
  role: 'Lead'
});
fp(
  'hh-gfwhine',
  'G-Funk Whine',
  'tone',
  'hiphop',
  94,
  T(2, '0:4:D5 4:2:C5 6:2:Bb4 8:4:G4 12:4:Bb4 16:6:D5 22:2:C5 24:8:Bb4'),
  { key: 'Gm', role: 'Lead' }
);

/* ===== Library expansion ===== */
/* DnB: full kits */
fp(
  'dnb-roller2',
  'Rolling Two-Step',
  'drum',
  'dnb',
  174,
  D(2, {
    k: 'x.........x.....|x.........x..x..',
    s: '....x.......x...|....x.......x...',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.xx',
    oh: '......o.......o.|......o.......o.'
  })
);
fp(
  'dnb-rave',
  'Rave Stomp',
  'drum',
  'dnb',
  172,
  D(1, { k: 'x.......x.x.....', s: '....x.......x...', c: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' })
);
fp(
  'dnb-neurofunk',
  'Neurofunk Syncopated',
  'drum',
  'dnb',
  174,
  D(2, {
    k: 'x.....x...x.....|x.........x.x...',
    s: '....x.......x...|....x.......x..x',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
    oh: '.....o.......o..|.....o.......o..'
  })
);
fp(
  'dnb-liq-shuf',
  'Liquid Shuffle',
  'drum',
  'dnb',
  172,
  D(2, {
    k: 'x.........x.....|x.....x...x.....',
    s: '....x.......x...|....x.......x..g',
    rd: 'x.x.xxx.x.x.xxx.|x.x.xxx.x.x.xxx.'
  })
);
fp(
  'dnb-jump',
  'Jump-Up Bounce',
  'drum',
  'dnb',
  174,
  D(1, { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', pc: '..x...x...x...x.' })
);
fp(
  'dnb-dark',
  'Darkside Skip',
  'drum',
  'dnb',
  172,
  D(2, {
    k: 'x.........x.....|x.....x...x.....',
    s: '....x.......x...|....x.......x...',
    h: 'o.o.o.o.o.o.o.o.|o.o.o.o.o.o.o.xx'
  })
);
fp(
  'dnb-ht-skank',
  'Halftime Skank',
  'drum',
  'dnb',
  174,
  D(2, {
    k: 'x.....x...x.....|x.....x.......x.',
    s: '........x.......|........x.......',
    c: '........x.......|........x.......',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.'
  })
);
fp('dnb-intro', 'Intro: Kick and Hat', 'drum', 'dnb', 174, D(1, { k: 'x.........x.....', h: '..x...x...x...x.' }));
fp(
  'dnb-breakdown',
  'Breakdown: Rim and Perc',
  'drum',
  'dnb',
  174,
  D(1, { rim: '....x.......x...', pc: '..x..x..x..x..x.', h: 'x.x.x.x.x.x.x.x.' }),
  { role: 'Perc' }
);
/* DnB: layers for tracks 1-3 */
fp('dnb-k-two', 'Kick: Two-Step', 'drum', 'dnb', 174, D(1, { k: 'x.........x.....' }), { role: 'Kick' });
fp('dnb-k-sync', 'Kick: Syncopated', 'drum', 'dnb', 174, D(1, { k: 'x.........x..x..' }), { role: 'Kick' });
fp('dnb-k-roll', 'Kick: Rolling', 'drum', 'dnb', 174, D(2, { k: 'x.....x...x.....|x.........x.x...' }), {
  role: 'Kick'
});
fp('dnb-s-back', 'Snare: Backbeat', 'drum', 'dnb', 174, D(1, { s: '....x.......x...' }), { role: 'Snare' });
fp('dnb-s-ghost', 'Snare: Ghosted', 'drum', 'dnb', 174, D(1, { s: '....x..g.g..x..g' }), { role: 'Snare' });
fp('dnb-s-roll', 'Snare: Rolling', 'drum', 'dnb', 174, D(1, { s: '....x.g.g.g.x.g.' }), { role: 'Snare' });
fp('dnb-h-8', 'Hats: Straight 8ths', 'drum', 'dnb', 174, D(1, { h: 'x.x.x.x.x.x.x.x.' }), { role: 'Hats' });
fp('dnb-h-16', 'Hats: 16ths Accented', 'drum', 'dnb', 174, D(1, { h: 'XoxoXoxoXoxoXoxo' }), { role: 'Hats' });
fp('dnb-h-shuf', 'Hats: Shuffled', 'drum', 'dnb', 172, D(1, { h: 'x..xx..xx..xx..x' }), { role: 'Hats' });
fp('dnb-oh-off', 'Open Hat: Offbeat', 'drum', 'dnb', 174, D(1, { oh: '..o...o...o...o.' }), { role: 'Hats' });
fp('dnb-ride', 'Ride: Steady', 'drum', 'dnb', 174, D(1, { rd: 'x.x.x.x.x.x.x.x.' }), { role: 'Hats' });
fp(
  'dnb-pc-toms',
  'Perc: Tom Run',
  'drum',
  'dnb',
  174,
  D(1, { lt: '.....x.......x..', mt: '.........x......', ht: '.......x......x.' }),
  { role: 'Perc' }
);
fp('dnb-pc-clap', 'Perc: Clap Layer', 'drum', 'dnb', 174, D(1, { c: '....x.......x...' }), { role: 'Perc' });
fp('dnb-pc-cow', 'Perc: Cowbell Offbeat', 'drum', 'dnb', 174, D(1, { pc: '..x...x...x...x.' }), {
  role: 'Perc'
});
/* DnB: fills */
fp(
  'dnb-fill-tom',
  'Tom Fill',
  'drum',
  'dnb',
  174,
  D(1, { k: 'x...............', ht: '........x.......', mt: '..........x.....', lt: '............x.x.' }),
  { role: 'Fill' }
);
fp('dnb-fill-roll', 'Snare Roll Fill', 'drum', 'dnb', 174, D(1, { k: 'x...............', s: '........x.x.xxxx' }), {
  role: 'Fill'
});
fp('dnb-fill-stutter', 'Stutter Fill', 'drum', 'dnb', 174, D(1, { s: '..x.x.x.xxxxxxxx' }), { role: 'Fill' });

/* Hip hop: full kits */
fp(
  'hh-swing',
  'Boom Bap Swing',
  'drum',
  'hiphop',
  90,
  D(1, { k: 'x..x....x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' })
);
fp(
  'hh-93',
  'East Coast 93',
  'drum',
  'hiphop',
  93,
  D(2, {
    k: 'x.....x...x.....|x.....x...x...x.',
    s: '....x.......x...|....x.......x...',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
    oh: '..............o.|..............o.'
  })
);
fp(
  'hh-trap-bounce',
  'Trap Bounce',
  'drum',
  'hiphop',
  140,
  D(2, {
    k: 'x.....x.x.......|x.......x.x.....',
    s: '........x.......|........x.......',
    c: '........x.......|........x.......',
    h: 'xoxoxoxoxoxoxoxo|xoxoxxxxxoxoxxoX',
    oh: '..............o.|......o.........'
  })
);
fp(
  'hh-ukdrill',
  'UK Drill',
  'drum',
  'hiphop',
  140,
  D(2, {
    k: 'x.........x...x.|x.....x.......x.',
    s: '........x.......|........x.......',
    h: 'x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx',
    rim: '..x.........x...|..x.........x...'
  })
);
fp(
  'hh-lofi-sleepy',
  'Lo-fi Sleepy',
  'drum',
  'hiphop',
  70,
  D(1, { k: 'x.......x.x.....', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.', rim: '..............g.' })
);
fp(
  'hh-lofi-swung',
  'Lo-fi Swung',
  'drum',
  'hiphop',
  80,
  D(2, {
    k: 'x.....g...x.....|x.......g.x..g..',
    s: '....x.......x...|....x.......x..g',
    h: 'x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.xo'
  })
);
fp(
  'hh-memphis',
  'Memphis',
  'drum',
  'hiphop',
  75,
  D(1, { k: 'x.....x.x.......', s: '....x.......x...', c: '....x.......x...', pc: '..x...x...x...x.' })
);
fp(
  'hh-westcoast',
  'West Coast Skip',
  'drum',
  'hiphop',
  94,
  D(1, {
    k: 'x..x....x.x.....',
    s: '....x.......x...',
    c: '....x.......x...',
    h: 'x.x.x.x.x.x.x.x.',
    oh: '..............o.'
  })
);
fp(
  'hh-jazzy',
  'Jazzy Ride',
  'drum',
  'hiphop',
  86,
  D(1, { k: 'x.....x..x......', s: '....x.......x..g', rd: 'x.x.xx..x.x.xx..' })
);
fp(
  'hh-crunk',
  'Crunk Stomp',
  'drum',
  'hiphop',
  75,
  D(1, {
    k: 'x..x..x.x..x....',
    s: '........x.......',
    c: '........x.......',
    h: 'x.x.x.x.x.x.x.x.',
    cr: 'x...............'
  })
);
fp(
  'hh-slowjam',
  'Slow Jam',
  'drum',
  'hiphop',
  70,
  D(1, { k: 'x.....x...x.....', s: '........x.......', rim: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' })
);
fp(
  'hh-cloud',
  'Cloud Rap',
  'drum',
  'hiphop',
  130,
  D(1, {
    k: 'x.......x.x.....',
    s: '........x.......',
    c: '........x.......',
    h: 'x.x.x.x.x.x.x.x.',
    oh: '......o.......o.'
  })
);
/* Hip hop: layers for tracks 1-3 */
fp('hh-k-bap', 'Kick: Boom Bap', 'drum', 'hiphop', 90, D(1, { k: 'x......g..x.....' }), { role: 'Kick' });
fp('hh-k-trap', 'Kick: Trap Bounce', 'drum', 'hiphop', 140, D(1, { k: 'x.....x.x.......' }), { role: 'Kick' });
fp('hh-k-lazy', 'Kick: Lazy', 'drum', 'hiphop', 80, D(1, { k: 'x.......x.x.....' }), { role: 'Kick' });
fp('hh-s-back', 'Snare: Backbeat', 'drum', 'hiphop', 90, D(1, { s: '....x.......x...' }), { role: 'Snare' });
fp('hh-s-half', 'Snare: Half-Time', 'drum', 'hiphop', 140, D(1, { s: '........x.......' }), { role: 'Snare' });
fp('hh-sc', 'Snare and Clap', 'drum', 'hiphop', 90, D(1, { s: '....x.......x...', c: '....x.......x...' }), {
  role: 'Snare'
});
fp('hh-h-swing', 'Hats: Swung 8ths', 'drum', 'hiphop', 90, D(1, { h: 'x.o.x.o.x.o.x.o.' }), { role: 'Hats' });
fp('hh-h-trap', 'Hats: Trap Rolls', 'drum', 'hiphop', 140, D(1, { h: 'xoxoxoxoxoxxxxxx' }), { role: 'Hats' });
fp('hh-h-lazy', 'Hats: Lazy Offbeat', 'drum', 'hiphop', 80, D(1, { h: 'o.x.o.x.o.x.o.x.' }), { role: 'Hats' });
fp('hh-oh', 'Open Hat: Offbeat', 'drum', 'hiphop', 90, D(1, { oh: '..o...o...o...o.' }), { role: 'Hats' });
fp('hh-pc-cow', 'Perc: Cowbell', 'drum', 'hiphop', 75, D(1, { pc: '..x...x...x...x.' }), { role: 'Perc' });
fp('hh-pc-rim', 'Perc: Rim Ghosts', 'drum', 'hiphop', 85, D(1, { rim: '..g...g.g...g.g.' }), { role: 'Perc' });
/* Hip hop: fills */
fp('hh-fill-roll', 'Snare Roll Fill', 'drum', 'hiphop', 90, D(1, { k: 'x...............', s: '........x.x.xxxx' }), {
  role: 'Fill'
});
fp(
  'hh-fill-tom',
  'Tom Fill',
  'drum',
  'hiphop',
  90,
  D(1, { k: '..............x.', ht: '........x.......', mt: '..........x.....', lt: '............x.x.' }),
  { role: 'Fill' }
);
fp('hh-fill-stutter', 'Stutter Fill', 'drum', 'hiphop', 90, D(1, { s: '..x.x.x.xxxxxxxx' }), { role: 'Fill' });

/* DnB tone: bass */
fp('dnb-wobble', 'Wobble Hold', 'tone', 'dnb', 174, T(2, '0:12:F1:110 12:4:Ab1 16:12:Db1:110 28:4:Eb1'), {
  key: 'Fm',
  role: 'Bass'
});
fp(
  'dnb-roll16',
  'Rolling Sub',
  'tone',
  'dnb',
  174,
  T(1, '0:2:F1 2:2:F1 4:2:F1 6:2:Ab1 8:2:Ab1 10:2:C2 12:2:Bb1 14:2:C2'),
  { key: 'Fm', role: 'Bass' }
);
fp(
  'dnb-growl',
  'Neuro Growl',
  'tone',
  'dnb',
  174,
  T(2, '0:3:F1:120 4:1:F2 6:2:F1 8:3:Eb1:120 12:1:Eb2 14:2:Eb1 16:3:Db1:120 20:1:Db2 22:2:Db1 24:4:C1:120 28:4:C2'),
  { key: 'Fm', role: 'Bass' }
);
fp('dnb-dub', 'Dub Sub', 'tone', 'dnb', 172, T(2, '0:6:F1 8:4:F1 16:6:Ab1 24:2:Ab1 26:2:Bb1 28:4:C2'), {
  key: 'Fm',
  role: 'Bass'
});
fp(
  'dnb-skank-sub',
  'Skank Sub',
  'tone',
  'dnb',
  174,
  T(2, '0:3:G1 6:2:G1 10:2:Bb1 12:4:D2 16:3:G1 22:2:F1 26:2:G1 28:3:Bb1'),
  { key: 'Gm', role: 'Bass' }
);
fp('dnb-walk', 'Liquid Walk', 'tone', 'dnb', 172, T(1, '0:4:C2 4:2:Eb2 6:2:G1 8:4:Ab1 12:2:Bb1 14:2:G1'), {
  key: 'Cm',
  role: 'Bass'
});
fp('dnb-pump', 'Pump Bass', 'tone', 'dnb', 174, T(1, '0:1:F1 2:1:F1 4:1:F1 6:1:F1 8:1:F1 10:1:F1 12:1:F1 14:1:Ab1'), {
  key: 'Fm',
  role: 'Bass'
});
fp('dnb-ht-sub', 'Half-Time Sub Hits', 'tone', 'dnb', 174, T(2, '0:8:F1:120 10:4:Ab1 16:8:Db1:120 26:4:C1'), {
  key: 'Fm',
  role: 'Bass'
});
/* DnB tone: chords, pads, leads */
fp(
  'dnb-rave-stabs',
  'Rave Stabs',
  'tone',
  'dnb',
  174,
  T(1, '0:2:F3+Ab3+C4 4:1:F3+Ab3+C4:90 6:2:Ab3+C4+Eb4 10:1:Db3+F3+Ab3:90 12:2:Db3+F3+Ab3'),
  { key: 'Fm', role: 'Chords' }
);
fp(
  'dnb-liq-keys',
  'Liquid Keys',
  'tone',
  'dnb',
  174,
  T(2, '0:6:D3+F3+A3+C4+E4 8:4:Bb2+D3+F3+A3 16:6:G3+Bb3+D4+F4 24:6:A3+C#4+E4+G4'),
  { key: 'Dm', role: 'Chords' }
);
fp(
  'dnb-soul-rhodes',
  'Soulful Rhodes',
  'tone',
  'dnb',
  172,
  T(2, '0:8:E3+G3+B3+D4 8:4:E3+G3+B3+D4:80 12:4:C3+E3+G3+B3 16:8:A3+C4+E4+G4 24:8:B3+D#4+F#4+A4'),
  { key: 'Em', role: 'Chords' }
);
fp('dnb-drone', 'Dark Drone', 'tone', 'dnb', 174, T(4, '0:32:F2+C3+Ab3:90 32:32:Db2+Ab2+F3:90'), {
  key: 'Fm',
  role: 'Pad'
});
fp(
  'dnb-amb-pad',
  'Ambient Pad',
  'tone',
  'dnb',
  172,
  T(4, '0:16:D3+F3+A3+E4 16:16:Bb2+D3+F3+C4 32:16:F3+A3+C4+E4 48:16:C3+G3+Bb3+E4'),
  { key: 'Dm', role: 'Pad' }
);
fp('dnb-fifths', 'Airy Fifths', 'tone', 'dnb', 174, T(4, '0:16:F3+C4 16:16:Db3+Ab3 32:16:Ab3+Eb4 48:16:Eb3+Bb3'), {
  key: 'Fm',
  role: 'Pad'
});
fp('dnb-sus', 'Suspended Wash', 'tone', 'dnb', 174, T(2, '0:16:C3+G3+D4 16:16:Bb2+F3+C4'), {
  key: 'Cm',
  role: 'Pad'
});
fp(
  'dnb-pluck-arp',
  'Plucky Arp',
  'tone',
  'dnb',
  174,
  T(1, '0:1:D5 2:1:F5 4:1:A5 6:1:F5 8:1:C5 10:1:E5 12:1:G5 14:1:E5'),
  { key: 'Dm', role: 'Lead' }
);
fp(
  'dnb-stab-mel',
  'Stab Melody',
  'tone',
  'dnb',
  174,
  T(2, '0:2:C5 3:1:C5 6:2:Eb5 10:2:F5 16:2:Ab5 19:1:G5 22:2:F5 26:2:Eb5'),
  { key: 'Fm', role: 'Lead' }
);
fp('dnb-sweep', 'Sweeping Lead', 'tone', 'dnb', 172, T(2, '0:8:C5 8:8:Eb5 16:6:F5 22:2:Eb5 24:8:C5'), {
  key: 'Fm',
  role: 'Lead'
});
fp(
  'dnb-reese-hook',
  'Reese Hook',
  'tone',
  'dnb',
  174,
  T(2, '0:3:G4 4:2:Bb4 8:3:C5 12:4:Bb4 16:3:G4 20:2:F4 24:8:Eb4'),
  { key: 'Cm', role: 'Lead' }
);
fp(
  'dnb-oct-pluck',
  'Octave Pluck',
  'tone',
  'dnb',
  174,
  T(1, '0:1:F4 1:1:F5 4:1:F4 5:1:F5 8:1:Ab4 9:1:Ab5 12:1:C5 13:1:C6'),
  { key: 'Fm', role: 'Lead' }
);

/* Hip hop tone: bass */
fp(
  'hh-subwalk',
  'Sub Walk',
  'tone',
  'hiphop',
  88,
  T(2, '0:4:G1 4:2:Bb1 6:2:D2 8:4:C2 12:2:D2 14:2:Bb1 16:4:G1 20:2:F1 22:2:G1 24:4:Eb1 28:4:D1'),
  { key: 'Gm', role: 'Bass' }
);
fp(
  'hh-drill808',
  '808 Drill Slide',
  'tone',
  'hiphop',
  140,
  T(2, '0:5:G1:120 6:2:G1 8:3:Bb1 12:4:F1 16:5:G1:120 22:2:G1 24:4:D2 28:4:C2'),
  { key: 'Gm', role: 'Bass' }
);
fp('hh-808heavy', '808 Heavy', 'tone', 'hiphop', 140, T(2, '0:10:C1:127 12:4:Eb1 16:10:Ab0:127 26:6:Bb0'), {
  key: 'Cm',
  role: 'Bass'
});
fp(
  'hh-bounce-bass',
  'Bounce Bass',
  'tone',
  'hiphop',
  94,
  T(1, '0:2:G1 3:1:G1 4:2:Bb1 6:2:G1 8:2:D2 10:1:C2 11:1:Bb1 12:4:G1'),
  { key: 'Gm', role: 'Bass' }
);
fp('hh-dilla-bass', 'Dilla Bass', 'tone', 'hiphop', 88, T(1, '0:3:F1 4:1:Ab1 6:2:C2 9:2:Bb1 12:3:Ab1'), {
  key: 'Fm',
  role: 'Bass'
});
fp(
  'hh-bap-bass-am',
  'Boom Bap Bass Am',
  'tone',
  'hiphop',
  92,
  T(2, '0:3:A1 4:2:A1 7:1:C2 10:3:D2 14:2:E2 16:3:A1 20:2:G1 23:1:E1 26:3:D2 30:2:C2'),
  { key: 'Am', role: 'Bass' }
);
fp('hh-slow-sub', 'Slow Jam Sub', 'tone', 'hiphop', 70, T(2, '0:12:D1 12:4:F1 16:12:Bb0 28:4:C1'), {
  key: 'Dm',
  role: 'Bass'
});
/* Hip hop tone: chords, pads, leads */
fp(
  'hh-neosoul',
  'Neo-Soul Keys',
  'tone',
  'hiphop',
  84,
  T(2, '0:6:F3+Ab3+C4+Eb4 8:4:Db3+F3+Ab3+C4 16:6:Bb3+Db4+F4+Ab4 24:8:C3+E3+G3+Bb3'),
  { key: 'Fm', role: 'Chords' }
);
fp(
  'hh-chop-piano',
  'Sample Chop Piano',
  'tone',
  'hiphop',
  90,
  T(
    2,
    '0:4:G3+Bb3+D4 4:2:G3+Bb3+D4:80 8:4:Eb3+G3+Bb3 12:2:F3+A3+C4 14:2:F3+A3+C4:80 16:4:G3+Bb3+D4 20:2:C4+Eb4+G4 24:8:D3+F#3+A3'
  ),
  { key: 'Gm', role: 'Chords' }
);
fp('hh-organ', 'Dusty Organ', 'tone', 'hiphop', 80, T(2, '0:16:D3+F3+A3 16:16:G3+Bb3+D4'), {
  key: 'Dm',
  role: 'Chords'
});
fp('hh-trap-pad', 'Trap Pad Chords', 'tone', 'hiphop', 140, T(2, '0:16:C3+Eb3+G3+Bb3 16:16:Ab2+C3+Eb3+G3'), {
  key: 'Cm',
  role: 'Chords'
});
fp(
  'hh-bap-rhodes',
  'Boom Bap Rhodes',
  'tone',
  'hiphop',
  90,
  T(2, '0:4:A3+C4+E4+G4 6:2:A3+C4+E4 8:4:F3+A3+C4+E4 14:2:F3+A3+C4 16:4:D3+F3+A3+C4 22:2:D3+F3+A3 24:6:E3+G#3+B3+D4'),
  { key: 'Am', role: 'Chords' }
);
fp(
  'hh-dark-stabs',
  'Dark Piano Stabs',
  'tone',
  'hiphop',
  140,
  T(1, '0:2:C4+Eb4+G4 4:2:C4+Eb4+G4 8:2:Ab3+C4+Eb4 12:2:Bb3+D4+F4'),
  { key: 'Cm', role: 'Chords' }
);
fp(
  'hh-vinyl-pad',
  'Vinyl Pad',
  'tone',
  'hiphop',
  80,
  T(4, '0:16:F3+Ab3+C4 16:16:Db3+F3+Ab3 32:16:Eb3+G3+Bb3 48:16:C3+Eb3+G3'),
  { key: 'Fm', role: 'Pad' }
);
fp(
  'hh-cinema',
  'Cinematic Strings',
  'tone',
  'hiphop',
  90,
  T(4, '0:16:D3+A3+F4 16:16:Bb2+F3+D4 32:16:G2+D3+Bb3 48:16:A2+E3+C#4'),
  { key: 'Dm', role: 'Pad' }
);
fp('hh-choir', 'Choir Pad', 'tone', 'hiphop', 85, T(2, '0:16:C4+Eb4+G4 16:16:Bb3+D4+F4'), {
  key: 'Cm',
  role: 'Pad'
});
fp(
  'hh-trapbell',
  'Trap Bell Lead',
  'tone',
  'hiphop',
  140,
  T(2, '0:1:G5 2:1:Eb5 4:1:D5 6:1:Eb5 8:1:G5 10:1:Eb5 12:2:D5 16:1:G5 18:1:Bb5 20:1:G5 22:1:Eb5 24:4:D5'),
  { key: 'Cm', role: 'Lead' }
);
fp(
  'hh-flute',
  'Dark Flute',
  'tone',
  'hiphop',
  88,
  T(2, '0:3:E5 4:2:D5 6:2:C5 8:4:A4 12:4:C5 16:3:E5 20:2:G5 22:2:E5 24:8:D5'),
  { key: 'Am', role: 'Lead' }
);
fp(
  'hh-lofi-gtr',
  'Lo-fi Guitar Riff',
  'tone',
  'hiphop',
  75,
  T(1, '0:2:A4 2:2:D5 4:2:F5 6:2:E5 8:4:D5 12:2:C5 14:2:A4'),
  { key: 'Dm', role: 'Lead' }
);
fp(
  'hh-whistle',
  'Whistle Hook',
  'tone',
  'hiphop',
  94,
  T(2, '0:2:G5 2:2:F5 4:2:D5 6:2:Bb4 8:6:D5 16:2:G5 18:2:A5 20:2:G5 22:2:D5 24:8:Bb4'),
  { key: 'Gm', role: 'Lead' }
);
fp(
  'hh-synth-pluck',
  'Synth Pluck',
  'tone',
  'hiphop',
  140,
  T(1, '0:1:C5 1:1:C5 3:1:Eb5 6:1:G5 8:1:Bb5 11:1:G5 14:1:Eb5'),
  { key: 'Cm', role: 'Lead' }
);
fp(
  'hh-smooth-piano',
  'Smooth Piano Melody',
  'tone',
  'hiphop',
  84,
  T(2, '0:3:C5 4:2:Db5 6:2:C5 8:4:Ab4 12:2:Bb4 14:2:C5 16:4:F5 20:2:Eb5 22:2:C5 24:8:Ab4'),
  { key: 'Fm', role: 'Lead' }
);
