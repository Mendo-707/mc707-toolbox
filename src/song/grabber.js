import { $, $$, el, toast } from '../core/dom.js';
import { DEV, DEVS, devNum } from '../core/device.js';
import { HOST, S } from '../core/state.js';
import { renderArr } from './arrangement.js';
import { AU, ensureAudio } from '../services/synth.js';
import { TR, startSong, stopPlay, tickDur } from '../services/transport.js';
import { syncControls } from './controls.js';
import { DL } from './export.js';
import {
  AUD,
  AUDREC,
  audioJobs,
  capAttachOne,
  capDetach,
  capOpen,
  makeZip2,
  pad2,
  wavEncoder
} from '../services/audio-capture.js';
import { anchorSave, audMode, openAudio } from './audio-dialog.js';
import { tempoAtBar, tickDurAt } from './automation.js';
import { LV } from '../live/state.js';
import { liveStart } from '../live/engine.js';

/* ===== Sample grabber: record a few bars of one MC-707 track (or the mix, or Ext In) to a WAV, lined up on the bar.
   While the song or the live set plays it grabs from the next bar line; when stopped it plays from the playhead.
   Uses the inputs set up in Audio (per-track USB channels), or the app's own sound with that track soloed. ===== */
export const GRAB = {
  on: false,
  list: [],
  bars: 4,
  src: (() => {
    try {
      return localStorage.getItem('mc707-grab-src') || 'mix';
    } catch (e) {
      return 'mix';
    }
  })(),
  sink: null,
  cleanup: null,
  label: '',
  pv: null
};
export const grabKeys = () => ['mix', ...DEVS[DEV].tracks.map(i => 't' + i), 'ext'];
export const grabName = k =>
  k === 'mix' ? 'Mix' : k === 'ext' ? 'Ext In' : 'Track ' + devNum(+k.slice(1)) + ': ' + S.tracks[+k.slice(1)].name;
