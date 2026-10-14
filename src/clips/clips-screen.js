// The "Your MC-707 clips" screen, laid out like the MC-707's display and pads: set how many clips
// each track has and what each holds.
//
// Owns: CMAP (the clips screen).
// Reads: S, PROJ, MIDI, AU, PCLAST, DEV.
// Calls up the layers through hooks (core/hooks.js).
import { $, el, toast } from '../core/dom.js';
import { DEV, DEVS, TRACK_COLORS, devNum, devOn } from '../core/device.js';
import { PROJ, S, scheduleSave } from '../core/state.js';
import { AU } from '../services/synth.js';
import { MIDI, sendMidi } from '../services/midi.js';
import { CLIP_TYPES, PCLAST, autoClipReset, cmFix, ctInfo, sendClip } from '../services/clip-switch.js';
import { hooks } from '../core/hooks.js';

/* ---- the clips screen, laid out like the MC-707: track buttons on top, the 16 pads below (as in CLIP mode) ---- */
export const CMAP = { t: 3, k: 0 };
export function clipMapOpen(t) {
  cmFix();
  if (t != null) CMAP.t = t;
  if (!devOn(CMAP.t)) CMAP.t = DEVS[DEV].tracks[0];
  CMAP.k = 0;
  let ov = $('#cmOv');
  if (ov) ov.remove();
  ov = el('div', {
    id: 'cmOv',
    class: 'ptOv',
    role: 'dialog',
    'aria-label': 'MC-707 clips',
    onpointerdown: e => {
      if (e.target.id === 'cmOv') clipMapClose();
    }
  });
  document.body.append(ov);
  clipMapRender();
}
function clipMapClose() {
  const o = $('#cmOv');
  if (o) o.remove();
  scheduleSave();
  if (typeof hooks.renderArr === 'function' && $('#arrInner')) hooks.renderArr();
  if (typeof hooks.liveRenderSceneEd === 'function') hooks.liveRenderSceneEd();
}
/* The MC-707 HOME screen, as the reference manual lays it out: project name and tempo on top, a column per track
   (number + T/D type), a clip grid showing 8 clips at a time with a scroll bar, level meters, the current
   track-clip number and name, and a command area. White on black. */
export const CM_ABBR = { drums: 'KIT', bass: 'BAS', chords: 'CHD', pad: 'PAD', lead: 'LD', pluck: 'ARP', fx: 'FX' };
/* tiny pixel icon per clip type for the preview box */
const CM_ICON = {
  drums: 'M2 9h2v3H2zM6 6h2v6H6zM10 8h2v4h-2zM14 4h2v8h-2z',
  bass: 'M1 11h4v1H1zM5 8h3v1H5zM8 11h4v1H8zM12 6h3v1h-3z',
  chords: 'M2 3h3v1H2zM2 6h3v1H2zM2 9h3v1H2zM8 4h3v1H8zM8 7h3v1H8zM8 10h3v1H8zM13 3h2v1h-2zM13 6h2v1h-2z',
  pad: 'M1 5h14v1H1zM1 8h14v1H1z',
  lead: 'M1 9h2v1H1zM3 7h2v1H3zM5 5h3v1H5zM8 7h2v1H8zM10 3h3v1h-3zM13 6h2v1h-2z',
  pluck: 'M1 10h1v1H1zM3 8h1v1H3zM5 6h1v1H5zM7 4h1v1H7zM9 6h1v1H9zM11 8h1v1h-1zM13 6h1v1h-1z',
  fx: 'M7 1h2v4H7zM7 11h2v4H7zM1 7h4v2H1zM11 7h4v2h-4z'
};
/* The MC-707 HOME screen as it looks on the unit: blue backlit display. Project name and tempo on top, a preview panel
   with CLIP t-cc and the clip name on the left, the clip grid with track tabs (1-D, 5-T) and row numbers 1-8 in the
   middle, and the CLIP EDIT menu on the right. */
