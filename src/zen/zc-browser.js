// The ZenCore editor's Sound browser: every starter and every sound you saved or grabbed from the
// MC-707, in one list with search, an instrument-type filter, genre tags and favourites. Click a sound
// to load it into the clip being edited (and hear it, with Live on); hold ▶ to play a note. Grab reads
// the clips on the MC-707 (one, a track's 16 or every track's) and keeps each sound found, so factory
// sounds you have picked on the MC-707 end up here. Backup exports and imports the whole library.
//
// Reads: ZE, S, DEV.
// Calls up the layers through hooks (core/hooks.js).
import { $, el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { hooks } from '../core/hooks.js';
import { showMenu } from '../ui/menu.js';
import { askDlg } from '../ui/dialogs.js';
import { ZX, slotAddr, zxConnect } from './zc-sysex.js';
import { newSound, readSound } from './zc-tone.js';
import { starterMenu } from './zc-starters-more.js';
import { ZE, audition, zeLoad } from './zc-editor.js';
import { factoryItems } from './zc-factory-ui.js';
import {
  GENRE_TAGS,
  TYPES,
  TYPE_LABEL,
  ZS,
  diffOf,
  libraryImport,
  libraryJSON,
  soundAdd,
  soundDelete,
  soundOf,
  soundUpdate,
  soundsLoad,
  toggleFav,
  typeOf
} from './zc-sounds.js';

/* what the browser shows (kept while the editor is open) */
const B = { q: '', src: 'all', type: '', tag: '', edit: null, grab: null, cur: null };
const SRC = [
  ['all', 'All'],
  ['fav', '★ Favourites'],
  ['mine', 'Saved'],
  ['mc707', 'From the MC-707'],
  ['factory', 'Factory'],
  ['starter', 'Starters']
];
const SRC_LABEL = { mine: 'Saved', mc707: 'MC-707', starter: 'Starter', file: 'Imported', factory: 'Factory' };

/* the starters as browser entries (made once) */
let STARTS = null;
function starters() {
  if (STARTS) return STARTS;
  STARTS = [];
  for (const [group, list] of starterMenu())
    for (const [name, make] of list) {
      const snd = make();
      STARTS.push({
        id: 'st:' + name,
        name,
        kind: snd.kind,
        type: typeOf(snd, name),
        tags: [],
        src: 'starter',
        group,
        make
      });
    }
  return STARTS;
}
const entries = () => [...ZS.list, ...starters()].filter(e => e.kind === ZE.kind);
function shown() {
  const q = B.q.trim().toLowerCase();
  return entries().filter(
    e =>
      (B.src === 'all' || (B.src === 'fav' ? ZS.favs.has(e.id) : e.src === B.src)) &&
      (!B.type || e.type === B.type) &&
      (!B.tag || e.tags.includes(B.tag)) &&
      (!q ||
        (e.name + ' ' + e.tags.join(' ') + ' ' + TYPE_LABEL[e.type] + ' ' + (e.group || '')).toLowerCase().includes(q))
  );
}

/** Open the browser over the editor. */
export async function browserOpen() {
  await soundsLoad();
  let ov = $('#zbOv');
  if (!ov) {
    ov = el('div', {
      id: 'zbOv',
      class: 'ptOv zbOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Sound browser',
      onkeydown: e => {
        if (e.key === 'Escape') browserClose();
        e.stopPropagation();
      },
      onclick: e => e.target === ov && browserClose()
    });
    document.body.append(ov);
  }
  render();
  const q = $('#zbQ');
  if (q) q.focus();
}
export function browserClose() {
  if (B.grab) B.grab.stop = true;
  const ov = $('#zbOv');
  if (ov) ov.remove();
}

function load(e) {
  B.cur = e.id;
  const done = zeLoad(e.src === 'starter' ? e.make() : soundOf(e), 'Loaded ' + e.name);
  render();
  return done;
}
const chip = (label, on, fn, title) =>
  el('button', { type: 'button', class: 'zbChip' + (on ? ' on' : ''), title: title || '', onclick: fn }, label);

/* the name, type and tags form, for saving the sound being edited or changing an entry */
function form(e, done) {
  const name = el('input', { class: 'zbName', value: e.name, 'aria-label': 'Name', maxlength: 40 });
  const type = el(
    'select',
    { 'aria-label': 'Instrument type' },
    ...TYPES.map(([id, l]) => el('option', { value: id, selected: id === e.type }, l))
  );
  const tags = new Set(e.tags);
  const tagBox = el('div', { class: 'zbTags' });
  const drawTags = () => {
    tagBox.textContent = '';
    [...new Set([...GENRE_TAGS, ...tags])].forEach(t =>
      tagBox.append(chip(t, tags.has(t), () => (tags.has(t) ? tags.delete(t) : tags.add(t), drawTags())))
    );
    tagBox.append(
      chip('+ tag', false, async () => {
        const t = await askDlg({ title: 'New tag', input: true, def: '', ok: 'Add' });
        if (t && t.trim()) (tags.add(t.trim().slice(0, 20)), drawTags());
      })
    );
  };
  drawTags();
  return el(
    'div',
    { class: 'zbForm' },
    el('div', { class: 'zbRow' }, name, type),
    tagBox,
    el(
      'div',
      { class: 'zbRow' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm on',
          onclick: () => done({ name: name.value.trim() || e.name, type: type.value, tags: [...tags] })
        },
        'Save'
      ),
      el('button', { type: 'button', class: 'btn sm', onclick: () => done(null) }, 'Cancel')
    )
  );
}

