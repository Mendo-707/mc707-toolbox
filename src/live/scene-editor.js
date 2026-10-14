// Editing Live scenes: parts, when each plays, its MC-707 clip, and saving custom scenes.
//
// Reads: S, LV, TR, AU.
import { $, clamp, el } from '../core/dom.js';
import { TRACK_COLORS, devNm, devOn, oneKit } from '../core/device.js';
import { S } from '../core/state.js';
import { TRACK_POOLS, facById } from '../library/index.js';
import { AU } from '../services/synth.js';
import { TR } from '../services/transport.js';
import { CT_POOL, clipFor, cmFix, ctInfo, patType } from '../services/clip-switch.js';
import { cmLabel } from '../clips/clip-map.js';
import { FLASH_RH } from '../library/flash.js';
import { LV, lvStyle, mkEnv, saveLive } from './state.js';
import { lvIsFlash } from './themes.js';
import { LV_SCFX, lvSceneFx } from './moves.js';
import { FLPOOL, lvFlashIds } from './breaks.js';
import { LV_PLAY } from './scene-templates.js';
import { lvFlavor, lvPool } from '../library/pools.js';
import { liveBuild } from './set-builder.js';
import { liveReplace, lvCellClip } from './engine.js';
import { lvOn } from './cues.js';
import { liveRender, liveRenderCards } from './panels.js';
import { askDlg } from '../ui/dialogs.js';

