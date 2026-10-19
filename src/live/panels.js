// The Live page panels: scene cards, pads, keys and mutes, knobs, and keeping the toolbar in step.
//
// Reads: S, LV, MIDI, DEV.
import { humanizeSync, lvHumApply } from './humanize-ui.js';
import { $, el } from '../core/dom.js';
import { DEV, DEVS, TRACK_COLORS, devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import { FLASH_RH } from '../library/flash.js';
import { NK } from '../library/styles.js';
import { LV, LV_TOPFN, NOTEN, lvStyle, noteLbl } from './state.js';
import { LV_FLASHC, actColor, actLabel, lvIsFlash, lvScCol } from './themes.js';
import { LV_SCFX } from './moves.js';
import { liveEditScene, liveRenderSceneEd } from './scene-editor.js';
import { LV_PLAY } from './scene-templates.js';
import { lvModeFam } from '../library/pools.js';
import { liveCue, liveKeyCue, liveMute, lvOn, lvVaryLabel } from './cues.js';
import { knobUI, livePadDown, livePadUp, scatter, sendKnob } from './pads.js';
import { liveRenderCtlBar } from './controller.js';
import { LV_KEYROWS, lvPadIndex } from './midi-in.js';
import { liveRenderLanes, liveStatus } from './lanes.js';
import { liveRenderSettings } from './settings-panel.js';

export function liveRender() {
  if (!$('#lvStyle')) return;
  $('#lvStyle').value = LV.style;
  $('#lvKey').value = LV.key;
  $('#lvBpm').value = LV.bpm;
  if ($('#lvSwing')) {
    $('#lvSwing').value = LV.swing;
    $('#lvSwV').textContent = LV.swing + '%';
  }
  humanizeSync();
  lvHumApply();
  $('#lvQ').value = LV.quant;
  $('#lvEntry').value = LV.entry;
  $('#lvFills').checked = LV.fills;
  $('#lvPrev').checked = !!S.preview;
  $('#lvReps').value = LV.autoReps;
  $('#lvChaos').value = LV.chaos;
  $('#lvRiseBars').value = LV.riseBars;
  $('#lvBrkSt').value = LV.brkStyle;
  $('#lvBrkLen').value = LV.brkLen;
  $('#lvBuildFx').checked = LV.buildFx !== false;
  $('#lvFlavor').value = LV.flavor;
  $('#lvVary').value = LV.vary;
  $('#lvVaryVal').textContent = lvVaryLabel();
  $('#lvDropSt').value = LV.dropStyle;
  $('#lvMode').value = LV.mode || 'minor';
  const ms = $('#lvMidiSt');
  if (ms)
    ms.textContent =
      (MIDI.out ? 'Out: ' + MIDI.out.name : 'No MIDI out') + ' · ' + (MIDI.inp ? 'In: ' + MIDI.inp.name : 'no MIDI in');
  liveRenderKeyRec();
  liveRenderCards();
  liveRenderSceneEd();
  liveRenderPads();
  liveRenderPerf();
  liveRenderKnobs();
  liveRenderSettings();
  liveRenderCtlBar();
  liveRenderLanes(0, true);
  liveStatus(0);
  liveSync();
}
export function liveSync() {
  const b = $('#lvStart');
  if (!b) return;
  const on = lvOn();
  b.textContent = !on ? '▶ Start Jam' : LV.jam && LV.jam.kind === 'out' ? '■ Stop now' : '■ End Jam';
  b.classList.toggle('stopb', on);
  {
    const pb = $('#lvPumpB'),
      pn = $('#lvPanB');
    if (pb)
      pb.classList.toggle(
        'on',
        (LV.autos || []).some(a => a.id === 'qpump')
      );
    if (pn)
      pn.classList.toggle(
        'on',
        (LV.autos || []).some(a => a.id === 'qpan')
      );
  }
  const a = $('#lvAuto');
  if (a) {
    a.classList.toggle('on', LV.auto);
    a.textContent = LV.auto ? 'Auto-pilot ON' : 'Auto-pilot';
  }
  const lk = $('#lvLock');
  if (lk) {
    lk.classList.toggle('on', !!LV.lock);
    lk.textContent = LV.lock ? '🔒 Locked' : '🔓 Lock loop';
    const ls = $('#lvLockSave');
    if (ls) ls.hidden = !LV.lock;
  }
  const pv = $('#lvPrev');
  if (pv) pv.checked = !!S.preview;
  [0.5, 1, 2].forEach(r => {
    const x = $('#lvRate' + String(r).replace('.', '_'));
    if (x) x.classList.toggle('on', LV.rate === r);
  });
  if (!on) liveStatus(0);
}
export function liveRenderKeyRec() {
  const b = $('#lvKeyRec');
  if (!b) return;
  const st = lvStyle();
  b.textContent = '';
  b.append(el('small', {}, 'Try'));
  st.keys.forEach(([pc, why]) => {
    const m = lvModeFam(st.scale);
    const on = LV.key === pc && LV.mode === m;
    b.append(
      el('button', { class: 'lvkr' + (on ? ' on' : ''), title: why, onclick: () => liveKeyCue(pc, m) }, NK(pc, m))
    );
  });
}
export function liveRenderCards() {
  const c = $('#lvCards');
  c.textContent = '';
  LV.scenes.forEach((sc, i) =>
    c.append(
      el(
        'div',
        {
          class: 'lvTile' + (LV.edIdx === i ? ' editing' : '') + (lvIsFlash(sc) ? ' flash' : ''),
          id: 'lvCard' + i,
          role: 'button',
          tabindex: 0,
          style: '--c:' + (lvIsFlash(sc) ? LV_FLASHC : lvScCol(sc.e, 55)),
          onclick: e => {
            if (e.target.closest('.lvEdit')) return;
            liveCue(i);
          },
          onkeydown: e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              liveCue(i);
            }
          },
          title: lvIsFlash(sc)
            ? 'Flash: a quick break on the next bar, then straight back into the loop'
            : 'Cue this scene'
        },
        el(
          'button',
          {
            class: 'lvEdit',
            title: 'Edit this scene: name, length, energy, parts and moves',
            onclick: e => {
              e.stopPropagation();
              liveEditScene(i);
            }
          },
          '✎'
        ),
        el('span', { class: 'ln' }, i + 1 + '. ' + sc.name),
        el(
          'span',
          { class: 'lvmap' },
          ...Array.from({ length: 8 }, (_, t) => {
            const c = sc.cells[t],
              C = TRACK_COLORS[t],
              part = c && c.play && c.play !== 'all';
            return el('i', {
              class: devOn(t) ? '' : 'devoff',
              style: c
                ? 'background:' + (part ? 'repeating-linear-gradient(90deg,' + C + ' 0 3px,transparent 3px 6px)' : C)
                : '',
              title:
                S.tracks[t].name +
                (c ? (part ? ' · ' + (LV_PLAY.find(x => x[0] === c.play) || ['', ''])[1].toLowerCase() : '') : ' · off')
            });
          })
        ),
        el('span', { class: 'le' }, el('i', { style: 'width:' + sc.e * 10 + '%' })),
        lvIsFlash(sc)
          ? el(
              'small',
              {},
              '⚡ ' +
                (FLASH_RH.find(x => x[0] === sc.rh) || [0, 'Flash'])[1] +
                ' · ' +
                sc.bars +
                (sc.bars === 1 ? ' bar' : ' bars') +
                ', then back'
            )
          : el(
              'small',
              {},
              sc.bars +
                (sc.bars === 1 ? ' bar' : ' bars') +
                ' · ' +
                Object.keys(sc.cells).length +
                ' parts' +
                ((sc.fx || (sc.kind === 'build' ? 'build' : 'none')) !== 'none'
                  ? ' · ' + (LV_SCFX.find(x => x[0] === (sc.fx || 'build')) || ['', ''])[1].split(' (')[0]
                  : '')
            ),
        el('span', { class: 'lq', id: 'lvCardQ' + i })
      )
    )
  );
}
function lvActKind(a) {
  if (!a) return '';
  const k = a.split(':')[0];
  return (
    {
      sw: 'Swap',
      mu: 'Mute',
      mt: 'Mute',
      fill: 'Fill',
      brk: 'Break',
      stut: 'Stutter',
      rise: 'Riser',
      bd: 'Drop',
      key: 'Key',
      en: 'Energy',
      auto: 'Auto',
      sc: 'Scatter',
      next: 'Scene',
      prev: 'Scene',
      stop: 'Stop'
    }[k] || (/^s\d$/.test(a) ? (lvIsFlash(LV.scenes[+a.slice(1)]) ? 'Flash' : 'Scene ' + (+a.slice(1) + 1)) : '')
  );
}
export function liveRenderPads() {
  const g = $('#lvPads');
  if (!g) return;
  g.textContent = '';
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 8; c++) {
      const i = lvPadIndex(r, c),
        a = LV.acts[i],
        kk = LV_KEYROWS[Math.floor(i / 8)][i % 8].toUpperCase();
      const nn = LV.padNotes[i],
        learnMe = LV.learn === i || (LV.learn === 'p1' && i === 0),
        fn = LV.padLayout === 'kbd' && i >= 8 ? LV_TOPFN[i - 8] : null;
      const where =
        nn == null
          ? fn
            ? 'the MC-707 ' + fn + ' button does not send a note, so use the screen or key'
            : 'no MIDI note'
          : 'MIDI note ' + nn + ' (' + noteLbl(nn) + ')';
      const b = el(
        'button',
        {
          class: 'lvPad' + (nn == null ? ' nonote' : '') + (learnMe ? ' learnme' : ''),
          id: 'lvPad' + i,
          style: '--c:' + actColor(a),
          title: 'Pad ' + (i + 1) + ' · ' + where + ' · key ' + kk
        },
        el('span', { class: 'pk' }, lvActKind(a)),
        el('b', {}, actLabel(a)),
        el('span', { class: 'pf' }, el('i', { class: 'pn' }, fn || ''), el('kbd', {}, kk))
      );
      b.addEventListener('pointerdown', ev => {
        if (ev.button === 2) return;
        ev.preventDefault();
        try {
          b.setPointerCapture(ev.pointerId);
        } catch (_) {}
        livePadDown(i);
      });
      b.addEventListener('pointerup', () => livePadUp(i));
      b.addEventListener('pointercancel', () => livePadUp(i));
      g.append(b);
    }
  $('#lvPadHint').textContent =
    (LV.learn === 'p1'
      ? 'Press pad 1 (top left) on the MC-707 now. '
      : LV.padLayout === 'kbd'
        ? 'Laid out like the MC-707 pads in keyboard mode. '
        : 'Pads 1–8 on top, 9–16 below, like the ' + DEVS[DEV].name + '. ') +
    'Click, press the key shown, or hit the pad on the ' +
    DEVS[DEV].name +
    ' (' +
    (LV.padCh ? 'channel ' + LV.padCh : 'any channel') +
    '). Cues wait for the launch point.';
}
export function liveRenderPerf() {
  const k = $('#lvKeys'),
    m = $('#lvMutes');
  if (!k) return;
  k.textContent = '';
  m.textContent = '';
  NOTEN.forEach((n, i) =>
    k.append(
      el(
        'button',
        {
          class: 'lvK' + (n.length > 1 ? ' blk' : '') + (LV.key === i ? ' on' : ''),
          id: 'lvK' + i,
          onclick: () => liveKeyCue(i),
          title: 'Change key to ' + n + ' (MIDI note ' + (LV.keyBase + i) + ')'
        },
        n
      )
    )
  );
  S.tracks.forEach((t, i) =>
    m.append(
      el(
        'button',
        {
          class: 'lvM' + (devOn(i) ? '' : ' devoff'),
          id: 'lvM' + i,
          style: '--c:' + TRACK_COLORS[i],
          onclick: () => liveMute([i]),
          title: 'Mute or unmute ' + t.name + ' (MIDI note ' + (LV.muteBase + i) + ')'
        },
        el('i', { class: 'vu', id: 'lvVu' + i }),
        el('span', {}, t.name)
      )
    )
  );
  $('#lvPerfHint').textContent = LV.perfOn
    ? 'First octave (' +
      noteLbl(LV.keyBase) +
      '–' +
      noteLbl(LV.keyBase + 11) +
      ') changes the key of every melodic part. Second octave (' +
      noteLbl(LV.muteBase) +
      '–' +
      noteLbl(LV.muteBase + 7) +
      ') mutes and unmutes parts.'
    : 'Key and mute keys are switched off in the mapping panel.';
}
export function liveRenderKnobs() {
  const kb = $('#lvKnobs');
  if (!kb) return;
  kb.textContent = '';
  ['FILTER', 'MOD', 'FX', 'SOUND'].forEach((n, i) =>
    kb.append(
      el(
        'div',
        { class: 'lvKnob' },
        el(
          'span',
          { class: 'lvKh' },
          n,
          el('b', { id: 'lvKv' + i }),
          el(
            'button',
            {
              class: 'lvkz',
              title: 'Back to rest (' + LV.rest[i] + ')',
              'aria-label': n + ' back to rest',
              onclick: () => sendKnob(i, LV.rest[i])
            },
            '↺'
          )
        ),
        el('input', {
          type: 'range',
          id: 'lvKn' + i,
          min: 0,
          max: 127,
          value: LV.knobs[i],
          'aria-label': n,
          oninput: e => sendKnob(i, +e.target.value),
          ondblclick: () => sendKnob(i, LV.rest[i]),
          title:
            'CC ' +
            (80 + i) +
            '. Rests at ' +
            LV.rest[i] +
            ' (the white tick). The coloured bar shows how far it is from rest; the orange marker is the MC-707 knob. Double-click or ↺ to go back to rest.'
        }),
        el('i', { class: 'lvkf' }),
        el('i', { class: 'lvkRest' }),
        el('i', { class: 'lvki', id: 'lvKi' + i })
      )
    )
  );
  for (let i = 0; i < 4; i++) knobUI(i, LV.knobs[i]);
  const kt = $('#lvKT');
  if (kt) {
    kt.textContent = '';
    [
      ['all', 'All tracks'],
      ['drums', 'Drums'],
      ['tone', 'Tone parts']
    ].forEach(([v, l]) => kt.append(el('option', { value: v }, l)));
    S.tracks.forEach((t, i) => kt.append(el('option', { value: i }, t.name)));
    kt.value = String(LV.ktarget);
  }
  const sg = $('#lvScG');
  if (sg) {
    sg.textContent = '';
    for (let i = 0; i < 16; i++) {
      const b = el(
        'button',
        {
          class: 'lvScB',
          id: 'lvSc' + i,
          title: 'Scatter pad ' + (i + 1) + ' (MIDI note ' + (LV.scBase + i) + ' on the control channel)'
        },
        String(i + 1)
      );
      b.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        try {
          b.setPointerCapture(ev.pointerId);
        } catch (_) {}
        scatter(i, true);
      });
      b.addEventListener('pointerup', () => scatter(i, false));
      b.addEventListener('pointercancel', () => scatter(i, false));
      sg.append(b);
    }
  }
  const sh = $('#lvScHint');
  if (sh)
    sh.textContent =
      'Sends notes ' +
      LV.scBase +
      '–' +
      (LV.scBase + 15) +
      ' on control channel ' +
      (S.ctrlCh || 16) +
      '. Turn Scatter on in the MC-707.';
}
