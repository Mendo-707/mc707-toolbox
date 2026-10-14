// Bringing patterns in: MIDI file import with a review step, and new or blank patterns.
//
// Reads: S, UI, FAC, bw.
// Calls up the layers through hooks (core/hooks.js).
import { $, clamp, el, toast } from '../core/dom.js';
import { FAC } from '../library/factory.js';
import { S, UI, addPattern, curClip, pushUndo, scheduleSave } from '../core/state.js';
import { bw, renderArr, selectClip } from './arrangement.js';
import { placeClip } from '../core/song-model.js';
import { renderEditor } from './editor.js';
import { cmMarks } from '../services/clip-switch.js';
import { renderLibrary } from './library-panel.js';
import { posBarNow } from './clip-ops.js';
import { hooks } from '../core/hooks.js';

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
          hooks.syncControls();
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
export function clearTrack(t) {
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
export function randomLibPattern(type, filter) {
  const pool = FAC.filter(f => f.type === type && (!filter || filter(f)));
  return pool[Math.floor(Math.random() * pool.length)];
}
