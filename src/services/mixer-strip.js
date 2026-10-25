// One channel strip for the mixers (Song Mode's and Live Mode's): the track's number, name and
// colour, an activity light that flickers with the notes going out, the track's four knobs (FILTER, MOD
// and FX above each MC-707 fader, and SOUND, the C4 knob KNOB ASSIGN lists with them), a tall level
// fader, pan, reverb and chorus sends, and mute and solo buttons. Double-click a control to put it back. The strip only
// draws and reports: the mixer that owns it decides what a change means and sends it.
//
// Reads: nothing shared.
import { el } from '../core/dom.js';

const panText = v => (v === 64 ? 'C' : v < 64 ? 'L' + (64 - v) : 'R' + (v - 64));
const DEF = { lvl: 100, pan: 64, rev: 0, cho: 0 };
/** The track's knobs: key, label, CC, and what the tooltip says. */
export const STRIP_KNOBS = [
  ['flt', 'Filter', 80, 'C1 · the track’s FILTER knob (CC 80): cutoff, or what KNOB ASSIGN has on it'],
  ['mod', 'Mod', 81, 'C2 · the track’s MOD knob (CC 81): what KNOB ASSIGN has on it'],
  ['fx', 'FX', 82, 'C3 · the track’s FX knob (CC 82): what KNOB ASSIGN has on it'],
  ['snd', 'Sound', 83, 'C4 · the SOUND knob (CC 83), which KNOB ASSIGN lists with the others: Decay, Level…']
];

/* a small horizontal control: pan from the centre, sends from the left */
function knob(label, key, v, s, o, def = DEF[key], tip = label, unset = false) {
  const centre = key === 'pan',
    out = el('b', {}, centre ? panText(v) : String(v));
  const paint = (inp, x) => {
    const p = (x / 127) * 100;
    inp.style.setProperty('--lo', (centre ? Math.min(p, 50) : 0) + '%');
    inp.style.setProperty('--hi', (centre ? Math.max(p, 50) : p) + '%');
  };
  const inp = el('input', {
    type: 'range',
    min: 0,
    max: 127,
    value: v,
    class: 'mxKnob' + (centre ? ' centre' : ''),
    'aria-label': label + ', ' + s.name,
    onpointerdown: () => o.grab && o.grab(),
    oninput: e => {
      const x = +e.target.value;
      paint(e.target, x);
      out.textContent = centre ? panText(x) : String(x);
      row.classList.remove('unset');
      o.set(key, x);
    },
    onchange: () => o.done && o.done(key),
    onpointerup: () => o.done && o.done(key),
    onpointercancel: () => o.done && o.done(key),
    ondblclick: e => {
      e.target.value = def;
      e.target.dispatchEvent(new Event('input'));
      e.target.dispatchEvent(new Event('change'));
    }
  });
  paint(inp, v);
  const row = el(
    'label',
    {
      class: 'mxRow' + (unset ? ' unset' : ''),
      title: tip + (unset ? ' · not sent yet: the MC-707 keeps its own' : '') + ' · double-click to reset'
    },
    el('span', {}, label),
    inp,
    out
  );
  return row;
}

/**
 * A strip.
 * @param {{num:string|number, name:string, color:string, sub?:string, lvl:number, pan:number, rev:number,
 *   cho:number, mute:boolean, solo:boolean, pending?:string, dim?:string, extra?:Node[],
 *   knobs?:{key:string, v:number, def:number, unset?:boolean}[]} s  knobs: the track's knobs to show
 *   (STRIP_KNOBS keys), unset when nothing was sent yet; pending: 'mute'
 *   or 'unmute' while a change waits for the beat; dim: why the track is quiet anyway (shown greyed)
 * @param {{set:(key:string, v:number)=>void, done?:(key:string)=>void, grab?:()=>void, mute:()=>void,
 *   solo:()=>void, menu?:(e:MouseEvent)=>void, title?:string}} o  set runs while a control moves, done
 *   once it is let go, grab when one is picked up
 * @returns {HTMLElement} with .light (the activity light) and .meter (its fill)
 */
