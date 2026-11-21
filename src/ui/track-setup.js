// Track setup: choose what each of the 8 tracks is for, anywhere from 8 drum tracks to 8 tone tracks.
// Each track gets a role (kit, hats, perc, bass, chords, pad, lead, pluck or acid); the role sets
// whether it is a drum or tone track, what the song wizard and Live Mode play on it, and its name.
// Clips that no longer fit a track's type are removed (with undo).
//
// Reads: S, DEV.
import { templateBuilderOpen } from './template-builder.js';
import { $, el, toast } from '../core/dom.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { fixScenes } from '../core/scene-model.js';
import { DEF_ROLES, ROLES, roleInfo, roleOf } from '../core/tracks.js';
import { cmFix } from '../services/clip-switch.js';
import { askDlg } from './dialogs.js';
import { renderAll } from './controls.js';
import { stopAll } from '../services/transport.js';
import { liveBuild } from '../live/set-builder.js';
import { liveRender } from '../live/panels.js';

const DEF_NAMES = ['Drums 1', 'Drums 2', 'Drums 3', 'Bass', 'Chords', 'Pad', 'Lead', 'Pluck'];
const SHORT = {
  kit: 'Kit',
  hats: 'Hats',
  perc: 'Perc',
  bass: 'Bass',
  chords: 'Chords',
  pad: 'Pad',
  lead: 'Lead',
  pluck: 'Pluck',
  acid: 'Acid'
};
/** The MC-107 layout: the four parts you play and tweak on the MC-101's screen and pads on tracks 1-4
    (a full kit, bass, chords and lead, as on an MC-101), the layers the app plays on hidden tracks 5-8. */
export const MC107_ROLES = ['kit', 'bass', 'chords', 'lead', 'hats', 'perc', 'pad', 'pluck'];
/** Ready-made splits, as roles for tracks 1-8. */
const PRESETS = [
  ['Default: 3 drums + 5 tone', DEF_ROLES],
  ['MC-107: kit, bass, chords, lead on the MC', MC107_ROLES],
  ['8 drums', ['kit', 'kit', 'hats', 'hats', 'perc', 'perc', 'kit', 'perc']],
  ['6 drums + 2 tone', ['kit', 'kit', 'hats', 'perc', 'perc', 'kit', 'bass', 'lead']],
  ['4 drums + 4 tone', ['kit', 'hats', 'perc', 'kit', 'bass', 'chords', 'lead', 'pluck']],
  ['2 drums + 6 tone', ['kit', 'hats', 'bass', 'chords', 'pad', 'lead', 'pluck', 'acid']],
  ['1 drum + 7 tone', ['kit', 'bass', 'chords', 'pad', 'lead', 'pluck', 'acid', 'lead']],
  ['8 tone', ['bass', 'chords', 'pad', 'lead', 'pluck', 'acid', 'chords', 'lead']]
];
/* a name for a track with a role: the default names for the default setup, else the role's name (numbered when shared) */
function nameFor(roles, t) {
  if (roles.every((r, i) => r === DEF_ROLES[i])) return DEF_NAMES[t];
  const same = roles.map((r, i) => i).filter(i => SHORT[roles[i]] === SHORT[roles[t]]);
  return SHORT[roles[t]] + (same.length > 1 ? ' ' + (same.indexOf(t) + 1) : '');
}
/* a track keeps a name the user typed; names the app gave it (default, role or wizard names) follow the setup */
const AUTO = new RegExp('^(' + [...DEF_NAMES, ...Object.values(SHORT)].join('|') + ')( \\d)?$');
const autoNamed = (t, roles) => S.tracks[t].name === nameFor(roles, t) || AUTO.test(S.tracks[t].name);

/**
 * Make the tracks drum or tone tracks as types says ('drum', 'tone', or anything else: leave that track):
 * a track that changes gets a kit or a lead role, the rest keep theirs. Returns false when cancelled.
 */
