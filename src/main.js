// Start-up. Imports every module in a fixed order (the pattern library depends on it), fills in
// core/hooks.js, then starts the app: loads the saved song, builds the screens and starts the
// clock.
//
// Reads: S, PROJ, LV, TR, MIDI, AU, FAC.
// Calls up the layers through hooks (core/hooks.js).
// Load order matters: each module is evaluated once, in this order (see AGENTS.md).
import { popoutCloseAll } from './services/popout.js';
import './core/dom.js';
import { applyTheme } from './core/theme.js';
import { initDesktop } from './ui/desktop.js';
import './core/icons.js';
import './core/theory.js';
import './library/factory.js';
import './library/generate.js';
import './core/device.js';
import './core/state.js';
import './song/arrangement.js';
import './library/index.js';
import './core/song-model.js';
import './song/editor.js';
import './services/synth.js';
import './services/midi.js';
import './services/transport.js';
import './ui/fullscreen.js';
import './services/clip-switch.js';
import './clips/clip-map.js';
import './clips/clips-screen.js';
import './ui/device.js';
import './ui/transport-view.js';
import './song/arrangement-input.js';
import './song/library-panel.js';
import './song/editor-head.js';
import './ui/controls.js';
import './song/export.js';
import './core/crc.js';
import './core/random.js';
import './library/live-extras.js';
import './library/lively.js';
import './library/variety.js';
import './library/flash.js';
import './library/styles.js';
import './song/wizard-ui.js';
import './ui/menu.js';
import './song/clip-ops.js';
import './song/import.js';
import './song/arrangement-menus.js';
import './song/clip-options.js';
import './song/editor-menus.js';
import './ui/setup-wizard.js';
import './ui/menubar.js';
import './song/recording-midi.js';
import './song/editor-tools.js';
import './song/markers.js';
import './ui/saved-songs.js';
import './song/transpose.js';
import './services/audio-capture.js';
import './services/audio-files.js';
import './song/audio-record.js';
import './ui/grabber.js';
import './ui/live-menus.js';
import './ui/context-menus.js';
import './song/audio-save.js';
import './song/audio-dialog.js';
import './song/audio-check.js';
import './song/layout.js';
import './core/mc707-params.js';
import './song/track-midi.js';
import './services/mc-controls.js';
import './song/shape-editor.js';
import './song/structure.js';
import { defaultWiz, wizPlan } from './song/wizard-styles.js';
import './song/wizard-plan.js';
import './song/wizard-structure.js';
import './song/wizard-review.js';
import './song/sound-suggestions.js';
import './live/state.js';
import './live/themes.js';
import './live/moves.js';
import './live/scene-editor.js';
import './live/breaks.js';
import './live/scene-templates.js';
import './library/pools.js';
import './live/set-builder.js';
import './live/engine.js';
import { liveBuildDrop, lvBlendIn } from './live/cues.js';
import { liveMoveNow, lvRestCC, lvUserOwns } from './live/moves.js';
import { liveActDown, liveActUp } from './live/pads.js';
import { liveJamEnd, liveJamStart } from './live/jam.js';
import { lvHumApply } from './live/humanize-ui.js';
import { lvMoodSet } from './live/mood-ui.js';
import { moodOf } from './library/mood.js';
import './live/pads.js';
import './live/controller.js';
import './live/raven.js';
import './live/controller-settings.js';
import './live/midi-in.js';
import './ui/live-capture.js';
import './live/ui.js';
import './live/lanes.js';
import './live/panels.js';
import './live/settings-panel.js';
import './live/visualizer.js';
import './ui/mode.js';
import './ui/projects.js';
import './ui/dialogs.js';
import { $ } from './core/dom.js';
import { FAC } from './library/factory.js';
import { BACKUP, HOST, PROJ, S, fixState, loadSaved, replaceState, scheduleSave, undo } from './core/state.js';
import { renderArr, scheduleUI } from './song/arrangement.js';
import { facById, makeDemo } from './library/index.js';
import { initEditor } from './song/editor.js';
import { AU, ensureAudio } from './services/synth.js';
import { MIDI, connectMidi, panic, refreshOuts, sendMidi } from './services/midi.js';
import { TICKER, TR, advance, processTick, sched, startSong, stopAll } from './services/transport.js';
import { cmChipSet, setClipMark } from './clips/clip-map.js';
import { applyDevice, matchDevice } from './ui/device.js';
import { midiBack, midiLost } from './ui/link-watch.js';
import { autoConnectAtLaunch, midiFound } from './ui/auto-connect.js';
import { applyComposed, composeNow } from './scene/compose.js';
import { TB, tbBytes, templateBuilderOpen } from './ui/template-builder.js';
import { mpjRead } from './core/mpj-write.js';
import { compose } from './library/compose.js';
import { mpjBytes, mpjSong } from './scene/save-mpj.js';
import { backupsOffer } from './ui/backups.js';
import { frame, updPlayhead, updTransport } from './ui/transport-view.js';
import { initArr } from './song/arrangement-input.js';
import { closePops, initControls, renderAll, syncControls } from './ui/controls.js';
import { saveFile, setDownloads } from './song/export.js';
import { glueClips, glueRun } from './song/clip-ops.js';
import { initExtra } from './song/editor-menus.js';
import { suAutoConnect, testNote } from './ui/setup-wizard.js';
import { initSetup } from './ui/menubar.js';
import { recMidi, recStop } from './song/recording-midi.js';
import { initMore, refreshIns, syncExtra } from './ui/saved-songs.js';
import { grabOpen, grabUI } from './ui/grabber.js';
import { grabPattern } from './ui/grab-pattern.js';
import { audRender, initAudio } from './song/audio-dialog.js';
import { initPro } from './song/layout.js';
import { initStageB } from './song/track-midi.js';
import { initStructure } from './song/structure.js';
import { wizCellAt } from './song/wizard-plan.js';
import { initWizard } from './song/sound-suggestions.js';
import { LV, liveSwingAmt, liveTempo } from './live/state.js';
import { liveRenderSceneEd } from './live/scene-editor.js';
import { liveBuild, liveSwapIds } from './live/set-builder.js';
import { liveCleanup, lvEmute, lvFadeKind, liveScene, liveStart, liveTick } from './live/engine.js';
import { liveCapture } from './ui/live-capture.js';
import { liveInit } from './live/ui.js';
import { vizNote } from './live/visualizer.js';
import { setMode } from './ui/mode.js';
import * as sceneModel from './scene/model.js';
import { pending, writeAll, writeChanged, writeOneClip, writeOneScene, writeThese } from './scene/write.js';
import { songToRows, scenesToSong } from './scene/convert.js';
import { startOnOpen, startOpen } from './ui/start-screen.js';
import { projTitle } from './ui/projects.js';
import { ZE, zeSendAll, zenOpen } from './zen/zc-editor.js';
import { pageOf } from './zen/zc-lab-fine.js';
import { isDotted, isTriplet, melodyClashes, melodyScore } from './library/melody-fit.js';
import {
  clipNotesToMine,
  clipPacked,
  encodePattern,
  encodeAt,
  clipWriteAsk,
  clipWriteNow,
  songToClipsOpen,
  songToClipsNow,
  songPlan,
  stepAddr,
  paramAddr,
  clipAddr
} from './zen/zc-seq.js';
import { browserOpen } from './zen/zc-browser.js';
import { songSections } from './zen/zc-scenes.js';
import { scanOnce, scanDiff, scanReset, sceneFinderOpen } from './zen/zc-scan.js';
import { ZS, libraryJSON } from './zen/zc-sounds.js';
import { FW_REC, fwFields, fwKitBytes, fwKits } from './zen/zc-factory.js';
import { newSound } from './zen/zc-tone.js';
import { hooks } from './core/hooks.js';
import { finishLibrary } from './library/pools.js';
import { STYLES } from './library/styles.js';
import * as motion from './zen/zc-motion.js';
import * as pump from './core/pump.js';
import { slotAddr } from './zen/zc-sysex.js';
import { mpjOpen } from './ui/mpj-open.js';
import { fillTonesOpen } from './ui/fill-tones.js';
import { CHO_TYPES, FXN, REV_TYPES, fxChoices, readMaster, setMaster, trackFx } from './zen/zc-fx.js';
import { knobName, knobNow, readAllKnobs, setKnob } from './zen/zc-knobs.js';
import { TV, totalPanel, totalRead, totalSet } from './zen/zc-total.js';
import { loopAudio, readMpj } from './core/mpj.js';
import { hoverHelpStart } from './ui/hover-help.js';

