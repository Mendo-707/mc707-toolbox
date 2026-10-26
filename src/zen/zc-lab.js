// The Slime Lab (experimental): a playful, visual way into sound design for ZenCore tones. The tone is a
// living slime in the middle; each ingredient around it is one sound-design move (open the filter, pluck
// the envelope, wobble an LFO, widen the stereo, glide between notes…) made of real parameter changes.
// Mix one in (double-click, drag it onto the slime, or select it and press Mix in) and the tone changes,
// on the MC-707 too when the editor is live. The slime takes on the tone's character: its wobble is the
// motion, its spread the width, its glow the brightness, and it swells and fades with the amp envelope
// while you hold a Taste key. The Learn panel explains the idea behind each ingredient and lists exactly
// what changed; blends mix classic sounds step by step, and mixing a blend's ingredients yourself finds it.
//
// Every mix-in is one undo step in the editor's history. Reads and changes: ZE.snd (through zeBrew).
// Owns: LAB (the lab's state), localStorage 'mc707-lab' (blends found, the last amount).
import { $, el, toast } from '../core/dom.js';
import { ZE, audition, zeBrew, zeLive, zeLoad, zeRender, zeUndo } from './zc-editor.js';
import { paramOf } from './zc-tone.js';
import { tone } from './zc-starters.js';
import { BLENDS } from './zc-lab-blends.js';

const LAB = {
  sel: 'sun',
  drops: 4,
  log: [],
  found: new Set(),
  chain: Promise.resolve(),
  start: 0,
  latch: false,
  guide: null
};
const STORE = 'mc707-lab';
try {
  const s = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (s) {
    LAB.found = new Set(s.found || []);
    if (s.drops >= 1 && s.drops <= 10) LAB.drops = s.drops;
  }
} catch (e) {}
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify({ found: [...LAB.found], drops: LAB.drops }));
  } catch (e) {}
};
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---- brewing: reading and changing the tone's values ---- */
/** The partials that are switched on (the first one when none reads as on). */
function parts() {
  const on = [0, 1, 2, 3].filter(i => ZE.snd.v['PMT.PMT' + (i + 1) + '_PTL_SW'] === 1);
  return on.length ? on : [0];
}
/* A mix: the changes an ingredient makes, built up before they go to the tone in one step. */
function brewer() {
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
  const ps = parts();
  /* fn(prefix) for each partial on: prefix('PTL') is 'PTL0', and so on; n counts the partials */
  const each = fn => ps.forEach((i, n) => fn(b => b + i, n));
  return { get, set, add, toward, each, out, n: ps.length };
}

/* ---- the ingredients ---- */
/* [group, ingredients]; an ingredient: id, name, colour, a tagline, the move (brew), and what to learn */
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
/* what each one changes, in a few words (under its name) */
const SUB = {
  sun: 'Cutoff up',
  moon: 'Cutoff down',
  squelch: 'Resonance + filter env',
  bloom: 'Filter envelope',
  ghost: 'High-pass filter',
  hush: 'Less reso, drive, fat',
  pluck: 'Amp + filter envelopes',
  swell: 'Slow attack',
  mist: 'Release time',
  punch: 'Pitch envelope',
  wobble: 'LFO 2 → cutoff',
  vibrato: 'LFO 1 → pitch',
  tremolo: 'LFO 1 → level',
  swirl: 'LFO 2 → pan',
  quick: 'LFO rates up',
  sloth: 'LFO rates down',
  abyss: 'Octave −1',
  feather: 'Octave +1',
  wolf: 'Mono, legato',
  glide: 'Portamento',
  drift: 'Analog feel, random pitch',
  swarm: 'Unison voices',
  giant: 'Pan spread, width',
  shimmer: 'Fine tune, stereo detune',
  grit: 'FXM, fat, analog feel',
  space: 'Reverb + delay sends'
};
const ING = GROUPS.flatMap(([, ps]) => ps);
const ing = id => ING.find(p => p.id === id);

/* ---- what the tone is like: the cauldron's mood, and the meters ---- */
function traits() {
  const v = ZE.snd.v,
    ps = parts(),
    n = k => (typeof v[k] === 'number' ? v[k] : 0);
  const avg = f => ps.reduce((s, i) => s + f(i), 0) / ps.length;
  const lfo = i =>
    Math.max(
      ...[
        'LFO1_PIT_DEPTH',
        'LFO1_TVF_DEPTH',
        'LFO1_TVA_DEPTH',
        'LFO2_PIT_DEPTH',
        'LFO2_TVF_DEPTH',
        'LFO2_TVA_DEPTH'
      ].map(k => Math.abs(n('LFO' + i + '.' + k)) / 60),
      ...['LFO1_PAN_DEPTH', 'LFO2_PAN_DEPTH'].map(k => Math.abs(n('LFO' + i + '.' + k)) / 50)
    );
  const pan =
    ps.length > 1
      ? Math.max(...ps.map(i => n('PTL' + i + '.PAN'))) - Math.min(...ps.map(i => n('PTL' + i + '.PAN')))
      : 0;
  const c = x => Math.max(0, Math.min(1, x));
  return [
    ['Brightness', c(avg(i => (n('PTL' + i + '.FILTER_TYPE') === 0 ? 1 : n('PTL' + i + '.CUTOFF') / 1023))), '#ffd23f'],
    ['Bite', c(avg(i => n('PTL' + i + '.RESO') / 800)), '#9dff3a'],
    ['Snap', c(avg(i => 1 - Math.sqrt(n('AENV' + i + '.T1') / 1023))), '#ff4b3e'],
    ['Sustain', c(avg(i => n('AENV' + i + '.L3') / 1023)), '#ffa65c'],
    ['Tail', c(avg(i => n('AENV' + i + '.T4') / 800)), '#b9c7d9'],
    ['Motion', c(avg(lfo)), '#36e0c8'],
    [
      'Width',
      c(
        n('SCMN.UNISON_SW') * 0.35 +
          pan / 90 +
          avg(i => n('PTL' + i + '.PAN_RND') / 40 + Math.abs(n('PTL' + i + '.STEREO_DETN')) / 25)
      ),
      '#8fe388'
    ],
    [
      'Grit',
      c(
        n('CMN.ANALOG_FEEL') / 160 +
          avg(i => n('PTL' + i + '.FXM_SW') * (n('PTL' + i + '.FXM_DEPTH') / 10) + (n('SPTL' + i + '.FAT') - 64) / 200)
      ),
      '#e8551c'
    ],
    ['Space', c(avg(i => (n('PTL' + i + '.REV_SEND') + n('PTL' + i + '.CHO_SEND') * 0.7) / 140)), '#7fa7c9']
  ];
}
/** A reading of the tone: what it is turning into. */
function reading(tr) {
  const t = Object.fromEntries(tr.map(([k, v]) => [k, v]));
  const v = ZE.snd.v;
  const role =
    v['CMN.OCTAVE'] < 0
      ? t.Snap > 0.7 && t.Sustain < 0.3
        ? 'a punchy bass or drum hit'
        : 'a bass'
      : t.Snap < 0.45
        ? 'a pad or a swell'
        : t.Sustain < 0.25
          ? 'a pluck or a stab'
          : v['CMN.MONO_POLY'] === 0
            ? 'a lead line'
            : 'keys or chords';
  const words = [];
  if (t.Brightness > 0.8) words.push('bright');
  else if (t.Brightness < 0.4) words.push('dark');
  if (t.Bite > 0.45) words.push('squelchy');
  if (t.Grit > 0.45) words.push('gritty');
  if (t.Motion > 0.3) words.push('moving');
  if (t.Width > 0.45) words.push('wide');
  if (t.Space > 0.5) words.push('distant');
  else if (t.Space < 0.1) words.push('dry');
  if (t.Tail > 0.6) words.push('ringing');
  const desc = words.length ? words.slice(0, 4).join(', ') : 'plain';
  return 'Reads as ' + desc + ': ' + role + '.';
}

