// Load order matters: each module is evaluated once, in this order (see AGENTS.md).
import './core/dom.js';
import './core/icons.js';
import './core/theory.js';
import './library/factory.js';
import './library/generate.js';
import './core/device.js';
import './core/state.js';
import './song/arrangement.js';
import './core/song-model.js';
import './song/editor.js';
import './services/synth.js';
import './services/midi.js';
import './services/transport.js';
import './ui/fullscreen.js';
import './clips/clip-map.js';
import './clips/clips-screen.js';
import './song/library-panel.js';
import './song/controls.js';
import './song/export.js';
import './core/random.js';
import './library/live-extras.js';
import './library/lively.js';
import './library/variety.js';
import './library/flash.js';
import './library/index.js';
import './library/styles.js';
import './song/wizard-ui.js';
import './song/clip-ops.js';
import './song/import.js';
import './song/editor-menus.js';
import './ui/setup-wizard.js';
import './ui/menubar.js';
import './song/recording-midi.js';
import './song/editor-tools.js';
import './song/markers.js';
import './song/saved-songs.js';
import './song/transpose.js';
import './services/audio-capture.js';
import './song/grabber.js';
import './ui/context-menus.js';
import './song/audio-dialog.js';
import './song/layout.js';
import './song/automation.js';
import './song/structure.js';
import './song/wizard-styles.js';
import './song/wizard-plan.js';
import './song/sound-suggestions.js';
import './live/state.js';
import './live/themes.js';
import './live/moves.js';
import './live/scene-editor.js';
import './live/breaks.js';
import './live/scene-templates.js';
import './live/pools.js';
import './live/engine.js';
import './live/cues.js';
import './live/pads.js';
import './live/controller.js';
import './live/raven.js';
import './live/controller-settings.js';
import './live/midi-in.js';
import './live/capture.js';
import './live/ui.js';
import './live/visualizer.js';
import './ui/mode.js';
import './ui/projects.js';
import './ui/dialogs.js';
import { $ } from './core/dom.js';
import { FAC } from './library/factory.js';
import { HOST, PROJ, S, fixState, loadSaved, makeDemo, replaceState } from './core/state.js';
import { initArr } from './song/arrangement.js';
import { initEditor } from './song/editor.js';
import { AU, ensureAudio } from './services/synth.js';
import { MIDI, connectMidi, panic } from './services/midi.js';
import { TICKER, TR, advance, processTick, startSong, stopAll } from './services/transport.js';
import { setClipMark } from './clips/clip-map.js';
import { frame } from './clips/clips-screen.js';
import { initControls, renderAll } from './song/controls.js';
import { setDownloads } from './song/export.js';
import { glueClips, glueRun } from './song/clip-ops.js';
import { initExtra } from './song/editor-menus.js';
import { initSetup } from './ui/menubar.js';
import { initMore } from './song/saved-songs.js';
import { initAudio } from './song/audio-dialog.js';
import { initPro } from './song/layout.js';
import { initStageB } from './song/automation.js';
import { initStructure } from './song/structure.js';
import { initWizard } from './song/sound-suggestions.js';
import { LV } from './live/state.js';
import { liveBuild } from './live/pools.js';
import { liveScene, liveStart, liveTick } from './live/engine.js';
import { liveInit } from './live/ui.js';
import { setMode } from './ui/mode.js';
import { projTitle } from './ui/projects.js';

PROJ.t = projTitle;

(function boot() {
  const saved = loadSaved();
  if (saved) replaceState(saved);
  else makeDemo();
  addEventListener('pagehide', () => {
    try {
      stopAll();
      panic(true);
    } catch (e) {}
  });
  addEventListener('beforeunload', () => {
    try {
      stopAll();
      panic(true);
    } catch (e) {}
  });
  if (HOST && HOST.onClosing)
    HOST.onClosing(() => {
      try {
        stopAll();
        panic(true);
      } catch (e) {}
      setTimeout(() => HOST.closeNow(), 450);
    });
  /* Test hook: the automated tests in tests/ reach the app's internals through this. The app itself never uses it. */
  window.__app = {
    get S() {
      return S;
    },
    get LV() {
      return LV;
    },
    get TR() {
      return TR;
    },
    get FAC() {
      return FAC;
    },
    get MIDI() {
      return MIDI;
    },
    get AU() {
      return AU;
    },
    processTick,
    advance,
    TICKER,
    liveTick,
    liveBuild,
    liveStart,
    liveScene,
    stopAll,
    startSong,
    ensureAudio,
    connectMidi,
    fixState,
    setClipMark,
    glueRun,
    glueClips,
    renderAll
  };
  initControls();
  initArr();
  initEditor();
  initWizard();
  initExtra();
  initSetup();
  initMore();
  initAudio();
  initPro();
  initStageB();
  initStructure();
  liveInit();
  if (innerWidth <= 860) $('#main').classList.add('nolib');
  $('#bLibT').classList.toggle('on', !$('#main').classList.contains('nolib'));
  renderAll();
  projTitle();
  try {
    if (localStorage.getItem('mc707-mode') === 'live') setMode('live');
  } catch (e) {}
  requestAnimationFrame(frame);
  (async () => {
    try {
      if (window.claude && typeof claude.use === 'function') {
        setDownloads(await claude.use('downloads'));
      }
    } catch (e) {
      setDownloads(null);
    }
    $('#fileHint').textContent = 'MIDI export gives one .mid with all tracks plus one per track, inside a .zip.';
  })();
})();
