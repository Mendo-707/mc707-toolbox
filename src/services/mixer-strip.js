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
  [
    'flt',
    'Filter',
    80,
    'C1 · the track’s FILTER knob (CC 80): the slider turns it, the name above chooses what it controls'
  ],
  ['mod', 'Mod', 81, 'C2 · the track’s MOD knob (CC 81): the slider turns it, the name above chooses what it controls'],
  ['fx', 'FX', 82, 'C3 · the track’s FX knob (CC 82): the slider turns it, the name above chooses what it controls'],
  ['snd', 'Sound', 83, 'C4 · the SOUND knob (CC 83): the slider turns it, the name above chooses what it controls']
];

/* a small horizontal control: pan from the centre, sends from the left */
function knob(label, key, v, s, o, def = DEF[key], tip = label, unset = false, assign = null) {
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
    assign ? assignSelect(label, assign, s.name) : el('span', {}, label),
    inp,
    out
  );
  return row;
}

/* what the knob controls on the MC-707 (KNOB ASSIGN), chosen in place of its label */
function assignSelect(label, a, name) {
  const known = a.cur == null || a.choices.some(c => c[0] === a.cur);
  return el(
    'select',
    {
      class: 'mxKSel',
      'aria-label': label + ' knob controls, ' + name,
      title: label + ': what this knob controls on the MC-707 (KNOB ASSIGN), for every clip of the track',
      onchange: e => e.target.value !== '' && a.on(+e.target.value),
      onclick: e => e.stopPropagation()
    },
    a.cur == null ? el('option', { value: '', selected: true }, label) : null,
    !known ? el('option', { value: a.cur, selected: true }, 'Other (' + a.cur + ')') : null,
    ...a.choices.map(([v, n]) => el('option', { value: v, selected: v === a.cur }, n))
  );
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
    s.fx && o.fx ? fxRow(s.fx, o.fx, s.name) : null,
    s.knobs
      ? el(
          'div',
          { class: 'mxKnobs', role: 'group', 'aria-label': 'Knobs, ' + s.name },
          ...s.knobs.map(k => {
            const [, label, , tip] = STRIP_KNOBS.find(x => x[0] === k.key);
            return knob(label, k.key, k.v, s, o, k.def, tip, k.unset, k.assign);
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

/* a drop-down of effect choices, grouped: {id, label, group}[]. Only the current one is drawn until the
   list is opened (a mixer redraws often while Live plays; a hundred options per strip would slow it) */
function fxSelect(choices, cur, on, label, title) {
  const now = choices.find(c => c.id === cur);
  const opt = c => el('option', { value: c.id, selected: c.id === cur }, c.label);
  const sel = el(
    'select',
    { class: 'mxSel', 'aria-label': label, title, onchange: e => e.target.value && on(e.target.value) },
    now ? opt(now) : el('option', { value: '', selected: true }, '—')
  );
  const fill = () => {
    if (sel.dataset.full) return;
    sel.dataset.full = '1';
    const groups = [...new Set(choices.map(c => c.group))];
    sel.replaceChildren(
      ...(now ? [] : [el('option', { value: '', selected: true }, '—')]),
      ...groups.flatMap(g =>
        g
          ? [el('optgroup', { label: g }, ...choices.filter(c => c.group === g).map(opt))]
          : choices.filter(c => !c.group).map(opt)
      )
    );
  };
  for (const ev of ['pointerdown', 'focus', 'keydown']) sel.addEventListener(ev, fill);
  return sel;
}
/* the track's effect: {choices, cur, busy} */
function fxRow(fx, on, name) {
  return el(
    'label',
    {
      class: 'mxRow mxFx' + (fx.busy ? ' busy' : ''),
      title:
        'The track’s effect (MFX): sent to every clip’s sound and the track’s own, so it stays whichever clip plays. Shape it further in the ZenCore editor.'
    },
    el('span', {}, fx.busy ? 'Effect · sending…' : 'Effect'),
    fxSelect(fx.choices, fx.cur, on, 'Effect, ' + name, '')
  );
}

/**
 * The master strip: the MC-707's total effects.
 * @param {{choices:{id,label,group}[], rev:string[], cho:string[], m:object|null, busy?:boolean}} s
 *   m: as zen/zc-fx.js FXN.master (null: not read yet)
 * @param {{set:(what:string, v:number|string)=>void, read:()=>void}} o
 */
export function masterStrip(s, o) {
  const m = s.m || {},
    list = (names, cur, what, label) =>
      fxSelect(
        names.map((n, i) => ({ id: String(i), label: n, group: '' })),
        cur == null ? null : String(cur),
        v => o.set(what, +v),
        label,
        ''
      );
  const level = (label, what, v, tip) => {
    const out = el('b', {}, v == null ? '—' : String(v));
    const inp = el('input', {
      type: 'range',
      min: 0,
      max: 127,
      value: v ?? 64,
      class: 'mxKnob',
      'aria-label': label,
      oninput: e => ((out.textContent = e.target.value), o.set(what, +e.target.value))
    });
    inp.style.setProperty('--lo', '0%');
    inp.style.setProperty('--hi', ((v ?? 64) / 127) * 100 + '%');
    return el('label', { class: 'mxRow' + (v == null ? ' unset' : ''), title: tip }, el('span', {}, label), inp, out);
  };
  const tg = (lab, what, on, title) =>
    el(
      'button',
      {
        type: 'button',
        class: 'mxTg' + (on ? ' on' : ''),
        'aria-pressed': String(!!on),
        title,
        onclick: () => o.set(what, on ? 0 : 1)
      },
      lab
    );
  const rev = m.rev || {},
    cho = m.cho || {};
  return el(
    'section',
    { class: 'mxStrip mxMaster', style: '--tc:#e8e4d8', 'aria-label': 'Master effects' },
    el(
      'div',
      { class: 'mxHead' },
      el('span', { class: 'mxNum' }, 'M'),
      el('span', { class: 'mxName' }, 'Master FX'),
      el('span', { class: 'mxSub' }, s.busy ? 'Sending…' : s.m ? 'The MC-707’s total effects' : 'Not read yet')
    ),
    el(
      'label',
      { class: 'mxRow mxFx', title: 'The reverb every track’s Reverb send goes to' },
      el('span', {}, 'Reverb'),
      list(s.rev, rev.sw === 0 ? 0 : rev.type, 'revType', 'Reverb type')
    ),
    level('Reverb level', 'revLevel', rev.level, 'How loud the reverb is'),
    el(
      'label',
      { class: 'mxRow mxFx', title: 'The chorus or delay every track’s Chorus send goes to' },
      el('span', {}, 'Chorus / delay'),
      list(s.cho, cho.sw === 0 ? 0 : cho.type, 'choType', 'Chorus or delay type')
    ),
    level('Chorus level', 'choLevel', cho.level, 'How loud the chorus or delay is'),
    level('Chorus → reverb', 'choSend', cho.send, 'How much of the chorus or delay goes on to the reverb'),
    el(
      'label',
      { class: 'mxRow mxFx', title: 'The master Multi FX, on the whole mix (the MULTI button on the MC-707)' },
      el('span', {}, 'Multi FX'),
      fxSelect(s.choices, m.mfx ? m.mfx.id : null, v => o.set('mfx', v), 'Master Multi FX', '')
    ),
    el(
      'div',
      { class: 'mxBtns' },
      tg('Comp', 'comp', m.comp, 'The master compressor on or off'),
      tg('EQ', 'eq', m.eq, 'The master EQ on or off')
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm',
        title: 'Read the total effects from the MC-707, to show what it has now',
        onclick: () => o.read()
      },
      'Read from MC-707'
    )
  );
}

/** Light a strip's activity light and meter: a = 0-1. */
export function mixLight(node, a) {
  node.light.style.opacity = String(0.15 + 0.85 * a);
  node.meter.style.height = Math.round(a * 100) + '%';
}
