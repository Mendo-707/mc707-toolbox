// The ZenCore editor's Sound browser, laid out like ZENOLOGY's: banks on the left (your sounds, the
// MC-707's, the factory banks from its update file, the starters), categories in groups in the middle,
// and a sortable table of sounds with star ratings (zc-browser-table.js; what shows is zc-browse-data.js).
// Click a sound to load it into the clip being edited (and hear it, with Live on); ↑ ↓ step through;
// hold ▶ to play a note. Grab reads the clips on the MC-707 (one, a track's 16 or every track's) and keeps
// each sound found. Backup exports and imports your library (not the factory tones). Your own folders sit
// under My sounds; Ctrl- or Shift-click picks several sounds to tag, give a category, copy or move into a
// folder, or delete. Tags filter from the middle column.
//
// Reads: ZE, DEV.
// Calls up the layers through hooks (core/hooks.js).
import { $, el, toast } from '../core/dom.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { hooks } from '../core/hooks.js';
import { showMenu } from '../ui/menu.js';
import { askDlg } from '../ui/dialogs.js';
import { starterMenu } from './zc-starters-more.js';
import { ZE, audition, zeLoad, zenClose } from './zc-editor.js';
import { factoryItems } from './zc-factory-ui.js';
import {
  CAT_GROUPS,
  bankName,
  bankOf,
  banksIn,
  catCounts,
  catLabel,
  catOf,
  filterList,
  sortList
} from './zc-browse-data.js';
import { fillTable, tableHead } from './zc-browser-table.js';
import { grabClips } from './zc-grab.js';
import {
  GENRE_TAGS,
  TYPES,
  ZS,
  folderAdd,
  folderDelete,
  folderList,
  folderRename,
  libraryImport,
  libraryJSON,
  setCategoryOf,
  soundAdd,
  soundDelete,
  soundOf,
  soundUpdate,
  soundsUpdate,
  soundsLoad,
  ratingOf,
  setRating,
  typeOf
} from './zc-sounds.js';

/* what the browser shows (kept while the editor is open) */
const B = {
  q: '',
  bank: 'all',
  group: '',
  cat: '',
  tag: '',
  sort: { by: 'bank', dir: 1 },
  edit: null,
  grab: null,
  cur: null,
  /* the sounds picked with Ctrl- or Shift-click, and where a Shift-click range starts */
  sel: new Set(),
  anchor: null
};

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
const shown = () => sortList(filterList(entries(), B), B.sort.by, B.sort.dir);

