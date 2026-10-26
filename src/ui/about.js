// Help › About: the app's name and version, what it is, the licence and the people whose work it builds
// on, which device it is set for and whether it can reach it, and links to the guide, releases and
// problem reports.
//
// Reads: DEV, MIDI.
import { el } from '../core/dom.js';
import { DEVS, DEV } from '../core/device.js';
import { APP_NAME } from '../core/state.js';
import { LINKS, VERSION, openLink } from '../core/version.js';
import { MIDI } from '../services/midi.js';
import { checkUpdateNow } from './update-check.js';

const link = (label, url) => el('a', { href: url, onclick: e => (e.preventDefault(), openLink(url)) }, label);

/** Open the About window. */
export function aboutOpen() {
  if (document.querySelector('#aboutOv')) return;
  const close = () => {
    back.remove();
    removeEventListener('keydown', kd, true);
  };
  const kd = e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  const dn = DEVS[DEV].name,
    out = MIDI.out ? MIDI.out.name : null;
  const back = el(
    'div',
    { id: 'aboutOv', class: 'abOv', onpointerdown: e => e.target === back && close() },
    el(
      'div',
      { class: 'abBox', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'abTitle' },
      el(
        'div',
        { class: 'abHead' },
        el('img', { src: 'icon.png', alt: '', class: 'abIcon', onerror: e => e.target.remove() }),
        el(
          'div',
          {},
          el('h2', { id: 'abTitle' }, 'MC-707 Toolbox'),
          el('div', { class: 'abVer' }, 'Version ' + VERSION + ' · ' + (APP_NAME || 'web'))
        )
      ),
      el(
        'p',
        {},
        'Write songs, play live sets, use the MC-707 as an 8-track synth for your DAW, and edit its ZenCore sounds from your computer.'
      ),
      el(
        'dl',
        { class: 'abFacts' },
        el('dt', {}, 'Device'),
        el('dd', {}, dn + ' · ' + (out ? 'sending to ' + out : 'not connected')),
        el('dt', {}, 'Licence'),
        el(
          'dd',
          {},
          'Free to use and share, not for sale (',
          link('PolyForm Noncommercial 1.0.0', LINKS.licence),
          ').'
        ),
        el('dt', {}, 'Made by'),
        el('dd', {}, 'Aaron (Mendo-707). An unofficial fan project, not made by or affiliated with Roland.'),
        el('dt', {}, 'Thanks to'),
        el(
          'dd',
          {},
          'Ada Locriana (mctools_basic, mctools_seq and mctools_sidechain: how the MC-707 answers SysEx, where clip notes and knob motion live, and the ideas behind the Pump), mc-programmer, Roland-Zen-Decode-XML (the ZEN-Core parameter list) and Benedetto Schiavone (the STEP LFO step sequencer).'
        )
      ),
      el(
        'div',
        { class: 'abLinks' },
        link('Guide', LINKS.guide),
        el('a', { href: LINKS.releases, onclick: e => (e.preventDefault(), checkUpdateNow()) }, 'Check for updates'),
        link('Report a problem', LINKS.issues),
        link('Source code', LINKS.home)
      ),
      el('div', { class: 'abFoot' }, el('button', { type: 'button', class: 'btn on', onclick: close }, 'Close'))
    )
  );
  document.body.append(back);
  addEventListener('keydown', kd, true);
  back.querySelector('.abFoot button').focus();
}
