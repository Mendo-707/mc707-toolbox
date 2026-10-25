# How MC-707 Toolbox is built

The app is plain JavaScript in about 90 ES modules under `src/`, with no framework. A build step
(`npm run build`) bundles them into one self-contained `index.html` at the repo root. That one
file is what people run: the web version on GitHub Pages, the Windows app (Electron), the
claude.ai page, or double-clicked from a folder.

Start with `AGENTS.md` for how to work in the repo. This page explains how the parts fit.

## Layers

Every module belongs to one layer, and imports only from its own layer or lower ones.
`scripts/check-imports.mjs` enforces this in CI.

```
  app       ui/ (menu bar, toolbar and shortcuts, projects, grabber, capture to song,
            device switch, Live menus), scene/ (Scene Mode) and main.js
                                                           ties Song, Live and zen together
     │
  features  song/   live/   zen/ (ZenCore editor)          never import each other
     │
  clips     clips/                                         clip chips and the clips screen
     │
  services  services/ (MIDI, transport, preview synth, audio inputs and files,
            MC-707 clip switching, CC automation) plus ui/menu.js, ui/dialogs.js, ui/fullscreen.js
     │
  library   library/                                       the factory pattern library
     │
  core      core/ (DOM helpers, theory, device, the song state S, song model, hooks, types)
```

The rules:

- **Imports only point down.** A module may import from its own layer or any layer below.
- **No import cycles between folders.** Modules inside one feature folder may call each other.
- **Song, Live and the ZenCore editor (zen/) never import each other.** Anything they share lives lower down, such as the
  transport, the pattern pools and clip switching. Code that needs both (capture to song, the
  grabber, the toolbar) lives in the app layer.
- **Calls that must point up go through `core/hooks.js`.** For example, the transport has to run
  Live Mode's tick, and saving the song has to redraw the screen. The lower module calls
  `hooks.liveTick(...)` or `hooks.renderAll()`. `main.js` fills in the real functions before
  anything runs, and a test checks that every hook is filled in. Add a hook only when a call
  really has to point up.

## State: who owns what

Each piece of shared state has one owner module. Other modules import it and read it. They
change it in place where the owner allows that (most state objects are plain objects), or through
the owner's functions.

| State | Owner | What it is |
| --- | --- | --- |
| `S` | `core/state.js` | The song (see the `Song` type in `core/types.js`). Replaced only by `replaceState()`. Every change: `pushUndo()` before, `scheduleSave()` after. |
| `UI`, `ED` | `core/state.js` | Song Mode screen state (selection, library filters) and the pattern editor's state. |
| `LV` | `live/state.js` | Live Mode: style, key, tempo, scenes, pads, controller and Raven settings. Saved by `saveLive()`. |
| `TR`, `REC` | `services/transport.js` | What is playing (mode, tick, timing) and MIDI recording. |
| `MIDI` | `services/midi.js` | The open MIDI ports. |
| `AU` | `services/synth.js` | The AudioContext and the preview synth. |
| `AUD`, `AUDREC` | `services/audio-capture.js` | Audio recording settings and the recording in progress. |
| `PCLAST`, `CLIPPIN`, `CMNOW` | `services/clip-switch.js` | Which MC-707 clip each track was sent, is held on, and shows. |
| `FAC` | `library/factory.js` | Every factory pattern. Filled by the library modules in a fixed order. |
| `GRAB` | `ui/grabber.js` | The sample grabber. |
| `CTL` | `live/controller.js` | The controller keyboard. |

### Saved data (localStorage keys)

Never rename these keys or change their data shapes without a migration. People's work lives
there, and `tests/fixtures` holds real saves from v0.10.0 that must keep loading.

| Key | Holds | Owner |
| --- | --- | --- |
| `mc707-song-mode-v1` | the autosaved song | `core/state.js` |
| `mc707-live` | Live Mode settings | `live/state.js` |
| `mc707-live-scenes2` | edited Live scenes | `live/scene-editor.js` |
| `mc707-song-slots` | saved song slots | `ui/saved-songs.js` |
| `mc707-audio` | audio recording settings | `services/audio-capture.js` |
| `mc707-recent` | recent projects (Windows app) | `ui/projects.js` |
| `mc-device` | MC-707 or MC-101 | `core/device.js` reads it, `ui/device.js` sets it |
| `mc707-zen` | ZenCore editor: My sounds and the last edit of each MC-707 clip | `zen/zc-library.js` |
| `mc707-zen-refresh` | ZenCore editor's Screen switch ('0' = do not re-select the clip after edits) | `zen/zc-editor.js` |
| `mc707-mode` | Song or Live Mode on start | `ui/mode.js` sets it, `main.js` reads it |
| `mc707-song-favs`, `mc707-prevmap`, `mc707-grab-src`, `mc707-edh`, `mc707-awake` | small screen preferences | library panel, grabber, layout, fullscreen |

## Factory pattern ids must not change

Saved songs and Live scenes refer to factory patterns by id (`FAC` entries such as `vxdnb12`).
Most ids come from counters, so they depend on the order the library is generated in. That
order is fixed by `library/index.js`, which imports `factory`, `generate`, `live-extras`,
`lively`, `variety` and `flash` in that order. The test "factory pattern library is unchanged"
compares every id, name and note with `tests/baselines/factory.json`. Add new patterns at the
end of a generator, with their own id prefix, and update the baseline only for an addition you
meant to make.

## From the clock to the MIDI out

1. `TICKER` (a Worker timer, so it keeps time in a background tab) calls `sched()` every 25 ms.
2. `sched()` processes every tick that falls in the next 120 ms. For each one it calls
   `processTick(tick, time)`, then `advance()`. Times are AudioContext times, so notes are
   scheduled ahead and land exactly.
3. `processTick` does the work for the current mode, `TR.mode`:
   - `song`: MIDI clock, metronome and swing; scene changes at markers; clip-change flags
     (`songClipTick`); then for each track, the clip at this bar, its MC-707 clip change, CC
     automation (`autoCC`), and its notes (`patIndex`) with fades and velocity shapes (`velMul`).
   - `pat`: one pattern on a loop (the editor's Play pattern and library previews).
   - `wiz`: the song wizard's preview (`hooks.wizCellAt`).
   - `live`: `hooks.liveTick` → `live/engine.js`. It fires due cues (`live/cues.js`), runs
     auto-pilot and Variation, and plays each track's voices with their play masks and moves.
4. Every note goes through `emitNote()`. That applies the track's velocity, nudge, humanize, drum
   map and transpose, sends MIDI through `sendMidi()`, and plays the preview sound when it is on.

## Start-up

`main.js` imports every module once, in a fixed order. When they load, modules mostly just
declare things. The exceptions are building the pattern library and a few lookup tables, and
creating the clock's Worker. Then `main.js`:

1. fills in `hooks`,
2. loads the autosaved song (or the demo),
3. calls each feature's `init…()` in order (controls, arrangement, editor, wizard, menus, setup,
   settings, audio, layout, track MIDI, structure, Live),
4. draws everything (`renderAll`), restores Song or Live Mode, and starts the animation frame.

`window.__app` is a handle for the automated tests only. The app never uses it.

## Build and tests

