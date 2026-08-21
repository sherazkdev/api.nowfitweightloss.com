type LandingOptions = {
  docsEnabled: boolean;
  appVersion: string;
  adminUrl: string;
};

export function renderApiLandingHtml(options: LandingOptions): string {
  const publicBase = "/api/v1";
    const docsAdmin = options.docsEnabled
    ? `<a class="card link-card" href="/docs"><span class="card-label">Admin Swagger</span><span class="card-desc">Login, content CRUD, media upload</span></a>`
    : "";
  const docsPublic = options.docsEnabled
    ? `<a class="card link-card" href="/docs/public"><span class="card-label">Swagger / Try API</span><span class="card-desc">Authorize with x-api-key, then pick lang</span></a>`
    : "";
  const docsCta = options.docsEnabled
    ? `<a class="cta" href="/docs/public">Swagger / Try API →</a>
      <p class="hint">Authorize with <strong>x-api-key</strong> or Bearer first (401 without it). Then: Try it out → <strong>lang</strong> → Execute. Example: <code>/api/v1/meals?lang=hi</code></p>`
    : `<a class="cta" href="${options.adminUrl}/endpoints">Browse all endpoints →</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WeightLoss API</title>
  <style>
    :root {
      --bg: #ffffff;
      --card: #f7f9fb;
      --ink: #1c1c1c;
      --muted: rgb(28 28 28 / 0.45);
      --border: rgb(28 28 28 / 0.1);
      --accent: #95a4fc;
      --accent-soft: #e5ecf6;
      --green: #a1e3cb;
      --blue: #e3f5ff;
      --sans: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: var(--sans); background: var(--bg); color: var(--ink); line-height: 1.5; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
    .hero { display: grid; gap: 20px; margin-bottom: 32px; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: var(--blue); font-size: 12px; font-weight: 500; }
    h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.15; margin: 0; letter-spacing: -0.02em; }
    .lead { font-size: 16px; color: var(--muted); max-width: 62ch; margin: 0; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin: 24px 0 32px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; min-height: 88px; }
    .link-card { text-decoration: none; color: inherit; transition: border-color .15s, transform .15s; display: block; }
    .link-card:hover { border-color: var(--accent); transform: translateY(-1px); }
    .card-label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .card-desc { display: block; font-size: 12px; color: var(--muted); }
    .pill { font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: #fff; display: inline-block; margin-right: 8px; }
    .pill.ok { background: var(--green); border-color: transparent; }
    .pill.pending { background: var(--accent-soft); }
    .cta { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 16px; border-radius: 10px; background: var(--ink); color: #fff; text-decoration: none; font-size: 14px; }
    .hint { font-size: 14px; color: var(--muted); max-width: 62ch; margin: 12px 0 0; }
    .hint code { font-size: 12px; background: var(--card); padding: 1px 6px; border-radius: 4px; }
    footer { margin-top: 48px; font-size: 12px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 16px; }
    .footer-links a { color: var(--muted); text-decoration: none; margin-right: 14px; }
    .footer-links a:hover { color: var(--ink); text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <span class="badge">⚡ WeightLoss Content API · v${options.appVersion}</span>
      <h1>Meals &amp; workouts for mobile apps</h1>
      <p class="lead">
        Production JSON API with ETags, Redis caching, and BullMQ imports.
        Try live requests in Swagger — including a <strong>lang</strong> dropdown on every public GET.
      </p>
      <div id="status-row">
        <span class="pill pending" id="health-pill">Checking health…</span>
        <span class="pill pending" id="ready-pill">Checking ready…</span>
      </div>
      ${docsCta}
    </div>

    <div class="grid">
      ${docsPublic}
      ${docsAdmin}
      <a class="card link-card" href="${options.adminUrl}/endpoints"><span class="card-label">Endpoint reference</span><span class="card-desc">Public + admin routes, auth, live fetch</span></a>
      <a class="card link-card" href="${publicBase}/"><span class="card-label">API Discovery</span><span class="card-desc">JSON index of public endpoints</span></a>
      <a class="card link-card" href="${publicBase}/openapi.json"><span class="card-label">OpenAPI Spec</span><span class="card-desc">Machine-readable schema</span></a>
      <a class="card link-card" href="/health"><span class="card-label">Health</span><span class="card-desc">Liveness probe</span></a>
      <a class="card link-card" href="/ready"><span class="card-label">Ready</span><span class="card-desc">Mongo + Redis readiness</span></a>
      <a class="card link-card" href="/metrics"><span class="card-label">Prometheus</span><span class="card-desc">Request &amp; cache metrics</span></a>
      <a class="card link-card" href="${options.adminUrl}/admin/settings/api-keys"><span class="card-label">API Keys</span><span class="card-desc">Generate x-api-key tokens</span></a>
      <a class="card link-card" href="${options.adminUrl}"><span class="card-label">Admin Panel</span><span class="card-desc">Sign in to manage content</span></a>
    </div>

    <footer>
      <span>© 2026 WeightLoss Pro · snowui</span>
      <span class="footer-links">
        <a href="${options.adminUrl}/admin/login">Admin login</a>
        <a href="${options.adminUrl}/endpoints">Endpoints</a>
        <a href="/docs/public">Swagger / Try API</a>
        <a href="/docs">Admin Swagger</a>
      </span>
    </footer>
  </div>
  <script>
    (function () {
      function setPill(id, ok, label) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = label;
        el.className = 'pill ' + (ok ? 'ok' : 'pending');
        if (ok) el.className = 'pill ok';
      }
      fetch('/health').then(function (r) { return r.json(); }).then(function () {
        setPill('health-pill', true, 'Health OK');
      }).catch(function () { setPill('health-pill', false, 'Health unreachable'); });
      fetch('/ready').then(function (r) { return r.json(); }).then(function (body) {
        setPill('ready-pill', body && body.success, body && body.success ? 'Ready (mongo + redis)' : 'Not ready');
      }).catch(function () { setPill('ready-pill', false, 'Ready check failed'); });
    })();
  </script>
</body>
</html>`;
}
