// MC-707 › Template builder: make an MC-707 project to start from. Choose the track layout (which tracks
// are drum and which tone tracks, and what each plays), a genre, and the builder fills every clip with a
// factory kit or tone that suits it (or your own sounds and the starters), none twice; change any clip's
// sound, how many clips, their length and the tempo. Save puts the project file on the
// MC-707's SD card in storage mode (pick its drive in the save window), with the steps to load it. The
// empty templates (no sounds) are a link away. The choices are kept for next time (localStorage
// 'mc707-tplb').
//
// Reads: S, DEV, ZS, HOST.
import { el, toast } from '../core/dom.js';
import { DEV, DEVS } from '../core/device.js';
import { LINKS, openLink } from '../core/version.js';
import { saveFile } from '../song/export.js';
import { askDlg } from './dialogs.js';
import { matchTypes } from './track-setup.js';
import { HOST, S } from '../core/state.js';
import { roleOf } from '../core/tracks.js';
import { ZS, soundsLoad } from '../zen/zc-sounds.js';
import { factoryImport } from '../zen/zc-factory-ui.js';
import { TPL_GENRES, TPL_LAYOUTS, TPL_ROLES, roleIsDrum, tplBytes, tplPick, tplPool } from '../zen/zc-template.js';
import { templatesEmptyOpen } from './templates.js';

const KEY = 'mc707-tplb';
const SRCS = [
  ['factory', 'Factory tones and kits'],
  ['mine', 'My sounds'],
  ['starter', 'Starters']
];
const COUNTS = [0, 1, 2, 4, 8, 12, 16];
const def = () => ({
  name: 'MY TEMPLATE',
  bpm: 124,
  genre: 'house',
  layout: '3+5',
  srcs: ['factory', 'mine'],
  clipBars: 1,
  useLayout: true,
  tracks: TPL_LAYOUTS[0][2].map(role => ({ role, n: 16, same: false, names: [] }))
});
/** The builder's choices (kept between visits). */
export const TB = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && Array.isArray(o.tracks) && o.tracks.length === 8) return { ...def(), ...o };
  } catch (e) {
    /* storage off: start fresh */
  }
  return def();
})();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(TB));
  } catch (e) {
    /* storage off */
  }
};

/* ---------- picking ---------- */
const kindOf = tr => (roleIsDrum(tr.role) ? 'drum' : 'tone');
/** Fill a track's clips with new picks (a seed draws a different set). */
export function tbFill(t, seed = 0) {
  const tr = TB.tracks[t],
    kind = kindOf(tr),
    avoid = new Set(
      TB.tracks
        .filter((x, i) => i !== t && kindOf(x) === kind)
        .flatMap(x => x.names)
        .filter(Boolean)
    ),
    picks = tplPick(TB.genre, tr.role, tr.same ? 1 : tr.n, TB.srcs, avoid, seed),
    names = Array(16).fill(null);
  for (let k = 0; k < tr.n; k++) names[k] = (tr.same ? picks[0] : picks[k])?.name || null;
  tr.names = names;
}
const fillAll = seed => TB.tracks.forEach((x, t) => tbFill(t, seed ? seed + t : 0));
/* a name back to its sound */
function entryOf(kind, name) {
  if (!name) return null;
  const pool = tplPool(kind === 'drum' ? 'kit' : 'tone', ['factory', 'mine', 'starter']);
  return (
    pool.find(
      e =>
        e.name === name && TB.srcs.includes(e.src === 'factory' ? 'factory' : e.src === 'starter' ? 'starter' : 'mine')
    ) ||
    pool.find(e => e.name === name) ||
    null
  );
}
/* the app's Track setup as builder parts */
const FROM_APP = { chords: 'keys', pad: 'pads', lead: 'leads', acid: 'bass', vox: 'leads', fx: 'fx' };
function appRoles() {
  return DEVS['707'].tracks.map(t => {
    const r = roleOf(t),
      drum = S.tracks[t].type === 'drum';
    if (drum) return ['kit', 'hats', 'perc'].includes(r) ? r : 'kit';
    const b = FROM_APP[r] || r;
    return TPL_ROLES.some(x => x[0] === b && !x[2]) ? b : 'any';
  });
}
const devTag = (t, tr) => t + 1 + '-' + (kindOf(tr) === 'drum' ? 'D' : 'T');

