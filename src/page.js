'use strict';

const { VERSION_COLORS } = require('./config');

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

function renderPage(info) {
  const rt = info.runtime || {};
  // Embedded as JSON for the client script; "<" is escaped so the data can
  // never close the <script> tag.
  const boot = JSON.stringify({ info, colors: VERSION_COLORS }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Version App v${escape(info.version)}</title>
<style>
  :root { --accent: ${escape(info.color)}; --bg: #0b1220; --card: #131c2e; --line: #23304a;
          --text: #e2e8f0; --muted: #8b9ab3; --ok: #22c55e; --bad: #ef4444; --warn: #f59e0b; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg);
         color: var(--text); font-size: 14px; }
  .wrap { max-width: 1280px; margin: 0 auto; padding: 20px 16px 40px; }
  header { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;
           border-bottom: 3px solid var(--accent); padding-bottom: 16px; margin-bottom: 18px; }
  h1 { margin: 0; font-size: 1.35rem; }
  .sub { color: var(--muted); margin: 4px 0 0; font-size: .85rem; }
  .hero { display: flex; align-items: center; gap: 14px; }
  .badge { background: var(--accent); color: #fff; font-weight: 800; font-size: 2rem; padding: 6px 18px; border-radius: 12px; }
  .hero small { display: block; color: var(--muted); font-size: .75rem; }
  .hero code { font-size: .85rem; }
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(12, 1fr); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; min-width: 0; }
  .card h2 { margin: 0 0 12px; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
             display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
  .span3 { grid-column: span 3; } .span4 { grid-column: span 4; } .span5 { grid-column: span 5; }
  .span6 { grid-column: span 6; } .span7 { grid-column: span 7; } .span8 { grid-column: span 8; } .span12 { grid-column: span 12; }
  @media (max-width: 960px) { .span4, .span5, .span6, .span7, .span8 { grid-column: span 12; } .span3 { grid-column: span 6; } }
  @media (max-width: 520px) { .chip { white-space: normal; } .ev { grid-template-columns: 1fr; gap: 2px; }
    .stat .v { font-size: 1.3rem; } .badge { font-size: 1.5rem; } }
  .stat .v { font-size: 1.7rem; font-weight: 800; }
  .stat .l { color: var(--muted); font-size: .8rem; margin-top: 2px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
  dt { color: var(--muted); } dd { margin: 0; font-family: ui-monospace, Menlo, monospace; font-size: .82rem; word-break: break-all; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: .75rem;
          font-weight: 700; background: #1e293b; color: var(--text); white-space: nowrap; }
  .chip.ok { background: rgba(34,197,94,.15); color: #4ade80; } .chip.bad { background: rgba(239,68,68,.15); color: #f87171; }
  .chip.warn { background: rgba(245,158,11,.15); color: #fbbf24; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: none; }
  .probe { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .probe:last-child { border-bottom: 0; }
  .probe b { display: block; } .probe span { color: var(--muted); font-size: .8rem; }
  .steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 14px 0; }
  @media (max-width: 700px) { .steps { grid-template-columns: 1fr; } }
  .step { border: 1px solid var(--line); border-radius: 10px; padding: 10px; font-size: .8rem; color: var(--muted); }
  .step b { display: block; color: var(--text); margin-bottom: 3px; font-size: .85rem; }
  .step.done { border-color: rgba(34,197,94,.5); } .step.done b::before { content: "✓ "; color: var(--ok); }
  .step.active { border-color: var(--warn); background: rgba(245,158,11,.08); } .step.active b::before { content: "● "; color: var(--warn); }
  .step.fail { border-color: var(--bad); background: rgba(239,68,68,.1); } .step.fail b::before { content: "✗ "; color: var(--bad); }
  .bars { display: grid; gap: 8px; }
  .bar { display: grid; grid-template-columns: 90px 1fr 48px; gap: 10px; align-items: center; font-size: .8rem; }
  .track { background: #0f172a; border: 1px solid var(--line); height: 12px; border-radius: 6px; overflow: hidden; }
  .fill { height: 100%; background: var(--ok); transition: width .4s; }
  .kv { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .pods { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
  .pod { border-radius: 10px; padding: 10px; border: 2px solid transparent; background: #0f172a; font-size: .78rem; }
  .pod .pv { font-weight: 800; font-size: 1rem; }
  .pod .pn { font-family: ui-monospace, Menlo, monospace; color: var(--muted); word-break: break-all; margin: 4px 0; }
  .pod.notready { border-style: dashed; opacity: .85; } .pod.term { opacity: .45; }
  .pod.me { box-shadow: 0 0 0 2px #fff inset; }
  table { width: 100%; border-collapse: collapse; font-size: .8rem; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
  th { color: var(--muted); font-weight: 600; } tr.current td { background: rgba(255,255,255,.04); }
  .strip { display: flex; gap: 2px; height: 34px; align-items: stretch; margin: 6px 0 12px; }
  .strip i { flex: 1; border-radius: 2px; min-width: 3px; }
  .strip i.fail { background: repeating-linear-gradient(45deg, var(--bad) 0 3px, transparent 3px 6px); }
  .split { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: #0f172a; margin: 6px 0 12px; }
  .split div { height: 100%; transition: width .4s; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: .78rem; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .events { max-height: 300px; overflow: auto; }
  .ev { display: grid; grid-template-columns: 70px 120px 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: .78rem; }
  .ev .t { color: var(--muted); font-family: ui-monospace, Menlo, monospace; }
  .ev.Warning .r { color: #f87171; font-weight: 700; } .ev .r { color: #93c5fd; font-weight: 700; }
  .muted { color: var(--muted); } .empty { color: var(--muted); font-style: italic; padding: 12px 0; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  footer { margin-top: 18px; color: var(--muted); font-size: .75rem; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Application Version Management</h1>
      <p class="sub">Kubernetes Rolling Updates &amp; Rollback &middot; DevOps Mini Project &middot; live dashboard</p>
    </div>
    <div class="hero">
      <span class="badge" id="badge">v${escape(info.version)}</span>
      <div><small>page served by pod</small><code id="servedBy">${escape(info.pod)}</code>
        <small id="conn">connecting&hellip;</small></div>
    </div>
  </header>

  <div class="grid">
    <div class="card stat span3"><div class="v" id="sUptime">${escape(info.uptimeSeconds)}s</div><div class="l">Uptime of this pod</div></div>
    <div class="card stat span3"><div class="v" id="sReq">${escape(info.requestsServed)}</div><div class="l">Requests served by this pod</div></div>
    <div class="card stat span3"><div class="v" id="sMem">${escape(rt.memoryMB)} MB</div><div class="l">Memory (RSS) &middot; heap <span id="sHeap">${escape(rt.heapMB)}</span> MB</div></div>
    <div class="card stat span3"><div class="v" id="sReplicas">&ndash;</div><div class="l">Pods ready / desired</div></div>

    <section class="card span8">
      <h2>Rollout status <span id="phase" class="chip">loading</span></h2>
      <div id="rolloutBody"><div class="empty">Waiting for cluster data&hellip;</div></div>
    </section>

    <section class="card span4">
      <h2>This pod</h2>
      <dl>
        <dt>Pod</dt><dd>${escape(info.pod)}</dd>
        <dt>Node</dt><dd>${escape(rt.nodeName || 'n/a')}</dd>
        <dt>Pod IP</dt><dd>${escape(rt.podIP || 'n/a')}</dd>
        <dt>Namespace</dt><dd>${escape(rt.namespace || 'n/a')}</dd>
        <dt>Version</dt><dd>${escape(info.version)}</dd>
        <dt>Git commit</dt><dd>${escape(info.commit)}</dd>
        <dt>Build date</dt><dd>${escape(info.buildDate)}</dd>
        <dt>Runtime</dt><dd>Node ${escape(rt.node)} &middot; ${escape(rt.platform)} &middot; PID ${escape(rt.pid)}</dd>
        <dt>Started</dt><dd>${escape(rt.startedAt)}</dd>
      </dl>
      <h2 style="margin-top:16px">Health probes (this pod)</h2>
      <div class="probe"><span class="dot" id="liveDot" style="background:#64748b"></span>
        <div><b>Liveness &middot; GET /health</b><span id="liveTxt">checking&hellip;</span></div></div>
      <div class="probe"><span class="dot" id="readyDot" style="background:#64748b"></span>
        <div><b>Readiness &middot; GET /ready</b><span id="readyTxt">checking&hellip;</span></div></div>
    </section>

    <section class="card span7">
      <h2>Pods <span class="muted" id="podCount"></span></h2>
      <div id="pods" class="pods"><div class="empty">Waiting for cluster data&hellip;</div></div>
      <div class="legend" style="margin-top:12px">
        <span><i class="dot" style="background:#64748b"></i>solid = Ready (receives traffic)</span>
        <span>dashed = Not Ready (no traffic)</span><span>faded = terminating</span><span>white ring = served this page</span>
      </div>
    </section>

    <section class="card span5">
      <h2>Revisions (ReplicaSets)</h2>
      <div id="revisions"><div class="empty">Waiting for cluster data&hellip;</div></div>
    </section>

    <section class="card span7">
      <h2>Live traffic through the Service <span class="muted">GET /api/version every 1 s</span></h2>
      <div class="muted">Last 60 responses, oldest &rarr; newest (colour = version that answered)</div>
      <div class="strip" id="strip"></div>
      <div class="muted">Version split of the last 60 responses</div>
      <div class="split" id="split"></div>
      <div class="kv" id="trafficStats"></div>
      <table style="margin-top:12px"><thead><tr><th>Pod that answered</th><th>Version</th><th>Hits</th><th>Last seen</th></tr></thead>
        <tbody id="podsHit"></tbody></table>
    </section>

    <section class="card span5">
      <h2>Kubernetes events <span class="muted">newest first</span></h2>
      <div id="events" class="events"><div class="empty">Waiting for cluster data&hellip;</div></div>
    </section>
  </div>

  <footer>Version colours: <span id="legendColors"></span></footer>
</div>

<script>
(() => {
  const BOOT = ${boot};
  const COLORS = BOOT.colors;
  const $ = (id) => document.getElementById(id);
  const colorFor = (v) => COLORS[parseInt(String(v).split('.')[0], 10)] || '#ea580c';
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'style') Object.assign(n.style, v); else if (k === 'text') n.textContent = v; else n[k] = v;
    }
    for (const k of [].concat(kids)) if (k != null) n.append(k);
    return n;
  };
  const age = (s) => s == null ? '–' : s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' + (s % 60) + 's' : Math.floor(s / 3600) + 'h' + Math.floor((s % 3600) / 60) + 'm';
  const clock = (t) => new Date(t).toLocaleTimeString();

  // ---------- legend ----------
  for (const [major, c] of Object.entries(COLORS)) {
    $('legendColors').append(el('span', { style: { marginRight: '12px' } }, [el('i', { className: 'dot', style: { background: c, marginRight: '5px' } }), 'v' + major + '.x']));
  }

  // ---------- live traffic (load-balanced by the Service) ----------
  const history = []; const hits = new Map(); let ok = 0, failed = 0, latencySum = 0;
  async function pollTraffic() {
    const t0 = performance.now();
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      const d = await r.json();
      const ms = performance.now() - t0; ok++; latencySum += ms;
      history.push({ v: d.version, pod: d.pod });
      const h = hits.get(d.pod) || { v: d.version, n: 0 }; h.n++; h.v = d.version; h.last = Date.now(); hits.set(d.pod, h);
      $('conn').textContent = 'live · ' + Math.round(ms) + ' ms';
      if (d.pod === BOOT.info.pod) {
        $('sUptime').textContent = age(d.uptimeSeconds); $('sReq').textContent = d.requestsServed;
        $('sMem').textContent = d.runtime.memoryMB + ' MB'; $('sHeap').textContent = d.runtime.heapMB;
      }
    } catch (e) {
      failed++; history.push({ fail: true }); $('conn').textContent = 'request failed';
    }
    while (history.length > 60) history.shift();
    renderTraffic();
  }
  function renderTraffic() {
    $('strip').replaceChildren(...history.map((h) => el('i', h.fail ? { className: 'fail', title: 'failed' } : { title: 'v' + h.v + ' · ' + h.pod, style: { background: colorFor(h.v) } })));
    const counts = {}; history.forEach((h) => { if (!h.fail) counts[h.v] = (counts[h.v] || 0) + 1; });
    const total = history.filter((h) => !h.fail).length || 1;
    $('split').replaceChildren(...Object.entries(counts).map(([v, n]) => el('div', { title: 'v' + v + ': ' + n, style: { width: (100 * n / total) + '%', background: colorFor(v) } })));
    const chips = [
      el('span', { className: 'chip', text: 'Total ' + (ok + failed) }),
      el('span', { className: 'chip ok', text: 'Succeeded ' + ok }),
      el('span', { className: 'chip ' + (failed ? 'bad' : 'ok'), text: 'Failed ' + failed }),
      el('span', { className: 'chip', text: 'Avg latency ' + (ok ? Math.round(latencySum / ok) : 0) + ' ms' }),
      ...Object.entries(counts).map(([v, n]) => el('span', { className: 'chip' }, [el('i', { className: 'dot', style: { background: colorFor(v) } }), 'v' + v + ': ' + Math.round(100 * n / total) + '%'])),
    ];
    $('trafficStats').replaceChildren(...chips);
    const rows = [...hits.entries()].sort((a, b) => b[1].last - a[1].last).slice(0, 8).map(([pod, h]) =>
      el('tr', {}, [el('td', { className: 'mono', text: pod }),
        el('td', {}, [el('span', { className: 'chip' }, [el('i', { className: 'dot', style: { background: colorFor(h.v) } }), 'v' + h.v])]),
        el('td', { text: h.n }), el('td', { className: 'muted', text: Math.round((Date.now() - h.last) / 1000) + 's ago' })]));
    $('podsHit').replaceChildren(...rows);
  }

  // ---------- health probes of the pod that served this page ----------
  async function probe(path, dot, txt) {
    try {
      const r = await fetch(path, { cache: 'no-store' }); const d = await r.json();
      $(dot).style.background = r.ok ? 'var(--ok)' : 'var(--bad)';
      $(txt).textContent = r.status + ' ' + d.status + (d.reason ? ' (' + d.reason + ')' : '') + ' · checked ' + new Date().toLocaleTimeString();
    } catch (e) { $(dot).style.background = 'var(--bad)'; $(txt).textContent = 'unreachable'; }
  }
  const pollProbes = () => { probe('/health', 'liveDot', 'liveTxt'); probe('/ready', 'readyDot', 'readyTxt'); };

  // ---------- cluster view ----------
  const STEPS = [
    ['New revision', 'Deployment template changed, new ReplicaSet created'],
    ['Surge pod', 'maxSurge allows one extra pod to start'],
    ['Readiness gate', 'new pod must pass /ready before it gets traffic'],
    ['Scale down old', 'one old pod drained per ready new pod'],
    ['Complete', 'all pods run the new revision'],
  ];
  function stepState(d) {
    if (d.phase === 'complete') return { done: 5, active: -1, fail: -1 };
    if (d.phase === 'failed') return { done: 2, active: -1, fail: 2 };
    const newPodsReady = d.updated > 0 && d.available >= Math.min(d.updated, d.desired);
    if (d.updated === 0) return { done: 1, active: 1, fail: -1 };
    if (!newPodsReady) return { done: 2, active: 2, fail: -1 };
    return { done: 3, active: 3, fail: -1 };
  }
  function renderCluster(c) {
    if (!c.available) {
      const msg = 'Cluster view unavailable: ' + c.reason + '. Deploy to Kubernetes to see the rollout live.';
      for (const id of ['rolloutBody', 'pods', 'revisions', 'events']) $(id).replaceChildren(el('div', { className: 'empty', text: msg }));
      $('phase').textContent = 'n/a'; $('phase').className = 'chip'; return;
    }
    const d = c.deployment;
    const phaseLabel = { complete: 'Complete', progressing: 'Rolling update in progress', failed: 'Failed: progress deadline exceeded' }[d.phase];
    $('phase').textContent = phaseLabel; $('phase').className = 'chip ' + ({ complete: 'ok', progressing: 'warn', failed: 'bad' }[d.phase]);
    $('sReplicas').textContent = d.ready + ' / ' + d.desired;

    const st = stepState(d);
    const steps = el('div', { className: 'steps' }, STEPS.map(([t, s], i) =>
      el('div', { className: 'step ' + (i === st.fail ? 'fail' : i === st.active ? 'active' : i < st.done ? 'done' : '') }, [el('b', { text: (i + 1) + '. ' + t }), s])));
    const bar = (label, n) => el('div', { className: 'bar' }, [el('span', { text: label }),
      el('div', { className: 'track' }, [el('div', { className: 'fill', style: { width: Math.min(100, 100 * n / d.desired) + '%', background: n >= d.desired ? 'var(--ok)' : 'var(--warn)' } })]),
      el('span', { className: 'mono', text: n + '/' + d.desired })]);
    const failNote = d.phase === 'failed'
      ? el('p', { className: 'chip bad', style: { marginTop: '10px', whiteSpace: 'normal' }, text: 'New pods never became Ready within ' + d.progressDeadlineSeconds + ' s. Old pods are still serving; update.sh will run kubectl rollout undo.' })
      : null;
    $('rolloutBody').replaceChildren(
      el('div', { className: 'kv' }, [
        el('span', { className: 'chip' }, [el('i', { className: 'dot', style: { background: colorFor(d.version) } }), 'target v' + d.version]),
        el('span', { className: 'chip', text: 'revision ' + d.revision }),
        el('span', { className: 'chip', text: d.strategy + ' · maxSurge ' + d.maxSurge + ' · maxUnavailable ' + d.maxUnavailable }),
        el('span', { className: 'chip', text: 'deadline ' + d.progressDeadlineSeconds + ' s · minReady ' + d.minReadySeconds + ' s' }),
      ]),
      el('p', { className: 'muted', style: { margin: '10px 0 0' }, text: 'Change-cause: ' + (d.changeCause || '–') }),
      steps,
      el('div', { className: 'bars' }, [bar('Updated', d.updated), bar('Ready', d.ready), bar('Available', d.available), bar('Total pods', d.current)]),
      ...(failNote ? [failNote] : []));

    $('podCount').textContent = c.pods.length + ' pods';
    $('pods').replaceChildren(...c.pods.map((p) => {
      const col = colorFor(p.version);
      const status = p.terminating ? 'Terminating' : p.ready ? 'Ready' : p.phase === 'Running' ? 'Running · NOT Ready' : p.phase;
      return el('div', { className: 'pod' + (p.ready ? '' : ' notready') + (p.terminating ? ' term' : '') + (p.name === BOOT.info.pod ? ' me' : ''),
        style: { borderColor: col, background: p.ready && !p.terminating ? col + '22' : '#0f172a' } }, [
        el('div', { className: 'pv', style: { color: col }, text: 'v' + p.version }),
        el('div', { className: 'pn', text: p.name }),
        el('div', {}, [el('span', { className: 'chip ' + (p.terminating ? '' : p.ready ? 'ok' : 'bad'), text: status })]),
        el('div', { className: 'muted', style: { marginTop: '6px' }, text: 'age ' + age(p.ageSeconds) + ' · restarts ' + p.restarts + (p.ip ? ' · ' + p.ip : '') }),
      ]);
    }));

    $('revisions').replaceChildren(el('table', {}, [
      el('thead', {}, [el('tr', {}, ['Rev', 'Version', 'Pods', 'Change-cause'].map((h) => el('th', { text: h })))]),
      el('tbody', {}, c.replicaSets.map((rs) => el('tr', { className: rs.current ? 'current' : '' }, [
        el('td', { className: 'mono', text: rs.revision + (rs.current ? ' ◀' : '') }),
        el('td', {}, [el('span', { className: 'chip' }, [el('i', { className: 'dot', style: { background: colorFor(rs.version) } }), 'v' + rs.version])]),
        el('td', { className: 'mono', text: rs.ready + '/' + rs.desired }),
        el('td', { text: rs.changeCause || '–' }),
      ]))),
    ]));

    $('events').replaceChildren(...(c.events.length ? c.events.map((e) => el('div', { className: 'ev ' + e.type }, [
      el('span', { className: 't', text: clock(e.time) }), el('span', { className: 'r', text: e.reason + (e.count > 1 ? ' ×' + e.count : '') }),
      el('span', {}, [el('span', { className: 'muted mono', text: e.object + ' ' }), e.message])])) : [el('div', { className: 'empty', text: 'No recent events' })]));
  }
  async function pollCluster() {
    try { renderCluster(await (await fetch('/api/cluster', { cache: 'no-store' })).json()); }
    catch (e) { /* the next poll will retry */ }
  }

  pollTraffic(); pollProbes(); pollCluster();
  setInterval(pollTraffic, 1000); setInterval(pollProbes, 3000); setInterval(pollCluster, 2000);
})();
</script>
</body>
</html>`;
}

module.exports = { renderPage };
