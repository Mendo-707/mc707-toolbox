import { $, clamp, el, toast } from '../core/dom.js';
import { FAC } from '../library/factory.js';
import { devOn } from '../core/device.js';
import { S, UI, addPattern, pushUndo, scheduleSave } from '../core/state.js';
import { bw, dupClip, placeSrc, renderArr, selectClip } from './arrangement.js';
import { MAXBARS, curClip, patOf, placeClip, songEnd } from '../core/song-model.js';
import { ED, renderEditor } from './editor.js';
import { ensureAudio } from '../services/synth.js';
import { audition, startPat } from '../services/transport.js';
import { cmMarks, cmPickItems, devNm, setClipMark } from '../clips/clip-map.js';
import { clipMapOpen } from '../clips/clips-screen.js';
import { FAVS, auditionLib, itemStyles, keyLabel, quickAdd, renderLibrary, saveFavs } from './library-panel.js';
import { syncControls } from './controls.js';
import { facById } from '../library/index.js';
import { STYLES } from '../library/styles.js';
import {
  CLIPB,
  blkLabel,
  clipBlock,
  clipHasBlocks,
  copyClipTo,
  deleteClipById,
  editBlock,
  glueClips,
  glueRun,
  loopClip,
  makeUnique,
  newPatternAt,
  pasteClip,
  playFrom,
  posBarNow,
  setClipLen,
  setClipTr,
  setClipboard,
  setCursor,
  setLoop,
  splitClip,
  updLoopUI
} from './clip-ops.js';
import { addMarker, loopSection } from './markers.js';
import { openXpose } from './transpose.js';
import { q16 } from './layout.js';
import { openMctl, quickFade } from './automation.js';
import { rangeMenuItems } from './structure.js';

