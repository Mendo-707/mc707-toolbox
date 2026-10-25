// A simple ask dialog (OK / Cancel, or a text box).
import { el } from '../core/dom.js';

/**
 * Ask a question in a small dialog. With input: true it shows a text box.
 * @param {{title: string, text?: string, ok?: string, cancel?: string, input?: boolean, def?: string}} o
 * @returns {Promise<boolean|string|null>}  true/false, or the text (null when cancelled)
 */
export function askDlg(o) {
  return new Promise(res => {
    const back = el('div', {
      style:
        'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9600;padding:16px'
    });
    let inp = null;
    const done = v => {
      back.remove();
      removeEventListener('keydown', kd, true);
      res(v);
    };
    const ok = el(
      'button',
      { class: 'btn on', onclick: () => done(o.input ? inp.value.trim() || null : true) },
      o.ok || 'OK'
    );
    const no = el('button', { class: 'btn', onclick: () => done(o.input ? null : false) }, o.cancel || 'Cancel');
    const box = el(
      'div',
      {
        role: 'dialog',
        'aria-modal': 'true',
        style:
          'background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);padding:16px;width:min(420px,100%);display:flex;flex-direction:column;gap:10px'
      },
      el('b', { style: 'font-size:16px' }, o.title),
      o.text
        ? el(
            'div',
            { class: 'hint', style: 'line-height:1.4;white-space:pre-wrap;max-height:55vh;overflow:auto' },
            o.text
          )
        : null
    );
    if (o.input) {
      inp = el('input', { type: 'text', value: o.def || '', maxlength: 80, style: 'width:100%' });
      box.append(inp);
    }
    box.append(el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, no, ok));
    back.append(box);
    document.body.append(back);
    const kd = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(o.input ? null : false);
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        e.preventDefault();
        ok.click();
      }
    };
    addEventListener('keydown', kd, true);
    setTimeout(() => {
      (inp || ok).focus();
      if (inp) inp.select();
    }, 30);
  });
}
