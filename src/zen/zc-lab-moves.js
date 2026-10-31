// The Slime Lab's moves: each one a sound-design move made of real parameter changes (open the filter,
// pluck the envelope, wobble an LFO, widen the stereo…), with the idea behind it. The lab no longer lists
// them; its blends (zc-lab-blends.js) are built from them step by step, and the guide names each step.
//
// A move: {id, name, c (colour), tag, brew(b, dose 0-1), what, hear, tip}. b is a brewer (below).
// Reads: ZE.snd (through brewer), the tone's parameter table.
import { ZE } from './zc-editor.js';
import { paramOf } from './zc-tone.js';
import { FX_GROUP, OSC_GROUP } from './zc-lab-more.js';

/**
 * A mix: the changes a move makes, built up before they go to the tone in one step.
 * @param {number[]} ps  the partials it works on
 * @returns get/set/add/toward a key, each(fn) over the partials, free() the first partial that is off,
 *   src (the first partial), v (the tone's values), out (the changes), n (how many partials)
 */
export function brewer(ps) {
  const out = {};
  const def = k => paramOf('tone', k);
  const get = k => {
    if (k in out) return out[k];
    const v = ZE.snd.v[k];
    if (typeof v === 'number') return v;
    const d = def(k);
    return d ? d[0][5] : 0;
  };
  const set = (k, v) => {
    const d = def(k);
    if (!d) return;
    const p = d[0];
    out[k] = Math.round(Math.max(p[3], Math.min(p[4], v)));
  };
  const add = (k, dv) => set(k, get(k) + dv);
  const toward = (k, target, amt) => set(k, get(k) + (target - get(k)) * Math.min(1, amt));
  /* fn(prefix) for each partial: prefix('PTL') is 'PTL0', and so on; n counts the partials */
  const each = fn => ps.forEach((i, n) => fn(b => b + i, n));
  const free = () => {
    const i = [0, 1, 2, 3].find(i => get('PMT.PMT' + (i + 1) + '_PTL_SW') !== 1);
    return i == null ? null : i;
  };
  return { get, set, add, toward, each, free, out, n: ps.length, src: ps[0], v: ZE.snd.v };
}