/* ---- the slime: drawn each frame from the tone's character ---- */
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, at = {}) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in at) e.setAttribute(k, at[k]);
  return e;
};
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const BASE = '#39ff7a';
/* the slime's colour: the editor's green, tinted by the last few ingredients */
function tint(cols) {
  const all = [BASE, BASE, ...cols];
  const w = all.map((_, i) => (i < 2 ? 1.5 : i)),
    tot = w.reduce((a, b) => a + b, 0);
  const m = [0, 1, 2].map(j => all.reduce((s, c, i) => s + hex(c)[j] * w[i], 0) / tot);
  /* mixed colours go muddy: keep the hue, make it vivid again */
  const [r, g, b] = m.map(x => x / 255),
    hi = Math.max(r, g, b),
    lo = Math.min(r, g, b),
    d = hi - lo;
  let h = 0;
  if (d) h = hi === r ? ((g - b) / d) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const S = 0.85,
    L = 0.58,
    C = (1 - Math.abs(2 * L - 1)) * S,
    X = C * (1 - Math.abs(((h / 60) % 2) - 1)),
    o = L - C / 2;
  const [a1, b1, c1] =
    h < 60
      ? [C, X, 0]
      : h < 120
        ? [X, C, 0]
        : h < 180
          ? [0, C, X]
          : h < 240
            ? [0, X, C]
            : h < 300
              ? [X, 0, C]
              : [C, 0, X];
  return [a1, b1, c1].map(x => (x + o) * 255);
}
const LOBES = 9;
const SL = {
  raf: 0,
  t: 0,
  kick: 0,
  col: hex(BASE),
  to: hex(BASE),
  T: {},
  drops: [],
  drips: [],
  splats: [],
  rings: [],
  rip: 9,
  hold: null,
  env: null
};