export function matchTypes(types) {
  const roles = S.tracks.map((x, t) => {
    const r = roleOf(t);
    if (types[t] !== 'drum' && types[t] !== 'tone') return r;
    return roleInfo(r, t)[2] === types[t] ? r : types[t] === 'drum' ? 'kit' : 'lead';
  });
  return applyRoles(roles);
}
/** Apply roles to the 8 tracks (asks first when clips would be removed). */
export async function applyRoles(roles) {
  const old = S.tracks.map((x, t) => roleOf(t)),
    types = roles.map((r, t) => roleInfo(r, t)[2]);
  const lose = S.clips.filter(c => types[c.t] !== S.tracks[c.t].type);
  if (lose.length) {
    const ok = await askDlg({
      title: 'Change the track setup?',
      text:
        lose.length +
        ' clip' +
        (lose.length === 1 ? '' : 's') +
        ' on tracks that change between drum and tone will be removed. Undo brings them back.',
      ok: 'Change and remove them'
    });
    if (!ok) return false;
  }
  stopAll();
  pushUndo();
  const rename = S.tracks.map((x, t) => autoNamed(t, old));
  roles.forEach((r, t) => {
    const tr = S.tracks[t];
    if (r === DEF_ROLES[t]) delete tr.role;
    else tr.role = r;
    tr.type = types[t];
    if (rename[t]) tr.name = nameFor(roles, t);
  });
  S.clips = S.clips.filter(c => S.tracks[c.t].type === S.patterns[c.pat].type);
  /* Scene Mode's clips too: a drum pattern cannot stay on what is now a tone track */
  if (S.scn) fixScenes(S, S.patterns);
  /* the MC-707 clips screen: a track's clip kinds follow its type and role */
  cmFix().forEach((m, t) => {
    const drum = types[t] === 'drum',
      kind = drum ? 'drums' : ['bass', 'chords', 'pad', 'lead', 'pluck', 'acid'].includes(roles[t]) ? roles[t] : 'lead';
    m.types = m.types.map(ty => (drum ? (ty === 'fx' ? ty : 'drums') : ty === 'drums' ? kind : ty));
    if (roles[t] !== old[t] && m.n === 1) m.types[0] = drum ? 'drums' : kind;
  });
  liveBuild();
  renderAll();
  liveRender();
  scheduleSave();
  return true;
}

/**
 * Move the tracks around without changing what any of them holds: new track n is old track perm[n], with
 * its role, name, mix, clips, clip changes, clip map and Scene Mode clips. Channels stay with the track
 * number when they were the default (track n on channel n). One undo step.
 */
export function reorderTracks(perm) {
  const inv = [];
  perm.forEach((o, n) => (inv[o] = n));
  stopAll();
  pushUndo();
  const old = S.tracks.map((x, t) => ({ tr: x, role: roleOf(t) })),
    map = cmFix().slice();
  S.tracks = perm.map((o, n) => {
    const { tr, role } = old[o];
    if (tr.ch === o + 1) tr.ch = n + 1;
    if (role === DEF_ROLES[n]) delete tr.role;
    else tr.role = role;
    return tr;
  });
  S.clipMap = perm.map(o => map[o]);
  S.clips.forEach(c => (c.t = inv[c.t]));
  (S.clipMarks || []).forEach(m => (m.t = inv[m.t]));
  if (S.scn) {
    S.scn.clips = perm.map(o => S.scn.clips[o]);
    S.scn.rows.forEach(r => (r.pick = perm.map(o => r.pick[o])));
    /* what was written to the MC is kept per track:clip */
    const mv = m =>
      m &&
      Object.fromEntries(
        Object.entries(m).map(([k, v]) => {
          const [t, c] = k.split(':');
          return [inv[+t] + ':' + c, v];
        })
      );
    if (S.scn.done) ['c', 'p'].forEach(w => S.scn.done[w] && (S.scn.done[w] = mv(S.scn.done[w])));
  }
  liveBuild();
  renderAll();
  liveRender();
  scheduleSave();
}
/** The order that puts these roles on tracks 1-8, moving the tracks that already have them, or null. */
export function orderFor(roles) {
  const free = [0, 1, 2, 3, 4, 5, 6, 7],
    perm = [];
  for (const r of roles) {
    const i = free.findIndex(t => roleOf(t) === r);
    if (i < 0) return null;
    perm.push(free.splice(i, 1)[0]);
  }
  return perm;
}

