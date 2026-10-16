// The groove pack: for every genre, chords, basslines, pads, leads and arps on modal progressions
// (Dorian vamps, Mixolydian and Lydian lifts, Phrygian and harmonic-minor darkness, blues) in each
// genre's groovy keys and rhythms, plus four new drum grooves per genre. Parts on one progression
// share its name, so Live Mode keeps them together.
//
// Reads: FAC.
import { NOTE_NAMES } from '../core/theory.js';
import { D, FAC } from './factory.js';
import { BS_RH, CH_RH, GDRUMS, GPROGS, GSET, GSTYLES, LD_RH, MODE, QUAL } from './groove-data.js';

let seed = 20261015 ^ 0x9e37;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const hum = v => Math.max(1, Math.min(127, Math.round(v + (rnd() - 0.5) * 8)));
const r4 = x => Math.round(x * 10000) / 10000;
const clampN = (n, lo, hi) => {
  while (n < lo) n += 12;
  while (n > hi) n -= 12;
  return n;
};

/** The progression laid out in steps: [{s, e, pc, q}] with each chord's root pitch class. */
function lay(prog, R) {
  let at = 0;
  return prog[2].map(([off, q, d]) => {
    const g = { s: Math.round(at * 16), e: Math.round((at + d) * 16), pc: (R + off) % 12, q };
    at += d;
    return g;
  });
}
const segAt = (sg, s) => sg.find(g => s >= g.s && s < g.e) || sg[sg.length - 1];
const segNext = (sg, g) => sg[(sg.indexOf(g) + 1) % sg.length];

