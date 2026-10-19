// The pattern library panel: search and filters, favourites, previewing a pattern (on the track
// that suits it), and adding it to the song.
//
// Owns: FAVS (favourite patterns).
// Reads: S, UI, TR, FAC, DEV.
// Calls up the layers through hooks (core/hooks.js).
import { $, el, toast } from '../core/dom.js';
import { NOTE_NAMES } from '../core/theory.js';
import { FAC } from '../library/factory.js';
import { DEV, DEVS, TRACK_COLORS, devNum } from '../core/device.js';
import { S, UI, curClip } from '../core/state.js';
import { hideGhost, placeSrc, renderArr, setDrag } from './arrangement.js';
import { metaOf } from '../library/index.js';
import { TR, startPat, stopPlay } from '../services/transport.js';
import { CT_DEF, ctInfo, patType } from '../services/clip-switch.js';
import { STYLES } from '../library/styles.js';
import { showMenu } from '../ui/menu.js';
import { libMenuItems } from './arrangement-menus.js';
import { userLib } from '../library/user-lib.js';
import { openView } from './lib-view.js';
import { hooks } from '../core/hooks.js';

/* ---------- library ---------- */
function chipRow(host, opts, cur, fn) {
  host.textContent = '';
  opts.forEach(([v, l]) =>
    host.append(el('button', { class: 'btn' + (v === cur ? ' on' : ''), onclick: () => fn(v) }, l))
  );
}
export const SHORT = {
  liquid: 'Liquid',
  neuro: 'Neuro',
  jungle: 'Jungle',
  jumpup: 'Jump-up',
  halftime: 'Halftime',
  boombap: 'Boom bap',
  trap: 'Trap',
  lofi: 'Lo-fi',
  gfunk: 'G-funk',
  drill: 'Drill',
  neosoul: 'Neo-soul',
  memphis: 'Memphis'
};
const GENRE_WORDS = { dnb: 'dnb d&b', hiphop: 'hiphop hip hop rap' };
const GENRE_LABELS = {
  dnb: 'Drum and bass',
  hiphop: 'Hip hop',
  house: 'House',
  techno: 'Techno',
  garage: 'UK garage',
  dubstep: 'Dubstep',
  trance: 'Trance',
  electro: 'Electro and breaks',
  funk: 'Funk and disco',
  reggae: 'Reggae and dub',
  latin: 'Latin and afro',
  synth: 'Synthwave',
  pop: 'Pop and indie',
  ambient: 'Ambient and cinematic',
  bigbeat: 'Big beat'
};
const GENRE_ORDER = Object.keys(GENRE_LABELS);
Object.keys(GENRE_LABELS).forEach(g => {
  GENRE_WORDS[g] = (GENRE_WORDS[g] || '') + ' ' + GENRE_LABELS[g].toLowerCase() + ' ' + g;
});
const TEMPO_BANDS = [
  ['all', 'Any tempo'],
  ['slow', 'Under 80'],
  ['mid', '80–99'],
  ['up', '100–149'],
  ['fast', '150 and up']
];
const tempoBand = b => (!b ? null : b < 80 ? 'slow' : b < 100 ? 'mid' : b < 150 ? 'up' : 'fast');
const ROLE_OPTS = [
  ['all', 'Any role'],
  ['Full kit', 'Full kits'],
  ['Kick', 'Kick layers'],
  ['Snare', 'Snare layers'],
  ['Hats', 'Hat and ride layers'],
  ['Perc', 'Perc layers'],
  ['Fill', 'Fills'],
  ['Build', 'Builds'],
  ['Impact', 'Drop impacts'],
  ['Flash', 'Flash breaks'],
  ['Bass', 'Bass'],
  ['Chords', 'Chords'],
  ['Pad', 'Pads'],
  ['Lead', 'Leads'],
  ['Acid', 'Acid lines']
];
const SORT_OPTS = [
  ['default', 'Library order'],
  ['name', 'Name'],
  ['tempo', 'Tempo'],
  ['length', 'Length'],
  ['key', 'Key']
];
let TAGS = null;
function libTags() {
  if (TAGS) return TAGS;
  TAGS = {};
  FAC.forEach(f => {
    TAGS[f.id] = new Set(f.styles || []);
  });
  for (const st of STYLES)
    for (const pool in st.pools) for (const id of st.pools[pool]) if (TAGS[id]) TAGS[id].add(st.id);
  return TAGS;
}
export const keyLabel = m =>
  m.keyName || (m.key && m.key.root != null ? NOTE_NAMES[m.key.root] + (m.key.scale === 'minor' ? 'm' : '') : '');