const grabPv = () => AUD.source === 'preview';
/* which input and channels feed this source, worked out exactly as Audio recording does */
function grabDef(k) {
  const keep = { stems: AUD.stems, mix: AUD.mix, extIn: AUD.extIn };
  AUD.stems = 'channels';
  AUD.mix = true;
  AUD.extIn = true;
  let sinks = [];
  try {
    sinks = audioJobs().flatMap(j => j.sinks);
  } finally {
    Object.assign(AUD, keep);
  }
  if (grabPv()) {
    const m = sinks.find(x => x.key === 'mix');
    return m && k !== 'ext' ? { ...m, name: grabName(k), key: k, track: k === 'mix' ? undefined : +k.slice(1) } : null;
  }
  if (audMode() !== 'mc707' && k !== 'mix') return null;
  return sinks.find(x => x.key === k) || null;
}
function grabSecs(fromBar, bars) {
  let s = 0;
  for (let b = 0; b < bars; b++) s += 32 * (TR.mode === 'live' ? tickDur() : tickDurAt(fromBar + b));
  return s;
}
export async function grabStart() {
  if (GRAB.on) {
    grabStop();
    return;
  }
  if (AUDREC.on || AUDREC.busy) {
    toast('Audio recording is running. Stop it first.');
    return;
  }
  ensureAudio();
  const ctx = AU.ctx,
    sr = ctx.sampleRate,
    k = GRAB.src,
    def = grabDef(k);
  if (!def) {
    toast(
      grabPv()
        ? "Ext In needs the MC-707's USB audio. Choose it in Audio."
        : "Grabbing one track needs the MC-707's USB audio (8-channel). Set it up in Audio, or grab the Mix."
    );
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
  const bars = GRAB.bars;
  let startTime,
    fromBar,
    ours = false,
    saved = null;
  if (TR.playing && (TR.mode === 'song' || TR.mode === 'live')) {
    const v = TR.vis[0] || { tick: TR.tick, time: TR.nextTime, dur: tickDur() };
    const now = v.tick + (ctx.currentTime - v.time) / v.dur;
    let st = Math.ceil((now + 2) / 32) * 32;
    startTime = v.time + (st - v.tick) * v.dur;
    fromBar = TR.mode === 'song' ? st / 32 : 0;
  } else {
    if (document.body.dataset.mode === 'live') {
      liveStart(LV.cur);
      startTime = TR.nextTime;
      fromBar = 0;
      ours = 'live';
    } else {
      saved = {
        loop: { ...S.loop },
        preview: S.preview,
        metro: S.metro,
        flags: S.tracks.map(t => ({ mute: t.mute, solo: t.solo }))
      };
      fromBar = Math.floor(S.cursor);
      S.loop.on = false;
      S.cursor = fromBar;
      S.metro = false;
      if (grabPv()) S.preview = true;
      if (grabPv() && def.track != null)
        S.tracks.forEach((t, i) => {
          t.solo = i === def.track;
          if (i === def.track) t.mute = false;
        });
      startSong({ endTick: (fromBar + bars) * 32 });
      startTime = TR.nextTime;
      ours = 'song';
    }
  }
  if (grabPv() && TR.mode === 'live' && def.track != null) {
    GRAB.pv = { was: S.tracks.map(t => t.solo) };
    S.tracks.forEach((t, i) => {
      t.solo = i === def.track;
    });
  }
  const enc = wavEncoder(sr, AUD.bits === 24 ? 24 : 16),
    need = Math.round(grabSecs(fromBar, bars) * sr);
  let got = 0;
  const trim = (AUD.trimMs + (def.track != null && def.cap !== 'pv' ? AUD.stemTrimMs : 0)) / 1000;
  const sk = {
    cap: def.cap,
    l: def.l,
    r: def.r,
    skip: 0,
    feed(L, R, n) {
      let a = 0;
      if (sk.skip > 0) {
        const d = Math.min(sk.skip, n);
        sk.skip -= d;
        a = d;
        if (a >= n) return;
      }
      const b = Math.min(n, a + need - got);
      if (b > a) {
        enc.push(L, R, a, b);
        got += b - a;
      }
      if (got >= need && !sk.done) {
        sk.done = true;
        setTimeout(() => grabFinish(), 0);
      }
    }
  };
  sk.skip = Math.max(0, Math.round((startTime - ctx.currentTime + trim) * sr));
  sk.enc = enc;
  sk.need = need;
  sk.got = () => got;
  sk.t0 = startTime;
  sk.secs = need / sr;
  AUDREC.sinks.push(sk);
  capAttachOne(def.cap);
  Object.assign(GRAB, { on: true, sink: sk, label: grabName(k), bars, fromBar });
  GRAB.cleanup = () => {
    AUDREC.sinks = AUDREC.sinks.filter(x => x !== sk);
    if (!AUDREC.sinks.length && !AUDREC.on && !AUDREC.metering) capDetach();
    if (GRAB.pv) {
      GRAB.pv.was.forEach((s, i) => {
        S.tracks[i].solo = s;
      });
      GRAB.pv = null;
    }
    if (ours === 'song' && TR.playing && TR.mode === 'song') stopPlay();
    if (saved) {
      S.loop = saved.loop;
      S.preview = saved.preview;
      S.metro = saved.metro;
      saved.flags.forEach((f, i) => {
        S.tracks[i].mute = f.mute;
        S.tracks[i].solo = f.solo;
      });
      syncControls();
      renderArr();
    }
  };
  grabUI();
  GRAB.timer = setInterval(grabUI, 120);
}
function grabFinish(cancel) {
  if (!GRAB.on) return;
  const sk = GRAB.sink;
  GRAB.on = false;
  clearInterval(GRAB.timer);
  GRAB.cleanup && GRAB.cleanup();
  GRAB.cleanup = null;
  if (!cancel && sk.got() > 0) {
    const r = sk.enc.finish(),
      d = new Date(),
      bpm = Math.round(TR.mode === 'live' ? LV.bpm : tempoAtBar(GRAB.fromBar || 0));
    const secs = sk.got() / (AU.ctx.sampleRate || 48000),
      bars = Math.round((secs / grabSecs(GRAB.fromBar || 0, 1)) * 4) / 4;
    const nm =
      (GRAB.label
        .replace(/^Track \d+: /, '')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'grab') +
      '-' +
      bpm +
      'bpm-' +
      bars +
      'bar-' +
      pad2(d.getHours()) +
      pad2(d.getMinutes()) +
      pad2(d.getSeconds()) +
      '.wav';
    GRAB.list.unshift({ ...r, name: nm, label: GRAB.label, bars, bpm, url: URL.createObjectURL(r.blob) });
    if (GRAB.list.length > 12) {
      const x = GRAB.list.pop();
      URL.revokeObjectURL(x.url);
    }
    toast('Grabbed ' + bars + (bars === 1 ? ' bar' : ' bars') + ' of ' + GRAB.label);
  } else if (!cancel) toast('Nothing came in from ' + GRAB.label + '. Check the input in Audio.');
  grabUI();
  grabRenderPop();
}
export function grabStop() {
  if (!GRAB.on) return;
  grabFinish(GRAB.sink.got() <= 0);
}
export async function grabSave(r) {
  try {
    if (HOST) {
      const dir = await HOST.saveRecording([{ name: r.name, data: await r.blob.arrayBuffer() }], '');
      toast('Saved to ' + dir);
      return;
    }
    if (DL) {
      await DL.save({
        filename: r.name.replace(/\.wav$/, '.zip'),
        data: makeZip2([{ name: r.name, blob: r.blob, size: r.size, crc: r.crc }])
      });
      toast('Saved. This viewer saves audio inside a .zip.');
      return;
    }
    anchorSave(r.name, r.blob);
  } catch (e) {
    if (!e || e.code !== 'declined') toast('Could not save: ' + ((e && (e.code || e.message)) || 'error'));
  }
}
/* the button riding on the playhead (Song Mode) and in the Live toolbar */
export function grabUI() {
  const sk = GRAB.sink,
    ctx = AU.ctx;
  let txt = '◉',
    tip = 'Sample grabber: record a few bars of one track';
  if (GRAB.on && sk && ctx) {
    const left = sk.t0 - ctx.currentTime;
    txt =
      left > 0
        ? '◉ ' + Math.ceil(left / (grabSecs(0, 1) / 4))
        : '● ' + Math.min(GRAB.bars, Math.floor((sk.got() / sk.need) * GRAB.bars) + 1) + '/' + GRAB.bars;
    tip = left > 0 ? 'Starts on the next bar' : 'Grabbing ' + GRAB.label + '. Click to stop.';
  }
  ['grabBtn', 'lvGrab'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.toggle('on', GRAB.on);
    b.title = tip;
    b.textContent = id === 'lvGrab' ? (GRAB.on ? txt : '◉ Grab sample') : txt;
  });
}
export function grabOpen(anchor) {
  let p = $('#grabPop');
  if (p && p._anchor === anchor) {
    p.remove();
    return;
  }
  if (p) p.remove();
  p = el('div', { id: 'grabPop', class: 'grabPop', role: 'dialog', 'aria-label': 'Sample grabber' });
  p._anchor = anchor;
  document.body.append(p);
  grabRenderPop();
  const r = anchor.getBoundingClientRect(),
    w = p.offsetWidth,
    h = p.offsetHeight;
  p.style.left = Math.max(8, Math.min(r.left - 12, innerWidth - w - 8)) + 'px';
  p.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  setTimeout(
    () =>
      addEventListener(
        'pointerdown',
        function off(e) {
          const q = $('#grabPop');
          if (!q) {
            removeEventListener('pointerdown', off, true);
            return;
          }
          if (!q.contains(e.target) && e.target !== anchor && !e.target.closest('.cmenu')) {
            q.remove();
            removeEventListener('pointerdown', off, true);
          }
        },
        true
      ),
    0
  );
}
export function grabRenderPop() {
  const p = $('#grabPop');
  if (!p) return;
  p.textContent = '';
  const pv = grabPv(),
    mc = audMode() === 'mc707';
  const src = el(
    'select',
    {
      'aria-label': 'Grab from',
      disabled: GRAB.on,
      onchange: e => {
        GRAB.src = e.target.value;
        try {
          localStorage.setItem('mc707-grab-src', GRAB.src);
        } catch (x) {}
        grabRenderPop();
      }
    },
    ...grabKeys().map(k => {
      const ok = pv ? k !== 'ext' : mc || k === 'mix';
      return el(
        'option',
        { value: k, selected: GRAB.src === k, disabled: !ok },
        grabName(k) + (ok ? '' : ' (needs 8-channel USB audio)')
      );
    })
  );
  const lens = el(
    'div',
    { class: 'seg' },
    ...[1, 2, 4, 8, 16].map(n =>
      el(
        'button',
        {
          class: 'btn sm' + (GRAB.bars === n ? ' on' : ''),
          disabled: GRAB.on,
          onclick: () => {
            GRAB.bars = n;
            grabRenderPop();
          }
        },
        String(n)
      )
    )
  );
  const playing = TR.playing && (TR.mode === 'song' || TR.mode === 'live'),
    live = document.body.dataset.mode === 'live';
  const when = playing ? 'from the next bar' : live ? 'starting the set' : 'from bar ' + (Math.floor(S.cursor) + 1);
  p.append(
    el(
      'div',
      { class: 'grabH' },
      el('b', {}, 'Sample grabber'),
      el(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            const q = $('#grabPop');
            if (q) q.remove();
          },
          'aria-label': 'Close'
        },
        '✕'
      )
    ),
    el('label', { class: 'gf' }, 'Grab from', src),
    el('div', { class: 'gf' }, 'Length (bars)', lens),
    el(
      'button',
      { class: 'btn grabGo' + (GRAB.on ? ' on' : ''), onclick: grabStart },
      GRAB.on ? '■ Stop grabbing' : '● Grab ' + GRAB.bars + (GRAB.bars === 1 ? ' bar ' : ' bars ') + when
    ),
    el(
      'p',
      { class: 'hint' },
      pv
        ? "Recording the app's own sound" +
            (GRAB.src !== 'mix' ? ' with that track soloed' : '') +
            '. To grab the MC-707 itself, choose its USB audio in Audio.'
        : 'Recording ' + (mc ? "the MC-707's USB audio" : 'your audio interface') + '. Inputs and latency are set in ',
      pv
        ? ''
        : el(
            'a',
            {
              href: '#',
              onclick: e => {
                e.preventDefault();
                openAudio();
              }
            },
            'Audio'
          ),
      pv ? '' : '.'
    ),
    GRAB.list.length
      ? el(
          'div',
          { class: 'grabList' },
          ...GRAB.list.map((r, i) => {
            const au = el('audio', { src: r.url, preload: 'none' });
            const pl = el(
              'button',
              {
                class: 'btn sm',
                title: 'Play',
                onclick: () => {
                  if (au.paused) {
                    $$('#grabPop audio').forEach(a => a.pause());
                    au.currentTime = 0;
                    au.play();
                    pl.textContent = '■';
                    au.onended = au.onpause = () => {
                      pl.textContent = '▶';
                    };
                  } else au.pause();
                }
              },
              '▶'
            );
            return el(
              'div',
              { class: 'grabRow' },
              pl,
              au,
              el(
                'span',
                { title: r.name },
                r.label.replace(/^Track \d+: /, '') +
                  ' · ' +
                  r.bars +
                  (r.bars === 1 ? ' bar' : ' bars') +
                  ' · ' +
                  r.bpm +
                  ' BPM'
              ),
              el('button', { class: 'btn sm', onclick: () => grabSave(r) }, 'Save'),
              el(
                'button',
                {
                  class: 'btn sm',
                  title: 'Remove',
                  onclick: () => {
                    URL.revokeObjectURL(r.url);
                    GRAB.list.splice(i, 1);
                    grabRenderPop();
                  }
                },
                '✕'
              )
            );
          })
        )
      : el(
          'p',
          { class: 'hint' },
          'Grabs appear here. Save them as WAV files and load them into the MC-707 as samples.'
        )
  );
}