/** A close chord voicing around middle C that moves as little as possible from the last one. */
function voice(g, prev, lo = 55, hi = 74, power) {
  const iv = power ? [0, 7, 12] : QUAL[g.q].slice(0, 4).map(x => x % 12);
  let best = null,
    bd = 1e9;
  for (let base = lo - 12; base <= hi; base++) {
    if (base % 12 !== g.pc) continue;
    const notes = power
      ? iv.map(x => base + x)
      : [...new Set(iv.map(x => clampN(base + x, base, base + 11)))].sort((a, b) => a - b);
    for (let inv = 0; inv < notes.length; inv++) {
      const v = notes.map((n, i) => (i < inv ? n + 12 : n)).sort((a, b) => a - b);
      if (v[0] < lo || v[v.length - 1] > hi + 2) continue;
      const d = prev
        ? v.reduce((a, n, i) => a + Math.abs(n - (prev[i] ?? prev[prev.length - 1])), 0)
        : Math.abs(v[0] - 60);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
  }
  return best || iv.map(x => 60 + g.pc + x);
}
/** Lay a one-bar rhythm over the progression: each hit plays the chord sounding then, cut at a change. */
function hitsOver(sg, bars, rh, make) {
  const out = [];
  for (let b = 0; b < bars; b++)
    for (const [s, l, ...rest] of rh) {
      const at = b * 16 + s,
        g = segAt(sg, at);
      out.push(...make(g, at, Math.max(0.5, Math.min(l, g.e - at)), rest, b));
    }
  return out;
}

function chordsPart(sg, bars, rh, power) {
  const V = new Map();
  let prev = null;
  sg.forEach(g => {
    prev = voice(g, prev, power ? 50 : 55, power ? 64 : 74, power);
    V.set(g, prev);
  });
  return hitsOver(sg, bars, rh, (g, at, l, [v]) => V.get(g).map(n => ({ s: at, l, n, v: hum(v) })));
}
function bassTone(g, tok, sg, R) {
  const base = 33 + ((g.pc - 9 + 12) % 12),
    q = QUAL[g.q];
  const t =
    tok === 'R'
      ? base
      : tok === '5'
        ? base + 7
        : tok === '8'
          ? base + 12
          : tok === '3'
            ? base + q[1]
            : tok === '7'
              ? base + (q[3] != null && q[3] < 12 ? q[3] : 10)
              : tok === 'b'
                ? base + (q.includes(11) ? 11 : 10)
                : tok === '6'
                  ? base + 9
                  : tok === '4'
                    ? base + 5
                    : null;
  if (t != null) return clampN(t, 28, 55);
  /* an approach note: a half step under the next chord's root (a whole step when the chord repeats) */
  const n = segNext(sg, g),
    nb = 33 + ((n.pc - 9 + 12) % 12);
  return clampN(n.pc === g.pc ? base - 2 : nb - 1, 28, 55);
}
function bassPart(sg, bars, rh, R) {
  return hitsOver(sg, bars, rh, (g, at, l, [tok, v]) => [{ s: at, l, n: bassTone(g, tok, sg, R), v: hum(v) }]);
}
function padPart(sg) {
  const out = [];
  let prev = null;
  for (const g of sg) {
    const q = QUAL[g.q];
    const low = clampN(48 + g.pc, 45, 56);
    const up = q.slice(1).map(x => x % 12);
    const v = voice({ pc: (g.pc + up[0]) % 12, q: 'M' }, null);
    const tones = [...new Set(up.map(x => clampN(60 + ((g.pc + x) % 12), 60, 76)))].sort((a, b) => a - b);
    const pick = prev
      ? tones.map(n => (Math.abs(n + 12 - prev[0]) < Math.abs(n - prev[0]) && n + 12 <= 79 ? n + 12 : n))
      : tones;
    prev = pick.length ? pick : v;
    [low, ...pick].forEach(n => out.push({ s: g.s, l: g.e - g.s, n, v: hum(74) }));
  }
  return out;
}
/** Notes of the mode from the key's root in a register: [midi]. */
const scaleIn = (R, mode, lo, hi) => {
  const sc = MODE[mode].sc,
    out = [];
  for (let n = lo; n <= hi; n++) if (sc.includes((((n - R) % 12) + 12) % 12)) out.push(n);
  return out;
};
function leadPart(sg, bars, R, mode, rh) {
  const notes = scaleIn(R, mode, 64, 86),
    color = (R + MODE[mode].color) % 12;
  const near = (n, set) => set.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a), set[0]);
  const chordTones = g => notes.filter(n => QUAL[g.q].some(x => (g.pc + x) % 12 === n % 12));
  let cur = near(74, chordTones(sg[0]));
  const motif = [];
  const out = [];
  for (let b = 0; b < bars; b++) {
    const call = b % 2 === 0,
      last = b === bars - 1,
      hits = (call ? rh[0] : rh[1]).filter(h => !last || h[0] < 12);
    hits.forEach(([s, l], i) => {
      const at = b * 16 + s,
        g = segAt(sg, at),
        ct = chordTones(g);
      if (call && b > 0 && motif[i] != null) {
        /* the call comes back, moved onto this bar's chord */
        cur = notes[Math.max(0, Math.min(notes.length - 1, notes.indexOf(near(cur, notes)) + motif[i]))];
        if (s % 4 === 0) cur = near(cur, ct);
      } else if (s % 4 === 0 || i === 0) cur = near(cur + (rnd() < 0.5 ? 2 : -2), ct);
      else {
        const idx = notes.indexOf(near(cur, notes)),
          step =
            rnd() < 0.2
              ? notes.findIndex(n => n % 12 === color && Math.abs(n - cur) < 7) - idx
              : [1, -1, 2, -1, 1, -2][Math.floor(rnd() * 6)];
        const ni = Math.max(0, Math.min(notes.length - 1, idx + (Number.isFinite(step) ? step : 1)));
        if (b === 0) motif[i] = ni - idx;
        cur = notes[ni];
      }
      if (b === 0 && motif[i] == null) motif[i] = 0;
      out.push({ s: at, l: Math.min(l, bars * 16 - at), n: cur, v: hum(s % 4 === 0 ? 98 : 86) });
    });
    if (last) {
      const g = segAt(sg, b * 16 + 12);
      out.push({ s: b * 16 + 12, l: 4, n: near(cur, chordTones(g)), v: hum(92) });
    }
  }
  return out;
}
function arpPart(sg, bars, rate) {
  const step = rate === 't8' ? 4 / 3 : rate === 8 ? 2 : 1,
    out = [];
  let prev = null;
  const V = new Map();
  sg.forEach(g => {
    prev = voice(g, prev, 60, 76);
    V.set(g, prev);
  });
  const shape = [0, 1, 2, 3, 2, 1];
  let i = 0;
  for (let s = 0; s < bars * 16 - 0.01; s += step, i++) {
    const g = segAt(sg, s),
      v = V.get(g),
      up = [...v, v[0] + 12],
      n = up[shape[i % shape.length] % up.length];
    out.push({ s: r4(s), l: r4(step * 0.9), n, v: hum(i % (rate === 't8' ? 3 : 4) === 0 ? 96 : 78) });
  }
  return out;
}

