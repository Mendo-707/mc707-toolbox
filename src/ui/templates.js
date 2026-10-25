// MC-707 project templates: empty MC-707 projects, one per track layout (8 drum tracks to 8 tone tracks,
// and EMPTY), made on an MC-707 by the app's author and kept in templates/ in the repository. This window
// says which one matches the app's Track setup, and how to put them on the MC-707's SD card (storage
// mode) and start a project from one.
//
// Reads: S, DEV.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV } from '../core/device.js';
import { LINKS, openLink } from '../core/version.js';

/** The templates: how many drum tracks (first), the file name. */
export const TEMPLATES = [8, 6, 4, 3, 2, 1, 0].map(d => [d, d + ' Drum ' + (8 - d) + ' Tone Tracks.mpj']);

/** The template for the app's Track setup now: {file, exact} (exact: its drum tracks come first, as the template's do), or null. */
export function templateFor() {
  if (DEV !== '707') return null;
  const types = DEVS[DEV].tracks.map(t => S.tracks[t].type),
    d = types.filter(x => x === 'drum').length,
    hit = TEMPLATES.find(x => x[0] === d);
  if (!hit) return { file: null, drums: d };
  return { file: hit[1], drums: d, exact: types.every((x, i) => (x === 'drum') === i < d) };
}

export function templatesOpen() {
  document.getElementById('tplOv')?.remove();
  const close = () => ov.remove();
  const m = templateFor();
  const which =
    DEV !== '707'
      ? el(
          'p',
          { class: 'pmWarn' },
          'These templates are for the MC-707 (8 tracks). Switch Settings › Device to MC-707 to use them.'
        )
      : !m.file
        ? el(
            'p',
            { class: 'hint' },
            'Your Track setup has ' +
              m.drums +
              ' drum tracks: there is no template with exactly that. Load the nearest one and change the track types on the MC-707.'
          )
        : el(
            'p',
            { class: 'tplPick' },
            'For your Track setup (' + m.drums + ' drum, ' + (8 - m.drums) + ' tone): ',
            el('b', {}, m.file.replace('.mpj', '')),
            m.exact
              ? '.'
              : '. Its drum tracks are tracks 1-' +
                  m.drums +
                  '; yours are elsewhere, so change the track types on the MC-707 or in Track setup to match.'
          );
  const li = (...k) => el('li', {}, ...k);
  const ov = el(
    'div',
    { id: 'tplOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'MC-707 project templates' },
    el(
      'div',
      { class: 'ptBox tplBox' },
      el('h3', {}, 'MC-707 project templates'),
      el(
        'p',
        { class: 'hint' },
        'Empty MC-707 projects with the tracks already set up as drum or tone tracks, from 8 drum tracks to 8 tone tracks, plus EMPTY. Start a new song from one so the MC-707 matches the app before you write clips and scenes.'
      ),
      which,
      el('h4', {}, '1. Download them'),
      el(
        'p',
        { class: 'hint' },
        el(
          'button',
          { type: 'button', class: 'btn sm on', onclick: () => openLink(LINKS.templates) },
          'Download the templates (zip)'
        ),
        ' Unzip it: there are 8 .mpj files.'
      ),
      el('h4', {}, '2. Copy them onto the MC-707'),
      el(
        'ol',
        { class: 'hint tplSteps' },
        li('With the MC-707 not connected to the computer, turn it on.'),
        li('Hold ', el('b', {}, 'SHIFT'), ' and press ', el('b', {}, 'KNOB ASSIGN'), ' (the UTILITY menu).'),
        li('Pick ', el('b', {}, 'STORAGE MODE'), ' with the cursor buttons and press ', el('b', {}, 'ENTER'), '.'),
        li('Connect the USB cable. The SD card shows up on the computer as a drive.'),
        li(
          'Copy the .mpj files into the folder where your MC-707’s projects are (the one with the other .mpj files, under ROLAND).'
        ),
        li(
          'Eject the drive (Windows: right-click it › Eject; Mac: drag it to the Trash), then turn the MC-707 off and on again.'
        )
      ),
      el(
        'p',
        { class: 'hint' },
        'While the MC-707 is in storage mode it does nothing else, and the app cannot reach it over MIDI.'
      ),
      el('h4', {}, '3. Start a song from one'),
      el(
        'ol',
        { class: 'hint tplSteps' },
        li('Press ', el('b', {}, 'PROJECT'), ', choose ', el('b', {}, 'LOAD'), ' and pick the template.'),
        li(
          'Straight away, press ',
          el('b', {}, 'PROJECT'),
          ' › ',
          el('b', {}, 'WRITE'),
          ' and give it a new name, so the template stays empty for next time.'
        ),
        li(
          'Load a kit on each drum track and a tone on each tone track, then write your clips and scenes from the app.'
        )
      ),
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Close')
      )
    )
  );
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  ov.addEventListener('pointerdown', e => e.target === ov && close());
  document.body.append(ov);
}
