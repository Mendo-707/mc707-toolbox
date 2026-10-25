// Calls that go UP the layers (see docs/ARCHITECTURE.md).
//
// A lower module (core, services, or a feature that must not import another) sometimes needs a
// higher one to act: redraw the arrangement, run the Live tick, stop a recording. Importing the
// higher module would create an import cycle, so the lower module calls hooks.<name>(...) and
// main.js fills in the real functions before anything runs. Add a hook only when a call has to
// point up; everything else is a normal import.
//
// Hook               provided by
//   applyDevice        src/ui/device.js
//   audRender          src/song/audio-dialog.js
//   closePops          src/ui/controls.js
//   cmChipSet          src/clips/clip-map.js
//   grabOpen           src/ui/grabber.js
//   grabPattern        src/ui/grab-pattern.js
//   grabUI             src/ui/grabber.js
//   liveCapture        src/ui/live-capture.js
//   liveCleanup        src/live/engine.js
//   liveRenderSceneEd  src/live/scene-editor.js
//   liveSwingAmt       src/live/state.js
//   liveTempo          src/live/state.js
//   liveTick           src/live/engine.js
//   matchDevice        src/ui/device.js
//   midiBack           src/ui/link-watch.js
//   midiLost           src/ui/link-watch.js
//   recMidi            src/song/recording-midi.js
//   recStop            src/song/recording-midi.js
//   refreshIns         src/ui/saved-songs.js
//   renderAll          src/ui/controls.js
//   renderArr          src/song/arrangement.js
//   saveFile           src/song/export.js
//   scheduleUI         src/song/arrangement.js
//   setMode            src/ui/mode.js
//   stopAll            src/services/transport.js
//   suAutoConnect      src/ui/setup-wizard.js
//   syncControls       src/ui/controls.js
//   syncExtra          src/ui/saved-songs.js
//   testNote           src/ui/setup-wizard.js
//   updPlayhead        src/ui/transport-view.js
//   updTransport       src/ui/transport-view.js
//   vizNote            src/live/visualizer.js
//   wizCellAt          src/song/wizard-plan.js
//   zenOpen            src/zen/zc-editor.js
//   clipNotesToMine    src/zen/zc-seq.js
//   clipWriteAsk       src/zen/zc-seq.js
//   fillTones          src/ui/fill-tones.js
export const hooks = {};