function slimeSvg() {
  const s = svgEl('svg', { viewBox: '0 0 400 300', class: 'lsSvg', 'aria-hidden': 'true' });
  s.innerHTML =
    '<defs><filter id="lsGoo" x="-20%" y="-20%" width="140%" height="140%">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>' +
    '<feColorMatrix in="b" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="g"/>' +
    '<feComposite in="SourceGraphic" in2="g" operator="atop"/></filter>' +
    '<filter id="lsHaze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26"/></filter>' +
    '<radialGradient id="lsShade" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".35"/>' +
    '<stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>' +
    '<ellipse class="lsHaze" cx="200" cy="165" rx="120" ry="90" filter="url(#lsHaze)"/>' +
    '<ellipse class="lsShadow" cx="200" cy="262" rx="110" ry="12"/>' +
    '<g class="lsMotes"></g><g class="lsRings"></g>' +
    '<g class="lsBody" filter="url(#lsGoo)"></g>' +
    '<ellipse class="lsShine" rx="30" ry="13"/><circle class="lsDot" r="5"/>';
  const body = s.querySelector('.lsBody');
  body.append(svgEl('circle', { class: 'lsCore', cx: 200, cy: 170, r: 60 }));
  for (let i = 0; i < LOBES; i++) body.append(svgEl('circle', { class: 'lsLobe', cx: 200, cy: 170, r: 30 }));
  body.append(svgEl('circle', { class: 'lsFoot', cx: 200, cy: 230, r: 40 }));
  const motes = s.querySelector('.lsMotes');
  for (let i = 0; i < 12; i++) motes.append(svgEl('circle', { r: 2 + (i % 3) }));
  return s;
}
/* the amp envelope's level t seconds into a held note (r: seconds since release, or null) */
const envSec = v => Math.pow(Math.max(0, v) / 1023, 2.2) * 7;
function envLevel(e, t, r) {
  const seg = [
    [envSec(e.t1), 0, e.l1],
    [envSec(e.t2), e.l1, e.l2],
    [envSec(e.t3), e.l2, e.l3]
  ];
  const at = tt => {
    for (const [d, a, b] of seg) {
      if (tt < d) return a + (b - a) * (tt / Math.max(d, 1e-4));
      tt -= d;
    }
    return e.l3;
  };
  if (r == null) return at(t);
  const from = at(t - r),
    d = envSec(e.t4);
  return r >= d ? 0 : from * (1 - r / Math.max(d, 1e-4));
}
function frame(now) {
  const svg = document.querySelector('#labOv .lsSvg');
  if (!svg) return (SL.raf = 0);
  SL.raf = requestAnimationFrame(frame);
  const calm = still();
  const dt = Math.min(0.05, (now - (SL.last || now)) / 1000);
  SL.last = now;
  const T = SL.T;
  SL.t += dt * (calm ? 0 : 0.6 + (T.Motion || 0) * 2.6);
  SL.kick *= Math.pow(0.04, dt);
  SL.col = SL.col.map((c, i) => c + (SL.to[i] - c) * Math.min(1, dt * 3));
  /* the note being tasted swells the slime along the amp envelope */
  let E = 0;
  if (SL.hold && SL.env) {
    const t = (now - SL.hold.t0) / 1000,
      r = SL.hold.up == null ? null : (now - SL.hold.up) / 1000;
    E = envLevel(SL.env, t, r);
    if (r != null && r > envSec(SL.env.t4) + 0.1) SL.hold = null;
  }
  const g = x => (typeof x === 'number' ? x : 0);
  const R = (58 + g(T.Sustain) * 12 + g(T.Tail) * 8) * (1 + E * 0.22);
  const sq = Math.sin(SL.kick * 9) * SL.kick;
  const sx = (1 + g(T.Width) * 0.42) * (1 + sq * 0.18),
    sy = (1 - g(T.Width) * 0.1) * (1 - sq * 0.16);
  const cx = 200,
    cy = 252 - R * 1.2 * sy;
  const wob = 3 + g(T.Motion) * 14 + SL.kick * 16,
    snap = g(T.Snap),
    grit = g(T.Grit) * 3.5;
  const jit = () => (calm ? 0 : (Math.random() - 0.5) * grit);
  const P = (x, y) => [cx + (x - cx) * sx, cy + (y - cy) * sy];
  const body = svg.querySelector('.lsBody');
  const core = body.querySelector('.lsCore');
  const [ccx, ccy] = P(cx, cy);
  core.setAttribute('cx', ccx);
  core.setAttribute('cy', ccy);
  core.setAttribute('r', R * 0.9);
  const foot = body.querySelector('.lsFoot');
  foot.setAttribute('cx', cx + Math.sin(SL.t * 0.7) * 4);
  foot.setAttribute('cy', 248 - R * 0.28);
  foot.setAttribute('r', R * 0.62 * sx);
  SL.rip += dt;
  const ripple = a => (calm ? 0 : Math.sin(a * 3 - SL.rip * 14) * Math.exp(-SL.rip * 2.6) * R * 0.16);
  body.querySelectorAll('.lsLobe').forEach((c, i) => {
    const a = (i / LOBES) * Math.PI * 2 + Math.sin(SL.t * 0.4 + i) * 0.25;
    const dist = R * (0.48 + snap * 0.12) + Math.sin(SL.t * 1.3 + i * 1.7) * wob * 0.7 + ripple(a);
    const [x, y] = P(cx + Math.cos(a) * dist + jit(), cy + Math.sin(a) * dist * 0.92 + jit());
    c.setAttribute('cx', x);
    c.setAttribute('cy', Math.min(y, 250));
    c.setAttribute('r', Math.max(6, R * (0.5 - snap * 0.06) + Math.sin(SL.t * 1.1 + i * 2.3) * wob * 0.35));
  });
  /* drips fall from a long, wet tone */
  if (
    !calm &&
    g(T.Tail) + g(T.Space) > 0.55 &&
    Math.random() < dt * (g(T.Tail) + g(T.Space)) * 0.5 &&
    SL.drips.length < 4
  ) {
    const x = cx + (Math.random() - 0.5) * R * 1.4 * sx;
    const c = svgEl('circle', { class: 'lsDrip', cx: x, cy: cy + R * 0.3, r: 9 });
    body.append(c);
    SL.drips.push({ c, x, y: cy + R * 0.3, v: 0, r: 9 });
  }
  SL.drips = SL.drips.filter(d => {
    d.v += dt * 260;
    d.y += d.v * dt;
    d.r = Math.max(0, d.r - dt * 5);
    d.c.setAttribute('cy', d.y);
    d.c.setAttribute('r', d.r);
    if (d.y > 262 || d.r <= 0) return (d.c.remove(), false);
    return true;
  });
  /* ingredients falling in: a gloop with a stretchy tail, that splats into the slime */
  const top = ccy - R * 0.78 * sy;
  SL.drops = SL.drops.filter(d => {
    if (d.form < 1) {
      /* a gloop gathers at the top and stretches before it lets go */
      d.form = Math.min(1, d.form + dt / 0.32);
      d.r = 5 + 17 * d.form;
      d.y = -14 + d.form * 26;
      d.trail.unshift([d.x, -14]);
      d.trail.length = Math.min(d.trail.length, 14);
    } else if (!d.hit) {
      d.v += dt * 760;
      d.y += d.v * dt;
      d.x += Math.sin(d.y / 30) * dt * 20;
      d.trail.unshift([d.x, d.y]);
      d.trail.length = Math.min(d.trail.length, 14);
      if (d.y >= top) {
        d.hit = true;
        d.v = 0;
        splat(body, d, top);
      }
    } else {
      /* sinks in as it melts into the slime */
      d.r -= dt * 42;
      d.y += dt * 40;
    }
    d.c.setAttribute('cx', d.x);
    d.c.setAttribute('cy', d.y);
    d.c.setAttribute('r', Math.max(0, d.r * (d.hit ? 1 : 1 + Math.sin(d.y / 14) * 0.08)));
    /* the tail: smaller blobs where the drop was a moment ago, so it stretches as it falls */
    d.tail.forEach((t, j) => {
      const at = d.trail[Math.min(d.trail.length - 1, (j + 1) * 3)] || [d.x, d.y];
      const k = d.hit ? Math.max(0, d.r / 22) : 1;
      const str = d.form < 1 ? 0.5 + d.form * 0.4 : Math.min(1, 0.55 + d.v / 600);
      t.setAttribute('cx', at[0]);
      t.setAttribute('cy', d.hit ? at[1] + (d.y - at[1]) * (1 - k) : at[1]);
      t.setAttribute('r', Math.max(0, d.r * (0.66 - j * 0.17) * str * (d.hit ? k : 1)));
    });
    if (d.r <= 0) {
      d.c.remove();
      d.tail.forEach(t => t.remove());
      d.done();
      return false;
    }
    return true;
  });
  /* splash droplets thrown up by a splat fall back and are swallowed */
  SL.splats = SL.splats.filter(d => {
    d.vy += dt * 900;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.vy > 0 && Math.hypot((d.x - ccx) / sx, (d.y - ccy) / sy) < R * 0.85) d.r -= dt * 60;
    d.c.setAttribute('cx', d.x);
    d.c.setAttribute('cy', d.y);
    d.c.setAttribute('r', Math.max(0, d.r));
    if (d.r <= 0 || d.y > 262) return (d.c.remove(), false);
    return true;
  });
  /* a tasted note sends rings out of the slime */
  const rings = svg.querySelector('.lsRings');
  SL.rings = SL.rings.filter(rg => {
    const k = (now - rg.t0) / 1100;
    if (k >= 1 || calm) return (rg.c.remove(), false);
    if (!rg.c.parentNode) rings.append(rg.c);
    rg.c.setAttribute('cx', ccx);
    rg.c.setAttribute('cy', ccy);
    rg.c.setAttribute('rx', R * sx * (1 + k * 1.1));
    rg.c.setAttribute('ry', R * sy * (0.9 + k * 0.9));
    rg.c.style.opacity = ((1 - k) * 0.7).toFixed(3);
    return true;
  });
  /* colour, shine, haze and motes */
  const [r0, g0, b0] = SL.col.map(Math.round);
  const bri = g(T.Brightness);
  const lit = (k, m) => Math.round(k + (255 - k) * m);
  const fill = `rgb(${lit(r0, bri * 0.25)},${lit(g0, bri * 0.25)},${lit(b0, bri * 0.25)})`;
  body.style.fill = fill;
  rings.style.stroke = fill;
  svg.querySelector('.lsHaze').style.fill = fill;
  svg.querySelector('.lsHaze').style.opacity = (0.12 + g(T.Space) * 0.45 + bri * 0.12 + E * 0.25).toFixed(3);
  const sh = svg.querySelector('.lsShine');
  sh.setAttribute('cx', ccx - R * 0.38 * sx);
  sh.setAttribute('cy', ccy - R * 0.5 * sy);
  sh.setAttribute('rx', R * 0.3);
  sh.setAttribute('ry', R * 0.13);
  sh.setAttribute('transform', `rotate(-22 ${ccx - R * 0.38 * sx} ${ccy - R * 0.5 * sy})`);
  sh.style.opacity = (0.25 + bri * 0.35 + g(T.Bite) * 0.3).toFixed(3);
  const dot = svg.querySelector('.lsDot');
  dot.setAttribute('cx', ccx - R * 0.08 * sx);
  dot.setAttribute('cy', ccy - R * 0.62 * sy);
  dot.style.opacity = (0.3 + g(T.Bite) * 0.6).toFixed(3);
  svg.querySelector('.lsShadow').setAttribute('rx', R * 1.05 * sx);
  svg.querySelectorAll('.lsMotes circle').forEach((m, i) => {
    const a = (i / 12) * Math.PI * 2 + SL.t * 0.18 * (i % 2 ? 1 : -1);
    const d = R * (1.35 + (i % 4) * 0.18) + Math.sin(SL.t + i) * 8;
    m.setAttribute('cx', cx + Math.cos(a) * d * sx);
    m.setAttribute('cy', cy + Math.sin(a) * d * 0.7);
    m.style.fill = fill;
    m.style.opacity = (g(T.Space) * 0.8).toFixed(3);
  });
}
/* an ingredient falls into the slime; resolves as it is absorbed */
function dropIn(p) {
  const body = document.querySelector('#labOv .lsBody');
  if (!body || still()) return Promise.resolve();
  return new Promise(done => {
    const x = 200 + (Math.random() - 0.5) * 60,
      st = 'fill:' + p.c;
    const c = svgEl('circle', { cx: x, cy: -24, r: 20, style: st });
    const tail = [0, 1, 2].map(() => svgEl('circle', { cx: x, cy: -24, r: 0, style: st }));
    body.append(...tail, c);
    SL.drops.push({ c, tail, trail: [], x, y: -14, v: 40, r: 5, form: 0, p, done });
  });
}
/* the splat: the slime squashes, a ripple runs round it, droplets fly, and its colour flashes the drop's */
function splat(body, d, top) {
  SL.kick = 1;
  SL.rip = 0;
  SL.col = SL.col.map((c, i) => c + (hex(d.p.c)[i] - c) * 0.55);
  for (let i = 0; i < 9; i++) {
    const c = svgEl('circle', i % 2 ? { cx: d.x, cy: top, r: 6, style: 'fill:' + d.p.c } : { cx: d.x, cy: top, r: 6 });
    body.append(c);
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.4;
    SL.splats.push({
      c,
      x: d.x,
      y: top,
      vx: Math.cos(a) * (140 + Math.random() * 140),
      vy: Math.sin(a) * (300 + Math.random() * 200),
      r: 5 + Math.random() * 7
    });
  }
}