/* ---------- external patterns: new, blank, and MIDI import ---------- */
const GMDRUM = {
  35: 0,
  36: 0,
  37: 1,
  38: 2,
  40: 2,
  39: 3,
  42: 4,
  44: 4,
  46: 5,
  41: 6,
  43: 6,
  45: 7,
  47: 7,
  48: 8,
  50: 8,
  49: 9,
  52: 9,
  55: 9,
  57: 9,
  51: 10,
  53: 10,
  59: 10,
  56: 11
};
function parseMidiFile(u) {
  let p = 0;
  const r32 = () => ((u[p++] << 24) | (u[p++] << 16) | (u[p++] << 8) | u[p++]) >>> 0,
    r16 = () => (u[p++] << 8) | u[p++];
  const tag = () => String.fromCharCode(u[p++], u[p++], u[p++], u[p++]);
  if (u.length < 14 || tag() !== 'MThd') throw new Error('Not a MIDI file');
  const hl = r32();
  r16();
  const ntr = r16(),
    div = r16();
  p = 8 + hl;
  if (div & 0x8000) throw new Error('SMPTE timing is not supported');
  const out = { ppq: div || 480, tempo: null, groups: [] };
  for (let ti = 0; ti < ntr && p < u.length; ti++) {
    const ty = tag(),
      len = r32();
    const end = Math.min(u.length, p + len);
    if (ty !== 'MTrk') {
      p = end;
      continue;
    }
    let t = 0,
      run = 0,
      name = '';
    const open = new Map(),
      notes = [];
    const vl = () => {
      let v = 0,
        b;
      do {
        b = u[p++];
        v = v * 128 + (b & 127);
      } while (b & 128 && p < end);
      return v;
    };
    while (p < end) {
      t += vl();
      let st = u[p];
      if (st === 0xff) {
        p++;
        const m = u[p++],
          l = vl();
        if (m === 3 && !name && l < 200)
          name = String.fromCharCode(...u.slice(p, p + l))
            .replace(/[^\x20-\x7e]/g, '')
            .trim();
        if (m === 0x51 && l === 3 && out.tempo == null)
          out.tempo = Math.round(60000000 / ((u[p] << 16) | (u[p + 1] << 8) | u[p + 2]));
        p += l;
        if (m === 0x2f) break;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) {
        p++;
        p += vl();
        continue;
      }
      if (st & 0x80) {
        run = st;
        p++;
      } else st = run;
      const k = st & 0xf0,
        ch = st & 15;
      let a = u[p++],
        b = 0;
      if (k !== 0xc0 && k !== 0xd0) b = u[p++];
      if (k === 0x90 && b > 0) open.set(ch * 128 + a, { t, v: b });
      else if (k === 0x80 || (k === 0x90 && b === 0)) {
        const o = open.get(ch * 128 + a);
        if (o) {
          notes.push({ t: o.t, d: Math.max(1, t - o.t), n: a, v: o.v, ch });
          open.delete(ch * 128 + a);
        }
      }
    }
    open.forEach((o, key) => notes.push({ t: o.t, d: out.ppq / 4, n: key % 128, v: o.v, ch: Math.floor(key / 128) }));
    const byCh = new Map();
    notes.forEach(n => {
      if (!byCh.has(n.ch)) byCh.set(n.ch, []);
      byCh.get(n.ch).push(n);
    });
    byCh.forEach((ns, ch) => out.groups.push({ name, ch, notes: ns }));
  }
  return out;
}
function midiPartToNotes(part, ppq, type) {
  const k = 4 / ppq,
    seen = new Set(),
    notes = [];
  part.notes
    .sort((a, b) => a.t - b.t)
    .forEach(n => {
      const s = Math.round(n.t * k);
      if (s >= 16 * 32) return;
      const nn = type === 'drum' ? (GMDRUM[n.n] !== undefined ? GMDRUM[n.n] : 11) : n.n;
      const l = type === 'drum' ? 1 : Math.max(1, Math.round(n.d * k));
      const key = s + ':' + nn;
      if (seen.has(key)) return;
      seen.add(key);
      notes.push({ s, l: Math.min(l, 16 * 32 - s), n: nn, v: clamp(n.v, 1, 127) });
    });
  const bars = clamp(Math.ceil(notes.reduce((m, n) => Math.max(m, n.s + n.l), 1) / 16), 1, 32);
  return { notes, bars };
}
async function readMidiFiles(files) {
  const items = [];
  let bad = 0;
  const list = [...files].filter(f => /\.(mid|midi)$/i.test(f.name)).slice(0, 300);
  for (const f of list) {
    try {
      const m = parseMidiFile(new Uint8Array(await f.arrayBuffer()));
      const base = f.name.replace(/\.(mid|midi)$/i, '');
      const gs = m.groups.filter(g => g.notes.length);
      if (!gs.length) {
        bad++;
        continue;
      }
      const parts = gs.map((g, i) => {
        const drum = g.ch === 9 || /drum|kit|perc|beat/i.test(g.name);
        return {
          name: (gs.length === 1 ? base : g.name || base + ' ' + (i + 1)).slice(0, 40),
          type: drum ? 'drum' : 'tone',
          ch: g.ch,
          notes: g.notes,
          on: true
        };
      });
      items.push({ file: f.name, ppq: m.ppq, tempo: m.tempo, parts });
    } catch (e) {
      bad++;
    }
  }
  return { items, bad, skipped: files.length - list.length };
}
function modalBox(title, build) {
  return new Promise(res => {
    const back = el('div', {
      style:
        'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px'
    });
    const close = v => {
      back.remove();
      removeEventListener('keydown', kd, true);
      res(v);
    };
    const kd = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(null);
      }
    };
    addEventListener('keydown', kd, true);
    const box = el(
      'div',
      {
        role: 'dialog',
        'aria-modal': 'true',
        style:
          'background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:16px;width:min(560px,100%);max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:12px'
      },
      el(
        'div',
        { style: 'display:flex;align-items:center;justify-content:space-between' },
        el('b', { style: 'font-size:16px' }, title),
        el('button', { class: 'btn sm', onclick: () => close(null), 'aria-label': 'Close' }, '✕')
      )
    );
    build(box, close);
    back.append(box);
    back.addEventListener('mousedown', e => {
      if (e.target === back) close(null);
    });
    document.body.append(back);
  });
}
function trackOptsFor(sel, type, want) {
  sel.textContent = '';
  S.tracks.forEach((t, i) => {
    if (t.type === type) sel.append(el('option', { value: i, selected: i === want }, i + 1 + '. ' + t.name));
  });
}
function placeBarFor(t, mode) {
  if (mode === 'end') return S.clips.filter(c => c.t === t).reduce((m, c) => Math.max(m, c.start + c.len), 0);
  return Math.max(0, Math.floor(posBarNow()));
}
function showClipBar(c) {
  const a = $('#arr');
  if (a && (c.start * bw < a.scrollLeft || c.start * bw > a.scrollLeft + a.clientWidth - 80))
    a.scrollLeft = Math.max(0, (c.start - 1) * bw);
}
function pickFiles(folder) {
  return new Promise(res => {
    const i = el('input', {
      type: 'file',
      multiple: true,
      accept: folder ? null : '.mid,.midi,audio/midi',
      style: 'display:none'
    });
    if (folder) {
      i.webkitdirectory = true;
    }
    i.addEventListener('change', () => {
      res([...i.files]);
      i.remove();
    });
    i.addEventListener('cancel', () => {
      res([]);
      i.remove();
    });
    document.body.append(i);
    i.click();
  });
}
export async function importMidiFiles(files) {
  const { items, bad, skipped } = await readMidiFiles(files);
  if (!items.length) {
    toast(bad ? 'No readable notes in those files' : 'No MIDI files found (.mid or .midi)');
    return;
  }
  await reviewImport(items, bad, skipped);
}
function reviewImport(items, bad, skipped) {
  const all = items.flatMap(it => it.parts.map(p => ({ ...p, it })));
  const many = all.length > 8;
  return modalBox('Load patterns', (box, close) => {
    const dest = el(
      'select',
      { 'aria-label': 'Where to put them' },
      el('option', { value: 'place' }, 'Place on tracks at the playhead'),
      el('option', { value: 'lib' }, 'Add to the Project library only')
    );
    dest.value = many ? 'lib' : 'place';
    const trk = el(
      'select',
      { 'aria-label': 'Track' },
      el('option', { value: 'auto' }, 'Auto'),
      ...S.tracks.map((t, i) => el('option', { value: i }, i + 1 + '. ' + t.name))
    );
    const tempo = items.find(x => x.tempo);
    const tempoCk = tempo && !S.clips.length ? el('input', { type: 'checkbox', checked: true }) : null;
    const rows = el('div', {
      style:
        'display:flex;flex-direction:column;gap:4px;max-height:42vh;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px'
    });
    all.forEach(p => {
      const ck = el('input', {
        type: 'checkbox',
        checked: true,
        onchange: () => {
          p.on = ck.checked;
          upd();
        }
      });
      const nm = el('input', {
        type: 'text',
        value: p.name,
        maxlength: 40,
        style: 'flex:1;min-width:0',
        oninput: () => {
          p.name = nm.value;
        }
      });
      const ty = el(
        'select',
        {
          onchange: () => {
            p.type = ty.value;
            upd();
          }
        },
        el('option', { value: 'drum' }, 'Drums'),
        el('option', { value: 'tone' }, 'Tones')
      );
      ty.value = p.type;
      const info = el('span', { class: 'hint', style: 'min-width:92px;text-align:right' });
      p.upd = () => {
        const r = midiPartToNotes(p, p.it.ppq, p.type);
        p.res = r;
        info.textContent = r.notes.length + ' notes · ' + r.bars + (r.bars === 1 ? ' bar' : ' bars');
      };
      p.upd();
      rows.append(el('div', { style: 'display:flex;gap:6px;align-items:center' }, ck, nm, ty, info));
    });
    const sum = el('div', { class: 'hint' });
    const upd = () => {
      all.forEach(p => p.upd());
      const n = all.filter(p => p.on).length;
      sum.textContent =
        n +
        ' of ' +
        all.length +
        ' selected' +
        (bad ? ' · ' + bad + ' file' + (bad > 1 ? 's' : '') + ' could not be read' : '') +
        (skipped ? ' · ' + skipped + ' non-MIDI file' + (skipped > 1 ? 's' : '') + ' skipped' : '');
      go.disabled = !n;
    };
    const go = el(
      'button',
      {
        class: 'btn on',
        onclick: () => {
          const pick = all.filter(p => p.on);
          if (!pick.length) return;
          pushUndo();
          if (tempoCk && tempoCk.checked && tempo.tempo) S.bpm = clamp(tempo.tempo, 40, 240);
          const place = dest.value === 'place';
          const bar = Math.max(0, Math.floor(posBarNow()));
          const rot = { drum: 0, tone: 0 };
          let last = null,
            placed = 0;
          pick.forEach(p => {
            const r = p.res;
            const pid = addPattern(p.type, p.name || 'Imported', r.bars, r.notes, {
              key: null,
              file: p.it.file
            });
            if (!place) return;
            const pool = S.tracks.map((t, i) => i).filter(i => S.tracks[i].type === p.type);
            let t = null;
            if (
              trk.value !== 'auto' &&
              S.tracks[+trk.value].type === p.type &&
              !p.usedSel &&
              !pick.some(q => q !== p && q.usedSel && q.type === p.type)
            ) {
              t = +trk.value;
              p.usedSel = true;
            }
            if (t == null) {
              const free = pool.filter(
                i => !S.clips.some(c => c.t === i && c.start < bar + r.bars && c.start + c.len > bar)
              );
              t = (free.length ? free : pool)[rot[p.type]++ % (free.length ? free.length : pool.length)];
            }
            last = placeClip(t, bar, pid, r.bars);
            placed++;
          });
          close(true);
          if (place && last) {
            selectClip(last.id);
            showClipBar(last);
          }
          UI.libTab = 'proj';
          if (!place) {
            $('#main').classList.remove('nolib');
            $('#bLibT').classList.add('on');
          }
          renderArr();
          renderEditor();
          renderLibrary();
          syncControls();
          scheduleSave();
          toast(
            place
              ? 'Placed ' + placed + (placed === 1 ? ' pattern' : ' patterns') + ' at bar ' + (bar + 1)
              : 'Added ' + pick.length + ' to the Project library. Drag them onto a track.'
          );
        }
      },
      'Load'
    );
    box.append(
      el(
        'div',
        { class: 'hint' },
        items.length +
          (items.length === 1 ? ' file' : ' files') +
          ', ' +
          all.length +
          (all.length === 1 ? ' part' : ' parts') +
          '. Notes are snapped to 16th steps. Drum parts are mapped to the kit lanes.'
      ),
      rows,
      el(
        'div',
        { style: 'display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center' },
        el('label', { class: 'lvf' }, 'Put them', dest),
        el('label', { class: 'lvf' }, 'Track', trk),
        tempoCk ? el('label', { class: 'lvf' }, tempoCk, 'Set tempo to ' + tempo.tempo + ' BPM') : null
      ),
      sum,
      el(
        'div',
        { style: 'display:flex;gap:8px;justify-content:flex-end' },
        el('button', { class: 'btn', onclick: () => close(null) }, 'Cancel'),
        go
      )
    );
    upd();
  });
}
export async function openNewPat() {
  let kind = (() => {
    const c = curClip();
    return c && S.tracks[c.t].type === 'tone' ? 'tone' : 'drum';
  })();
  const picked = await modalBox('New pattern', (box, close) => {
    const kb = el('div', { style: 'display:flex;gap:6px' });
    const trk = el('select', { 'aria-label': 'Track' });
    const len = el(
      'select',
      { 'aria-label': 'Length' },
      ...[1, 2, 4, 8, 16].map(n =>
        el('option', { value: n, selected: n === (kind === 'drum' ? 1 : 2) }, n + (n === 1 ? ' bar' : ' bars'))
      )
    );
    const at = el(
      'select',
      { 'aria-label': 'Where' },
      el('option', { value: 'play' }, 'At the playhead'),
      el('option', { value: 'end' }, 'After the last clip')
    );
    const cc = curClip();
    const refresh = () => {
      kb.textContent = '';
      [
        ['drum', 'Drums'],
        ['tone', 'Tones']
      ].forEach(([v, l]) =>
        kb.append(
          el(
            'button',
            {
              class: 'btn' + (v === kind ? ' on' : ''),
              onclick: () => {
                kind = v;
                refresh();
              }
            },
            l
          )
        )
      );
      trackOptsFor(trk, kind, cc && S.tracks[cc.t].type === kind ? cc.t : S.tracks.findIndex(t => t.type === kind));
    };
    refresh();
    box.append(
      el(
        'div',
        {
          style:
            'display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:10px;padding:12px'
        },
        el('b', {}, 'Blank pattern'),
        kb,
        el(
          'div',
          { style: 'display:flex;flex-wrap:wrap;gap:8px 12px' },
          el('label', { class: 'lvf' }, 'Track', trk),
          el('label', { class: 'lvf' }, 'Length', len),
          el('label', { class: 'lvf' }, 'Place', at)
        ),
        el(
          'div',
          {},
          el(
            'button',
            {
              class: 'btn on',
              id: 'npCreate',
              onclick: () => {
                const t = +trk.value,
                  bars = +len.value;
                pushUndo();
                const pid = addPattern(kind, kind === 'drum' ? 'New beat' : 'New part', bars, [], {
                  key: null
                });
                const c = placeClip(t, placeBarFor(t, at.value), pid, bars);
                close(true);
                selectClip(c.id);
                showClipBar(c);
                renderArr();
                renderEditor();
                scheduleSave();
              }
            },
            'Create blank pattern'
          )
        )
      ),
      el(
        'div',
        {
          style:
            'display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:10px;padding:12px'
        },
        el('b', {}, 'Load from files'),
        el(
          'div',
          { class: 'hint' },
          'MIDI files (.mid) from your computer, a USB drive or any folder. You can also drop .mid files onto the arranger.'
        ),
        el(
          'div',
          { style: 'display:flex;flex-wrap:wrap;gap:8px' },
          el(
            'button',
            {
              class: 'btn on',
              id: 'npFiles',
              onclick: async () => {
                const f = await pickFiles(false);
                if (f.length) {
                  close(true);
                  importMidiFiles(f);
                }
              }
            },
            'Choose MIDI files…'
          ),
          el(
            'button',
            {
              class: 'btn',
              id: 'npFolder',
              onclick: async () => {
                const f = await pickFiles(true);
                if (f.length) {
                  close(true);
                  importMidiFiles(f);
                }
              }
            },
            'Load a whole folder…'
          )
        )
      ),
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end' },
        el(
          'button',
          {
            class: 'btn',
            onclick: () => {
              close(true);
              $('#main').classList.remove('nolib');
              $('#bLibT').classList.add('on');
              UI.libTab = 'fac';
              renderLibrary();
            }
          },
          'Browse the factory library'
        )
      )
    );
  });
  return picked;
}
function clearTrack(t) {
  pushUndo();
  S.clips = S.clips.filter(c => c.t !== t);
  S.clipMarks = cmMarks().filter(m => m.t !== t);
  if (UI.sel && !curClip()) {
    UI.sel = null;
  }
  renderArr();
  renderEditor();
  scheduleSave();
}
function randomLibPattern(type, filter) {
  const pool = FAC.filter(f => f.type === type && (!filter || filter(f)));
  return pool[Math.floor(Math.random() * pool.length)];
}
export function clipMenuItems(c) {
  const p = patOf(c);
  const isTone = p.type === 'tone';
  const others = S.tracks.map((x, i) => i).filter(i => S.tracks[i].type === p.type && i !== c.t);
  const shared = S.clips.filter(x => x.pat === c.pat).length > 1;
  const cur = Math.floor(posBarNow());
  return [
    { label: 'Open in editor', action: () => selectClip(c.id) },
    ...(clipHasBlocks(c) && UI.ctxBar != null
      ? (() => {
          const { a, b } = clipBlock(c, UI.ctxBar);
          const bar = UI.ctxBar;
          return [
            {
              label: 'Edit ' + blkLabel(a, b) + ' on its own',
              hint: 'Double-click',
              action: () => editBlock(c, bar)
            }
          ];
        })()
      : []),
    {
      label: 'Preview pattern',
      action: () => {
        selectClip(c.id);
        startPat(p, c.t, null);
      }
    },
    { label: 'Play from clip start', action: () => playFrom(c.start) },
    { label: 'Loop this clip', action: () => loopClip(c) },
    '-',
    {
      label: 'Mute clip',
      checked: !!c.mute,
      action: () => {
        pushUndo();
        c.mute = !c.mute;
        renderArr();
        scheduleSave();
      }
    },
    devOn(c.t)
      ? {
          label: devNm() + ' clip change at bar ' + (Math.floor(c.start) + 1),
          sub: cmPickItems(
            c.t,
            (cmMarks().find(m => m.t === c.t && m.bar === Math.floor(c.start)) || {}).k,
            k => setClipMark(c.t, c.start, k),
            'Back to automatic switching'
          )
        }
      : null,
    isTone ? { label: 'Transpose this clip’s range…', action: () => openXpose({ scope: 'clip' }) } : null,
    isTone
      ? {
          label: 'Transpose clip',
          sub: [
            { label: '+12 (octave up)', action: () => setClipTr(c, (c.tr || 0) + 12) },
            { label: '+7', action: () => setClipTr(c, (c.tr || 0) + 7) },
            { label: '+5', action: () => setClipTr(c, (c.tr || 0) + 5) },
            { label: '+1', action: () => setClipTr(c, (c.tr || 0) + 1) },
            { label: '−1', action: () => setClipTr(c, (c.tr || 0) - 1) },
            { label: '−5', action: () => setClipTr(c, (c.tr || 0) - 5) },
            { label: '−7', action: () => setClipTr(c, (c.tr || 0) - 7) },
            { label: '−12 (octave down)', action: () => setClipTr(c, (c.tr || 0) - 12) },
            '-',
            { label: 'Reset to 0', action: () => setClipTr(c, 0) }
          ]
        }
      : null,
    {
      label: 'Clip velocity',
      sub: [50, 75, 100, 125, 150].map(v => ({
        label: v + '%',
        checked: (c.vel || 100) === v,
        action: () => {
          pushUndo();
          if (v === 100) delete c.vel;
          else c.vel = v;
          renderArr();
          scheduleSave();
        }
      }))
    },
    {
      label: 'Clip length',
      sub: [
        [0.0625, '1 step'],
        [0.25, '1 beat'],
        [0.5, '1/2 bar'],
        [1, '1 bar'],
        [2, '2 bars'],
        [4, '4 bars'],
        [8, '8 bars'],
        [16, '16 bars']
      ]
        .map(([n, l]) => ({ label: l, checked: Math.abs(c.len - n) < 1e-6, action: () => setClipLen(c, n) }))
        .concat([
          '-',
          {
            label: 'Match pattern (' + p.bars + (p.bars === 1 ? ' bar' : ' bars') + ')',
            action: () => setClipLen(c, p.bars)
          },
          { label: 'Double', action: () => setClipLen(c, c.len * 2) },
          {
            label: 'Halve',
            disabled: c.len <= 0.125,
            action: () => setClipLen(c, Math.max(0.0625, q16(c.len / 2)))
          }
        ])
    },
    {
      label: 'Fades and automation',
      sub: [
        {
          label: 'Edit shape…',
          action: () => {
            selectClip(c.id);
            ED.mode = 'shape';
            renderEditor();
          }
        },
        '-',
        { label: 'Fade in: 1 beat', action: () => quickFade(c, 'fi', 4) },
        { label: 'Fade in: 1 bar', action: () => quickFade(c, 'fi', 16) },
        { label: 'Fade in: 2 bars', action: () => quickFade(c, 'fi', 32) },
        { label: 'Fade out: 1 beat', action: () => quickFade(c, 'fo', 4) },
        { label: 'Fade out: 1 bar', action: () => quickFade(c, 'fo', 16) },
        { label: 'Fade out: 2 bars', action: () => quickFade(c, 'fo', 32) },
        '-',
        {
          label: 'Clear fades and shapes',
          danger: true,
          action: () => {
            pushUndo();
            delete c.fi;
            delete c.fo;
            delete c.fcv;
            delete c.ve;
            delete c.cc;
            renderArr();
            renderEditor();
            scheduleSave();
          }
        }
      ]
    },
    '-',
    {
      label: 'Split at playhead',
      disabled: !(cur > c.start && cur < c.start + c.len),
      action: () => splitClip(c, cur)
    },
    (() => {
      const n = glueRun(c, 'next');
      return { label: 'Glue to the next clip', disabled: n.length < 2, action: () => glueClips(n) };
    })(),
    (() => {
      const a = glueRun(c, 'all');
      return a.length > 2
        ? { label: 'Glue all ' + a.length + ' touching clips', hint: 'G', action: () => glueClips(a) }
        : null;
    })(),
    {
      label: 'Duplicate after',
      hint: 'Ctrl+D',
      action: () => {
        selectClip(c.id);
        dupClip();
      }
    },
    others.length
      ? {
          label: 'Copy to track',
          sub: others.map(i => ({
            label: 'Track ' + (i + 1) + ': ' + S.tracks[i].name,
            action: () => copyClipTo(c, i)
          }))
        }
      : null,
    shared ? { label: 'Make unique', action: () => makeUnique(c) } : null,
    {
      label: 'Rename pattern',
      action: () => {
        selectClip(c.id);
        setTimeout(() => {
          const i = $('#edName');
          if (i) {
            i.focus();
            i.select();
          }
        }, 40);
      }
    },
    '-',
    {
      label: 'Copy clip',
      action: () => {
        setClipboard({ ...c });
        toast('Clip copied. Right-click a lane to paste.');
      }
    },
    {
      label: 'Cut clip',
      action: () => {
        setClipboard({ ...c });
        deleteClipById(c.id);
      }
    },
    { label: 'Delete clip', danger: true, hint: 'Del', action: () => deleteClipById(c.id) }
  ];
}
function libSubmenu(t, bar) {
  const type = S.tracks[t].type;
  const saved = [...FAVS]
    .map(k => k.split(':'))
    .filter(([kind, id]) => kind === 'fac' && facById(id) && facById(id).type === type)
    .slice(0, 10);
  const items = [
    {
      label: 'Random ' + (type === 'drum' ? 'drum' : 'tone') + ' pattern',
      action: () => {
        const f = randomLibPattern(type);
        if (f) placeSrc({ kind: 'fac', id: f.id }, t, bar);
      }
    }
  ];
  const st = S.tracks[t].type === 'tone' ? ['Bass', 'Chords', 'Pad', 'Lead'] : ['Full kit', 'Hats', 'Perc', 'Fill'];
  st.forEach(role =>
    items.push({
      label: 'Random ' + role.toLowerCase(),
      action: () => {
        const f = randomLibPattern(type, x => x.role === role);
        if (f) placeSrc({ kind: 'fac', id: f.id }, t, bar);
      }
    })
  );
  if (saved.length) {
    items.push('-');
    saved.forEach(([kind, id]) =>
      items.push({ label: '★ ' + facById(id).name, action: () => placeSrc({ kind: 'fac', id }, t, bar) })
    );
  }
  items.push('-', {
    label: 'Open library…',
    action: () => {
      UI.libType = type;
      $('#main').classList.remove('nolib');
      $('#bLibT').classList.add('on');
      renderLibrary();
    }
  });
  return items;
}
export function laneMenuItems(t, bar) {
  const tr = S.tracks[t];
  return [
    { label: 'New pattern here', action: () => newPatternAt(t, bar) },
    { label: 'Paste clip here', disabled: !CLIPB, action: () => pasteClip(t, bar) },
    { label: 'Add from library', sub: libSubmenu(t, bar) },
    devOn(t)
      ? {
          label: devNm() + ' clip change at bar ' + (Math.floor(bar) + 1),
          sub: cmPickItems(
            t,
            (cmMarks().find(m => m.t === t && m.bar === Math.floor(bar)) || {}).k,
            k => setClipMark(t, bar, k),
            'Back to automatic switching'
          )
        }
      : null,
    '-',
    { label: 'Play from here', action: () => playFrom(bar) },
    { label: 'Set playhead here', action: () => setCursor(bar) },
    { label: 'Loop starts here', action: () => setLoop(bar, Math.max(bar + 1, S.loop.end)) },
    { label: 'Loop ends after this bar', action: () => setLoop(Math.min(S.loop.start, bar), bar + 1) },
    { label: 'Loop 4 bars from here', action: () => setLoop(bar, bar + 4) },
    '-',
    {
      label: tr.mute ? 'Unmute track' : 'Mute track',
      action: () => {
        pushUndo();
        tr.mute = !tr.mute;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: tr.solo ? 'Unsolo track' : 'Solo track',
      action: () => {
        pushUndo();
        tr.solo = !tr.solo;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: 'Clear this track',
      danger: true,
      disabled: !S.clips.some(c => c.t === t),
      action: () => clearTrack(t)
    }
  ];
}
export function rulerMenuItems(bar) {
  const mi = S.markers
    .map((m, i) => i)
    .filter(i => S.markers[i].bar <= bar)
    .pop();
  return [
    { label: 'Add marker here', action: () => addMarker(bar) },
    { label: 'Transpose from here…', action: () => openXpose({ scope: 'from', fromBar: bar }) },
    { label: 'Range tools (loop range)', sub: rangeMenuItems(Math.floor(bar)) },
    mi !== undefined ? { label: 'Loop section “' + S.markers[mi].name + '”', action: () => loopSection(mi) } : null,
    '-',
    { label: 'Move playhead here', action: () => setCursor(bar) },
    { label: 'Play from here', action: () => playFrom(bar) },
    '-',
    { label: 'Loop starts here', action: () => setLoop(bar, Math.max(bar + 1, S.loop.end)) },
    { label: 'Loop ends after this bar', action: () => setLoop(Math.min(S.loop.start, bar), bar + 1) },
    {
      label: 'Loop from here',
      sub: [1, 2, 4, 8, 16, 32].map(n => ({
        label: n + (n === 1 ? ' bar' : ' bars'),
        action: () => setLoop(bar, bar + n)
      }))
    },
    { label: 'Loop the whole song', action: () => setLoop(0, Math.max(1, Math.ceil(songEnd()))) },
    {
      label: 'Loop off',
      disabled: !S.loop.on,
      action: () => {
        S.loop.on = false;
        updLoopUI();
        scheduleSave();
      }
    },
    '-',
    {
      label: 'Add 8 bars',
      action: () => {
        S.bars = Math.min(MAXBARS, S.bars + 8);
        syncControls();
        renderArr();
        scheduleSave();
      }
    }
  ];
}
export function trackMenuItems(t) {
  const tr = S.tracks[t];
  return [
    {
      label: tr.mute ? 'Unmute' : 'Mute',
      action: () => {
        pushUndo();
        tr.mute = !tr.mute;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: tr.solo ? 'Unsolo' : 'Solo',
      action: () => {
        pushUndo();
        tr.solo = !tr.solo;
        renderArr();
        scheduleSave();
      }
    },
    {
      label: 'Solo only this track',
      action: () => {
        pushUndo();
        S.tracks.forEach((x, i) => {
          x.solo = i === t;
        });
        renderArr();
        scheduleSave();
      }
    },
    {
      label: 'Clear all mute and solo',
      action: () => {
        pushUndo();
        S.tracks.forEach(x => {
          x.mute = false;
          x.solo = false;
        });
        renderArr();
        scheduleSave();
      }
    },
    '-',
    {
      label: 'MIDI channel',
      sub: Array.from({ length: 16 }, (_, i) => ({
        label: 'Channel ' + (i + 1),
        checked: tr.ch === i + 1,
        action: () => {
          pushUndo();
          tr.ch = i + 1;
          renderArr();
          scheduleSave();
        }
      }))
    },
    {
      label: 'Track velocity',
      sub: [50, 75, 90, 100, 110, 127].map(v => ({
        label: String(v),
        checked: tr.vol === v,
        action: () => {
          pushUndo();
          tr.vol = v;
          renderArr();
          scheduleSave();
        }
      }))
    },
    tr.type === 'tone'
      ? { label: 'Transpose this track…', action: () => openXpose({ scope: 'song', tracks: new Set([t]) }) }
      : null,
    { label: 'MIDI controls (CC)…', action: () => openMctl(t) },
    devOn(t) ? { label: devNm() + ' clips on this track…', action: () => clipMapOpen(t) } : null,
    devOn(t)
      ? {
          label: 'Remove this track’s clip changes',
          disabled: !cmMarks().some(m => m.t === t),
          action: () => {
            pushUndo();
            S.clipMarks = cmMarks().filter(m => m.t !== t);
            scheduleSave();
            renderArr();
          }
        }
      : null,
    {
      label: 'Timing nudge (ms)',
      sub: [-20, -10, -5, 0, 5, 10, 20].map(v => ({
        label: (v > 0 ? '+' : '') + v,
        checked: (tr.nudge || 0) === v,
        action: () => {
          pushUndo();
          tr.nudge = v;
          scheduleSave();
        }
      }))
    },
    {
      label: 'Humanize timing (ms)',
      sub: [0, 3, 6, 10, 15].map(v => ({
        label: v ? '±' + v : 'Off',
        checked: (tr.hum || 0) === v,
        action: () => {
          pushUndo();
          tr.hum = v;
          scheduleSave();
        }
      }))
    },
    {
      label: 'Send test note',
      action: () => {
        ensureAudio();
        audition(t, tr.type === 'drum' ? 0 : 60, 100);
      }
    },
    '-',
    {
      label: 'Select first clip',
      disabled: !S.clips.some(c => c.t === t),
      action: () => {
        const c = S.clips.filter(x => x.t === t).sort((a, b) => a.start - b.start)[0];
        if (c) selectClip(c.id);
      }
    },
    { label: 'Clear track', danger: true, disabled: !S.clips.some(c => c.t === t), action: () => clearTrack(t) }
  ];
}
export function libMenuItems(it) {
  const m = it.m;
  const src = { kind: it.kind, id: it.id };
  const fk = it.kind + ':' + it.id;
  const faved = FAVS.has(fk);
  const tracks = S.tracks.map((x, i) => i).filter(i => S.tracks[i].type === m.type);
  const styles = itemStyles(it);
  const k = keyLabel(m);
  return [
    { label: 'Preview', action: () => auditionLib(m) },
    {
      label: 'Preview on track…',
      sub: tracks.map(i => ({
        label: 'Track ' + (i + 1) + ': ' + S.tracks[i].name + ' (ch ' + S.tracks[i].ch + ')',
        action: () => auditionLib(m, i)
      }))
    },
    '-',
    { label: 'Add at playhead', action: () => quickAdd(src) },
    {
      label: 'Add to track at playhead',
      sub: tracks.map(i => ({
        label: 'Track ' + (i + 1) + ': ' + S.tracks[i].name,
        action: () => placeSrc(src, i, Math.floor(S.cursor))
      }))
    },
    {
      label: 'Tap a lane to place it',
      action: () => {
        UI.arm = src;
        renderLibrary();
        renderArr();
      }
    },
    '-',
    {
      label: faved ? 'Remove from Saved' : 'Save (★)',
      action: () => {
        if (faved) FAVS.delete(fk);
        else FAVS.add(fk);
        saveFavs();
        renderLibrary();
      }
    },
    styles.length
      ? {
          label: 'Show only this style',
          sub: styles.map(id => ({
            label: STYLES.find(s => s.id === id).name,
            action: () => {
              UI.libStyle = id;
              renderLibrary();
            }
          }))
        }
      : null,
    {
      label: 'Show same role (' + (m.role || (m.type === 'drum' ? 'Full kit' : 'Tone')) + ')',
      disabled: !m.role && m.type !== 'drum',
      action: () => {
        UI.libRole = m.role || 'Full kit';
        renderLibrary();
      }
    },
    k
      ? {
          label: 'Show same key (' + k + ')',
          action: () => {
            UI.libKey = k;
            renderLibrary();
          }
        }
      : null
  ];
}
