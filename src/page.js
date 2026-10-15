'use strict';

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

function renderPage(info) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Version App v${escape(info.version)}</title>
<style>
  :root { --accent: ${escape(info.color)}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex;
         align-items: center; justify-content: center; padding: 16px; }
  .card { width: 100%; max-width: 640px; background: #1e293b; border-radius: 16px;
          border-top: 8px solid var(--accent); padding: 28px; }
  h1 { margin: 0 0 4px; font-size: 1.4rem; }
  .sub { color: #94a3b8; margin: 0 0 20px; font-size: .9rem; }
  .badge { display: inline-block; background: var(--accent); color: #fff; font-weight: 700;
           font-size: 2.4rem; padding: 8px 20px; border-radius: 12px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 20px 0; }
  dt { color: #94a3b8; } dd { margin: 0; font-family: ui-monospace, monospace; word-break: break-all; }
  h2 { font-size: 1rem; margin: 20px 0 8px; }
  #log { list-style: none; padding: 0; margin: 0; max-height: 220px; overflow: auto;
         font-family: ui-monospace, monospace; font-size: .85rem; }
  #log li { padding: 3px 0; border-bottom: 1px solid #334155; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
</style>
</head>
<body>
<main class="card">
  <h1>Application Version Management</h1>
  <p class="sub">Kubernetes Rolling Updates &amp; Rollback &middot; DevOps Mini Project</p>
  <span class="badge" id="badge">v${escape(info.version)}</span>
  <dl>
    <dt>Served by pod</dt><dd id="pod">${escape(info.pod)}</dd>
    <dt>Git commit</dt><dd>${escape(info.commit)}</dd>
    <dt>Build date</dt><dd>${escape(info.buildDate)}</dd>
  </dl>
  <h2>Live responses (polling /api/version every second)</h2>
  <ul id="log"></ul>
</main>
<script>
  const log = document.getElementById('log');
  async function poll() {
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      const d = await r.json();
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = d.color;
      li.append(dot, new Date().toLocaleTimeString() + '  v' + d.version + '  ' + d.pod);
      log.prepend(li);
      while (log.children.length > 50) log.lastChild.remove();
    } catch (e) {
      const li = document.createElement('li');
      li.textContent = new Date().toLocaleTimeString() + '  request failed';
      log.prepend(li);
    }
  }
  setInterval(poll, 1000);
  poll();
</script>
</body>
</html>`;
}

module.exports = { renderPage };