/* ---- scene editor ---- */
const LVSK = 'mc707-live-scenes2';
export function lvSaveScenes() {
  LV.custom = true;
  try {
    localStorage.setItem(LVSK, JSON.stringify({ style: LV.style, seed: LV.seed, scenes: LV.scenes }));
  } catch (e) {}
  saveLive();
}
export function lvLoadScenes() {
  try {
    const o = JSON.parse(localStorage.getItem(LVSK) || 'null');
    if (!o || o.style !== LV.style || o.seed !== LV.seed || !Array.isArray(o.scenes) || !o.scenes.length) return false;
    const sc = o.scenes
      .filter(s => s && s.cells && s.bars > 0 && s.kind !== 'flash')
      .map(s => ({
        kind: s.kind || 'drop',
        name: String(s.name || 'Scene').slice(0, 24),
        bars: clamp(Math.round(s.bars), 1, 64),
        e: clamp(+s.e || 5, 1, 10),
        fx: s.fx || undefined,
        rh: s.rh || undefined,
        cells: Object.fromEntries(Object.entries(s.cells).filter(([t, c]) => c && facById(c.id)))
      }));
    if (!sc.length) return false;
    LV.scenes = sc.slice(0, 7);
    LV.custom = true;
    return true;
  } catch (e) {
    return false;
  }
}
export function lvClearCustom() {
  LV.custom = false;
  try {
    localStorage.removeItem(LVSK);
  } catch (e) {}
}
export function liveEditScene(i) {
  LV.edIdx = LV.edIdx === i ? -1 : i;
  liveRenderSceneEd();
}
export function liveRenderSceneEd() {
  const host = $('#lvScEd');
  if (!host) return;
  host.textContent = '';
  const i = LV.edIdx,
    sc = LV.scenes[i];
  if (i == null || i < 0 || !sc) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const st = lvStyle(),
    save = () => {
      lvSaveScenes();
      liveRenderCards();
      LV.ver++;
    };
  const name = el('input', {
    type: 'text',
    value: sc.name,
    maxlength: 24,
    'aria-label': 'Scene name',
    onchange: e => {
      sc.name = e.target.value.trim() || sc.name;
      save();
    }
  });
  const isF = lvIsFlash(sc);
  const len = el(
    'select',
    {
      'aria-label': 'Scene length',
      onchange: e => {
        sc.bars = +e.target.value;
        save();
      }
    },
    ...(isF ? [1, 2] : [1, 2, 4, 6, 8, 12, 16, 24, 32]).map(n =>
      el('option', { value: n, selected: sc.bars === n }, n + (n === 1 ? ' bar' : ' bars'))
    )
  );
  const en = el('input', {
    type: 'range',
    min: 1,
    max: 10,
    value: sc.e,
    'aria-label': 'Energy',
    oninput: e => {
      sc.e = +e.target.value;
      $('#lvScEdE').textContent = sc.e;
    },
    onchange: () => save()
  });
  const rh = isF
    ? el(
        'select',
        {
          'aria-label': 'Flash rhythm',
          onchange: e => {
            const R = FLASH_RH.find(x => x[0] === e.target.value);
            sc.rh = R[0];
            sc.bars = R[2];
            sc.cells = lvFlashIds(st, R[0], LV.mode);
            save();
            liveRenderSceneEd();
          }
        },
        ...FLASH_RH.map(([id, l, b]) =>
          el('option', { value: id, selected: sc.rh === id }, l + ' (' + b + (b === 1 ? ' bar' : ' bars') + ')')
        )
      )
    : null;
  const fx = el(
    'select',
    {
      'aria-label': 'Scene move',
      onchange: e => {
        sc.fx = e.target.value;
        save();
        if (lvOn() && LV.cur === i) lvSceneFx(sc, Math.ceil(TR.tick / 32) * 32);
      }
    },
    ...LV_SCFX.map(([v, l]) =>
      el('option', { value: v, selected: (sc.fx || (sc.kind === 'build' ? 'build' : 'none')) === v }, l)
    )
  );
  const parts = el('div', { class: 'lvScParts' });
  S.tracks.forEach((t, ti) => {
    const c = sc.cells[ti],
      pool = isF ? FLPOOL[ti] : ti === 0 && oneKit() ? 'full' : TRACK_POOLS[ti];
    const s = el('select', {
      'aria-label': t.name + ' in ' + sc.name,
      style: '--c:' + TRACK_COLORS[ti],
      onchange: e => {
        const v = e.target.value;
        if (!v) delete sc.cells[ti];
        else {
          sc.cells[ti] = { id: v, pool: (c && c.pool) || pool };
          if (c && c.play) sc.cells[ti].play = c.play;
        }
        save();
        liveRenderSceneEd();
        if (lvOn() && LV.cur === i) {
          if (v)
            liveReplace(
              ti,
              v,
              Math.ceil(TR.tick / 32) * 32,
              S.tracks[ti].type === 'tone' ? 16 : 0,
              S.tracks[ti].type === 'tone' ? 16 : 0
            );
          else
            LV.voices[ti].forEach(vv => {
              vv.env = mkEnv(1, 0, Math.ceil(TR.tick / 32) * 32, 16);
            });
        }
      }
    });
    s.append(el('option', { value: '' }, '— off —'));
    const ids = isF
      ? [
          ...new Set([
            ...(c ? [c.id] : []),
            ...lvPool(st, pool).filter(id => facById(id).flash === sc.rh),
            ...lvPool(st, pool)
          ])
        ]
      : [...new Set([...(c ? [c.id] : []), ...lvFlavor(lvPool(st, pool), LV.flavor), ...lvPool(st, pool)])].slice(
          0,
          80
        );
    ids.forEach(id => {
      const f = facById(id);
      if (f) s.append(el('option', { value: id, selected: c && c.id === id }, f.name));
    });
    if (!isF && S.tracks[ti].type === 'tone') {
      const mm = cmFix()[ti],
        own = patType({ pool });
      [...new Set(mm.types.slice(0, mm.n))]
        .filter(ty => CT_POOL[ty] && ty !== own)
        .forEach(ty => {
          const k = clipFor(ti, ty),
            og = el('optgroup', { label: ctInfo(ty)[1] + ' parts (switches to clip ' + (k + 1) + ')' });
          [
            ...new Set([
              ...(c && patType(facById(c.id)) === ty ? [c.id] : []),
              ...lvFlavor(lvPool(st, CT_POOL[ty]), LV.flavor)
            ])
          ]
            .slice(0, 40)
            .forEach(id => {
              const f = facById(id);
              if (f) og.append(el('option', { value: id, selected: c && c.id === id }, f.name));
            });
          s.append(og);
        });
    }
    const pl = el(
      'select',
      {
        'aria-label': t.name + ' plays',
        class: 'lvPlay',
        disabled: !c,
        title: 'Which bars of the scene this part plays',
        onchange: e => {
          const cc = sc.cells[ti];
          if (!cc) return;
          if (e.target.value === 'all') delete cc.play;
          else cc.play = e.target.value;
          save();
        }
      },
      ...LV_PLAY.map(([v, l]) => el('option', { value: v, selected: ((c && c.play) || 'all') === v }, l))
    );
    const mm = cmFix()[ti],
      cl = el(
        'select',
        {
          'aria-label': t.name + ' MC-707 clip',
          class: 'lvClipSel',
          disabled: !c,
          title: 'Which ' + devNm() + ' clip this track plays in this scene',
          onchange: e => {
            const cc = sc.cells[ti];
            if (!cc) return;
            if (e.target.value === '') delete cc.clip;
            else cc.clip = +e.target.value;
            save();
            if (lvOn() && LV.cur === i) lvCellClip(ti, cc, AU.ctx.currentTime + 0.05);
          }
        },
        el('option', { value: '' }, S.clipAuto ? 'Clip: auto' : 'Clip: as is')
      );
    for (let k = 0; k < mm.n; k++) cl.append(el('option', { value: k, selected: c && c.clip === k }, cmLabel(ti, k)));
    parts.append(
      el(
        'label',
        { class: 'lvf' + (devOn(ti) ? '' : ' devoff') },
        el('span', { style: 'color:' + TRACK_COLORS[ti] + ';font-weight:700' }, t.name),
        s,
        el('div', { class: 'lvScPair' }, pl, cl)
      )
    );
  });
  const move = d => {
    const j = i + d;
    if (j < 0 || j >= LV.scenes.length) return;
    [LV.scenes[i], LV.scenes[j]] = [LV.scenes[j], LV.scenes[i]];
    if (LV.cur === i) LV.cur = j;
    else if (LV.cur === j) LV.cur = i;
    LV.edIdx = j;
    save();
    liveRenderSceneEd();
  };
  host.append(
    el(
      'div',
      { class: 'lvh' },
      el('h3', {}, 'Edit scene ' + (i + 1)),
      el(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            LV.edIdx = -1;
            liveRenderSceneEd();
          }
        },
        '✕ Close'
      )
    ),
    isF
      ? el(
          'div',
          { class: 'lvrow' },
          el('label', { class: 'lvf' }, 'Name', name),
          el('label', { class: 'lvf' }, 'Rhythm', rh),
          el('label', { class: 'lvf' }, 'Length', len)
        )
      : el(
          'div',
          { class: 'lvrow' },
          el('label', { class: 'lvf' }, 'Name', name),
          el('label', { class: 'lvf' }, 'Length', len),
          el('label', { class: 'lvf' }, 'Energy', en, el('b', { id: 'lvScEdE' }, String(sc.e))),
          el('label', { class: 'lvf' }, 'Move', fx)
        ),
    el(
      'div',
      { class: 'hint' },
      isF
        ? 'A flash is a quick break: every part hits the same rhythm with silence in between, a roll or run pulls you back, and the loop that was playing slams back in on the downbeat. Pick a rhythm to set all the parts at once, or change any part below. Parts left off stay silent during the flash.'
        : 'Under each part, choose which bars it plays, so parts can come and go inside the loop. Energy decides how the next scene lands: a jump of 4 or more is treated as a drop. Changes to the playing scene take effect on the next bar.'
    ),
    parts,
    el(
      'div',
      { class: 'lvBtns' },
      el('button', { class: 'btn sm', disabled: i === 0, onclick: () => move(-1) }, '◀ Move left'),
      el('button', { class: 'btn sm', disabled: i === LV.scenes.length - 1, onclick: () => move(1) }, 'Move right ▶'),
      el(
        'button',
        {
          class: 'btn sm',
          disabled: LV.scenes.length >= 7,
          title:
            LV.scenes.length >= 7
              ? 'Up to 7 scenes, on pads 1–7 (pad 8 is Break). Delete one to make room.'
              : 'Copy this scene next to it',
          onclick: () => {
            LV.scenes.splice(i + 1, 0, JSON.parse(JSON.stringify({ ...sc, name: (sc.name + ' copy').slice(0, 24) })));
            LV.edIdx = i + 1;
            save();
            liveRenderSceneEd();
          }
        },
        'Duplicate'
      ),
      el(
        'button',
        {
          class: 'btn sm',
          disabled: LV.scenes.length <= 1,
          onclick: () => {
            LV.scenes.splice(i, 1);
            if (LV.cur >= LV.scenes.length) LV.cur = LV.scenes.length - 1;
            LV.edIdx = -1;
            LV.cues = LV.cues.filter(c => c.type !== 'scene');
            save();
            liveRenderSceneEd();
          }
        },
        'Delete'
      ),
      el(
        'button',
        {
          class: 'btn sm',
          onclick: async () => {
            const ok = await askDlg({
              title: 'Go back to the generated scenes?',
              text: 'Your edits to these scenes will be replaced.',
              ok: 'Reset scenes'
            });
            if (!ok) return;
            lvClearCustom();
            LV.edIdx = -1;
            liveBuild();
            liveRender();
          }
        },
        'Reset all scenes'
      )
    )
  );
}
