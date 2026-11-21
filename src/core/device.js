// Which device the app drives: the MC-707 (8 tracks), the MC-101 (4 tracks) or the MC-107 (an MC-101 with
// the 8-track firmware mod, github.com/edco/mc-101-re: tracks 5-8 are a second bank on the same four SEL
// buttons and faders), the track colours, and helpers that say whether a track is in use.
//
// Owns: DEV (the device).
// Reads: S.
import { S } from './state.js';

export const TRACK_COLORS = ['#ff5f45', '#ffa629', '#ff6fa3', '#2fd3c0', '#4da3ff', '#a283ff', '#84d95b', '#e9d94a'];
/* Device: MC-707 (8 tracks), MC-101 (4 tracks: Drums, Bass, Chords, Lead on channels 1-4) or MC-107 (an
   MC-101 with 8 tracks on channels 1-8, as the MC-707; the mod keeps the MC-101's USB name). hw: the hardware on the USB cable (its port
   name, SysEx model and memory). */
export const DEVS = {
  707: {
    name: 'MC-707',
    hw: '707',
    tracks: [0, 1, 2, 3, 4, 5, 6, 7],
    ch: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 }
  },
  101: { name: 'MC-101', hw: '101', tracks: [0, 3, 4, 6], ch: { 0: 1, 3: 2, 4: 3, 6: 4 } },
  107: {
    name: 'MC-107',
    hw: '101',
    tracks: [0, 1, 2, 3, 4, 5, 6, 7],
    ch: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 }
  }
};
export let DEV = (() => {
  try {
    const v = localStorage.getItem('mc-device');
    return v === '101' || v === '107' ? v : '707';
  } catch (e) {
    return '707';
  }
})();
/** The hardware: '707' or '101' (an MC-107 is an MC-101). */
export const devHw = () => DEVS[DEV].hw;
/** True when the app makes 8-track MC-707 project files for this device (the MC-707, and the MC-107:
   the MC-101 reads MC-707 projects, and the mod keeps their tracks 5-8). */
export const devProj = () => DEVS[DEV].tracks.length === 8;
/** True for a track on the MC-107's second bank (tracks 5-8: press the lit SEL button again to reach them). */
export const devBankB = t => DEV === '107' && +t >= 4;
/** Set the device: '707', '101' or '107'. Use setDevice() in ui/device.js, which also rebuilds the screens. */
export function assignDevice(v) {
  DEV = v;
}
/** True if track t (0-7) is in use on this device. The MC-101 uses tracks 1, 4, 5 and 7. */
export const devOn = t => DEVS[DEV].tracks.includes(+t);
/** How many tracks this device has (8 or 4). */
export const devCount = () => DEVS[DEV].tracks.length;
/** The track's number on the device (1-8, or 1-4 on the MC-101). */
export const devNum = t => DEVS[DEV].tracks.indexOf(+t) + 1;
/** True when all drums play from one track (full kits): always on the MC-101, an option on the MC-707. */
export const oneKit = () => {
  if (DEV === '101') return true;
  try {
    return !!S.oneKit;
  } catch (e) {
    return false;
  }
};
/**
 * True when the MC-707's three drum tracks each hold a full kit (kick, snare, hats and percussion, a
 * different kit on each): Live Mode's composed sets move the main kit between them (live/kit-hop.js).
 */
export const threeKits = () => {
  if (DEV === '101') return false;
  try {
    return !!S.threeKits && !S.oneKit;
  } catch (e) {
    return false;
  }
};
/** 'MC-707', 'MC-101' or 'MC-107'. */
export const devNm = () => DEVS[DEV].name;
/** '101' or '707' for an MC-101 or MC-707 port or device name, otherwise null. */
export const modelOfName = n => (/MC-?101/i.test(n || '') ? '101' : /MC-?707/i.test(n || '') ? '707' : null);
/** True for a MIDI port or audio device name of an MC-707 or MC-101. */
export const isMcName = n => /MC-?(707|101)/i.test(n || '');
/** The MC port or device in a list: the chosen device's model first, then the other one.
 * @param {Array<object>} list  ports or audio devices
 * @param {string} [key] the field holding the name ('name' for MIDI ports, 'label' for audio devices) */
export function mcFind(list, key = 'name') {
  const mine = devHw() === '101' ? /MC-?101/i : /MC-?707/i;
  return list.find(x => mine.test(x[key] || '')) || list.find(x => isMcName(x[key])) || null;
}
