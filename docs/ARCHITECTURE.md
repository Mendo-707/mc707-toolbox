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
            device switch, Live menus) and main.js        ties Song and Live together
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
| `core/random.js` | Seeded random numbers (mulberry32) and a string hash, so generated patterns come out the same every run. |  |
| `core/rolls.js` | Hi-hat and snare roll shapes (16th triplets, 32nds, 64th ramps …) as note positions inside one beat, and a parser for beat-by-beat hat lines like '8 8 t16 32'. Used by the genre pack and by Live Mode's Extreme variation. |  |
| `core/song-model.js` | Reading and editing the song's clips: find the clip at a bar, cut a gap into a track, place a clip, the song's length, and clip arithmetic (loop length, 16th-step rounding). |  |
| `core/state.js` | The song (S) and everything that saves it: a new song, autosave to localStorage, undo and redo, loading and checking saved songs (fixState), plus the shared screen state UI and the editor state ED. | S (the song), UI (song screen state), ED (editor state), PROJ (the open project) |
| `core/theory.js` | Music theory tables: note names, the drum lanes, keys and scales. |  |
| `core/tracks.js` | The track setup: what each of the 8 tracks is for. A track's role (kit, hats, perc, bass, chords, pad, lead, pluck or acid) decides whether it is a drum or tone track and which patterns it draws. The default is the classic layout: three drum tracks, then bass, chords, pad, lead and pluck. |  |
| `core/types.js` | The shapes of the app's main data, as JSDoc types. Nothing imports this file at run time; editors and agents read it, and other files refer to these types in their JSDoc (e.g. @param {Clip} c). |  |

### library/ (layer: library)

| Module | What it does | Owns |
| --- | --- | --- |
| `library/acid.js` | Acid lines: TB-303 style 16th-note basslines with accents, slides (overlapping notes, so the MC-707 glides with portamento on) and octave jumps, in each genre's keys, for techno, house, trance, electro and breaks, and drum and bass. They go in their own 'acid' pool and show in the library as Acid lines. Give a clip the Acid kind on the clips screen and Live Mode plays them on it (in the B scenes and from the scene editor); acid techno's basslines include them too. |  |
| `library/factory.js` | The hand-written factory patterns (drums and tone parts for drum and bass and hip hop). FAC, the list every factory pattern goes into, is created here. | FAC (the pattern library) |
| `library/flash.js` | Flash-break patterns: 1 to 2 bar unison hits for every genre (FLASH_RH lists the rhythms). |  |
| `library/generate.js` | Generates most of the factory library: kits, drum layers, fills, chords, basslines, arps, leads and pads for every genre. Order matters: each pattern's id comes from the order it is made in. |  |
| `library/genre-drums.js` | The genre pack's drums: trap kits in three producer flavours (dark and sparse, bouncy, busy keys), drill, halftime drum and bass, Amen jungle breaks, afrobeats and phonk, with real hi-hat rolls (16th triplets, 32nds, 64th ramps) and the fills to match. Also moves older kits that do not fit out of the trap, drill and halftime pools. |  |
| `library/genre-keys.js` | The genre pack's tone parts for trap and drill: sliding 808s (overlapping notes, so the MC-707 glides with portamento on), dark bells, bouncy plucks, piano chords and piano runs with triplet flourishes, organ and string pads. Every part of a progression shares its name, so Live Mode keeps them together. Other hip hop basslines leave the trap and drill pools, which are 808s only. |  |
| `library/groove-data.js` | The groove pack's material: modal chord progressions (Dorian, Mixolydian, Lydian, Phrygian, harmonic minor, blues), each genre's groovy keys and rhythms for chords, basslines and melodies, and four new drum grooves per genre. library/groove-pack.js turns it into patterns. |  |
| `library/groove-pack.js` | The groove pack: for every genre, chords, basslines, pads, leads and arps on modal progressions (Dorian vamps, Mixolydian and Lydian lifts, Phrygian and harmonic-minor darkness, blues) in each genre's groovy keys and rhythms, plus four new drum grooves per genre. Parts on one progression share its name, so Live Mode keeps them together. |  |
| `library/index.js` | The finished pattern library: the id lookup (facById), the pool each track draws from, and helpers that copy a factory pattern into the song. |  |
| `library/live-extras.js` | Extra patterns for Live Mode: fills, builds and drop impacts for every genre. |  |
| `library/lively.js` | Lively variants: busier, syncopated basslines, arps, chords and leads built on each genre's progressions. |  |
| `library/pools.js` | Which patterns suit a style: pools by genre, sub-style and tempo, full kits for one drum track, and the Lively / Classic flavour filter. Used by Live Mode and the song wizard. |  |
| `library/styles.js` | The song styles (41 of them): tempo, key, structure, parts and tips, used by the song wizard and Live Mode. |  |
| `library/user-lib.js` | My patterns: patterns you save from the editor into your own library. Kept in this browser (or the Windows app) under one localStorage key, apart from songs, so they are there in every song. | the My patterns list (read it with userLib()) |
| `library/variety.js` | The variety pack: 38 extra progressions with voice-led chords, chord-aware basslines, pads and arps for every genre. |  |

