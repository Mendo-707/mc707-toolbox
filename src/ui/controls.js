// The Song Mode toolbar and keyboard shortcuts, and redrawing everything after big changes
// (renderAll).
//
// Reads: S, UI, ED, TR, MIDI, AUDREC, STAGE, CM, bw.
import { sceneKeyDown } from '../scene/screen.js';
import { songMixerOpen } from '../song/song-mixer.js';
import { hooks } from '../core/hooks.js';
import { $, clamp, el, toast } from '../core/dom.js';
import { LANES } from '../core/theory.js';
import {
  ED,
  S,
  UI,
  curClip,
  newState,
  pushUndo,
  redo,
  replaceState,
  scheduleSave,
  undo,
  updUndo
} from '../core/state.js';
import { bw, hideGhost, renderArr, setBarWidth } from '../song/arrangement.js';
import { makeDemo } from '../library/index.js';
import { clipMapOpen } from '../clips/clips-screen.js';
import { MAXBARS, curPat, songEnd, touch } from '../core/song-model.js';
import { drawEditor, layoutEditor, renderEditor } from '../song/editor.js';
import { ensureAudio } from '../services/synth.js';
import { MIDI, connectMidi, panic } from '../services/midi.js';
import { TR, audition, stopAll, togglePlay } from '../services/transport.js';
import { FULLHOST, STAGE, canFull, toggleFull } from './fullscreen.js';
import { updPlayhead, updTransport } from './transport-view.js';
import { deleteClip, dupClip } from '../song/arrangement-input.js';
import { libReset, renderLibrary } from '../song/library-panel.js';
import { buildMidi, makeZip, saveFile } from '../song/export.js';
import { CM, closeMenu } from './menu.js';
import { glueClips, glueRun, loopClip, posBarNow, setLoop, updLoopUI } from '../song/clip-ops.js';
import { importMidiFiles, openNewPat } from '../song/import.js';
import { closeSetup } from './setup-wizard.js';
import { recKey } from '../song/recording-midi.js';
import { syncExtra } from './saved-songs.js';
import { closeXpose } from '../song/transpose.js';
import { AUDREC } from '../services/audio-capture.js';
import { quickRec } from '../song/audio-record.js';
import { closeAudio } from '../song/audio-dialog.js';
import { clipArrow } from '../song/layout.js';
import { closeMctl } from '../song/track-midi.js';
import { closeWiz } from '../song/wizard-plan.js';
import { liveKeyDown, liveKeyUp } from '../live/midi-in.js';
import { projLoadText, projNew, projOpen, projSave, projSaveAs } from './projects.js';
import { clipChangeMenu, flipAtPlayhead } from '../song/clip-change.js';

