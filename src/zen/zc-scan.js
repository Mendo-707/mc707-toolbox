// Scene finder: a read-only scan of the MC-707's memory, to find where scenes and the scene chain are
// kept (not documented; Roland's MV-1 database has 8 scenes of 8 clip numbers in its project block, the
// MC-707 has 128 since version 1.50 and a scene chain since 1.71). Scan, change one thing on the
// MC-707, scan again: the bytes that changed are listed, to copy into a report.
//
// Only read requests (RQ1) go to the MC-707.
// Owns: the scans of this session (kept in memory).
import { el, toast } from '../core/dom.js';
import { DEVS, DEV } from '../core/device.js';
import { ZX, hexAddr, lin, zxConnect, zxRead } from './zc-sysex.js';
import { hooks } from '../core/hooks.js';

const BLOCK = 128;
/* read whole: the project block (scenes, chain lengths, tempo) and the system block at 00 00 00 00, each
   00 00 00 00 to .. 7F 7F (the scene chain's switch is not in the project block; Ada Locriana expects it
   low, in one of these two areas) */
const WHOLE = [
  { from: lin(0x10000000), blocks: 128, label: 'project' },
  { from: lin(0x00000000), blocks: 128, label: 'system' }
];
/* other places to try once, 16 bytes each: every 00 xx 00 00 and 10 xx 00 00, and the areas 01-1F */
function probes() {
  const p = [];
  for (let x = 1; x < 0x80; x++) {
    p.push({ at: x << 16, label: 'system ' + hexAddr(lin(x << 16)) });
    p.push({ at: 0x10000000 + (x << 16), label: 'project ' + hexAddr(lin(0x10000000 + (x << 16))) });
  }
  for (let h = 0x01; h <= 0x1f; h++) if (h !== 0x10) p.push({ at: h << 24, label: 'area ' + h.toString(16) });
  return p;
}
const hx = b => (b == null ? '--' : b.toString(16).padStart(2, '0').toUpperCase());

let regions = null;
const scans = [];

/**
 * One scan: the project block, plus the places that answered the first time (found on the first scan).
 * @param {(text:string, f:number) => void} [onStep]
 * @returns {Promise<Map<number, number>>} linear address → byte, for everything that answered
 */
export async function scanOnce(onStep, ms = 300) {
  if (!(await zxConnect())) return new Map();
  if (!regions) {
    regions = [...WHOLE];
    const p = probes();
    for (let i = 0; i < p.length; i++) {
      if (onStep) onStep('Looking for other areas: ' + p[i].label, i / p.length);
      /* a strict read: only a reply for this very address counts, so a late packet is not taken for one */
      const r = await zxRead(lin(p[i].at), 16, ms);
      if (Array.isArray(r) && r.length) regions.push({ from: lin(p[i].at), blocks: 8, label: p[i].label });
    }
  }
  const mem = new Map(),
    total = regions.reduce((n, r) => n + r.blocks, 0);
  let done = 0;
  for (const r of regions)
    for (let b = 0; b < r.blocks; b++, done++) {
      if (onStep) onStep('Reading ' + r.label + ' ' + hexAddr(r.from + b * BLOCK), done / total);
      const at = r.from + b * BLOCK,
        got = await zxRead(at, BLOCK, ms, true);
      if (Array.isArray(got)) got.forEach((v, i) => mem.set(at + i, v));
    }
  return mem;
}
/** The bytes that differ between two scans, as lines "10 00 0A 45: 7F → 04" (runs of changed bytes joined). */
export function scanDiff(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y),
    out = [];
  let run = null;
  for (const k of keys) {
    const x = a.get(k),
      y = b.get(k);
    if (x === y) continue;
    if (run && k === run.at + run.from.length) {
      run.from.push(x);
      run.to.push(y);
    } else {
      if (run) out.push(run);
      run = { at: k, from: [x], to: [y] };
    }
  }
  if (run) out.push(run);
  return out.map(r => hexAddr(r.at) + ': ' + r.from.map(hx).join(' ') + ' → ' + r.to.map(hx).join(' '));
}
/** A scan as runs of bytes: [{at: "10 00 00 00", hex: "4d 59 …"}], for the saved file. */
export function scanRuns(mem) {
  const keys = [...mem.keys()].sort((x, y) => x - y),
    out = [];
  let run = null;
  for (const k of keys) {
    if (!run || k !== run.at + run.b.length) {
      run = { at: k, b: [] };
      out.push(run);
    }
    run.b.push(mem.get(k));
  }
  return out.map(r => ({ at: hexAddr(r.at), hex: r.b.map(hx).join(' ') }));
}
const areaList = () =>
  regions.map(r => r.label + ' ' + hexAddr(r.from) + ' (' + r.blocks * BLOCK + ' bytes)').join('\n');

