/** Injected into public Swagger UI — how to pick lang. */
export const SWAGGER_PUBLIC_THEME_CSS = `
#wl-lang-panel {
  font-family: Inter, system-ui, sans-serif;
  margin: 0 0 16px;
  padding: 16px 18px;
  border: 1px solid rgb(28 28 28 / 0.12);
  border-radius: 12px;
  background: #e3f5ff;
}
#wl-lang-panel h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}
#wl-lang-panel p, #wl-lang-panel ol {
  margin: 0;
  font-size: 13px;
  color: rgb(28 28 28 / 0.75);
}
#wl-lang-panel ol {
  margin: 8px 0 0;
  padding-left: 18px;
}
#wl-lang-panel code {
  font-size: 12px;
  background: #fff;
  padding: 1px 6px;
  border-radius: 4px;
}
`;

export const SWAGGER_PUBLIC_THEME_JS = `
(function () {
  function mount(tries) {
    var root = document.getElementById('swagger-ui');
    if (!root) {
      if ((tries || 0) > 80) return;
      setTimeout(function () { mount((tries || 0) + 1); }, 100);
      return;
    }
    if (document.getElementById('wl-lang-panel')) return;
    var panel = document.createElement('div');
    panel.id = 'wl-lang-panel';
    panel.innerHTML = [
      '<h3>Content vs reminders</h3>',
      '<p><strong>Meals/workouts:</strong> Authorize with <code>x-api-key</code> or admin Bearer, then pick <strong>lang</strong> on each GET.</p>',
      '<p><strong>Reminders/devices:</strong> Authorize with a <strong>Firebase ID token</strong>. GET reminders needs query <code>gender=male|female</code>. No lang param.</p>',
      '<ol>',
      '<li>Content: Authorize → open <code>/api/v1/meals</code> → set <strong>lang</strong> → Execute.</li>',
      '<li>Reminders: Authorize Firebase token → open tag <strong>Reminders</strong> → set params/body → Execute.</li>',
      '</ol>',
      '<p style="margin-top:8px">Content without auth: 401. Content without lang: 422. Reminders without Firebase token: 401.</p>'
    ].join('');
    root.insertBefore(panel, root.firstChild);
  }
  mount(0);
})();
`;