/* ---------- controls ---------- */
export function syncControls() {
  $('#bpm').value = S.bpm;
  $('#swing').value = S.swing;
  $('#swingV').textContent = S.swing + '%';
  $('#bLoop').classList.toggle('on', S.loop.on);
  $('#bMetro').classList.toggle('on', S.metro);
  $('#bFollow').classList.toggle('on', S.follow);
  $('#cClock').checked = S.clock;
  $('#cPrev').checked = S.preview;
  $('#zoom').value = bw;
  $('#barsIn').value = S.bars;
  const lb = $('#loopband');
  if (lb) lb.style.display = S.loop.on ? 'block' : 'none';
  const rl = $('.rloop');
  if (rl) rl.classList.toggle('on', S.loop.on);
  const ls = $('#loopS'),
    le = $('#loopE');
  if (ls && document.activeElement !== ls) ls.value = S.loop.start + 1;
  if (le && document.activeElement !== le) le.value = S.loop.end;
  syncExtra();
}
export function renderDmap() {
  const h = $('#dmap');
  h.textContent = '';
  LANES.forEach((l, i) =>
    h.append(
      el(
        'label',
        {},
        l[0],
        el('input', {
          type: 'number',
          min: 0,
          max: 127,
          value: S.drumMap[i],
          onchange: e => {
            S.drumMap[i] = clamp(+e.target.value || 0, 0, 127);
            scheduleSave();
            if (ED.geom) drawEditor();
          }
        })
      )
    )
  );
}
export function renderAll() {
  syncControls();
  renderDmap();
  renderArr();
  renderLibrary();
  renderEditor();
  updUndo();
  updTransport();
}
export function closePops() {
  $('#midiPop').hidden = true;
  $('#filePop').hidden = true;
  const h = $('#helpPop');
  if (h) h.hidden = true;
}
export function initControls() {
  $('#bPlay').addEventListener('click', togglePlay);
  $('#bRew').addEventListener('click', () => {
    S.cursor = S.loop.on ? S.loop.start : 0;
    if (TR.playing && TR.mode === 'song') {
      TR.tick = S.cursor * 32;
      TR.vis = [];
    }
    updPlayhead(S.cursor);
    $('#arr').scrollLeft = 0;
  });
  $('#bpm').addEventListener('change', e => {
    S.bpm = clamp(Math.round(+e.target.value) || 120, 40, 240);
    syncControls();
    scheduleSave();
  });
  $('#swing').addEventListener('input', e => {
    S.swing = +e.target.value;
    $('#swingV').textContent = S.swing + '%';
  });
  $('#swing').addEventListener('change', scheduleSave);
  let taps = [];
  $('#bTap').addEventListener('click', () => {
    const n = performance.now();
    if (taps.length && n - taps[taps.length - 1] > 2000) taps = [];
    taps.push(n);
    taps = taps.slice(-5);
    if (taps.length >= 2) {
      const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      S.bpm = clamp(Math.round(60000 / avg), 40, 240);
      syncControls();
      scheduleSave();
    }
  });
  $('#bLoop').addEventListener('click', () => {
    S.loop.on = !S.loop.on;
    syncControls();
    scheduleSave();
  });
  $('#bMixer').addEventListener('click', () => songMixerOpen());
  $('#bMetro').addEventListener('click', () => {
    S.metro = !S.metro;
    syncControls();
    scheduleSave();
  });
  $('#bFollow').addEventListener('click', () => {
    S.follow = !S.follow;
    syncControls();
    scheduleSave();
  });
  $('#zoom').addEventListener('input', e => {
    setBarWidth(+e.target.value);
    renderArr();
  });
  $('#bClipChg').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    clipChangeMenu(r.left, r.bottom + 2);
  });
  $('#bAddBars').addEventListener('click', () => {
    if (S.bars >= MAXBARS) {
      toast(MAXBARS + ' bars is the maximum');
      return;
    }
    S.bars = Math.min(MAXBARS, S.bars + 8);
    syncControls();
    renderArr();
    scheduleSave();
  });
  $('#barsIn').addEventListener('change', e => {
    const v = Math.round(+e.target.value) || S.bars;
    S.bars = clamp(v, Math.max(8, Math.ceil(songEnd())), MAXBARS);
    syncControls();
    renderArr();
    scheduleSave();
  });
  const libBtn = () => $('#bLibT').classList.toggle('on', !$('#main').classList.contains('nolib'));
  $('#bNewPat').addEventListener('click', openNewPat);
  addEventListener('dragover', e => {
    if (document.body.dataset.mode !== 'song') return;
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
  });
  addEventListener('drop', e => {
    if (document.body.dataset.mode !== 'song') return;
    const fs = e.dataTransfer && e.dataTransfer.files;
    if (fs && fs.length) {
      e.preventDefault();
      importMidiFiles(fs);
    }
  });
  $('#bLibT').addEventListener('click', e => {
    e.stopPropagation();
    $('#main').classList.toggle('nolib');
    libBtn();
  });
  $('#libClose').addEventListener('click', () => {
    $('#main').classList.add('nolib');
    libBtn();
  });
  $('#bUndo').addEventListener('click', undo);
  $('#bRedo').addEventListener('click', redo);
  $('#bMidi').addEventListener('click', e => {
    e.stopPropagation();
    const h = $('#midiPop').hidden;
    closePops();
    $('#midiPop').hidden = !h;
  });
  $('#bFile').addEventListener('click', e => {
    e.stopPropagation();
    const h = $('#filePop').hidden;
    closePops();
    $('#filePop').hidden = !h;
  });
  addEventListener('click', e => {
    if (!e.target.closest('.pop') && !e.target.closest('#bMidi') && !e.target.closest('#bFile')) closePops();
  });
  $('#bConnect').addEventListener('click', connectMidi);
  $('#midiOut').addEventListener('change', e => {
    const o = MIDI.access ? MIDI.access.outputs.get(e.target.value) : null;
    MIDI.out = o || null;
    S.midiOut = o ? o.id : '';
    scheduleSave();
    $('#midiStat').textContent = o ? 'Sending to ' + o.name + '.' : 'No output selected.';
    if (o) hooks.matchDevice(o.name);
  });
  $('#cClock').addEventListener('change', e => {
    S.clock = e.target.checked;
    scheduleSave();
  });
  $('#cPrev').addEventListener('change', e => {
    S.preview = e.target.checked;
    scheduleSave();
  });
  $('#bPanic').addEventListener('click', () => {
    ensureAudio();
    panic();
  });
  $('#bTest').addEventListener('click', () => {
    ensureAudio();
    if (!MIDI.out) {
      toast('No MIDI output selected');
      return;
    }
    audition(3, 60, 100);
  });
  $('#bDmapReset').addEventListener('click', () => {
    S.drumMap = LANES.map(l => l[1]);
    renderDmap();
    if (ED.geom) drawEditor();
    scheduleSave();
  });
  $('#libQ').addEventListener('input', e => {
    UI.q = e.target.value;
    renderLibrary();
  });
  $('#libClear').addEventListener('click', libReset);
  /* file menu */
  let confirmNew = 0;
  $('#fNew').addEventListener('click', e => {
    const b = e.target;
    if (!confirmNew) {
      confirmNew = 1;
      b.textContent = 'Click again to clear the song';
      setTimeout(() => {
        confirmNew = 0;
        b.textContent = 'New empty song';
      }, 3000);
      return;
    }
    confirmNew = 0;
    b.textContent = 'New empty song';
    pushUndo();
    const m = S.midiOut;
    replaceState(newState());
    S.midiOut = m;
    UI.sel = null;
    afterReplaceKeepUndo();
    closePops();
  });
  $('#bClips').addEventListener('click', () => clipMapOpen());
  $('#fDemo').addEventListener('click', () => {
    pushUndo();
    const m = S.midiOut;
    makeDemo();
    S.midiOut = m;
    UI.sel = null;
    afterReplaceKeepUndo();
    closePops();
  });
  $('#fImport').addEventListener('click', () => $('#fileIn').click());
  $('#fileIn').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      projLoadText(r.result, f.name, '');
      closePops();
    };
    r.readAsText(f);
    e.target.value = '';
  });
  $('#fJson').addEventListener('click', () => saveFile('mc707-song.json', JSON.stringify(S, null, 1)));
  $('#fMidi').addEventListener('click', () => {
    const files = [{ name: 'song.mid', data: buildMidi() }];
    S.tracks.forEach((t, i) => {
      if (S.clips.some(c => c.t === i))
        files.push({
          name: 'tracks/' + String(i + 1).padStart(2, '0') + '-' + t.name.replace(/[^A-Za-z0-9]+/g, '-') + '.mid',
          data: buildMidi(i)
        });
    });
    saveFile('mc707-song-midi.zip', makeZip(files));
  });
  addEventListener('keydown', onKey);
  addEventListener('keyup', liveKeyUp);
  addEventListener('keyup', e => {
    if (e.code === 'Space' && e.target.tagName === 'BUTTON') e.preventDefault();
  });
  let wasNarrow = innerWidth <= 860;
  addEventListener('resize', () => {
    const nar = innerWidth <= 860;
    if (nar !== wasNarrow) {
      wasNarrow = nar;
      $('#main').classList.toggle('nolib', nar);
      $('#bLibT').classList.toggle('on', !nar);
    }
    if (ED.geom) layoutEditor();
  });
  const redraw = () => {
    drawEditor();
    renderLibrary();
    renderArr();
  };
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener && mq.addEventListener('change', redraw);
  addEventListener('mc707-theme', redraw);
}
export function afterReplaceKeepUndo() {
  ED.selNotes.clear();
  stopAll();
  renderAll();
  scheduleSave();
}
function onKey(e) {
  if (e.key === 'F11') {
    if (canFull()) {
      e.preventDefault();
      toggleFull();
    }
    return;
  }
  if (e.key === 'Escape' && FULLHOST && STAGE.full && !CM) {
    toggleFull();
    return;
  }
  if (e.key === 'Escape' && CM) {
    closeMenu();
    return;
  }
  if (!$('#mctl').hidden) {
    if (e.key === 'Escape') closeMctl();
    return;
  }
  if (!$('#audio').hidden) {
    if (e.key === 'Escape' && !AUDREC.on) closeAudio();
    return;
  }
  if (!$('#xpose').hidden) {
    if (e.key === 'Escape') closeXpose();
    return;
  }
  if (!$('#setup').hidden) {
    if (e.key === 'Escape') closeSetup();
    return;
  }
  if (!$('#wiz').hidden) {
    if (e.key === 'Escape') closeWiz();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 's') {
      e.preventDefault();
      e.shiftKey ? projSaveAs() : projSave();
      return;
    }
    if (k === 'o') {
      e.preventDefault();
      projOpen();
      return;
    }
    if (k === 'n' && !e.shiftKey) {
      e.preventDefault();
      projNew();
      return;
    }
  }
  const tag = e.target.tagName || '';
  const typing = /INPUT|SELECT|TEXTAREA/.test(tag) && !(tag === 'INPUT' && /range|checkbox/.test(e.target.type));
  if (typing) return;
  if (document.body.dataset.mode === 'live') {
    liveKeyDown(e);
    return;
  }
  if (document.body.dataset.mode === 'scene') {
    sceneKeyDown(e);
    return;
  }
  /* Synth mode: the DAW plays; the song's shortcuts (Space, record) stay out of the way */
  if (document.body.dataset.mode === 'synth') return;
  if (recKey(e, true)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod && !e.altKey && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    quickRec();
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (tag === 'BUTTON') e.target.blur();
    togglePlay();
    return;
  }
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    dupClip();
    return;
  }
  if (mod && e.key.toLowerCase() === 'a' && ED.mode === 'roll') {
    const p = curPat();
    if (p) {
      e.preventDefault();
      p.notes.forEach(n => ED.selNotes.add(n));
      drawEditor();
    }
    return;
  }
  if (e.key === 'Home') {
    $('#bRew').click();
    return;
  }
  if (e.key.startsWith('Arrow') && !mod && curClip() && clipArrow(e)) return;
  if (!mod && (e.key === 'l' || e.key === 'L')) {
    S.loop.on = !S.loop.on;
    updLoopUI();
    scheduleSave();
    return;
  }
  if (!mod && e.key === '[') {
    const b = Math.floor(posBarNow());
    setLoop(b, Math.max(b + 1, S.loop.end));
    return;
  }
  if (!mod && e.key === ']') {
    const b = Math.floor(posBarNow());
    setLoop(Math.min(S.loop.start, b), b + 1);
    return;
  }
  if (!mod && e.key === '\\') {
    const c = curClip();
    if (c) loopClip(c);
    return;
  }
  if (!mod && !e.altKey && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    if (e.shiftKey) flipAtPlayhead();
    else {
      const r = $('#bClipChg').getBoundingClientRect();
      clipChangeMenu(r.left, r.bottom + 2);
    }
    return;
  }
  if (!mod && (e.key === 'g' || e.key === 'G')) {
    const c = curClip();
    if (c) {
      const r = glueRun(c, 'all');
      glueClips(r);
    }
    return;
  }
  if (e.key === 'Escape') {
    if (UI.arm) {
      UI.arm = null;
      hideGhost();
      renderLibrary();
      renderArr();
    } else if (ED.selNotes.size) {
      ED.selNotes.clear();
      drawEditor();
    }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const p = curPat();
    if (ED.selNotes.size && p) {
      e.preventDefault();
      pushUndo();
      p.notes = p.notes.filter(n => !ED.selNotes.has(n));
      ED.selNotes.clear();
      touch(p);
      drawEditor();
    } else if (curClip()) {
      e.preventDefault();
      deleteClip();
    }
  }
}
