// MIDI export: builds a .mid with every track (and one per track) and saves it, in a zip when there
// are several files.
//
// Reads: S.
// Calls up the layers through hooks (core/hooks.js).
import { clamp, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { CRC_T } from '../core/crc.js';
import { envInterp, velMul } from '../services/mc-controls.js';
import { hooks } from '../core/hooks.js';

/* ---------- export ---------- */
export let DL = null;
export function setDownloads(v) {
  DL = v;
}
export async function saveFile(name, data) {
  if (!DL) {
    try {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Saved ' + name);
      hooks.closePops();
    } catch (e) {
      toast('Could not save the file');
    }
    return;
  }
  try {
    await DL.save({ filename: name, data });
    toast('Saved ' + name);
    hooks.closePops();
  } catch (err) {
    if (!err || err.code !== 'declined') toast('Could not save: ' + ((err && err.code) || 'error'));
  }
}
const vlq = n => {
  const b = [n & 127];
  n >>= 7;
  while (n > 0) {
    b.unshift((n & 127) | 128);
    n >>= 7;
  }
  return b;
};
function trackEvents(ti) {
  const out = [];
  const t = S.tracks[ti];
  const sc = t.vol / 100;
  for (const c of S.clips.filter(c => c.t === ti)) {
    const p = S.patterns[c.pat];
    if (!p || c.mute) continue;
    const L = (c.ll || p.bars) * 16,
      total = c.len * 16;
    for (let base = -c.off * 16; base < total; base += L) {
      for (const n of p.notes) {
        if (n.s >= L) continue;
        const s = base + n.s;
        if (s < 0 || s >= total) continue;
        out.push({
          s: c.start * 16 + s,
          l: Math.min(n.l, total - s),
          pitch: t.type === 'drum' ? S.drumMap[n.n] : clamp(n.n + (c.tr || 0) + (S.transpose || 0), 0, 127),
          vel: clamp(
            Math.round(((n.v * sc * (c.vel || 100)) / 100) * (c.fi || c.fo || c.ve ? velMul(c, s / 16) : 1)),
            1,
            127
          )
        });
      }
    }
  }
  return out;
}
export function buildMidi(only) {
  const PPQ = 480,
    ST = PPQ / 4;
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255],
    u16 = n => [(n >> 8) & 255, n & 255];
  const str = s => [...s].map(ch => ch.charCodeAt(0) & 127);
  const chunk = evs => {
    evs.sort((a, b) => a.t - b.t || a.o - b.o);
    let last = 0;
    const d = [];
    for (const e of evs) {
      d.push(...vlq(e.t - last), ...e.b);
      last = e.t;
    }
    d.push(0, 0xff, 0x2f, 0);
    return [...str('MTrk'), ...u32(d.length), ...d];
  };
  const tempo = Math.round(60000000 / S.bpm);
  const tracks = [
    chunk([
      {
        t: 0,
        o: 0,
        b: [
          0xff,
          0x03,
          ...(() => {
            const n = str('Song Mode');
            return [n.length, ...n];
          })()
        ]
      },
      { t: 0, o: 0, b: [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] },
      { t: 0, o: 0, b: [0xff, 0x58, 4, 4, 2, 24, 8] },
      ...(S.markers || [])
        .filter(m => m.bpm)
        .map(m => {
          const tp = Math.round(60000000 / m.bpm);
          return { t: m.bar * 16 * ST, o: 0, b: [0xff, 0x51, 3, (tp >> 16) & 255, (tp >> 8) & 255, tp & 255] };
        }),
      ...(S.markers || []).map(m => ({
        t: m.bar * 16 * ST,
        o: 0,
        b: [
          0xff,
          0x06,
          ...(() => {
            const nm = str(m.name);
            return [nm.length, ...nm];
          })()
        ]
      }))
    ])
  ];
  const list = only === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [only];
  for (const ti of list) {
    const t = S.tracks[ti];
    const ch = t.ch - 1;
    const nm = str(t.name);
    const evs = [{ t: 0, o: 0, b: [0xff, 0x03, nm.length, ...nm] }];
    for (const e of trackEvents(ti)) {
      evs.push(
        { t: Math.round(e.s * ST), o: 1, b: [0x90 | ch, e.pitch, e.vel] },
        { t: Math.round((e.s + e.l) * ST), o: 0, b: [0x80 | ch, e.pitch, 0] }
      );
    }
    for (const cl of S.clips.filter(c => c.t === ti && c.cc && c.cc.pts && c.cc.pts.length && !c.mute)) {
      let last = -1;
      for (let st = 0; st <= Math.round(cl.len * 16); st++) {
        const v = Math.round(clamp(envInterp(cl.cc.pts, st / (cl.len * 16), 0.5), 0, 1) * 127);
        if (v !== last) {
          last = v;
          evs.push({ t: Math.round((cl.start * 16 + st) * ST), o: 0.5, b: [0xb0 | ch, cl.cc.n, v] });
        }
      }
    }
    tracks.push(chunk(evs));
  }
  const head = [...str('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(PPQ)];
  return new Uint8Array([...head, ...tracks.flat()]);
}
const crc32 = u => {
  let c = 0xffffffff;
  for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
export function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [],
    central = [];
  let offset = 0;
  const d = new Date();
  const dt = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  const tm = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const w16 = (a, n) => a.push(n & 255, (n >> 8) & 255),
    w32 = (a, n) => a.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const len = f.data.length;
    const lh = [];
    w32(lh, 0x04034b50);
    w16(lh, 20);
    w16(lh, 0x0800);
    w16(lh, 0);
    w16(lh, tm);
    w16(lh, dt);
    w32(lh, crc);
    w32(lh, len);
    w32(lh, len);
    w16(lh, name.length);
    w16(lh, 0);
    parts.push(new Uint8Array(lh), name, f.data);
    const ch = [];
    w32(ch, 0x02014b50);
    w16(ch, 20);
    w16(ch, 20);
    w16(ch, 0x0800);
    w16(ch, 0);
    w16(ch, tm);
    w16(ch, dt);
    w32(ch, crc);
    w32(ch, len);
    w32(ch, len);
    w16(ch, name.length);
    w16(ch, 0);
    w16(ch, 0);
    w16(ch, 0);
    w16(ch, 0);
    w32(ch, 0);
    w32(ch, offset);
    central.push(new Uint8Array(ch), name);
    offset += lh.length + name.length + len;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = [];
  w32(end, 0x06054b50);
  w16(end, 0);
  w16(end, 0);
  w16(end, files.length);
  w16(end, files.length);
  w32(end, csize);
  w32(end, offset);
  w16(end, 0);
  return new Blob([...parts, ...central, new Uint8Array(end)]);
}
