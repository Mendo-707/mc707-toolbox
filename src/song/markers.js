// Section markers: add, rename, loop a section, tempo and MC-707 scene changes per section.
//
// Reads: S, DEV.
// Calls up the layers through hooks (core/hooks.js).
import { clamp, el } from '../core/dom.js';
import { DEV, DEVS, devNm, devNum } from '../core/device.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { renderArr } from './arrangement.js';
import { songEnd } from '../core/song-model.js';
import { cmMarks } from '../services/clip-switch.js';
import { cmPickItems, setClipMark } from '../clips/clip-map.js';
import { playFrom, posBarNow, setLoop } from './clip-ops.js';
import { openXpose } from './transpose.js';
import { hooks } from '../core/hooks.js';

/* ---- section markers ---- */
export const sectionEnd = i => {
  const n = S.markers[i + 1];
  return n ? n.bar : Math.max(S.markers[i].bar + 1, Math.ceil(songEnd()));
};
export function loopSection(i) {
  const m = S.markers[i];
  if (!m) return;
  setLoop(m.bar, sectionEnd(i));
  S.cursor = m.bar;
  hooks.updPlayhead(m.bar);
}
export function addMarker(bar) {
  pushUndo();
  const ex = S.markers.findIndex(m => m.bar === bar);
  if (ex < 0) {
    S.markers.push({ bar, name: 'Section ' + (S.markers.length + 1) });
    S.markers.sort((a, b) => a.bar - b.bar);
  }
  scheduleSave();
  renderArr();
  renameMarker(S.markers.findIndex(m => m.bar === bar));
}
export function renameMarker(i) {
  const m = S.markers[i];
  const host = document.querySelector('.mark[data-i="' + i + '"]');
  if (!m || !host) return;
  host.textContent = '';
  const inp = el('input', {
    type: 'text',
    value: m.name,
    maxlength: 20,
    class: 'markin',
    onpointerdown: e => e.stopPropagation(),
    onclick: e => e.stopPropagation(),
    onkeydown: e => {
      e.stopPropagation();
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'Escape') {
        inp.value = m.name;
        inp.blur();
      }
    },
    onblur: () => {
      const v = inp.value.trim().slice(0, 20);
      if (v && v !== m.name) {
        pushUndo();
        m.name = v;
        scheduleSave();
      }
      renderArr();
    }
  });
  host.append(inp);
  inp.focus();
  inp.select();
}
export function markerMenu(i) {
  const m = S.markers[i];
  return [
    { label: 'Rename', action: () => renameMarker(i) },
    { label: 'Loop this section', action: () => loopSection(i) },
    {
      label: 'Tempo from here',
      sub: [
        ...[0.5, 0.75, 1, 1.25, 1.5, 2].map(f => ({
          label: '×' + f + ' (' + Math.round(S.bpm * f) + ' BPM)',
          action: () => {
            pushUndo();
            if (f === 1) delete m.bpm;
            else m.bpm = clamp(Math.round(S.bpm * f), 40, 240);
            scheduleSave();
            renderArr();
          }
        })),
        '-',
        {
          label: '−5 BPM',
          action: () => {
            pushUndo();
            m.bpm = clamp((m.bpm || S.bpm) - 5, 40, 240);
            scheduleSave();
            renderArr();
          }
        },
        {
          label: '+5 BPM',
          action: () => {
            pushUndo();
            m.bpm = clamp((m.bpm || S.bpm) + 5, 40, 240);
            scheduleSave();
            renderArr();
          }
        },
        {
          label: 'Same as the song tempo',
          disabled: !m.bpm,
          action: () => {
            pushUndo();
            delete m.bpm;
            scheduleSave();
            renderArr();
          }
        }
      ]
    },
    {
      label: 'MC-707 scene change',
      sub: [
        {
          label: 'None',
          disabled: m.scene == null,
          action: () => {
            pushUndo();
            delete m.scene;
            scheduleSave();
            renderArr();
          }
        },
        '-',
        ...Array.from({ length: 8 }, (_, g) => ({
          label: 'Scenes ' + (g * 16 + 1) + '–' + (g * 16 + 16),
          sub: Array.from({ length: 16 }, (_, k) => ({
            label: 'Scene ' + (g * 16 + k + 1),
            checked: m.scene === g * 16 + k,
            action: () => {
              pushUndo();
              m.scene = g * 16 + k;
              scheduleSave();
              renderArr();
            }
          }))
        }))
      ]
    },
    {
      label: devNm() + ' clips for this section',
      sub: DEVS[DEV].tracks.map(t => ({
        label: S.tracks[t].name + ' (track ' + devNum(t) + ')',
        sub: cmPickItems(
          t,
          (cmMarks().find(x => x.t === t && x.bar === m.bar) || {}).k,
          k => setClipMark(t, m.bar, k),
          'Back to automatic switching'
        )
      }))
    },
    { label: 'Transpose this section…', action: () => openXpose({ scope: 'section', section: i }) },
    { label: 'Play from here', action: () => playFrom(m.bar) },
    {
      label: 'Move to playhead',
      action: () => {
        pushUndo();
        m.bar = Math.floor(posBarNow());
        S.markers.sort((a, b) => a.bar - b.bar);
        scheduleSave();
        renderArr();
      }
    },
    '-',
    {
      label: 'Delete marker',
      danger: true,
      action: () => {
        pushUndo();
        S.markers.splice(i, 1);
        scheduleSave();
        renderArr();
      }
    }
  ];
}