/** Open the browser over the editor. */
export async function browserOpen() {
  /* tones only: the MC-707 keeps a kit's drum sounds whatever is sent */
  if (ZE.kind === 'kit') return;
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
  /* mark the row without redrawing the list (keeps the place and the keyboard focus) */
  const box = $('#zbOv .zbList');
  if (box) {
    box.querySelectorAll('.zbItem.cur').forEach(r => r.classList.remove('cur'));
    const r = [...box.querySelectorAll('.zbItem')].find(x => x.dataset.id === e.id);
    if (r) (r.classList.add('cur'), r.scrollIntoView({ block: 'nearest' }));
    box.focus({ preventScroll: true });
  }
  return done;
}
async function play(e, x) {
  x.stopPropagation();
  /* load first (the track is quiet while the sound goes in), then play while still held */
  let up = false;
  const u = () => (up = true);
  addEventListener('pointerup', u);
  if (B.cur !== e.id) await load(e);
  removeEventListener('pointerup', u);
  if (!up) audition(e.type === 'bass' || /bass/i.test(catOf(e)) ? 36 : 60);
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

/* after a save: My sounds, with the sound picked, so it is there to see (or the same one, already saved) */
function showSaved(e, name) {
  const got = e || ZS.list.find(x => x.src === 'mine' && x.name === name);
  toast(e ? 'Saved ' + e.name + ' to My sounds' : 'It is already in My sounds as ' + name);
  if (got) Object.assign(B, { bank: 'mine', group: '', cat: '', tag: '', q: '', cur: got.id });
}

/* ---- picking several ---- */
/* your own sounds can be changed; factory tones and starters only copied */
const editable = e => e.src !== 'starter' && e.src !== 'factory';
const picked = () => entries().filter(e => B.sel.has(e.id));
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* a click on a row: Ctrl (⌘) adds or removes it, Shift picks the range from the last one, a plain click
   loads it (and lets go of any picked) */
function click(e, x) {
  if (x.ctrlKey || x.metaKey) {
    B.sel.has(e.id) ? B.sel.delete(e.id) : B.sel.add(e.id);
    B.anchor = e.id;
    return paintSel();
  }
  if (x.shiftKey) {
    const l = shown(),
      a = l.findIndex(y => y.id === (B.anchor || B.cur)),
      b = l.findIndex(y => y.id === e.id);
    if (a < 0) B.sel.add(e.id);
    else for (let i = Math.min(a, b); i <= Math.max(a, b); i++) B.sel.add(l[i].id);
    return paintSel();
  }
  B.anchor = e.id;
  if (B.sel.size) (B.sel.clear(), paintSel());
  load(e);
}
/* show what is picked without redrawing the list (keeps its place) */
function paintSel() {
  const ov = $('#zbOv');
  if (!ov) return;
  ov.querySelectorAll('.zbItem').forEach(r => {
    const on = B.sel.has(r.dataset.id);
    r.classList.toggle('sel', on);
    r.setAttribute('aria-selected', String(on));
  });
  const bar = $('.zbSelBar', ov);
  if (bar) bar.replaceWith(selBar());
}
const menuFrom = (x, items) => {
  const r = x.currentTarget.getBoundingClientRect();
  showMenu(r.left, r.bottom + 4, items);
};
/* change your own sounds among list; the others are left, and the message says so */
async function changeOwn(list, fn, what) {
  const own = list.filter(editable),
    left = list.length - own.length;
  if (!own.length) return toast('Factory tones and starters cannot be changed. Copy them to a folder first.');
  await soundsUpdate(
    own.map(e => e.id),
    fn
  );
  toast(what + ' ' + plural(own.length, 'sound') + (left ? '. ' + left + ' factory or starter left as they are' : ''));
  render();
}
async function newFolder() {
  const n = await askDlg({ title: 'New folder', input: true, def: '', ok: 'Make' });
  return n ? folderAdd(n) : '';
}
/* the places a sound can go: My sounds, each folder, a new folder */
function targets(fn) {
  return [
    { label: 'My sounds', action: () => fn('') },
    ...folderList().map(f => ({ label: '📁 ' + f, action: () => fn(f) })),
    '-',
    {
      label: 'New folder…',
      action: async () => {
        const f = await newFolder();
        if (f) fn(f);
      }
    }
  ];
}
const placeName = f => (f ? f : 'My sounds');
/* copies (any sound: factory tones and starters too) */
async function copyTo(list, folder) {
  let n = 0;
  for (const e of list)
    if (
      await soundAdd(e.make ? e.make() : soundOf(e), {
        name: e.name,
        type: e.type,
        tags: e.tags || [],
        src: 'mine',
        folder,
        mine: true
      })
    )
      n++;
  toast(
    n
      ? 'Copied ' + plural(n, 'sound') + ' to ' + placeName(folder)
      : 'Already in ' + placeName(folder) + ' under the same name'
  );
  render();
}
const moveTo = (list, folder) =>
  changeOwn(
    list,
    e => {
      e.src = 'mine';
      if (folder) e.folder = folder;
      else delete e.folder;
    },
    'Moved to ' + placeName(folder) + ':'
  );
/* the tag menu: add one (the genre tags, the ones in use, a new one) or take one off */
function tagItems(list) {
  const have = [...new Set(list.flatMap(e => e.tags || []))].sort();
  const all = [...new Set([...GENRE_TAGS, ...entries().flatMap(e => e.tags || [])])];
  const add = t => changeOwn(list, e => (e.tags = [...new Set([...(e.tags || []), t])]), 'Tagged ' + t + ':');
  return [
    {
      label: 'Add tag',
      sub: [
        ...all.map(t => ({ label: t, action: () => add(t) })),
        '-',
        {
          label: 'New tag…',
          action: async () => {
            const t = await askDlg({ title: 'New tag', input: true, def: '', ok: 'Add' });
            if (t && t.trim()) add(t.trim().slice(0, 20));
          }
        }
      ]
    },
    have.length
      ? {
          label: 'Remove tag',
          sub: have.map(t => ({
            label: t,
            action: () => changeOwn(list, e => (e.tags = (e.tags || []).filter(x => x !== t)), 'Took ' + t + ' off')
          }))
        }
      : null
  ];
}
/* the category menu, in its groups (tones only: a kit is always Drums) */
const catItems = list =>
  CAT_GROUPS.map(([g, cats]) => ({
    label: g,
    sub: cats.map(c => ({
      label: catLabel(c),
      action: () => changeOwn(list, e => setCategoryOf(e, c), 'Set ' + catLabel(c) + ' on')
    }))
  }));
async function deleteMany(list) {
  const own = list.filter(editable);
  if (!own.length) return toast('Factory tones and starters cannot be deleted');
  if (!(await askDlg({ title: 'Delete ' + plural(own.length, 'sound') + '?', ok: 'Delete' }))) return;
  for (const e of own) {
    await soundDelete(e.id);
    B.sel.delete(e.id);
  }
  render();
}

/* the bar above the table: what is picked and what to do with it */
function selBar() {
  const list = picked();
  if (!list.length)
    return el(
      'div',
      { class: 'zbSelBar hint' },
      'Ctrl-click or Shift-click sounds to pick several: tag them, set their category, or copy them to a folder.'
    );
  const btn = (label, title, onclick, cls) =>
    el('button', { type: 'button', class: 'btn sm' + (cls || ''), title, onclick }, label);
  return el(
    'div',
    { class: 'zbSelBar on', role: 'toolbar', 'aria-label': 'Picked sounds' },
    el('b', {}, list.length + ' picked'),
    btn('Tag ▾', 'Add a tag to the picked sounds, or take one off', x => menuFrom(x, tagItems(list))),
    ZE.kind === 'tone'
      ? btn('Category ▾', 'Set the ZenCore category of the picked sounds', x => menuFrom(x, catItems(list)))
      : null,
    btn('Copy to ▾', 'Copy them into My sounds or a folder', x =>
      menuFrom(
        x,
        targets(f => copyTo(list, f))
      )
    ),
    btn('Move to ▾', 'Move your own sounds into My sounds or a folder', x =>
      menuFrom(
        x,
        targets(f => moveTo(list, f))
      )
    ),
    btn('Delete', 'Delete the picked sounds of your own', () => deleteMany(list), ' zbDanger'),
    el('span', { class: 'zbGap' }),
    btn('Pick all shown', 'Pick every sound in the list', () => (shown().forEach(e => B.sel.add(e.id)), paintSel())),
    btn('Clear', 'Let go of the picked sounds', () => (B.sel.clear(), paintSel()))
  );
}

/* a sound's right-click menu */
function rowMenu(e, x, y) {
  const r = ratingOf(e.id),
    mine = e.src !== 'starter';
  showMenu(x, y, [
    { label: 'Load into this clip', action: () => load(e) },
    {
      label: 'Rating',
      sub: [3, 2, 1, 0].map(n => ({
        label: n ? '★'.repeat(n) + '☆'.repeat(3 - n) : 'No rating',
        checked: r === n,
        action: () => (setRating(e.id, n), render())
      }))
    },
    '-',
    mine && e.src !== 'factory' ? { label: 'Name, type and tags…', action: () => ((B.edit = e.id), render()) } : null,
    !mine || e.src === 'factory'
      ? {
          label: 'Save a copy to my sounds',
          action: async () => {
            const n = await soundAdd(e.make ? e.make() : soundOf(e), {
              name: e.name,
              type: e.type,
              tags: e.tags || [],
              src: 'mine',
              mine: true
            });
            showSaved(n, e.name);
            render();
          }
        }
      : null,
    {
      label: 'Only ' + catLabel(catOf(e)),
      action: () => ((B.cat = catOf(e)), (B.group = ''), render())
    },
    { label: 'Show its bank', action: () => ((B.bank = bankOf(e)), render()) },
    '-',
    { label: 'Copy to', sub: targets(f => copyTo([e], f)) },
    editable(e) ? { label: 'Move to', sub: targets(f => moveTo([e], f)) } : null,
    mine && e.src !== 'factory'
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
/* the ⋯ button's menu */
function more(e, x) {
  const rr = x.currentTarget.getBoundingClientRect();
  rowMenu(e, rr.left, rr.bottom + 4);
}
/* the edit form under the entry being changed */
const editRow = e =>
  B.edit === e.id
    ? form(e, async v => {
        B.edit = null;
        if (v) await soundUpdate(e.id, v);
        render();
      })
    : null;

async function grab(scope) {
  if (B.grab) return;
  B.grab = { stop: false, done: 0, n: 0, added: 0, msg: '' };
  render();
  const g = await grabClips(scope, B.grab, status);
  B.grab = null;
  if (g && g.added) B.bank = 'mc707';
  render();
}
function status() {
  const s = $('#zbStat'),
    g = B.grab;
  if (!s) return;
  s.textContent = g ? g.msg + ' · ' + g.done + ' of ' + g.n + ' · ' + g.added + ' new' : '';
}

/* the buttons along the top: save, grab (and the factory tones), backup, done */
function toolbar() {
  const saving = B.edit === 'new';
  const menuBtn = (label, title, items, cls) =>
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm' + (cls || ''),
        title,
        onclick: x => {
          const rr = x.currentTarget.getBoundingClientRect();
          showMenu(rr.left, rr.bottom + 4, items());
        }
      },
      label
    );
  const importLib = () => {
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
  };
  return el(
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
      : menuBtn(
          'Grab from ' + DEVS[DEV].name + ' ▾',
          'Read sounds from the ' + DEVS[DEV].name + "'s clips into the library",
          () => [
            { label: 'This clip', action: () => grab('clip') },
            { label: 'All 16 clips of track ' + devNum(ZE.t), action: () => grab('track') },
            { label: 'Every clip of every track', action: () => grab('all') },
            ...(ZE.kind === 'tone' ? ['-', ...factoryItems(n => (n && (B.bank = 'factory'), render()))] : [])
          ]
        ),
    menuBtn('Backup ▾', 'Export or import your sound library', () => [
      { label: 'Export the library to a file…', action: () => hooks.saveFile('mc707-sounds.json', libraryJSON()) },
      { label: 'Import a library file…', action: importLib }
    ]),
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm',
        onclick: browserClose,
        title: 'Close the browser and edit this sound in the ZenCore editor'
      },
      'Edit in ZenCore'
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm on',
        onclick: () => (browserClose(), zenClose()),
        title: 'Close the browser and the editor, back to the tracks'
      },
      'Done'
    )
  );
}

