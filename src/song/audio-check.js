import { $, el, toast } from '../core/dom.js';
import { TRACK_COLORS, devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import {
  AUD,
  AUDREC,
  audMode,
  capAttachOne,
  capCloseAll,
  capDetach,
  capOpen,
  rtAutoMatch,
  rtCap,
  rtGet,
  rtMcDevs,
  rtMulti,
  rtSet,
  saveAud,
  sleep
} from '../services/audio-capture.js';
import { renderAudio } from './audio-dialog.js';
import { hooks } from '../core/hooks.js';

/* ---------- recording setup ----------
   MC-707 USB audio (Roland driver, USB Driver = VENDOR) sends 20 channels to the computer:
   1-2 MIX, 3-4 TRACK 1 … 17-18 TRACK 8, 19-20 EXT IN (Roland support article 360038852492). */

function mcDevice() {
  return AUDREC.devices.find(d => /MC-?707/i.test(d.label));
}
export function applyAudMode(m) {
  AUD.mode = m;
  if (m === 'preview') {
    AUD.source = 'preview';
    if (AUD.stems === 'channels') AUD.stems = 'none';
  } else if (m === 'interface') {
    AUD.source = 'input';
    AUD.stems = AUD.ifStems || 'none';
    if (!AUD.mixDev) {
      const mx = AUDREC.devices.find(d => /MC-?707|MC-?101/i.test(d.label) && /\bmix\b/i.test(d.label));
      if (mx) AUD.mixDev = mx.deviceId;
    }
  } else {
    AUD.source = 'input';
    AUD.stems = 'channels';
    const mc = AUDREC.devices.find(d => /MC-?707|MC-?101/i.test(d.label) && /\bmix\b/i.test(d.label)) || mcDevice();
    if (mc && !AUD.stemDev) AUD.stemDev = mc.deviceId;
    if (!AUD.route && rtMcDevs().length > 1) rtAutoMatch();
    if (AUD.mixFrom !== 'other') AUD.mixDev = AUD.stemDev;
    if (AUD.mixFrom !== 'other') AUD.mixPair = 0;
  }
  saveAud();
}
function dbOf(p) {
  return p > 0 ? 20 * Math.log10(p) : -90;
}
function sigRows() {
  const m = audMode();
  if (m === 'mc707') {
    const rows = [];
    if (AUD.mix)
      rows.push({
        lab: 'Mix',
        cap: AUD.mixFrom === 'other' ? 'mix' : rtCap('mix'),
        pair: AUD.mixFrom === 'other' ? AUD.mixPair : rtGet('mix').pair,
        c: 'var(--hot)'
      });
    S.tracks.forEach((t, i) => {
      if (AUD.stemPairs[i] >= 0 && devOn(i))
        rows.push({
          lab: i + 1 + '. ' + t.name,
          cap: rtCap('t' + i),
          pair: rtGet('t' + i).pair,
          c: TRACK_COLORS[i],
          ti: i
        });
    });
    if (AUD.extIn) rows.push({ lab: 'Ext In', cap: rtCap('ext'), pair: rtGet('ext').pair, c: 'var(--mute)' });
    return rows;
  }
  const c = AUDREC.caps.mix;
  const n = c ? Math.ceil(c.ch / 2) : 1;
  return Array.from({ length: n }, (_, p) => ({
    lab: p === AUD.mixPair ? 'Mix (' + (p * 2 + 1) + '–' + (p * 2 + 2) + ')' : 'In ' + (p * 2 + 1) + '–' + (p * 2 + 2),
    cap: 'mix',
    pair: p,
    c: p === AUD.mixPair ? 'var(--hot)' : 'var(--mute)'
  }));
}
async function audMeterStart() {
  try {
    const ks = new Set(sigRows().map(r => r.cap));
    for (const k of ks) {
      if (!AUDREC.caps[k]) await capOpen(k);
      capAttachOne(k);
    }
    AUDREC.metering = true;
    AUDREC.err = '';
  } catch (e) {
    AUDREC.err = e.message || String(e);
  }
  renderAudio();
}
function audMeterStop() {
  capDetach();
  AUDREC.metering = false;
  renderAudio();
}
/* Play a note on each MC-707 track in turn and see which USB channel pair it arrives on. */
async function audCheckRouting() {
  if (!MIDI.out) {
    toast('Connect the MC-707 first (Settings › Quick setup).');
    return;
  }
  if (!AUDREC.metering) await audMeterStart();
  /* listen on every MC input at once, so a track is found wherever it arrives */
  for (const d of rtMcDevs()) {
    const k = 'd:' + d.deviceId;
    try {
      if (!AUDREC.caps[k]) await capOpen(k);
      capAttachOne(k);
    } catch (e) {}
  }
  const caps = Object.keys(AUDREC.caps)
    .filter(k => k.startsWith('d:'))
    .map(k => AUDREC.caps[k]);
  if (!caps.length) {
    toast('Open the MC-707 audio input first');
    return;
  }
  AUDREC.checking = true;
  AUDREC.check = {};
  renderAudio();
  for (let i = 0; i < 8 && AUDREC.checking; i++) {
    if (!devOn(i)) continue;
    caps.forEach(c => (c.max = []));
    hooks.testNote(i);
    await sleep(750);
    const want = rtGet('t' + i),
      wc = AUDREC.caps[rtCap('t' + i)],
      lv = (c, p) => (c ? Math.max(c.max[p * 2] || 0, c.max[p * 2 + 1] || 0) : 0);
    let best = null,
      bv = 0;
    caps.forEach(c => {
      for (let p = 0; p < Math.ceil(c.ch / 2); p++) {
        if (c.ch > 2 && (p === 0 || p === 9)) continue;
        const v = lv(c, p);
        if (v > bv) {
          bv = v;
          best = { dev: c.k.slice(2), pair: p };
        }
      }
    });
    const ok = dbOf(lv(wc, want.pair)) > -48,
      hit = dbOf(bv) > -48;
    AUDREC.check[i] = { ok, db: dbOf(lv(wc, want.pair)), found: hit && !ok ? best : null, silent: !hit };
    renderAudio();
  }
  AUDREC.checking = false;
  renderAudio();
}
export function audioSignalCard() {
  const m = audMode(),
    rec = AUDREC.on || AUDREC.busy,
    card = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, 'Signal check'));
  if (m === 'preview') {
    card.append(
      el('div', { class: 'hint' }, 'Preview sound is recorded straight from the app, so there are no levels to set.')
    );
    return card;
  }
  card.append(
    el(
      'div',
      { class: 'row' },
      el(
        'button',
        {
          class: 'btn' + (AUDREC.metering ? ' on' : ''),
          disabled: rec,
          onclick: () => (AUDREC.metering ? audMeterStop() : audMeterStart())
        },
        AUDREC.metering ? '■ Stop meters' : '▶ Show levels'
      ),
      m === 'mc707'
        ? el(
            'button',
            {
              class: 'btn',
              disabled: rec || AUDREC.checking,
              onclick: audCheckRouting,
              title: 'Plays a note on each MC-707 track and checks it arrives on the right USB channels'
            },
            AUDREC.checking ? 'Checking…' : 'Check each track'
          )
        : null,
      el(
        'span',
        { class: 'hint' },
        m === 'mc707'
          ? 'Show levels, then play the song or press Check each track. Each row should light up on its own.'
          : 'Play something on the MC-707 and watch the levels.'
      )
    )
  );
  const tb = el('div', { class: 'sigt', id: 'sigTable' });
  sigRows().forEach((r, idx) => {
    const ck = r.ti != null && AUDREC.check ? AUDREC.check[r.ti] : null;
    let chip = el('span', { class: 'sigchip', id: 'sigS' + idx }, '—');
    const fname = f => {
      const d = AUDREC.devices.find(x => x.deviceId === f.dev);
      return (
        (d && rtMulti() ? d.label.replace(/\s*\(.*\)\s*$/, '') + ' ' : '') + (f.pair * 2 + 1) + '–' + (f.pair * 2 + 2)
      );
    };
    if (ck)
      chip = el(
        'span',
        {
          class: 'sigchip ' + (ck.ok ? 'ok' : 'bad'),
          id: 'sigS' + idx,
          title: ck.ok ? 'This track arrives on the right channels' : 'No sound arrived here'
        },
        ck.ok ? '✔ OK' : ck.found ? 'Found on ' + fname(ck.found) : '✖ Silent'
      );
    const fix =
      ck && !ck.ok && ck.found
        ? el(
            'button',
            {
              class: 'btn sm',
              onclick: () => {
                rtSet('t' + r.ti, {
                  dev: ck.found.dev === AUD.stemDev ? '' : ck.found.dev,
                  pair: ck.found.pair
                });
                AUDREC.check[r.ti] = { ...ck, ok: true, found: null };
                capCloseAll();
                AUDREC.metering = false;
                renderAudio();
              }
            },
            'Use it'
          )
        : null;
    tb.append(
      el(
        'div',
        { class: 'sigr', style: '--c:' + r.c },
        el('span', { class: 'sigl' }, r.lab),
        el(
          'span',
          { class: 'sigch', title: (AUDREC.devices.find(d => 'd:' + d.deviceId === r.cap) || {}).label || '' },
          (rtMulti() && r.cap !== 'mix' ? 'In ' : 'USB ') + (r.pair * 2 + 1) + '–' + (r.pair * 2 + 2)
        ),
        el(
          'span',
          { class: 'sigb' },
          el('i', { class: 'L', id: 'sigL' + idx }),
          el('i', { class: 'R', id: 'sigR' + idx })
        ),
        el('span', { class: 'sigdb', id: 'sigD' + idx }, '−∞'),
        chip,
        fix
      )
    );
  });
  card.append(tb);
  if (m === 'mc707' && AUDREC.check && Object.values(AUDREC.check).some(x => x.silent))
    card.append(
      el(
        'div',
        { class: 'hint', style: 'margin-top:6px' },
        'A silent track usually means the track is muted or empty on the MC-707, its level is down, or it is set to a different MIDI channel. Fix it on the MC-707 or in Quick setup, then check again.'
      )
    );
  return card;
}
export function audioMeterTick() {
  if (!AUDREC.metering && !AUDREC.on) return;
  const rows = sigRows();
  rows.forEach((r, idx) => {
    const c = AUDREC.caps[r.cap],
      L = $('#sigL' + idx);
    if (!L) return;
    const pl = c ? c.peaks[r.pair * 2] || 0 : 0,
      pr = c ? c.peaks[r.pair * 2 + 1] || 0 : 0,
      R = $('#sigR' + idx),
      D = $('#sigD' + idx),
      S2 = $('#sigS' + idx);
    const w = p => Math.max(0, Math.min(100, ((dbOf(p) + 60) / 60) * 100)) + '%';
    L.style.width = w(pl);
    R.style.width = w(pr);
    const pk = Math.max(pl, pr),
      db = dbOf(pk);
    D.textContent = pk > 0.0005 ? db.toFixed(0) + ' dB' : '−∞';
    L.classList.toggle('hot', pl > 0.97);
    R.classList.toggle('hot', pr > 0.97);
    if (S2 && !(r.ti != null && AUDREC.check && AUDREC.check[r.ti])) {
      const st =
        pk > 0.97 ? ['bad', 'Too loud'] : db > -40 ? ['ok', 'Signal'] : db > -70 ? ['low', 'Quiet'] : ['', 'No signal'];
      S2.className = 'sigchip ' + st[0];
      S2.textContent = st[1];
    }
  });
}