/* ---- the lab ---- */
const keyName = k => {
  const d = paramOf('tone', k);
  const m = /^([A-Z]+)(\d)?\./.exec(k);
  const part = m && m[2] != null ? ' · P' + (+m[2] + 1) : '';
  const blk = m ? { AENV: 'Amp env ', FENV: 'Filter env ', PENV: 'Pitch env ', LFO: '' }[m[1]] || '' : '';
  const name = (d ? d[0][7] : k).replace(/^(TVA|TVF|Pitch) Env /, '');
  return blk + name + part;
};
const shown = (k, v) => {
  const d = paramOf('tone', k);
  const list = d && d[0][8] && d[0][8].v;
  return String(list ? (list[v] ?? v) : v);
};
const btn = (label, fn, title, on) =>
  el('button', { type: 'button', class: 'btn sm' + (on ? ' on' : ''), title: title || '', onclick: fn }, label);
const blob = c => {
  const s = svgEl('svg', { viewBox: '0 0 32 32', class: 'liBlob', 'aria-hidden': 'true' });
  s.innerHTML =
    '<path d="M16 4c7 0 12 5 12 12c0 6-3 10-6 11c-2 .7-3-1-6-1s-4 1.7-6 1c-3-1-6-5-6-11C4 9 9 4 16 4z" fill="' +
    c +
    '"/><ellipse cx="11.5" cy="10.5" rx="4" ry="2" transform="rotate(-25 11.5 10.5)" fill="#fff" opacity=".55"/>';
  return s;
};

