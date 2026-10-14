// Right-click menus in the arrangement: on clips, lanes, the ruler, track headers and library
// items.
//
// Reads: S, UI, ED, CLIPB, FAVS.
// Calls up the layers through hooks (core/hooks.js).
import { $, toast } from '../core/dom.js';
import { devNm, devOn } from '../core/device.js';
import { ED, S, UI, pushUndo, scheduleSave } from '../core/state.js';
import { placeSrc, renderArr, selectClip } from './arrangement.js';
import { facById } from '../library/index.js';
import { MAXBARS, patOf, q16, songEnd } from '../core/song-model.js';
import { renderEditor } from './editor.js';
import { ensureAudio } from '../services/synth.js';
import { audition, startPat } from '../services/transport.js';
import { cmMarks } from '../services/clip-switch.js';
import { cmPickItems, setClipMark } from '../clips/clip-map.js';
import { clipMapOpen } from '../clips/clips-screen.js';
import { dupClip } from './arrangement-input.js';
import { FAVS, auditionLib, itemStyles, keyLabel, quickAdd, renderLibrary, saveFavs } from './library-panel.js';
import { STYLES } from '../library/styles.js';
import {
  CLIPB,
  blkLabel,
  clipBlock,
  clipHasBlocks,
  copyClipTo,
  deleteClipById,
  editBlock,
  glueClips,
  glueRun,
  loopClip,
  makeUnique,
  newPatternAt,
  pasteClip,
  playFrom,
  posBarNow,
  setClipLen,
  setClipTr,
  setClipboard,
  setCursor,
  setLoop,
  splitClip,
  updLoopUI
} from './clip-ops.js';
import { clearTrack, randomLibPattern } from './import.js';
import { addMarker, loopSection } from './markers.js';
import { openXpose } from './transpose.js';
import { openMctl } from './track-midi.js';
import { quickFade } from './shape-editor.js';
import { rangeMenuItems } from './structure.js';
import { hooks } from '../core/hooks.js';

