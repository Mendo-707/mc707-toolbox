// The Sound browser's factory tone items: add the MC-707's preset tones and drum kits from its system update
// file (read here on your computer, see zc-factory.js), or take them out of the library again; and add the
// tones of expansion files (.svz, the same tone records) into one of your folders, one folder per file.
//
// Reads: ZS.
import { el, toast } from '../core/dom.js';
import { askDlg } from '../ui/dialogs.js';
import { FW_BANK_NAMES, fwKits, fwTones } from './zc-factory.js';
import { ZS, folderAdd, folderList, soundAddMany, soundsRemoveSrc, soundsRemoveWhere } from './zc-sounds.js';

const frame = () => new Promise(r => setTimeout(r, 30));

/** Ask for the update file and add its tones. done(added) runs after. */
export function factoryImport(done) {
  const i = el('input', {
    type: 'file',
    accept: '.bin',
    onchange: async () => {
      const f = i.files[0];
      if (!f) return;
      toast('Reading ' + f.name + '…');
      await frame();
      try {
        const bytes = new Uint8Array(await f.arrayBuffer()),
          tones = fwTones(bytes);
        if (!tones.length) return toast('No tones found. Pick the MC-707 system update file (MC707_UPA_up.bin).');
        /* the drum kits too, for Scene Mode's drum clips and MC-707 project files */
        const kits = fwKits(bytes),
          all = [...tones, ...kits],
          n = await soundAddMany(all.map(t => ({ ...t, src: 'factory' })));
        toast(
          n
            ? 'Added ' +
                n +
                ' factory sounds (' +
                tones.length +
                ' tones, ' +
                kits.length +
                ' kits)' +
                (n < all.length ? ', ' + (all.length - n) + ' already here' : '')
            : 'The factory sounds are already in the library'
        );
        done(n);
      } catch (e) {
        toast('That file could not be read');
      }
    }
  });
  i.click();
}

/* which folder an expansion goes in: a new one named after its file (the default), or one you have */
async function folderFor(file) {
  const stem =
    file.name
      .replace(/\.svz$/i, '')
      .trim()
      .slice(0, 30) || 'Expansion';
  const have = folderList();
  const sel = el(
    'select',
    { style: 'width:100%' },
    el('option', { value: '' }, have.includes(stem) ? 'The folder “' + stem + '”' : 'A new folder: “' + stem + '”'),
    ...have.filter(f => f !== stem).map(f => el('option', { value: f }, '📁 ' + f))
  );
  const ok = await askDlg({
    title: 'Add ' + file.name + ' to a folder',
    text: 'Its tones go into one of your folders, where you can rename, tag and organise them.',
    body: sel,
    ok: 'Add'
  });
  return ok ? folderAdd(sel.value || stem) : null;
}
/** Ask for expansion files (.svz) and add each one's tones to a folder. done(added, bank id) runs after. */
export function expansionImport(done) {
  const i = el('input', {
    type: 'file',
    accept: '.svz',
    multiple: true,
    onchange: async () => {
      let total = 0,
        moved = 0,
        last = null;
      for (const f of i.files) {
        toast('Reading ' + f.name + '…');
        await frame();
        let tones;
        try {
          tones = fwTones(new Uint8Array(await f.arrayBuffer()));
        } catch (e) {
          tones = [];
        }
        if (!tones.length) {
          toast('No tones found in ' + f.name);
          continue;
        }
        const folder = await folderFor(f);
        if (!folder) continue;
        last = folder;
        const items = tones.map(({ name, snd }) => ({ name, snd, src: 'mine', folder }));
        const n = await soundAddMany(items, e => e.src === 'mine' && e.folder === folder);
        total += n;
        /* the same tones read earlier as an extra factory bank (not the MC-707's own A-E) are now here */
        const hs = new Set(ZS.list.filter(e => e.folder === folder && e.src === 'mine').map(e => e.h));
        moved += await soundsRemoveWhere(e => e.src === 'factory' && !FW_BANK_NAMES[e.bank] && hs.has(e.h));
        toast(
          'Added ' +
            n +
            ' tones from ' +
            f.name +
            ' to ' +
            folder +
            (n < tones.length ? ' (' + (tones.length - n) + ' were already there)' : '')
        );
      }
      if (moved)
        toast('Took ' + moved + ' of them out of the extra factory bank, where an earlier import had put them');
      done(total, last ? 'u:' + last : null);
    }
  });
  i.click();
}
/** Menu items for the browser: add the factory tones, and remove them when they are in. */
export function factoryItems(done) {
  const have = ZS.list.some(e => e.src === 'factory'),
    kits = ZS.list.some(e => e.src === 'factory' && e.mpj);
  return [
    {
      label:
        (have && !kits
          ? 'Add the factory drum kits too (from the update file again)'
          : have
            ? 'Add the factory tones and kits again'
            : 'Factory tones and kits from the MC-707 update file') + '…',
      action: () => factoryImport(done)
    },
    { label: 'Expansion tones from .svz files, into a folder…', action: () => expansionImport(done) },
    have
      ? {
          label: 'Remove the factory tones and kits',
          action: async () => {
            const n = await soundsRemoveSrc('factory');
            toast('Removed ' + n + ' factory sounds');
            done(0);
          }
        }
      : null
  ].filter(Boolean);
}