/** Open the Slime Lab over the ZenCore editor (tones only). */
export function labOpen() {
  const box = $('#zcOv .zcBox');
  if (!ZE.snd || ZE.kind !== 'tone' || !box) return toast('The Slime Lab works on tones: pick a tone track');
  labClose(true);
  const ov = el('div', {
    id: 'labOv',
    role: 'dialog',
    'aria-label': 'Slime Lab',
    tabindex: '-1'
  });
  const ingBtn = p =>
    el(
      'button',
      {
        type: 'button',
        class: 'liBtn',
        draggable: 'true',
        'data-id': p.id,
        style: '--ic:' + p.c,
        title: p.tag + ' Click to learn about it; + , double-click or drag onto the slime to mix it in.',
        onclick: () => select(p.id),
        ondblclick: () => mixIn(p.id),
        ondragstart: e => {
          e.dataTransfer.setData('text/plain', p.id);
          e.dataTransfer.effectAllowed = 'copy';
          const b = e.currentTarget.querySelector('.liBlob');
          if (b && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(b, 12, 12);
          select(p.id);
        }
      },
      blob(p.c),
      el('span', {}, el('b', {}, p.name), el('small', {}, SUB[p.id] || '')),
      el(
        'span',
        {
          class: 'liAdd',
          title: 'Mix in ' + p.name,
          onclick: e => {
            e.stopPropagation();
            select(p.id);
            mixIn(p.id);
          },
          ondblclick: e => e.stopPropagation()
        },
        '+'
      )
    );
  const stage = el('div', {
    class: 'lsStage',
    id: 'lsStage',
    ondragover: e => {
      e.preventDefault();
      e.currentTarget.classList.add('drop');
    },
    ondragleave: e => e.currentTarget.classList.remove('drop'),
    ondrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      if (ing(id)) mixIn(id);
    }
  });
  stage.append(slimeSvg(), el('div', { class: 'lsFound', id: 'lsFound' }));
  const amount = el('input', {
    type: 'range',
    min: 1,
    max: 10,
    value: LAB.drops,
    'aria-label': 'Amount',
    oninput: e => {
      LAB.drops = +e.target.value;
      drawAmount();
      save();
    }
  });
  ov.append(
    el(
      'div',
      { class: 'zcHead labHead' },
      el(
        'div',
        { class: 'zcTitle' },
        el('b', {}, 'Slime Lab · experiment'),
        el('span', { class: 'zcSnd', id: 'labName' })
      ),
      el('span', { class: 'labLive', id: 'labLive' }),
      el(
        'div',
        { class: 'labTools' },
        btn('Random', random, 'Mix in three random ingredients'),
        btn('Undo', undo, 'Take back the last mix-in (Ctrl+Z)'),
        btn('Start over', startOver, 'Take back everything mixed in since the lab opened'),
        btn('Back to editor', () => labClose(), 'Back to the editor (Esc)', true)
      )
    ),
    el(
      'div',
      { class: 'labBody' },
      el(
        'div',
        { class: 'labIng' },
        ...GROUPS.map(([name, ps]) => el('fieldset', { class: 'zcG labG' }, el('legend', {}, name), ...ps.map(ingBtn)))
      ),
      el(
        'div',
        { class: 'labMid' },
        el(
          'fieldset',
          { class: 'zcG labStageG' },
          el('legend', {}, 'Your tone'),
          stage,
          el('p', { class: 'labRead', id: 'labRead' })
        ),
        el(
          'div',
          { class: 'labCtl' },
          el(
            'label',
            { class: 'zcC labAmt' },
            el('span', { class: 'zcL' }, 'Amount'),
            el('span', { class: 'zcV', id: 'labAmtV' }),
            amount
          ),
          el(
            'button',
            { type: 'button', class: 'btn on labMix', id: 'labMix', onclick: () => mixIn(LAB.sel) },
            'Mix in'
          )
        ),
        el(
          'div',
          { class: 'labTaste' },
          el('span', { class: 'zcL' }, 'Taste'),
          ...[
            ['C1', 24],
            ['C2', 36],
            ['C3', 48],
            ['C4', 60],
            ['C5', 72]
          ].map(([n, m]) =>
            el(
              'button',
              {
                type: 'button',
                class: 'labKey',
                'data-n': m,
                title: 'Hold to hear ' + n + ': the slime follows the amp envelope',
                onpointerdown: e => keyDown(m, e.currentTarget)
              },
              el('span', {}, n),
              el('small', {}, 'ZXCVB'[[24, 36, 48, 60, 72].indexOf(m)])
            )
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm labLatch' + (LAB.latch ? ' on' : ''),
              id: 'labLatch',
              title: 'Hold the note on: keep tasting while you mix in (each mix-in plays it again)',
              onclick: latch
            },
            'Hold'
          )
        ),
        el(
          'p',
          { class: 'hint labKeys' },
          'Z X C V B taste · Enter mix in · arrows choose · 1–0 amount · Ctrl+Z undo · Esc back'
        )
      ),
      el(
        'div',
        { class: 'labSide' },
        el('fieldset', { class: 'zcG labLearn', id: 'labLearn' }, el('legend', {}, 'Learn')),
        el('fieldset', { class: 'zcG labMeters', id: 'labMeters' }, el('legend', {}, 'Character')),
        el('fieldset', { class: 'zcG labBlends', id: 'labBlends' }, el('legend', {}, 'Blends')),
        el('fieldset', { class: 'zcG labLog', id: 'labLog' }, el('legend', {}, 'Mixed in'))
      )
    )
  );
  box.append(ov);
  LAB.log = [];
  LAB.start = ZE.undo.length;
  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKeyUp, true);
  select(LAB.sel);
  draw();
  ov.focus();
  requestAnimationFrame(() => ov.classList.add('in'));
  if (!SL.raf) SL.raf = requestAnimationFrame(frame);
}
const KEYS = { z: 24, x: 36, c: 48, v: 60, b: 72 };
function onKey(e) {
  if (!$('#labOv')) return removeEventListener('keydown', onKey, true);
  const typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range';
  const k = e.key.toLowerCase(),
    mod = e.ctrlKey || e.metaKey || e.altKey;
  const stop = () => (e.stopPropagation(), e.preventDefault());
  if (e.key === 'Escape') {
    stop();
    labClose();
  } else if ((e.ctrlKey || e.metaKey) && k === 'z') {
    stop();
    if (e.shiftKey) redo();
    else undo();
  } else if (typing || mod) return;
  else if (k in KEYS) {
    stop();
    if (!e.repeat) keyDown(KEYS[k], $('#labOv .labKey[data-n="' + KEYS[k] + '"]'), true);
  } else if (e.key === 'Enter' && !/BUTTON/.test(e.target.tagName)) {
    stop();
    mixIn(LAB.sel);
  } else if (/^Arrow/.test(e.key) && e.target.type !== 'range') {
    stop();
    const i = ING.findIndex(p => p.id === LAB.sel),
      d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key];
    const p = ING[Math.max(0, Math.min(ING.length - 1, i + d))];
    select(p.id);
    const b = $('#labOv .liBtn[data-id="' + p.id + '"]');
    if (b) b.scrollIntoView({ block: 'nearest' });
  } else if (/^[0-9]$/.test(k)) {
    stop();
    setAmount(+k || 10);
  } else e.stopPropagation();
}
function onKeyUp(e) {
  if (!$('#labOv')) return removeEventListener('keyup', onKeyUp, true);
  const k = e.key.toLowerCase();
  if (k in KEYS && !LAB.latch && NOTE && NOTE.n === KEYS[k]) noteOff();
}
/** Close the lab and show the editor with the changes. */
export function labClose(quiet) {
  const ov = $('#labOv');
  removeEventListener('keydown', onKey, true);
  removeEventListener('keyup', onKeyUp, true);
  if (!ov) return;
  noteOff();
  ov.remove();
  cancelAnimationFrame(SL.raf);
  SL.raf = 0;
  SL.drops.forEach(d => d.done());
  SL.drops = [];
  SL.drips = [];
  SL.splats = [];
  SL.rings = [];
  if (!quiet) zeRender();
}
function setAmount(n) {
  LAB.drops = n;
  const r = $('#labOv .labAmt input');
  if (r) r.value = n;
  drawAmount();
  save();
}