export function mixStrip(s, o) {
  const lvlOut = el('b', { class: 'mxVal' }, String(s.lvl));
  const fader = el('input', {
    type: 'range',
    min: 0,
    max: 127,
    value: s.lvl,
    class: 'mxFader',
    'aria-label': 'Level, ' + s.name,
    title: 'Level (MIDI volume, CC 7) · double-click for 100',
    onpointerdown: () => o.grab && o.grab(),
    oninput: e => {
      const x = +e.target.value;
      lvlOut.textContent = String(x);
      e.target.style.setProperty('--hi', (x / 127) * 100 + '%');
      o.set('lvl', x);
    },
    onchange: () => o.done && o.done('lvl'),
    onpointerup: () => o.done && o.done('lvl'),
    onpointercancel: () => o.done && o.done('lvl'),
    ondblclick: e => {
      e.target.value = DEF.lvl;
      e.target.dispatchEvent(new Event('input'));
      e.target.dispatchEvent(new Event('change'));
    }
  });
  fader.style.setProperty('--hi', (s.lvl / 127) * 100 + '%');
  const meter = el('i', { class: 'mxMeterFill' });
  const light = el('i', { class: 'mxLight', title: 'Lights with the notes going out' });
  const tg = (lab, cls, on, fn, title, pend) =>
    el(
      'button',
      {
        type: 'button',
        class: 'mxTg ' + cls + (on ? ' on' : '') + (pend ? ' pend' : ''),
        'aria-pressed': String(on),
        title,
        onclick: fn
      },
      lab
    );
  const node = el(
    'section',
    {
      class: 'mxStrip' + (s.mute ? ' muted' : '') + (s.solo ? ' solo' : '') + (s.dim ? ' dim' : ''),
      style: '--tc:' + (s.color || '#39ff7a'),
      'aria-label': 'Track ' + s.num + ', ' + s.name,
      title: o.title || '',
      oncontextmenu: e => {
        if (!o.menu || e.target.matches('input')) return;
        e.preventDefault();
        o.menu(e);
      }
    },
    el(
      'div',
      { class: 'mxHead' },
      el('span', { class: 'mxNum' }, String(s.num)),
      light,
      el('span', { class: 'mxName', title: s.name }, s.name),
      s.sub ? el('span', { class: 'mxSub', title: s.dim || s.sub }, s.dim ? s.dim : s.sub) : null
    ),
    knob('Pan', 'pan', s.pan, s, o),
    knob('Reverb', 'rev', s.rev, s, o),
    knob('Chorus', 'cho', s.cho, s, o),
    ...(s.extra || []),
    s.knobs
      ? el(
          'div',
          { class: 'mxKnobs', role: 'group', 'aria-label': 'Knobs, ' + s.name },
          ...s.knobs.map(k => {
            const [, label, , tip] = STRIP_KNOBS.find(x => x[0] === k.key);
            return knob(label, k.key, k.v, s, o, k.def, tip, k.unset);
          })
        )
      : null,
    el('div', { class: 'mxFaderBox' }, el('span', { class: 'mxMeter' }, meter), fader),
    lvlOut,
    el(
      'div',
      { class: 'mxBtns' },
      tg(
        'M',
        'mute',
        s.mute,
        o.mute,
        s.pending === 'mute'
          ? 'Mutes on the next beat'
          : s.pending === 'unmute'
            ? 'Comes back on the next beat'
            : 'Mute',
        !!s.pending
      ),
      tg('S', 'solo', s.solo, o.solo, 'Solo: hear only the soloed tracks')
    )
  );
  node.light = light;
  node.meter = meter;
  return node;
}

/** Light a strip's activity light and meter: a = 0-1. */
export function mixLight(node, a) {
  node.light.style.opacity = String(0.15 + 0.85 * a);
  node.meter.style.height = Math.round(a * 100) + '%';
}