- `scripts/build.mjs`: esbuild bundles `src/main.js`. The stylesheets from `src/styles/` and the
  error banner are inlined into a copy of `src/index.html`, giving the single `index.html`.
  `--check` fails if the committed `index.html` is out of date.
- `scripts/dev.mjs`: serves `src/` as it is at http://localhost:8707, so the browser loads the
  modules directly. Use it while working, and run `npm run build` before committing.
- `scripts/check-imports.mjs`: the layer rules above.
- `scripts/module-map.mjs`: writes the module map below from each module's header.
- `tests/`: Playwright drives headless Chromium with a fake MIDI device and a seeded
  `Math.random`. `engine.test.mjs` compares factory patterns, song MIDI, Live scenes and a Live
  set's MIDI with the baselines in `tests/baselines`. `app.test.mjs` checks saved work loads,
  every screen opens without errors, the main features work, and every hook is filled in. CI runs
  the tests twice: on the built file, and on `src/` from the dev server.

## The ZenCore editor and MC-707 SysEx

`zen/` edits the ZEN-Core sounds in the MC-707's clips over Roland SysEx, which Roland never
documented for the MC-707 or MC-101 (model ids 0x5D and 0x5E). It asks the browser for SysEx MIDI
access separately (`zc-sysex.js`), so the rest of the app never needs it.

- **Addresses.** A Roland address is four 7-bit bytes; the code keeps plain (linear) byte numbers
  and converts at the edge (`lin`, `addrBytes`). Clip tones start at 30 00 00 00, 17 slots per
  track (16 clips and the track sound) of 02 00 00 each; drum kits start at 32 10 00 00, slots of
  03 00 00. Inside a slot the blocks follow Roland's layout (`LAYOUT` in `zc-tone.js`).
- **Parameters.** `zc-data.js` is generated data: every tone and kit parameter with its offset,
  size (one 7-bit byte, or 2 or 4 nibbles), range, initial value and value names. `zc-mfx-data.js`
  lists the 91 MFX types and the parameters each puts in the 32 MFX slots, from the Reference
  Manual. Values in a sound are what you see (signed); `encode` adds the parameter's offset.
- **Writes** (DT1) go through a queue that coalesces a dragged slider to its latest value.
- **Reads** (RQ1) are trusted only when the reply is for exactly the address and length asked:
  the MC-707 replies with the linear address, each byte masked, and sometimes answers another run
  or fewer bytes. A run that comes back wrong is retried one parameter at a time; a silent device
  ends the read after three requests. Values that could not be read stay out of `snd.known` and
  show faded.
- The tests' fake MC-707 (`tests/helpers.mjs`) keeps a SysEx memory: DT1 writes land in it and RQ1
  reads answer from it the way the hardware does, so a sound can be sent and read back.