function drawAmount() {
  const v = $('#labAmtV');
  if (v) v.textContent = LAB.drops + ' / 10';
  const b = $('#labMix'),
    p = ing(LAB.sel);
  if (b && p) b.textContent = 'Mix in ' + p.name;
}
function select(id) {
  LAB.sel = id;
  if (LAB.guide) LAB.guide.away = true;
  document.querySelectorAll('#labOv .liBtn').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
  drawAmount();
  drawLearn();
}
/* the Learn panel: the selected ingredient's idea, and what mixing it in last changed */
function drawLearn() {
  const box = $('#labLearn'),
    p = ing(LAB.sel);
  if (!box || !p) return;
  if (LAB.guide && !LAB.guide.away) return drawGuide(box);
  const back = LAB.guide
    ? btn('◂ Back to ' + LAB.guide.r.name, () => ((LAB.guide.away = false), drawLearn()), 'Back to the blend')
    : null;
  const last = [...LAB.log].reverse().find(x => x.id === p.id);
  box.style.setProperty('--ic', p.c);
  box.replaceChildren(
    el('legend', {}, 'Learn'),
    back,
    el('div', { class: 'llTop' }, blob(p.c), el('b', {}, p.name), el('small', {}, p.tag)),
    el('p', {}, p.what),
    el('p', {}, el('span', { class: 'llK' }, 'Hear it in'), p.hear),
    el('p', {}, el('span', { class: 'llK' }, 'Tip'), p.tip),
    last
      ? el(
          'div',
          { class: 'llDid' },
          el('span', { class: 'llK' }, 'Last time it changed'),
          ...last.ch
            .slice(0, 12)
            .map(([k, a, b]) =>
              el(
                'div',
                { class: 'llCh' },
                el('span', {}, keyName(k)),
                el('s', {}, shown(k, a)),
                el('b', {}, shown(k, b))
              )
            ),
          last.ch.length > 12 ? el('small', { class: 'hint' }, '…and ' + (last.ch.length - 12) + ' more') : null
        )
      : el('p', { class: 'hint' }, 'Mix it in to see exactly which settings it changes.')
  );
}
/* everything that follows the tone: name, link, meters, the slime's character, blends, the list */
function draw() {
  if (!$('#labOv')) return;
  $('#labName').textContent = ZE.snd.v['CMN.NAME'] || 'INIT TONE';
  const live = zeLive();
  const lv = $('#labLive');
  lv.textContent = live ? 'Live: changes go to the MC-707' : 'Not live: changes stay in the editor';
  lv.classList.toggle('on', live);
  const tr = traits();
  SL.T = Object.fromEntries(tr.map(([k, v]) => [k, v]));
  SL.to = tint(LAB.log.slice(-4).map(x => ing(x.id).c));
  $('#labMeters').replaceChildren(
    el('legend', {}, 'Character'),
    ...tr.map(([n, v]) =>
      el(
        'div',
        { class: 'lmRow' },
        el('span', {}, n),
        el('i', {}, el('em', { style: 'width:' + Math.round(v * 100) + '%' })),
        el('b', {}, String(Math.round(v * 100)))
      )
    )
  );
  $('#labRead').textContent = reading(tr);
  $('#labBlends').replaceChildren(
    el('legend', {}, 'Blends'),
    el(
      'p',
      { class: 'hint' },
      'Classic sounds built from scratch, step by step. Guide walks you through each step with the reason for it; Make builds it in one go. Both start from a clean slate, replacing this tone (Undo brings it back).'
    ),
    ...BLENDS.map(r => {
      const got = LAB.found.has(r.id),
        cur = LAB.guide && LAB.guide.r === r;
      return el(
        'div',
        { class: 'lbRow' + (got ? ' got' : '') + (cur ? ' cur' : '') },
        el(
          'div',
          {},
          el('b', {}, r.name),
          el(
            'div',
            { class: 'lbDots' },
            ...r.steps.map(([id, t]) => el('i', { style: '--ic:' + ing(id).c, title: t }))
          ),
          el('small', {}, r.about)
        ),
        el(
          'div',
          { class: 'lbBtns' },
          btn('Guide', () => blendStart(r, false), 'Build ' + r.name + ' one step at a time, tasting as you go'),
          btn('Make', () => blendStart(r, true), 'Build ' + r.name + ' in one go')
        )
      );
    })
  );
  $('#labLog').replaceChildren(
    el('legend', {}, 'Mixed in'),
    LAB.log.length
      ? el(
          'div',
          { class: 'lgList' },
          ...LAB.log.map(x =>
            el(
              'button',
              {
                type: 'button',
                class: 'lgChip',
                style: '--ic:' + ing(x.id).c,
                title: x.ch.length + ' settings changed: click to see them',
                onclick: () => select(x.id)
              },
              x.label || ing(x.id).name + ' ' + x.drops
            )
          )
        )
      : el('p', { class: 'hint' }, 'Nothing yet: pick an ingredient and mix it in, then hold a Taste key.')
  );
}