const srcOf = it => (it.kind === 'fac' ? it.id : it.m.src || null);
export function itemStyles(it) {
  const id = srcOf(it);
  const t = id && libTags()[id];
  return t ? STYLES.filter(s => t.has(s.id)).map(s => s.id) : [];
}
function libHay(it) {
  const m = it.m;
  const k = keyLabel(m);
  const parts = [
    m.name,
    m.role || '',
    m.type === 'drum' ? 'drums drum beat kit' : 'tone melodic synth',
    GENRE_WORDS[m.genre] || '',
    itemStyles(it)
      .map(id => STYLES.find(s => s.id === id).name + ' ' + SHORT[id])
      .join(' '),
    k ? k + ' ' + NOTE_NAMES[m.key ? m.key.root : 0] + ' minor' : '',
    m.bpm ? m.bpm + ' bpm' : '',
    m.bars + (m.bars === 1 ? ' bar' : ' bars')
  ];
  return parts.join(' ').toLowerCase();
}
export let FAVS = new Set();
try {
  FAVS = new Set(JSON.parse(localStorage.getItem('mc707-song-favs') || '[]'));
} catch (e) {}
export const saveFavs = () => {
  try {
    localStorage.setItem('mc707-song-favs', JSON.stringify([...FAVS]));
  } catch (e) {}
};
function libSelect(label, key, opts) {
  if (!opts.some(o => o[0] === UI[key])) UI[key] = 'all';
  const sel = el('select', {
    'aria-label': label,
    onchange: e => {
      UI[key] = e.target.value;
      renderLibrary();
    }
  });
  opts.forEach(([v, l]) => sel.append(el('option', { value: v, selected: UI[key] === v }, l)));
  return el('label', {}, label, sel);
}
export function libReset() {
  Object.assign(UI, {
    libType: 'all',
    libGenre: 'all',
    libRole: 'all',
    libStyle: 'all',
    libKey: 'all',
    libBars: 'all',
    libTempo: 'all',
    libSort: 'default',
    libFav: false,
    q: ''
  });
  $('#libQ').value = '';
  renderLibrary();
}
export function renderLibrary() {
  chipRow(
    $('#libTabs'),
    [
      ['fac', 'Factory'],
      ['proj', 'Project'],
      ['user', 'Mine']
    ],
    UI.libTab,
    v => {
      UI.libTab = v;
      renderLibrary();
    }
  );
  $('#libTabs').append(
    el(
      'button',
      {
        class: 'btn' + (UI.libFav ? ' on' : ''),
        title: 'Show only patterns you have starred',
        onclick: () => {
          UI.libFav = !UI.libFav;
          renderLibrary();
        }
      },
      '★ Saved'
    )
  );
  chipRow(
    $('#libType'),
    [
      ['all', 'All'],
      ['drum', 'Drums'],
      ['tone', 'Tone']
    ],
    UI.libType,
    v => {
      UI.libType = v;
      renderLibrary();
    }
  );
  {
    const gh = $('#libGenre');
    gh.textContent = '';
    const gs = el('select', {
      'aria-label': 'Genre',
      onchange: e => {
        UI.libGenre = e.target.value;
        renderLibrary();
      }
    });
    gs.append(el('option', { value: 'all', selected: UI.libGenre === 'all' }, 'All genres'));
    GENRE_ORDER.forEach(g => gs.append(el('option', { value: g, selected: UI.libGenre === g }, GENRE_LABELS[g])));
    gh.append(gs);
  }
  const base =
    UI.libTab === 'fac'
      ? FAC.map(f => ({ kind: 'fac', id: f.id, m: f }))
      : UI.libTab === 'user'
        ? userLib().map(p => ({ kind: 'user', id: p.id, m: p }))
        : Object.values(S.patterns).map(p => ({ kind: 'proj', id: p.id, m: p }));
  const pt = $('#prevTrack');
  pt.textContent = '';
  pt.append(el('option', { value: -1, selected: UI.prevTrack === -1 }, 'Auto (first matching track)'));
  S.tracks.forEach((t, i) =>
    pt.append(
      el(
        'option',
        { value: i, selected: UI.prevTrack === i },
        'Track ' + (i + 1) + ': ' + t.name + ' (' + (t.type === 'drum' ? 'drums' : 'tone') + ', ch ' + t.ch + ')'
      )
    )
  );
  pt.onchange = e => {
    UI.prevTrack = +e.target.value;
  };
  /* filter menus */
  const styleOpts = [
    ['all', 'Any style'],
    ...STYLES.filter(s => UI.libGenre === 'all' || s.genre === UI.libGenre).map(s => [s.id, s.name])
  ];
  const keyMap = new Map();
  base.forEach(it => {
    const k = keyLabel(it.m);
    if (k) keyMap.set(k, it.m.key ? it.m.key.root : 99);
  });
  const keyOpts = [['all', 'Any key'], ...[...keyMap.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => [k, k])];
  const bars = [...new Set(base.map(it => it.m.bars))].sort((a, b) => a - b);
  const barOpts = [['all', 'Any length'], ...bars.map(n => [String(n), n + (n === 1 ? ' bar' : ' bars')])];
  const sel = $('#libSel');
  sel.textContent = '';
  sel.append(
    libSelect('Style', 'libStyle', styleOpts),
    libSelect('Role', 'libRole', ROLE_OPTS),
    libSelect('Key', 'libKey', keyOpts),
    libSelect('Tempo', 'libTempo', TEMPO_BANDS),
    libSelect('Length', 'libBars', barOpts),
    libSelect('Sort by', 'libSort', SORT_OPTS)
  );
  /* filtering */
  const tokens = UI.q
    .toLowerCase()
    .replace(/drum\s*(?:and|&|'?n'?)\s*bass/g, 'dnb')
    .replace(/hip[\s-]*hop/g, 'hiphop')
    .split(/\s+/)
    .filter(Boolean);
  const pass = it => {
    const m = it.m;
    if (UI.libType !== 'all' && m.type !== UI.libType) return false;
    if (UI.libGenre !== 'all' && m.genre !== UI.libGenre) return false;
    if (UI.libRole === 'Flash') {
      if (!(m.flash || m.role === 'Flash' || / Flash: /.test(m.name || ''))) return false;
    } else if (UI.libRole !== 'all' && (m.role || (m.type === 'drum' ? 'Full kit' : '')) !== UI.libRole) return false;
    if (UI.libStyle !== 'all' && !itemStyles(it).includes(UI.libStyle)) return false;
    if (UI.libKey !== 'all' && keyLabel(m) !== UI.libKey) return false;
    if (UI.libBars !== 'all' && String(m.bars) !== UI.libBars) return false;
    if (UI.libTempo !== 'all' && tempoBand(m.bpm) !== UI.libTempo) return false;
    if (UI.libFav && !FAVS.has(it.kind + ':' + it.id)) return false;
    if (tokens.length) {
      const h = libHay(it);
      for (const t of tokens) if (!h.includes(t)) return false;
    }
    return true;
  };
  const items = base.filter(pass);
  const byName = (a, b) => a.m.name.localeCompare(b.m.name);
  const sorters = {
    name: byName,
    tempo: (a, b) => (a.m.bpm || 999) - (b.m.bpm || 999) || byName(a, b),
    length: (a, b) => a.m.bars - b.m.bars || byName(a, b),
    key: (a, b) => (a.m.key ? a.m.key.root : 99) - (b.m.key ? b.m.key.root : 99) || byName(a, b)
  };
  if (sorters[UI.libSort]) items.sort(sorters[UI.libSort]);
  const active =
    ['libType', 'libGenre', 'libRole', 'libStyle', 'libKey', 'libBars', 'libTempo'].filter(k => UI[k] !== 'all')
      .length +
    (UI.libFav ? 1 : 0) +
    (tokens.length ? 1 : 0);
  $('#libCount').textContent = items.length + ' of ' + base.length + ' patterns';
  $('#libClear').style.visibility = active || UI.libSort !== 'default' ? 'visible' : 'hidden';
  const hidden =
    ['libRole', 'libStyle', 'libKey', 'libBars', 'libTempo'].filter(k => UI[k] !== 'all').length +
    (UI.libSort !== 'default' ? 1 : 0);
  $('#libMoreSum').textContent = hidden ? 'More filters (' + hidden + ' active)' : 'More filters';
  const list = $('#libList');
  list.textContent = '';
  if (!items.length) {
    list.append(
      el(
        'div',
        { class: 'empty' },
        UI.libTab === 'proj' && !base.length
          ? 'No patterns in this song yet. Place one from the factory library or double-click a track lane.'
          : UI.libTab === 'user' && !base.length
            ? 'Nothing saved yet. Open a pattern in the editor and press Save to My patterns.'
            : 'No patterns match. Try removing a filter or a search word.',
        el('br'),
        el('button', { class: 'btn sm', style: 'margin-top:8px', onclick: libReset }, 'Clear filters')
      )
    );
    return;
  }
  const sig = JSON.stringify([
    UI.libTab,
    UI.libType,
    UI.libGenre,
    UI.libRole,
    UI.libStyle,
    UI.libKey,
    UI.libBars,
    UI.libTempo,
    UI.libSort,
    UI.libFav,
    UI.q
  ]);
  if (UI._sig !== sig) {
    UI._sig = sig;
    UI.libLimit = 60;
  }
  for (const it of items.slice(0, UI.libLimit)) {
    const m = it.m;
    const col = m.type === 'drum' ? TRACK_COLORS[0] : TRACK_COLORS[3];
    const cv = el('canvas', { width: 128, height: 60 });
    drawThumb(cv, m, col);
    const uses = UI.libTab === 'proj' ? S.clips.filter(c => c.pat === m.id).length : 0;
    const meta = [
      m.role || (m.type === 'drum' ? 'Drums' : 'Tone'),
      m.bars + (m.bars === 1 ? ' bar' : ' bars'),
      keyLabel(m),
      UI.libTab === 'fac'
        ? m.bpm
          ? m.bpm + ' bpm'
          : ''
        : UI.libTab === 'proj'
          ? uses
            ? 'used ×' + uses
            : 'unused'
          : ''
    ]
      .filter(Boolean)
      .join(' · ');
    const styles = itemStyles(it);
    const tags = el(
      'div',
      { class: 'tags' },
      ...styles.slice(0, 3).map(id =>
        el(
          'button',
          {
            class: 'tagc' + (UI.libStyle === id ? ' on' : ''),
            title: 'Show only ' + STYLES.find(s => s.id === id).name,
            onclick: ev => {
              ev.stopPropagation();
              UI.libStyle = UI.libStyle === id ? 'all' : id;
              renderLibrary();
            }
          },
          SHORT[id]
        )
      ),
      ...(styles.length > 3 ? [el('span', { class: 'hint' }, '+' + (styles.length - 3))] : [])
    );
    const fk = it.kind + ':' + it.id;
    const faved = FAVS.has(fk);
    const star = el(
      'button',
      {
        class: 'btn sm star' + (faved ? ' on' : ''),
        title: faved ? 'Remove from saved' : 'Save for later',
        onclick: ev => {
          ev.stopPropagation();
          if (faved) FAVS.delete(fk);
          else FAVS.add(fk);
          saveFavs();
          renderLibrary();
        }
      },
      '★'
    );
    const aud = el(
      'button',
      {
        class: 'btn sm aud',
        title: 'Preview',
        onclick: ev => {
          ev.stopPropagation();
          auditionLib(m);
        }
      },
      '▶'
    );
    aud._pat = m;
    const pvt = m.type === 'tone' ? previewTrackFor(m, true) : null;
    const acts = el(
      'div',
      { class: 'acts' },
      aud,
      ...(m.type === 'tone'
        ? [
            el(
              'button',
              {
                class: 'btn sm pvt',
                style: '--c:' + TRACK_COLORS[pvt],
                title:
                  'Previews on track ' + devNum(pvt) + ': ' + S.tracks[pvt].name + '. Click to choose any tone track.',
                onclick: ev => {
                  ev.stopPropagation();
                  prvPick(m, ev);
                }
              },
              '→' + devNum(pvt)
            )
          ]
        : []),
      el(
        'button',
        {
          class: 'btn sm',
          title: 'Add at the playhead',
          onclick: ev => {
            ev.stopPropagation();
            quickAdd({ kind: it.kind, id: it.id });
          }
        },
        '+'
      ),
      star
    );
    const row = el(
      'div',
      {
        class:
          'li' +
          (UI.arm && UI.arm.id === it.id && UI.arm.kind === it.kind ? ' armed' : '') +
          (UI.view && UI.view.srcId === it.id && UI.view.kind === it.kind ? ' viewing' : ''),
        draggable: 'true',
        style: '--c:' + col,
        onclick: () => {
          const same = UI.arm && UI.arm.id === it.id && UI.arm.kind === it.kind;
          UI.arm = same ? null : { kind: it.kind, id: it.id };
          if (UI.arm) openView(UI.arm, previewTrackFor(m, true));
          if (!UI.arm) hideGhost();
          if (UI.arm && innerWidth <= 860) {
            $('#main').classList.add('nolib');
            $('#bLibT').classList.remove('on');
            toast('Now tap a track lane to place it');
          }
          renderLibrary();
          renderArr();
        },
        ondragstart: ev => {
          setDrag({ kind: it.kind, id: it.id });
          ev.dataTransfer.effectAllowed = 'copy';
          ev.dataTransfer.setData('text/plain', it.id);
        },
        oncontextmenu: ev => {
          ev.preventDefault();
          showMenu(ev.clientX, ev.clientY, libMenuItems(it));
        },
        ondragend: () => {
          setDrag(null);
          hideGhost();
        }
      },
      cv,
      el('div', { class: 't' }, el('b', {}, m.name), el('small', {}, meta), tags),
      acts
    );
    list.append(row);
  }
  if (items.length > UI.libLimit)
    list.append(
      el(
        'button',
        {
          class: 'btn showmore',
          onclick: () => {
            UI.libLimit += 60;
            renderLibrary();
          }
        },
        'Show 60 more (' + (items.length - UI.libLimit) + ' left)'
      )
    );
  hooks.updTransport();
}
function drawThumb(cv, m, col) {
  const x = cv.getContext('2d');
  const w = cv.width,
    h = cv.height,
    L = m.bars * 16;
  x.fillStyle = col;
  if (!m.notes.length) return;
  let lo = 0,
    hi = 11;
  if (m.type === 'tone') {
    lo = Math.min(...m.notes.map(n => n.n));
    hi = Math.max(...m.notes.map(n => n.n));
    if (hi - lo < 7) {
      const mid = (hi + lo) / 2;
      lo = mid - 3.5;
      hi = mid + 3.5;
    }
  }
  for (const n of m.notes) {
    const px = (n.s / L) * w,
      pw = Math.max(2, (n.l / L) * w - 1);
    const yy = m.type === 'drum' ? (n.n / 11) * (h - 6) + 2 : (1 - (n.n - lo) / (hi - lo || 1)) * (h - 6) + 2;
    x.globalAlpha = 0.5 + (0.5 * n.v) / 127;
    x.fillRect(px, yy, pw, 4);
  }
}
function trackFor(type) {
  const c = curClip();
  if (c && S.tracks[c.t].type === type) return c.t;
  return type === 'drum' ? 0 : 3;
}
/* tone patterns preview on the track that suits them (bass on Bass, a lead on Lead …) unless you pick another tone track */
const PRVMAP = (() => {
  try {
    return JSON.parse(localStorage.getItem('mc707-prevmap') || '{}') || {};
  } catch (e) {
    return {};
  }
})();
const PRV_DEF = { bass: 3, chords: 4, pad: 5, lead: 6, pluck: 7, fx: 4 };
export const toneTracks = () => DEVS[DEV].tracks.filter(i => S.tracks[i].type === 'tone');
function prvTone(m) {
  const ty = patType(m) || 'chords',
    tt = toneTracks();
  let t = PRVMAP[ty];
  if (t == null || !tt.includes(t) || S.tracks[t].type !== 'tone') {
    t = PRV_DEF[ty];
    if (!tt.includes(t)) t = tt.find(i => CT_DEF[i] === ty);
    if (t == null || !tt.includes(t)) t = tt[0];
  }
  return t != null ? t : 3;
}
function prvPick(m, ev) {
  const ty = patType(m) || 'chords',
    cur = previewTrackFor(m, true),
    r = ev.currentTarget.getBoundingClientRect();
  showMenu(r.left, r.bottom + 2, [
    { label: 'Preview ' + ctInfo(ty)[1].toLowerCase() + ' patterns on…', disabled: true },
    ...toneTracks().map(i => ({
      label: 'Track ' + devNum(i) + ': ' + S.tracks[i].name + ' (ch ' + S.tracks[i].ch + ')',
      checked: cur === i,
      action: () => {
        PRVMAP[ty] = i;
        try {
          localStorage.setItem('mc707-prevmap', JSON.stringify(PRVMAP));
        } catch (e) {}
        UI.prevTrack = -1;
        renderLibrary();
        auditionLib(m, i);
      }
    }))
  ]);
}
export function previewTrackFor(m, quiet) {
  const pt = UI.prevTrack;
  if (pt >= 0) {
    if (S.tracks[pt].type === m.type) return pt;
    const alt = m.type === 'tone' ? prvTone(m) : trackFor(m.type);
    if (!quiet)
      toast(
        'Track ' +
          (pt + 1) +
          ' is a ' +
          (S.tracks[pt].type === 'drum' ? 'drum' : 'tone') +
          ' track, so this ' +
          (m.type === 'drum' ? 'drum' : 'tone') +
          ' pattern plays on track ' +
          (alt + 1) +
          ' instead'
      );
    return alt;
  }
  if (m.type === 'tone') return prvTone(m);
  return trackFor(m.type);
}
export function auditionLib(m, forceTrack) {
  if (TR.playing && TR.mode === 'pat' && TR.pat === m && forceTrack == null) {
    stopPlay();
    return;
  }
  startPat(m, forceTrack != null ? forceTrack : previewTrackFor(m));
}
export function quickAdd(src) {
  const m = metaOf(src);
  if (!m) return;
  const t = trackFor(m.type);
  const bar = Math.floor(S.cursor);
  placeSrc(src, t, bar);
}
