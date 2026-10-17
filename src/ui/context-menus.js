// Right-click menus for the transport, Play pattern, the sample grabber and the clips screen, and
// the one listener that opens them.
//
// Reads: S, ED, TR, MIDI, AU, GRAB, CMAP, DEV.
import { $, $$, toast } from '../core/dom.js';
import { DEV, DEVS, devNm, devNum } from '../core/device.js';
import { ED, S, curClip, scheduleSave } from '../core/state.js';
import { patOf } from '../core/song-model.js';
import { renderEditor } from '../song/editor.js';
import { AU } from '../services/synth.js';
import { MIDI } from '../services/midi.js';
import { TR, startPat, togglePlay } from '../services/transport.js';
import { CLIP_TYPES, cmFix, ctInfo, sendClip } from '../services/clip-switch.js';
import { CMAP, clipMapRender } from '../clips/clips-screen.js';
import { updPlayhead } from './transport-view.js';
import { toneTracks } from '../song/library-panel.js';
import { syncControls } from './controls.js';
import { showMenu } from './menu.js';
import { playFrom, updLoopUI } from '../song/clip-ops.js';
import { GRAB, grabKeys, grabName, grabOpen, grabRenderPop, grabSave, grabStart, grabStop } from './grabber.js';
import { lvKeyMenu, lvPadMenu, lvSceneMenu, lvTrackMenu } from './live-menus.js';
import { openAudio } from '../song/audio-dialog.js';
import { askDlg } from './dialogs.js';
import { zenOpen } from '../zen/zc-editor.js';