export function trackSetupOpen() {
  let ov = $('#tsOv');
  if (!ov) {
    ov = el('div', {
      id: 'tsOv',
      class: 'ptOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Track setup',
      onpointerdown: e => {
        if (e.target.id === 'tsOv') ov.remove();
      },
      onkeydown: e => e.key === 'Escape' && ov.remove()
    });
    document.body.append(ov);
  }
  render(ov);
}
function render(ov) {
  ov.textContent = '';
  const roles = S.tracks.map((x, t) => roleOf(t)),
    shown = DEVS[DEV].tracks,
    nD = shown.filter(t => roleInfo(roles[t], t)[2] === 'drum').length;
  const set = async r => {
    if (await applyRoles(r)) {
      toast('Track setup changed');
      render(ov);
    }
  };
  const rows = shown.map(t => {
    const sel = el('select', {
      'aria-label': 'Track ' + devNum(t) + ' role',
      onchange: e => set(roles.map((r, i) => (i === t ? e.target.value : r)))
    });
    for (const [lab, list] of [
      ['Drum track', ROLES.filter(r => r[2] === 'drum')],
      ['Tone track', ROLES.filter(r => r[2] === 'tone')]
    ]) {
      const g = el('optgroup', { label: lab });
      list.forEach(r => g.append(el('option', { value: r[0], selected: r[0] === roles[t] }, r[1])));
      sel.append(g);
    }
    const isD = roleInfo(roles[t], t)[2] === 'drum';
    return el(
      'div',
      { class: 'tsRow', style: '--c:' + TRACK_COLORS[t] },
      el('b', {}, 'Track ' + devNum(t)),
      el('span', { class: 'tsType ' + (isD ? 'd' : 't') }, isD ? 'DRUM' : 'TONE'),
      sel,
      el('input', {
        type: 'text',
        maxlength: 16,
        value: S.tracks[t].name,
        'aria-label': 'Track ' + devNum(t) + ' name',
        onchange: e => {
          pushUndo();
          S.tracks[t].name = e.target.value.trim().slice(0, 16) || nameFor(roles, t);
          renderAll();
          liveRender();
          scheduleSave();
        }
      }),
      el('small', { class: 'hint' }, 'MIDI ch ' + S.tracks[t].ch)
    );
  });
  ov.append(
    el(
      'div',
      { class: 'ptBox tsBox' },
      el(
        'div',
        { class: 'cmHead' },
        el('h3', {}, 'Track setup'),
        el('button', { class: 'btn sm on', onclick: () => ov.remove() }, 'Done')
      ),
      el(
        'p',
        { class: 'hint' },
        'Choose what each track is for, from 8 drum tracks to 8 tone tracks. The song wizard and Live Mode follow it. Now: ' +
          nD +
          ' drum and ' +
          (shown.length - nD) +
          ' tone tracks.'
      ),
      /* the one thing the app cannot do for you: it says it up front, not as a footnote */
      el(
        'div',
        { class: 'tsMust', role: 'note' },
        el('b', {}, 'Set the MC-707 to match, by hand'),
        el(
          'span',
          {},
          'The app can’t change what a track is on the MC-707. After choosing here, set each MC-707 track the same way: a drum kit on each drum track, a tone on each tone track (select the track on the MC-707 and choose its sound). If they don’t match, drum parts play notes on a tone, or melodies on a kit. Easiest: start from an '
        ),
        el(
          'button',
          { type: 'button', class: 'btn sm', onclick: () => (ov.remove(), templateBuilderOpen()) },
          'MC-707 project from the Template builder…'
        ),
        el('span', {}, ' with the tracks already set up, and a sound in every clip.')
      ),
      el(
        'div',
        { class: 'tsPresets' },
        ...PRESETS.map(([lab, r]) =>
          el(
            'button',
            {
              class: 'btn sm' + (r.every((x, t) => x === roles[t]) ? ' on' : ''),
              /* a layout the tracks already have, in another order: the tracks move, clips and all */
              onclick: () => {
                const perm = orderFor(r);
                if (perm && perm.some((o, n) => o !== n)) {
                  reorderTracks(perm);
                  toast('Tracks moved: each keeps its clips and settings');
                  render(ov);
                } else set(r.slice());
              }
            },
            lab
          )
        )
      ),
      el('div', { class: 'tsRows' }, ...rows),
      el(
        'p',
        { class: 'hint' },
        'Each app track sends on its own MIDI channel, set in MIDI and sound and the MC-707’s Track Channel settings.'
      )
    )
  );
}