export function clipMenuItems(c) {
  const p = patOf(c);
  const isTone = p.type === 'tone';
  const others = S.tracks.map((x, i) => i).filter(i => S.tracks[i].type === p.type && i !== c.t);
  const shared = S.clips.filter(x => x.pat === c.pat).length > 1;
  const cur = Math.floor(posBarNow());
  return [
    { label: 'Open in editor', action: () => selectClip(c.id) },
    ...(clipHasBlocks(c) && UI.ctxBar != null
      ? (() => {
          const { a, b } = clipBlock(c, UI.ctxBar);
          const bar = UI.ctxBar;
          return [
            {
              label: 'Edit ' + blkLabel(a, b) + ' on its own',
              hint: 'Double-click',
              action: () => editBlock(c, bar)
            }
          ];
        })()
      : []),
    {
      label: 'Preview pattern',
      action: () => {
        selectClip(c.id);
        startPat(p, c.t, null);
      }
    },
    { label: 'Play from clip start', action: () => playFrom(c.start) },
    { label: 'Loop this clip', action: () => loopClip(c) },
    '-',
    {
      label: 'Mute clip',
      checked: !!c.mute,
      action: () => {
        pushUndo();
        c.mute = !c.mute;
        renderArr();
        scheduleSave();
      }
    },
    devOn(c.t)
      ? {
          label: devNm() + ' clip change at bar ' + (Math.floor(c.start) + 1),
          sub: cmPickItems(
            c.t,
            (cmMarks().find(m => m.t === c.t && m.bar === Math.floor(c.start)) || {}).k,
            k => setClipMark(c.t, c.start, k),
            'Back to automatic switching'
          )
        }
      : null,
    isTone ? { label: 'Transpose this clip’s range…', action: () => openXpose({ scope: 'clip' }) } : null,
    isTone
      ? {
          label: 'Transpose clip',
          sub: [
            { label: '+12 (octave up)', action: () => setClipTr(c, (c.tr || 0) + 12) },
            { label: '+7', action: () => setClipTr(c, (c.tr || 0) + 7) },
            { label: '+5', action: () => setClipTr(c, (c.tr || 0) + 5) },
            { label: '+1', action: () => setClipTr(c, (c.tr || 0) + 1) },
            { label: '−1', action: () => setClipTr(c, (c.tr || 0) - 1) },
            { label: '−5', action: () => setClipTr(c, (c.tr || 0) - 5) },
            { label: '−7', action: () => setClipTr(c, (c.tr || 0) - 7) },
            { label: '−12 (octave down)', action: () => setClipTr(c, (c.tr || 0) - 12) },
            '-',
            { label: 'Reset to 0', action: () => setClipTr(c, 0) }
          ]
        }
      : null,
    {
      label: 'Clip velocity',
      sub: [50, 75, 100, 125, 150].map(v => ({
        label: v + '%',
        checked: (c.vel || 100) === v,
        action: () => {
          pushUndo();
          if (v === 100) delete c.vel;
          else c.vel = v;
          renderArr();
          scheduleSave();
        }
      }))
    },
    {
      label: 'Clip length',
      sub: [
        [0.0625, '1 step'],
        [0.25, '1 beat'],
        [0.5, '1/2 bar'],
        [1, '1 bar'],
        [2, '2 bars'],
        [4, '4 bars'],
        [8, '8 bars'],
        [16, '16 bars']
      ]
        .map(([n, l]) => ({ label: l, checked: Math.abs(c.len - n) < 1e-6, action: () => setClipLen(c, n) }))
        .concat([
          '-',
          {
            label: 'Match pattern (' + p.bars + (p.bars === 1 ? ' bar' : ' bars') + ')',
            action: () => setClipLen(c, p.bars)
          },
          { label: 'Double', action: () => setClipLen(c, c.len * 2) },
          {
            label: 'Halve',
            disabled: c.len <= 0.125,
            action: () => setClipLen(c, Math.max(0.0625, q16(c.len / 2)))
          }
        ])
    },
    {
      label: 'Fades and automation',
      sub: [
        {
          label: 'Edit shape…',
          action: () => {
            selectClip(c.id);
            ED.mode = 'shape';
            renderEditor();
          }
        },
        '-',
        { label: 'Fade in: 1 beat', action: () => quickFade(c, 'fi', 4) },
        { label: 'Fade in: 1 bar', action: () => quickFade(c, 'fi', 16) },
        { label: 'Fade in: 2 bars', action: () => quickFade(c, 'fi', 32) },
        { label: 'Fade out: 1 beat', action: () => quickFade(c, 'fo', 4) },
        { label: 'Fade out: 1 bar', action: () => quickFade(c, 'fo', 16) },
        { label: 'Fade out: 2 bars', action: () => quickFade(c, 'fo', 32) },
        '-',
        {
          label: 'Clear fades and shapes',
          danger: true,
          action: () => {
            pushUndo();
            delete c.fi;
            delete c.fo;
            delete c.fcv;
            delete c.ve;
            delete c.cc;
            renderArr();
            renderEditor();
            scheduleSave();
          }
        }
      ]
    },
    '-',
    {
      label: 'Split at playhead',
      disabled: !(cur > c.start && cur < c.start + c.len),
      action: () => splitClip(c, cur)
    },
    (() => {
      const n = glueRun(c, 'next');
      return { label: 'Glue to the next clip', disabled: n.length < 2, action: () => glueClips(n) };
    })(),
    (() => {
      const a = glueRun(c, 'all');
      return a.length > 2
        ? { label: 'Glue all ' + a.length + ' touching clips', hint: 'G', action: () => glueClips(a) }
        : null;
    })(),
    {
      label: 'Duplicate after',
      hint: 'Ctrl+D',
      action: () => {
        selectClip(c.id);
        dupClip();
      }
    },
    others.length
      ? {
          label: 'Copy to track',
          sub: others.map(i => ({
            label: 'Track ' + (i + 1) + ': ' + S.tracks[i].name,
            action: () => copyClipTo(c, i)
          }))
        }
      : null,
    shared ? { label: 'Make unique', action: () => makeUnique(c) } : null,
    {
      label: 'Rename pattern',
      action: () => {
        selectClip(c.id);
        setTimeout(() => {
          const i = $('#edName');
          if (i) {
            i.focus();
            i.select();
          }
        }, 40);
      }
    },
    '-',
    {
      label: 'Copy clip',
      action: () => {
        setClipboard({ ...c });
        toast('Clip copied. Right-click a lane to paste.');
      }
    },
    {
      label: 'Cut clip',
      action: () => {
        setClipboard({ ...c });
        deleteClipById(c.id);
      }
    },
    { label: 'Delete clip', danger: true, hint: 'Del', action: () => deleteClipById(c.id) }
  ];
}
function libSubmenu(t, bar) {
  const type = S.tracks[t].type;
  const saved = [...FAVS]
    .map(k => k.split(':'))
    .filter(([kind, id]) => kind === 'fac' && facById(id) && facById(id).type === type)
    .slice(0, 10);
  const items = [
    {
      label: 'Random ' + (type === 'drum' ? 'drum' : 'tone') + ' pattern',
      action: () => {
        const f = randomLibPattern(type);
        if (f) placeSrc({ kind: 'fac', id: f.id }, t, bar);
      }
    }
  ];
  const st = S.tracks[t].type === 'tone' ? ['Bass', 'Chords', 'Pad', 'Lead'] : ['Full kit', 'Hats', 'Perc', 'Fill'];
  st.forEach(role =>
    items.push({
      label: 'Random ' + role.toLowerCase(),
      action: () => {
        const f = randomLibPattern(type, x => x.role === role);
        if (f) placeSrc({ kind: 'fac', id: f.id }, t, bar);
      }
    })
  );
  if (saved.length) {
    items.push('-');
    saved.forEach(([kind, id]) =>
      items.push({ label: '★ ' + facById(id).name, action: () => placeSrc({ kind: 'fac', id }, t, bar) })
    );
  }
  items.push('-', {
    label: 'Open library…',
    action: () => {
      UI.libType = type;
      $('#main').classList.remove('nolib');
      $('#bLibT').classList.add('on');
      renderLibrary();
    }
  });
  return items;
}
export function laneMenuItems(t, bar) {
  const tr = S.tracks[t];
  return [
    { label: 'New pattern here', action: () => newPatternAt(t, bar) },
    { label: 'Paste clip here', disabled: !CLIPB, action: () => pasteClip(t, bar) },
    { label: 'Add from library', sub: libSubmenu(t, bar) },
    devOn(t)
      ? {
          label: devNm() + ' clip change at bar ' + (Math.floor(bar) + 1),
          sub: cmPickItems(
            t,
            (cmMarks().find(m => m.t === t && m.bar === Math.floor(bar)) || {}).k,
            k => setClipMark(t, bar, k),
            'Back to automatic switching'
          )
        }
      : null,
    '-',
    { label: 'Play from here', action: () => playFrom(bar) },
    { label: 'Set playhead here', action: () => setCursor(bar) },
    { label: 'Loop starts here', action: () => setLoop(bar, Math.max(bar + 1, S.loop.end)) },
    { label: 'Loop ends after this bar', action: () => setLoop(Math.min(S.loop.start, bar), bar + 1) },
    { label: 'Loop 4 bars from here', action: () => setLoop(bar, bar + 4) },
    '-',
    {
      label: tr.mute ? 'Unmute track' : 'Mute track',
      action: () => {
        pushUndo();
        tr.mute = !tr.mute;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: tr.solo ? 'Unsolo track' : 'Solo track',
      action: () => {
        pushUndo();
        tr.solo = !tr.solo;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: 'Clear this track',
      danger: true,
      disabled: !S.clips.some(c => c.t === t),
      action: () => clearTrack(t)
    }
  ];
}
export function rulerMenuItems(bar) {
  const mi = S.markers
    .map((m, i) => i)
    .filter(i => S.markers[i].bar <= bar)
    .pop();
  return [
    { label: 'Add marker here', action: () => addMarker(bar) },
    { label: 'Transpose from here…', action: () => openXpose({ scope: 'from', fromBar: bar }) },
    { label: 'Range tools (loop range)', sub: rangeMenuItems(Math.floor(bar)) },
    mi !== undefined ? { label: 'Loop section “' + S.markers[mi].name + '”', action: () => loopSection(mi) } : null,
    '-',
    { label: 'Move playhead here', action: () => setCursor(bar) },
    { label: 'Play from here', action: () => playFrom(bar) },
    '-',
    { label: 'Loop starts here', action: () => setLoop(bar, Math.max(bar + 1, S.loop.end)) },
    { label: 'Loop ends after this bar', action: () => setLoop(Math.min(S.loop.start, bar), bar + 1) },
    {
      label: 'Loop from here',
      sub: [1, 2, 4, 8, 16, 32].map(n => ({
        label: n + (n === 1 ? ' bar' : ' bars'),
        action: () => setLoop(bar, bar + n)
      }))
    },
    { label: 'Loop the whole song', action: () => setLoop(0, Math.max(1, Math.ceil(songEnd()))) },
    {
      label: 'Loop off',
      disabled: !S.loop.on,
      action: () => {
        S.loop.on = false;
        updLoopUI();
        scheduleSave();
      }
    },
    '-',
    {
      label: 'Add 8 bars',
      action: () => {
        S.bars = Math.min(MAXBARS, S.bars + 8);
        hooks.syncControls();
        renderArr();
        scheduleSave();
      }
    }
  ];
}
export function trackMenuItems(t) {
  const tr = S.tracks[t];
  return [
    {
      label: tr.mute ? 'Unmute' : 'Mute',
      action: () => {
        pushUndo();
        tr.mute = !tr.mute;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: tr.solo ? 'Unsolo' : 'Solo',
      action: () => {
        pushUndo();
        tr.solo = !tr.solo;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: 'Solo only this track',
      action: () => {
        pushUndo();
        S.tracks.forEach((x, i) => {
          x.solo = i === t;
        });
        renderArr();
        scheduleSave();
      }
    },
    {
      label: 'Clear all mute and solo',
      action: () => {
        pushUndo();
        S.tracks.forEach(x => {
          x.mute = false;
          x.solo = false;
        });
        renderArr();
        scheduleSave();
      }
    },
    '-',
    {
      label: 'MIDI channel',
      sub: Array.from({ length: 16 }, (_, i) => ({
        label: 'Channel ' + (i + 1),
        checked: tr.ch === i + 1,
        action: () => {
          pushUndo();
          tr.ch = i + 1;
          renderArr();
          scheduleSave();
        }
      }))
    },
    {
      label: 'Track velocity',
      sub: [50, 75, 90, 100, 110, 127].map(v => ({
        label: String(v),
        checked: tr.vol === v,
        action: () => {
          pushUndo();
          tr.vol = v;
          renderArr();
          scheduleSave();
        }
      }))
    },
    tr.type === 'tone'
      ? { label: 'Transpose this track…', action: () => openXpose({ scope: 'song', tracks: new Set([t]) }) }
      : null,
    { label: 'MIDI controls (CC)…', action: () => openMctl(t) },
    devOn(t) ? { label: devNm() + ' clips on this track…', action: () => clipMapOpen(t) } : null,
    devOn(t)
      ? {
          label: 'Remove this track’s clip changes',
          disabled: !cmMarks().some(m => m.t === t),
          action: () => {
            pushUndo();
            S.clipMarks = cmMarks().filter(m => m.t !== t);
            scheduleSave();
            renderArr();
          }
        }
      : null,
    {
      label: 'Timing nudge (ms)',
      sub: [-20, -10, -5, 0, 5, 10, 20].map(v => ({
        label: (v > 0 ? '+' : '') + v,
        checked: (tr.nudge || 0) === v,
        action: () => {
          pushUndo();
          tr.nudge = v;
          scheduleSave();
        }
      }))
    },
    {
      label: 'Humanize timing (ms)',
      sub: [0, 3, 6, 10, 15].map(v => ({
        label: v ? '±' + v : 'Off',
        checked: (tr.hum || 0) === v,
        action: () => {
          pushUndo();
          tr.hum = v;
          scheduleSave();
        }
      }))
    },
    {
      label: 'Send test note',
      action: () => {
        ensureAudio();
        audition(t, tr.type === 'drum' ? 0 : 60, 100);
      }
    },
    '-',
    {
      label: 'Select first clip',
      disabled: !S.clips.some(c => c.t === t),
      action: () => {
        const c = S.clips.filter(x => x.t === t).sort((a, b) => a.start - b.start)[0];
        if (c) selectClip(c.id);
      }
    },
    { label: 'Clear track', danger: true, disabled: !S.clips.some(c => c.t === t), action: () => clearTrack(t) }
  ];
}
export function libMenuItems(it) {
  const m = it.m;
  const src = { kind: it.kind, id: it.id };
  const fk = it.kind + ':' + it.id;
  const faved = FAVS.has(fk);
  const tracks = S.tracks.map((x, i) => i).filter(i => S.tracks[i].type === m.type);
  const styles = itemStyles(it);
  const k = keyLabel(m);
  return [
    { label: 'Preview', action: () => auditionLib(m) },
    {
      label: 'Preview on track…',
      sub: tracks.map(i => ({
        label: 'Track ' + (i + 1) + ': ' + S.tracks[i].name + ' (ch ' + S.tracks[i].ch + ')',
        action: () => auditionLib(m, i)
      }))
    },
    '-',
    { label: 'Add at playhead', action: () => quickAdd(src) },
    {
      label: 'Add to track at playhead',
      sub: tracks.map(i => ({
        label: 'Track ' + (i + 1) + ': ' + S.tracks[i].name,
        action: () => placeSrc(src, i, Math.floor(S.cursor))
      }))
    },
    {
      label: 'Tap a lane to place it',
      action: () => {
        UI.arm = src;
        renderLibrary();
        renderArr();
      }
    },
    '-',
    {
      label: faved ? 'Remove from Saved' : 'Save (★)',
      action: () => {
        if (faved) FAVS.delete(fk);
        else FAVS.add(fk);
        saveFavs();
        renderLibrary();
      }
    },
    styles.length
      ? {
          label: 'Show only this style',
          sub: styles.map(id => ({
            label: STYLES.find(s => s.id === id).name,
            action: () => {
              UI.libStyle = id;
              renderLibrary();
            }
          }))
        }
      : null,
    {
      label: 'Show same role (' + (m.role || (m.type === 'drum' ? 'Full kit' : 'Tone')) + ')',
      disabled: !m.role && m.type !== 'drum',
      action: () => {
        UI.libRole = m.role || 'Full kit';
        renderLibrary();
      }
    },
    k
      ? {
          label: 'Show same key (' + k + ')',
          action: () => {
            UI.libKey = k;
            renderLibrary();
          }
        }
      : null
  ];
}
