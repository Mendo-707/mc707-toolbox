// The Sound browser's factory sound items: add the MC-707's preset tones and drum kits from its system
// update file (read here on your computer, see zc-factory.js and zc-factory-kits.js), or take them out
// of the library again.
//
// Reads: ZS.
import { el, toast } from '../core/dom.js';
import { fwTones } from './zc-factory.js';
import { fwKits } from './zc-factory-kits.js';
import { ZS, soundAddMany, soundsRemoveSrc } from './zc-sounds.js';

const frame = () => new Promise(r => setTimeout(r, 30));

/** Ask for the update file and add its tones and kits. done(added) runs after. */
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
          tones = fwTones(bytes),
          kits = fwKits(bytes),
          all = [...tones, ...kits];
        if (!tones.length) return toast('No tones found. Pick the MC-707 system update file (MC707_UPA_up.bin).');
        const n = await soundAddMany(all.map(t => ({ ...t, src: 'factory' })));
        toast(
          n
            ? 'Added ' +
                tones.length +
                ' factory tones and ' +
                kits.length +
                ' kits' +
                (n < all.length ? ' (' + (all.length - n) + ' already here)' : '')
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

/** Menu items for the browser: add the factory tones, and remove them when they are in. */
export function factoryItems(done) {
  const have = ZS.list.some(e => e.src === 'factory');
  return [
    {
      label: (have ? 'Add the factory sounds again' : 'Factory sounds from the MC-707 update file') + '…',
      action: () => factoryImport(done)
    },
    have
      ? {
          label: 'Remove the factory sounds',
          action: async () => {
            const n = await soundsRemoveSrc('factory');
            toast('Removed ' + n + ' factory sounds');
            done(0);
          }
        }
      : null
  ].filter(Boolean);
}