function cmScreen(map, kk) {
  const tracks = DEVS[DEV].tracks,
    N = tracks.length,
    page = kk >= 8 ? 1 : 0,
    m = map[CMAP.t],
    tr = S.tracks[CMAP.t],
    ty = m.types[kk];
  /* One CSS grid for the whole screen, so every track title sits exactly over its column:
     [left panel] [row numbers] [track 1 … track N] [CLIP EDIT menu]; row 1 is the top line, rows 2-9 are clips, row 10 the meters. */
  const g = el('div', { class: 'cmLcd', style: '--cols:' + N });
  const at = (node, col, row, cs, rs) => {
    node.style.gridColumn = col + (cs ? ' / span ' + cs : '');
    node.style.gridRow = row + (rs ? ' / span ' + rs : '');
    g.append(node);
    return node;
  };
  const C0 = 3,
    CE = 3 + N; /* first track column, menu column */
  at(
    el(
      'span',
      { class: 'lcdProj' },
      String((typeof PROJ !== 'undefined' && PROJ.name) || 'Untitled')
        .toUpperCase()
        .slice(0, 12)
    ),
    1,
    1,
    2
  );
  tracks.forEach((t, i) =>
    at(
      el(
        'span',
        {
          class: 'lcdTab' + (t === CMAP.t ? ' on' : ''),
          title: 'Track ' + devNum(t) + ': ' + S.tracks[t].name,
          onclick: () => {
            CMAP.t = t;
            CMAP.k = 0;
            clipMapRender();
          }
        },
        devNum(t) + '-' + (S.tracks[t].type === 'drum' ? 'D' : 'T')
      ),
      C0 + i,
      1
    )
  );
  at(el('span', { class: 'lcdTempo' }, el('i', { class: 'lcdClk' }), (Math.round(S.bpm * 10) / 10).toFixed(1)), CE, 1);
  /* left panel: preview, CLIP t-cc, name */
  const ic = CM_ICON[ty] || CM_ICON.fx;
  const prevA = el('div', { class: 'lcdPrevA' });
  prevA.innerHTML =
    '<svg viewBox="0 0 16 16" width="100%" height="100%" shape-rendering="crispEdges"><path d="' +
    ic +
    '" fill="currentColor"/></svg>';
  at(
    el(
      'div',
      { class: 'lcdLeft' },
      el(
        'div',
        { class: 'lcdPrev' },
        prevA,
        el(
          'div',
          { class: 'lcdPrevB' },
          S.tracks[CMAP.t].name.toUpperCase().slice(0, 10),
          el('br'),
          m.n + (m.n === 1 ? ' CLIP' : ' CLIPS')
        )
      ),
      el('div', { class: 'lcdClipNo' }, 'CLIP ' + devNum(CMAP.t) + '-' + String(kk + 1).padStart(2, '0')),
      el(
        'div',
        { class: 'lcdClipName' },
        String(m.names[kk] || ctInfo(ty)[1])
          .toUpperCase()
          .slice(0, 12)
      )
    ),
    1,
    2,
    1,
    9
  );
  /* row numbers and clip cells */
  for (let r = 0; r < 8; r++) {
    const k = page * 8 + r;
    at(el('span', { class: 'lcdNum' + (k === kk ? ' on' : '') }, String(k + 1)), 2, 2 + r);
    tracks.forEach((t, i) => {
      const mm = map[t],
        used = k < mm.n,
        cur = t === CMAP.t && k === kk,
        pl = PCLAST[t] === k;
      at(
        el(
          'span',
          {
            'data-t': t,
            'data-k': k,
            class:
              'lcdCell' +
              (used ? ' used' : '') +
              (cur ? ' cur' : '') +
              (pl ? ' play' : '') +
              (t === CMAP.t ? ' col' : '') +
              (k === kk ? ' row' : ''),
            title:
              'Track ' +
              devNum(t) +
              ', clip ' +
              (k + 1) +
              (used ? ': ' + ctInfo(mm.types[k])[1] + (mm.names[k] ? ' (' + mm.names[k] + ')' : '') : ' (not used)'),
            onclick: () => {
              CMAP.t = t;
              if (k >= mm.n) mm.n = k + 1;
              CMAP.k = k;
              clipMapRender();
            }
          },
          used
            ? String(mm.names[k] || ctInfo(mm.types[k])[1].split(' ')[0])
                .slice(0, 9)
                .toUpperCase()
            : ''
        ),
        C0 + i,
        2 + r
      );
    });
  }
  /* scroll bar for clips 9-16, and a meter per track */
  at(el('span', { class: 'lcdScroll' }, el('i', { style: 'top:' + page * 50 + '%' })), 2, 10);
  tracks.forEach((t, i) => at(el('span', { class: 'lcdMeter' + (PCLAST[t] != null ? ' on' : '') }), C0 + i, 10));
  /* right: CLIP EDIT menu */
  const cmd = (lab, fn, on) => el('span', { class: 'lcdCmdI' + (on ? ' on' : ''), onclick: fn }, lab);
  at(
    el(
      'div',
      { class: 'lcdRight' },
      el('div', { class: 'lcdMenuH' }, 'CLIP EDIT'),
      cmd(
        'SWITCH',
        () => {
          if (!MIDI.out) {
            toast('Connect the MC-707 first');
            return;
          }
          sendMidi([0xc0 | (tr.ch - 1), kk], AU.ctx ? AU.ctx.currentTime : 0);
          PCLAST[CMAP.t] = kk;
          toast('Sent: track ' + devNum(CMAP.t) + ' → clip ' + (kk + 1));
          clipMapRender();
        },
        true
      ),
      cmd('TYPE', () => {
        const opts = CLIP_TYPES.filter(x =>
          tr.type === 'drum' ? x[0] === 'drums' || x[0] === 'fx' : x[0] !== 'drums'
        ).map(x => x[0]);
        m.types[kk] = opts[(opts.indexOf(m.types[kk]) + 1) % opts.length];
        clipMapRender();
      }),
      cmd('RENAME', () => {
        const i = $('.cmEdit input[type=text]');
        if (i) {
          i.focus();
          i.select();
        }
      }),
      cmd('ADD', () => {
        if (m.n < 16) {
          m.n++;
          m.types[m.n - 1] = m.types[m.n - 1] || m.types[m.n - 2];
          CMAP.k = m.n - 1;
          clipMapRender();
        }
      }),
      cmd('DELETE', () => {
        if (m.n > 1) {
          m.n--;
          CMAP.k = Math.min(CMAP.k, m.n - 1);
          clipMapRender();
        }
      })
    ),
    CE,
    2,
    1,
    9
  );
  return g;
}
export function clipMapRender() {
  const ov = $('#cmOv');
  if (!ov) return;
  ov.textContent = '';
  const map = cmFix(),
    m = map[CMAP.t],
    tr = S.tracks[CMAP.t],
    dn = DEVS[DEV].name;
  const strips = el('div', { class: 'cmStrips' });
  DEVS[DEV].tracks.forEach(t => {
    const mm = map[t];
    strips.append(
      el(
        'button',
        {
          class: 'cmStrip' + (t === CMAP.t ? ' on' : ''),
          style: '--c:' + TRACK_COLORS[t],
          onclick: () => {
            CMAP.t = t;
            CMAP.k = 0;
            clipMapRender();
          }
        },
        el('span', { class: 'cmTn' }, 'TRACK ' + devNum(t)),
        el('span', { class: 'cmName' }, S.tracks[t].name),
        el(
          'span',
          { class: 'cmDots' },
          ...Array.from({ length: mm.n }, (_, k) =>
            el('i', {
              style: 'background:' + ctInfo(mm.types[k])[2],
              title: 'Clip ' + (k + 1) + ': ' + ctInfo(mm.types[k])[1]
            })
          )
        ),
        el('span', { class: 'cmCount' }, mm.n + (mm.n === 1 ? ' clip' : ' clips')),
        el('span', { class: 'cmSel' })
      )
    );
  });
  const pads = el('div', { class: 'cmPads' });
  for (let k = 0; k < 16; k++) {
    const on = k < m.n,
      ty = ctInfo(m.types[k]);
    pads.append(
      el(
        'button',
        {
          'data-k': k,
          class: 'cmPad' + (on ? ' lit' : '') + (k === CMAP.k && on ? ' cur' : ''),
          style: '--c:' + (on ? ty[2] : '#555'),
          title: on
            ? 'Clip ' + (k + 1) + ': ' + ty[1]
            : 'Clip ' + (k + 1) + ' is not used. Click to use clips up to here.',
          onclick: () => {
            if (k >= m.n) {
              m.n = k + 1;
            }
            CMAP.k = k;
            clipMapRender();
          }
        },
        el('b', {}, String(k + 1)),
        on ? el('span', {}, m.names[k] || ty[1]) : el('span', { class: 'off' }, '—')
      )
    );
  }
  const kk = Math.min(CMAP.k, m.n - 1),
    cur = ctInfo(m.types[kk]);
  const typeBtns = el(
    'div',
    { class: 'cmTypes' },
    ...CLIP_TYPES.filter(x => (tr.type === 'drum' ? x[0] === 'drums' || x[0] === 'fx' : x[0] !== 'drums')).map(
      ([v, l, c]) =>
        el(
          'button',
          {
            class: 'btn sm' + (m.types[kk] === v ? ' on' : ''),
            style: '--c:' + c,
            onclick: () => {
              m.types[kk] = v;
              clipMapRender();
            }
          },
          el('i', { class: 'cmSw', style: 'background:' + c }),
          l
        )
    )
  );
  const box = el(
    'div',
    { class: 'ptBox cmBox' },
    el(
      'div',
      { class: 'cmHead' },
      el('h3', {}, 'Your ' + dn + ' clips'),
      el('button', { class: 'btn sm', onclick: clipMapClose }, 'Done')
    ),
    el(
      'p',
      { class: 'hint' },
      'Tell the app what is in each clip on your ' +
        dn +
        '. Like CLIP mode on the ' +
        dn +
        ': choose a track at the top, and its clips show on the 16 pads. When a track plays a different kind of part, for example a lead on your Chords track, the app switches that track to the matching clip, then back.'
    ),
    el(
      'div',
      { class: 'cmUnit' },
      strips,
      el(
        'div',
        { class: 'cmMid' },
        cmScreen(map, kk),
        el(
          'div',
          { class: 'cmCtl' },
          el('span', {}, 'Clips on this track'),
          el(
            'button',
            {
              class: 'btn sm',
              disabled: m.n <= 1,
              onclick: () => {
                m.n--;
                CMAP.k = Math.min(CMAP.k, m.n - 1);
                clipMapRender();
              }
            },
            '−'
          ),
          el('b', {}, String(m.n)),
          el(
            'button',
            {
              class: 'btn sm',
              disabled: m.n >= 16,
              onclick: () => {
                m.n++;
                m.types[m.n - 1] = m.types[m.n - 1] || m.types[m.n - 2];
                CMAP.k = m.n - 1;
                clipMapRender();
              }
            },
            '+'
          )
        )
      ),
      pads
    ),
    el(
      'div',
      { class: 'cmEdit' },
      el('b', {}, 'Clip ' + (kk + 1) + ' holds'),
      typeBtns,
      el(
        'label',
        { class: 'lvf' },
        'Name (optional)',
        el('input', {
          type: 'text',
          maxlength: 16,
          value: m.names[kk] || '',
          placeholder: 'e.g. Reese, Rhodes',
          onchange: e => {
            m.names[kk] = e.target.value.trim();
            clipMapRender();
          }
        })
      ),
      el(
        'button',
        {
          class: 'btn sm',
          disabled: !MIDI.out,
          title: MIDI.out ? 'Switch the ' + dn + ' to this clip now' : 'Connect the ' + dn + ' first',
          onclick: () => {
            sendClip(CMAP.t, kk, AU.ctx ? AU.ctx.currentTime : 0);
            toast('Sent: track ' + devNum(CMAP.t) + ' → clip ' + (kk + 1));
          }
        },
        'Switch to it now'
      )
    ),
    el(
      'label',
      { class: 'lvf cmAuto' },
      el('input', {
        type: 'checkbox',
        checked: !!S.clipAuto,
        onchange: e => {
          S.clipAuto = e.target.checked;
          autoClipReset();
          scheduleSave();
        }
      }),
      el(
        'span',
        {},
        el('b', {}, 'Switch ' + dn + ' clips automatically'),
        el(
          'small',
          {},
          ' when a track changes to a different kind of part. Song Mode clips that set their own clip number keep it.'
        )
      )
    ),
    el(
      'p',
      { class: 'hint' },
      'Use clips that hold a sound but no notes, so the ' +
        dn +
        ' does not play its own pattern on top of the app. The ' +
        dn +
        " must receive program change on each track's channel (check its MIDI settings)."
    )
  );
  ov.append(box);
}
