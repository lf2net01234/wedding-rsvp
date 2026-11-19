/* 後端呼叫。網址帶 ?mock=1 用 localStorage 假後端；?mock=closed 模擬已截止。 */
var api = (function () {
  var params = new URLSearchParams(location.search);
  var mock = params.get('mock');
  var MOCK_KEY = 'rsvp-mock';

  function mockDb() {
    try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || { byToken: {}, byClient: {} }; }
    catch (e) { return { byToken: {}, byClient: {} }; }
  }
  function saveDb(db) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(db)); } catch (e) {} }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 600); }); }

  var mockApi = {
    loadConfig: function () { return delay({ ok: true, closed: mock === 'closed' }); },
    load: function (token) {
      var p = mockDb().byToken[token];
      return delay(p ? { ok: true, payload: p, closed: mock === 'closed' } : { ok: false, error: 'not_found' });
    },
    submit: function (payload) {
      if (mock === 'closed') return delay({ ok: false, error: 'closed' });
      var v = validatePayload(payload);
      if (!v.ok) return delay({ ok: false, error: 'invalid', errors: v.errors });
      var db = mockDb();
      var token = payload.token;
      if (!token) {
        token = db.byClient[payload.clientId] || Math.random().toString(36).slice(2) + Date.now().toString(36);
        db.byClient[payload.clientId] = token;
      } else if (!db.byToken[token]) {
        return delay({ ok: false, error: 'not_found' });
      }
      var stored = JSON.parse(JSON.stringify(payload)); delete stored.token;
      db.byToken[token] = stored;
      saveDb(db);
      console.log('[RSVP mock] saved', token, stored);
      return delay({ ok: true, token: token });
    }
  };

  function call(url, opts) {
    return fetch(url, opts).then(function (r) { return r.json(); })
      .catch(function (e) { console.error('[RSVP] network', e); return { ok: false, error: 'network' }; });
  }

  var realApi = {
    loadConfig: function () {
      if (!API_URL) return Promise.resolve({ ok: true, closed: false });
      return call(API_URL + '?action=config');
    },
    load: function (token) { return call(API_URL + '?action=load&t=' + encodeURIComponent(token)); },
    submit: function (payload) {
      // text/plain 避免 CORS preflight（Apps Script 不處理 OPTIONS）
      return call(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    }
  };

  return mock ? mockApi : realApi;
})();