/* Song Mode transport */
function songPlayMenu() {
  const mi = S.markers
    .map((m, i) => i)
    .filter(i => S.markers[i].bar <= S.cursor)
    .pop();
  return [
    { label: TR.playing && TR.mode === 'song' ? 'Stop' : 'Play from the playhead', action: togglePlay },
    { label: 'Play from the start', action: () => playFrom(0) },
    mi !== undefined
      ? { label: 'Play from “' + S.markers[mi].name + '”', action: () => playFrom(S.markers[mi].bar) }
      : null,
    S.markers.length
      ? {
          label: 'Play from section',
          sub: S.markers.map((m, i) => ({
            label: m.name + ' (bar ' + (m.bar + 1) + ')',
            action: () => playFrom(m.bar)
          }))
        }
      : null,
    '-',
    {
      label: S.loop.on ? 'Loop off' : 'Loop on',
      action: () => {
        S.loop.on = !S.loop.on;
        updLoopUI();
        scheduleSave();
      }
    },
    {
      label: 'Metronome',
      checked: !!S.metro,
      action: () => {
        S.metro = !S.metro;
        syncControls();
        scheduleSave();
      }
    },
    {
      label: 'Follow the playhead',
      checked: S.follow !== false,
      action: () => {
        S.follow = S.follow === false;
        syncControls();
        scheduleSave();
      }
    },
    '-',
    { label: 'Record audio…', action: () => openAudio() },
    {
      label: 'Grab a sample…',
      action: () => {
        const b = $('#grabBtn');
        if (b) grabOpen(b);
      }
    }
  ];
}
function edPlayMenu() {
  const c = curClip(),
    p = c && patOf(c);
  if (!p) return [];
  return [
    {
      label: 'Play pattern on…',
      sub: (p.type === 'tone' ? toneTracks() : DEVS[DEV].tracks.filter(i => S.tracks[i].type === 'drum')).map(i => ({
        label: 'Track ' + devNum(i) + ': ' + S.tracks[i].name + (i === c.t ? ' (own)' : ''),
        action: () => {
          if (p.type === 'tone') {
            ED.playOn = i;
            ED.playOnClip = c.id;
          }
          startPat(p, i, ED.aud);
          renderEditor();
        }
      }))
    },
    ...(p.bars > 1
      ? [
          {
            label: 'Loop just one bar',
            sub: Array.from({ length: p.bars }, (_, b) => ({
              label: 'Bar ' + (b + 1),
              action: () => {
                ED.aud = [b, b + 1];
                startPat(p, c.t, ED.aud);
              }
            })).concat([
              {
                label: 'Whole pattern',
                action: () => {
                  ED.aud = null;
                  startPat(p, c.t, null);
                }
              }
            ])
          }
        ]
      : []),
    { label: 'Play the song from this clip', action: () => playFrom(c.start) },
    {
      label: 'Grab this pattern as a sample…',
      action: () => {
        GRAB.src = 't' + c.t;
        GRAB.bars = [1, 2, 4, 8, 16].includes(p.bars) ? p.bars : 4;
        const b = $('#grabBtn');
        S.cursor = Math.floor(c.start);
        updPlayhead(S.cursor);
        if (b) grabOpen(b);
      }
    }
  ];
}
/* Sample grabber: quick grabs */
function grabMenu(anchor) {
  return [
    { label: 'Grab from ' + grabName(GRAB.src), disabled: true },
    ...[1, 2, 4, 8, 16].map(n => ({
      label: 'Grab ' + n + (n === 1 ? ' bar' : ' bars') + ' now',
      disabled: GRAB.on,
      action: () => {
        GRAB.bars = n;
        grabStart();
      }
    })),
    {
      label: 'Grab from',
      sub: grabKeys().map(k => ({
        label: grabName(k),
        checked: GRAB.src === k,
        action: () => {
          GRAB.src = k;
          try {
            localStorage.setItem('mc707-grab-src', k);
          } catch (e) {}
          grabRenderPop();
        }
      }))
    },
    GRAB.on ? { label: 'Stop grabbing', action: grabStop } : null,
    '-',
    { label: 'Open the grabber', action: () => grabOpen(anchor) },
    { label: 'Save the last grab', disabled: !GRAB.list.length, action: () => grabSave(GRAB.list[0]) }
  ];
}
/* MC-707 clips screen: one clip */
function cmClipMenu(t, k) {
  const m = cmFix()[t],
    used = k < m.n,
    tr = S.tracks[t],
    re = () => {
      scheduleSave();
      clipMapRender();
    };
  const types = CLIP_TYPES.filter(x => (tr.type === 'drum' ? x[0] === 'drums' || x[0] === 'fx' : x[0] !== 'drums'));
  return [
    {
      label:
        'Track ' +
        devNum(t) +
        ', clip ' +
        (k + 1) +
        (used ? ' · ' + (m.names[k] || ctInfo(m.types[k])[1]) : ' (not used)'),
      disabled: true
    },
    {
      label: used ? 'Holds' : 'Use it for',
      sub: types.map(([v, l]) => ({
        label: l,
        checked: used && m.types[k] === v,
        action: () => {
          if (k >= m.n) m.n = k + 1;
          m.types[k] = v;
          CMAP.t = t;
          CMAP.k = k;
          re();
        }
      }))
    },
    {
      label: 'Rename…',
      disabled: !used,
      action: async () => {
        const n = await askDlg({
          title: 'Name clip ' + (k + 1),
          input: true,
          def: m.names[k] || '',
          ok: 'Save'
        });
        if (n != null) {
          m.names[k] = n.slice(0, 16);
          re();
        }
      }
    },
    {
      label: 'Edit ZenCore…',
      action: () => zenOpen(t, k)
    },
    {
      label: 'Edit ZenCore: the track sound…',
      action: () => zenOpen(t, 16)
    },
    {
      label: 'Switch the ' + devNm() + ' to it now',
      disabled: !used || !MIDI.out,
      action: () => {
        sendClip(t, k, AU.ctx ? AU.ctx.currentTime : 0);
        toast('Sent: track ' + devNum(t) + ' → clip ' + (k + 1));
      }
    },
    '-',
    {
      label: 'Duplicate into the next clip',
      disabled: !used || m.n >= 16,
      action: () => {
        m.types.splice(k + 1, 0, m.types[k]);
        m.types.length = 16;
        m.names.splice(k + 1, 0, m.names[k]);
        m.n++;
        re();
      }
    },
    {
      label: 'Use clips up to here',
      disabled: k + 1 === m.n,
      action: () => {
        m.n = k + 1;
        re();
      }
    },
    {
      label: 'Remove this clip',
      danger: true,
      disabled: !used || m.n <= 1,
      action: () => {
        m.types.splice(k, 1);
        m.types.push(m.types[m.types.length - 1]);
        m.names.splice(k, 1);
        m.n--;
        CMAP.k = Math.min(CMAP.k, m.n - 1);
        re();
      }
    }
  ];
}
function grabRowMenu(i) {
  const r = GRAB.list[i];
  if (!r) return [];
  return [
    { label: r.name, disabled: true },
    { label: 'Save', action: () => grabSave(r) },
    {
      label: 'Save all grabs',
      disabled: GRAB.list.length < 2,
      action: async () => {
        for (const x of GRAB.list) await grabSave(x);
      }
    },
    {
      label: 'Remove',
      danger: true,
      action: () => {
        URL.revokeObjectURL(r.url);
        GRAB.list.splice(i, 1);
        grabRenderPop();
      }
    }
  ];
}
document.addEventListener('contextmenu', e => {
  if (e.defaultPrevented) return;
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.matches('input[type=text],input[type=number],textarea')) return;
  let items = null,
    m;
  const q = s => t.closest(s);
  if (q('.lvPad')) items = lvPadMenu(+q('.lvPad').id.slice(5));
  else if (q('.lvTile')) items = lvSceneMenu(+q('.lvTile').id.slice(6));
  else if (q('.lvClip,.thClip')) {
    q('.lvClip,.thClip').click();
    e.preventDefault();
    return;
  } else if (q('.lvLab')) items = lvTrackMenu(+q('.lvLab').id.slice(5));
  else if (q('.lvRow')) {
    const rows = [...$$('#lvInner .lvRow')];
    const i = rows.indexOf(q('.lvRow'));
    if (i >= 0) items = lvTrackMenu(i);
  } else if (q('.lvM')) items = lvTrackMenu(+q('.lvM').id.slice(3));
  else if (q('.lvK')) items = lvKeyMenu(+q('.lvK').id.slice(3));
  else if (q('#bPlay')) items = songPlayMenu();
  else if (q('#bAud')) items = edPlayMenu();
  else if (q('#grabBtn,#lvGrab')) items = grabMenu(q('#grabBtn,#lvGrab'));
  else if (q('.grabRow')) items = grabRowMenu([...$$('#grabPop .grabRow')].indexOf(q('.grabRow')));
  else if ((m = q('.cmPad'))) items = cmClipMenu(CMAP.t, +m.dataset.k);
  else if ((m = q('.lcdCell')) && m.dataset.t != null) items = cmClipMenu(+m.dataset.t, +m.dataset.k);
  if (items && items.length) {
    e.preventDefault();
    showMenu(e.clientX, e.clientY, items);
  }
});