## Module map
<!-- module-map:start (generated by scripts/module-map.mjs from each module's header) -->

### core/ (layer: core)

| Module | What it does | Owns |
| --- | --- | --- |
| `core/crc.js` | CRC-32 table, shared by the zip writers (MIDI export and audio recordings). |  |
| `core/device.js` | Which device the app drives: the MC-707 (8 tracks) or the MC-101 (4 tracks), the track colours, and helpers that say whether a track is in use. | DEV (the device) |
| `core/dom.js` | Tiny DOM helpers used everywhere: $ and $$ (querySelector), el() to build elements, clamp, toast messages, and duration formatting. |  |
| `core/hooks.js` | Calls that go UP the layers (see docs/ARCHITECTURE.md). |  |
| `core/icons.js` | SVG icons for the Play and Stop buttons. |  |
| `core/mc707-params.js` | The MC-707 controls the app can automate (CC numbers, names, ranges). |  |
| `core/mpj.js` | Reading an MC-707 project file (.mpj, as the MC-707 saves projects on its SD card). Not documented by Roland; worked out from empty projects with known track layouts and a full project (2026). Read only: the app never writes one. |  |
| `core/pump.js` | The sidechain pump: a part ducks on every kick and comes back, written into a clip's motion so the MC-707 plays it by itself. Volume pumps the SOUND (C4) knob's lane (set to Level with KNOB ASSIGN on the MC-707), Filter the FILTER knob's lane (cutoff on most sounds). The idea and the motion layout are Ada Locriana's (github.com/Locriana/mctools_sidechain). The shape: down on the kick (half down one motion point before), held, then back, eased like a compressor letting go or in a straight line as Ada's tool does. Where it starts, how long it holds and how long it takes to come back are set finely, in eighths of a 16th (one motion point in a 1/16 clip), since a later or longer comeback changes the groove; times are in 16ths, so the shape stays in time at any clip step size or tempo. Softer kicks duck less; ghost notes not at all. The kick pattern repeats under a longer clip, and the end of the clip wraps to its start. |  |
| `core/random.js` | Seeded random numbers (mulberry32) and a string hash, so generated patterns come out the same every run. |  |
| `core/rolls.js` | Hi-hat and snare roll shapes (16th triplets, 32nds, 64th ramps …) as note positions inside one beat, and a parser for beat-by-beat hat lines like '8 8 t16 32'. Used by the genre pack and by Live Mode's Extreme variation. |  |
| `core/scene-model.js` | Scene Mode's part of the song (S.scn), laid out as the MC-707 keeps it: each track's 16 clips (a pattern, with a transpose and the tone the clip should have), and the scenes in chain order, each a length in bars and the clip each track plays. Also what was last written to the MC-707, to show each clip and scene as written, changed or new. Saved with the song; a song without scenes has no S.scn. Plain data helpers only; Scene Mode (scene/) changes it. |  |
| `core/song-model.js` | Reading and editing the song's clips: find the clip at a bar, cut a gap into a track, place a clip, the song's length, and clip arithmetic (loop length, 16th-step rounding). |  |
| `core/state.js` | The song (S) and everything that saves it: a new song, autosave to localStorage, undo and redo, loading and checking saved songs (fixState), plus the shared screen state UI and the editor state ED. | S (the song), UI (song screen state), ED (editor state), PROJ (the open project) |
| `core/theme.js` | The app's colours: dark (the default), light, or whatever the computer is set to. Kept in localStorage 'mc707-theme'; base.css has the colours for each (Live Mode has its own themes on top). | localStorage 'mc707-theme' |
| `core/theory.js` | Music theory tables: note names, the drum lanes, keys and scales. |  |
| `core/tracks.js` | The track setup: what each of the 8 tracks is for. A track's role (kit, hats, perc, bass, chords, pad, lead, pluck or acid) decides whether it is a drum or tone track and which patterns it draws. The default is the classic layout: three drum tracks, then bass, chords, pad, lead and pluck. |  |
| `core/types.js` | The shapes of the app's main data, as JSDoc types. Nothing imports this file at run time; editors and agents read it, and other files refer to these types in their JSDoc (e.g. @param {Clip} c). |  |
| `core/version.js` | The app's version, shown in Help › About. Kept in step with package.json (a test checks it). |  |

### library/ (layer: library)

| Module | What it does | Owns |
| --- | --- | --- |
| `library/acid.js` | Acid lines: TB-303 style 16th-note basslines with accents, slides (overlapping notes, so the MC-707 glides with portamento on) and octave jumps, in each genre's keys, for techno, house, trance, electro and breaks, and drum and bass. They go in their own 'acid' pool and show in the library as Acid lines. Give a clip the Acid kind on the clips screen and Live Mode plays them on it (in the B scenes and from the scene editor); acid techno's basslines include them too. |  |
| `library/bigbeat-data.js` | Big Beat's material (late-90s breakbeat rock-dance): chopped funk breaks, stomping four-to-the-floor beats, tambourines and shakers, distorted riffs on minor-pentatonic progressions, stabs, sirens and acid lines. library/bigbeat-pack.js turns it into patterns. Data only. |  |
| `library/bigbeat-pack.js` | The Big Beat pack: a new genre (late-90s breakbeat rock-dance, 110-140 BPM). Chopped funk breaks and stomping beats with tambourines, distorted riffs, octave and acid basses, stabs, organ, sirens and wah guitar on minor-pentatonic and mixolydian progressions, plus its own intros, fills, builds, impacts and flash breaks. The material is in bigbeat-data.js. Every tone part of a progression shares its name, length and key, so Live Mode keeps them together. Ids start with 'bb' and come after the melodic pack; the melodic pack then adds its pads, arps, leads and chord rhythms over these progressions too. |  |
| `library/factory.js` | The hand-written factory patterns (drums and tone parts for drum and bass and hip hop). FAC, the list every factory pattern goes into, is created here. | FAC (the pattern library) |
| `library/flash.js` | Flash-break patterns: 1 to 2 bar unison hits for every genre (FLASH_RH lists the rhythms). |  |
| `library/generate.js` | Generates most of the factory library: kits, drum layers, fills, chords, basslines, arps, leads and pads for every genre. Order matters: each pattern's id comes from the order it is made in. |  |
| `library/genre-drums.js` | The genre pack's drums: trap kits in three producer flavours (dark and sparse, bouncy, busy keys), drill, halftime drum and bass, Amen jungle breaks, afrobeats and phonk, with real hi-hat rolls (16th triplets, 32nds, 64th ramps) and the fills to match. Also moves older kits that do not fit out of the trap, drill and halftime pools. |  |
| `library/genre-keys.js` | The genre pack's tone parts for trap and drill: sliding 808s (overlapping notes, so the MC-707 glides with portamento on), dark bells, bouncy plucks, piano chords and piano runs with triplet flourishes, organ and string pads. Every part of a progression shares its name, so Live Mode keeps them together. Other hip hop basslines leave the trap and drill pools, which are 808s only. |  |
| `library/groove-data.js` | The groove pack's material: modal chord progressions (Dorian, Mixolydian, Lydian, Phrygian, harmonic minor, blues), each genre's groovy keys and rhythms for chords, basslines and melodies, and four new drum grooves per genre. library/groove-pack.js turns it into patterns. |  |
| `library/groove-pack.js` | The groove pack: for every genre, chords, basslines, pads, leads and arps on modal progressions (Dorian vamps, Mixolydian and Lydian lifts, Phrygian and harmonic-minor darkness, blues) in each genre's groovy keys and rhythms, plus four new drum grooves per genre. Parts on one progression share its name, so Live Mode keeps them together. |  |
| `library/harmony-pack.js` | The harmony pack: 20 unusual progressions (lament basses, chromatic mediants, the Neapolitan, Picardy endings, tritone substitutes, the royal road, the Mario cadence, backdoor and gospel turns) in 8- and 16-bar phrases, with chord changes that don't all land on the bar: 3+3+2 splits, long-short holds, half-bar turnarounds and pushed changes that arrive an eighth early. Each one comes with matching chords, basslines, a pad, an arp and a lead for every genre. |  |
| `library/index.js` | The finished pattern library: the id lookup (facById), the pool each track draws from, and helpers that copy a factory pattern into the song. |  |
| `library/live-extras.js` | Extra patterns for Live Mode: fills, builds and drop impacts for every genre. |  |
| `library/lively.js` | Lively variants: busier, syncopated basslines, arps, chords and leads built on each genre's progressions. |  |
| `library/melodic-pack.js` | The melodic pack: new pads, arps, leads and chord comping for every progression already in the library, so Live Mode and the song wizard have far more than the few rhythms the tone parts shared. Each progression's harmony is read from one of its own chord patterns (which notes sound on every 16th), and the new parts are built over it, so they are in key and change with the chords. Every part keeps its progression's name, length, key and styles, so Live Mode plays them together. Ids start with 'mx' and come after the harmony pack. |  |
| `library/melodic-rhythms.js` | Rhythm and shape banks for the melodic pack (melodic-pack.js): the pad treatments, arp orders and rates, lead rhythms and contours, and chord comping rhythms it picks from. Data only. |  |
| `library/mood.js` | Mood: how a pattern feels, on two scales, so Live Mode and the song wizard can lean a whole set towards angry, euphoric, chill or melancholy without leaving the genre. intensity calm (0) to intense (1): how many hits, how hard, how short and how syncopated colour dark (0) to bright (1): the scale, clashing intervals, the register, and words in the name Patterns are ranked against the others they are picked from (the style's own pool), so a calm dubstep kit counts as calm for dubstep and every style spreads from calm to intense. With the mood off, nothing is narrowed and the picks are as before. |  |
| `library/pools.js` | Which patterns suit a style: pools by genre, sub-style and tempo, full kits for one drum track, and the Lively / Classic flavour filter. Used by Live Mode and the song wizard. |  |
| `library/styles.js` | The song styles (42 of them): tempo, key, structure, parts and tips, used by the song wizard and Live Mode. |  |
| `library/user-lib.js` | My patterns: patterns you save from the editor into your own library. Kept in this browser (or the Windows app) under one localStorage key, apart from songs, so they are there in every song. | the My patterns list (read it with userLib()) |
| `library/variety.js` | The variety pack: 38 extra progressions with voice-led chords, chord-aware basslines, pads and arps for every genre. |  |

### services/ (layer: services)

| Module | What it does | Owns |
| --- | --- | --- |
| `services/audio-capture.js` | Audio input: the audio settings (AUD), opening inputs, per-track routing of the MC-707's USB channels, and feeding recorders. Used by Record audio and the sample grabber. | AUD (audio settings), AUDREC (audio recording) |
| `services/audio-files.js` | Audio file writers: WAV and MP3 encoders and a zip writer for several files. |  |
| `services/clip-switch.js` | Switching MC-707 clips with program changes: the clip map, automatic switching by kind of part, and Song Mode clip-change flags played back at their bars. | PCLAST (last clip sent per track), CLIPPIN (clips held by flags or scenes), CMK (clip-flag playback) |
| `services/humanize.js` | Humanize for Live Mode: makes the band sound played. Not random jitter but the habits of real players, scaled by one amount (0 = machine-tight, exactly as before): timing each instrument sits in its own place against the beat (snare laid back, hats riding the front, keys behind, a lead that floats), a slow drift per player so the groove breathes, the bass locked to wherever the kick landed, and the whole band moving together dynamics downbeats and the backbeat lean in, hat strokes alternate hands, ghost notes stay low, and every four bars the players lean into the turnaround chords strummed or rolled instead of struck as one block, alternating up and down strokes length notes held a little longer or shorter, like a real hand on the keys flams near the top of the slider the snare sometimes gets a grace note All drum tracks are one drummer: they drift together, each instrument keeping its own spot. Four feels shape it: Natural, Laid back, Pushed and Drunk (loose and lazy, after J Dilla). Its own seeded random numbers, so the patterns Live Mode picks never change. | HUM (amount 0-100, feel and the mood's push, set by Live Mode) |
| `services/mc-controls.js` | MC-707 control automation during playback: CC curves, clip fades and velocity shapes, the tempo map, and sending each track's CC settings. | AUTOLAST (last CC values sent) |
| `services/midi.js` | Web MIDI: the output and input ports, sending messages, and panic (all notes off). | MIDI (MIDI ports), MIDI_ACT (the last note sent on each channel, for activity lights) |
| `services/mixer-strip.js` | One channel strip for the mixers (Song Mode's and Live Mode's): the track's number, name and colour, an activity light that flickers with the notes going out, the track's four knobs (FILTER, MOD and FX above each MC-707 fader, and SOUND, the C4 knob KNOB ASSIGN lists with them), a tall level fader, pan, reverb and chorus sends, and mute and solo buttons. Double-click a control to put it back. The strip only draws and reports: the mixer that owns it decides what a change means and sends it. |  |
| `services/popout.js` | Tool windows that can live on another screen (the mixers): a real window of its own when the browser or the Windows app allows one, which you drag anywhere, even onto a second monitor; else a panel over the app that you drag by its title bar. The window keeps its place and size for next time. The caller draws into the window's root with the usual helpers (nodes move into the window's page as they are added, their handlers still run here). Keys pressed in the window reach the app, so Space still starts and stops. In the Windows app the window is borderless: the tool's own header is where you drag it, with pin (stay on top), minimise and close buttons (h.winBtns()). | localStorage 'mc707-popout-<id>' (where each window was, and whether it stays on top) |
| `services/synth.js` | The preview sound: a small Web Audio synth and drum kit, so the app makes sound without the MC-707. | AU (the audio context) |
| `services/transport.js` | The clock and playback: the tick scheduler (in a Worker so it keeps time in the background), playing the song, a single pattern or the wizard preview, sending notes, and the MIDI recording state REC. | TR (the transport), REC (MIDI recording) |

### clips/ (layer: clips)

| Module | What it does | Owns |
| --- | --- | --- |
| `clips/clip-map.js` | Clip chips and clip-change flags in the screens: showing which clip each track is on, and the menu to pick one. |  |
| `clips/clips-screen.js` | The "Your MC-707 clips" screen, laid out like the MC-707's display and pads: set how many clips each track has and what each holds. | CMAP (the clips screen) |

### song/ (layer: features)

| Module | What it does | Owns |
| --- | --- | --- |
| `song/arrangement-input.js` | Mouse and touch on the arrangement: dragging, resizing and copying clips, the loop range on the ruler, and dropping patterns onto lanes. |  |
| `song/arrangement-menus.js` | Right-click menus in the arrangement: on clips, lanes, the ruler, track headers and library items. |  |
| `song/arrangement.js` | The Song Mode arrangement: tracks, clips, the ruler and markers, clip-change flags, zoom, and placing patterns. | DRAG (library drag), bw (bar width), ROWH (row height) |
| `song/audio-check.js` | The checks in the Audio dialog: which input is which, level meters, and a test that plays a note on each MC-707 track to find its USB channel. |  |
| `song/audio-dialog.js` | The Audio dialog: choose 2-channel or 8-channel recording, inputs, format and range, and start recording. |  |
| `song/audio-record.js` | Recording the song to audio: works out what to record (mix, stems, Ext In), plays the song and writes each pass to WAV or MP3. |  |
| `song/audio-save.js` | Saving recordings: through the Windows app, the claude.ai page, or a browser download. |  |
| `song/clip-change.js` | Inserting MC-707 clip changes quickly: at the playhead (K, or the toolbar button), by Alt+click on a lane, flipping straight back to the clip before (Shift+K), and switching back and forth between two clips every few bars. |  |
| `song/clip-ops.js` | Things you do to clips: split, edit one repeat on its own, glue, copy, make unique, set length and transpose, plus the playhead and loop controls. | CLIPB (the clip clipboard) |
| `song/clip-options.js` | The Clip options panel: fine position, length, transpose, velocity, fades and the MC-707 clip to launch. |  |
| `song/editor-head.js` | The pattern editor's toolbar: name, length, key, steps or piano roll, the tools, and which bars are being edited. |  |
| `song/editor-menus.js` | Right-click menus inside the pattern editor (notes, rows, velocity), and the arrangement's context-menu wiring. |  |
| `song/editor-tools.js` | Pattern tools: chord shapes, diatonic chords, euclidean rhythms and scale lock. |  |
| `song/editor.js` | The pattern editor: the step grid and piano roll, drawing notes, velocity lane, and the editor playhead. |  |
| `song/export.js` | MIDI export: builds a .mid with every track (and one per track) and saves it, in a zip when there are several files. |  |
| `song/import.js` | Bringing patterns in: MIDI file import with a review step, and new or blank patterns. |  |
| `song/layout.js` | Arrangement layout: snap, row heights that fit the window, the splitter between arrangement and editor, and clip geometry. |  |
| `song/lib-view.js` | A library pattern open in the pattern editor without placing it: click a pattern in the library to see and edit it, then place it at the playhead. Also saves patterns to My patterns. | UI.view (opened and closed here; core/song-model.js keeps the edited copy on the first edit) |
| `song/library-panel.js` | The pattern library panel: search and filters, favourites, previewing a pattern (on the track that suits it), and adding it to the song. | FAVS (favourite patterns) |
| `song/markers.js` | Section markers: add, rename, loop a section, tempo and MC-707 scene changes per section. |  |
| `song/recording-midi.js` | Recording notes into a pattern from a MIDI keyboard, the MC-707 pads or the computer keyboard. |  |
| `song/shape-editor.js` | The Shape editor: fades, velocity shapes and CC automation drawn over a clip, and the overlays that show them on clips. | SH (the shape editor) |
| `song/song-mixer.js` | Song Mode's mixer: a strip per MC-707 track with level, pan, reverb and chorus (MIDI CC 7, 10, 91 and 92, sent to the MC-707 as you move them and again whenever the song starts), the track's FILTER, MOD, FX and SOUND knobs (CC 80-83: sent once you move them, then at every start), the track's note velocity, and mute and solo. It is the song's own mix: saved with the song (the track MIDI controls), with undo. It opens in a window of its own that can sit on another screen (services/popout.js). |  |
| `song/sound-suggestions.js` | Suggested MC-707 factory sounds for each style's tracks, shown by the song wizard. |  |
| `song/structure.js` | Song structure tools for a bar range: copy, paste, repeat, insert and delete bars. |  |
| `song/track-midi.js` | Per-track MIDI controls: the CC settings sent to each MC-707 track (filter, reverb and so on) and their dialog. |  |
| `song/transpose.js` | The Transpose dialog: transpose the whole song, a section, a range or chosen tracks, with key changes. |  |
| `song/wizard-plan.js` | The song wizard's plan and preview: what plays in each section, previews, and writing the finished plan into the song. |  |
| `song/wizard-review.js` | The song wizard's last step: review and create the song. |  |
| `song/wizard-structure.js` | The song wizard's structure step: sections, lengths, complexity and key changes. |  |
| `song/wizard-styles.js` | The song wizard's choices: picking a style, its default sections and the patterns that fill them. |  |
| `song/wizard-ui.js` | The song wizard's window and its first two steps (style and sound). | WIZ (the song wizard) |

### live/ (layer: features)

| Module | What it does | Owns |
| --- | --- | --- |
| `live/breaks.js` | Live Mode breaks and flashes: the top-right Break pad (hits, stutter, roll, drop-out) and the quick flash breaks auto-pilot adds. |  |
| `live/controller-settings.js` | The controller keyboard settings: input, model, layout, solo track and learning knobs, faders and pads. |  |
| `live/controller.js` | USB controller keyboards in Live Mode: the model presets, keyboard zones (mutes, key, solo), learned controls and the solo voice. | CTL (the controller keyboard) |
| `live/cues.js` | Live Mode cues: everything that waits for the next beat, bar or phrase (scene changes, swaps, mutes, key changes, energy) and the Variation engine. |  |
| `live/engine.js` | The Live Mode engine: the voices playing on each track, what plays on every tick, scene changes, swaps, and start and stop. |  |
| `live/extreme.js` | Hi-hat rolls for the trap family (trap, drill, phonk, Memphis), at any Variation level, and Extreme variation (Variation above 100): every repeat of a loop changes, with snare rolls and kick drop-outs on the kit and octave flicks on the 808. |  |
| `live/fades.js` | Smooth fades for Live Mode: a part fading in or out also ramps its MC-707 track's expression (CC 11), so held notes fade too instead of playing on at full level and stopping. After a fade-out the notes still held are released and the level goes back, ready for the next part on that track. | LV.fadeEnds (pending ends of fade-outs), LV.low (tracks whose level is turned down) |
| `live/genre-picker.js` | The genre picker: when Live Mode opens (and nothing is playing) it asks which style to jam in, grouped by family, with the current set one click away. Picking a style builds a fresh set. | localStorage 'mc707-live-pick' ('0' = do not ask when Live Mode opens) |
| `live/harmony.js` | Keeping a Live set in tune with itself: the chord progression that is playing now, which patterns fit it when parts swap or a guest melody comes in, and where a new part should start so it lines up with the progression already playing. |  |
| `live/humanize-ui.js` | The Humanize control for Live Mode (next to Swing): an amount from Off to Loose and a feel (Natural, Laid back, Pushed, Drunk). The playing itself is in services/humanize.js. |  |
| `live/jam.js` | Start Jam and End Jam. A jam opens with a few 2-bar intro loops that build into the first scene (parts arrive one group at a time, the filter opens, the last loop rolls and rises into the drop) and closes with a quick 1-2 bar outro that winds the scene down to a final hit. The loops are made from the set's own patterns, so they suit every genre and lead straight into (or out of) the music, and the recipe is picked at random each time. | LV.jam (the intro or outro in progress) |
| `live/lanes.js` | The Live Mode timeline: lanes showing what each track plays, the status panel and the per-frame update. |  |
| `live/live-mixer.js` | Live Mode's mixer: a strip per MC-707 track with Live's own level, pan, reverb and chorus and the track's FILTER, MOD, FX and SOUND knobs (live/mix.js, kept apart from the song's mix and saved with Live's settings), and mute and solo that wait for the next beat while the jam plays, like the controller's mutes. It shows what the set is doing too: the notes going out, a track the energy level has taken out, one you are playing yourself, and a level a controller fader or a move has moved. It opens in a window that can sit on another screen. |  |
| `live/midi-in.js` | MIDI input in Live Mode: the MC-707 pads and keys (Raven keys), the pad test, and the computer keyboard. |  |
| `live/mix.js` | Live Mode's own mix: level, pan, reverb and chorus for each MC-707 track (CC 7, 10, 91 and 92), and the track's FILTER, MOD, FX and SOUND knobs (CC 80-83; until set, a track's knob rests where Live's knob panel has it, the same for every track), kept apart from the song's. These are the values the tracks rest at in Live Mode: moves and knobs that sweep one of them come back to it, and Start sends them all. The Live mixer window (live-mixer.js) sets them. |  |
| `live/mood-move.js` | The mood change while playing: one bar from the next bar line into the new set. Intense moods roll the snare, open the filter all the way and cut to an eighth of silence before the new set slams in on a crash; calm moods let the beat drop out, close the filter and wash the reverb up, then the new set glides in. Short and on the bar, so it never stalls the music. |  |
| `live/mood-ui.js` | The Mood control for Live Mode (next to Humanize): a menu of moods (Angry, Dark, Driving, Euphoric, Uplifting, Chill, Dreamy, Melancholy) and a small pad to drag between them, calm to intense across and dark to bright up. A mood leans the set towards patterns that feel that way inside the genre (library/mood.js), makes the band play harder and shorter or softer and longer (services/humanize.js), and sets the tempo, feel, chaos and how parts come in and drops land. While playing, the new set comes in over one bar (live/mood-move.js). Off leaves everything as it was. |  |
| `live/moves.js` | Live Mode moves: MC-707 knob automation over time (filter, resonance, reverb wash, pump, autopan) for builds, drops and scene moves. |  |
| `live/pads.js` | The 16 Live pads: press and release, knobs and scatter sent to the MC-707. |  |
| `live/panels.js` | The Live page panels: scene cards, pads, keys and mutes, knobs, and keeping the toolbar in step. |  |
| `live/raven.js` | Raven mode: the mute and key keys on the MC-707 and a controller keyboard, the presets and their settings area. |  |
| `live/resync.js` | Bringing a Live set back in line after the MIDI connection drops and returns (a USB hiccup): the MC-707 may have missed clip changes, effect moves and level fades, so everything is sent again. |  |
| `live/scene-editor.js` | Editing Live scenes: parts, when each plays, its MC-707 clip, and saving custom scenes. |  |
| `live/scene-templates.js` | The Live scene templates (Groove, Lift, Peak …) and the play patterns that let parts come and go. |  |
| `live/set-builder.js` | Builds a Live set: picks matching patterns for each scene from the style's pools, every tone part on the chords' progression and the lead and pluck kept out of each other's way. |  |
| `live/settings-panel.js` | The Live Mapping panel: pad layout and actions, Raven mode, knob rest values and the controller keyboard. |  |
| `live/state.js` | Live Mode's state LV (style, key, tempo, scenes, pads, settings) and saving it. | LV (Live Mode state) |
| `live/themes.js` | Live Mode colour themes, scene colours and small shared helpers (action labels and colours, track groups). |  |
| `live/ui.js` | Builds the Live Mode page and its toolbar, and the timeline maths it uses. |  |
| `live/visualizer.js` | The Live Mode visualizer behind the Now Playing panel. | VZ (the visualizer) |

### zen/ (layer: features)

| Module | What it does | Owns |
| --- | --- | --- |
| `zen/zc-actions.js` | The ZenCore editor's header: which track and clip it edits, and the actions (read from the MC-707, send all, starters, the Sound browser, save and open files, copy a partial, copy the sound to another clip). |  |
| `zen/zc-browse-data.js` | What the Sound browser lists, the ZENOLOGY way: banks down the left (your sounds, the MC-707's, the factory banks, the starters), ZenCore categories in groups in the middle, and a table that sorts by bank and number, name, category or rating. Pure functions over the entries; the browser draws them. |  |
| `zen/zc-browser-table.js` | The Sound browser's table: one row per sound with its rating (three stars), bank, number, name, category and tags, a ▶ to load and play it, and a ⋯ menu. Headers sort (click again to reverse). Rows are drawn in batches as the list scrolls, so the factory banks (thousands of tones) stay quick. ↑ and ↓ move through the list and load each sound, as on ZENOLOGY. Ctrl-click and Shift-click pick several (act.click decides; the picked ones are act.sel). |  |
| `zen/zc-browser.js` | The ZenCore editor's Sound browser, laid out like ZENOLOGY's: banks on the left (your sounds, the MC-707's, the factory banks from its update file, the starters), categories in groups in the middle, and a sortable table of sounds with star ratings (zc-browser-table.js; what shows is zc-browse-data.js). Click a sound to load it into the clip being edited (and hear it, with Live on); ↑ ↓ step through; hold ▶ to play a note. Grab reads the clips on the MC-707 (one, a track's 16 or every track's) and keeps each sound found. Backup exports and imports your library (not the factory tones). Your own folders sit under My sounds; Ctrl- or Shift-click picks several sounds to tag, give a category, copy or move into a folder, or delete. Tags filter from the middle column. |  |
| `zen/zc-data.js` | ZEN-Core parameter tables for the MC-707 and MC-101: every tone and drum kit parameter with its offset in the SysEx block (linear bytes), size on the wire, range, initial value and value names. |  |
| `zen/zc-editor.js` | The ZenCore editor: opens on one MC-707 clip's tone (or a drum track's kit), reads it from the MC-707, sends every change as you make it, and keeps undo, partial linking and the last state of each clip. The pages are in zc-panels.js and zc-pages-fx.js, the header actions in zc-actions.js. | ZE (the open editor) |
| `zen/zc-env.js` | Envelope and LFO step graphs for the ZenCore editor: drag a point to change its time (sideways) and level (up and down), drag a bar to change an LFO step. |  |
| `zen/zc-factory-ui.js` | The Sound browser's factory tone items: add the MC-707's preset tones from its system update file (read here on your computer, see zc-factory.js), or take them out of the library again. |  |
| `zen/zc-factory.js` | Factory tones from the MC-707's own system update file (MC707_UPA_up.bin, from Roland's support page). The file holds every preset tone as a 1632-byte record; this reads them on your computer and turns each into a ZenCore tone the editor can load and send. Nothing from the file is kept in the app or sent anywhere: only the tones you import go into this browser's Sound library. |  |
| `zen/zc-grab.js` | Grabbing sounds from the MC-707's clips into the Sound library: one clip, a track's 16, or every clip of every track. Each sound read is kept unless it is empty (the initial sound) or already there. |  |
| `zen/zc-library.js` | The last edit of each MC-707 clip, so the ZenCore editor reopens where you left it. Kept in this browser (or the Windows app) under its own key. Saved sounds moved to the Sound library (zc-sounds.js), which takes the older My sounds list ('lib' here) in on first use. | ZLIB (the clip memory) |
| `zen/zc-mfx-data.js` | The 91 MFX types of the MC-707 (firmware 1.80+) and each type's parameters, in the order they fill the 32 MFX parameter slots. Taken from the MC-707 Reference Manual's MFX Parameters chapter. |  |
| `zen/zc-mfx-presets.js` | Ready-made settings for the most-used MFX types (dotted delay, dub echo, Juno chorus, Leslie, gates, filter wobbles, lo-fi and drive). Each preset names its type and the parameters it changes, by the names in zc-mfx-data.js and in shown units (list entries by their text); the rest keep the type's starting values. |  |
| `zen/zc-mfx.js` | MFX types for the editor: the parameters a type puts in the 32 MFX slots, and how a slot's stored value (-20000 to +20000) turns into what you see (list entries from 0, whole numbers as they are, decimals scaled: 0.05-10.00 Hz is stored as 5-1000). |  |
| `zen/zc-motion.js` | A clip's motion: the knob moves the MC-707 records into a clip and plays back with it. Each clip has 8 lanes (the track's FILTER, MOD, FX and SOUND (C4) knobs, as KNOB ASSIGN sets them, then four more), and each step of a lane holds 8 values (0-127, or none: no change), two half-bytes each, at the clip's descriptor + 04 00 00 + step × 01 00 + lane × 10. Found by Ada Locriana (github.com/Locriana/mctools_sidechain, MIT licence), whose sidechain tool writes a volume dip there on every kick. |  |
| `zen/zc-pages-fx.js` | The MFX page (a tone's or a kit's multi-effect, with each type's own parameters) and the drum kit pages: the kit, each key's instrument, and the six drum compressors. |  |
| `zen/zc-panels.js` | The pages of the tone editor: Common, Oscillator, Filter, Amp, Pitch, LFO, Matrix, Partials and EQ. Each page shows the partial chosen in the editor (ctx.part, 0-3). |  |
| `zen/zc-partbar.js` | The partial bar above the partial pages: pick the partial you see (1-4), switch any partial on or off in one click (to hear one partial alone, or what a layer adds), and link any of them so a change to one linked partial goes to every linked partial (link 1 and 3 to edit both, all four to edit the whole tone). |  |
| `zen/zc-preview.js` | Live previews for the ZenCore editor: the oscillator's wave, the filter's response curve and an LFO's shape over a few cycles. They are drawn from the settings (the MC-707 does not send audio back), redraw as a slider moves, and are approximate: they show the shape, not exact levels. |  |
| `zen/zc-scan.js` | Scene finder: a read-only scan of the MC-707's memory, to find where scenes and the scene chain are kept (not documented; Roland's MV-1 database has 8 scenes of 8 clip numbers in its project block, the MC-707 has 128 since version 1.50 and a scene chain since 1.71). Scan, change one thing on the MC-707, scan again: the bytes that changed are listed, to copy into a report. | the scans of this session (kept in memory) |
| `zen/zc-scenes.js` | MC-707 scenes and the scene chain, so a song plays on the MC-707 by itself (found with the scene finder, zc-scan.js, on an MC-707 with system 1.71 or later): which clip track t plays in scene s (0-127): the track's settings + 3E + s, clip 1-16 (0 = none) how many bars scene s plays before the chain moves on: 10 00 00 4C + s (0 = OFF: it stays) The chain plays scenes in order and stops moving at a scene whose LENGTH is OFF. Its CHAIN switch is not mapped yet, so it is turned on on the MC-707. | nothing (the song is S; the clip each pattern goes to comes from zc-seq.js's songPlan) |
| `zen/zc-seq.js` | The notes in the MC-707's clips (its sequencer), read over SysEx. Roland never documented this; the layout is Ada Locriana's (github.com/Locriana/mctools_seq, MIT licence), found on an MC-707: |  |
| `zen/zc-sounds.js` | The sound library behind the ZenCore editor's Sound browser: tones and kits you save or grab from the MC-707, each with a name, an instrument type, genre tags and a favourite star. Kept in this browser's IndexedDB (room for thousands; only the values that differ from Roland's initial sound are stored), with a backup file to export and import. The older My sounds list moves in on first use. |  |
| `zen/zc-starters-more.js` | More starter tones: step sequences (a riff from one held key, after Benedetto Schiavone's STEP LFO template), FM-style sounds from cross modulation, and extra basses. STARTER_MENU sorts every starter into the Starters menu's groups. |  |
| `zen/zc-starters.js` | Starter tones for the ZenCore editor: a clean init, then classic shapes built on the VA oscillators (leads, basses, pads, keys, stabs, a kick). More starters (step sequences, FM-style and extra basses) are in zc-starters-more.js; STARTER_GROUPS puts them all in the Starters menu's submenus. |  |
| `zen/zc-stepseq.js` | The step sequencer inside a tone: each partial's STEP LFO 1 plays a 16-step note pattern (pitch depth 63, so 4 step units are one semitone) and STEP LFO 2 shapes each step on the amp (-72 rests a step). Tempo-synced, so one held key plays a riff; four partials give four voices. The idea and the numbers come from Benedetto Schiavone's ZEN-Core editor manual. |  |
| `zen/zc-synth-io.js` | Synth mode's state and what it does on the MC-707: which sound each track plays (a clip or the track's own sound), the mix (level, pan, reverb send, mute and solo), reading the sounds' names, setups (all eight sounds with the mix, in a file or kept in this browser) and passing a DAW's or keyboard's notes through to the MC-707, on their own channels or all to one track. | SY (Synth mode's settings, localStorage 'mc707-synth'), the saved setups ('mc707-synth-setups') |
| `zen/zc-synth-quick.js` | Quick sound controls on a Synth Mode strip: pick a page (Tone, Filter, Envelope, Movement, Effect) and change the most used ZenCore settings right there, without opening the editor. Only that page's values are read from the MC-707, and each change goes straight back. Settings that live in each of the four partials (filter, envelope, LFO) move together: the slider shows the first playing partial and every playing partial shifts by the same amount, so a layered sound keeps its shape. | QS (each track's quick values, read from the MC-707) |
| `zen/zc-synth-strip.js` | One Synth mode strip: a track's sound (name, which clip or the track's own sound, the Sound browser and the ZenCore editor), a note to try it, an activity light for notes passed through, mute, solo, and level, pan and reverb send. Clicking the strip's name sends the keyboard there (when one track plays everything). |  |
| `zen/zc-synth.js` | Synth mode: the MC-707 as an 8-track hardware synth for a DAW. The DAW plays each track on its MIDI channel and records each track's audio over USB (the MC-707 sends the eight tracks separately), while this screen picks, edits and mixes the eight sounds: the Sound browser and ZenCore editor for each track, which sound it plays (a clip or the track's own), level and pan, a setup file with all eight sounds, and notes passed through from a DAW's virtual port or a keyboard. The app's own sequencer stays quiet here. |  |
| `zen/zc-sysex.js` | Talking to the MC-707 (or MC-101) with Roland SysEx, for the ZenCore editor: where each clip's tone and drum kit lives, writing parameters (DT1) and reading them back (RQ1). |  |
| `zen/zc-tone.js` | The ZenCore sound being edited: a tone (4 partials) or a drum kit (88 keys), as a flat map of parameter values, and how each value goes to and from the MC-707 (addresses, bytes, whole-sound reads and writes). |  |
| `zen/zc-widgets.js` | Controls for the ZenCore editor: a slider, menu or switch for one parameter, with friendly names, value text (pan, dB, notes, value names) and the "not read from the MC-707" state. |  |

