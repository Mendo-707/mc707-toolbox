import { $, clamp, el, toast } from '../core/dom.js';
import { S, STORE, UI, fixState, pushUndo, replaceState, scheduleSave } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import { stopAll } from '../services/transport.js';
import { afterReplaceKeepUndo, closePops } from './controls.js';
import { setMidiIn } from './setup-wizard.js';
import { recKey } from '../song/recording-midi.js';
import { closeXpose, openXpose } from '../song/transpose.js';
import { LV } from '../live/state.js';
import { ctlAttach } from '../live/controller.js';

/* ---- saved songs ---- */
const SLOT_KEY = 'mc707-song-slots';
function readSlots() {
  try {
    return JSON.parse(localStorage.getItem(SLOT_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}
function writeSlots(o) {
  try {
    localStorage.setItem(SLOT_KEY, JSON.stringify(o));
    return true;
  } catch (e) {
    toast('Could not save: browser storage is full');
    return false;
  }
}
function renderSlots() {
  const host = $('#slotList');
  if (!host) return;
  host.textContent = '';
  const slots = readSlots();
  const names = Object.keys(slots).sort((a, b) => slots[b].saved - slots[a].saved);
  if (!names.length) {
    host.append(el('div', { class: 'hint' }, 'No saved songs yet.'));
    return;
  }
  names.forEach(n => {
    const d = new Date(slots[n].saved);
    let armed = 0;
    const del = el(
      'button',
      {
        class: 'btn sm',
        title: 'Delete this saved song',
        onclick: () => {
          if (!armed) {
            armed = 1;
            del.textContent = 'Sure?';
            setTimeout(() => {
              armed = 0;
              del.textContent = '✕';
            }, 2500);
            return;
          }
          const o = readSlots();
          delete o[n];
          writeSlots(o);
          renderSlots();
        }
      },
      '✕'
    );
    host.append(
      el(
        'div',
        { class: 'slot' },
        el(
          'span',
          { class: 'sn' },
          n,
          el(
            'small',
            {},
            d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          )
        ),
        el('button', { class: 'btn sm', onclick: () => loadSlot(n) }, 'Load'),
        del
      )
    );
  });
}
function saveSlot() {
  const name = ($('#slotName').value || '').trim().slice(0, 40) || 'Song ' + new Date().toLocaleDateString();
  const o = readSlots();
  const had = !!o[name];
  o[name] = { saved: Date.now(), data: JSON.stringify(S) };
  if (writeSlots(o)) {
    renderSlots();
    toast((had ? 'Updated "' : 'Saved "') + name + '"');
  }
}
function loadSlot(n) {
  const o = readSlots();
  if (!o[n]) return;
  try {
    const s = JSON.parse(o[n].data);
    if (!s || s.v !== 1 || !Array.isArray(s.tracks)) throw 0;
    pushUndo();
    stopAll();
    replaceState(fixState(s));
    UI.sel = null;
    afterReplaceKeepUndo();
    closePops();
    toast('Loaded "' + n + '"');
  } catch (e) {
    toast('That saved song could not be loaded');
  }
}
export function refreshIns() {
  const sel = $('#midiIn');
  if (!sel) return;
  const ins = MIDI.access ? [...MIDI.access.inputs.values()] : [];
  sel.textContent = '';
  sel.append(el('option', { value: '' }, 'No input'));
  ins.forEach(i => sel.append(el('option', { value: i.id }, i.name)));
  const pick = ins.find(i => i.id === S.midiIn) || ins.find(i => /MC-?707/i.test(i.name));
  if (pick) {
    sel.value = pick.id;
    if (!MIDI.inp || MIDI.inp.id !== pick.id) setMidiIn(pick.id);
  } else sel.value = '';
  if (LV.ctl && LV.ctl.map && typeof ctlAttach === 'function') ctlAttach();
}
export function syncExtra() {
  const o = $('#midiOff');
  if (o && document.activeElement !== o) o.value = S.midiOffset || 0;
  const t = $('#songTr');
  if (t) t.value = S.transpose || 0;
  const xb = $('#bXpose');
  if (xb) xb.textContent = 'Transpose' + (S.transpose ? ' (' + (S.transpose > 0 ? '+' : '') + S.transpose + ')' : '');
}
export function initMore() {
  const tr = $('#songTr');
  for (let v = -12; v <= 12; v++) tr.append(el('option', { value: v }, (v > 0 ? '+' : '') + v + ' semitones'));
  $('#midiIn').addEventListener('change', e => setMidiIn(e.target.value));
  $('#midiOff').addEventListener('change', e => {
    S.midiOffset = clamp(Math.round(+e.target.value) || 0, -200, 200);
    syncExtra();
    scheduleSave();
  });
  tr.addEventListener('change', e => {
    S.transpose = +e.target.value;
    scheduleSave();
  });
  let rs = 0;
  $('#fReset').addEventListener('click', e => {
    const b = e.target;
    if (!rs) {
      rs = 1;
      b.textContent = 'Click again to confirm';
      setTimeout(() => {
        rs = 0;
        b.textContent = 'Reset autosave and reload';
      }, 3000);
      return;
    }
    try {
      localStorage.removeItem(STORE);
    } catch (err) {}
    location.reload();
  });
  $('#bXpose').addEventListener('click', () => openXpose());
  $('#xpose').addEventListener('pointerdown', e => {
    if (e.target.id === 'xpose') closeXpose();
  });
  $('#bHelp').addEventListener('click', e => {
    e.stopPropagation();
    const h = $('#helpPop').hidden;
    closePops();
    $('#helpPop').hidden = !h;
  });
  $('#bFile').addEventListener('click', renderSlots);
  $('#slotSave').addEventListener('click', saveSlot);
  $('#slotName').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') saveSlot();
  });
  addEventListener('keyup', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '')) return;
    recKey(e, false);
  });
  syncExtra();
  renderSlots();
}