/* the colours first, so the app does not flash light before going dark */
applyTheme();
/* the window itself never scrolls (base.css); if a focus jump or scrollIntoView scrolls it anyway, put it back,
   so the app can never end up off screen as a blank window */
for (const t of [document.scrollingElement || document.documentElement, document.body])
  t.addEventListener('scroll', () => t.scrollTop && (t.scrollTop = 0), { passive: true });
addEventListener('scroll', () => (scrollX || scrollY) && scrollTo(0, 0), { passive: true });
initDesktop();

// Fill in the hooks first: lower modules call these through core/hooks.js, never by import.
Object.assign(hooks, {
  composeNow,
  templateBuilder: templateBuilderOpen,
  fillTones: fillTonesOpen,
  fx: {
    choices: fxChoices,
    now: FXN,
    trackFx,
    readMaster,
    setMaster,
    REV_TYPES,
    CHO_TYPES,
    total: { now: TV, panel: totalPanel, read: totalRead, set: totalSet }
  },
  knobs: { now: knobNow, name: knobName, read: readAllKnobs, set: setKnob },
  applyDevice,
  audRender,
  closePops,
  cmChipSet,
  grabOpen,
  grabPattern,
  grabUI,
  liveCapture,
  liveCleanup,
  liveRenderSceneEd,
  liveSwingAmt,
  liveTempo,
  liveTick,
  matchDevice,
  midiBack,
  midiFound,
  midiLost,
  recMidi,
  recStop,
  refreshIns,
  renderAll,
  renderArr,
  scheduleUI,
  setMode,
  stopAll,
  suAutoConnect,
  syncControls,
  syncExtra,
  testNote,
  updPlayhead,
  updTransport,
  vizNote,
  wizCellAt,
  saveFile,
  zenOpen,
  clipNotesToMine,
  clipWriteAsk
});

