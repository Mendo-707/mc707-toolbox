import { el } from '../core/dom.js';

/* ---------- context menus, clip options and loop controls ---------- */
export let CM = null;
export function closeMenu() {
  if (CM) {
    CM.remove();
    CM = null;
  }
}
export function showMenu(x, y, items) {
  closeMenu();
  const m = el('div', { class: 'cmenu', role: 'menu' });
  const build = (list, host) => {
    list.forEach(it => {
      if (!it) return;
      if (it === '-') {
        host.append(el('div', { class: 'csep' }));
        return;
      }
      if (it.sub) {
        const fit = () =>
          requestAnimationFrame(() => {
            sm.style.top = '-5px';
            const r = sm.getBoundingClientRect();
            let dy = 0;
            if (r.bottom > innerHeight - 6) dy = r.bottom - (innerHeight - 6);
            if (r.top - dy < 6) dy = r.top - 6;
            sm.style.top = -5 - dy + 'px';
          });
        const row = el(
          'div',
          {
            class: 'cmi sub',
            onclick: e => {
              e.stopPropagation();
              row.classList.toggle('open');
              fit();
            },
            onmouseenter: () => fit()
          },
          el('span', {}, it.label),
          el('span', { class: 'arr' }, '▸')
        );
        const sm = el('div', { class: 'cmenu subm' });
        build(it.sub, sm);
        row.append(sm);
        host.append(row);
        return;
      }
      host.append(
        el(
          'button',
          {
            class: 'cmi' + (it.danger ? ' danger' : ''),
            disabled: !!it.disabled,
            onclick: e => {
              e.stopPropagation();
              closeMenu();
              if (it.action) it.action();
            }
          },
          el('span', {}, (it.checked ? '✓ ' : '') + it.label),
          ...(it.hint ? [el('span', { class: 'hint' }, it.hint)] : [])
        )
      );
    });
  };
  build(items, m);
  document.body.append(m);
  CM = m;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 6)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 6)) + 'px';
  if (x + r.width * 2 > innerWidth) m.classList.add('flip');
}