### scene/ (layer: app)

| Module | What it does | Owns |
| --- | --- | --- |
| `scene/board.js` | Scene Mode's clips board: each track's 16 MC-707 clips in a row, as the MC-707's CLIP pads hold them. A clip shows its pattern, its tone, and whether it is written to the MC-707 (✓), changed since (●) or new (+); the clips the selected scene plays are outlined, clips no scene plays are faded, and a ring marks a clip that holds notes on the MC-707 (from Check). Click an empty clip to fill it, a full one to edit it; right-click for its menu; each track can write its clips. |  |
| `scene/chain.js` | Scene Mode's scene chain: the scenes in the order the MC-707's scene chain plays them, each with its MC-707 number, a name, its length in bars, a chip per track for the clip it plays (click to choose), whether it is written (✓), changed (●) or new (+), and Write. The selected scene's clips are outlined on the board; the playing one lights up. |  |
| `scene/check.js` | Checking the MC-707's clips before writing (read-only): which of the clips Scene Mode is about to write already hold notes there (writing replaces them), or every clip of one track, to see which are free. The board shows what was found. | CK (what the last check found) |
| `scene/convert.js` | Between Song Mode and Scene Mode: make clips and scenes from the song (each track's different patterns become its clips in the order they first play, and a scene starts wherever the patterns playing change, named after the song's markers), and lay the scenes out as the song (a clip per run of the same clip, a marker per scene). |  |
| `scene/dock.js` | Scene Mode's clip editor, under the board: Notes is Song Mode's own pattern editor (steps, piano roll, velocity, length and its tools), Sound the ZenCore editor with its Sound browser (sound-tab.js), both for the selected clip. Above it, the clip's own controls: which clip, the clip before or after, the pattern, tone and transpose, the scenes that play it, an own copy of a pattern other clips share, write it, expand (the editor takes the board's room, keeping the track's row) and close. |  |
| `scene/guide.js` | Scene Mode's guide: what to do, in order, so the MC-707 plays the scenes by itself with no computer (the app's part and the MC-707's part), with how far this song has got. |  |
| `scene/menus.js` | Scene Mode's menus and the actions behind them: a clip's menu (edit, pattern, tone, transpose, play it, which scenes play it, write it, copy, paste, move, clear, its notes and sound on the MC-707), a scene's menu (play, loop, write, add, copy, move, remove), a scene's track chip (which clip it plays), a track's menu (write and check its clips), and the keys Scene Mode answers. |  |
| `scene/model.js` | Scene Mode's edits to the song's scenes (S.scn, see core/scene-model.js): fill, change, copy and clear the clips on the board; add, copy, move and remove scenes, their names and lengths, and the clip each track plays in them; and what is selected. Every change is one undo step and is saved with the song. | SC (the selected clip and scene, the copied clip, the editor's state, what redraws) |
| `scene/names.js` | How Scene Mode names an MC-707 scene: the row's place from the first scene, as the MC-707 shows it with Call Scene TYPE2 (8 banks of 16: 1-1 … 8-16). |  |
| `scene/pick-pattern.js` | Scene Mode's pattern picker: the factory library (by genre and part), My patterns, or the song's own patterns, with a search. ▶ plays a pattern on the track; picking one copies it into the song (once) and puts it in the cell. |  |
| `scene/pick-tone.js` | Scene Mode's tone picker: the sounds in your library (My sounds and your folders, sounds grabbed from the MC-707, the factory tones from its update file once added) and the starters, by bank, category and search. Drum tracks get drum kits. Picking one gives the cell that tone; the MC-707 clip gets it when the scenes are sent. |  |
| `scene/pump.js` | Scene Mode's Pump window for a clip: duck the part on every kick (Volume or Filter), how deep, where it rests, and finely (in eighths of a 16th, with the time in ms at the song's tempo) when it starts, how long it holds and how long it takes to come back, eased or straight, since that timing shapes the groove. Drawn over the whole clip and close up around the first kick, with the kicks it follows. The pump is written into the clip's motion with the clip (write.js), so the MC-707 pumps by itself. |  |
| `scene/screen.js` | Scene Mode: arrange a song the way the MC-707 keeps one. The clips board holds each track's 16 clips (pattern and tone); the scene chain down the left lists the scenes in the order the MC-707's scene chain plays them, each choosing a clip per track and lasting so many bars. The editor for the selected clip (notes or sound) sits under the board. Every clip and scene shows whether it is written to the MC-707; the toolbar walks through the four steps (clips, scenes, write, on the MC-707). |  |
| `scene/sound-tab.js` | Scene Mode's Sound tab: the full ZenCore editor, with its Sound browser (your library, the factory tones from your update file, the starters, grabbing from the MC-707), docked for the selected MC-707 clip. It opens on the clip's tone (and puts it on the clip) or on what the clip holds there; changes go to the MC-707 as you make them and are kept as the clip's tone when you leave the tab, the clip or the editor. |  |
| `scene/top.js` | Scene Mode's toolbar: play and stop with where it is, the tempo, the four steps of the job with how far each has got (1 Clips, 2 Scenes, 3 Write, 4 On the MC-707), whether the MC-707 is connected, and Write with its choices (what to write, Auto-write and the write settings). |  |
| `scene/write.js` | Scene Mode's writing to the MC-707: one clip (its notes, and its tone with the track set to play its clips' sounds), a track's clips, one scene (its clips first, when they are not written yet), every change, or everything; the project tempo; and Auto-write, which writes what changed a moment after a change. What was written is marked (model.js), so each clip and scene shows written, changed or new. | WO (the write settings, localStorage 'mc707-scene-write') |