/* the banks down the left, with how many sounds each holds */
function banksPane(all) {
  const n = id => filterList(all, { ...B, bank: id, group: '', cat: '', tag: '', q: '' }).length;
  const item = (id, label, cls, title) =>
    el(
      'button',
      {
        type: 'button',
        class: 'zbChip zbBk' + (cls ? ' ' + cls : '') + (B.bank === id ? ' on' : ''),
        title: title || '',
        onclick: () => ((B.bank = id), (B.group = B.cat = ''), render())
      },
      el('span', {}, label),
      el('i', {}, String(n(id)))
    );
  const banks = banksIn(all),
    fac = banks.filter(b => b.startsWith('f:'));
  /* a folder: right-click to rename or remove it */
  const folder = f => {
    const b = item('u:' + f, '📁 ' + f, 'zbSub zbFold', 'Right-click to rename or remove');
    b.oncontextmenu = x => {
      x.preventDefault();
      showMenu(x.clientX, x.clientY, [
        {
          label: 'Rename…',
          action: async () => {
            const n = await askDlg({ title: 'Rename ' + f, input: true, def: f, ok: 'Rename' });
            if (n && n.trim()) {
              await folderRename(f, n);
              if (B.bank === 'u:' + f) B.bank = 'u:' + n.trim().slice(0, 30);
              render();
            }
          }
        },
        {
          label: 'Remove the folder…',
          danger: true,
          action: async () => {
            if (
              !(await askDlg({
                title: 'Remove ' + f + '?',
                text: 'Its sounds go back to My sounds; none are deleted.',
                ok: 'Remove'
              }))
            )
              return;
            await folderDelete(f);
            if (B.bank === 'u:' + f) B.bank = 'mine';
            render();
          }
        }
      ]);
    };
    return b;
  };
  return el(
    'nav',
    { class: 'zbBanks', 'aria-label': 'Banks' },
    el('h4', {}, 'Bank'),
    item('all', 'All'),
    item('fav', '★ Favourites', '', 'Every sound you have rated'),
    item('mine', 'My sounds', '', 'Sounds you saved that are in no folder'),
    ...folderList().map(folder),
    el(
      'button',
      {
        type: 'button',
        class: 'zbChip zbBk zbSub zbNewF',
        title: 'Make a folder for your own sounds',
        onclick: async () => {
          const f = await newFolder();
          if (f) ((B.bank = 'u:' + f), (B.group = B.cat = ''), render());
        }
      },
      '+ New folder'
    ),
    ...banks.filter(b => b === 'mc707').map(b => item(b, bankName(b))),
    ZE.kind === 'tone'
      ? item('factory', 'Factory', 'zbGrp', fac.length ? 'Every factory bank' : 'Add them with Grab ▾ › Factory tones')
      : null,
    ...fac.map(b => item(b, bankName(b), 'zbSub')),
    banks.includes('starter') ? item('starter', 'Starters') : null
  );
}

