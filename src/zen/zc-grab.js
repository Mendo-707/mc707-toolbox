// Grabbing sounds from the MC-707's clips into the Sound library: one clip, a track's 16, or every
// clip of every track. Each sound read is kept unless it is empty (the initial sound) or already there.
//
// Reads: ZE, S, DEV.
import { toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { ZX, slotAddr, zxConnect } from './zc-sysex.js';
import { newSound, readSound } from './zc-tone.js';
import { ZE } from './zc-editor.js';
import { diffOf, soundAdd } from './zc-sounds.js';

/* an empty clip: no name, or Roland's initial one (an empty clip on the MC-707 is not quite the initial sound) */
const isBlank = snd =>
  /^(|init ?(tone|kit|sound))$/i.test((snd.v[snd.kind === 'kit' ? 'KCMN.NAME' : 'CMN.NAME'] || '').trim());

/**
 * Read the clips into the library. g is the progress object the browser shows ({stop, done, n, added,
 * msg}; set g.stop to stop); status() redraws it. Returns g, or null when the MC-707 cannot be read.
 * @param {'clip'|'track'|'all'} scope
 */
export async function grabClips(scope, g, status) {
  const dn = DEVS[DEV].name;
  if (!(await zxConnect())) return (toast('Connect the ' + dn + ' first'), null);
  if (!ZX.inp) return (toast('No MIDI input from the ' + dn + ': it cannot be read'), null);
  const jobs = [];
  for (const t of scope === 'all' ? DEVS[DEV].tracks : [ZE.t]) {
    const kind = S.tracks[t].type === 'drum' ? 'kit' : 'tone';
    for (const k of scope === 'clip' ? [ZE.k] : Array.from({ length: 16 }, (_, i) => i)) jobs.push([t, k, kind]);
  }
  Object.assign(g, { n: jobs.length, same: 0, empty: 0, bad: 0 });
  for (const [t, k, kind] of jobs) {
    if (g.stop) break;
    g.msg = 'Reading track ' + devNum(t) + ', clip ' + (k + 1);
    status();
    const snd = newSound(kind),
      r = await readSound(snd, slotAddr(kind, t, k));
    g.done++;
    if (r.silent) {
      g.msg = 'The ' + dn + ' did not answer.';
      break;
    }
    if (r.ok < r.total * 0.9) g.bad++;
    else if (!Object.keys(diffOf(snd)).length || isBlank(snd)) g.empty++;
    else if (await soundAdd(snd, { src: 'mc707' })) g.added++;
    else g.same++;
    status();
  }
  toast(
    'Grabbed ' +
      g.added +
      ' new sound' +
      (g.added === 1 ? '' : 's') +
      (g.same ? ', ' + g.same + ' already here' : '') +
      (g.empty ? ', ' + g.empty + ' empty' : '') +
      (g.bad ? ', ' + g.bad + ' could not be read' : '') +
      (g.stop ? ' (stopped)' : '')
  );
  return g;
}