/** The project for the builder's choices now: {bytes, clips, missing}. */
export async function tbBytes() {
  let missing = 0;
  const tracks = TB.tracks.map(tr => {
    const kind = kindOf(tr);
    return {
      kind,
      sounds: Array.from({ length: 16 }, (_, k) => {
        if (k >= tr.n) return null;
        const e = entryOf(kind, tr.names[k]);
        if (tr.names[k] && !e) missing++;
        return e;
      })
    };
  });
  const made = await tplBytes({ ...TB, tracks });
  return { ...made, missing };
}

/* ---------- the window ---------- */
export async function templateBuilderOpen() {
  document.getElementById('tbOv')?.remove();
  await soundsLoad();
  /* with no factory sounds yet, the starters fill the tone tracks */
  const noFactory = !ZS.list.some(e => e.src === 'factory');
  if (noFactory && !TB.srcs.includes('starter')) {
    TB.srcs = [...TB.srcs, 'starter'];
    fillAll(0);
  }
  if (TB.tracks.every(x => !x.names.some(Boolean))) fillAll(0);
  const ov = el('div', {
    id: 'tbOv',
    class: 'ptOv',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Template builder'
  });
  const close = () => (save(), ov.remove());
  const open = new Set();
  const render = () => {
    save();
    const factory = ZS.list.some(e => e.src === 'factory' && e.mpj);
    const opt = (v, label, cur) => el('option', { value: v, selected: String(v) === String(cur) }, label);
    const sel = (label, cur, list, on, extra = {}) =>
      el(
        'select',
        { 'aria-label': label, onchange: e => on(e.target.value), ...extra },
        ...list.map(([v, l]) => opt(v, l, cur))
      );
    const field = (label, ...k) => el('label', { class: 'tbField' }, el('span', {}, label), ...k);
    /* the top: name, tempo, genre, layout, where the sounds come from */
    const top = el(
      'div',
      { class: 'tbTop' },
      field(
        'Project name',
        el('input', {
          type: 'text',
          maxlength: 16,
          value: TB.name,
          'aria-label': 'Project name',
          oninput: e => ((TB.name = e.target.value.toUpperCase().slice(0, 16)), save())
        })
      ),
      field(
        'Tempo',
        el('input', {
          type: 'number',
          min: 20,
          max: 300,
          value: TB.bpm,
          'aria-label': 'Tempo',
          onchange: e => ((TB.bpm = Math.max(20, Math.min(300, +e.target.value || 120))), save())
        })
      ),
      field(
        'Genre',
        sel(
          'Genre',
          TB.genre,
          Object.entries(TPL_GENRES).map(([id, g]) => [id, g.name]),
          v => {
            TB.genre = v;
            TB.bpm = TPL_GENRES[v].bpm;
            fillAll(0);
            render();
          }
        )
      ),
      field(
        'Track layout',
        sel(
          'Track layout',
          TB.layout,
          [
            ...TPL_LAYOUTS.map(([id, l]) => [id, l]),
            ['app', 'Like my Track setup in the app'],
            ['custom', 'My own (set each track)']
          ],
          v => {
            TB.layout = v;
            const roles = v === 'app' ? appRoles() : (TPL_LAYOUTS.find(x => x[0] === v) || [])[2];
            if (roles) roles.forEach((r, t) => (TB.tracks[t].role = r));
            fillAll(0);
            render();
          }
        )
      )
    );
    const srcs = el(
      'div',
      { class: 'tbSrcs' },
      el('span', { class: 'hint' }, 'Sounds from:'),
      ...SRCS.map(([id, label]) =>
        el(
          'label',
          {},
          el('input', {
            type: 'checkbox',
            checked: TB.srcs.includes(id),
            onchange: e => {
              TB.srcs = e.target.checked ? [...new Set([...TB.srcs, id])] : TB.srcs.filter(x => x !== id);
              if (!TB.srcs.length) TB.srcs = ['factory'];
              fillAll(0);
              render();
            }
          }),
          ' ' + label
        )
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm',
          title: 'New picks for every track',
          onclick: () => {
            fillAll((Date.now() & 0xffff) + 1);
            render();
          }
        },
        '↻ New picks for all'
      )
    );
    const warn = !factory
      ? el(
          'div',
          { class: 'tbWarn' },
          el(
            'span',
            {},
            'The factory tones and kits are not in your Sound library yet, so drum tracks keep the empty template’s TR kits. Grab them from the MC-707’s update file (on your computer, nothing is uploaded).'
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm on',
              onclick: () =>
                factoryImport(() => {
                  if (!TB.srcs.includes('factory')) TB.srcs.push('factory');
                  fillAll(0);
                  render();
                })
            },
            'Grab factory tones and kits…'
          )
        )
      : null;
    const dev =
      DEV !== '707'
        ? el('p', { class: 'ptWarn' }, 'Project files are for the MC-707 (8 tracks). The MC-101 cannot load them.')
        : null;
    /* the tracks */
    const rows = TB.tracks.flatMap((tr, t) => {
      const kind = kindOf(tr),
        names = tr.names.slice(0, tr.n).filter(Boolean),
        row = el(
          'div',
          { class: 'tbRow' + (kind === 'drum' ? ' drum' : '') },
          el('b', { class: 'tbNum' }, devTag(t, tr)),
          sel(
            'Track ' + (t + 1) + ' plays',
            tr.role,
            TPL_ROLES.map(([id, l, d]) => [id, (d ? 'Drums: ' : '') + l]),
            v => {
              tr.role = v;
              TB.layout = 'custom';
              tbFill(t);
              render();
            }
          ),
          sel(
            'Track ' + (t + 1) + ' clips',
            tr.n,
            COUNTS.map(n => [n, n === 0 ? 'No clips' : n + (n === 1 ? ' clip' : ' clips')]),
            v => {
              tr.n = +v;
              tbFill(t);
              render();
            }
          ),
          el(
            'label',
            { class: 'tbSame', title: 'The same sound in every clip of this track' },
            el('input', {
              type: 'checkbox',
              checked: tr.same,
              onchange: e => {
                tr.same = e.target.checked;
                tbFill(t);
                render();
              }
            }),
            ' One sound'
          ),
          el(
            'span',
            { class: 'tbNames', title: names.join(', ') },
            tr.n
              ? names.length
                ? [...new Set(names)].slice(0, 4).join(' · ') + (new Set(names).size > 4 ? ' …' : '')
                : kind === 'drum'
                  ? 'Kits come from the factory sounds'
                  : 'No sounds found: tick more sources'
              : '—'
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              title: 'Other sounds for this track',
              'aria-label': 'New picks for track ' + (t + 1),
              disabled: !tr.n,
              onclick: () => {
                tbFill(t, (Date.now() & 0xffff) + t + 1);
                render();
              }
            },
            '↻'
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm' + (open.has(t) ? ' on' : ''),
              disabled: !tr.n,
              'aria-expanded': String(open.has(t)),
              onclick: () => {
                open.has(t) ? open.delete(t) : open.add(t);
                render();
              }
            },
            'Clips ▾'
          )
        );
      if (!open.has(t) || !tr.n) return [row];
      /* each clip's sound: the best matches for the part, the one there now, or empty */
      const choices = tplPick(TB.genre, tr.role, 60, TB.srcs).map(e => e.name);
      const clips = el(
        'div',
        { class: 'tbClips' },
        ...Array.from({ length: tr.n }, (_, k) => {
          const cur = tr.names[k],
            list = [...new Set([cur, ...choices].filter(Boolean))];
          return el(
            'label',
            {},
            el('span', {}, 'Clip ' + (k + 1)),
            sel(
              'Track ' + (t + 1) + ' clip ' + (k + 1) + ' sound',
              cur || '',
              [['', '— empty —'], ...list.map(n => [n, n])],
              v => {
                tr.names[k] = v || null;
                render();
              }
            )
          );
        })
      );
      return [row, clips];
    });
    /* the clips' length, the app */
    const more = el(
      'div',
      { class: 'tbMore' },
      field(
        'Clip length',
        sel(
          'Clip length',
          TB.clipBars,
          [1, 2, 4, 8].map(n => [n, n + (n === 1 ? ' bar' : ' bars')]),
          v => ((TB.clipBars = +v), save())
        )
      ),
      el(
        'label',
        {
          class: 'tbCheck',
          title: 'Set the app’s Track setup to the same drum and tone tracks, so Song and Scene Mode match the MC-707'
        },
        el('input', {
          type: 'checkbox',
          checked: TB.useLayout,
          onchange: e => ((TB.useLayout = e.target.checked), save())
        }),
        ' Use this layout in the app too'
      )
    );
    const total = TB.tracks.reduce((a, x) => a + x.names.slice(0, x.n).filter(Boolean).length, 0);
    ov.replaceChildren(
      el(
        'div',
        { class: 'ptBox tbBox' },
        el('h3', {}, 'Template builder'),
        el(
          'p',
          { class: 'hint' },
          'Make an MC-707 project to start from: your track layout with a sound in every clip. Save it onto the MC-707 in storage mode and load it there.'
        ),
        dev,
        warn,
        top,
        srcs,
        el('div', { class: 'tbRows' }, ...rows),
        more,
        el(
          'div',
          { class: 'tbFoot' },
          el(
            'button',
            { type: 'button', class: 'btn sm', onclick: () => (close(), templatesEmptyOpen()) },
            'Empty templates (no sounds)…'
          ),
          el('span', { class: 'hint' }, total + ' clips with sounds'),
          el('button', { type: 'button', class: 'btn', onclick: close }, 'Close'),
          el(
            'button',
            { type: 'button', class: 'btn on', disabled: DEV !== '707' || !total, onclick: () => tbSave(close) },
            'Save to the MC-707…'
          )
        )
      )
    );
  };
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  ov.addEventListener('pointerdown', e => e.target === ov && close());
  document.body.append(ov);
  render();
}