/* a sound's right-click menu */
function rowMenu(e, x, y) {
  const fav = ZS.favs.has(e.id),
    mine = e.src !== 'starter';
  showMenu(x, y, [
    { label: 'Load into this clip', action: () => load(e) },
    { label: fav ? 'Unstar' : 'Star', action: () => (toggleFav(e.id), render()) },
    '-',
    mine ? { label: 'Name, type and tags…', action: () => ((B.edit = e.id), render()) } : null,
    !mine
      ? {
          label: 'Save a copy to my sounds',
          action: async () => {
            const n = await soundAdd(e.make(), { name: e.name, type: e.type, src: 'mine' });
            toast(n ? 'Saved ' + e.name : 'That sound is already in the library');
            render();
          }
        }
      : null,
    { label: 'Only ' + (TYPE_LABEL[e.type] || 'this type').toLowerCase(), action: () => ((B.type = e.type), render()) },
    mine
      ? {
          label: 'Delete…',
          danger: true,
          action: async () => {
            if (await askDlg({ title: 'Delete ' + e.name + '?', ok: 'Delete' })) (await soundDelete(e.id), render());
          }
        }
      : null
  ]);
}
function row(e) {
  const fav = ZS.favs.has(e.id);
  const editing = B.edit === e.id;
  const r = el(
    'div',
    {
      class: 'zbItem' + (B.cur === e.id ? ' cur' : ''),
      role: 'button',
      tabindex: 0,
      title: 'Load into this clip · right-click for more',
      onclick: () => load(e),
      onkeydown: k => k.key === 'Enter' && load(e),
      oncontextmenu: x => {
        x.preventDefault();
        x.stopPropagation();
        rowMenu(e, x.clientX, x.clientY);
      }
    },
    el(
      'button',
      {
        type: 'button',
        class: 'zbStar' + (fav ? ' on' : ''),
        title: fav ? 'Unstar' : 'Star',
        onclick: x => (x.stopPropagation(), toggleFav(e.id), render())
      },
      fav ? '★' : '☆'
    ),
    el('span', { class: 'zbNm' }, e.name),
    el('span', { class: 'zbTy' }, TYPE_LABEL[e.type] || ''),
    el('span', { class: 'zbTg' }, e.tags.join(' · ')),
    el('span', { class: 'zbSrc' }, SRC_LABEL[e.src] || ''),
    el(
      'button',
      {
        type: 'button',
        class: 'zbPlay',
        title: 'Load it and hold to play a note',
        onpointerdown: async x => {
          x.stopPropagation();
          /* load first (the track is quiet while the sound goes in), then play while still held */
          let up = false;
          const u = () => (up = true);
          addEventListener('pointerup', u);
          if (B.cur !== e.id) await load(e);
          removeEventListener('pointerup', u);
          if (!up) audition(e.type === 'bass' ? 36 : 60);
        },
        onclick: x => x.stopPropagation()
      },
      '▶'
    ),
    e.src === 'starter'
      ? el('span', { class: 'zbAct' })
      : el(
          'button',
          {
            type: 'button',
            class: 'zbAct',
            title: 'Rename, type, tags, delete',
            onclick: x => {
              x.stopPropagation();
              const rr = x.currentTarget.getBoundingClientRect();
              showMenu(rr.left, rr.bottom + 4, [
                { label: 'Name, type and tags…', action: () => ((B.edit = e.id), render()) },
                {
                  label: 'Delete',
                  action: async () => {
                    if (await askDlg({ title: 'Delete ' + e.name + '?', ok: 'Delete' }))
                      (await soundDelete(e.id), render());
                  }
                }
              ]);
            }
          },
          '⋯'
        )
  );
  if (!editing) return r;
  return el(
    'div',
    {},
    r,
    form(e, async v => {
      B.edit = null;
      if (v) await soundUpdate(e.id, v);
      render();
    })
  );
}

