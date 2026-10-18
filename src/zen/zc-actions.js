// The ZenCore editor's header: which track and clip it edits, and the actions (read from the MC-707,
// send all, starters, My sounds, save and open files, copy a partial, copy the sound to another clip).
//
// Reads: ZE, S, DEV.
// Calls up the layers through hooks (core/hooks.js).
import { el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { hooks } from '../core/hooks.js';
import { showMenu } from '../ui/menu.js';
import { askDlg } from '../ui/dialogs.js';
import { slotAddr, zxConnect } from './zc-sysex.js';
import { copySound, newSound, sendSound, soundFrom, soundJSON } from './zc-tone.js';
import { STARTERS, myDelete, myList, mySave, rememberClip } from './zc-library.js';
import {
  ZE,
  targetName,
  zeLoad,
  zeRead,
  zeRefreshOn,
  zeRender,
  zeSendAll,
  zeSetRefresh,
  zeUndo,
  zenClose,
  zenOpen
} from './zc-editor.js';

const menuAt = (e, items) => {
  const r = e.currentTarget.getBoundingClientRect();
  showMenu(r.left, r.bottom + 4, items);
};
const btn = (lab, fn, o = {}) =>
  el(
    'button',
    { type: 'button', class: 'btn sm' + (o.on ? ' on' : ''), title: o.title || '', disabled: !!o.off, onclick: fn },
    lab
  );
const PBLKS = ['PTL', 'PENV', 'FENV', 'AENV', 'LFO', 'EQ', 'SPTL'];
let CLIP = null; /* a copied partial: {key suffix: value} */

function soundName() {
  return ZE.snd.v[ZE.kind === 'kit' ? 'KCMN.NAME' : 'CMN.NAME'] || '';
}
function myMenu() {
  const list = myList(ZE.kind);
  return [
    {
      label: 'Save this ' + (ZE.kind === 'kit' ? 'kit' : 'tone') + ' to My sounds…',
      action: async () => {
        const n = await askDlg({ title: 'Save to My sounds', input: true, def: soundName(), ok: 'Save' });
        if (n != null) toast(mySave(ZE.snd, n) ? 'Saved ' + n : 'The browser would not store it (storage full?)');
      }
    },
    list.length ? '-' : null,
    ...list.slice(0, 30).map(e => ({
      label: e.s.name || 'Untitled',
      sub: [
        { label: 'Load it here', action: () => zeLoad(soundFrom(e.s), 'Loaded ' + (e.s.name || 'sound')) },
        { label: 'Delete', action: () => (myDelete(e.id), toast('Deleted')) }
      ]
    })),
    list.length ? null : { label: 'Nothing saved yet', disabled: true }
  ];
}
function fileMenu() {
  return [
    {
      label: 'Save to a file…',
      action: () =>
        hooks.saveFile(
          (soundName() || 'zencore').replace(/[^\w -]+/g, '').trim() +
            (ZE.kind === 'kit' ? '.mc707kit.json' : '.mc707tone.json'),
          JSON.stringify(soundJSON(ZE.snd), null, 1)
        )
    },
    {
      label: 'Open a file…',
      action: () => {
        const i = el('input', {
          type: 'file',
          accept: '.json,application/json',
          onchange: async () => {
            try {
              const s = soundFrom(JSON.parse(await i.files[0].text()));
              if (!s) throw 0;
              if (s.kind !== ZE.kind) return toast('That file is a ' + s.kind + '; this track needs a ' + ZE.kind);
              zeLoad(s, 'Opened ' + i.files[0].name);
            } catch (e) {
              toast('That is not a ZenCore sound file from this app');
            }
          }
        });
        i.click();
      }
    }
  ];
}
function partMenu() {
  const p = ZE.part;
  const keysOf = i => Object.keys(ZE.snd.v).filter(k => PBLKS.some(b => k.startsWith(b + i + '.')));
  return [
    {
      label: 'Copy partial ' + (p + 1),
      action: () => {
        CLIP = Object.fromEntries(keysOf(p).map(k => [k.replace(/^(\D+)\d\./, '$1.'), ZE.snd.v[k]]));
        toast('Copied partial ' + (p + 1));
      }
    },
    {
      label: 'Paste into partial ' + (p + 1),
      disabled: !CLIP,
      action: () => {
        const s = copySound(ZE.snd);
        for (const k in CLIP) s.v[k.replace('.', p + '.')] = CLIP[k];
        zeLoad(s, 'Pasted into partial ' + (p + 1));
      }
    },
    {
      label: 'Reset partial ' + (p + 1),
      action: () => {
        const s = copySound(ZE.snd),
          init = newSound('tone');
        for (const k of keysOf(p)) s.v[k] = init.v[k];
        zeLoad(s, 'Reset partial ' + (p + 1));
      }
    }
  ];
}
function copyMenu() {
  const out = [];
  for (const t of DEVS[DEV].tracks) {
    if ((S.tracks[t].type === 'drum') !== (ZE.kind === 'kit')) continue;
    out.push({
      label: 'Track ' + devNum(t) + ' · ' + S.tracks[t].name,
      sub: [...Array.from({ length: 16 }, (_, k) => k), 16].map(k => ({
        label: targetName(k),
        disabled: t === ZE.t && k === ZE.k,
        action: async () => {
          if (!(await zxConnect())) return toast('Connect the ' + DEVS[DEV].name + ' first');
          sendSound(ZE.snd, slotAddr(ZE.kind, t, k));
          rememberClip(copySound(ZE.snd), t, k);
          toast('Copied to track ' + devNum(t) + ', ' + targetName(k));
        }
      }))
    });
  }
  return out;
}
/** The header: title, target, and the action buttons. */
export function headerBar() {
  const dn = DEVS[DEV].name;
  const trk = el('select', { title: 'Track', onchange: e => zenOpen(+e.target.value, ZE.k) });
  DEVS[DEV].tracks.forEach(t =>
    trk.append(el('option', { value: t, selected: t === ZE.t }, 'Track ' + devNum(t) + ' · ' + S.tracks[t].name))
  );
  const clip = el('select', { title: 'Clip', onchange: e => zenOpen(ZE.t, +e.target.value) });
  [...Array.from({ length: 16 }, (_, k) => k), 16].forEach(k =>
    clip.append(el('option', { value: k, selected: k === ZE.k }, targetName(k).replace(/^c/, 'C').replace(/^t/, 'T')))
  );
  return el(
    'div',
    { class: 'zcHead' },
    el(
      'div',
      { class: 'zcTitle' },
      el('b', {}, 'ZenCore ' + (ZE.kind === 'kit' ? 'drum kit' : 'tone')),
      el('span', { class: 'zcSnd' }, soundName() || '—')
    ),
    el('div', { class: 'zcTarget' }, trk, clip),
    el(
      'div',
      { class: 'zcActs' },
      btn('Read from ' + dn, () => zeRead(), { title: 'Read this sound from the ' + dn }),
      btn('Send all', () => zeSendAll(), { title: 'Send every parameter to the ' + dn }),
      btn(
        ZE.live ? '● Live' : '○ Live',
        () => {
          ZE.live = !ZE.live;
          zeRender();
        },
        { on: ZE.live, title: 'Send each change to the ' + dn + ' as you make it' }
      ),
      btn(
        zeRefreshOn() ? '● Screen' : '○ Screen',
        () => {
          zeSetRefresh(!zeRefreshOn());
          zeRender();
        },
        {
          on: zeRefreshOn(),
          title:
            'Refresh the ' +
            dn +
            "'s screen after each change, by selecting this clip again (the " +
            dn +
            ' only redraws when a clip is selected)'
        }
      ),
      btn('↶', () => zeUndo(false), { off: !ZE.undo.length, title: 'Undo (Ctrl+Z)' }),
      btn('↷', () => zeUndo(true), { off: !ZE.redo.length, title: 'Redo (Ctrl+Shift+Z)' }),
      ZE.kind === 'tone'
        ? btn('Starters ▾', e =>
            menuAt(
              e,
              STARTERS.map(([n, f]) => ({ label: n, action: () => zeLoad(f(), 'Loaded ' + n) }))
            )
          )
        : btn('Init kit', () => zeLoad(newSound('kit'), 'Reset the kit')),
      btn('My sounds ▾', e => menuAt(e, myMenu())),
      btn('File ▾', e => menuAt(e, fileMenu())),
      ZE.kind === 'tone' ? btn('Partial ▾', e => menuAt(e, partMenu())) : null,
      btn('Copy to ▾', e => menuAt(e, copyMenu()), { title: 'Send this sound to another clip' }),
      btn('Done', () => zenClose(), { on: true })
    )
  );
}