PROJ.t = projTitle;

(function boot() {
  /* full kits, then the harmony pack: the library is complete before anything reads it */
  finishLibrary(STYLES);
  const saved = loadSaved();
  if (saved) replaceState(saved);
  else {
    /* nothing it could load: the desktop app may have the song in a backup (kept as it is until offered) */
    BACKUP.hold = !!(HOST && HOST.backupList);
    makeDemo();
    setTimeout(backupsOffer, 1500);
  }
  addEventListener('pagehide', () => {
    try {
      stopAll();
      panic(true);
    } catch (e) {}
    popoutCloseAll();
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
    wiz: { plan: wizPlan, def: defaultWiz },
    STYLES,
    zen: {
      open: zenOpen,
      sendAll: zeSendAll,
      browse: browserOpen,
      ZS,
      libraryJSON,
      slotAddr,
      fw: { FW_REC, fwFields, fwKits, fwKitBytes, newSound },
      get ZE() {
        return ZE;
      },
      labPageOf: pageOf
    },
    melody: { score: melodyScore, clashes: melodyClashes, isTriplet, isDotted },
    seq: {
      clipPacked,
      encode: encodePattern,
      encodeAt,
      stepAddr,
      paramAddr,
      clipAddr,
      read: clipNotesToMine,
      write: clipWriteNow,
      song: songToClipsOpen,
      sendSong: songToClipsNow,
      songPlan,
      sections: songSections,
      scan: { once: scanOnce, diff: scanDiff, reset: scanReset, open: sceneFinderOpen }
    },
    scene: {
      ...sceneModel,
      pending,
      write: writeThese,
      writeAll,
      writeChanged,
      writeOneClip,
      writeOneScene,
      fromSong: songToRows,
      toSong: scenesToSong,
      setMode
    },
    motion,
    pump,
    mpj: { open: mpjOpen, read: readMpj, loopAudio, song: mpjSong, bytes: mpjBytes },
    compose: { compose, apply: applyComposed, now: composeNow },
    tpl: { TB, bytes: tbBytes, open: templateBuilderOpen, read: mpjRead },
    get S() {
      return S;
    },
    autosave: scheduleSave,
    undoSong: undo,
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
    hooks,
    processTick,
    sched,
    advance,
    TICKER,
    liveTick,
    liveBuild,
    liveSwapIds,
    facById,
    liveStart,
    liveScene,
    lvEmute,
    lvFadeKind,
    lvUserOwns,
    /* Live Mode as the pads drive it, for the soak test */
    live: {
      down: liveActDown,
      up: liveActUp,
      jamStart: liveJamStart,
      jamEnd: liveJamEnd,
      blend: lvBlendIn,
      move: liveMoveNow,
      restCC: lvRestCC,
      humApply: lvHumApply,
      moodSet: lvMoodSet,
      moodOf
    },
    liveBuildDrop,
    stopAll,
    startSong,
    ensureAudio,
    connectMidi,
    sendMidi,
    refreshOuts,
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
  hoverHelpStart();
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
  /* the app opens in Song Mode with the start screen: last session, blank song, template, wizard or Live Mode */
  if (startOnOpen()) startOpen(!!saved);
  requestAnimationFrame(frame);
  /* drawn: show the page (and, in the desktop app, the window) */
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('boot');
      if (HOST && HOST.appReady) HOST.appReady();
      /* then the MC-707 or MC-101, if it is plugged in (and the app may) */
      autoConnectAtLaunch();
    })
  );
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
