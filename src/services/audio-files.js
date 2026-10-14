// Audio file writers: WAV and MP3 encoders and a zip writer for several files.
import { CRC_T } from '../core/crc.js';

const crcAdd = (c, u) => {
  for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8);
  return c;
};
/** A WAV writer: push(L, R, from, to) stereo Float32 samples, then finish() returns {blob, size, crc, ext, frames}. */
export function wavEncoder(sr, bits) {
  const parts = [];
  let frames = 0;
  return {
    push(L, R, a, b) {
      const n = b - a;
      if (bits === 16) {
        const o = new Int16Array(n * 2);
        for (let i = 0; i < n; i++) {
          let x = L[a + i];
          x = x < -1 ? -1 : x > 1 ? 1 : x;
          o[2 * i] = x < 0 ? x * 32768 : x * 32767;
          x = R[a + i];
          x = x < -1 ? -1 : x > 1 ? 1 : x;
          o[2 * i + 1] = x < 0 ? x * 32768 : x * 32767;
        }
        parts.push(new Uint8Array(o.buffer));
      } else {
        const o = new Uint8Array(n * 6);
        let p = 0;
        for (let i = 0; i < n; i++) {
          for (const arr of [L, R]) {
            let x = arr[a + i];
            x = x < -1 ? -1 : x > 1 ? 1 : x;
            const v = Math.round(x < 0 ? x * 8388608 : x * 8388607);
            o[p++] = v & 255;
            o[p++] = (v >> 8) & 255;
            o[p++] = (v >> 16) & 255;
          }
        }
        parts.push(o);
      }
      frames += n;
    },
    finish() {
      const bytes = frames * 2 * (bits / 8);
      const h = new ArrayBuffer(44);
      const dv = new DataView(h);
      const w = (o, s) => {
        for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
      };
      w(0, 'RIFF');
      dv.setUint32(4, 36 + bytes, true);
      w(8, 'WAVE');
      w(12, 'fmt ');
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, 2, true);
      dv.setUint32(24, sr, true);
      dv.setUint32(28, sr * 2 * (bits / 8), true);
      dv.setUint16(32, 2 * (bits / 8), true);
      dv.setUint16(34, bits, true);
      w(36, 'data');
      dv.setUint32(40, bytes, true);
      const hb = new Uint8Array(h);
      let crc = crcAdd(0xffffffff, hb);
      parts.forEach(p => {
        crc = crcAdd(crc, p);
      });
      crc = (crc ^ 0xffffffff) >>> 0;
      return {
        blob: new Blob([hb, ...parts], { type: 'audio/wav' }),
        size: 44 + bytes,
        crc,
        ext: 'wav',
        frames
      };
    }
  };
}
/** An MP3 writer with the same interface as wavEncoder (needs loadLame() first). */
export function mp3Encoder(sr, kbps) {
  const e = new lamejs.Mp3Encoder(2, sr, kbps);
  const parts = [];
  let frames = 0;
  const keep = out => {
    if (out && out.length) {
      const u = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) u[i] = out[i];
      parts.push(u);
    }
  };
  return {
    push(L, R, a, b) {
      const n = b - a;
      const l = new Int16Array(n),
        r = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        let x = L[a + i];
        x = x < -1 ? -1 : x > 1 ? 1 : x;
        l[i] = x < 0 ? x * 32768 : x * 32767;
        x = R[a + i];
        x = x < -1 ? -1 : x > 1 ? 1 : x;
        r[i] = x < 0 ? x * 32768 : x * 32767;
      }
      keep(e.encodeBuffer(l, r));
      frames += n;
    },
    finish() {
      keep(e.flush());
      let size = 0,
        crc = 0xffffffff;
      parts.forEach(p => {
        size += p.length;
        crc = crcAdd(crc, p);
      });
      crc = (crc ^ 0xffffffff) >>> 0;
      return { blob: new Blob(parts, { type: 'audio/mpeg' }), size, crc, ext: 'mp3', frames };
    }
  };
}
let LAME_P = null;
/** Load the MP3 encoder (lamejs) on first use. @returns {Promise<void>} */
export function loadLame() {
  if (window.lamejs) return Promise.resolve();
  if (!LAME_P)
    LAME_P = new Promise((res, rej) => {
      const srcs = (window.toolbox && window.toolbox.isApp ? ['node_modules/lamejs/lame.min.js'] : []).concat([
        'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js'
      ]);
      const tryNext = i => {
        if (i >= srcs.length) {
          LAME_P = null;
          rej(new Error('Could not load the MP3 encoder (it needs an internet connection). Use WAV instead.'));
          return;
        }
        const s = document.createElement('script');
        s.src = srcs[i];
        s.onload = () => (window.lamejs ? res() : rej(new Error('The MP3 encoder did not start. Use WAV instead.')));
        s.onerror = () => {
          s.remove();
          tryNext(i + 1);
        };
        document.head.append(s);
      };
      tryNext(0);
    });
  return LAME_P;
}
/** A zip (no compression) of [{name, blob, size, crc}] entries. @returns {Blob} */
export function makeZip2(entries) {
  const enc = new TextEncoder();
  const parts = [],
    central = [];
  let offset = 0;
  const d = new Date();
  const dt = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  const tm = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const w16 = (a, n) => a.push(n & 255, (n >> 8) & 255),
    w32 = (a, n) => a.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
  for (const f of entries) {
    const name = enc.encode(f.name);
    const lh = [];
    w32(lh, 0x04034b50);
    w16(lh, 20);
    w16(lh, 0x0800);
    w16(lh, 0);
    w16(lh, tm);
    w16(lh, dt);
    w32(lh, f.crc);
    w32(lh, f.size);
    w32(lh, f.size);
    w16(lh, name.length);
    w16(lh, 0);
    parts.push(new Uint8Array(lh), name, f.blob);
    const ch = [];
    w32(ch, 0x02014b50);
    w16(ch, 20);
    w16(ch, 20);
    w16(ch, 0x0800);
    w16(ch, 0);
    w16(ch, tm);
    w16(ch, dt);
    w32(ch, f.crc);
    w32(ch, f.size);
    w32(ch, f.size);
    w16(ch, name.length);
    w16(ch, 0);
    w16(ch, 0);
    w16(ch, 0);
    w16(ch, 0);
    w32(ch, 0);
    w32(ch, offset);
    central.push(new Uint8Array(ch), name);
    offset += lh.length + name.length + f.size;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = [];
  w32(end, 0x06054b50);
  w16(end, 0);
  w16(end, 0);
  w16(end, entries.length);
  w16(end, entries.length);
  w32(end, csize);
  w32(end, offset);
  w16(end, 0);
  return new Blob([...parts, ...central, new Uint8Array(end)], { type: 'application/zip' });
}
