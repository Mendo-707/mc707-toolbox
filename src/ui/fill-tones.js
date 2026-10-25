// Fill tones: give the MC-707's clips their sounds in one go. Pick a genre and every clip set up on the
// Your MC-707 clips screen gets a suggested tone for its job (bass, chords, pad, lead, pluck, acid, FX;
// a kit for drum clips when the pool has one), different ones across a track's clips. Change any of them
// (from the pool, a shuffle, or any sound in the library), then send them all: each goes into its MC-707
// clip and the track plays its clips' own sounds (Sound Source CLIP).
//
// The pools are editable per genre and job: the suggestions start as the factory tones the song wizard
// suggests for the genre (they need the factory tones added from the MC-707 update file), plus your own
// sounds tagged with the genre; add any sound to a pool, take one out, or reset it.
//
// Owns: localStorage 'mc707-tone-pools' (the edited pools) and 'mc707-fill-genre' (the genre last used).
// Reads: S, ZS, DEV.
import { $, el, toast } from '../core/dom.js';
import { S, scheduleSave } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { CLIP_TYPES, cmFix, ctInfo } from '../services/clip-switch.js';
import { toneGenres } from '../song/sound-suggestions.js';
import { ZS, soundOf, soundsLoad } from '../zen/zc-sounds.js';
import { soundFrom } from '../zen/zc-tone.js';
import { sendSound } from '../zen/zc-tone.js';
import { zeQuietly } from '../zen/zc-editor.js';
import { slotAddr, trackSetAddr, zxConnect, zxFlush, zxRead, zxWrite } from '../zen/zc-sysex.js';
import { clipHasNotes, writeSession } from '../zen/zc-seq.js';
import { factoryImport } from '../zen/zc-factory-ui.js';
import { pickTone } from '../scene/pick-tone.js';
import { askDlg } from './dialogs.js';
import { catOf } from '../zen/zc-browse-data.js';
import { GENRE_WORDS, POOL_MAX, fitScore } from './tone-pools.js';

const KEY = 'mc707-tone-pools',
  GKEY = 'mc707-fill-genre';
/** The jobs a clip can have (the clips screen's clip types). */
const ROLES = CLIP_TYPES.map(c => c[0]);
/* suggestions for the jobs the song wizard has none for */
const EXTRA = {
  acid: ['C-83 SL-TB Saw 1', 'D-741 Acid Bs 1', 'D-686 TB Bass 1', 'D-640 MC202 Bs 1'],
  fx: []
};

