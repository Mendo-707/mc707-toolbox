// The MFX page (a tone's or a kit's multi-effect, with each type's own parameters) and the drum kit
// pages: the kit, each key's instrument, and the six drum compressors.
//
// Reads: S (the drum map, to show your pads first), the sound through the editor's ctx.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { LANES } from '../core/theory.js';
import { ctl, group } from './zc-widgets.js';
import { mfxNames, mfxParams, mfxText, shown, stored } from './zc-mfx.js';
import { KIT_LOW, pk } from './zc-tone.js';
import { pageEq } from './zc-panels.js';

export function pageMfx(ctx) {
  const type = ctx.get('MFX.mfxType'),
    sps = mfxParams(type);
  const typeSel = el('select', { onchange: e => ctx.mfxType(+e.target.value) });
  mfxNames().forEach((n, i) =>
    typeSel.append(el('option', { value: i, selected: i === type }, String(i).padStart(2, '0') + ' ' + n))
  );
  const params = sps.map((sp, i) => {
    const key = 'MFX.param_' + (i + 1),
      known = ctx.snd.known.has(key),
      v = shown(sp, ctx.get(key));
    const box = el('label', {
      class: 'zcC' + (known ? '' : ' unk'),
      title: 'MFX parameter ' + (i + 1) + ' (stored ' + ctx.get(key) + ')'
    });
    box.append(el('span', { class: 'zcL' }, sp.name));
    if (sp.kind === 'L' && sp.list.length === 2 && sp.list[1] === 'ON') {
      box.classList.add('sw');
      box.append(
        el(
          'button',
          { type: 'button', class: 'zcSw' + (v ? ' on' : ''), onclick: () => ctx.set(key, v ? 0 : 1, true) },
          v ? 'ON' : 'OFF'
        )
      );
    } else if (sp.kind === 'L') {
      const s = el('select', { onchange: e => ctx.set(key, +e.target.value, true) });
      sp.list.forEach((n, j) =>
        s.append(el('option', { value: j, selected: j === v }, n + (sp.unit && /\d$/.test(n) ? ' ' + sp.unit : '')))
      );
      box.append(s);
    } else {
      const step = sp.kind === 'D' ? 1 / 10 ** sp.dec : 1;
      const out = el('span', { class: 'zcV' }, mfxText(sp, v));
      box.append(
        el('input', {
          type: 'range',
          min: sp.lo,
          max: sp.hi,
          step,
          value: v,
          oninput: e => {
            out.textContent = mfxText(sp, +e.target.value);
            ctx.set(key, stored(sp, +e.target.value), false);
          },
          onchange: e => ctx.set(key, stored(sp, +e.target.value), true)
        }),
        out
      );
    }
    return box;
  });
  const ctrl = [1, 2, 3, 4].map(i =>
    el(
      'div',
      { class: 'zcRow' },
      ctl(ctx, 'MFX.ctrlSrc' + i, { label: 'Control ' + i }),
      ctl(ctx, 'MFX.ctrlSens' + i, { label: 'Sens' }),
      ctl(ctx, 'MFX.ctrlAsgn_' + i, { label: 'Controls' })
    )
  );
  return el(
    'div',
    {},
    group(
      'Multi-effect',
      el('label', { class: 'zcC wide' }, el('span', { class: 'zcL' }, 'Type'), typeSel),
      ctl(ctx, 'MFX.mfxSwitch', { label: 'On' }),
      ctl(ctx, 'MFX.choSend', { label: 'Delay send' }),
      ctl(ctx, 'MFX.revSend', { label: 'Reverb send' })
    ),
    sps.length
      ? group(mfxNames()[type], ...params)
      : el('p', { class: 'hint' }, 'Thru: no effect. Choose a type above.'),
    group('MFX control (CC or a system control moves an MFX parameter)', ...ctrl),
    el(
      'p',
      { class: 'hint' },
      'Changing the type resets its parameters on the MC-707; the editor reads them back when it can. The stored value of each parameter shows when you hover over it.'
    )
  );
}
/* ---- drum kits ---- */
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = n => NN[n % 12] + (Math.floor(n / 12) - 1);
export function pageKit(ctx) {
  const c = ids => ids.map(id => ctl(ctx, 'KCMN.' + id));
  return el(
    'div',
    {},
    group('Kit', ctl(ctx, 'KCMN.NAME', { wide: true }), ...c(['LEVEL'])),
    el(
      'p',
      { class: 'hint' },
      'Edit each key on the Keys page, the drum compressors on Comp, and the kit’s multi-effect on MFX.'
    ),
    el(
      'p',
      { class: 'hint zcWarn' },
      'Drum kit editing is newer and less tested than tones: the kit addresses come from Roland’s map for the MV-1, which shares the MC-707’s layout. If a change does not reach your MC-707, use Read to check, and let us know.'
    )
  );
}
export function pageKeys(ctx) {
  const pads = new Map((S.drumMap || LANES.map(l => l[1])).map((n, i) => [n, LANES[i][0]]));
  const cur = ctx.key;
  const keys = el('div', { class: 'zcKeys' });
  for (let i = 0; i < 88; i++) {
    const n = KIT_LOW + i,
      pad = pads.get(n);
    keys.append(
      el(
        'button',
        {
          type: 'button',
          class: 'zcKey' + (i === cur ? ' on' : '') + (pad ? ' pad' : '') + (/#/.test(noteName(n)) ? ' blk' : ''),
          title: noteName(n) + (pad ? ' · ' + pad : ''),
          onclick: () => ctx.pickKey(i),
          onpointerdown: () => ctx.audition(n)
        },
        pad ? pad.split(' ')[0] : noteName(n)
      )
    );
  }
  const k = id => ctl(ctx, pk('KPTL', cur, id));
  return el(
    'div',
    {},
    el('p', { class: 'hint' }, 'Pick a key (your pads are marked), then shape its instrument. Click a key to hear it.'),
    keys,
    group(
      'Key ' + noteName(KIT_LOW + cur) + (pads.get(KIT_LOW + cur) ? ' · ' + pads.get(KIT_LOW + cur) : ''),
      k('INST_GTYPE'),
      k('INST_GID'),
      k('INST_NUM'),
      k('LEVEL'),
      k('PAN'),
      k('KEY_OFST'),
      k('PIT_FINE_OFST'),
      k('CUTOFF_OFST'),
      k('RESO_OFST'),
      k('TVA_ATK_OFST'),
      k('TVA_DCY_OFST'),
      k('TVA_REL_OFST'),
      k('MUTE_GRP'),
      k('CHO_SEND'),
      k('REV_SEND'),
      k('OUT_ASGN')
    ),
    pageEq(ctx, 'KEQ', cur)
  );
}
export function pageComp(ctx) {
  return el(
    'div',
    { class: 'zcCols2' },
    ...[0, 1, 2, 3, 4, 5].map(i =>
      group(
        'Comp ' + (i + 1),
        ...['SW', 'ATTCK', 'RELEASE', 'THRESHOLD', 'RATIO', 'KNEE', 'POSTGAIN', 'OUT_ASGN'].map(id =>
          ctl(ctx, pk('KCMP', i, id))
        )
      )
    )
  );
}
