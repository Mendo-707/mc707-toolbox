// Which device the app drives: the MC-707 (8 tracks) or the MC-101 (4 tracks), the track colours,
// and helpers that say whether a track is in use.
//
// Owns: DEV (the device).
// Reads: S.
import { S } from './state.js';

export const TRACK_COLORS = ['#ff5f45', '#ffa629', '#ff6fa3', '#2fd3c0', '#4da3ff', '#a283ff', '#84d95b', '#e9d94a'];
/* Device: MC-707 (8 tracks) or MC-101 (4 tracks: Drums, Bass, Chords, Lead on channels 1-4). */
export const DEVS = {
  707: {
    name: 'MC-707',
    tracks: [0, 1, 2, 3, 4, 5, 6, 7],
    ch: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 }
  },
  101: { name: 'MC-101', tracks: [0, 3, 4, 6], ch: { 0: 1, 3: 2, 4: 3, 6: 4 } }
};
export let DEV = (() => {
  try {
    return localStorage.getItem('mc-device') === '101' ? '101' : '707';
  } catch (e) {
    return '707';
  }
})();
/** Set the device: '707' or '101'. Use setDevice() in ui/device.js, which also rebuilds the screens. */
export function assignDevice(v) {
  DEV = v;
}
/** True if track t (0-7) is in use on this device. The MC-101 uses tracks 1, 4, 5 and 7. */
export const devOn = t => DEV === '707' || DEVS['101'].tracks.includes(+t);
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
/** 'MC-707' or 'MC-101'. */
export const devNm = () => (DEV === '101' ? 'MC-101' : 'MC-707');
