import { $, $$, toast } from '../core/dom.js';
import { DEV, DEVS, devNum, devOn } from '../core/device.js';
import { S, scheduleSave } from '../core/state.js';
import { curClip, patOf } from '../core/song-model.js';
import { ED, renderEditor } from '../song/editor.js';
import { AU, ensureAudio } from '../services/synth.js';
import { MIDI } from '../services/midi.js';
import { TR, startPat, togglePlay } from '../services/transport.js';
import { CLIPPIN, CLIP_TYPES, PCLAST, cmFix, cmPickItems, ctInfo, devNm, sendClip } from '../clips/clip-map.js';
import { CMAP, clipMapRender, updPlayhead } from '../clips/clips-screen.js';
import { toneTracks } from '../song/library-panel.js';
import { syncControls } from '../song/controls.js';
import { TRACK_POOLS, facById } from '../library/index.js';
import { playFrom, showMenu, updLoopUI } from '../song/clip-ops.js';
import { GRAB, grabKeys, grabName, grabOpen, grabRenderPop, grabSave, grabStart, grabStop } from '../song/grabber.js';
import { openAudio } from '../song/audio-dialog.js';
import { LV, LV_ACTS, LV_ACTS_KBD, NOTEN, envAt, lvRand, mkEnv, saveLive } from '../live/state.js';
import { actLabel, lvIsFlash } from '../live/themes.js';
import { LV_SCFX } from '../live/moves.js';
import { liveRenderSceneEd, lvSaveScenes } from '../live/scene-editor.js';
import { LV_BRK, LV_BRKLEN } from '../live/breaks.js';
import { liveSwapIds, lvProg } from '../live/pools.js';
import { lvIds, lvTop } from '../live/engine.js';
import { liveCue, liveKeyCue, liveMute, lvBoundary, lvEffMute, lvOn, lvSortCues } from '../live/cues.js';
import { livePadDown, livePadUp } from '../live/pads.js';
import { liveRender, liveRenderCards, liveRenderPads } from '../live/ui.js';
import { askDlg } from './dialogs.js';