/* ---- build the pack ---- */
const SCALE_OF = m => (m === 'blues' ? 'minor pent' : m);
for (const g of Object.keys(GSET)) {
  const set = GSET[g],
    sty = GSTYLES[g],
    notFor = g === 'hiphop' ? ['trap', 'drill'] : null,
    styles = notFor ? sty.filter(s => !notFor.includes(s)) : sty.slice();
  let uid = 0;
  const push = o =>
    FAC.push({
      id: 'gp-' + g + '-' + uid++,
      type: 'tone',
      genre: g,
      bpm: null,
      styles,
      gen: true,
      ...(notFor ? { notFor } : {}),
      ...o
    });
  GPROGS.filter(p => p[4].split(' ').includes(g)).forEach((p, pi) => {
    const [name, bars, , mode] = p,
      R = set.keys[pi % set.keys.length][0],
      sg = lay(p, R),
      keyName = NOTE_NAMES[R] + ' ' + SCALE_OF(mode),
      K = { key: { root: R, scale: SCALE_OF(mode) }, keyName },
      tag = set.tag + ' ',
      suf = bars === 2 ? ' 2-bar' : '',
      notes = list => list.map(n => ({ ...n, s: r4(n.s), l: r4(n.l) })).sort((a, b) => a.s - b.s || a.n - b.n);
    const rh = CH_RH[set.ch];
    ['Groove', 'Push'].forEach((lab, v) =>
      push({
        name: tag + 'Chords: ' + name + suf + ' (' + lab + ')',
        bars,
        notes: notes(chordsPart(sg, bars, rh[v], set.ch === 'power8')),
        ...K,
        role: 'Chords',
        pool: 'chords',
        lively: v === 0
      })
    );
    ['Groove', 'Walk'].forEach((lab, v) =>
      push({
        name: tag + 'Bass: ' + name + suf + ' (' + lab + ')',
        bars,
        notes: notes(bassPart(sg, bars, BS_RH[set.bs][v], R)),
        ...K,
        role: 'Bass',
        pool: 'bass',
        lively: v === 1
      })
    );
    push({
      name: tag + 'Pad: ' + name + suf + ' (Warm)',
      bars,
      notes: notes(padPart(sg)),
      ...K,
      role: 'Pad',
      pool: 'pad'
    });
    push({
      name: tag + 'Lead: ' + name + suf + ' (' + mode + ' hook)',
      bars,
      notes: notes(leadPart(sg, bars, R, mode, LD_RH[set.ld])),
      ...K,
      role: 'Lead',
      pool: 'lead',
      lively: true
    });
    push({
      name: tag + 'Arp: ' + name + suf + ' (' + (set.ar === 't8' ? 'triplets' : set.ar === 8 ? '8ths' : '16ths') + ')',
      bars,
      notes: notes(arpPart(sg, bars, set.ar)),
      ...K,
      role: 'Lead',
      pool: 'pluck',
      lively: true
    });
  });
  for (const [nm, bars, lanes, st] of GDRUMS[g])
    FAC.push({
      id: 'gp-' + g + '-k' + uid++,
      name: set.tag + ' Groove: ' + nm,
      type: 'drum',
      genre: g,
      bpm: set.bpm,
      bars,
      notes: D(bars, lanes).notes,
      key: null,
      keyName: '',
      role: 'Full kit',
      styles: st || sty.slice(),
      pool: 'kit',
      gen: true,
      lively: true
    });
}