### ui/ (layer: app)

| Module | What it does | Owns |
| --- | --- | --- |
| `ui/about.js` | Help › About: the app's name and version, what it is, the licence and the people whose work it builds on, which device it is set for and whether it can reach it, and links to the guide, releases and problem reports. |  |
| `ui/context-menus.js` | Right-click menus for the transport, Play pattern, the sample grabber and the clips screen, and the one listener that opens them. |  |
| `ui/controls.js` | The Song Mode toolbar and keyboard shortcuts, and redrawing everything after big changes (renderAll). |  |
| `ui/device.js` | Switching between MC-707 and MC-101 and the one-kit drums option, which rebuild Song and Live. |  |
| `ui/dialogs.js` | A simple ask dialog (OK / Cancel, or a text box). |  |
| `ui/fill-tones.js` | Fill tones: give the MC-707's clips their sounds in one go. Pick a genre and every clip set up on the Your MC-707 clips screen gets a suggested tone for its job (bass, chords, pad, lead, pluck, acid, FX; a kit for drum clips when the pool has one), different ones across a track's clips. Change any of them (from the pool, a shuffle, or any sound in the library), then send them all: each goes into its MC-707 clip and the track plays its clips' own sounds (Sound Source CLIP). |  |
| `ui/fullscreen.js` | Fullscreen (the Windows app or the browser) and keeping the screen awake while playing. | STAGE (fullscreen and wake lock) |
| `ui/grab-pattern.js` | Record sample from the pattern editor: play one pattern on its own, through the track you choose, and record it to a WAV with the sample grabber (that track's own USB channel when Audio has per-track channels set up, otherwise the mix). |  |
| `ui/grabber.js` | The sample grabber: record a few bars of one track or the mix to a WAV, lined up on the bar, from Song or Live Mode. | GRAB (the sample grabber) |
| `ui/hover-help.js` | Hover help for controls that don't explain themselves: a tooltip (title) for each, by selector, and optionally only when the control's text matches. Applied as the screens are drawn (a watcher on the page, at most once a second), and never over a tooltip a control already has. |  |
| `ui/link-watch.js` | The connection watch: a banner when the MC-707 (or MC-101) drops off MIDI mid-set, and a clean return when it comes back: notes released, then the playing set or song sent again, in time. |  |
| `ui/live-capture.js` | Capture to Song: turns what was played in Live Mode into an arrangement, markers and clip changes. |  |
| `ui/live-menus.js` | Right-click menus in Live Mode: scene cards, pads, tracks and keys. |  |
| `ui/menu.js` | The right-click menu itself: showMenu() and closeMenu(). Menus pass a list of items. | CM (the open menu) |
| `ui/menubar.js` | The top menu bar (File, Edit, Song, Scene, Live, Synth, Settings, View, Help, each shown in the modes it belongs to), and wiring the setup wizard's buttons. |  |
| `ui/mode.js` | Switching between Song Mode, Scene Mode, Live Mode and Synth mode. |  |
| `ui/mpj-open.js` | Open an MC-707 project file (.mpj, copied off the SD card in storage mode) and see what is in it: its name and tempo, each track's kind and sound name, the clips with notes, and the samples it holds. Bring the clips into Scene Mode's board (as patterns), add them to My patterns, and play or save the samples as WAV files. Read only: the file is never changed. The format is in core/mpj.js. |  |
| `ui/projects.js` | Project files: new, open, save, recent projects and the project title, through the Windows app or the browser. |  |
| `ui/saved-songs.js` | Saved song slots in the browser, and the extra settings panel (MIDI input list, recording keys, transpose). |  |
| `ui/setup-wizard.js` | The MC-707 setup wizard: connect MIDI, test notes on each channel, and check the clock and audio. | SU (the setup wizard) |
| `ui/start-screen.js` | The start screen: when the app opens (in Song Mode) it offers to load the last session, start a blank song or an empty template with its sections marked, open the song wizard, go to Scene, Live or Synth Mode, or open the ZenCore editor. A tick box turns it off. | localStorage 'mc707-start' ('0' = do not show at start) |
| `ui/templates.js` | MC-707 project templates: empty MC-707 projects, one per track layout (8 drum tracks to 8 tone tracks, and EMPTY), made on an MC-707 by the app's author and kept in templates/ in the repository. This window says which one matches the app's Track setup, and how to put them on the MC-707's SD card (storage mode) and start a project from one. |  |
| `ui/track-setup.js` | Track setup: choose what each of the 8 tracks is for, anywhere from 8 drum tracks to 8 tone tracks. Each track gets a role (kit, hats, perc, bass, chords, pad, lead, pluck or acid); the role sets whether it is a drum or tone track, what the song wizard and Live Mode play on it, and its name. Clips that no longer fit a track's type are removed (with undo). |  |
| `ui/transport-view.js` | The transport display: position, play state, and moving the playhead in Song Mode, the editor and the wizard. |  |

### main.js (layer: app)

| Module | What it does | Owns |
| --- | --- | --- |
| `main.js` | Start-up. Imports every module in a fixed order (the pattern library depends on it), fills in core/hooks.js, then starts the app: loads the saved song, builds the screens and starts the clock. |  |

<!-- module-map:end -->
