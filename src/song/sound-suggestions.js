// Suggested MC-707 factory sounds for each style's tracks, shown by the song wizard.
//
// Reads: DEV.
import { $, el } from '../core/dom.js';
import { DEV, TRACK_COLORS, oneKit } from '../core/device.js';
import { trackLabel } from '../library/styles.js';
import { openWiz } from './wizard-ui.js';
import { closeWiz } from './wizard-plan.js';
import { lvGenreOf } from '../library/pools.js';

/* ---------- MC-707 factory sound suggestions ----------
   Tone names, banks and numbers come from Roland's MC-707 Sound List. Drum kits are described by style
   because the Sound List's tone pages do not name the kits. */
const SND_G = {
  dnb: {
    drums: 'Tight breakbeat kit: punchy kick, crisp snare, 16th hats',
    bass: ['A-5 Dark Sub', 'B-122 Sine Bass', 'D-696 Low Bs 1'],
    chords: ['B-290 AX Vintage EP', 'E-27 Delicate EP', 'D-1091 Spirit Tine'],
    pad: ['D-85 Heaven Pad 1', 'B-168 AX Heaven Pad'],
    lead: ['D-974 Sine Lead 1', 'B-54 AX Soft Lead'],
    pluck: ['B-242 Syn Atk Pluck', 'A-9 Sine Pluck']
  },
  hiphop: {
    drums: 'Dusty sampled kit with a fat kick and snappy snare',
    bass: ['E-141 Finger Bass', 'D-753 HH Bs 1'],
    chords: ['B-290 AX Vintage EP', 'B-297 Wurly EP'],
    pad: ['D-1101 Mood String', 'D-42 Soft Pad 1'],
    lead: ['E-92 Warm Vibes', 'B-338 AX Vibraphone'],
    pluck: ['B-380 AX Kalimba', 'B-339 AX Marimba']
  },
  house: {
    drums: 'TR-909-style kit: 909 kick, clap and open hat',
    bass: ['D-681 House Bs', 'B-113 Round Bass'],
    chords: ['E-7 House Piano', 'A-159 GarageChd MC'],
    pad: ['D-1 JP8 Strings1', 'B-149 OB Strings'],
    lead: ['D-920 Bell Lead 2', 'B-338 AX Vibraphone'],
    pluck: ['D-552 SEQ 6', 'B-240 MG Thumper']
  },
  techno: {
    drums: 'TR-909 kick with TR-808 percussion and rides',
    bass: ['D-686 TB Bass 1', 'D-640 MC202 Bs 1', 'D-741 Acid Bs 1'],
    chords: ['A-149 1Note Squ Min7', 'A-158 Phaser Syn Min7'],
    pad: ['D-166 Chronic Pad', 'D-190 GlassFx Pad'],
    lead: ['D-1007 Tekno Ld 1', 'D-960 Tekno Sqr'],
    pluck: ['D-547 SEQ 1', 'A-44 Sine Seq MC']
  },
  garage: {
    drums: 'Shuffled 2-step kit: TR-909 kick, crisp snare and rim',
    bass: ['B-123 AX Garage Bass', 'D-694 Garage Bs 1'],
    chords: ['A-159 GarageChd MC', 'A-163 1Note GarageEP'],
    pad: ['D-171 Reverie Pad', 'D-21 JUNO Str 1'],
    lead: ['D-243 Syn Vox 1', 'A-12 Syn VoiceLead 1'],
    pluck: ['D-1089 EP Belle', 'B-242 Syn Atk Pluck']
  },
  dubstep: {
    drums: 'Huge half-time kit: deep kick and a big layered snare',
    bass: ['A-76 SC1Ctrl WobbleBS', 'A-6 Wub Bass', 'A-66 SC1 Growl Bass1'],
    chords: ['D-1102 Orch Hit', 'B-426 Min7 Hit'],
    pad: ['D-196 Horror Pad', 'D-188 Metal Pad'],
    lead: ['A-21 X-MOD Lead', 'D-930 Growl Lead'],
    pluck: ['A-38 Seq X-Mod Wave 1', 'A-37 Feedback Pluck']
  },
  trance: {
    drums: 'TR-909-style kit with a long open hat',
    bass: ['B-109 Fat Analog Bs', 'D-793 SuperSawBs 1'],
    chords: ['B-179 Phase Super Saw', 'D-884 Super Saws'],
    pad: ['D-179 Trance Pad', 'B-176 Trance Sweep Pad'],
    lead: ['D-934 SuperSaw Ld', 'B-86 Super Saw Lead'],
    pluck: ['B-242 Syn Atk Pluck', 'D-551 SEQ 5']
  },
  electro: {
    drums: 'TR-808-style kit with snappy claps and cowbell',
    bass: ['D-769 PWM Bass 1', 'D-649 Compu Bass 1'],
    chords: ['A-90 JUNO Stab', 'A-20 Rave Stab'],
    pad: ['D-128 LFO Pad 1', 'B-150 106 Strings'],
    lead: ['D-910 AnaVox Ld 1', 'B-2 AX Jupiter Ld 1'],
    pluck: ['D-586 Stubby Mono', 'B-237 Short Sqr Pluck']
  },
  funk: {
    drums: 'Live-feel acoustic or TR-707-style kit',
    bass: ['B-147 AX Slap Bass', 'E-146 Slap Bass 1'],
    chords: ['B-297 Wurly EP', 'E-51 The Big Spin'],
    pad: ['B-186 Strings 1', 'D-21 JUNO Str 1'],
    lead: ['D-892 Funky Lead', 'D-925 Portament Ld'],
    pluck: ['B-266 Brass Sect', 'D-1103 Philly Hit 1']
  },
  reggae: {
    drums: 'Acoustic kit with rim shots and a one-drop kick',
    bass: ['D-702 Tri Bass 1', 'B-122 Sine Bass'],
    chords: ['B-312 Rotary Org 1', 'B-280 AX Piano'],
    pad: ['D-75 Organ Pad 1', 'B-149 OB Strings'],
    lead: ['A-1 SysCtrlDeepEcho2', 'B-338 AX Vibraphone'],
    pluck: ['E-99 Steel Drums', 'B-339 AX Marimba']
  },
  latin: {
    drums: 'TR-808-style kit with congas and shaker',
    bass: ['A-62 Dist.808StyleBs1', 'B-113 Round Bass'],
    chords: ['B-280 AX Piano', 'B-377 AX Harp'],
    pad: ['D-100 Flute Pad', 'D-42 Soft Pad 1'],
    lead: ['B-380 AX Kalimba', 'A-13 Trap Synth'],
    pluck: ['B-339 AX Marimba', 'E-99 Steel Drums']
  },
  synth: {
    drums: 'TR-707-style kit with a big gated snare',
    bass: ['D-633 106 Bass 1', 'D-769 PWM Bass 1'],
    chords: ['D-277 80s Brs 1', 'B-245 80s Brass 1'],
    pad: ['B-150 106 Strings', 'D-1 JP8 Strings1'],
    lead: ['B-2 AX Jupiter Ld 1', 'D-867 Juicy JP'],
    pluck: ["D-1090 80's EP", 'D-1082 FM EP 1']
  },
  pop: {
    drums: 'Modern punchy kit: tight kick, clap-layered snare',
    bass: ['E-137 Pick Bass', 'D-740 Round Bs'],
    chords: ['E-6 Power Grand', 'E-2 Bright Piano'],
    pad: ['D-42 Soft Pad 1', 'D-21 JUNO Str 1'],
    lead: ['A-12 Syn VoiceLead 1', 'B-63 Simple Sine'],
    pluck: ['A-28 Pop Synth Pluck', 'A-27 Electropop Keys']
  },
  ambient: {
    drums: 'Soft TR-808-style kit, low velocity',
    bass: ['B-122 Sine Bass', 'D-763 Slow Bs'],
    chords: ['D-1091 Spirit Tine', 'B-228 D-50 Fantasia'],
    pad: ['D-73 Boreal Pad', 'B-170 Scape Pad', 'D-134 Particles'],
    lead: ['D-898 Slow Lead 1', 'B-54 AX Soft Lead'],
    pluck: ['E-82 Music Box', 'D-543 Glass Amb']
  },
  rock: {
    drums: 'Acoustic rock kit with a big room snare',
    bass: ['B-144 Pick Bass 1', 'E-137 Pick Bass'],
    chords: ['E-131 R&R Chunk', 'E-133 Grungeroni'],
    pad: ['B-309 Lord Organ 1', 'B-312 Rotary Org 1'],
    lead: ['E-132 Phripphuzz', 'D-930 Growl Lead'],
    pluck: ['E-135 Velo-Wah Gtr', 'B-280 AX Piano']
  }
};
const SND_S = {
  neuro: {
    bass: ['A-66 SC1 Growl Bass1', 'D-781 Monster Bs 1', 'B-133 Dist Bass'],
    chords: ['A-20 Rave Stab', 'D-1102 Orch Hit'],
    pad: ['D-196 Horror Pad', 'D-188 Metal Pad'],
    lead: ['D-930 Growl Lead', 'B-88 Hoover Lead'],
    pluck: ['A-38 Seq X-Mod Wave 1']
  },
  jungle: {
    drums: 'Chopped amen-style break kit with ride',
    chords: ['A-24 Rotary Syn Min7', 'B-426 Min7 Hit'],
    pad: ['B-172 Angels Pad', 'D-248 Vox Pad 1'],
    lead: ['B-59 Whistle Lead'],
    pluck: ['D-547 SEQ 1']
  },
  jumpup: {
    bass: ['A-6 Wub Bass', 'A-76 SC1Ctrl WobbleBS', 'D-805 LFO Bs 1'],
    chords: ['A-20 Rave Stab', 'A-90 JUNO Stab'],
    pad: ['B-176 Trance Sweep Pad'],
    lead: ['B-88 Hoover Lead', 'A-93 5th Rave MC'],
    pluck: ['B-237 Short Sqr Pluck']
  },
  halftime: {
    bass: ['A-7 Dist.808StyleBs2', 'A-61 Heavybass Decay', 'D-783 Monster Bs 3'],
    chords: ['A-25 1Note PhaserEP1'],
    pad: ['D-176 Deepity'],
    lead: ['A-23 HiPitch Buzz Ld'],
    pluck: ['A-37 Feedback Pluck']
  },
  trap: {
    drums: 'TR-808-style kit: long 808 kick, rolling hats',
    bass: ['A-62 Dist.808StyleBs1', 'A-7 Dist.808StyleBs2', 'A-60 Bit Subby'],
    chords: ['B-280 AX Piano', 'E-4 Nice Piano'],
    pad: ['D-243 Syn Vox 1'],
    lead: ['A-13 Trap Synth', 'D-514 Bell 1'],
    pluck: ['A-11 Xylo Oct Seq', 'D-514 Bell 1']
  },
  lofi: {
    bass: ['E-140 Homey Bass', 'D-762 Soft Bs'],
    chords: ['E-24 Tremo EP', 'B-294 AX Tremolo EP'],
    pad: ['D-42 Soft Pad 1'],
    lead: ['E-92 Warm Vibes'],
    pluck: ['E-82 Music Box']
  },
  gfunk: {
    bass: ['D-597 MG Bs 1', 'B-98 Fat MG Bass'],
    chords: ['B-288 Dyno EP', 'E-53 Roller Spin'],
    pad: ['B-149 OB Strings'],
    lead: ['D-925 Portament Ld', 'D-974 Sine Lead 1'],
    pluck: ['B-299 FM EP 1']
  },
  drill: {
    drums: 'TR-808-style kit with sliding 808 and sharp snare',
    bass: ['A-64 Fall Bend Bass', 'A-62 Dist.808StyleBs1'],
    chords: ['E-2 Bright Piano'],
    pad: ['B-428 AX Choir 1', 'B-186 Strings 1'],
    lead: ['D-536 Tower Bell'],
    pluck: ['B-193 AX Pizzicato']
  },
  neosoul: {
    bass: ['E-141 Finger Bass', 'D-588 R&B Bs 1'],
    chords: ['B-289 Stage EP', 'E-32 Mr.Mellow'],
    pad: ['D-21 JUNO Str 1'],
    lead: ['D-896 Juno Soft Ld'],
    pluck: ['E-91 AmbienceVibe']
  },
  memphis: {
    drums: 'TR-808-style kit with cowbell',
    bass: ['A-60 Bit Subby', 'A-62 Dist.808StyleBs1'],
    chords: ['B-281 Mono Piano'],
    pad: ['D-196 Horror Pad'],
    lead: ['D-536 Tower Bell'],
    pluck: ['D-541 Kalimbell']
  },
  phonk: {
    drums: 'TR-808-style kit with cowbell and distorted kick',
    bass: ['A-7 Dist.808StyleBs2', 'A-62 Dist.808StyleBs1'],
    chords: ['D-1095 Theater 2', 'B-281 Mono Piano'],
    lead: ['D-536 Tower Bell'],
    pluck: ['D-541 Kalimbell']
  },
  techhouse: {
    bass: ['D-686 TB Bass 1', 'B-93 Hard House Bs'],
    chords: ['A-148 1Note Squ Maj7', 'A-149 1Note Squ Min7'],
    pad: ['D-170 Iso Pad'],
    lead: ['D-960 Tekno Sqr'],
    pluck: ['A-44 Sine Seq MC']
  },
  afrohouse: {
    drums: 'TR-909 kick with congas, shakers and toms',
    chords: ['E-91 AmbienceVibe', 'B-339 AX Marimba'],
    pad: ['D-100 Flute Pad'],
    lead: ['B-380 AX Kalimba'],
    pluck: ['E-97 Islands Mlt']
  },
  classichouse: {
    bass: ['D-681 House Bs', 'B-107 101 Bass'],
    chords: ['E-7 House Piano', 'D-1107 House Hit 1']
  },
  acidtechno: { bass: ['C-83 SL-TB Saw 1', 'D-741 Acid Bs 1', 'D-686 TB Bass 1'] },
  speedgarage: { bass: ['B-93 Hard House Bs', 'D-694 Garage Bs 1'] },
  riddim: { bass: ['D-781 Monster Bs 1', 'A-76 SC1Ctrl WobbleBS', 'A-6 Wub Bass'] },
  disco: { chords: ['D-1103 Philly Hit 1', 'E-51 The Big Spin'], pad: ['B-186 Strings 1'] },
  nudisco: { bass: ['D-597 MG Bs 1', 'B-147 AX Slap Bass'], pad: ['D-21 JUNO Str 1'] },
  dub: { lead: ['A-1 SysCtrlDeepEcho2'] },
  dancehall: { lead: ['A-13 Trap Synth'], bass: ['A-62 Dist.808StyleBs1', 'B-122 Sine Bass'] },
  afrobeats: { chords: ['B-339 AX Marimba', 'B-280 AX Piano'], lead: ['B-380 AX Kalimba'] },
  reggaeton: { bass: ['D-753 HH Bs 1', 'A-62 Dist.808StyleBs1'] },
  indie: { chords: ['B-298 Dist Wurly', 'E-6 Power Grand'] },
  cinematic: {
    drums: 'Big orchestral-style hits and toms',
    chords: ['B-188 AX Mood Strings'],
    pad: ['B-186 Strings 1', 'B-428 AX Choir 1'],
    lead: ['B-197 AX Cello Solo'],
    pluck: ['B-193 AX Pizzicato']
  },
  punk: { chords: ['E-133 Grungeroni', 'E-131 R&R Chunk'] }
};
function soundRecs(st) {
  const g = SND_G[lvGenreOf(st)] || SND_G.dnb,
    s = SND_S[st.id] || {};
  const o = {};
  ['drums', 'bass', 'chords', 'pad', 'lead', 'pluck'].forEach(k => (o[k] = s[k] || g[k]));
  return o;
}
export function soundCard(st) {
  const r = soundRecs(st),
    is101 = DEV === '101';
  const row = (lab, txt, c) => el('li', {}, el('b', { style: c ? 'color:' + c : '' }, lab + ': '), txt);
  return el(
    'div',
    { class: 'wcard' },
    el('h3', {}, is101 ? 'Sounds to try' : 'MC-707 sounds to try'),
    el(
      'p',
      { class: 'hint' },
      is101
        ? "Names from Roland's MC-707 Sound List. The MC-101 uses the same ZEN-Core engine, but its preset list may differ, so treat these as a guide to the kind of sound to pick."
        : "Factory tones from Roland's MC-707 Sound List, shown as bank-number and name. Pick them on each MC-707 track."
    ),
    is101
      ? el(
          'ul',
          {},
          row('Drum kit (track 1)', r.drums, TRACK_COLORS[0]),
          row(trackLabel(st, 3) + ' (track 2)', r.bass.join(' · '), TRACK_COLORS[3]),
          row(trackLabel(st, 4) + ' (track 3)', r.chords.join(' · '), TRACK_COLORS[4]),
          row(trackLabel(st, 6) + ' (track 4)', r.lead.join(' · '), TRACK_COLORS[6])
        )
      : el(
          'ul',
          {},
          row(
            oneKit() ? 'Drum kit (track 1, full kit) and Drums 3 (builds)' : 'Drum kits (tracks 1–3)',
            r.drums,
            TRACK_COLORS[0]
          ),
          row(trackLabel(st, 3), r.bass.join(' · '), TRACK_COLORS[3]),
          row(trackLabel(st, 4), r.chords.join(' · '), TRACK_COLORS[4]),
          row(trackLabel(st, 5), r.pad.join(' · '), TRACK_COLORS[5]),
          row(trackLabel(st, 6), r.lead.join(' · '), TRACK_COLORS[6]),
          row(trackLabel(st, 7), r.pluck.join(' · '), TRACK_COLORS[7])
        )
  );
}
export function initWizard() {
  $('#bWiz').addEventListener('click', openWiz);
  $('#wiz').addEventListener('pointerdown', e => {
    if (e.target.id === 'wiz') closeWiz();
  });
}