/* the category tree in the middle: a group, then its categories (only the ones with sounds) */
function catsPane(inBank) {
  const c = catCounts(inBank);
  const item = (label, count, on, fn, cls) =>
    el(
      'button',
      { type: 'button', class: 'zbCt' + (cls ? ' ' + cls : '') + (on ? ' on' : ''), onclick: fn },
      el('span', {}, label),
      el('i', {}, String(count))
    );
  const out = [item('All', inBank.length, !B.group && !B.cat, () => ((B.group = B.cat = ''), render()), 'zbCg')];
  for (const [g, cats] of CAT_GROUPS) {
    if (!c['g:' + g]) continue;
    out.push(item(g, c['g:' + g], B.group === g && !B.cat, () => ((B.group = g), (B.cat = ''), render()), 'zbCg'));
    for (const k of cats)
      if (c[k]) out.push(item(catLabel(k), c[k], B.cat === k, () => ((B.cat = k), (B.group = ''), render())));
  }
  return el(
    'nav',
    { class: 'zbCats', 'aria-label': 'Categories' },
    el('h4', {}, 'Category'),
    ...out,
    ...tagsPart(inBank)
  );
}
/* the tags under the categories: click one to show only the sounds with it (again to show all) */
function tagsPart(inBank) {
  const all = entries(),
    base = filterList(all, { ...B, tag: '', q: '' }),
    tags = [...new Set(all.flatMap(e => e.tags || []))].sort((a, b) => a.localeCompare(b));
  const n = t => base.filter(e => (e.tags || []).includes(t)).length;
  const item = (label, count, on, fn, title) =>
    el(
      'button',
      { type: 'button', class: 'zbCt zbTagF' + (on ? ' on' : ''), title, onclick: fn },
      el('span', {}, label),
      el('i', {}, String(count))
    );
  return [
    el('h4', { class: 'zbTagH' }, 'Tag'),
    tags.length
      ? item('Any', base.length, !B.tag, () => ((B.tag = ''), render()), 'Sounds with any tag or none')
      : el('p', { class: 'hint zbNoTags' }, 'No tags yet. Pick sounds and use Tag ▾, or ⋯ › Name, type and tags.'),
    ...tags.map(t =>
      item(t, n(t), B.tag === t, () => ((B.tag = B.tag === t ? '' : t), render()), 'Only sounds tagged ' + t)
    )
  ];
}

