// The melodic pack: new pads, arps, leads and chord comping for every progression already in the
// library, so Live Mode and the song wizard have far more than the few rhythms the tone parts shared.
// Each progression's harmony is read from one of its own chord patterns (which notes sound on every
// 16th), and the new parts are built over it, so they are in key and change with the chords. Every
// part keeps its progression's name, length, key and styles, so Live Mode plays them together.
// Ids start with 'mx' and come after the harmony pack.
//
// Reads: FAC.
import { SCALES } from '../core/theory.js';
import { FAC } from './factory.js';
import { ARP_MASKS, COMPS, CONTOURS, LEAD_RHYTHMS, ORDERS, PADS, RATES } from './melodic-rhythms.js';

const PROG = /((?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3,}b?[ivIV]{1,3}[A-Za-z0-9]*)/;
const PER = { pad: 3, arp: 4, lead: 3, comp: 3 };

/**
 * Add the pack to the library. Called by finishLibrary() (pools.js): once after the harmony pack for every
 * genre, then again for a genre added later (Big Beat), with only that genre.
 * @param {string} [only]  just this genre's progressions
 */
export function addMelodicPack(only) {
  let seed = 20261019;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const groups = sourcesByProgression(only);
  const uid = {};
  for (const [, src] of groups) {
    const segs = harmony(src);
    if (!segs || segs.length < 2) continue;
    const g = src.genre,
      prog = PROG.exec(src.name)[1],
      base = {
        type: 'tone',
        genre: g,
        bpm: src.bpm ?? null,
        bars: src.bars,
        key: src.key,
        keyName: src.keyName,
        styles: src.styles || null,
        mx: true
      };
    const add = (role, pool, name, notes, lively) => {
      if (!notes.length) return;
      uid[g] = (uid[g] || 0) + 1;
      FAC.push({ ...base, id: 'mx' + g + uid[g], name: role + ': ' + name + ' ' + prog, notes, role, pool, lively });
    };
    const ctx = { segs, total: src.bars * 16, key: src.key, rnd };
    for (const p of pick(PADS, PER.pad, rnd)) add('Pad', 'pad', p[0], pad(ctx, p), false);
    for (const a of arpPicks(rnd)) add('Lead', 'pluck', 'Arp ' + a.name, arp(ctx, a), true);
    for (const l of leadPicks(rnd)) add('Lead', 'lead', l.name, lead(ctx, l), true);
    for (const c of pick(COMPS, PER.comp, rnd)) add('Chords', 'chords', c[0], comp(ctx, c[1]), true);
  }
}

