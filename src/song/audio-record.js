import { $, toast } from '../core/dom.js';
import { devOn } from '../core/device.js';
import { S, scheduleSave } from '../core/state.js';
import { renderArr } from './arrangement.js';
import { songEnd } from '../core/song-model.js';
import { AU, ensureAudio } from '../services/synth.js';
import { REC, TR, startSong, stopAll, stopPlay } from '../services/transport.js';
import { recStop } from './recording-midi.js';
import {
  AUD,
  AUDREC,
  PRE,
  audMode,
  capAttach,
  capCloseAll,
  capDetach,
  capKey,
  capOpen,
  rtCap,
  rtGet,
  sleep,
  waitFor
} from '../services/audio-capture.js';
import { loadLame, mp3Encoder, wavEncoder } from '../services/audio-files.js';
import { audBtn, audRender, openAudio } from './audio-dialog.js';
import { hooks } from '../core/hooks.js';

/* ---- recording passes ---- */
function mkSink(def, sr) {
  const enc = AUD.format === 'mp3' ? mp3Encoder(sr, AUD.kbps) : wavEncoder(sr, AUD.bits);
  const sk = {
    name: def.name,
    key: def.key,
    track: def.track,
    cap: def.cap,
    l: def.l,
    r: def.r,
    enc,
    skip: Math.max(0, Math.round((PRE + (AUD.trimMs + (def.cap === 'stem' ? AUD.stemTrimMs : 0)) / 1000) * sr)),
    feed(L, R, n) {
      let a = 0;
      if (sk.skip > 0) {
        const d = Math.min(sk.skip, n);
        sk.skip -= d;
        a = d;
        if (a >= n) return;
      }
      enc.push(L, R, a, n);
    }
  };
  return sk;
}
export function playRange() {
  const end = Math.max(1, Math.ceil(songEnd()));
  if (AUD.range === 'loop') return [S.loop.start, S.loop.end * 32];
  if (AUD.range === 'playhead') return [Math.floor(S.cursor), end * 32];
  return [0, end * 32];
}
export function audioJobs() {
  const pv = AUD.source === 'preview';
  const chN = k => {
    const c = AUDREC.caps[k];
    return c ? c.ch : audMode() === 'mc707' && (k === capKey('stem') || k.startsWith('d:')) ? 20 : 2;
  };
  const pairIdx = (k, p) => {
    const N = chN(k);
    return { l: Math.min(p * 2, N - 1), r: Math.min(p * 2 + 1, N - 1) };
  };
  const withClips = S.tracks.map((t, i) => i).filter(i => S.clips.some(c => c.t === i));
  const mixDef = () => {
    if (pv) return { name: 'Mix', key: 'mix', cap: 'pv', l: 0, r: 1 };
    if (audMode() === 'mc707' && AUD.mixFrom !== 'other') {
      const k = rtCap('mix'),
        p = pairIdx(k, rtGet('mix').pair);
      return { name: 'Mix', key: 'mix', cap: k, l: p.l, r: p.r };
    }
    const p = pairIdx('mix', Math.min(AUD.mixPair, Math.max(0, Math.ceil(chN('mix') / 2) - 1)));
    return { name: 'Mix', key: 'mix', cap: 'mix', l: p.l, r: p.r };
  };
  const jobs = [];
  if (AUD.stems === 'channels' && !pv) {
    const sinks = [];
    if (AUD.mix) sinks.push(mixDef());
    S.tracks.forEach((t, i) => {
      if (AUD.stemPairs[i] < 0 || !devOn(i)) return;
      const k = 't' + i,
        cap = rtCap(k),
        pr = rtGet(k).pair;
      if (pr >= Math.ceil(chN(cap) / 2)) return;
      const p = pairIdx(cap, pr);
      sinks.push({ name: t.name, key: k, track: i, cap, l: p.l, r: p.r });
    });
    if (AUD.extIn) {
      const cap = rtCap('ext'),
        pr = rtGet('ext').pair;
      if (pr < Math.ceil(chN(cap) / 2)) {
        const p = pairIdx(cap, pr);
        sinks.push({ name: 'Ext In', key: 'ext', cap, l: p.l, r: p.r });
      }
    }
    if (sinks.length) jobs.push({ label: 'All channels at once', sinks });
  } else {
    if (AUD.mix) jobs.push({ label: 'Full mix', sinks: [mixDef()] });
    if (AUD.stems === 'passes')
      withClips.forEach(i =>
        jobs.push({
          label: 'Stem: ' + S.tracks[i].name,
          solo: i,
          sinks: [{ ...mixDef(), name: S.tracks[i].name, key: 't' + i, track: i }]
        })
      );
  }
  return jobs;
}
async function runPass(job, sr) {
  const sinks = job.sinks.map(d => mkSink(d, sr));
  AUDREC.sinks = sinks;
  capAttach();
  const [startBar, endTick] = playRange();
  if (job.solo != null)
    S.tracks.forEach((t, i) => {
      t.solo = i === job.solo;
      if (i === job.solo) t.mute = false;
    });
  await sleep(PRE * 1000);
  S.loop.on = false;
  S.cursor = startBar;
  startSong({ endTick });
  await waitFor(() => !TR.playing || AUDREC.stop);
  if (TR.playing) stopPlay();
  await sleep(AUDREC.stop ? 350 : Math.round(AUD.tail * 1000));
  capDetach();
  AUDREC.sinks = [];
  for (const sk of sinks) {
    const r = sk.enc.finish();
    AUDREC.results.push({ ...r, key: sk.key, label: sk.name, track: sk.track });
  }
}
export const pad2 = n => String(n).padStart(2, '0');
export function audioFileName(r) {
  const nm =
    String(r.label)
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'track';
  if (r.key === 'ext') return AUDREC.base + '-ext-in.' + r.ext;
  return r.key === 'mix'
    ? AUDREC.base + '-mix.' + r.ext
    : AUDREC.base + '-stem-' + pad2((r.track || 0) + 1) + '-' + nm + '.' + r.ext;
}
export async function audioRecord() {
  if (AUDREC.on || AUDREC.busy) return;
  AUDREC.busy = true;
  AUDREC.err = '';
  audRender();
  let saved = null;
  try {
    ensureAudio();
    const sr = AU.ctx.sampleRate;
    if (AUD.format === 'mp3') {
      await loadLame();
      if (![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(sr))
        throw new Error('MP3 does not support this device’s ' + sr + ' Hz sample rate. Use WAV instead.');
    }
    if (AUD.source === 'input') {
      const need = new Set(
        audioJobs()
          .flatMap(j => j.sinks.map(x => x.cap))
          .filter(k => k !== 'pv')
      );
      for (const k of need) if (!AUDREC.caps[k]) await capOpen(k);
    }
    const jobs = audioJobs();
    if (!jobs.length) throw new Error('Nothing to record. Turn on the full mix or stems.');
    const [sb, et] = playRange();
    if (et <= sb * 32 || !S.clips.length) throw new Error('There is nothing to play in that range.');
    stopAll();
    if (REC.on) recStop();
    saved = {
      preview: S.preview,
      metro: S.metro,
      loop: { ...S.loop },
      cursor: S.cursor,
      flags: S.tracks.map(t => ({ mute: t.mute, solo: t.solo }))
    };
    S.metro = false;
    S.preview = AUD.source === 'preview' ? true : false;
    hooks.syncControls();
    const d = new Date();
    AUDREC.base =
      'mc707-song-' +
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      '-' +
      pad2(d.getHours()) +
      pad2(d.getMinutes());
    AUDREC.on = true;
    AUDREC.busy = false;
    AUDREC.stop = false;
    AUDREC.results = [];
    AUDREC.t0 = performance.now();
    AUDREC.jobs = jobs;
    for (let j = 0; j < jobs.length && !AUDREC.stop; j++) {
      AUDREC.pass = j;
      AUDREC.label = jobs[j].label;
      audRender();
      await runPass(jobs[j], sr);
      for (const [i, f] of saved.flags.entries()) {
        S.tracks[i].mute = f.mute;
        S.tracks[i].solo = f.solo;
      }
    }
  } catch (err) {
    AUDREC.err = (err && err.message) || String(err);
    toast(AUDREC.err);
  } finally {
    AUDREC.on = false;
    AUDREC.busy = false;
    capDetach();
    AUDREC.sinks = [];
    if (TR.playing) stopPlay();
    if (saved) {
      S.preview = saved.preview;
      S.metro = saved.metro;
      S.loop = saved.loop;
      S.cursor = saved.cursor;
      saved.flags.forEach((f, i) => {
        S.tracks[i].mute = f.mute;
        S.tracks[i].solo = f.solo;
      });
    }
    hooks.syncControls();
    renderArr();
    scheduleSave();
    if ($('#audio').hidden) capCloseAll();
    audRender();
    audBtn();
    if (AUDREC.results.length)
      toast(
        'Recorded ' +
          AUDREC.results.length +
          ' file' +
          (AUDREC.results.length > 1 ? 's' : '') +
          '. Open Audio to save them.'
      );
  }
}
export function audioStop() {
  if (AUDREC.on) AUDREC.stop = true;
}
export function quickRec() {
  if (AUDREC.on) {
    audioStop();
    return;
  }
  if (AUD.source === 'input' && !AUD.mixDev && !AUDREC.caps.mix) {
    openAudio();
    return;
  }
  audioRecord();
}