/* ===== Right-click menus around the app (Song Mode's arrangement, editor and library have their own) ===== */
/* Live: one track — mute, new or chosen pattern, stop it, its MC-707 clip */
function lvTrackMenu(t) {
  const tr = S.tracks[t],
    on = lvOn(),
    v = on ? lvTop(t) : null,
    sc = LV.scenes[LV.cur],
    cell = sc && sc.cells[t];
  const cur = v ? v.f.id : cell ? cell.id : null;
  const ref = S.tracks[t].type === 'tone' ? (on ? lvTop(t === 4 ? 3 : 4) : null) : null,
    prog = ref && lvProg(ref.f);
  let ids = liveSwapIds(t).filter(id => id !== cur);
  if (prog)
    ids = [...ids.filter(id => lvProg(facById(id)) === prog), ...ids.filter(id => lvProg(facById(id)) !== prog)];
  const choose = id => {
    if (on) {
      LV.cues = LV.cues.filter(c => !(c.type === 'swap' && c.ids[t] && Object.keys(c.ids).length === 1));
      const f = facById(id);
      if (!lvTop(t)) {
        LV.cues.push({ type: 'guest', t, id, tick: lvBoundary(1) });
      } else
        LV.cues.push({
          type: 'swap',
          group: 't' + t,
          ids: { [t]: id },
          tick: lvBoundary(Math.min(4, (f && f.bars) || 1))
        });
      lvSortCues();
      LV.ver++;
    } else if (sc) {
      sc.cells[t] = {
        id,
        pool: (cell && cell.pool) || TRACK_POOLS[t],
        ...(cell && cell.play ? { play: cell.play } : {})
      };
      lvSaveScenes();
      liveRenderCards();
      liveRenderSceneEd();
      LV.ver++;
    }
  };
  return [
    { label: tr.name + (cur ? ' · ' + facById(cur).name : ' · silent'), disabled: true },
    { label: lvEffMute(t) ? 'Unmute' : 'Mute', disabled: !on, action: () => liveMute([t]) },
    {
      label: 'Mute everything else',
      disabled: !on,
      action: () => {
        const others = DEVS[DEV].tracks.filter(i => i !== t && !lvEffMute(i));
        if (lvEffMute(t)) liveMute([t]);
        if (others.length) liveMute(others);
      }
    },
    {
      label: 'Unmute all',
      disabled: !on,
      action: () => {
        const m = DEVS[DEV].tracks.filter(lvEffMute);
        if (m.length) liveMute(m);
      }
    },
    '-',
    {
      label: 'New pattern (next bar)',
      disabled: !ids.length,
      action: () =>
        choose(lvRand(prog ? ids.slice(0, Math.max(3, ids.filter(id => lvProg(facById(id)) === prog).length)) : ids))
    },
    {
      label: 'Choose a pattern',
      disabled: !ids.length,
      sub: ids.slice(0, 24).map(id => ({ label: facById(id).name, action: () => choose(id) }))
    },
    {
      label: 'Stop this part',
      disabled: !(on ? v : cell),
      action: () => {
        if (on) {
          const tk = lvBoundary(1);
          LV.voices[t].forEach(x => {
            x.env = mkEnv(envAt(x.env, tk), 0, tk, S.tracks[t].type === 'tone' ? 16 : 2);
          });
          LV.ver++;
        } else {
          delete sc.cells[t];
          lvSaveScenes();
          liveRenderCards();
          liveRenderSceneEd();
        }
      }
    },
    ...(devOn(t)
      ? [
          '-',
          {
            label: devNm() + ' clip',
            sub: cmPickItems(
              t,
              CLIPPIN[t] != null ? CLIPPIN[t] : null,
              k => {
                if (k < 0) {
                  delete CLIPPIN[t];
                  delete PCLAST[t];
                  return;
                }
                ensureAudio();
                CLIPPIN[t] = k;
                sendClip(t, k, AU.ctx.currentTime);
              },
              'Back to automatic'
            )
          }
        ]
      : [])
  ];
}
/* Live: a scene card */
function lvSceneMenu(i) {
  const sc = LV.scenes[i],
    on = lvOn();
  if (!sc) return [];
  const move = d => {
    const j = i + d;
    if (j < 0 || j >= LV.scenes.length) return;
    [LV.scenes[i], LV.scenes[j]] = [LV.scenes[j], LV.scenes[i]];
    if (LV.cur === i) LV.cur = j;
    else if (LV.cur === j) LV.cur = i;
    lvSaveScenes();
    liveRenderCards();
    liveRenderPads();
  };
  return [
    { label: i + 1 + '. ' + sc.name, disabled: true },
    { label: on ? 'Launch (as set in Launch on)' : 'Start from here', action: () => liveCue(i) },
    {
      label: 'Launch on the next bar',
      disabled: !on || lvIsFlash(sc),
      action: () => {
        LV.cues = LV.cues.filter(c => c.type !== 'scene');
        LV.cues.push({ type: 'scene', idx: i, tick: lvBoundary(1) });
        lvSortCues();
        LV.ver++;
      }
    },
    {
      label: 'Drop into it (hard cut)',
      disabled: !on || lvIsFlash(sc),
      action: () => {
        LV.cues = LV.cues.filter(c => c.type !== 'scene');
        LV.cues.push({ type: 'scene', idx: i, tick: lvBoundary(1), hard: true });
        lvSortCues();
        LV.ver++;
      }
    },
    '-',
    {
      label: 'Edit…',
      action: () => {
        LV.edIdx = i;
        liveRenderSceneEd();
        const h = $('#lvScEd');
        if (h) h.scrollIntoView({ block: 'nearest' });
      }
    },
    {
      label: 'Rename…',
      action: async () => {
        const n = await askDlg({ title: 'Rename scene', input: true, def: sc.name, ok: 'Rename' });
        if (n) {
          sc.name = n.slice(0, 24);
          lvSaveScenes();
          liveRenderCards();
          liveRenderPads();
          liveRenderSceneEd();
        }
      }
    },
    {
      label: 'Energy',
      sub: Array.from({ length: 10 }, (_, k) => ({
        label: String(k + 1),
        checked: sc.e === k + 1,
        action: () => {
          sc.e = k + 1;
          lvSaveScenes();
          liveRenderCards();
        }
      }))
    },
    {
      label: 'Length',
      disabled: lvIsFlash(sc),
      sub: [1, 2, 4, 8, 16, 32].map(n => ({
        label: n + (n === 1 ? ' bar' : ' bars'),
        checked: sc.bars === n,
        action: () => {
          sc.bars = n;
          lvSaveScenes();
          liveRenderCards();
          LV.ver++;
        }
      }))
    },
    {
      label: 'Move',
      sub: LV_SCFX.map(([v, l]) => ({
        label: l,
        checked: (sc.fx || (sc.kind === 'build' ? 'build' : 'none')) === v,
        action: () => {
          sc.fx = v;
          lvSaveScenes();
          liveRenderCards();
        }
      }))
    },
    '-',
    {
      label: 'Duplicate',
      disabled: LV.scenes.length >= 7,
      action: () => {
        LV.scenes.splice(i + 1, 0, JSON.parse(JSON.stringify({ ...sc, name: (sc.name + ' copy').slice(0, 24) })));
        lvSaveScenes();
        liveRenderCards();
        liveRenderPads();
      }
    },
    {
      label: 'Replace with the loop playing now',
      disabled: !on || i === LV.cur,
      action: () => {
        const keep = LV.cur;
        LV.cur = i;
        const ids = lvIds(),
          cells = {};
        ids.forEach((id, t) => {
          if (id && devOn(t) && !lvEffMute(t)) {
            const f = facById(id);
            cells[t] = { id, pool: (f && f.pool) || TRACK_POOLS[t] };
          }
        });
        LV.cur = keep;
        if (Object.keys(cells).length) {
          sc.cells = cells;
          lvSaveScenes();
          liveRenderCards();
          toast('Scene ' + (i + 1) + ' now holds the loop that is playing');
        }
      }
    },
    { label: 'Move left', disabled: i === 0, action: () => move(-1) },
    { label: 'Move right', disabled: i === LV.scenes.length - 1, action: () => move(1) },
    {
      label: 'Delete',
      danger: true,
      disabled: LV.scenes.length <= 1,
      action: () => {
        LV.scenes.splice(i, 1);
        if (LV.cur >= LV.scenes.length) LV.cur = LV.scenes.length - 1;
        LV.edIdx = -1;
        LV.cues = LV.cues.filter(c => c.type !== 'scene');
        lvSaveScenes();
        liveRenderCards();
        liveRenderPads();
        liveRenderSceneEd();
      }
    }
  ];
}
/* Live: a pad — trigger it, or give it another job */
function lvPadMenu(i) {
  const a = LV.acts[i],
    set = v => {
      LV.acts[i] = v;
      saveLive();
      liveRenderPads();
    };
  const grp = (label, list) => ({
    label,
    sub: list.map(v => ({ label: actLabel(v), checked: a === v, action: () => set(v) }))
  });
  const items = [
    { label: 'Pad ' + (i + 1) + ': ' + actLabel(a), disabled: true },
    {
      label: 'Trigger now',
      action: () => {
        livePadDown(i);
        setTimeout(() => livePadUp(i), 150);
      }
    },
    '-',
    grp('Scenes', [...LV.scenes.map((_, k) => 's' + k), 'next', 'prev', 'stop']),
    grp('Swaps', ['sw:drums', 'sw:perc', 'sw:bass', 'sw:chords', 'sw:pad', 'sw:lead']),
    grp('Mutes', ['mu:drums', 'mu:bass', 'mu:chords', 'mu:lead', ...DEVS[DEV].tracks.map(t => 'mt:' + t)]),
    grp('Builds and breaks', ['brk', 'fill', 'bd', 'rise:up', 'rise:down', 'stut:4', 'stut:8', 'stut:16']),
    grp('Energy and control', ['en:up', 'en:down', 'auto', 'lock']),
    grp(
      'Key',
      NOTEN.map((_, k) => 'key:' + k)
    ),
    grp(
      'Scatter (hold)',
      Array.from({ length: 16 }, (_, k) => 'sc:' + k)
    )
  ];
  if (a === 'brk')
    items.push(
      '-',
      {
        label: 'Break style',
        sub: LV_BRK.map(([v, l]) => ({
          label: l,
          checked: LV.brkStyle === v,
          action: () => {
            LV.brkStyle = v;
            saveLive();
            liveRender();
          }
        }))
      },
      {
        label: 'Break length',
        sub: LV_BRKLEN.map(([v, l]) => ({
          label: l,
          checked: LV.brkLen === v,
          action: () => {
            LV.brkLen = v;
            saveLive();
            liveRender();
          }
        }))
      }
    );
  const def = (LV.padLayout === 'kbd' ? LV_ACTS_KBD : LV_ACTS)[i];
  items.push('-', {
    label: 'Back to default (' + actLabel(def) + ')',
    disabled: a === def,
    action: () => set(def)
  });
  return items;
}
function lvKeyMenu(i) {
  return [
    { label: 'Key of ' + NOTEN[i], disabled: true },
    {
      label: 'Change to ' + NOTEN[i] + ' minor',
      checked: LV.key === i && LV.mode === 'minor',
      action: () => liveKeyCue(i, 'minor')
    },
    {
      label: 'Change to ' + NOTEN[i] + ' major',
      checked: LV.key === i && LV.mode === 'major',
      action: () => liveKeyCue(i, 'major')
    },
    '-',
    { label: 'Up a fifth (' + NOTEN[(LV.key + 7) % 12] + ')', action: () => liveKeyCue((LV.key + 7) % 12) },
    {
      label:
        'Relative ' +
        (LV.mode === 'minor' ? 'major (' + NOTEN[(LV.key + 3) % 12] + ')' : 'minor (' + NOTEN[(LV.key + 9) % 12] + ')'),
      action: () =>
        LV.mode === 'minor' ? liveKeyCue((LV.key + 3) % 12, 'major') : liveKeyCue((LV.key + 9) % 12, 'minor')
    }
  ];
}
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