/** The Song menu's Find scene data: the steps to follow, Scan, and the changes found. */
export function sceneFinderOpen() {
  if (document.getElementById('sfOv')) return;
  const name = DEVS[DEV].name;
  const out = el('pre', { class: 'sfOut' }, 'No scans yet.'),
    status = el('div', { class: 'hint', role: 'status', 'aria-live': 'polite' }, ''),
    fill = el('i', {}),
    bar = el('div', { class: 'wpBar' }, fill);
  let log = [];
  const show = () => (out.textContent = log.join('\n') || 'No scans yet.');
  const scan = el(
    'button',
    {
      type: 'button',
      class: 'btn on',
      onclick: async () => {
        if (!(await zxConnect())) return toast('The ' + name + ' is not connected (or MIDI with SysEx is not allowed)');
        scan.disabled = true;
        const n = scans.length + 1;
        try {
          const mem = await scanOnce((t, f) => {
            status.textContent = 'Scan ' + n + ': ' + t;
            fill.style.width = Math.round(f * 100) + '%';
          });
          scans.push(mem);
          if (n === 1) log.push('Scan 1: ' + mem.size + ' bytes read from:\n' + areaList());
          else {
            const d = scanDiff(scans[n - 2], mem);
            log.push(
              '',
              'Scan ' + n + ' against scan ' + (n - 1) + ': ' + (d.length ? d.length + ' changes' : 'nothing changed'),
              ...d.slice(0, 300)
            );
            if (d.length > 300) log.push('… and ' + (d.length - 300) + ' more');
          }
          status.textContent =
            'Scan ' + n + ' done (' + mem.size + ' bytes). Now make the next change, then Scan again.';
          fill.style.width = '100%';
        } finally {
          scan.disabled = false;
          show();
        }
      }
    },
    'Scan'
  );
  const copy = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(out.textContent);
          toast('Copied: paste it into the chat');
        } catch (e) {
          toast('Could not copy: select the text and copy it');
        }
      }
    },
    'Copy results'
  );
  const save = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: () => {
        if (!scans.length) return toast('Scan first');
        const data = { saved: new Date().toISOString(), notes: out.textContent, scans: scans.map(scanRuns) };
        hooks.saveFile('mc707-scene-scans.json', JSON.stringify(data, null, 1));
      }
    },
    'Save scans to a file'
  );
  const close = () => ov.remove();
  const ov = el(
    'div',
    { id: 'sfOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Find scene data' },
    el(
      'div',
      { class: 'ptBox', style: 'max-width:720px' },
      el('h3', {}, 'Find where the ' + name + ' keeps its scenes'),
      el(
        'p',
        { class: 'hint', style: 'line-height:1.45' },
        'Read-only: this only asks the ' +
          name +
          ' for data, it changes nothing. Stop playback first. The first scan takes about five minutes (it looks through the whole low address range), later ones one or two.'
      ),
      el(
        'ol',
        { class: 'hint sfSteps' },
        el('li', {}, 'Open the SCENE CHAIN screen (MUTE, then SHIFT + a step button) with CHAIN off. Press Scan.'),
        el('li', {}, 'Turn CHAIN on (C1). Press Scan.'),
        el('li', {}, 'Turn CHAIN off. Press Scan.'),
        el('li', {}, 'Turn CHAIN on again. Press Scan. Stay on that screen and touch nothing else between scans.'),
        el('li', {}, 'Press Save scans to a file (it goes to your Downloads), and Copy results into the chat.')
      ),
      el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, scan, copy, save),
      status,
      bar,
      out,
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Close')
      )
    )
  );
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  document.body.append(ov);
}
/* for the tests: forget the scans */
export function scanReset() {
  regions = null;
  scans.length = 0;
  ZX.log.length = 0;
}
