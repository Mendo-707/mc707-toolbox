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
  features  song/   live/                                  never import each other
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
- **Song and Live never import each other.** Anything they share lives lower down, such as the
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
| `core/song-model.js` | Reading and editing the song's clips: find the clip at a bar, cut a gap into a track, place a clip, the song's length, and clip arithmetic (loop length, 16th-step rounding). |  |
| `core/state.js` | The song (S) and everything that saves it: a new song, autosave to localStorage, undo and redo, loading and checking saved songs (fixState), plus the shared screen state UI and the editor state ED. | S (the song), UI (song screen state), ED (editor state), PROJ (the open project) |
| `core/theory.js` | Music theory tables: note names, the drum lanes, keys and scales. |  |
| `core/types.js` | The shapes of the app's main data, as JSDoc types. Nothing imports this file at run time; editors and agents read it, and other files refer to these types in their JSDoc (e.g. @param {Clip} c). |  |

### library/ (layer: library)

| Module | What it does | Owns |
| --- | --- | --- |
| `library/factory.js` | The hand-written factory patterns (drums and tone parts for drum and bass and hip hop). FAC, the list every factory pattern goes into, is created here. | FAC (the pattern library) |
| `library/flash.js` | Flash-break patterns: 1 to 2 bar unison hits for every genre (FLASH_RH lists the rhythms). |  |
| `library/generate.js` | Generates most of the factory library: kits, drum layers, fills, chords, basslines, arps, leads and pads for every genre. Order matters: each pattern's id comes from the order it is made in. |  |
| `library/index.js` | The finished pattern library: the id lookup (facById), the pool each track draws from, and helpers that copy a factory pattern into the song. |  |
| `library/live-extras.js` | Extra patterns for Live Mode: fills, builds and drop impacts for every genre. |  |
| `library/lively.js` | Lively variants: busier, syncopated basslines, arps, chords and leads built on each genre's progressions. |  |
| `library/pools.js` | Which patterns suit a style: pools by genre, sub-style and tempo, full kits for one drum track, and the Lively / Classic flavour filter. Used by Live Mode and the song wizard. |  |
| `library/styles.js` | The song styles (43 of them): tempo, key, structure, parts and tips, used by the song wizard and Live Mode. |  |
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
| `song/clip-ops.js` | Things you do to clips: split, edit one repeat on its own, glue, copy, make unique, set length and transpose, plus the playhead and loop controls. | CLIPB (the clip clipboard) |
| `song/clip-options.js` | The Clip options panel: fine position, length, transpose, velocity, fades and the MC-707 clip to launch. |  |
| `song/editor-head.js` | The pattern editor's toolbar: name, length, key, steps or piano roll, the tools, and which bars are being edited. |  |
| `song/editor-menus.js` | Right-click menus inside the pattern editor (notes, rows, velocity), and the arrangement's context-menu wiring. |  |
| `song/editor-tools.js` | Pattern tools: chord shapes, diatonic chords, euclidean rhythms and scale lock. |  |
| `song/editor.js` | The pattern editor: the step grid and piano roll, drawing notes, velocity lane, and the editor playhead. |  |
| `song/export.js` | MIDI export: builds a .mid with every track (and one per track) and saves it, in a zip when there are several files. |  |
| `song/import.js` | Bringing patterns in: MIDI file import with a review step, and new or blank patterns. |  |
| `song/layout.js` | Arrangement layout: snap, row heights that fit the window, the splitter between arrangement and editor, and clip geometry. |  |
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
| `live/lanes.js` | The Live Mode timeline: lanes showing what each track plays, the status panel and the per-frame update. |  |
| `live/midi-in.js` | MIDI input in Live Mode: the MC-707 pads and keys (Raven keys), the pad test, and the computer keyboard. |  |
| `live/moves.js` | Live Mode moves: MC-707 knob automation over time (filter, resonance, reverb wash, pump, autopan) for builds, drops and scene moves. |  |
| `live/pads.js` | The 16 Live pads: press and release, knobs and scatter sent to the MC-707. |  |
| `live/panels.js` | The Live page panels: scene cards, pads, keys and mutes, knobs, and keeping the toolbar in step. |  |
| `live/raven.js` | Raven mode: the mute and key keys on the MC-707 and a controller keyboard, the presets and their settings area. |  |
| `live/scene-editor.js` | Editing Live scenes: parts, when each plays, its MC-707 clip, and saving custom scenes. |  |
| `live/scene-templates.js` | The Live scene templates (Groove, Lift, Peak …) and the play patterns that let parts come and go. |  |
| `live/set-builder.js` | Builds a Live set: picks matching patterns for each scene from the style's pools. |  |
| `live/settings-panel.js` | The Live Mapping panel: pad layout and actions, Raven mode, knob rest values and the controller keyboard. |  |
| `live/state.js` | Live Mode's state LV (style, key, tempo, scenes, pads, settings) and saving it. | LV (Live Mode state) |
| `live/themes.js` | Live Mode colour themes, scene colours and small shared helpers (action labels and colours, track groups). |  |
| `live/ui.js` | Builds the Live Mode page and its toolbar, and the timeline maths it uses. |  |
| `live/visualizer.js` | The Live Mode visualizer behind the Now Playing panel. | VZ (the visualizer) |

### ui/ (layer: app)

| Module | What it does | Owns |
| --- | --- | --- |
| `ui/context-menus.js` | Right-click menus for the transport, Play pattern, the sample grabber and the clips screen, and the one listener that opens them. |  |
| `ui/controls.js` | The Song Mode toolbar and keyboard shortcuts, and redrawing everything after big changes (renderAll). |  |
| `ui/device.js` | Switching between MC-707 and MC-101 and the one-kit drums option, which rebuild Song and Live. |  |
| `ui/dialogs.js` | A simple ask dialog (OK / Cancel, or a text box). |  |
| `ui/fullscreen.js` | Fullscreen (the Windows app or the browser) and keeping the screen awake while playing. | STAGE (fullscreen and wake lock) |
| `ui/grabber.js` | The sample grabber: record a few bars of one track or the mix to a WAV, lined up on the bar, from Song or Live Mode. | GRAB (the sample grabber) |
| `ui/live-capture.js` | Capture to Song: turns what was played in Live Mode into an arrangement, markers and clip changes. |  |
| `ui/live-menus.js` | Right-click menus in Live Mode: scene cards, pads, tracks and keys. |  |
| `ui/menu.js` | The right-click menu itself: showMenu() and closeMenu(). Menus pass a list of items. | CM (the open menu) |
| `ui/menubar.js` | The top menu bar (File, Edit, Song, Audio, Settings, View, Help), and wiring the setup wizard's buttons. |  |
| `ui/mode.js` | Switching between Song Mode and Live Mode. |  |
| `ui/projects.js` | Project files: new, open, save, recent projects and the project title, through the Windows app or the browser. |  |
| `ui/saved-songs.js` | Saved song slots in the browser, and the extra settings panel (MIDI input list, recording keys, transpose). |  |
| `ui/setup-wizard.js` | The MC-707 setup wizard: connect MIDI, test notes on each channel, and check the clock and audio. | SU (the setup wizard) |
| `ui/transport-view.js` | The transport display: position, play state, and moving the playhead in Song Mode, the editor and the wizard. |  |

### main.js (layer: app)

| Module | What it does | Owns |
| --- | --- | --- |
| `main.js` | Start-up. Imports every module in a fixed order (the pattern library depends on it), fills in core/hooks.js, then starts the app: loads the saved song, builds the screens and starts the clock. |  |

<!-- module-map:end -->
