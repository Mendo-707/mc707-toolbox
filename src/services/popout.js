// Tool windows that can live on another screen (the mixers): a real window of its own when the
// browser or the Windows app allows one, which you drag anywhere, even onto a second monitor; else a
// panel over the app that you drag by its title bar. The window keeps its place and size for next time.
// The caller draws into the window's root with the usual helpers (nodes move into the window's page as
// they are added, their handlers still run here). Keys pressed in the window reach the app, so Space
// still starts and stops. In the Windows app the window is borderless: the tool's own header is where you
// drag it, with pin (stay on top), minimise and close buttons (h.winBtns()).
//
// Owns: localStorage 'mc707-popout-<id>' (where each window was, and whether it stays on top).
import { el } from '../core/dom.js';

const OPEN = new Map();
/* the Windows app's tool-window controls (main.js makes those windows borderless) */
const APP = window.toolbox && window.toolbox.popWin ? window.toolbox : null;
const placeOf = id => {
  try {
    return JSON.parse(localStorage.getItem('mc707-popout-' + id) || 'null');
  } catch (e) {
    return null;
  }
};
const keepPlace = (id, p) => {
  try {
    localStorage.setItem('mc707-popout-' + id, JSON.stringify(p));
  } catch (e) {}
};

/* the app's styles, copied into the window's page */
function copyStyles(doc) {
  /* the rules the app's page has already loaded, written into the window's own page (nothing to load
     again); only a sheet whose rules cannot be read (web fonts from another site) is linked */
  for (const n of document.querySelectorAll('style, link[rel="stylesheet"]')) {
    let css = null;
    try {
      css = n.tagName === 'LINK' ? [...n.sheet.cssRules].map(r => r.cssText).join('\n') : n.textContent;
    } catch (e) {}
    if (css != null) {
      const s = doc.createElement('style');
      s.textContent = css;
      doc.head.append(s);
    } else if (n.href) {
      const l = doc.createElement('link');
      l.rel = 'stylesheet';
      l.href = n.href;
      doc.head.append(l);
    }
  }
  doc.documentElement.className = document.documentElement.className;
  for (const a of document.documentElement.attributes)
    if (a.name.startsWith('data-')) doc.documentElement.setAttribute(a.name, a.value);
}
/* keys typed in the window (not into a text box) go to the app as well */
function forwardKeys(win) {
  for (const type of ['keydown', 'keyup'])
    win.document.addEventListener(type, e => {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range') return;
      const copy = new KeyboardEvent(type, {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        repeat: e.repeat,
        bubbles: true,
        cancelable: true
      });
      if (!document.dispatchEvent(copy)) e.preventDefault();
    });
}

function openWindow(o, h) {
  const p = placeOf(o.id) || {};
  const w = p.w || o.w,
    ht = p.h || o.h;
  const feat =
    'popup=yes,width=' + w + ',height=' + ht + (p.x != null ? ',left=' + p.x + ',top=' + p.y : '') + ',resizable=yes';
  let win = null;
  try {
    win = window.open('', 'mc707-' + o.id, feat);
  } catch (e) {
    win = null;
  }
  if (!win || win.closed || !win.document) return false;
  const doc = win.document;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title></title></head><body></body></html>');
  doc.close();
  doc.title = o.title + ' · MC-707 Toolbox';
  copyStyles(doc);
  doc.body.className = 'popWin' + (APP ? ' popFrameless' : '');
  h.name = 'mc707-' + o.id;
  h.frameless = !!APP;
  h.top = !!(APP && p.top);
  if (h.top) APP.popWin(h.name, 'top', true);
  const root = el('div', { class: 'popRoot' });
  doc.body.append(root);
  forwardKeys(win);
  const save = () => {
    try {
      if (!win.closed)
        keepPlace(o.id, {
          x: win.screenX,
          y: win.screenY,
          w: win.innerWidth,
          h: win.innerHeight,
          win: 1,
          ...(h.top ? { top: 1 } : {})
        });
    } catch (e) {}
  };
  const watch = setInterval(() => {
    if (win.closed) h.close(true);
    else save();
  }, 1000);
  win.addEventListener('beforeunload', save);
  Object.assign(h, { win, doc, root, raf: f => win.requestAnimationFrame(f), stop: () => clearInterval(watch) });
  return true;
}

