// The track setup: what each of the 8 tracks is for. A track's role (kit, hats, perc, bass, chords,
// pad, lead, pluck or acid) decides whether it is a drum or tone track and which patterns it draws.
// The default is the classic layout: three drum tracks, then bass, chords, pad, lead and pluck.
//
// Features think in "slots", the eight jobs of that default layout (0 kit … 7 pluck). slotOf(t) is
// the job of track t, trackOf(slot) the track doing a job (or -1). With the default setup they are
// the same number, so everything behaves as it always did.
//
// Reads: S.
import { S } from './state.js';

/** [role, label, type, slot, pattern pool] */
export const ROLES = [
  ['kit', 'Drums: kit', 'drum', 0, 'kit'],
  ['hats', 'Drums: hats', 'drum', 1, 'hats'],
  ['perc', 'Drums: perc', 'drum', 2, 'perc'],
  ['bass', 'Bass', 'tone', 3, 'bass'],
  ['chords', 'Chords', 'tone', 4, 'chords'],
  ['pad', 'Pad', 'tone', 5, 'pad'],
  ['lead', 'Lead', 'tone', 6, 'lead'],
  ['pluck', 'Pluck / arp', 'tone', 7, 'pluck'],
  ['acid', 'Acid', 'tone', 3, 'acid']
];
/** The default role of each track. */
export const DEF_ROLES = ['kit', 'hats', 'perc', 'bass', 'chords', 'pad', 'lead', 'pluck'];
const R = Object.fromEntries(ROLES.map(r => [r[0], r]));
/** A role's [role, label, type, slot, pool] (unknown roles fall back to the track's default). */
export const roleInfo = (role, t = 0) => R[role] || R[DEF_ROLES[t]];
/** The role of track t. */
export const roleOf = t => (S.tracks[t] && R[S.tracks[t].role] ? S.tracks[t].role : DEF_ROLES[t]);
/** The slot (default-layout job, 0-7) track t does. */
export const slotOf = t => roleInfo(roleOf(t), t)[3];
/** The pattern pool track t draws from. */
export const poolOf = t => roleInfo(roleOf(t), t)[4];
/** The first track doing a slot's job, or -1 when no track does. */
export function trackOf(slot) {
  for (let t = 0; t < 8; t++) if (slotOf(t) === slot) return t;
  return -1;
}
/** Every track doing a slot's job. */
export const tracksOf = slot => [0, 1, 2, 3, 4, 5, 6, 7].filter(t => slotOf(t) === slot);
/** True with the classic layout (tracks 1-3 drums, then bass, chords, pad, lead, pluck). */
export const defaultSetup = () => DEF_ROLES.every((r, t) => roleOf(t) === r);
/**
 * Re-key a map from slots to tracks: {slot: value} → {track: value}, for every track doing that
 * slot's job (the first only when `first`). Slots no track does are dropped.
 */
export function bySlot(m, first) {
  const out = {};
  for (const k in m) {
    const ts = tracksOf(+k);
    (first ? ts.slice(0, 1) : ts).forEach(t => (out[t] = m[k]));
  }
  return out;
}
/** Every track doing any of these slots' jobs (in track order). */
export const tracksFor = slots => [0, 1, 2, 3, 4, 5, 6, 7].filter(t => (slots || []).includes(slotOf(t)));
/** The tone tracks. */
export const toneTracksAll = () => [0, 1, 2, 3, 4, 5, 6, 7].filter(t => S.tracks[t] && S.tracks[t].type === 'tone');
/** The kit track (slot 0), or else the first drum track, or -1 when every track is a tone track. */
export function kitTrack() {
  const k = trackOf(0);
  return k >= 0 ? k : S.tracks.findIndex(x => x && x.type === 'drum');
}
/** The track for builds and impacts: the perc track, or else the kit track (or -1). */
export const buildTrack = () => (trackOf(2) >= 0 ? trackOf(2) : kitTrack());
