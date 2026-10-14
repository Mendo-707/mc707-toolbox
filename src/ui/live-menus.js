// Right-click menus in Live Mode: scene cards, pads, tracks and keys.
//
// Reads: S, LV, AU, PCLAST, CLIPPIN, DEV.
import { $, toast } from '../core/dom.js';
import { DEV, DEVS, devNm, devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { TRACK_POOLS, facById } from '../library/index.js';
import { AU, ensureAudio } from '../services/synth.js';
import { CLIPPIN, PCLAST, sendClip } from '../services/clip-switch.js';
import { cmPickItems } from '../clips/clip-map.js';
import { LV, LV_ACTS, LV_ACTS_KBD, NOTEN, envAt, lvRand, mkEnv, saveLive } from '../live/state.js';
import { actLabel, lvIsFlash } from '../live/themes.js';
import { LV_SCFX } from '../live/moves.js';
import { liveRenderSceneEd, lvSaveScenes } from '../live/scene-editor.js';
import { LV_BRK, LV_BRKLEN } from '../live/breaks.js';
import { lvProg } from '../library/pools.js';
import { liveSwapIds } from '../live/set-builder.js';
import { lvIds, lvTop } from '../live/engine.js';
import { liveCue, liveKeyCue, liveMute, lvBoundary, lvEffMute, lvOn, lvSortCues } from '../live/cues.js';
import { livePadDown, livePadUp } from '../live/pads.js';
import { liveRender, liveRenderCards, liveRenderPads } from '../live/panels.js';
import { askDlg } from './dialogs.js';

/* Live: one track — mute, new or chosen pattern, stop it, its MC-707 clip */
export function lvTrackMenu(t) {
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
export function lvSceneMenu(i) {
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
export function lvPadMenu(i) {
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
export function lvKeyMenu(i) {
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