### services/ (layer: services)

| Module | What it does | Owns |
| --- | --- | --- |
| `services/audio-capture.js` | Audio input: the audio settings (AUD), opening inputs, per-track routing of the MC-707's USB channels, and feeding recorders. Used by Record audio and the sample grabber. | AUD (audio settings), AUDREC (audio recording) |
| `services/audio-files.js` | Audio file writers: WAV and MP3 encoders and a zip writer for several files. |  |
| `services/clip-switch.js` | Switching MC-707 clips with program changes: the clip map, automatic switching by kind of part, and Song Mode clip-change flags played back at their bars. | PCLAST (last clip sent per track), CLIPPIN (clips held by flags or scenes), CMK (clip-flag playback) |
| `services/mc-controls.js` | MC-707 control automation during playback: CC curves, clip fades and velocity shapes, the tempo map, and sending each track's CC settings. | AUTOLAST (last CC values sent) |
| `services/midi.js` | Web MIDI: the output and input ports, sending messages, and panic (all notes off). | MIDI (MIDI ports) |
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
| `live/genre-picker.js` | The genre picker: when Live Mode opens (and nothing is playing) it asks which style to jam in, grouped by family, with the current set one click away. Picking a style builds a fresh set. | localStorage 'mc707-live-pick' ('0' = do not ask when Live Mode opens) |
| `live/harmony.js` | Keeping a Live set in tune with itself: the chord progression that is playing now, which patterns fit it when parts swap or a guest melody comes in, and where a new part should start so it lines up with the progression already playing. |  |
| `live/jam.js` | Start Jam and End Jam. A jam opens with a few 2-bar intro loops that build into the first scene (parts arrive one group at a time, the filter opens, the last loop rolls and rises into the drop) and closes with a quick 1-2 bar outro that winds the scene down to a final hit. The loops are made from the set's own patterns, so they suit every genre and lead straight into (or out of) the music, and the recipe is picked at random each time. | LV.jam (the intro or outro in progress) |
| `live/lanes.js` | The Live Mode timeline: lanes showing what each track plays, the status panel and the per-frame update. |  |
| `live/midi-in.js` | MIDI input in Live Mode: the MC-707 pads and keys (Raven keys), the pad test, and the computer keyboard. |  |
| `live/moves.js` | Live Mode moves: MC-707 knob automation over time (filter, resonance, reverb wash, pump, autopan) for builds, drops and scene moves. |  |
| `live/pads.js` | The 16 Live pads: press and release, knobs and scatter sent to the MC-707. |  |
| `live/panels.js` | The Live page panels: scene cards, pads, keys and mutes, knobs, and keeping the toolbar in step. |  |
| `live/raven.js` | Raven mode: the mute and key keys on the MC-707 and a controller keyboard, the presets and their settings area. |  |
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
| `zen/zc-actions.js` | The ZenCore editor's header: which track and clip it edits, and the actions (read from the MC-707, send all, starters, My sounds, save and open files, copy a partial, copy the sound to another clip). |  |
| `zen/zc-data.js` | ZEN-Core parameter tables for the MC-707 and MC-101: every tone and drum kit parameter with its offset in the SysEx block (linear bytes), size on the wire, range, initial value and value names. |  |
| `zen/zc-editor.js` | The ZenCore editor: opens on one MC-707 clip's tone (or a drum track's kit), reads it from the MC-707, sends every change as you make it, and keeps undo, partial linking and the last state of each clip. The pages are in zc-panels.js and zc-pages-fx.js, the header actions in zc-actions.js. | ZE (the open editor) |
| `zen/zc-env.js` | Envelope and LFO step graphs for the ZenCore editor: drag a point to change its time (sideways) and level (up and down), drag a bar to change an LFO step. |  |
| `zen/zc-library.js` | My sounds for the ZenCore editor: tones and kits you save, the last edit of each MC-707 clip, and starter tones to build from. Kept in this browser (or the Windows app) under its own key. | ZLIB (my sounds and the clip memory) |
| `zen/zc-mfx-data.js` | The 91 MFX types of the MC-707 (firmware 1.80+) and each type's parameters, in the order they fill the 32 MFX parameter slots. Taken from the MC-707 Reference Manual's MFX Parameters chapter. |  |
| `zen/zc-mfx.js` | MFX types for the editor: the parameters a type puts in the 32 MFX slots, and how a slot's stored value (-20000 to +20000) turns into what you see (list entries from 0, whole numbers as they are, decimals scaled: 0.05-10.00 Hz is stored as 5-1000). |  |
| `zen/zc-pages-fx.js` | The MFX page (a tone's or a kit's multi-effect, with each type's own parameters) and the drum kit pages: the kit, each key's instrument, and the six drum compressors. |  |
| `zen/zc-panels.js` | The pages of the tone editor: Common, Oscillator, Filter, Amp, Pitch, LFO, Matrix, Partials and EQ. Each page shows the partial chosen in the editor (ctx.part, 0-3). |  |
| `zen/zc-sysex.js` | Talking to the MC-707 (or MC-101) with Roland SysEx, for the ZenCore editor: where each clip's tone and drum kit lives, writing parameters (DT1) and reading them back (RQ1). |  |
| `zen/zc-tone.js` | The ZenCore sound being edited: a tone (4 partials) or a drum kit (88 keys), as a flat map of parameter values, and how each value goes to and from the MC-707 (addresses, bytes, whole-sound reads and writes). |  |
| `zen/zc-widgets.js` | Controls for the ZenCore editor: a slider, menu or switch for one parameter, with friendly names, value text (pan, dB, notes, value names) and the "not read from the MC-707" state. |  |

### ui/ (layer: app)

| Module | What it does | Owns |
| --- | --- | --- |
| `ui/context-menus.js` | Right-click menus for the transport, Play pattern, the sample grabber and the clips screen, and the one listener that opens them. |  |
| `ui/controls.js` | The Song Mode toolbar and keyboard shortcuts, and redrawing everything after big changes (renderAll). |  |
| `ui/device.js` | Switching between MC-707 and MC-101 and the one-kit drums option, which rebuild Song and Live. |  |
| `ui/dialogs.js` | A simple ask dialog (OK / Cancel, or a text box). |  |
| `ui/fullscreen.js` | Fullscreen (the Windows app or the browser) and keeping the screen awake while playing. | STAGE (fullscreen and wake lock) |
| `ui/grab-pattern.js` | Record sample from the pattern editor: play one pattern on its own, through the track you choose, and record it to a WAV with the sample grabber (that track's own USB channel when Audio has per-track channels set up, otherwise the mix). |  |
| `ui/grabber.js` | The sample grabber: record a few bars of one track or the mix to a WAV, lined up on the bar, from Song or Live Mode. | GRAB (the sample grabber) |
| `ui/live-capture.js` | Capture to Song: turns what was played in Live Mode into an arrangement, markers and clip changes. |  |
| `ui/live-menus.js` | Right-click menus in Live Mode: scene cards, pads, tracks and keys. |  |
| `ui/menu.js` | The right-click menu itself: showMenu() and closeMenu(). Menus pass a list of items. | CM (the open menu) |
| `ui/menubar.js` | The top menu bar (File, Edit, Song, Audio, Settings, View, Help), and wiring the setup wizard's buttons. |  |
| `ui/mode.js` | Switching between Song Mode and Live Mode. |  |
| `ui/projects.js` | Project files: new, open, save, recent projects and the project title, through the Windows app or the browser. |  |
| `ui/saved-songs.js` | Saved song slots in the browser, and the extra settings panel (MIDI input list, recording keys, transpose). |  |
| `ui/setup-wizard.js` | The MC-707 setup wizard: connect MIDI, test notes on each channel, and check the clock and audio. | SU (the setup wizard) |
| `ui/start-screen.js` | The start screen: when the app opens (in Song Mode) it offers to load the last session, start a blank song or an empty template with its sections marked, open the song wizard, or go to Live Mode. A tick box turns it off. | localStorage 'mc707-start' ('0' = do not show at start) |
| `ui/track-setup.js` | Track setup: choose what each of the 8 tracks is for, anywhere from 8 drum tracks to 8 tone tracks. Each track gets a role (kit, hats, perc, bass, chords, pad, lead, pluck or acid); the role sets whether it is a drum or tone track, what the song wizard and Live Mode play on it, and its name. Clips that no longer fit a track's type are removed (with undo). |  |
| `ui/transport-view.js` | The transport display: position, play state, and moving the playhead in Song Mode, the editor and the wizard. |  |

### main.js (layer: app)

| Module | What it does | Owns |
| --- | --- | --- |
| `main.js` | Start-up. Imports every module in a fixed order (the pattern library depends on it), fills in core/hooks.js, then starts the app: loads the saved song, builds the screens and starts the clock. |  |

<!-- module-map:end -->