let POOLS = null;
function pools() {
  if (POOLS) return POOLS;
  try {
    POOLS = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (e) {
    POOLS = {};
  }
  return POOLS;
}
function savePools() {
  try {
    localStorage.setItem(KEY, JSON.stringify(POOLS));
  } catch (e) {
    toast('Could not keep the pools: the browser storage is full');
  }
}
const genres = () => toneGenres();
const genreOf = id => genres().find(g => g.id === id) || genres()[0];
function genreNow() {
  try {
    const g = localStorage.getItem(GKEY);
    if (g && genres().some(x => x.id === g)) return g;
  } catch (e) {}
  return 'house';
}

/*
 * A pool item is a factory tone named as the MC-707's Sound List does ('A-5 Dark Sub'), or a sound you
 * added: {name, kind, d} (its values that differ from the initial sound).
 */
const itemName = it => (typeof it === 'string' ? it.replace(/^[A-Z]-\d+ /, '') : it.name);
const itemKey = it => (typeof it === 'string' ? it : 'mine:' + it.kind + ':' + it.name);
/** The library entry or sound an item stands for: {name, snd} or null (a factory tone not added yet). */
function resolve(it) {
  if (typeof it !== 'string') return { name: it.name, snd: soundFrom({ zencore: 1, kind: it.kind, v: it.d }) };
  const m = /^([A-Z])-(\d+) (.*)$/.exec(it);
  const e = m
    ? ZS.list.find(x => x.src === 'factory' && x.bank === m[1] && x.no === +m[2]) ||
      ZS.list.find(x => x.src === 'factory' && x.name === m[3])
    : ZS.list.find(x => x.name === it);
  return e ? { name: e.name, snd: soundOf(e) } : null;
}
/* the made pools, until the library changes */
const MADE = new Map();
let madeFor = '';
/** The suggested items for a genre and job (before any edits). */
function defaults(gid, role) {
  const sig = ZS.list.length + ':' + (ZS.list[0] && ZS.list[0].id);
  if (sig !== madeFor) (MADE.clear(), (madeFor = sig));
  const key = gid + ':' + role;
  if (!MADE.has(key)) MADE.set(key, makeDefaults(gid, role));
  return MADE.get(key);
}
function makeDefaults(gid, role) {
  const g = genreOf(gid),
    list = role === 'drums' ? [] : Array.isArray(g.roles[role]) ? g.roles[role] : EXTRA[role] || [];
  /* your own sounds tagged with the genre and of the right type join in */
  const tag = g.label.toLowerCase(),
    fam = (g.group || '').toLowerCase();
  const typeFor = {
    drums: 'drums',
    bass: 'bass',
    acid: 'bass',
    chords: null,
    pad: 'pad',
    lead: 'lead',
    pluck: 'pluck',
    fx: 'fx'
  };
  const mine = ZS.list
    .filter(
      e =>
        e.src !== 'factory' &&
        (e.tags || []).some(t => [tag, fam].includes(String(t).toLowerCase())) &&
        (role === 'drums' ? e.kind === 'kit' : e.kind === 'tone' && (!typeFor[role] || e.type === typeFor[role]))
    )
    .map(e => ({ name: e.name, kind: e.kind, d: e.d }));
  /* then the sounds you have that fit the job and the genre (rules in tone-pools.js) */
  const words = [GENRE_WORDS[g.id], g.fam !== g.id ? GENRE_WORDS[g.fam] : null],
    hits = [];
  for (const e of ZS.list) {
    const n = fitScore({ name: e.name, cat: catOf(e), kind: e.kind }, role, words);
    if (n != null) hits.push([n, e]);
  }
  hits.sort(
    (a, b) => b[0] - a[0] || (a[1].bank || '').localeCompare(b[1].bank || '') || (a[1].no || 0) - (b[1].no || 0)
  );
  const base = role === 'drums' ? 1 : 3,
    fit = hits.filter(([n]) => n > base + 1),
    take = (fit.length >= 12 ? fit : hits.slice(0, Math.max(12, fit.length))).map(([, e]) => e);
  const out = [...list, ...mine],
    seen = new Set(out.map(itemKey));
  for (const e of take) {
    if (out.length >= POOL_MAX) break;
    const it =
      e.src === 'factory' && e.bank ? e.bank + '-' + e.no + ' ' + e.name : { name: e.name, kind: e.kind, d: e.d };
    const k = itemKey(it);
    if (seen.has(k) || out.some(x => itemName(x) === e.name)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
/** The pool for a genre and job: your edited one, else the suggestions. */
export function poolOf(gid, role) {
  const p = pools()[gid];
  return p && Array.isArray(p[role]) ? p[role] : defaults(gid, role);
}
function setPool(gid, role, list) {
  pools();
  POOLS[gid] = POOLS[gid] || {};
  POOLS[gid][role] = list;
  savePools();
}
function resetPool(gid, role) {
  pools();
  if (POOLS[gid]) delete POOLS[gid][role];
  savePools();
}

/* ---- the plan: for each track's clips (as the clips screen sets them up), the job and the item ---- */
const roleAt = (t, k) =>
  S.tracks[t].type === 'drum' ? 'drums' : cmFix()[t].types[k] === 'drums' ? 'pluck' : cmFix()[t].types[k];
function makePlan(gid) {
  const plan = {};
  for (const t of DEVS[DEV].tracks) {
    const n = cmFix()[t].n,
      used = new Map();
    plan[t] = Array.from({ length: n }, (_, k) => {
      const role = roleAt(t, k),
        pool = poolOf(gid, role),
        ok = pool.filter(resolve);
      const from = ok.length ? ok : pool;
      if (!from.length) return { role, item: null, on: false };
      /* different sounds across the track's clips, starting somewhere random */
      const u = used.get(role) || { at: Math.floor(Math.random() * from.length), n: 0 };
      const item = from[(u.at + u.n++) % from.length];
      used.set(role, u);
      /* a kit only goes when you tick it: a drum track's own kit is usually what you want */
      return { role, item, on: role !== 'drums' && !!resolve(item) };
    });
  }
  return plan;
}

/** Open the Fill tones window. */
export async function fillTonesOpen() {
  await soundsLoad();
  $('#ftOv')?.remove();
  let gid = genreNow(),
    plan = makePlan(gid);
  const box = el('div', { class: 'ptBox ftBox' });
  const ov = el(
    'div',
    { id: 'ftOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Fill tones' },
    box
  );
  const close = () => ov.remove();
  const hasFactory = () => ZS.list.some(e => e.src === 'factory');
  const genreSel = (cur, on) =>
    el(
      'select',
      { 'aria-label': 'Genre', onchange: e => on(e.target.value) },
      ...[...new Set(genres().map(g => g.group))].map(grp =>
        grp
          ? el(
              'optgroup',
              { label: grp + ' styles' },
              ...genres()
                .filter(g => g.group === grp)
                .map(g => el('option', { value: g.id, selected: g.id === cur }, g.label))
            )
          : el(
              'optgroup',
              { label: 'Genres' },
              ...genres()
                .filter(g => !g.group)
                .map(g => el('option', { value: g.id, selected: g.id === cur }, g.label))
            )
      )
    );
  const draw = () => {
    const rows = DEVS[DEV].tracks.map(t => {
      const clips = plan[t].map((c, k) => {
        const pool = poolOf(gid, c.role),
          r = c.item && resolve(c.item);
        const pick = el(
          'select',
          {
            'aria-label': 'Track ' + devNum(t) + ' clip ' + (k + 1) + ' sound',
            onchange: e => {
              const v = e.target.value;
              if (v === '__lib') return chooseLib(t, k);
              c.item = pool.find(it => itemKey(it) === v) || c.item;
              c.on = !!resolve(c.item);
              draw();
            }
          },
          ...(c.item && !pool.some(it => itemKey(it) === itemKey(c.item))
            ? [el('option', { value: itemKey(c.item), selected: true }, itemName(c.item))]
            : []),
          ...pool.map(it =>
            el(
              'option',
              { value: itemKey(it), selected: c.item && itemKey(it) === itemKey(c.item), disabled: !resolve(it) },
              itemName(it) + (resolve(it) ? '' : ' (factory tones not added)')
            )
          ),
          el('option', { value: '__lib' }, 'Any sound in the library…')
        );
        if (!c.item)
          pick.prepend(el('option', { value: '', selected: true }, pool.length ? '—' : 'Nothing in the pool'));
        return el(
          'div',
          { class: 'ftClip' + (c.on ? '' : ' off') },
          el('input', {
            type: 'checkbox',
            checked: c.on,
            disabled: !r,
            'aria-label': 'Send clip ' + (k + 1),
            title: r ? 'Send this one' : 'Nothing to send',
            onchange: e => ((c.on = e.target.checked), draw())
          }),
          el('b', {}, String(k + 1)),
          el('span', { class: 'ftRole', style: '--rc:' + ctInfo(c.role)[2] }, ctInfo(c.role)[1]),
          pick,
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm',
              title: 'Another suggestion from the pool',
              onclick: () => {
                const ok = pool.filter(resolve);
                if (!ok.length) return toast('Nothing in this pool can be sent yet');
                const others = ok.filter(it => !c.item || itemKey(it) !== itemKey(c.item));
                c.item = (others.length ? others : ok)[Math.floor(Math.random() * (others.length || ok.length))];
                c.on = true;
                draw();
              }
            },
            '🎲'
          )
        );
      });
      return el(
        'section',
        { class: 'ftTrk', style: '--tc:' + TRACK_COLORS[t] },
        el(
          'div',
          { class: 'ftHead' },
          el('b', {}, devNum(t) + ' ' + S.tracks[t].name),
          el('span', { class: 'hint' }, plan[t].length + ' clip' + (plan[t].length === 1 ? '' : 's'))
        ),
        ...clips
      );
    });
    const n = DEVS[DEV].tracks.reduce((a, t) => a + plan[t].filter(c => c.on).length, 0);
    box.replaceChildren(
      el('h3', {}, 'Fill tones'),
      el(
        'p',
        { class: 'hint' },
        'Every clip set up on the Your MC-707 clips screen gets a sound for its job, from the genre’s pool. Change any, shuffle with 🎲, or pick from the library; then send them all. A track that plays its own sound (Sound Source TRACK) with one clip set up here gets the new sound as that track sound. Otherwise each clip gets its own (Sound Source CLIP, which a different kit or tone per clip needs), and any other clip of the track that holds notes but has no sound of its own gets one too, so none goes quiet. Clips that already have their own sound keep it.'
      ),
      el(
        'div',
        { class: 'ftTop' },
        el('span', {}, 'Genre '),
        genreSel(gid, v => {
          gid = v;
          try {
            localStorage.setItem(GKEY, v);
          } catch (e) {}
          plan = makePlan(gid);
          draw();
        }),
        el(
          'button',
          { type: 'button', class: 'btn sm', onclick: () => ((plan = makePlan(gid)), draw()) },
          '🎲 Shuffle all'
        ),
        el(
          'button',
          { type: 'button', class: 'btn sm', onclick: () => poolsOpen(gid, () => ((plan = makePlan(gid)), draw())) },
          'Edit the pools…'
        )
      ),
      hasFactory()
        ? null
        : el(
            'p',
            { class: 'ftWarn' },
            'The suggestions are MC-707 factory tones: add them once from the MC-707 system update file (MC707_UPA_up.bin) to send them. ',
            el(
              'button',
              { type: 'button', class: 'btn sm', onclick: () => factoryImport(() => ((plan = makePlan(gid)), draw())) },
              'Add the factory tones…'
            )
          ),
      el('div', { class: 'ftTracks' }, ...rows),
      el(
        'p',
        { class: 'hint' },
        'Drum clips keep their kit unless the pool has one: add your own kits to a genre’s Drums pool. Set up how many clips each track has, and their jobs, on the Your MC-707 clips screen.'
      ),
      el(
        'div',
        { class: 'ftActs' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            style: 'margin-right:auto',
            title: 'If a track went quiet: put tracks back to their own sound (Sound Source TRACK) on the MC-707',
            onclick: () => trackSound()
          },
          'Put tracks back to their own sound…'
        ),
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Close'),
        el(
          'button',
          { type: 'button', class: 'btn on', disabled: !n, onclick: () => send() },
          'Send ' + n + ' sound' + (n === 1 ? '' : 's') + ' to the ' + DEVS[DEV].name
        )
      )
    );
  };
  const chooseLib = (t, k) =>
    pickTone(
      t,
      'Track ' + devNum(t) + ' clip ' + (k + 1),
      tone => {
        if (tone) plan[t][k] = { ...plan[t][k], item: { name: tone.name, kind: tone.kind, d: tone.d }, on: true };
        draw();
      },
      plan[t][k].item ? itemName(plan[t][k].item) : ''
    );
  /* Sound Source back to TRACK on the tracks you pick */
  const trackSound = async () => {
    const picks = DEVS[DEV].tracks.map(t =>
      el(
        'label',
        { class: 'ftPickTrk' },
        el('input', { type: 'checkbox', value: t }),
        ' ' + devNum(t) + ' ' + S.tracks[t].name
      )
    );
    const ok = await askDlg({
      title: 'Back to the track’s own sound',
      text: 'The ticked tracks play their track sound again for every clip (Sound Source TRACK), instead of each clip’s own. Use it when a track went quiet after its clips got sounds.',
      body: el('div', { class: 'ftPickList' }, ...picks),
      ok: 'Do it'
    });
    if (!ok) return;
    const ts = picks
      .map(l => l.querySelector('input'))
      .filter(i => i.checked)
      .map(i => +i.value);
    if (!ts.length) return;
    if (!(await zxConnect()))
      return toast('The ' + DEVS[DEV].name + ' is not connected (or MIDI with SysEx is not allowed)');
    for (const t of ts) zxWrite(trackSetAddr(t) + 4, [0]);
    await zxFlush();
    toast(
      'Track' +
        (ts.length === 1 ? ' ' : 's ') +
        ts.map(devNum).join(', ') +
        (ts.length === 1 ? ' plays its' : ' play their') +
        ' own sound again'
    );
  };
  /* one byte, or a sound slot's name, read from the MC-707 (null: no answer) */
  const readByte = async l => {
    const r = await zxRead(l, 1, 400, true);
    return Array.isArray(r) && r.length ? r[0] : null;
  };
  const ownName = async (kind, t, k) => {
    const r = await zxRead(slotAddr(kind, t, k), 16, 400, true);
    return Array.isArray(r) ? String.fromCharCode(...r.map(c => (c >= 32 && c < 127 ? c : 32))).trim() : null;
  };
  const send = async () => {
    if (!(await zxConnect()))
      return toast('The ' + DEVS[DEV].name + ' is not connected (or MIDI with SysEx is not allowed)');
    const jobs = [];
    for (const t of DEVS[DEV].tracks)
      plan[t].forEach((c, k) => {
        const r = c.on && c.item && resolve(c.item);
        if (r) jobs.push({ t, k, r });
      });
    let done = 0,
      extra = 0;
    const ran = await writeSession('Filling tones', async ui => {
      const tracks = new Map();
      /* How each track keeps its sound stays as it is on the MC-707, unless it has to change:
         - a track on its own sound (Sound Source TRACK) with one clip set up here gets the new sound as
           that track sound, which all its clips play;
         - otherwise each clip set up here gets its own (Sound Source CLIP, which a track needs for a
           different kit or tone per clip), and any other clip of it that holds notes but has no sound
           of its own (blank or INIT) gets one of the track's new sounds, so none goes quiet. */
      const lead = [...new Set(jobs.map(j => j.t))];
      for (const t of lead) {
        const mine = jobs.filter(j => j.t === t),
          n = plan[t].length,
          kind = mine[0].r.snd.kind;
        ui.set('Track ' + devNum(t) + ': how does it keep its sound?', 0);
        const src = await readByte(trackSetAddr(t) + 4);
        if (n === 1 && src !== 1) {
          mine.forEach(j => (j.k = 16));
          continue;
        }
        for (let k = n; k < 16 && !ui.cancelled; k++) {
          ui.set('Track ' + devNum(t) + ': does clip ' + (k + 1) + ' hold notes?', 0);
          const r = await clipHasNotes(t, k);
          if (!r.ok || !r.notes) continue;
          const own = await ownName(kind, t, k);
          if (own && !/^init (tone|kit)$/i.test(own)) continue;
          jobs.push({ t, k, r: mine[(k - n) % mine.length].r });
          extra++;
        }
      }
      for (const [i, j] of jobs.entries()) {
        if (ui.cancelled) break;
        ui.set(
          'Track ' + devNum(j.t) + ' clip ' + (j.k + 1) + ': ' + j.r.name + ' (' + (i + 1) + ' of ' + jobs.length + ')',
          i / jobs.length
        );
        await zeQuietly(() => sendSound(j.r.snd, slotAddr(j.r.snd.kind, j.t, j.k)), j.t);
        /* the clips screen shows the sound's name */
        const m = cmFix()[j.t];
        if (j.k < 16) m.names[j.k] = j.r.name.slice(0, 16);
        else m.names[0] = j.r.name.slice(0, 16);
        tracks.set(j.t, j.k === 16 ? 0 : 1);
        done++;
      }
      /* the tracks play their own sound (0) or their clips' own sounds (1) */
      for (const [t, src] of tracks) zxWrite(trackSetAddr(t) + 4, [src]);
      await zxFlush();
    });
    if (ran === null) return;
    scheduleSave();
    close();
    toast(
      'Sent ' +
        done +
        ' sound' +
        (done === 1 ? '' : 's') +
        (extra ? ' (' + extra + ' to more clips that hold notes, so none goes quiet)' : '') +
        '. Save the project on the ' +
        DEVS[DEV].name +
        ' to keep them.'
    );
  };
  draw();
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  document.body.append(ov);
}

/* ---- the pools: per genre and job, the sounds suggestions come from ---- */
function poolsOpen(gid, after) {
  $('#fpOv')?.remove();
  let role = 'bass';
  const box = el('div', { class: 'ptBox ftBox' });
  const ov = el(
    'div',
    { id: 'fpOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tone pools' },
    box
  );
  const close = () => (ov.remove(), after && after());
  /* a track of the right kind, for the library picker */
  const trackFor = r =>
    DEVS[DEV].tracks.find(t => (S.tracks[t].type === 'drum') === (r === 'drums')) ?? DEVS[DEV].tracks[0];
  const draw = () => {
    const list = poolOf(gid, role),
      edited = !!(pools()[gid] && pools()[gid][role]);
    box.replaceChildren(
      el('h3', {}, 'Tone pools'),
      el(
        'p',
        { class: 'hint' },
        'Fill tones suggests sounds from these, by genre and by each clip’s job. They start as the factory tones the song wizard suggests, plus your own sounds tagged with the genre. Add any sound, take one out, or put a pool back to the suggestions.'
      ),
      el(
        'div',
        { class: 'ftTop' },
        el('span', {}, 'Genre '),
        el(
          'select',
          { 'aria-label': 'Genre', onchange: e => ((gid = e.target.value), draw()) },
          ...genres().map(g =>
            el('option', { value: g.id, selected: g.id === gid }, (g.group ? g.group + ' › ' : '') + g.label)
          )
        )
      ),
      el(
        'div',
        { class: 'grp ftRoles', role: 'tablist' },
        ...ROLES.map(r =>
          el(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': String(r === role),
              class: 'btn sm' + (r === role ? ' on' : ''),
              onclick: () => ((role = r), draw())
            },
            ctInfo(r)[1]
          )
        )
      ),
      el(
        'div',
        { class: 'ftPool' },
        ...(list.length
          ? list.map((it, i) =>
              el(
                'div',
                { class: 'ftItem' + (resolve(it) ? '' : ' off') },
                el('span', {}, itemName(it)),
                el(
                  'span',
                  { class: 'hint' },
                  typeof it === 'string'
                    ? resolve(it)
                      ? 'factory'
                      : 'factory, not added yet'
                    : it.kind === 'kit'
                      ? 'your kit'
                      : 'your sound'
                ),
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'btn sm',
                    title: 'Take it out of the pool',
                    onclick: () => (
                      setPool(
                        gid,
                        role,
                        list.filter((x, j) => j !== i)
                      ),
                      draw()
                    )
                  },
                  '✕'
                )
              )
            )
          : [
              el(
                'p',
                { class: 'hint' },
                role === 'drums' ? 'No kits yet: add your own kits here.' : 'Nothing in this pool yet.'
              )
            ])
      ),
      el(
        'div',
        { class: 'ftActs' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn sm',
            onclick: () =>
              pickTone(trackFor(role), 'Add to the ' + ctInfo(role)[1] + ' pool', tone => {
                if (!tone) return;
                const it = { name: tone.name, kind: tone.kind, d: tone.d };
                if (!list.some(x => itemKey(x) === itemKey(it))) setPool(gid, role, [...list, it]);
                draw();
              })
          },
          '+ Add a sound…'
        ),
        el(
          'button',
          { type: 'button', class: 'btn sm', disabled: !edited, onclick: () => (resetPool(gid, role), draw()) },
          'Back to the suggestions'
        ),
        el('button', { type: 'button', class: 'btn on', style: 'margin-left:auto', onclick: close }, 'Done')
      )
    );
  };
  draw();
  ov.addEventListener('keydown', e => e.key === 'Escape' && (e.stopPropagation(), close()));
  document.body.append(ov);
}
