// Track setup: choose what each of the 8 tracks is for, anywhere from 8 drum tracks to 8 tone tracks.
// Each track gets a role (kit, hats, perc, bass, chords, pad, lead, pluck or acid); the role sets
// whether it is a drum or tone track, what the song wizard and Live Mode play on it, and its name.
// Clips that no longer fit a track's type are removed (with undo).
//
// Reads: S, DEV.
import { $, el, toast } from '../core/dom.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
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
/** Ready-made splits, as roles for tracks 1-8. */
const PRESETS = [
  ['Default: 3 drums + 5 tone', DEF_ROLES],
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

/** Apply roles to the 8 tracks (asks first when clips would be removed). */
async function applyRoles(roles) {
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
      }
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
      el(
        'div',
        { class: 'tsPresets' },
        ...PRESETS.map(([lab, r]) =>
          el(
            'button',
            { class: 'btn sm' + (r.every((x, t) => x === roles[t]) ? ' on' : ''), onclick: () => set(r.slice()) },
            lab
          )
        )
      ),
      el('div', { class: 'tsRows' }, ...rows),
      el(
        'p',
        { class: 'hint' },
        'On the MC-707, set each track to match: a drum kit on drum tracks and a tone on tone tracks (select the track and choose its sound). Each app track sends on its own MIDI channel, set in MIDI and the MC-707’s Track Channel settings.'
      )
    )
  );
}
