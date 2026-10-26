// The Master FX strip's settings panel: the reverb's or the delay's settings for its type, the master
// Multi FX's, the master EQ or the master compressor, as a list of sliders and choosers over the mixer.
// The values come from hooks.fx.total (zen/zc-total.js); a change goes to the MC-707 as you move it.
//
// Reads: hooks.fx.total.
import { el, toast } from '../core/dom.js';
import { hooks } from '../core/hooks.js';

/** The panel open now (null: none). */
export const PANEL = { sec: null };

const paint = (inp, v) => {
  const span = +inp.max - +inp.min || 1;
  inp.style.setProperty('--lo', '0%');
  inp.style.setProperty('--hi', ((v - +inp.min) / span) * 100 + '%');
};
/* one control: a chooser for a list, a slider otherwise */
function row(c, sec, T) {
  const show = v =>
    v == null ? '—' : c.list ? (c.list[v] ?? String(v)) + (c.unit ? ' ' + c.unit : '') : c.text ? c.text(v) : String(v);
  const out = el('b', {}, show(c.v));
  const send = v => {
    T.set(sec, c.key, v).then(
      ok => ok || toast('Connect the MC-707 (the ZenCore editor’s link) to change its effects')
    );
  };
  const ctl = c.list
    ? el(
        'select',
        { class: 'mxSel', 'aria-label': c.name, onchange: e => send(+e.target.value) },
        c.v == null ? el('option', { value: '', selected: true }, '—') : null,
        ...c.list.map((n, i) =>
          el('option', { value: i, selected: i === c.v }, n + (c.unit && /\d$/.test(n) ? ' ' + c.unit : ''))
        )
      )
    : el('input', {
        type: 'range',
        class: 'mxKnob',
        min: c.min,
        max: c.max,
        value: c.v ?? Math.round((c.min + c.max) / 2),
        'aria-label': c.name,
        oninput: e => {
          const v = +e.target.value;
          out.textContent = show(v);
          paint(e.target, v);
          send(v);
        }
      });
  /* the slider's track fills up to its value, as the strips' do */
  if (!c.list) paint(ctl, c.v ?? Math.round((c.min + c.max) / 2));
  return el(
    'label',
    { class: 'mxRow mpRow' + (c.v == null ? ' unset' : '') },
    el('span', {}, c.name),
    ctl,
    c.list ? null : out
  );
}

/**
 * The panel for the section open now (null when none is), drawn fresh each redraw.
 * @param {() => void} redraw  the mixer's redraw
 */
export function panelFor(redraw) {
  const T = hooks.fx && hooks.fx.total;
  if (!T || !PANEL.sec) return null;
  const sec = PANEL.sec,
    p = T.panel(sec);
  const close = () => ((PANEL.sec = null), redraw());
  const read = async () => {
    const ok = await T.read(sec).catch(() => false);
    if (!ok) toast('The MC-707 did not answer: connect it (the ZenCore editor’s link) and try again');
    redraw();
  };
  return el(
    'div',
    {
      class: 'mpBox',
      role: 'dialog',
      'aria-label': p.title,
      onkeydown: e => e.key === 'Escape' && close()
    },
    el(
      'div',
      { class: 'mpHead' },
      el('b', {}, p.title),
      el(
        'button',
        { type: 'button', class: 'btn sm', onclick: read, title: 'Read these settings from the MC-707' },
        'Read'
      ),
      el('button', { type: 'button', class: 'btn sm', onclick: close, 'aria-label': 'Close' }, '×')
    ),
    p.note ? el('p', { class: 'hint' }, p.note) : null,
    el('div', { class: 'mpList' }, ...p.controls.map(c => row(c, sec, T)))
  );
}

/** Open a section's panel (or close it when it is open), reading its values from the MC-707. */
export async function panelToggle(sec, redraw) {
  const T = hooks.fx && hooks.fx.total;
  if (!T) return;
  if (PANEL.sec === sec) {
    PANEL.sec = null;
    return redraw();
  }
  PANEL.sec = sec;
  redraw();
  if (await T.read(sec).catch(() => false)) redraw();
}
/** The type of a section changed: its values belong to the old type, so read them again when it is open. */
export async function panelTypeChanged(sec, redraw) {
  const T = hooks.fx && hooks.fx.total;
  if (!T || PANEL.sec !== sec) return;
  if (await T.read(sec).catch(() => false)) redraw();
}
