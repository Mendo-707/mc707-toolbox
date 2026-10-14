import { $, clamp, el, toast } from '../core/dom.js';
import { TRACK_COLORS, devOn } from '../core/device.js';
import { HOST, S } from '../core/state.js';
import { AU } from '../services/synth.js';
import {
  AUD,
  AUDREC,
  RT_KEYS,
  audMode,
  capCloseAll,
  capListDevices,
  capPerm,
  rtAutoMatch,
  rtCap,
  rtDefPair,
  rtGet,
  rtLabel,
  rtMcDevs,
  rtMulti,
  rtSet,
  saveAud
} from '../services/audio-capture.js';
import { audioFileName, audioJobs, audioRecord, audioStop, pad2, playRange, quickRec } from './audio-record.js';
import { audioSave } from './audio-save.js';
import { applyAudMode, audioMeterTick, audioSignalCard } from './audio-check.js';

/* ---- dialog ---- */
const fmtSize = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');
const fmtTime = s => Math.floor(s / 60) + ':' + pad2(Math.floor(s % 60));
export function audBtn() {
  const b = $('#bAudRec');
  if (!b) return;
  if (AUDREC.on) {
    b.classList.add('on');
    b.textContent = '■ Stop (' + fmtTime((performance.now() - AUDREC.t0) / 1000) + ')';
  } else {
    b.classList.remove('on');
    b.textContent = AUDREC.busy ? 'Preparing…' : '● Record audio';
  }
}
function audTick() {
  audBtn();
  if ($('#audio').hidden) return;
  const st = $('#audStatus');
  if (st) {
    if (AUDREC.on)
      st.textContent =
        'Recording ' +
        (AUDREC.pass + 1) +
        ' of ' +
        AUDREC.jobs.length +
        ': ' +
        AUDREC.label +
        ' · ' +
        fmtTime((performance.now() - AUDREC.t0) / 1000);
    else if (AUDREC.err) st.textContent = AUDREC.err;
    else st.textContent = AUDREC.busy ? 'Preparing…' : 'Ready.';
  }
  audioMeterTick();
}
export function openAudio() {
  $('#audio').hidden = false;
  applyAudMode(audMode());
  renderAudio();
  capPerm()
    .then(() => capListDevices(false))
    .then(() => {
      applyAudMode(audMode());
      renderAudio();
    });
}
export function closeAudio() {
  $('#audio').hidden = true;
  AUDREC.metering = false;
  AUDREC.checking = false;
  if (!AUDREC.on && !AUDREC.busy) capCloseAll();
}
export function audRender() {
  if (!$('#audio').hidden) renderAudio();
}
export function renderAudio() {
  const head = $('#audioHead');
  head.textContent = '';
  head.append(
    el('h2', {}, 'Record audio'),
    el('div', { class: 'steps' }),
    el('button', { class: 'btn sm', onclick: closeAudio }, 'Close')
  );
  const b = $('#audioBody');
  const sc = b.scrollTop;
  b.textContent = '';
  const rec = AUDREC.on || AUDREC.busy,
    m = audMode();
  /* 1. two clear choices: 2-channel stereo mix, or 8-channel (every track) */
  const how = el('div', { class: 'wcard' }, el('h3', {}, '1. What do you want to record?'));
  const pick = v => {
    capCloseAll();
    AUDREC.metering = false;
    AUDREC.check = null;
    applyAudMode(v);
    renderAudio();
  };
  const tile = (v, tag, t, d) =>
    el(
      'button',
      { class: 'rectile' + (m === v ? ' on' : ''), disabled: rec, onclick: () => pick(v) },
      el('span', { class: 'rtag' + (v === 'interface' ? ' b' : '') }, tag),
      el('b', {}, t),
      el('small', {}, d)
    );
  how.append(
    el(
      'div',
      { class: 'rectiles' },
      tile(
        'interface',
        '2 CHANNELS',
        'Stereo mix',
        'One stereo file of the whole song, from the MC-707’s mix output or any audio interface. Optional: a stem per track by playing each track on its own.'
      ),
      tile(
        'mc707',
        '8 CHANNELS',
        'Every track separately',
        'The mix plus each MC-707 track as its own stereo file, all recorded at the same time in one pass over USB.'
      )
    ),
    el(
      'label',
      { class: 'audtk', style: 'margin-top:8px' },
      el('input', {
        type: 'radio',
        name: 'audmode',
        checked: m === 'preview',
        disabled: rec,
        onchange: () => pick('preview')
      }),
      el('span', {}, 'No hardware? Record the app’s preview sound instead')
    )
  );
  b.append(how);
  /* 2. setup for the chosen kind */
  if (m !== 'preview') {
    const is8 = m === 'mc707';
    const cn = el(
      'div',
      { class: 'wcard recarea ' + (is8 ? 'r8' : 'r2'), style: 'margin-top:12px' },
      el(
        'div',
        { class: 'recareah' },
        el('span', { class: 'rtag' }, is8 ? '8 CHANNELS' : '2 CHANNELS'),
        el('h3', {}, is8 ? '2. Set up 8-channel recording' : '2. Set up stereo mix recording')
      )
    );
    const pm = AUDREC.perm,
      granted = pm === 'granted' || AUDREC.devices.some(d => d.label);
    const chk = (ok, title, sub) =>
      el(
        'div',
        { class: 'ck ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'pend'), style: 'margin-top:6px' },
        el('span', { class: 'ico' }, ok === true ? '✔' : ok === false ? '✖' : '•'),
        el('span', {}, el('b', {}, title), sub ? el('small', { style: 'line-height:1.4' }, sub) : null)
      );
    cn.append(
      chk(
        granted ? true : pm === 'denied' ? false : null,
        'Permission to use audio inputs: ' + (granted ? 'allowed' : pm === 'denied' ? 'blocked' : 'not allowed yet'),
        granted
          ? null
          : pm === 'denied'
            ? 'Click the lock icon in the address bar, set Microphone to Allow and reload. In the Windows app, allow it when asked.'
            : 'Press Allow audio inputs. The browser asks once.'
      )
    );
    if (AUDREC.err && !AUDREC.on) cn.append(chk(false, 'Problem', AUDREC.err));
    cn.append(
      el(
        'div',
        { class: 'row' },
        el(
          'button',
          {
            class: 'btn' + (granted ? '' : ' on'),
            disabled: rec,
            onclick: async () => {
              await capListDevices(true);
              applyAudMode(m);
              renderAudio();
            }
          },
          granted ? 'Refresh devices' : 'Allow audio inputs'
        )
      )
    );
    const devSel = (val, on, first, extra) => {
      const s2 = el('select', {
        disabled: rec,
        onchange: e => {
          on(e.target.value);
          saveAud();
          capCloseAll();
          AUDREC.metering = false;
          AUDREC.check = null;
          renderAudio();
        },
        ...(extra || {})
      });
      s2.append(el('option', { value: '' }, first));
      AUDREC.devices.forEach(d =>
        s2.append(
          el(
            'option',
            { value: d.deviceId, selected: val === d.deviceId },
            d.label || 'Input ' + d.deviceId.slice(0, 6)
          )
        )
      );
      return s2;
    };
    const pairSel = (val, on, n) => {
      const s2 = el('select', {
        disabled: rec,
        onchange: e => {
          on(+e.target.value);
          saveAud();
          capCloseAll();
          AUDREC.metering = false;
          AUDREC.check = null;
          renderAudio();
        }
      });
      for (let p = 0; p < (n || 10); p++)
        s2.append(el('option', { value: p, selected: val === p }, p * 2 + 1 + '–' + (p * 2 + 2)));
      return s2;
    };
    if (is8) {
      const mcs = rtMcDevs(),
        multi = rtMulti();
      cn.append(
        chk(
          granted ? (mcs.length ? true : false) : null,
          mcs.length
            ? mcs.length > 1
              ? 'Found ' + mcs.length + ' MC-707 inputs'
              : 'MC-707 audio found: ' + mcs[0].label
            : 'MC-707 audio not found',
          mcs.length
            ? mcs.length > 1
              ? 'Windows lists the MC-707 as separate inputs, one per track. Each track picks its input below.'
              : null
            : 'Plug the MC-707 in by USB, then press Refresh devices. If it still does not appear, see the steps below.'
        )
      );
      const c = AUDREC.caps[rtCap('t0')];
      if (!multi)
        cn.append(
          chk(
            c ? (c.ch >= 18 ? true : false) : null,
            c
              ? c.ch + ' channels coming in on one input' + (c.ch >= 18 ? ' (mix, 8 tracks and Ext In)' : '')
              : 'Channels: press Show levels below to check',
            c && c.ch < 18
              ? 'Only ' +
                  c.ch +
                  ' channels arrive on that input. If Windows lists separate MC-707 inputs, press Match by name below, or pick an input for each track.'
              : null
          )
        );
      /* one row per channel: choose its input and channels */
      const tb = el(
        'div',
        { class: 'rtable' },
        el('div', { class: 'rth' }, el('span', {}, 'Record'), el('span', {}, 'Input'), el('span', {}, 'Channels'))
      );
      RT_KEYS.forEach(k => {
        const ti = k[0] === 't' ? +k.slice(1) : null;
        if (ti != null && !devOn(ti)) return;
        if (k === 'mix' && AUD.mixFrom === 'other') return;
        const r = rtGet(k),
          col = k === 'mix' ? 'var(--hot)' : k === 'ext' ? 'var(--mute)' : TRACK_COLORS[ti];
        tb.append(
          el(
            'div',
            { class: 'rtr', style: '--c:' + col },
            el('span', { class: 'rtl' }, rtLabel(k)),
            devSel(
              r.dev,
              v => rtSet(k, { dev: v, pair: v && v !== AUD.stemDev ? 0 : rtDefPair(k) }),
              'Main MC-707 input',
              { 'aria-label': 'Input for ' + rtLabel(k) }
            ),
            pairSel(r.pair, v => rtSet(k, { pair: v }))
          )
        );
      });
      cn.append(
        el(
          'div',
          { class: 'xrow' },
          el(
            'label',
            {},
            'Main MC-707 input',
            devSel(
              AUD.stemDev,
              v => {
                AUD.stemDev = v;
                if (AUD.mixFrom !== 'other') AUD.mixDev = v;
              },
              'Choose the MC-707…'
            )
          )
        ),
        el(
          'div',
          { class: 'row', style: 'margin-top:8px' },
          el(
            'button',
            {
              class: 'btn sm',
              disabled: rec || !mcs.length,
              onclick: () => {
                const n = rtAutoMatch();
                capCloseAll();
                AUDREC.metering = false;
                renderAudio();
                toast(n ? 'Matched ' + n + ' inputs by name' : 'No MC-707 inputs with track names were found');
              }
            },
            'Match by name'
          ),
          el(
            'button',
            {
              class: 'btn sm',
              disabled: rec,
              onclick: () => {
                AUD.route = {};
                saveAud();
                capCloseAll();
                AUDREC.metering = false;
                renderAudio();
                toast('All tracks now use the main input, channels 3–4 to 17–18');
              }
            },
            'Use one 20-channel input'
          ),
          el(
            'span',
            { class: 'hint' },
            'Each row is one channel of the recording: choose which input it comes from and which pair of channels.'
          )
        ),
        tb
      );
      cn.append(
        el(
          'details',
          { class: 'audhelp', open: !mcs.length },
          el('summary', {}, 'How to set up the MC-707 for multitrack USB audio'),
          el(
            'ol',
            {},
            el(
              'li',
              {},
              'On the MC-707 hold SHIFT and press KNOB ASSIGN to open the UTILITY menu, then turn C4 to open SYSTEM SETTING.'
            ),
            el(
              'li',
              {},
              'Turn C3 to USB Driver and set it to VENDOR with C4. Switch the MC-707 off and on again. (Firmware 1.60 and later can skip this.)'
            ),
            el(
              'li',
              {},
              'Connect it to the computer by USB. Windows 10 and 11 install the Roland driver by themselves when online; otherwise get it from roland.com.'
            ),
            el(
              'li',
              {},
              'Close any other program that is using the MC-707 audio (a DAW, another browser tab), then press Refresh devices.'
            ),
            el(
              'li',
              {},
              'Windows shows either one input with 20 channels (1–2 Mix, 3–4 Track 1 … 17–18 Track 8, 19–20 Ext In) or a separate input for the mix and each track. Both work: press Match by name for separate inputs.'
            )
          )
        )
      );
      const mf = el(
        'select',
        {
          disabled: rec,
          onchange: e => {
            AUD.mixFrom = e.target.value;
            if (AUD.mixFrom !== 'other') {
              AUD.mixDev = AUD.stemDev;
              AUD.mixPair = 0;
            }
            saveAud();
            capCloseAll();
            AUDREC.metering = false;
            renderAudio();
          }
        },
        el('option', { value: 'mc707', selected: AUD.mixFrom !== 'other' }, 'the MC-707 (row above)'),
        el('option', { value: 'other', selected: AUD.mixFrom === 'other' }, 'another audio interface')
      );
      const row = el('div', { class: 'xrow', style: 'margin-top:8px' }, el('label', {}, 'Take the mix from', mf));
      if (AUD.mixFrom === 'other') {
        row.append(
          el(
            'label',
            {},
            'Mix input',
            devSel(
              AUD.mixDev,
              v => {
                AUD.mixDev = v;
              },
              'Default input'
            )
          )
        );
        const mc2 = AUDREC.caps.mix;
        if (mc2 && mc2.ch > 2)
          row.append(
            el(
              'label',
              {},
              'Mix channels',
              pairSel(
                AUD.mixPair,
                v => {
                  AUD.mixPair = v;
                },
                Math.ceil(mc2.ch / 2)
              )
            )
          );
      }
      cn.append(row);
    } else {
      cn.append(
        el(
          'div',
          { class: 'xrow' },
          el(
            'label',
            {},
            'Record from',
            devSel(
              AUD.mixDev,
              v => {
                AUD.mixDev = v;
              },
              AUDREC.devices.length ? 'Default input' : 'Press Allow audio inputs first'
            )
          )
        )
      );
      const c = AUDREC.caps.mix;
      cn.append(
        el(
          'div',
          { class: 'xrow' },
          el(
            'label',
            {},
            'The mix is on channels',
            pairSel(
              AUD.mixPair,
              v => {
                AUD.mixPair = v;
              },
              c ? Math.max(1, Math.ceil(c.ch / 2)) : 10
            )
          )
        )
      );
      cn.append(
        el(
          'div',
          { class: 'hint', style: 'margin-top:6px' },
          'For the MC-707’s own mix over USB, choose its MIX input (or the MC-707 input with channels 1–2). For an audio interface, choose it and the pair its MC-707 cables are plugged into.'
        )
      );
    }
    b.append(cn);
  }
  /* 3. signal check */
  b.append(audioSignalCard());
  /* 4. what */
  const wh = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, '3. What to record'));
  const rs = el('select', {
    'aria-label': 'Range',
    disabled: rec,
    onchange: e => {
      AUD.range = e.target.value;
      saveAud();
      renderAudio();
    }
  });
  [
    ['song', 'Whole song, from the start'],
    ['loop', 'The loop range, once'],
    ['playhead', 'From the playhead to the end']
  ].forEach(([v, l]) => rs.append(el('option', { value: v, selected: AUD.range === v }, l)));
  wh.append(
    el(
      'div',
      { class: 'xrow' },
      el('label', {}, 'Range', rs),
      el(
        'label',
        {},
        'Extra tail (seconds, for reverb)',
        el('input', {
          type: 'number',
          min: 0,
          max: 30,
          step: 0.5,
          value: AUD.tail,
          disabled: rec,
          style: 'width:90px',
          onchange: e => {
            AUD.tail = clamp(+e.target.value || 0, 0, 30);
            saveAud();
            renderAudio();
          }
        })
      )
    )
  );
  const cb = (on, lab, fn, c) =>
    el(
      'label',
      { class: 'audtk', style: c ? '--c:' + c : '' },
      el('input', {
        type: 'checkbox',
        checked: on,
        disabled: rec,
        onchange: e => {
          fn(e.target.checked);
          saveAud();
          renderAudio();
        }
      }),
      el('span', {}, lab)
    );
  const tk = el(
    'div',
    { class: 'audtks' },
    cb(AUD.mix, 'Mix', v => (AUD.mix = v), 'var(--hot)')
  );
  if (m === 'mc707') {
    S.tracks.forEach((t, i) =>
      tk.append(
        cb(
          AUD.stemPairs[i] >= 0,
          i + 1 + '. ' + t.name,
          v => {
            AUD.stemPairs[i] = v ? (AUD.stemPairs[i] >= 0 ? AUD.stemPairs[i] : i + 1) : -1;
          },
          TRACK_COLORS[i]
        )
      )
    );
    tk.append(cb(!!AUD.extIn, 'Ext In', v => (AUD.extIn = v), 'var(--mute)'));
    wh.append(
      el(
        'div',
        { class: 'hint', style: 'margin-top:8px' },
        'Each ticked track becomes its own stereo file, recorded at the same time, so they line up perfectly in a DAW.'
      ),
      tk
    );
    const all = el(
      'div',
      { class: 'row' },
      el(
        'button',
        {
          class: 'btn sm',
          disabled: rec,
          onclick: () => {
            AUD.stemPairs = [1, 2, 3, 4, 5, 6, 7, 8];
            AUD.mix = true;
            saveAud();
            renderAudio();
          }
        },
        'All 8 tracks + mix'
      ),
      el(
        'button',
        {
          class: 'btn sm',
          disabled: rec,
          onclick: () => {
            AUD.stemPairs = AUD.stemPairs.map(() => -1);
            saveAud();
            renderAudio();
          }
        },
        'Mix only'
      )
    );
    wh.append(all);
  } else {
    wh.append(tk);
    if (m === 'interface') {
      const sm = el(
        'div',
        { class: 'row' },
        el(
          'label',
          { class: 'audtk' },
          el('input', {
            type: 'checkbox',
            checked: AUD.stems === 'passes',
            disabled: rec,
            onchange: e => {
              AUD.ifStems = e.target.checked ? 'passes' : 'none';
              AUD.stems = AUD.ifStems;
              saveAud();
              renderAudio();
            }
          }),
          el('span', {}, 'Also make a stem for each track (plays the song once per track)')
        )
      );
      wh.append(sm);
    } else {
      wh.append(
        el(
          'div',
          { class: 'row' },
          el(
            'label',
            { class: 'audtk' },
            el('input', {
              type: 'checkbox',
              checked: AUD.stems === 'passes',
              disabled: rec,
              onchange: e => {
                AUD.stems = e.target.checked ? 'passes' : 'none';
                saveAud();
                renderAudio();
              }
            }),
            el('span', {}, 'Also make a stem for each track')
          )
        )
      );
    }
  }
  b.append(wh);
  /* 5. format + advanced */
  const fm = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, '4. File format'));
  const fs = el('select', {
    'aria-label': 'Format',
    disabled: rec,
    onchange: e => {
      AUD.format = e.target.value;
      saveAud();
      renderAudio();
    }
  });
  [
    ['wav', 'WAV (lossless, best for a DAW)'],
    ['mp3', 'MP3 (smaller files)']
  ].forEach(([v, l]) => fs.append(el('option', { value: v, selected: AUD.format === v }, l)));
  const q = el('select', {
    'aria-label': 'Quality',
    disabled: rec,
    onchange: e => {
      if (AUD.format === 'wav') AUD.bits = +e.target.value;
      else AUD.kbps = +e.target.value;
      saveAud();
      renderAudio();
    }
  });
  (AUD.format === 'wav'
    ? [
        [16, '16-bit'],
        [24, '24-bit']
      ]
    : [
        [128, '128 kbps'],
        [192, '192 kbps'],
        [256, '256 kbps'],
        [320, '320 kbps']
      ]
  ).forEach(([v, l]) =>
    q.append(el('option', { value: v, selected: (AUD.format === 'wav' ? AUD.bits : AUD.kbps) === v }, l))
  );
  const [sb, et] = playRange();
  const secs = (Math.max(0, et / 32 - sb) * 4 * 60) / S.bpm + AUD.tail;
  const jobs = audioJobs();
  const files = jobs.reduce((a, j) => a + j.sinks.length, 0);
  const sr = (AU.ctx && AU.ctx.sampleRate) || 48000;
  const per = AUD.format === 'wav' ? (secs * sr * 2 * AUD.bits) / 8 : secs * AUD.kbps * 125;
  fm.append(
    el('div', { class: 'xrow' }, el('label', {}, 'Format', fs), el('label', {}, 'Quality', q)),
    el(
      'div',
      { class: 'hint' },
      files +
        ' file' +
        (files === 1 ? '' : 's') +
        ', about ' +
        fmtTime(secs) +
        ' each, roughly ' +
        fmtSize(per * files) +
        ' in total' +
        (jobs.length > 1 ? '. Takes ' + jobs.length + ' passes, about ' + fmtTime(secs * jobs.length) + '.' : '.') +
        (HOST ? ' Saved to your recordings folder.' : '')
    )
  );
  const adv = el(
    'details',
    { class: 'audhelp' },
    el('summary', {}, 'Timing (latency)'),
    el(
      'div',
      { class: 'xrow' },
      el(
        'label',
        {},
        'Trim start (ms)',
        el('input', {
          type: 'number',
          min: -500,
          max: 2000,
          step: 1,
          value: AUD.trimMs,
          disabled: rec,
          style: 'width:90px',
          onchange: e => {
            AUD.trimMs = clamp(Math.round(+e.target.value) || 0, -500, 2000);
            saveAud();
          }
        })
      ),
      m === 'mc707' && AUD.mixFrom === 'other'
        ? el(
            'label',
            {},
            'Extra trim for the MC-707 input (ms)',
            el('input', {
              type: 'number',
              min: -500,
              max: 2000,
              step: 1,
              value: AUD.stemTrimMs,
              disabled: rec,
              style: 'width:90px',
              onchange: e => {
                AUD.stemTrimMs = clamp(Math.round(+e.target.value) || 0, -500, 2000);
                saveAud();
              }
            })
          )
        : null
    ),
    el(
      'div',
      { class: 'hint' },
      'If recordings start late compared with the song, raise Trim start until the first beat lines up.'
    )
  );
  fm.append(adv);
  b.append(fm);
  /* record + results */
  b.append(
    el(
      'div',
      { class: 'wcard', style: 'margin-top:12px' },
      el('h3', {}, 'Record'),
      el(
        'div',
        { class: 'row' },
        el(
          'button',
          {
            class: 'btn recaudio' + (AUDREC.on ? ' on' : ''),
            disabled: AUDREC.busy && !AUDREC.on,
            onclick: () => {
              if (AUDREC.on) audioStop();
              else audioRecord();
            }
          },
          AUDREC.on ? '■ Stop' : '● Start recording'
        ),
        el('span', { id: 'audStatus', class: 'hint' }, 'Ready.')
      ),
      el(
        'div',
        { class: 'hint' },
        'Recording plays the song from the start of the range and stops by itself at the end. Press Stop at any time to keep what has been recorded so far.'
      )
    )
  );
  if (AUDREC.results.length) {
    const rc = el('div', { class: 'wcard', style: 'margin-top:12px' }, el('h3', {}, 'Recorded files'));
    const tb = el('div', { class: 'sut' });
    AUDREC.results.forEach(r =>
      tb.append(
        el(
          'div',
          { class: 'sur learnrow', style: '--c:' + (r.track != null ? TRACK_COLORS[r.track] : 'var(--hot)') },
          el('span', { class: 'tn' }, audioFileName(r)),
          el('span', {}, fmtSize(r.size) + ' · ' + fmtTime(r.frames / sr)),
          el('button', { class: 'btn sm', onclick: () => audioSave([r]) }, 'Save')
        )
      )
    );
    rc.append(
      tb,
      el(
        'div',
        { class: 'row' },
        el(
          'button',
          { class: 'btn on', onclick: () => audioSave(AUDREC.results) },
          AUDREC.results.length > 1 ? 'Save all (.zip)' : 'Save'
        ),
        el(
          'button',
          {
            class: 'btn',
            disabled: AUDREC.on,
            onclick: () => {
              AUDREC.results = [];
              renderAudio();
            }
          },
          'Discard'
        )
      )
    );
    b.append(rc);
  }
  b.scrollTop = sc;
  audTick();
}
export function initAudio() {
  $('#bAudRec').addEventListener('click', quickRec);
  $('#bAudSet').addEventListener('click', openAudio);
  $('#audio').addEventListener('pointerdown', e => {
    if (e.target.id === 'audio') closeAudio();
  });
  setInterval(audTick, 120);
  audBtn();
}