function emptyText(all) {
  if (B.bank === 'factory' && !all.some(e => e.src === 'factory'))
    return 'Add the factory tones with Grab ▾ › Factory tones from the MC-707 update file (MC707_UPA_up.bin from Roland).';
  if (B.bank === 'mc707' && !all.some(e => e.src === 'mc707'))
    return 'Nothing grabbed yet. Pick sounds into clips on the ' + DEVS[DEV].name + ', then use Grab.';
  /* a search that finds nothing here, but would elsewhere: say so (the button searches everything) */
  if (B.q.trim() && (B.bank !== 'all' || B.cat || B.group || B.tag)) {
    const n = filterList(all, { ...B, bank: 'all', cat: '', group: '', tag: '' }).length;
    if (n)
      return 'Nothing here matches “' + B.q.trim() + '”, but ' + n + ' sound' + (n === 1 ? '' : 's') + ' elsewhere do.';
  }
  return B.q.trim() ? 'Nothing matches “' + B.q.trim() + '”. Try fewer words, or part of a name.' : 'Nothing here yet.';
}

function render() {
  const ov = $('#zbOv');
  if (!ov) return;
  if (ZE.kind === 'kit') return browserClose();
  const all = entries(),
    list = shown();
  const old = $('.zbList', ov),
    scroll = old ? old.scrollTop : 0;
  ov.textContent = '';
  const box = el('div', { class: 'zbList', role: 'rowgroup', tabindex: 0, 'aria-label': 'Sounds' });
  const count = el('span', { class: 'zbN hint' });
  const drawList = () => {
    const l = shown();
    count.textContent = l.length + ' shown';
    box.textContent = '';
    box.scrollTop = 0;
    if (!l.length) {
      const msg = emptyText(all);
      box.append(
        el(
          'p',
          { class: 'hint zbEmpty' },
          msg,
          / elsewhere do\.$/.test(msg)
            ? el(
                'button',
                {
                  type: 'button',
                  class: 'btn sm',
                  style: 'margin-left:8px',
                  onclick: () => {
                    Object.assign(B, { bank: 'all', cat: '', group: '', tag: '' });
                    render();
                  }
                },
                'Search all sounds'
              )
            : null
        )
      );
    }
    fillTable(box, l, { cur: B.cur, sel: B.sel, click, load, play, menu: rowMenu, more, redraw: render }, editRow);
  };
  const q = el('input', {
    id: 'zbQ',
    type: 'search',
    class: 'zbQ',
    placeholder:
      'Search ' + all.length + ' ' + (ZE.kind === 'kit' ? 'kits' : 'tones') + ' by name, category, tag or number',
    value: B.q,
    'aria-label': 'Search',
    oninput: e => {
      B.q = e.target.value;
      drawList();
    },
    /* Esc clears a search first (a second Esc closes the browser); Enter or Down goes to the results */
    onkeydown: e => {
      if (e.key === 'Escape' && e.target.value) {
        e.preventDefault();
        e.stopPropagation();
        e.target.value = B.q = '';
        drawList();
      } else if ((e.key === 'ArrowDown' || e.key === 'Enter') && box.querySelector('.zbItem')) {
        e.preventDefault();
        box.focus();
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: false }));
      }
    }
  });
  const inBank = filterList(all, { ...B, group: '', cat: '' });
  ov.append(
    el(
      'div',
      { class: 'ptBox zcBox zbBox' },
      el('div', { class: 'zbHead' }, el('b', {}, 'Sounds'), q, count, toolbar()),
      B.edit === 'new'
        ? form(
            { name: ZE.snd.v[ZE.kind === 'kit' ? 'KCMN.NAME' : 'CMN.NAME'] || '', type: typeOf(ZE.snd), tags: [] },
            async v => {
              B.edit = null;
              if (v) {
                showSaved(await soundAdd(ZE.snd, { ...v, src: 'mine', mine: true }), v.name);
              }
              render();
            }
          )
        : null,
      el('div', { id: 'zbStat', class: 'zcStat ok' }),
      el(
        'div',
        { class: 'zbPanes' },
        banksPane(all),
        catsPane(inBank),
        el(
          'div',
          { class: 'zbMain' },
          selBar(),
          tableHead(B.sort, by => {
            B.sort = { by, dir: B.sort.by === by ? -B.sort.dir : 1 };
            render();
          }),
          box
        )
      )
    )
  );
  drawList();
  box.scrollTop = scroll;
  status();
}