/* ---- grabbing sounds from the MC-707's clips ---- */
/* an empty clip: no name, or Roland's initial one (an empty clip on the MC-707 is not quite the initial sound) */
const isBlank = snd =>
  /^(|init ?(tone|kit|sound))$/i.test((snd.v[snd.kind === 'kit' ? 'KCMN.NAME' : 'CMN.NAME'] || '').trim());
async function grab(scope) {
  if (B.grab) return;
  const dn = DEVS[DEV].name;
  if (!(await zxConnect())) return toast('Connect the ' + dn + ' first');
  if (!ZX.inp) return toast('No MIDI input from the ' + dn + ': it cannot be read');
  const jobs = [];
  for (const t of scope === 'all' ? DEVS[DEV].tracks : [ZE.t]) {
    const kind = S.tracks[t].type === 'drum' ? 'kit' : 'tone';
    for (const k of scope === 'clip' ? [ZE.k] : Array.from({ length: 16 }, (_, i) => i)) jobs.push([t, k, kind]);
  }
  const g = (B.grab = { stop: false, done: 0, n: jobs.length, added: 0, same: 0, empty: 0, bad: 0, msg: '' });
  render();
  for (const [t, k, kind] of jobs) {
    if (g.stop) break;
    g.msg = 'Reading track ' + devNum(t) + ', clip ' + (k + 1);
    status();
    const snd = newSound(kind),
      r = await readSound(snd, slotAddr(kind, t, k));
    g.done++;
    if (r.silent) {
      g.msg = 'The ' + dn + ' did not answer.';
      break;
    }
    if (r.ok < r.total * 0.9) g.bad++;
    else if (!Object.keys(diffOf(snd)).length || isBlank(snd)) g.empty++;
    else if (await soundAdd(snd, { src: 'mc707' })) g.added++;
    else g.same++;
    status();
  }
  B.grab = null;
  toast(
    'Grabbed ' +
      g.added +
      ' new sound' +
      (g.added === 1 ? '' : 's') +
      (g.same ? ', ' + g.same + ' already here' : '') +
      (g.empty ? ', ' + g.empty + ' empty' : '') +
      (g.bad ? ', ' + g.bad + ' could not be read' : '') +
      (g.stop ? ' (stopped)' : '')
  );
  if (g.added) B.src = 'mc707';
  render();
}
function status() {
  const s = $('#zbStat'),
    g = B.grab;
  if (!s) return;
  s.textContent = g ? g.msg + ' · ' + g.done + ' of ' + g.n + ' · ' + g.added + ' new' : '';
}