/* ---------- saving ---------- */
async function writeFile(file, bytes) {
  if (HOST && HOST.saveBinary) return (await HOST.saveBinary(file, bytes, 'mpj')) || null;
  /* in a browser that can, pick where it goes: the MC-707's drive */
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: file,
        types: [{ description: 'MC-707 project', accept: { 'application/octet-stream': ['.mpj'] } }]
      });
      const w = await h.createWritable();
      await w.write(bytes);
      await w.close();
      return h.name;
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
    }
  }
  await saveFile(file, new Blob([bytes], { type: 'application/octet-stream' }));
  return 'Downloads';
}
async function tbSave(close) {
  let made;
  try {
    made = await tbBytes();
  } catch (e) {
    return void toast('Could not make the project: ' + ((e && e.message) || e));
  }
  if (TB.useLayout && DEV === '707') {
    const types = TB.tracks.map(kindOf);
    if (types.some((x, t) => S.tracks[t].type !== x) && !(await matchTypes(types))) return;
  }
  const name = (TB.name || 'MY TEMPLATE').slice(0, 16),
    file = name.replace(/[^\w\- ]+/g, '').trim() || 'TEMPLATE';
  const where = await writeFile(file + '.mpj', made.bytes);
  if (!where) return;
  close();
  const li = (...k) => el('li', {}, ...k);
  await askDlg({
    title: 'Saved ' + file + '.mpj',
    text:
      made.clips +
      ' clips with sounds' +
      (made.missing ? ' (' + made.missing + ' sounds were no longer in your library and were left out)' : '') +
      '. ' +
      (where === 'Downloads' ? 'It is in your Downloads folder.' : 'Saved as ' + where + '.'),
    body: el(
      'ol',
      { class: 'hint tplSteps' },
      li(
        'On the MC-707: hold ',
        el('b', {}, 'SHIFT'),
        ' and press ',
        el('b', {}, 'KNOB ASSIGN'),
        ', pick ',
        el('b', {}, 'STORAGE MODE'),
        ' and press ',
        el('b', {}, 'ENTER'),
        '.'
      ),
      li('Connect the USB cable: the SD card shows up as a drive.'),
      li(
        'Put the .mpj file in the folder with the MC-707’s other projects (under ROLAND), if you did not save it straight there. Then eject the drive.'
      ),
      li(
        'Leave storage mode, press ',
        el('b', {}, 'PROJECT'),
        ', choose ',
        el('b', {}, 'LOAD'),
        ' and pick ',
        el('b', {}, name),
        '.'
      ),
      li(
        'Every track plays its clips’ sounds: press a clip to hear it. Record into the clips, then save the project under a new name so the template stays as it is.'
      )
    ),
    ok: 'OK',
    cancel: 'Close'
  });
}