/* ---- mixing ---- */
/* Mix-ins fall at once but go into the tone in order, each as it lands (one undo step each). */
const later = fn => (LAB.chain = LAB.chain.then(fn).catch(() => {}));
function mixIn(id, drops = LAB.drops) {
  const p = ing(id);
  if (!p) return Promise.resolve();
  const btn = $('#labOv .liBtn[data-id="' + id + '"]');
  if (btn) {
    btn.classList.remove('go');
    void btn.offsetWidth;
    btn.classList.add('go');
  }
  const landed = dropIn(p);
  return later(async () => {
    await landed;
    if (!$('#labOv')) return;
    const b = brewer();
    p.brew(b, drops / 10);
    const before = Object.fromEntries(Object.keys(b.out).map(k => [k, ZE.snd.v[k]]));
    const keys = zeBrew(b.out);
    if (!keys.length) toast(p.name + ' changed nothing: those settings are already as far as they go');
    else LAB.log.push({ id, drops, ch: keys.map(k => [k, before[k], ZE.snd.v[k]]) });
    draw();
    if (LAB.sel === id) drawLearn();
    /* a held note plays again, so envelope changes are heard */
    if (NOTE && LAB.latch) retrigger();
  });
}
function undo() {
  later(() => {
    if (ZE.undo.length <= LAB.start && !LAB.log.length) return toast('Nothing to undo');
    if (!ZE.undo.length) return;
    zeUndo();
    const x = LAB.log.pop();
    if (x && x.guide && LAB.guide) {
      if (x.slate) LAB.guide = null;
      else LAB.guide.i = LAB.guide.done = Math.max(0, LAB.guide.done - 1);
    }
    if (x) toast('Took out ' + (x.label || ing(x.id).name));
    SL.kick = 0.6;
    SL.rip = 0;
    draw();
    drawLearn();
  });
}
function redo() {
  later(() => {
    if (!ZE.redo.length) return;
    zeUndo(true);
    SL.kick = 0.6;
    draw();
  });
}
function startOver() {
  later(() => {
    const n = ZE.undo.length - LAB.start;
    if (n <= 0) return toast('Nothing mixed in yet');
    for (let i = 0; i < n; i++) zeUndo();
    LAB.log = [];
    LAB.guide = null;
    SL.kick = 1;
    SL.rip = 0;
    draw();
    drawLearn();
    toast('Back to the tone as it was when the lab opened');
  });
}
async function random() {
  const pick = [...ING].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const p of pick) {
    mixIn(p.id, 2 + Math.floor(Math.random() * 6));
    await wait(still() ? 0 : 200);
  }
  await LAB.chain;
  toast('Mixed in ' + pick.map(p => p.name).join(', ') + ': have a taste');
}
/* ---- blends: a clean slate, then each step with its reason ---- */
/* the values that exist in a tone (so a blend's typo can't send nonsense) */
const real = vals => Object.fromEntries(Object.entries(vals).filter(([k]) => paramOf('tone', k)));
/** Start a blend: the clean slate goes in, then (auto) every step, or (guided) one per Next. */
function blendStart(r, auto) {
  noteOffIfHeld();
  /* i: the next step asked for; done: the steps in the tone */
  LAB.guide = { r, i: 0, done: 0, auto, away: false };
  const name = r.name.toUpperCase().slice(0, 16);
  const snd = tone(name, set => {
    if (r.slate === 'supersaw') set('SPTL.OSC_TYPE', 3);
    else set('SPTL.VA_FORM', r.slate);
  });
  const p = ing('ghost');
  const landed = dropIn(p);
  later(async () => {
    await landed;
    if (!$('#labOv')) return;
    await zeLoad(snd);
    LAB.log.push({ id: 'ghost', label: 'Clean slate', guide: true, slate: true, ch: [] });
    draw();
    drawLearn();
  });
  drawLearn();
  if (auto) runSteps(r, 0);
  return LAB.chain;
}
/* one step of a blend (resolves once it is in the tone) */
function blendStep(r, i) {
  const g = LAB.guide;
  if (!g || g.r !== r || i !== g.i || i >= r.steps.length) return Promise.resolve();
  const [id, label, , vals] = r.steps[i];
  g.i = i + 1;
  g.away = false;
  drawLearn();
  const landed = dropIn(ing(id));
  return later(async () => {
    await landed;
    if (!$('#labOv')) return;
    const v = real(vals);
    const before = Object.fromEntries(Object.keys(v).map(k => [k, ZE.snd.v[k]]));
    const keys = zeBrew(v);
    LAB.log.push({ id, label, guide: true, ch: keys.map(k => [k, before[k], ZE.snd.v[k]]) });
    g.done = i + 1;
    if (g.done >= r.steps.length) made(r);
    draw();
    drawLearn();
    if (NOTE && LAB.latch) retrigger();
  });
}
function made(r) {
  LAB.found.add(r.id);
  save();
  const f = $('#lsFound');
  if (!f) return;
  f.replaceChildren(
    el('span', { class: 'llK' }, 'Blend made'),
    el('b', {}, r.name),
    el('small', {}, 'Taste it on ' + noteName(r.note) + ', then shape it further with the ingredients.')
  );
  f.classList.remove('show');
  void f.offsetWidth;
  f.classList.add('show');
  clearTimeout(made.t);
  made.t = setTimeout(() => f.classList.remove('show'), 4200);
}
const noteName = n => 'C' + (n / 12 - 1);
/* the Learn panel while a blend is being built: its steps, this step's reason and what it changed */
function drawGuide(box) {
  const g = LAB.guide,
    r = g.r,
    done = g.done >= r.steps.length,
    busy = g.i > g.done;
  const shownStep = Math.max(0, g.done - 1);
  const last = [...LAB.log].reverse().find(x => x.guide && !x.slate);
  const step = g.done ? r.steps[shownStep] : null;
  box.style.setProperty('--ic', step ? ing(step[0]).c : '#dfe9ff');
  box.replaceChildren(
    el('legend', {}, 'Blend · ' + r.name),
    el('p', { class: 'llAbout' }, r.about),
    el(
      'ol',
      { class: 'lgSteps' },
      el('li', { class: LAB.log.some(x => x.slate) ? 'done' : 'now' }, 'Clean slate: ' + slateName(r)),
      ...r.steps.map(([id, t], i) =>
        el('li', { class: i < g.done ? 'done' : i === g.done ? 'next' : '', style: '--ic:' + ing(id).c }, t)
      )
    ),
    step
      ? el(
          'div',
          { class: 'llStep' },
          el('span', { class: 'llK' }, 'Step ' + g.done + ' of ' + r.steps.length + ' · ' + step[1]),
          el('p', {}, step[2]),
          last && last.ch.length
            ? el(
                'div',
                { class: 'llDid' },
                ...last.ch
                  .slice(0, 10)
                  .map(([k, a, b]) =>
                    el(
                      'div',
                      { class: 'llCh' },
                      el('span', {}, keyName(k)),
                      el('s', {}, shown(k, a)),
                      el('b', {}, shown(k, b))
                    )
                  ),
                last.ch.length > 10 ? el('small', { class: 'hint' }, '…and ' + (last.ch.length - 10) + ' more') : null
              )
            : null
        )
      : el(
          'p',
          { class: 'hint' },
          'A fresh tone on the ' +
            slateName(r) +
            ' oscillator, with nothing else set: every blend starts from the same place, so it sounds right whatever was loaded. Taste it, then take the first step.'
        ),
    el(
      'div',
      { class: 'llGo' },
      btn('Taste ' + noteName(r.note), () => {}, 'Hold to hear it'),
      done
        ? btn('Done', () => ((LAB.guide = null), draw(), drawLearn()), 'Close the guide', true)
        : g.auto || busy
          ? el('span', { class: 'hint' }, 'Mixing…')
          : btn('Next: ' + r.steps[g.i][1], () => blendStep(r, g.i), 'Take the next step', true),
      done || g.auto ? null : btn('Finish', () => finish(r), 'Do the remaining steps in one go')
    )
  );
  /* the Taste button plays while held, like the keys */
  const t = box.querySelector('.llGo .btn');
  t.addEventListener('pointerdown', e => keyDown(r.note, e.currentTarget));
}
const slateName = r => (r.slate === 'supersaw' ? 'SuperSAW' : ['saw', 'square', 'triangle', 'sine'][r.slate] + ' wave');
function finish(r) {
  const g = LAB.guide;
  if (!g) return;
  g.auto = true;
  g.away = false;
  drawLearn();
  runSteps(r, g.i);
}
/* the steps from i on, one after another */
async function runSteps(r, from) {
  await LAB.chain;
  for (let i = from; i < r.steps.length; i++) {
    if (!LAB.guide || LAB.guide.r !== r || !$('#labOv')) return;
    await wait(still() ? 0 : 260);
    await blendStep(r, i);
  }
}
function noteOffIfHeld() {
  if (NOTE && !LAB.latch) noteOff();
}