function openPanel(o, h) {
  const p = placeOf(o.id) || {};
  const box = el('div', { class: 'popPanel', role: 'dialog', 'aria-label': o.title });
  const root = el('div', { class: 'popRoot' });
  const place = (x, y) => {
    x = Math.max(0, Math.min(innerWidth - 120, x));
    y = Math.max(0, Math.min(innerHeight - 40, y));
    box.style.left = x + 'px';
    box.style.top = y + 'px';
  };
  const bar = el(
    'div',
    {
      class: 'popBar',
      title: 'Drag to move',
      onpointerdown: e => {
        if (e.target.closest('button')) return;
        const r = box.getBoundingClientRect(),
          dx = e.clientX - r.left,
          dy = e.clientY - r.top;
        const move = m => place(m.clientX - dx, m.clientY - dy);
        const up = () => {
          removeEventListener('pointermove', move);
          removeEventListener('pointerup', up);
          const q = box.getBoundingClientRect();
          keepPlace(o.id, { ...(placeOf(o.id) || {}), px: q.left, py: q.top, win: 0 });
        };
        addEventListener('pointermove', move);
        addEventListener('pointerup', up);
      }
    },
    el('b', {}, o.title),
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm',
        title: 'Open it in a window of its own, to drag onto another screen',
        onclick: () => {
          const build = h.build;
          h.close(true);
          popout({ ...o, build, panel: false });
        }
      },
      'Pop out ⧉'
    ),
    el('button', { type: 'button', class: 'btn sm', title: 'Close', onclick: () => h.close() }, '✕')
  );
  box.append(bar, root);
  document.body.append(box);
  box.style.width = (p.pw || o.w) + 'px';
  place(p.px != null ? p.px : innerWidth - (p.pw || o.w) - 24, p.py != null ? p.py : 70);
  Object.assign(h, {
    win: null,
    doc: document,
    root,
    panel: box,
    raf: f => requestAnimationFrame(f),
    stop: () => box.remove()
  });
}

/**
 * Open (or bring forward) a tool window.
 * @param {{id:string, title:string, w:number, h:number, build:(root:HTMLElement, h:object)=>void,
 *   onClose?:()=>void, panel?:boolean}} o  build draws the content; panel: true opens it over the app
 * @returns {{root:HTMLElement, win:Window|null, refresh:()=>void, close:()=>void, raf:Function}}
 */
export function popout(o) {
  const old = OPEN.get(o.id);
  /* a window closed a moment ago may not have been noticed yet */
  if (old && old.win && old.win.closed) old.close(true);
  else if (old) {
    if (old.win) old.win.focus();
    return old;
  }
  const h = { id: o.id, build: o.build, open: true };
  /* a borderless window's own buttons (null anywhere else): stay on top, minimise, close */
  h.winBtns = () => {
    if (!h.frameless) return null;
    const b = (label, title, cls, fn) =>
      el('button', { type: 'button', class: 'popWb ' + cls, title, 'aria-label': title, onclick: fn }, label);
    const pin = b('📌', 'Keep this window on top of the others', 'pin' + (h.top ? ' on' : ''), async () => {
      h.top = await APP.popWin(h.name, 'top', !h.top);
      pin.classList.toggle('on', h.top);
    });
    return el(
      'div',
      { class: 'popWbs' },
      pin,
      b('—', 'Minimise', 'min', () => APP.popWin(h.name, 'min')),
      b('✕', 'Close', 'x', () => h.close())
    );
  };
  h.refresh = () => {
    if (!h.open) return;
    h.root.textContent = '';
    o.build(h.root, h);
  };
  h.close = quiet => {
    if (!h.open) return;
    h.open = false;
    OPEN.delete(o.id);
    h.stop();
    try {
      if (h.win && !h.win.closed) h.win.close();
    } catch (e) {}
    if (o.onClose) o.onClose(quiet);
  };
  const want = o.panel != null ? o.panel : (placeOf(o.id) || {}).win === 0;
  if (want || !openWindow(o, h)) openPanel(o, h);
  OPEN.set(o.id, h);
  h.refresh();
  return h;
}
/* the colour tokens a window takes from the screen it belongs to */
const TOKENS = [
  '--bg',
  '--panel',
  '--panel2',
  '--raise',
  '--line',
  '--ink',
  '--mute',
  '--hot',
  '--acc',
  '--font',
  '--glow1',
  '--glow2'
];
/** The tokens as they are on src now (to notice when its theme changes). */
export const themeSig = src => {
  const cs = getComputedStyle(src);
  return TOKENS.map(k => cs.getPropertyValue(k).trim()).join(';');
};
/**
 * Give a tool window the look of a part of the app: the colour tokens as they are on src now (its
 * theme, light or dark), and a class for the rest of its style ('popSong', 'popLive').
 * @returns {string} themeSig(src), to notice when the theme changes
 */
export function popTheme(h, src, cls) {
  const cs = getComputedStyle(src),
    host = h.panel || h.doc.body;
  for (const k of TOKENS) {
    const v = cs.getPropertyValue(k).trim();
    if (v) host.style.setProperty(k, v);
    else host.style.removeProperty(k);
  }
  host.classList.remove('popSong', 'popLive');
  host.classList.add(cls);
  return themeSig(src);
}
/** The open tool window with this id, if any. */
export const popoutOf = id => OPEN.get(id) || null;
/** Close every tool window (when the app closes). */
export function popoutCloseAll() {
  for (const h of [...OPEN.values()]) h.close(true);
}
