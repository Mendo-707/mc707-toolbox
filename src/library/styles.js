import './index.js';
import { NOTE_NAMES } from '../core/theory.js';
import { FAC } from './factory.js';
import { oneKit } from '../core/device.js';

export const DNB_KINDS = {
  intro: { name: 'Intro', e: 2, rows: ['intro', 'hats', null, null, null, 'pad', null, null] },
  build: { name: 'Build', e: 4, rows: ['kit', 'hats', 'perc', null, 'chords', 'pad', null, 'pluck'] },
  drop: { name: 'Drop', e: 9, rows: ['kit', 'hats', 'perc', 'bass', 'chords', null, 'lead', null] },
  break: { name: 'Break', e: 3, rows: ['intro', null, 'perc', null, 'chords', 'pad', 'lead', 'pluck'] },
  drop2: {
    name: 'Drop 2',
    e: 10,
    rows: ['kit2', 'hats2', 'perc2', 'bass2', 'chords2', null, 'lead2', 'pluck']
  },
  outro: { name: 'Outro', e: 3, rows: ['kit', 'hats', null, null, null, 'pad', null, null] }
};
export const HH_KINDS = {
  intro: { name: 'Intro', e: 2, rows: [null, 'hats', null, null, 'chords', 'pad', 'lead', null] },
  verse: { name: 'Verse', e: 5, rows: ['kit', 'hats', 'perc', 'bass', 'chords', null, null, null] },
  hook: { name: 'Hook', e: 8, rows: ['kit3', 'hats', 'perc', 'bass2', 'chords2', 'pad', 'lead', 'pluck'] },
  bridge: { name: 'Bridge', e: 4, rows: [null, 'hats', null, 'bass3', 'chords3', 'pad', 'lead2', 'pluck'] },
  outro: { name: 'Outro', e: 2, rows: ['kit', null, null, null, 'chords', 'pad', null, null] }
};
export const STRUCT = {
  dnb: [
    {
      id: 'sketch',
      name: 'Quick sketch',
      desc: '32 bars to test an idea.',
      secs: [
        ['intro', 4],
        ['drop', 12],
        ['break', 4],
        ['drop2', 8],
        ['outro', 4]
      ]
    },
    {
      id: 'club',
      name: 'DJ-friendly',
      desc: '64 bars: intro, build, two drops and an outro to mix out of.',
      secs: [
        ['intro', 8],
        ['build', 8],
        ['drop', 16],
        ['break', 8],
        ['drop2', 16],
        ['outro', 8]
      ]
    },
    {
      id: 'ext',
      name: 'Extended',
      desc: '96 bars with a long intro, a second build and a longer final drop.',
      secs: [
        ['intro', 16],
        ['build', 8],
        ['drop', 16],
        ['break', 16],
        ['build', 8],
        ['drop2', 24],
        ['outro', 8]
      ]
    }
  ],
  hh: [
    {
      id: 'loop',
      name: 'Beat tape loop',
      desc: '32 bars: a short loop-based idea.',
      secs: [
        ['intro', 4],
        ['hook', 8],
        ['verse', 8],
        ['hook', 8],
        ['outro', 4]
      ]
    },
    {
      id: 'full',
      name: 'Full track',
      desc: '64 bars: verses, hooks and a bridge.',
      secs: [
        ['intro', 4],
        ['verse', 16],
        ['hook', 8],
        ['verse', 16],
        ['bridge', 8],
        ['hook', 8],
        ['outro', 4]
      ]
    },
    {
      id: 'ext',
      name: 'Extended',
      desc: '96 bars: three verses and three hooks.',
      secs: [
        ['intro', 8],
        ['verse', 16],
        ['hook', 8],
        ['verse', 16],
        ['hook', 8],
        ['bridge', 8],
        ['verse', 16],
        ['hook', 8],
        ['outro', 8]
      ]
    }
  ]
};
export const KIND_TIPS = {
  dnb: {
    intro: 'Keep intros to beats and atmosphere, with no bass yet. 8–16 bars makes it easy for a DJ to mix in.',
    build: 'Bring in chords and a pad. The fill on the last bar tells the listener the drop is coming.',
    drop: 'Full energy: bass, drums and one clear hook. Leave space rather than stacking every layer.',
    break: 'Pull the bass and main drums out and let pads and a lead carry the mood for a breath.',
    drop2: 'Change something so the second drop feels like a payoff: new bass variation, new lead, busier drums.',
    outro: 'Strip back to drums, hats and a pad so the next track can mix in.'
  },
  hh: {
    intro: 'Open with the chords or a sample-style loop for a few bars before the drums land.',
    verse: 'Keep the beat steady and the melody out of the way so a vocal can sit on top.',
    hook: 'Open up: add the lead and bigger chords. The hook should feel larger than the verses.',
    bridge: 'Drop the drums for a moment and change the chords and bass, then come back to the hook.',
    outro: 'Thin out the layers and let the loop ring out.'
  }
};
export const GEN_TIPS = [
  'Lower the Pad and Chords track sliders a little so the kick and bass stay punchy.',
  'Use Mute and Solo in the track headers to hear each layer on its own while you decide what stays.',
  'Open a clip and use Random or Humanize to make a pattern your own. Use Make unique if a pattern is shared by several clips.',
  'To get the song into your MC-707, press Play here and record each track on the MC-707 as it plays, or export the MIDI .zip from the File menu.'
];
export const STYLES = [
  {
    id: 'liquid',
    fam: 'dnb',
    name: 'Liquid DnB',
    vibe: 'Warm, rolling and melodic. Rhodes chords, soft pads and a smooth bassline.',
    bpm: [170, 176, 174],
    swing: 50,
    keys: [
      [2, 'Dm: warm and open, the classic liquid key.'],
      [4, 'Em: bright, great for rolling basslines.'],
      [5, 'Fm: a little darker but still musical.'],
      [9, 'Am: easy on the ears, good if you add vocals later.']
    ],
    tips: [
      'Let the bassline roll with the kick pattern. Liquid sits better with fewer, rounder bass notes than neurofunk.',
      'Chords carry the emotion, so keep the Chords level a little below the kick.',
      'Try the ghost-snare kits for movement and keep hats at 16ths with soft velocities.'
    ],
    pools: {
      kit: ['dnb-liquid', 'dnb-liq-shuf', 'dnb-twostep', 'dnb-roller2', 'dnb-ghost'],
      hats: ['dnb-h-16', 'dnb-h-8', 'dnb-ride', 'dnb-h-shuf'],
      perc: ['dnb-pc-toms', 'dnb-pc-clap'],
      fill: ['dnb-fill-tom', 'dnb-fill-roll', 'dnb-fill'],
      intro: ['dnb-intro'],
      bass: ['dnb-roll16', 'dnb-walk', 'dnb-sub', 'dnb-dub', 'dnb-oct'],
      chords: ['dnb-liq-keys', 'dnb-soul-rhodes', 'dnb-liquid-ch'],
      pad: ['dnb-amb-pad', 'dnb-pad', 'dnb-sus', 'dnb-fifths'],
      lead: ['dnb-sweep', 'dnb-stab-mel', 'dnb-pluck'],
      pluck: ['dnb-pluck-arp', 'dnb-arp', 'dnb-oct-pluck']
    }
  },
  {
    id: 'neuro',
    fam: 'dnb',
    name: 'Neurofunk and Techstep',
    vibe: 'Dark, tight and heavy. Growling bass, sharp snares and cold stabs.',
    bpm: [172, 178, 174],
    swing: 50,
    bassName: 'Reese',
    keys: [
      [5, 'Fm: heavy, the go-to for dark basslines.'],
      [7, 'Gm: aggressive and tight.'],
      [4, 'Em: low sub weight.'],
      [0, 'Cm: dark with plenty of room for the sub.']
    ],
    tips: [
      'Leave space around the bass. Sparse, heavy drums let the growl breathe.',
      'Use the stutter and roll fills sparingly: one per 8 bars is plenty.',
      'Keep chords short and stabby, and take them out in the break for contrast.'
    ],
    pools: {
      kit: ['dnb-neurofunk', 'dnb-neuro', 'dnb-tech', 'dnb-dark'],
      hats: ['dnb-h-8', 'dnb-oh-off', 'dnb-h-16'],
      perc: ['dnb-pc-clap', 'dnb-pc-toms'],
      fill: ['dnb-fill-stutter', 'dnb-fill-roll', 'dnb-fill-tom'],
      intro: ['dnb-intro', 'dnb-breakdown'],
      bass: ['dnb-growl', 'dnb-reese', 'dnb-wobble', 'dnb-pump'],
      chords: ['dnb-rave-stabs', 'dnb-stabs'],
      pad: ['dnb-drone', 'dnb-pad', 'dnb-fifths'],
      lead: ['dnb-reese-hook', 'dnb-oct-pluck'],
      pluck: ['dnb-arp', 'dnb-pluck-arp']
    }
  },
  {
    id: 'jungle',
    fam: 'dnb',
    name: 'Jungle and Breakbeat',
    vibe: 'Chopped breaks, heavy dub bass and raw, moody stabs.',
    bpm: [160, 172, 168],
    swing: 54,
    keys: [
      [9, 'Am: raw and moody.'],
      [2, 'Dm: classic ragga-jungle colour.'],
      [7, 'Gm: dark and dubby.']
    ],
    tips: [
      'A little swing on the hats (54–58%) helps a break feel human. Keep the bass simple and heavy.',
      'Use tom runs and cowbell as ear candy at the ends of phrases.',
      '165–168 BPM feels classic jungle. 172 and up drifts toward modern DnB.'
    ],
    pools: {
      kit: ['dnb-amen', 'dnb-jungle', 'dnb-shuffle'],
      hats: ['dnb-ride', 'dnb-h-shuf', 'dnb-h-8'],
      perc: ['dnb-pc-cow', 'dnb-pc-toms'],
      fill: ['dnb-fill-roll', 'dnb-fill-stutter', 'dnb-fill'],
      intro: ['dnb-intro', 'dnb-breakdown'],
      bass: ['dnb-dub', 'dnb-skank-sub', 'dnb-sub'],
      chords: ['dnb-stabs', 'dnb-soul-rhodes', 'dnb-rave-stabs'],
      pad: ['dnb-sus', 'dnb-fifths', 'dnb-amb-pad'],
      lead: ['dnb-pluck', 'dnb-stab-mel', 'dnb-sweep'],
      pluck: ['dnb-pluck-arp', 'dnb-oct-pluck']
    }
  },
  {
    id: 'jumpup',
    fam: 'dnb',
    name: 'Jump-Up',
    vibe: 'Bouncy, fun and built for the floor. Wobble bass and simple hooks.',
    bpm: [172, 178, 174],
    swing: 50,
    bassName: 'Wobble',
    keys: [
      [5, 'Fm: punchy and powerful.'],
      [7, 'Gm: bright energy.'],
      [4, 'Em: big low end.']
    ],
    tips: [
      'Bounce is everything: a simple kick and snare with clear gaps between bass hits.',
      'Use the cowbell layer and a short plucky lead for the hook.',
      'Make drop 2 different by switching the bass and lead variation.'
    ],
    pools: {
      kit: ['dnb-jump', 'dnb-rave', 'dnb-twostep', 'dnb-roller2'],
      hats: ['dnb-h-8', 'dnb-h-16', 'dnb-oh-off'],
      perc: ['dnb-pc-cow', 'dnb-pc-clap'],
      fill: ['dnb-fill-roll', 'dnb-fill-stutter', 'dnb-fill-tom'],
      intro: ['dnb-intro'],
      bass: ['dnb-wobble', 'dnb-oct', 'dnb-pump', 'dnb-roll16'],
      chords: ['dnb-rave-stabs', 'dnb-stabs'],
      pad: ['dnb-fifths', 'dnb-sus'],
      lead: ['dnb-oct-pluck', 'dnb-stab-mel', 'dnb-arp'],
      pluck: ['dnb-pluck', 'dnb-pluck-arp']
    }
  },
  {
    id: 'halftime',
    fam: 'dnb',
    name: 'Halftime DnB',
    vibe: 'DnB tempo with a half-speed feel. Heavy snare, long slow bass.',
    bpm: [168, 176, 174],
    swing: 50,
    bassName: 'Sub',
    keys: [
      [5, 'Fm: weighty and cinematic.'],
      [7, 'Gm: slightly brighter.'],
      [0, 'Cm: dark and spacious.']
    ],
    tips: [
      'The snare lands once per bar, so basslines can be long and slow.',
      'Keep the hats busy so the energy stays up while the snare stays heavy and sparse.',
      'Drones and suspended pads suit this style.'
    ],
    pools: {
      kit: ['dnb-halftime', 'dnb-ht-skank'],
      hats: ['dnb-h-8', 'dnb-oh-off', 'dnb-h-shuf'],
      perc: ['dnb-pc-clap', 'dnb-pc-toms'],
      fill: ['dnb-fill-tom', 'dnb-fill-roll'],
      intro: ['dnb-intro', 'dnb-breakdown'],
      bass: ['dnb-ht-sub', 'dnb-reese', 'dnb-growl', 'dnb-wobble'],
      chords: ['dnb-liquid-ch', 'dnb-soul-rhodes', 'dnb-liq-keys'],
      pad: ['dnb-drone', 'dnb-amb-pad', 'dnb-pad'],
      lead: ['dnb-sweep', 'dnb-reese-hook'],
      pluck: ['dnb-pluck-arp', 'dnb-arp']
    }
  },
  {
    id: 'boombap',
    fam: 'hh',
    name: 'Boom Bap',
    vibe: 'Dusty drums, sampled-style chords and a head-nod groove.',
    bpm: [84, 96, 90],
    swing: 60,
    keys: [
      [7, 'Gm: dusty and classic.'],
      [9, 'Am: warm sample feel.'],
      [0, 'Cm: moody and heavy.'],
      [2, 'Dm: mellow and soulful.']
    ],
    tips: [
      'Set Swing to 58–66% for the classic loose feel.',
      'Keep the chord loop simple and let the drums lead. The bass should follow the kick.',
      'A snare-roll fill into the hook sells the transition. The wizard places one at the end of each 8-bar phrase.'
    ],
    pools: {
      kit: ['hh-boombap', 'hh-bapghost', 'hh-93', 'hh-swing', 'hh-jazzy'],
      hats: ['hh-h-swing', 'hh-h-lazy'],
      perc: ['hh-pc-rim', 'hh-pc-cow'],
      fill: ['hh-fill-roll', 'hh-fill-tom', 'hh-fill-stutter', 'hh-fill'],
      bass: ['hh-bassbap', 'hh-bap-bass-am', 'hh-subwalk', 'hh-dilla-bass'],
      chords: ['hh-soul', 'hh-bap-rhodes', 'hh-chop-piano', 'hh-rhodes'],
      pad: ['hh-strings', 'hh-cinema', 'hh-vinyl-pad'],
      lead: ['hh-piano', 'hh-flute', 'hh-smooth-piano'],
      pluck: ['hh-bell', 'hh-lofi-gtr']
    }
  },
  {
    id: 'trap',
    fam: 'hh',
    name: 'Trap',
    vibe: 'Sparse, heavy 808s, rolling hats and a cold melody.',
    bpm: [130, 150, 140],
    swing: 50,
    bassName: '808',
    keys: [
      [0, 'Cm: great 808 range and very common.'],
      [5, 'Fm: deep and dark.'],
      [7, 'Gm: punchy and clear.']
    ],
    tips: [
      'Leave the 808 long and low. Keep kicks sparse so the sub can ring.',
      'Hat rolls create the energy, so vary them every 4 or 8 bars.',
      'Keep the melody sparse, like a bell or pluck, so the 808 stays the star.'
    ],
    pools: {
      kit: ['hh-trap', 'hh-trap-bounce', 'hh-cloud'],
      hats: ['hh-h-trap', 'hh-oh'],
      perc: ['hh-pc-cow', 'hh-pc-rim'],
      fill: ['hh-fill-stutter', 'hh-fill-roll'],
      bass: ['hh-808', 'hh-808heavy', 'hh-trapsub', 'hh-drill808'],
      chords: ['hh-trap-pad', 'hh-dark-stabs'],
      pad: ['hh-choir', 'hh-strings', 'hh-cinema'],
      lead: ['hh-trapbell', 'hh-synth-pluck', 'hh-flute'],
      pluck: ['hh-bell', 'hh-lofi-gtr']
    }
  },
  {
    id: 'lofi',
    fam: 'hh',
    name: 'Lo-fi',
    vibe: 'Slow, soft and dusty. Mellow keys and a lazy swing.',
    bpm: [68, 86, 78],
    swing: 64,
    keys: [
      [2, 'Dm: mellow and warm.'],
      [5, 'Fm: moody and soft.'],
      [9, 'Am: easy and open.']
    ],
    tips: [
      'Slow it down: 70–80 BPM with swing around 60–66% is the sweet spot.',
      'Keep hat velocities low and let the rim ghost notes add vinyl-style looseness.',
      'Use gentle chords and a simple lead. Lo-fi works because nothing competes for attention.'
    ],
    pools: {
      kit: ['hh-lofi', 'hh-lofi-sleepy', 'hh-lofi-swung', 'hh-slowjam'],
      hats: ['hh-h-lazy', 'hh-h-swing'],
      perc: ['hh-pc-rim'],
      fill: ['hh-fill-tom', 'hh-fill'],
      bass: ['hh-slow-sub', 'hh-dilla-bass', 'hh-subwalk'],
      chords: ['hh-neosoul', 'hh-organ', 'hh-rhodes', 'hh-bap-rhodes'],
      pad: ['hh-vinyl-pad', 'hh-cinema'],
      lead: ['hh-lofi-gtr', 'hh-smooth-piano', 'hh-bell'],
      pluck: ['hh-flute', 'hh-piano']
    }
  },
  {
    id: 'gfunk',
    fam: 'hh',
    name: 'G-Funk and West Coast',
    vibe: 'Bouncy bass, warm organ and a whistling synth lead.',
    bpm: [88, 100, 94],
    swing: 56,
    keys: [
      [7, 'Gm: the West Coast staple.'],
      [0, 'Cm: smooth and low.'],
      [2, 'Dm: warm and open.']
    ],
    tips: [
      'The bounce bass and a simple, singable synth lead define the sound.',
      'Add the open-hat offbeat for the classic groove.',
      'Keep the pad warm and low in the mix.'
    ],
    pools: {
      kit: ['hh-gfunk', 'hh-westcoast'],
      hats: ['hh-h-swing', 'hh-h-lazy'],
      perc: ['hh-oh', 'hh-pc-cow'],
      fill: ['hh-fill-roll', 'hh-fill-tom'],
      bass: ['hh-gfbass', 'hh-bounce-bass', 'hh-subwalk'],
      chords: ['hh-organ', 'hh-neosoul', 'hh-chop-piano'],
      pad: ['hh-vinyl-pad', 'hh-strings'],
      lead: ['hh-gfwhine', 'hh-whistle'],
      pluck: ['hh-bell', 'hh-smooth-piano']
    }
  },
  {
    id: 'drill',
    fam: 'hh',
    name: 'Drill',
    vibe: 'Sliding 808s, sparse snares and dark piano.',
    bpm: [138, 146, 142],
    swing: 50,
    bassName: '808',
    keys: [
      [7, 'Gm: the classic drill colour.'],
      [0, 'Cm: dark and heavy.'],
      [4, 'Em: low and menacing.']
    ],
    tips: [
      'Sliding 808s and a single snare on beat 3 define the sound at 140–144 BPM.',
      'Keep hats triplet-like and varied, with rim ghosts for bounce.',
      'Dark piano stabs and a thin bell melody sit well on top.'
    ],
    pools: {
      kit: ['hh-drill', 'hh-ukdrill'],
      hats: ['hh-h-trap'],
      perc: ['hh-pc-rim', 'hh-oh'],
      fill: ['hh-fill-stutter', 'hh-fill-roll'],
      bass: ['hh-drill808', 'hh-808heavy', 'hh-808'],
      chords: ['hh-dark-stabs', 'hh-trap-pad'],
      pad: ['hh-strings', 'hh-choir'],
      lead: ['hh-trapbell', 'hh-flute'],
      pluck: ['hh-bell', 'hh-synth-pluck']
    }
  },
  {
    id: 'neosoul',
    fam: 'hh',
    name: 'Neo-Soul and R&B',
    vibe: 'Laid-back drums, rich 9th chords and a soft, melodic bass.',
    bpm: [68, 90, 80],
    swing: 60,
    keys: [
      [5, 'Fm: rich and smooth.'],
      [0, 'Cm: warm and rounded.'],
      [2, 'Dm: mellow and open.']
    ],
    tips: [
      'Chords are the star, so keep the drums laid-back and the swing around 58–64%.',
      'Keep the bass melodic and soft. Avoid heavy 808 tones.',
      'Add a simple lead or guitar-style riff only in the hook.'
    ],
    pools: {
      kit: ['hh-slowjam', 'hh-lofi-swung', 'hh-jazzy', 'hh-lofi-sleepy'],
      hats: ['hh-h-lazy', 'hh-h-swing'],
      perc: ['hh-pc-rim'],
      fill: ['hh-fill-tom', 'hh-fill'],
      bass: ['hh-dilla-bass', 'hh-slow-sub', 'hh-subwalk'],
      chords: ['hh-neosoul', 'hh-rhodes', 'hh-organ'],
      pad: ['hh-choir', 'hh-vinyl-pad', 'hh-cinema'],
      lead: ['hh-smooth-piano', 'hh-lofi-gtr', 'hh-whistle'],
      pluck: ['hh-bell', 'hh-flute']
    }
  },
  {
    id: 'memphis',
    fam: 'hh',
    name: 'Memphis and Crunk',
    vibe: 'Cowbell, heavy 808 and a dark, repeating stab loop.',
    bpm: [70, 85, 75],
    swing: 52,
    bassName: '808',
    keys: [
      [0, 'Cm: dark and heavy.'],
      [4, 'Em: gritty low end.'],
      [9, 'Am: ominous and open.']
    ],
    tips: [
      'Cowbell, a heavy 808 and a minor stab loop are the signature. Keep it slightly dark and rough.',
      'Keep a slow tempo of 70–80, or double it if you prefer a trap feel.',
      'Leave plenty of space. Repeating loops are the point.'
    ],
    pools: {
      kit: ['hh-memphis', 'hh-crunk', 'hh-cloud'],
      hats: ['hh-h-swing', 'hh-h-lazy'],
      perc: ['hh-pc-cow', 'hh-oh'],
      fill: ['hh-fill-stutter', 'hh-fill-roll'],
      bass: ['hh-808heavy', 'hh-trapsub', 'hh-808'],
      chords: ['hh-dark-stabs', 'hh-organ'],
      pad: ['hh-choir', 'hh-strings'],
      lead: ['hh-flute', 'hh-synth-pluck'],
      pluck: ['hh-bell', 'hh-lofi-gtr']
    }
  }
];

for (const st of STYLES) {
  st.more = {};
}
for (const f of FAC) {
  if (!f.gen || !f.pool) continue;
  for (const sid of f.styles) {
    const st = STYLES.find(x => x.id === sid);
    if (st) (st.more[f.pool] = st.more[f.pool] || []).push(f.id);
  }
}
export const trackLabel = (st, t) =>
  [oneKit() ? 'Drums' : 'Kit', 'Hats', 'Perc', st.bassName || 'Bass', 'Chords', 'Pad', 'Lead', 'Pluck'][t];

/* ---------- song wizard v2: more styles, section editor, complexity, key change, preview ---------- */
export const FAMLABEL = { dnb: 'Drum and bass', hh: 'Hip hop', edm: 'Dance and club', song: 'Grooves and songs' };
export const NK = (n, sc) => NOTE_NAMES[n] + ((sc || 'minor') === 'minor' ? 'm' : '');
