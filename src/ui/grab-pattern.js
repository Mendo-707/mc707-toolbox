// Record sample from the pattern editor: play one pattern on its own, through the track you choose,
// and record it to a WAV with the sample grabber (that track's own USB channel when Audio has
// per-track channels set up, otherwise the mix).
//
// Reads: S, TR, AU, AUD, AUDREC, GRAB.
import { toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { AU, ensureAudio } from '../services/synth.js';
import { TR, startPat, stopPlay, stopAll, tickDur } from '../services/transport.js';
import { AUD, AUDREC, capOpen } from '../services/audio-capture.js';
import { openAudio } from '../song/audio-dialog.js';
import { GRAB, grabArm, grabDef, grabStop } from './grabber.js';

/**
 * Record pattern `p` played on track `t`, `loops` times through, to a WAV in the grabber's list.
 * Pressed again while it records, it stops.
 * @param {import('../core/types.js').Pattern} p
 * @param {number} t
 * @param {number} [loops]
 * @param {HTMLElement} [anchor]  where the grabber opens when the recording is ready
 */
export async function grabPattern(p, t, loops = 1, anchor) {
  if (GRAB.on) {
    grabStop();
    return;
  }
  if (AUDREC.on || AUDREC.busy) {
    toast('Audio recording is running. Stop it first.');
    return;
  }
  if (!p || !p.notes.length) {
    toast('This pattern has no notes yet');
    return;
  }
  ensureAudio();
  let k = 't' + t,
    def = grabDef(k);
  if (!def) {
    k = 'mix';
    def = grabDef(k);
  }
  if (!def) {
    toast("Recording needs an audio input. Choose the MC-707's USB audio (or the app's own sound) in Audio.");
    openAudio();
    return;
  }
  try {
    if (def.cap !== 'pv' && !AUDREC.caps[def.cap]) await capOpen(def.cap);
  } catch (e) {
    toast((e && e.message) || 'Could not open the audio input');
    openAudio();
    return;
  }
  stopAll();
  const was = { preview: S.preview, bars: GRAB.bars };
  if (AUD.source === 'preview') S.preview = true;
  startPat(p, t);
  const bars = p.bars * loops,
    need = Math.round(bars * 32 * tickDur() * AU.ctx.sampleRate),
    label = p.name + ' on ' + S.tracks[t].name + (k === 'mix' || def.cap === 'pv' ? '' : ' (own channel)');
  grabArm(def, k, TR.nextTime, need, { bars, fromBar: 0, label, anchor }, () => {
    if (TR.playing && TR.mode === 'pat') stopPlay();
    S.preview = was.preview;
    GRAB.bars = was.bars;
  });
  toast('Recording ' + bars + (bars === 1 ? ' bar' : ' bars') + ' of ' + p.name + ' on ' + S.tracks[t].name);
}
