/** Injected into Swagger UI — quick login + API key authorize panel. */
export const SWAGGER_AUTH_THEME_CSS = `
#wl-auth-panel {
  font-family: Inter, system-ui, sans-serif;
  margin: 0 0 16px;
  padding: 16px 18px;
  border: 1px solid rgb(28 28 28 / 0.12);
  border-radius: 12px;
  background: #f7f9fb;
}
#wl-auth-panel h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}
#wl-auth-panel p {
  margin: 0 0 12px;
  font-size: 12px;
  color: rgb(28 28 28 / 0.55);
}
#wl-auth-panel .wl-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 10px;
}
#wl-auth-panel label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: rgb(28 28 28 / 0.55);
  min-width: 140px;
}
#wl-auth-panel input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgb(28 28 28 / 0.15);
  border-radius: 8px;
  font-size: 13px;
}
#wl-auth-panel button {
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: #1c1c1c;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
#wl-auth-panel button.secondary {
  background: #fff;
  color: #1c1c1c;
  border: 1px solid rgb(28 28 28 / 0.15);
}
#wl-auth-panel .wl-msg {
  font-size: 12px;
  margin-top: 6px;
}
#wl-auth-panel .wl-msg.ok { color: #0a7a50; }
#wl-auth-panel .wl-msg.err { color: #c62828; }
#wl-auth-panel .wl-divider {
  height: 1px;
  background: rgb(28 28 28 / 0.1);
  margin: 12px 0;
}
`;

export const SWAGGER_AUTH_THEME_JS = `
(function () {
  function waitForUi(cb, tries) {
    if (window.ui && window.ui.authActions) return cb(window.ui);
    if ((tries || 0) > 80) return;
    setTimeout(function () { waitForUi(cb, (tries || 0) + 1); }, 100);
  }

  function setMsg(el, text, ok) {
    el.textContent = text;
    el.className = 'wl-msg ' + (ok ? 'ok' : 'err');
  }

  function authorizeBearer(ui, token) {
    ui.authActions.authorize({
      BearerAuth: {
        name: 'BearerAuth',
        schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        value: token
      }
    });
  }

  function authorizeApiKey(ui, key) {
    ui.authActions.authorize({
      ApiKeyAuth: {
        name: 'x-api-key',
        schema: { type: 'apiKey', in: 'header', name: 'x-api-key' },
        value: key
      }
    });
  }

  waitForUi(function (ui) {
    var root = document.getElementById('swagger-ui');
    if (!root || document.getElementById('wl-auth-panel')) return;

    var panel = document.createElement('div');
    panel.id = 'wl-auth-panel';
    panel.innerHTML = [
      '<h3>Authentication</h3>',
      '<p>Use <strong>Bearer JWT</strong> (from login) or <strong>x-api-key</strong> (from Admin → API Keys). Paste only the token value — not the full JSON response.</p>',
      '<p>To GET localized public meals/exercises, open <a href="/docs/public"><strong>Public Swagger</strong></a> and use the <strong>lang</strong> dropdown — it is not on this admin page.</p>',
      '<div class="wl-row">',
      '  <label>Email<input type="email" id="wl-email" placeholder="admin@example.com" /></label>',
      '  <label>Password<input type="password" id="wl-password" placeholder="••••••••" /></label>',
      '  <button type="button" id="wl-login-btn">Login → set Bearer</button>',
      '</div>',
      '<div class="wl-divider"></div>',
      '<div class="wl-row">',
      '  <label style="flex:1;min-width:220px">Bearer JWT<input type="text" id="wl-bearer" placeholder="eyJhbG…" /></label>',
      '  <button type="button" id="wl-bearer-btn">Apply Bearer</button>',
      '</div>',
      '<div class="wl-row">',
      '  <label style="flex:1;min-width:220px">x-api-key<input type="text" id="wl-apikey" placeholder="wl_…" /></label>',
      '  <button type="button" id="wl-apikey-btn">Apply x-api-key</button>',
      '  <button type="button" class="secondary" id="wl-clear-btn">Clear auth</button>',
      '</div>',
      '<div id="wl-auth-msg" class="wl-msg"></div>'
    ].join('');

    root.insertBefore(panel, root.firstChild);

    var msg = document.getElementById('wl-auth-msg');

    document.getElementById('wl-login-btn').addEventListener('click', function () {
      var email = document.getElementById('wl-email').value.trim();
      var password = document.getElementById('wl-password').value;
      if (!email || !password) {
        setMsg(msg, 'Email and password required.', false);
        return;
      }
      setMsg(msg, 'Signing in…', true);
      fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          var token = res.d && res.d.data && res.d.data.accessToken;
          if (!token) {
            setMsg(msg, (res.d && res.d.error && res.d.error.message) || 'Login failed', false);
            return;
          }
          document.getElementById('wl-bearer').value = token;
          authorizeBearer(ui, token);
          setMsg(msg, 'Bearer token applied. You can call protected endpoints.', true);
        })
        .catch(function (e) {
          setMsg(msg, String(e), false);
        });
    });

    document.getElementById('wl-bearer-btn').addEventListener('click', function () {
      var token = document.getElementById('wl-bearer').value.trim();
      if (!token) {
        setMsg(msg, 'Paste a JWT access token.', false);
        return;
      }
      if (token.startsWith('{')) {
        try {
          var parsed = JSON.parse(token);
          token = (parsed.data && parsed.data.accessToken) || parsed.accessToken || token;
        } catch (e) { /* keep raw */ }
      }
      token = token.replace(/^Bearer\\s+/i, '');
      authorizeBearer(ui, token);
      setMsg(msg, 'Bearer token applied.', true);
    });

    document.getElementById('wl-apikey-btn').addEventListener('click', function () {
      var key = document.getElementById('wl-apikey').value.trim();
      if (!key) {
        setMsg(msg, 'Paste an x-api-key value (wl_…).', false);
        return;
      }
      authorizeApiKey(ui, key);
      setMsg(msg, 'x-api-key applied.', true);
    });

    document.getElementById('wl-clear-btn').addEventListener('click', function () {
      ui.authActions.logout(['BearerAuth', 'ApiKeyAuth']);
      setMsg(msg, 'Authorization cleared.', true);
    });
  });
})();
`;
