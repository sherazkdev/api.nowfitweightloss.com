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
      '<h3>Auth + lang are required</h3>',
      '<p>Content GETs return <strong>401</strong> with no data unless you send <code>x-api-key</code> or Bearer JWT. Use <strong>Authorize</strong> (or the auth panel) first.</p>',
      '<p>Every content GET also needs the <strong>lang</strong> dropdown. It is not a header.</p>',
      '<ol>',
      '<li>Authorize with an API key or Bearer token.</li>',
      '<li>Open a GET (try <code>/api/v1/meals</code>).</li>',
      '<li>Click <strong>Try it out</strong> if the fields are locked.</li>',
      '<li>Set <strong>lang</strong> (example: <code>hi</code>) — this is required — then <strong>Execute</strong>.</li>',
      '</ol>',
      '<p style="margin-top:8px">Without auth: 401. Without lang: 422. Missing translations still fall back to English.</p>'
    ].join('');
    root.insertBefore(panel, root.firstChild);
  }
  mount(0);
})();
`;