/* one chord pattern per progression, length and key: the one that sounds most like block chords */
function sourcesByProgression(only) {
  const best = new Map();
  for (const f of FAC) {
    if (f.pool !== 'chords' || f.busy || f.mx || !f.key || !PROG.test(f.name) || (only && f.genre !== only)) continue;
    const k = f.genre + '|' + PROG.exec(f.name)[1] + '|' + f.bars + '|' + f.keyName;
    const onsets = new Set(f.notes.map(n => n.s)).size,
      score = f.notes.length / Math.max(1, onsets);
    if (!best.has(k) || score > best.get(k).score) best.set(k, { f, score });
  }
  return [...best].map(([k, v]) => [k, v.f]);
}
/* the harmony as segments {s, e, v: the notes sounding, low to high}; rests keep the last chord */
function harmony(f) {
  const total = f.bars * 16,
    segs = [];
  let last = null;
  for (let s = 0; s < total; s++) {
    const on = f.notes.filter(n => n.s <= s + 0.01 && n.s + n.l > s + 0.01).map(n => n.n);
    const v = on.length >= 3 ? [...new Set(on)].sort((a, b) => a - b) : last;
    if (!v) continue;
    const sig = v.join(',');
    if (segs.length && segs[segs.length - 1].sig === sig) segs[segs.length - 1].e = s + 1;
    else segs.push({ s, e: s + 1, v, sig });
    last = v;
  }
  if (!segs.length) return null;
  segs[0].s = 0;
  segs[segs.length - 1].e = total;
  return segs;
}
const pc = n => ((n % 12) + 12) % 12;
const segAt = (segs, s) => segs.find(g => s >= g.s && s < g.e) || segs[segs.length - 1];
/* the chord moved by octaves so its middle sits near `center` */
function around(v, center) {
  const m = v.reduce((a, b) => a + b, 0) / v.length,
    k = Math.round((center - m) / 12) * 12;
  return v.map(n => n + k);
}
function pick(list, n, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const chord = (notes, s, l, v, vel) => v.forEach((n, i) => notes.push({ s, l, n, v: i ? vel - 6 : vel }));

/* ---- pads ---- */
function pad(ctx, [, kind, opt]) {
  const { segs, total } = ctx,
    out = [];
  for (const g of segs) {
    const v = around(g.v, 58),
      len = g.e - g.s;
    if (kind === 'pulse' || kind === 'swell')
      for (let s = g.s, i = 0; s < g.e; s += opt, i++) {
        const vel = kind === 'swell' ? Math.round(44 + (56 * (s - g.s)) / Math.max(1, len)) : i % 2 ? 62 : 76;
        chord(out, s, Math.min(opt * 0.9, g.e - s), v, vel);
      }
    else if (kind === 'topline') {
      chord(out, g.s, len, v.slice(0, -1), 74);
      const top = v[v.length - 1],
        up = v[1] + 12;
      for (let s = g.s, i = 0; s < g.e; s += opt, i++)
        out.push({ s, l: Math.min(opt, g.e - s), n: i % 2 ? up : top, v: 72 });
    } else if (kind === 'wide') {
      out.push({ s: g.s, l: len, n: v[0] - 12, v: 78 });
      chord(
        out,
        g.s,
        len,
        v.slice(1).map(n => n + 12),
        70
      );
    } else if (kind === 'shimmer') {
      chord(out, g.s, len, v, 74);
      for (let s = g.s; s < g.e; s += opt) out.push({ s, l: Math.min(2, g.e - s), n: v[v.length - 1] + 12, v: 50 });
    } else if (kind === 'sus') {
      const third = v.findIndex(n => [3, 4].includes((((n - v[0]) % 12) + 12) % 12)),
        half = Math.max(1, Math.floor(len / 2));
      const sus = v.map((n, i) => (i === third ? v[0] + 5 + 12 * Math.floor((n - v[0]) / 12) : n));
      chord(out, g.s, half, sus, 74);
      chord(out, g.s + half, len - half, v, 72);
    }
  }
  if (kind === 'hits' || kind === 'gate') {
    const hits = [];
    for (let bar = 0; bar < total; bar += 16)
      if (kind === 'hits') opt.forEach(p => hits.push(bar + p));
      else [...opt].forEach((c, p) => c === 'x' && (p === 0 || opt[p - 1] !== 'x') && hits.push(bar + p));
    hits.forEach((s, i) => {
      let l = (hits[i + 1] ?? total) - s;
      if (kind === 'gate') {
        const p = s % 16;
        l = 0;
        while (p + l < 16 && opt[p + l] === 'x') l++;
      }
      chord(out, s, Math.max(1, l), around(segAt(segs, s).v, 58), kind === 'gate' ? 70 : 76);
    });
  }
  return out.filter(n => n.s < total).map(n => ({ ...n, l: Math.max(0.5, Math.min(n.l, total - n.s)) }));
}

/* ---- arps ---- */
function arpPicks(rnd) {
  const out = [];
  for (const o of pick(ORDERS, PER.arp, rnd)) {
    const r = RATES[Math.floor(rnd() * RATES.length)],
      m = ARP_MASKS[Math.floor(rnd() * ARP_MASKS.length)],
      oct = 1 + Math.floor(rnd() * 3);
    out.push({
      name: o[0] + ' ' + r[0] + (oct > 1 ? ' ' + oct + ' oct' : '') + (m ? ' gated' : ''),
      order: o[1],
      rate: r,
      mask: m,
      oct
    });
  }
  return out;
}
function seqIndex(order, i, N, state, rnd) {
  const P = Math.max(1, 2 * N - 2);
  switch (order) {
    case 'down':
      return N - 1 - (i % N);
    case 'updown':
      return i % P < N ? i % P : P - (i % P);
    case 'downup':
      return N - 1 - (i % P < N ? i % P : P - (i % P));
    case 'converge':
      return i % 2 ? N - 1 - ((i >> 1) % N) : (i >> 1) % N;
    case 'outside':
      return i % 2 ? (i >> 1) % N : N - 1 - ((i >> 1) % N);
    case 'thirds':
      return ((i >> 1) + (i % 2) * 2) % N;
    case 'pedal':
      return i % 2 ? 1 + ((i >> 1) % Math.max(1, N - 1)) : 0;
    case 'leap':
      return [0, 3, 1, 4, 2, 5][i % 6] % N;
    case 'walk':
      state.w = Math.max(0, Math.min(N - 1, (state.w ?? 0) + (rnd() < 0.5 ? -1 : 1)));
      return state.w;
  }
  return i % N;
}
function arp(ctx, a) {
  const { segs, total, rnd } = ctx,
    out = [],
    state = {};
  let i = 0;
  for (let s = 0; s < total - 0.01; s += a.rate[1]) {
    const pos = Math.floor(s + 1e-6) % 16;
    if (a.mask && a.mask[pos] !== 'x') {
      i++;
      continue;
    }
    const v = around(segAt(segs, s).v, 66),
      pool = [];
    for (let k = 0; k < a.oct; k++) v.forEach(n => pool.push(n + 12 * k));
    const n = pool[seqIndex(a.order, i++, pool.length, state, rnd)];
    out.push({
      s: Math.round(s * 1000) / 1000,
      l: Math.min(a.rate[2], total - s),
      n,
      v: pos % 4 === 0 ? 98 : pos % 2 ? 72 : 84
    });
  }
  return out;
}

/* ---- leads ---- */
function leadPicks(rnd) {
  return pick(LEAD_RHYTHMS, PER.lead, rnd).map(r => {
    const c = CONTOURS[Math.floor(rnd() * CONTOURS.length)];
    return { name: r[0] + ' ' + c[0].toLowerCase(), rhythm: r[1], contour: c[1] };
  });
}
function lead(ctx, L) {
  const { segs, total, key } = ctx,
    sc = SCALES[key.scale] || SCALES.minor,
    R = key.root,
    out = [];
  /* the scale as notes from G3 to C6, and the step nearest a note */
  const tones = [];
  for (let n = 55; n <= 84; n++) if (sc.includes((((n - R) % 12) + 12) % 12)) tones.push(n);
  const home = tones.reduce((b, n) => (Math.abs(n - (67 + R)) < Math.abs(b - (67 + R)) ? n : b), tones[0]);
  const hi = tones.indexOf(home);
  let k = 0;
  for (let block = 0; block < total; block += 32) {
    const lift = [0, 1, 0, -1][(block / 32) % 4];
    for (const [p, l] of L.rhythm) {
      const s = block + p;
      if (s >= total) continue;
      let n = tones[Math.max(0, Math.min(tones.length - 1, hi + L.contour[k++ % L.contour.length] + lift))];
      /* strong beats land on a note of the chord playing */
      const ct = segAt(segs, s).v.map(pc),
        isCt = x => ct.includes(pc(x));
      if (p % 4 === 0 && !isCt(n)) {
        let best = null;
        for (let d = 1; d <= 6 && best == null; d++) best = isCt(n - d) ? n - d : isCt(n + d) ? n + d : null;
        if (best != null) n = best;
      }
      /* a chord that borrows a note outside the key (the major V in a minor key): follow the chord */
      for (const d of [-1, 1]) if (!isCt(n) && isCt(n + d) && !sc.includes(pc(n + d - R))) n += d;
      out.push({ s, l: Math.min(l, total - s), n, v: p % 8 === 0 ? 100 : 86 });
    }
  }
  /* the phrase ends home: the last note is the key's root */
  if (out.length) {
    const last = out[out.length - 1];
    last.n = tones.reduce((b, n) => ((n - R) % 12 === 0 && Math.abs(n - last.n) < Math.abs(b - last.n) ? n : b), home);
  }
  return out;
}

/* ---- chord comping ---- */
function comp(ctx, cells) {
  const { segs, total } = ctx,
    out = [];
  for (let bar = 0; bar < total; bar += 16)
    for (const [p, l, push, mode] of cells) {
      const s = bar + p;
      if (s >= total) continue;
      let v = around(segAt(segs, push ? Math.min(total - 1, s + 2) : s).v, 62);
      if (mode === 'low') v = v.slice(0, 2);
      if (mode === 'high') v = v.slice(-3);
      const len = Math.min(l, total - s);
      if (mode === 'roll')
        v.forEach((n, i) => out.push({ s: s + i * 0.25, l: Math.max(0.5, len - i * 0.25), n, v: 90 - i * 4 }));
      else chord(out, s, len, v, p % 4 === 0 ? 96 : 86);
    }
  return out;
}