/* ---- tasting: a note plays and the slime follows the amp envelope ---- */
let NOTE = null; /* {n, off, key} */
function noteOn(n, key) {
  noteOff();
  const off = audition(n, true);
  NOTE = { n, off, key };
  if (key) key.classList.add('down');
  const p = parts()[0],
    v = k => {
      const x = ZE.snd.v['AENV' + p + '.' + k];
      return typeof x === 'number' ? x : 0;
    };
  SL.env = {
    t1: v('T1'),
    t2: v('T2'),
    t3: v('T3'),
    t4: v('T4'),
    l1: v('L1') / 1023,
    l2: v('L2') / 1023,
    l3: v('L3') / 1023
  };
  SL.hold = { t0: performance.now(), up: null };
  SL.rings.push({ c: svgEl('ellipse', { class: 'lsRing' }), t0: performance.now() });
}
function noteOff() {
  if (!NOTE) return;
  const x = NOTE;
  NOTE = null;
  try {
    x.off();
  } catch (e) {}
  if (x.key) x.key.classList.remove('down');
  if (SL.hold) SL.hold.up = performance.now();
}
function retrigger() {
  const { n, key } = NOTE;
  noteOn(n, key);
}
/* a Taste key (pointer, or Z-B on the keyboard): held, or with Hold on, on until pressed again */
function keyDown(n, key, fromKeyboard) {
  if (LAB.latch && NOTE && NOTE.n === n) return noteOff();
  noteOn(n, key);
  if (LAB.latch || fromKeyboard) return;
  const up = () => {
    if (NOTE && NOTE.n === n && !LAB.latch) noteOff();
    for (const ev of ['pointerup', 'pointercancel', 'blur']) removeEventListener(ev, up);
  };
  for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, up);
}
function latch() {
  LAB.latch = !LAB.latch;
  const b = $('#labLatch');
  if (b) b.classList.toggle('on', LAB.latch);
  if (!LAB.latch) noteOff();
  else if (!NOTE) noteOn(48, $('#labOv .labKey[data-n="48"]'));
}
