// Shows a red bar with Reload / Reset buttons if the app hits an error, instead of failing silently.
// Loaded as a plain script at the top of <body>, before the app, so it also catches errors while the app starts.
(function () {
  window.__fatal = function (msg) {
    try {
      if (document.getElementById('fatal')) return;
      var d = document.createElement('div');
      d.id = 'fatal';
      d.setAttribute(
        'style',
        'position:fixed;left:0;right:0;top:0;z-index:99999;background:#b3261e;color:#fff;padding:10px 14px;font:14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap'
      );
      var t = document.createElement('span');
      t.textContent = 'Something went wrong: ' + msg;
      d.appendChild(t);
      function btn(label, fn) {
        var b = document.createElement('button');
        b.textContent = label;
        b.setAttribute('style', 'padding:4px 10px;border-radius:5px;border:0;cursor:pointer');
        b.onclick = fn;
        d.appendChild(b);
      }
      btn('Reload', function () {
        location.reload();
      });
      btn('Reset autosave and reload', function () {
        try {
          localStorage.removeItem('mc707-song-mode-v1');
        } catch (e) {}
        location.reload();
      });
      btn('Dismiss', function () {
        d.remove();
      });
      document.body.appendChild(d);
    } catch (e) {}
  };
  window.addEventListener('error', function (e) {
    var m = (e && e.message) || 'unknown error';
    /* Harmless browser warnings, not app errors: a resize that settled a frame late, or an error from another site's script. */
    if (/ResizeObserver loop/i.test(m) || m === 'Script error.') {
      try {
        e.stopImmediatePropagation();
      } catch (_) {}
      return;
    }
    window.__fatal(m);
  });
})();