/* [group, moves] */
const GROUPS = [
  [
    'Filter',
    [
      {
        id: 'sun',
        name: 'Brighten',
        c: '#ffd23f',
        tag: 'Brighter. Opens the filter.',
        brew: (b, d) => b.each(p => b.add(p('PTL') + '.CUTOFF', 340 * d)),
        what: 'A filter decides which harmonics get through. Every note is a stack of overtones above its root pitch; a low-pass filter’s cutoff is the point above which they fade. Raise it and more overtones pass: the sound gets brighter, closer and more aggressive.',
        hear: 'Every filter sweep in dance music, the “opening up” before a drop.',
        tip: 'Bright sounds grab attention but tire the ear. In a busy mix keep only one or two parts really bright, and let the rest sit darker behind them.'
      },
      {
        id: 'moon',
        name: 'Darken',
        c: '#5b6cff',
        tag: 'Darker and warmer.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('PTL') + '.CUTOFF', -300 * d);
            b.toward(p('PTL') + '.CUTOFF_KF', 100, d * 0.5);
          }),
        what: 'Lowering the cutoff removes the upper harmonics: the sound turns warm, soft and further away. It also adds a little key follow, so higher notes open the filter a bit more and don’t go dull at the top of the keyboard, the way real instruments behave.',
        hear: 'Muffled “through the wall” intros, warm basses, mellow pads behind a vocal.',
        tip: 'Darkening a part is the easiest way to make room for something else. If two sounds fight, darken the less important one before turning it down.'
      },
      {
        id: 'squelch',
        name: 'Resonance',
        c: '#9dff3a',
        tag: 'Resonance and a filter snap.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('PTL') + '.RESO', 300 * d);
            b.add(p('FENV') + '.DEPTH', 22 * d);
            b.toward(p('FENV') + '.T1', 0, 1);
            b.toward(p('FENV') + '.L1', 1023, d);
            b.toward(p('FENV') + '.T2', 260, d);
            b.toward(p('FENV') + '.L3', 160, d);
          }),
        what: 'Resonance feeds the filter’s output back into itself, so the harmonics right at the cutoff ring out in a whistling peak. Add a filter envelope that opens the cutoff on each note and snaps it shut, and the peak sweeps down: the “squelch”.',
        hear: 'The Roland TB-303 and every acid line since 1987.',
        tip: 'Resonance sounds biggest when the cutoff moves. Add Darken first so the sweep starts lower, and Mono legato + Glide for slides.'
      },
      {
        id: 'bloom',
        name: 'Filter bloom',
        c: '#e8b04a',
        tag: 'The filter blooms on each note.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('PTL') + '.CUTOFF', -160 * d);
            b.add(p('FENV') + '.DEPTH', 24 * d);
            b.toward(p('FENV') + '.T1', 190, d);
            b.toward(p('FENV') + '.L1', 1023, d);
            b.toward(p('FENV') + '.T2', 460, d);
            b.toward(p('FENV') + '.L2', 620, d);
            b.toward(p('FENV') + '.L3', 540, d);
          }),
        what: 'A filter envelope moves the cutoff over the life of a note. Here it rises over a short moment, then settles: the note starts soft and blooms brighter, the way a horn player’s note does as the air builds.',
        hear: 'Synth brass (the Oberheim and Jupiter stabs of the 80s), swelling leads.',
        tip: 'Filter envelope plus velocity is how synths imitate playing harder: louder hits open the filter more. Try it with Punch for brass stabs.'
      },
      {
        id: 'ghost',
        name: 'High-pass',
        c: '#dfe9ff',
        tag: 'High-pass: thin and airy.',
        brew: (b, d) =>
          b.each(p => {
            b.set(p('PTL') + '.FILTER_TYPE', 3);
            b.set(p('PTL') + '.CUTOFF', 180 + 520 * d);
            b.toward(p('PTL') + '.RESO', 120, 0.5);
          }),
        what: 'A high-pass filter does the opposite of a low-pass: it removes the lows and keeps the highs. The body of the sound disappears and what is left is airy, thin, like a voice on a telephone.',
        hear: 'Risers, “radio” breakdowns, hi-hat-like noises, background textures.',
        tip: 'Mixing engineers high-pass almost everything except the kick and the bass, a little, so the low end stays clean. Brighten and Darken move the cutoff afterwards.'
      },
      {
        id: 'hush',
        name: 'Smooth',
        c: '#c9a7e8',
        tag: 'Smooths away the harshness.',
        brew: (b, d) => {
          b.add('CMN.ANALOG_FEEL', -40 * d);
          b.each(p => {
            b.add(p('PTL') + '.RESO', -280 * d);
            b.add(p('PTL') + '.FXM_DEPTH', -6 * d);
            b.add(p('SPTL') + '.FAT', -40 * d);
          });
        },
        what: 'Sound design is as much taking away as adding. This lowers resonance, cross-modulation and fat, the things that make a tone ring, buzz and bite, and leaves it smooth.',
        hear: 'Clean pads, soft keys, the background parts that support a track without being noticed.',
        tip: 'When a sound “annoys” you after a few minutes, it is often a resonant peak. Try taking things away before adding more.'
      }
    ]
  ],
  [
    'Shape',
    [
      {
        id: 'pluck',
        name: 'Pluck',
        c: '#ff7ad9',
        tag: 'Short, plucked notes.',
        brew: (b, d) =>
          b.each(p => {
            const a = p('AENV'),
              f = p('FENV');
            b.set(a + '.T1', 0);
            b.toward(a + '.T2', 180, d);
            b.toward(a + '.L2', 320, d);
            b.toward(a + '.T3', 360, d);
            b.toward(a + '.L3', 0, d);
            b.toward(a + '.T4', 220, d);
            b.add(f + '.DEPTH', 10 * d);
            b.toward(f + '.T2', 260, d);
            b.toward(f + '.L3', 140, d);
          }),
        what: 'The amp envelope is a note’s life: attack (how fast it starts), decay (how fast it falls), sustain (the level it holds while the key is down) and release (how long it rings after). A pluck starts instantly, decays fast and holds nothing. The filter closes as it dies, like a real string losing its brightness.',
        hear: 'Harps, kalimbas, marimbas, the plucked synth riffs of tropical house.',
        tip: 'Plucks leave gaps between notes, so they can play busy patterns without crowding a mix. Add Space to fill the gaps.'
      },
      {
        id: 'swell',
        name: 'Swell',
        c: '#ffa65c',
        tag: 'Slow attack: notes fade in.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('AENV') + '.T1', 380 * d);
            b.add(p('AENV') + '.T4', 240 * d);
            b.toward(p('AENV') + '.L3', 1023, d * 0.6);
          }),
        what: 'A slow attack makes each note fade in instead of starting at once. The sharp start of a sound (its transient) is what tells the ear where the note is, so without it notes blur together into a wash.',
        hear: 'String sections, pads, “reverse” swells, bowed sounds.',
        tip: 'Slow attacks sound late. Play the chords a little early, or keep the attack short enough to follow the rhythm.'
      },
      {
        id: 'mist',
        name: 'Long release',
        c: '#b9c7d9',
        tag: 'Longer release: notes ring on.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('AENV') + '.T4', 340 * d);
            b.add(p('FENV') + '.T4', 200 * d);
          }),
        what: 'Release is the time a note takes to fade after you let go of the key. Long releases let notes overlap and blend into each other; short ones keep a part tight and rhythmic.',
        hear: 'Ambient keys, pianos with the sustain pedal down, dreamy arpeggios.',
        tip: 'Long releases on fast or low notes turn to mud. Keep basses short and let the high parts ring.'
      },
      {
        id: 'punch',
        name: 'Punch',
        c: '#ff4b3e',
        tag: 'A punchy pitch blip on every hit.',
        brew: (b, d) =>
          b.each(p => {
            const e = p('PENV');
            b.set(p('AENV') + '.T1', 0);
            b.toward(e + '.DEPTH', 40, d);
            b.set(e + '.T1', Math.round(40 + 60 * d));
            b.set(e + '.L0', Math.round(511 * d));
            for (const l of ['L1', 'L2', 'L3', 'L4']) b.set(e + '.' + l, 0);
            b.set(e + '.T2', 0);
          }),
        what: 'A pitch envelope bends the pitch at the start of a note. A very fast drop from high to the real pitch is heard as a click or a thump, not as a bend: punch. It is how an 808 kick is made (a sine wave with a fast pitch drop).',
        hear: '808 kicks and toms, zappy basses, laser sounds (a big amount).',
        tip: 'Punch is about the first few milliseconds. A tiny dose makes a bass cut through; a big one is a sound effect.'
      }
    ]
  ],
  [
    'Motion',
    [
      {
        id: 'wobble',
        name: 'Filter wobble',
        c: '#36e0c8',
        tag: 'An LFO wobbles the filter.',
        brew: (b, d) =>
          b.each(p => {
            const l = p('LFO');
            if (!b.get(l + '.LFO2_TVF_DEPTH')) b.set(l + '.LFO2_FORM', 0);
            b.add(l + '.LFO2_TVF_DEPTH', 45 * d);
            b.add(p('PTL') + '.CUTOFF', -120 * d);
            b.add(p('PTL') + '.RESO', 90 * d);
          }),
        what: 'An LFO (low frequency oscillator) is a slow wave, too slow to hear, that moves something else. Pointed at the filter cutoff it opens and closes the filter over and over: wah-wah, wobble. This uses LFO 2.',
        hear: 'Dubstep wobble bass, funky auto-wah, slowly breathing pads.',
        tip: 'Set the LFO’s Rate Sync on (LFO page) to lock the wobble to the tempo: 1/8 and 1/16 are the classic wobble speeds. Faster LFO and Slower LFO change the speed.'
      },
      {
        id: 'vibrato',
        name: 'Vibrato',
        c: '#b06bff',
        tag: 'A singer’s vibrato that fades in.',
        brew: (b, d) =>
          b.each(p => {
            const l = p('LFO');
            b.set(l + '.LFO1_FORM', 0);
            b.add(l + '.LFO1_PIT_DEPTH', 8 * d);
            b.toward(l + '.LFO1_DELAY', 360, 0.8);
            b.toward(l + '.LFO1_FADE', 420, 0.8);
          }),
        what: 'Vibrato is a small, quick wobble in pitch. Singers and violinists don’t start a note with it: they hold the note straight, then let the vibrato bloom. The LFO’s delay and fade times do the same here. This uses LFO 1.',
        hear: 'Expressive leads, flutes, strings, the classic Minimoog solo.',
        tip: 'Real vibrato is around 5–7 wobbles a second and only a few cents deep. More than that sounds like a siren (which can be fun).'
      },
      {
        id: 'tremolo',
        name: 'Tremolo',
        c: '#ff5fa2',
        tag: 'The volume pulses.',
        brew: (b, d) =>
          b.each(p => {
            const l = p('LFO');
            if (!b.get(l + '.LFO1_TVA_DEPTH')) b.set(l + '.LFO1_FORM', 1);
            b.add(l + '.LFO1_TVA_DEPTH', 40 * d);
          }),
        what: 'Tremolo is an LFO on the volume: the sound pulses louder and quieter. Guitar amps and electric pianos have it built in. It shares LFO 1’s speed with Vibrato.',
        hear: 'Rhodes and Wurlitzer pianos, surf guitar, “helicopter” chops (a big amount, fast).',
        tip: 'A square LFO wave (LFO page) turns tremolo into a rhythmic gate, chopping the sound on and off.'
      },
      {
        id: 'swirl',
        name: 'Auto-pan',
        c: '#6fd6ff',
        tag: 'The sound circles left and right.',
        brew: (b, d) => b.each((p, n) => b.add(p('LFO') + '.LFO2_PAN_DEPTH', (n % 2 ? -1 : 1) * 36 * d)),
        what: 'Auto-pan: an LFO moves the sound between the left and right speakers. With more than one partial, it swings them in opposite directions, so they chase each other around your head. Uses LFO 2.',
        hear: 'Psychedelic organs, ambient textures, headphone tricks.',
        tip: 'Auto-pan is best felt on headphones and on sustained sounds. On a bass it just sounds unsteady.'
      },
      {
        id: 'quick',
        name: 'Faster LFO',
        c: '#d8e3ec',
        tag: 'Faster LFOs.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('LFO') + '.LFO1_RATE', 150 * d);
            b.add(p('LFO') + '.LFO2_RATE', 150 * d);
          }),
        what: 'The LFO rate is how fast the movement is. Slow rates make gentle, evolving changes; fast ones become a texture: flutter, shimmer, buzz. At audio speeds an LFO stops being movement and starts changing the tone itself.',
        hear: 'Fast wobbles, fluttering pads, trills.',
        tip: 'Change the speed of a wobble between sections of a song: slow in the verse, fast in the drop.'
      },
      {
        id: 'sloth',
        name: 'Slower LFO',
        c: '#8a9a46',
        tag: 'Slower LFOs.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('LFO') + '.LFO1_RATE', -150 * d);
            b.add(p('LFO') + '.LFO2_RATE', -150 * d);
          }),
        what: 'A very slow LFO, one wave every few seconds or bars, is heard as the sound evolving rather than wobbling. It is how pads seem alive.',
        hear: 'Slowly breathing pads, drones, film textures.',
        tip: 'Slow movement on a few parameters at different speeds makes a sound that never quite repeats.'
      }
    ]
  ],
  [
    'Pitch',
    [
      {
        id: 'abyss',
        name: 'Octave down',
        c: '#2b3fa8',
        tag: 'An octave down.',
        brew: (b, d) => b.add('CMN.OCTAVE', d > 0.65 ? -2 : -1),
        what: 'An octave is a doubling of the frequency: the same note, higher or lower. One octave down puts a sound into bass territory, where the fundamental (the root frequency) carries the weight and you feel it as much as hear it.',
        hear: 'Sub basses, deep drones, “the drop”.',
        tip: 'Below about 60 Hz, small speakers can’t play the fundamental. Some Drive adds harmonics that suggest the bass even on a phone.'
      },
      {
        id: 'feather',
        name: 'Octave up',
        c: '#f1f7ff',
        tag: 'An octave up.',
        brew: (b, d) => b.add('CMN.OCTAVE', d > 0.65 ? 2 : 1),
        what: 'One octave up. Higher sounds take less room in a mix and read as lighter, sparklier and further forward.',
        hear: 'Bells, glockenspiel parts, arpeggios over a busy track.',
        tip: 'Doubling a melody an octave up, quietly, makes it bigger without making it louder.'
      },
      {
        id: 'wolf',
        name: 'Mono legato',
        c: '#7d7da6',
        tag: 'Mono and legato: one note at a time.',
        brew: b => {
          b.set('CMN.MONO_POLY', 0);
          b.set('CMN.LEGATO_SW', 1);
        },
        what: 'A mono sound plays one note at a time: a new key takes over from the last. With legato on, overlapping notes don’t restart the envelope, so a line sounds connected, like one breath on a horn.',
        hear: 'Basslines, the Minimoog and TB-303, expressive leads.',
        tip: 'Mono is perfect for basses: chords in the low end turn to mush anyway. Add Glide too for slides.'
      },
      {
        id: 'glide',
        name: 'Glide',
        c: '#7cff6b',
        tag: 'Notes glide into each other.',
        brew: (b, d) => {
          b.set('CMN.PORTA_SW', 1);
          b.toward('CMN.PORTA_TIME', 120 + 520 * d, 1);
        },
        what: 'Portamento (glide) slides the pitch from one note to the next instead of jumping. The glide time is how long the slide takes.',
        hear: 'Acid slides, G-funk whistle leads, trance lead swoops, 808 basses.',
        tip: 'With Mono legato on, only overlapping notes slide: you choose where the slides are by how you play.'
      },
      {
        id: 'drift',
        name: 'Analog drift',
        c: '#b7b08a',
        tag: 'Old-analog wobble and wander.',
        brew: (b, d) => {
          b.add('CMN.ANALOG_FEEL', 45 * d);
          b.each((p, n) => {
            b.add(p('PTL') + '.PIT_RND', 12 * d);
            b.add(p('PTL') + '.PIT_FINE', (n % 2 ? -1 : 1) * 3 * d);
          });
        },
        what: 'Old analog synths never stayed perfectly in tune: their oscillators drifted with heat. That small instability makes a sound feel alive and warm. Analog Feel adds slow random drift; random pitch makes each note land slightly differently.',
        hear: 'Vintage polysynths, lo-fi hip hop keys, tape-worn sounds.',
        tip: 'A little is magic, a lot is seasick. Combine with Tremolo and Darken for a worn tape sound.'
      }
    ]
  ],
  [
    'Space and texture',
    [
      {
        id: 'swarm',
        name: 'Unison',
        c: '#ff9f1c',
        tag: 'Unison: many detuned voices.',
        brew: (b, d) => {
          b.set('SCMN.UNISON_SW', 1);
          b.toward('SCMN.UNISON_SIZE', 8, d);
          b.add('SCMN.UNISON_DETN', 25 * d);
        },
        what: 'Unison plays several copies of every note, each slightly out of tune with the others. The copies beat against each other (a slow phasing), and the sound becomes huge and shimmering. With saw waves this is the famous supersaw.',
        hear: 'Trance leads, big EDM chords, the Roland JP-8000.',
        tip: 'Too much detune sounds out of tune. And unison eats voices: the MC-707 can play fewer notes at once.'
      },
      {
        id: 'giant',
        name: 'Width',
        c: '#8fe388',
        tag: 'Wider stereo.',
        brew: (b, d) => {
          const spread = b.n > 1;
          b.each((p, n) => {
            b.toward(p('PTL') + '.STEREO_WIDTH', 100, 1);
            b.add(p('PTL') + '.PAN_RND', 10 * d);
            if (spread) b.toward(p('PTL') + '.PAN', (n % 2 ? -1 : 1) * 44, d);
          });
        },
        what: 'Width is how far a sound spreads between the left and right speakers. Partials panned apart, a little random pan per note and full stereo width make a sound wrap around you.',
        hear: 'Wide pads and chords that frame a track.',
        tip: 'Keep the kick, the bass and the lead vocal in the middle, and spread the rest. Width is relative: something has to be narrow for something else to sound wide.'
      },
      {
        id: 'shimmer',
        name: 'Detune',
        c: '#a5f3fc',
        tag: 'Detuned layers: a chorus shimmer.',
        brew: (b, d) => {
          b.each((p, n) => {
            b.add(p('PTL') + '.STEREO_DETN', 8 * d);
            b.add(p('PTL') + '.PIT_FINE', (n % 2 ? -1 : 1) * 6 * d);
          });
        },
        what: 'Detuning two layers by a few cents makes them drift in and out of phase: a chorus effect, built into the sound. Stereo detune does it between the left and right sides, so the sound also gets wider.',
        hear: 'Juno strings, chorused electric pianos, 80s pads.',
        tip: 'A few cents is enough. Detune has more effect on sustained sounds than on short ones.'
      },
      {
        id: 'grit',
        name: 'Drive',
        c: '#e8551c',
        tag: 'Grit, buzz and fat.',
        brew: (b, d) => {
          b.add('CMN.ANALOG_FEEL', 18 * d);
          b.each(p => {
            b.set(p('PTL') + '.FXM_SW', 1);
            b.add(p('PTL') + '.FXM_DEPTH', Math.max(1, Math.round(4 * d)));
            b.add(p('SPTL') + '.FAT', 40 * d);
          });
        },
        what: 'Grit is extra harmonics. FXM (frequency cross modulation) lets one wave bend another, adding metallic, inharmonic edges; Fat thickens the virtual analog oscillators. More harmonics means more presence and aggression.',
        hear: 'Distorted basses, growls, industrial textures.',
        tip: 'Grit helps a bass on small speakers: the harmonics let you hear the note even when the speaker can’t play it. Smooth takes it back.'
      },
      {
        id: 'space',
        name: 'Space',
        c: '#7fa7c9',
        tag: 'Reverb and delay sends.',
        brew: (b, d) =>
          b.each(p => {
            b.add(p('PTL') + '.REV_SEND', 46 * d);
            b.add(p('PTL') + '.CHO_SEND', 26 * d);
          }),
        what: 'Reverb is the sound of a room: thousands of echoes blurring together. Delay is distinct echoes. Sounds don’t each get their own: they send some of themselves to the project’s shared reverb and delay (Mixer › Master FX chooses their types).',
        hear: 'Everything. Lots of it: ambient and shoegaze; little: tight funk and hip hop.',
        tip: 'More reverb pushes a sound further back. Keep kick and bass mostly dry, and use space to put parts in front of or behind each other.'
      }
    ]
  ]
];
/* Add a layer: partial 1 (or the partial chosen) copied onto the first partial that is off */
const LAYER_BLKS = /^(PTL|PENV|FENV|AENV|LFO|EQ|SPTL)(\d)\.(.+)$/;
OSC_GROUP[1].splice(6, 0, {
  id: 'layer',
  name: 'Add a layer',
  c: '#b5e48c',
  tag: 'A copy on the next free partial.',
  brew: b => {
    const src = b.src,
      to = b.free();
    if (to == null) return;
    b.set('PMT.PMT' + (to + 1) + '_PTL_SW', 1);
    for (const k of Object.keys(b.v)) {
      const m = LAYER_BLKS.exec(k);
      if (m && +m[2] === src) b.set(m[1] + to + '.' + m[3], b.get(k));
    }
  },
  what: 'A ZenCore tone has four partials: four complete synth voices that play together. Add a layer copies the partial you are working on onto the next one that is off, so you can change the copy: another wave, detuned, an octave away, quieter. Layering is how most big sounds are made: a saw over a sine sub, two detuned saws, a body and a bell.',
  hear: 'Reese basses, layered pads, sub under a lead, electric pianos (body plus bell).',
  tip: 'After adding a layer, set Works on to the new partial and change only that one.'
});
GROUPS.unshift(OSC_GROUP);

GROUPS.unshift(OSC_GROUP);
GROUPS.push(FX_GROUP);
/** Every move. */
export const ING = GROUPS.flatMap(([, ps]) => ps);
/** A move by id. */
export const ing = id => ING.find(p => p.id === id);