function render() {
  const ov = $('#zbOv');
  if (!ov) return;
  const list = shown(),
    all = entries();
  const scroll = $('.zbList', ov) ? $('.zbList', ov).scrollTop : 0;
  ov.textContent = '';
  const kindName = ZE.kind === 'kit' ? 'kits' : 'tones';
  const q = el('input', {
    id: 'zbQ',
    type: 'search',
    class: 'zbQ',
    placeholder: 'Search ' + all.length + ' ' + kindName,
    value: B.q,
    'aria-label': 'Search',
    oninput: e => {
      B.q = e.target.value;
      drawList();
    }
  });
  const type = el(
    'select',
    { 'aria-label': 'Instrument type', onchange: e => ((B.type = e.target.value), render()) },
    el('option', { value: '' }, 'Any instrument'),
    ...TYPES.filter(([id]) => all.some(e => e.type === id)).map(([id, l]) =>
      el('option', { value: id, selected: B.type === id }, l)
    )
  );
  const usedTags = [...new Set(all.flatMap(e => e.tags))].sort();
  const box = el('div', { class: 'zbList' });
  const drawList = () => {
    const l = shown();
    box.textContent = '';
    if (!l.length)
      box.append(
        el(
          'p',
          { class: 'hint zbEmpty' },
          B.src === 'factory' && !all.some(e => e.src === 'factory')
            ? 'Add the factory tones with Grab ▾ › Factory tones from the MC-707 update file (MC707_UPA_up.bin from Roland).'
            : all.length > starters().length || B.src !== 'mc707'
              ? 'Nothing matches.'
              : 'Nothing grabbed yet. Pick sounds into clips on the ' + DEVS[DEV].name + ', then use Grab.'
        )
      );
    l.forEach(e => box.append(row(e)));
  };
  const saving = B.edit === 'new';
  ov.append(
    el(
      'div',
      { class: 'ptBox zcBox zbBox' },
      el(
        'div',
        { class: 'zbHead' },
        el('b', {}, 'Sounds'),
        q,
        type,
        el('span', { class: 'zbN hint' }, list.length + ' shown'),
        el(
          'div',
          { class: 'zbActs' },
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              onclick: () => ((B.edit = saving ? null : 'new'), render()),
              title: 'Save the sound in the editor to the library'
            },
            'Save this ' + (ZE.kind === 'kit' ? 'kit' : 'tone')
          ),
          B.grab
            ? el('button', { type: 'button', class: 'btn sm on', onclick: () => (B.grab.stop = true) }, 'Stop grabbing')
            : el(
                'button',
                {
                  type: 'button',
                  class: 'btn sm',
                  title: 'Read sounds from the ' + DEVS[DEV].name + "'s clips into the library",
                  onclick: x => {
                    const rr = x.currentTarget.getBoundingClientRect();
                    showMenu(rr.left, rr.bottom + 4, [
                      { label: 'This clip', action: () => grab('clip') },
                      { label: 'All 16 clips of track ' + devNum(ZE.t), action: () => grab('track') },
                      { label: 'Every clip of every track', action: () => grab('all') },
                      ...(ZE.kind === 'tone'
                        ? ['-', ...factoryItems(n => ((B.src = n ? 'factory' : B.src), render()))]
                        : [])
                    ]);
                  }
                },
                'Grab from ' + DEVS[DEV].name + ' ▾'
              ),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              onclick: x => {
                const rr = x.currentTarget.getBoundingClientRect();
                showMenu(rr.left, rr.bottom + 4, [
                  {
                    label: 'Export the library to a file…',
                    action: () => hooks.saveFile('mc707-sounds.json', libraryJSON())
                  },
                  {
                    label: 'Import a library file…',
                    action: () => {
                      const i = el('input', {
                        type: 'file',
                        accept: '.json,application/json',
                        onchange: async () => {
                          try {
                            const r = await libraryImport(await i.files[0].text());
                            toast('Imported ' + r.added + ' sounds' + (r.same ? ' (' + r.same + ' already here)' : ''));
                            render();
                          } catch (e) {
                            toast('That is not a sound library file from this app');
                          }
                        }
                      });
                      i.click();
                    }
                  }
                ]);
              }
            },
            'Backup ▾'
          ),
          el('button', { type: 'button', class: 'btn sm on', onclick: browserClose }, 'Done')
        )
      ),
      saving
        ? form(
            { name: ZE.snd.v[ZE.kind === 'kit' ? 'KCMN.NAME' : 'CMN.NAME'] || '', type: typeOf(ZE.snd), tags: [] },
            async v => {
              B.edit = null;
              if (v) {
                const e = await soundAdd(ZE.snd, { ...v, src: 'mine' });
                toast(e ? 'Saved ' + e.name : 'That sound is already in the library');
                if (e) B.cur = e.id;
              }
              render();
            }
          )
        : null,
      el(
        'div',
        { class: 'zbFilt' },
        ...SRC.map(([id, l]) => chip(l, B.src === id, () => ((B.src = id), render()))),
        usedTags.length ? el('span', { class: 'zbSep' }) : null,
        ...usedTags.map(t =>
          chip(t, B.tag === t, () => ((B.tag = B.tag === t ? '' : t), render()), 'Only sounds tagged ' + t)
        )
      ),
      el('div', { id: 'zbStat', class: 'zcStat ok' }),
      box
    )
  );
  drawList();
  box.scrollTop = scroll;
  status();
}
