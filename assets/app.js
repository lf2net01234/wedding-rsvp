/* 頁面渲染與互動。依賴 config.js、rules.js、form-state.js、api.js（皆為全域）。 */
(function () {
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  var ERR_TEXT = {
    name: '請填寫您的名字',
    side: '請選擇您是哪一方的親友',
    attend: '請選擇是否能出席',
    count_range: '請選擇出席人數',
    people_count: '請選擇出席人數',
    phone: '請填寫手機號碼',
    contact: '請填寫 Email 或 LINE ID',
    main: '請選擇這位的主菜'
  };

  var params = new URLSearchParams(location.search);
  var state = {
    clientId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    token: '', name: '', side: '', attend: '', count: 1, people: resizePeople([], 1),
    transport: '', wheelchair: false, phone: '', contact: '', message: ''
  };
  var readOnly = false;
  var renderedPeople = 0;

  /* ---------- 靜態選項 ---------- */
  function radioList(container, name, options) {
    container.innerHTML = Object.keys(options).map(function (k) {
      return '<label class="opt"><input type="radio" name="' + name + '" value="' + k + '"><span>' + esc(options[k]) + '</span></label>';
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setRadio(name, value) {
    $$('input[name="' + name + '"]').forEach(function (i) { i.checked = i.value === value; });
  }

  /* ---------- 區段顯示 ---------- */
  function updateSteps() {
    var steps = stepsFor(state.attend);
    $$('#rsvp [data-step]').forEach(function (el) { el.hidden = steps.indexOf(el.dataset.step) < 0; });
    $('#submit-btn').textContent = state.token ? '更新回覆' : '送出回覆';
    if (readOnly) $('[data-step="done"]').hidden = true;
  }

  /* ---------- 點餐卡 ---------- */
  function renderPeople() {
    var box = $('#people');
    box.innerHTML = state.people.map(personHtml).join('');
    $$('.person', box).forEach(function (el, i) { if (i >= renderedPeople) el.classList.add('new'); });
    renderedPeople = state.people.length;
    if (readOnly) $$('input,select,textarea', box).forEach(function (x) { x.disabled = true; });
  }

  function personHtml(p, i) {
    var menu = MENU[p.diet];
    var mains = Object.keys(menu.mains).map(function (k) {
      return '<label class="opt"><input type="radio" name="main-' + i + '" value="' + k + '" data-act="main" data-i="' + i + '"' +
        (p.main === k ? ' checked' : '') + '><span>' + esc(menu.mains[k]) + '</span></label>';
    }).join('');
    var courses = menu.courses.map(function (c) { return '<dt>' + esc(c[0]) + '</dt><dd>' + esc(c[1]) + '</dd>'; }).join('');
    var chips = ALLERGENS.map(function (a) {
      return '<label class="chip"><input type="checkbox" data-act="alg" data-i="' + i + '" value="' + esc(a) + '"' +
        (p.allergies.indexOf(a) >= 0 ? ' checked' : '') + '><span>' + esc(a) + '</span></label>';
    }).join('');
    var seg = ['meat', 'veg'].map(function (d) {
      return '<label class="opt"><input type="radio" name="diet-' + i + '" value="' + d + '" data-act="diet" data-i="' + i + '"' +
        (p.diet === d ? ' checked' : '') + '><span>' + (d === 'meat' ? '葷食' : '素食') + '</span></label>';
    }).join('');
    return '<div class="person" data-person="' + i + '">' +
      '<div class="person-hd">第 ' + (i + 1) + ' 位</div><div class="person-bd">' +
      '<div class="field"><label class="q" for="p-label-' + i + '">稱呼</label>' +
      '<input id="p-label-' + i + '" data-act="label" data-i="' + i + '" maxlength="20" value="' + esc(p.label) + '" placeholder="' +
      (i === 0 ? '沒填就用您的名字' : '例如：王媽媽、小寶') + '"></div>' +
      '<div class="seg">' + seg + '</div>' +
      '<fieldset class="field"><legend class="q">主菜三選一 <i>*</i></legend><div class="opts">' + mains + '</div>' +
      (p.diet === 'veg' ? '<p class="veg-note">＊此套餐為蛋奶素（含起司、奶酪）</p>' : '') +
      '<p class="err" data-err="main_' + i + '"></p>' +
      '<details><summary>看' + menu.label + '完整內容</summary><dl class="courses">' + courses + '</dl></details></fieldset>' +
      '<div class="field"><label class="check"><input type="checkbox" data-act="child" data-i="' + i + '"' + (p.child ? ' checked' : '') +
      '><span>這位是小朋友</span></label>' +
      (p.child ? '<label class="check"><input type="checkbox" data-act="highChair" data-i="' + i + '"' + (p.highChair ? ' checked' : '') +
        '><span>需要兒童椅</span></label>' : '') + '</div>' +
      '<div class="field"><span class="q">過敏／不吃的食材</span><div class="chips">' + chips + '</div>' +
      '<input data-act="algOther" data-i="' + i + '" maxlength="50" placeholder="其他，請說明" value="' + esc(p.allergyOther) + '" style="margin-top:8px">' +
      '<p class="allergy-note">有過敏的賓客，餐廳主廚會為您替換適合的菜色</p></div>' +
      '</div></div>';
  }

  function onPeopleEvent(e) {
    var t = e.target, act = t.dataset.act;
    if (!act) return;
    var i = Number(t.dataset.i), p = state.people[i];
    if (act === 'label') { p.label = t.value; return; }
    if (act === 'algOther') { p.allergyOther = t.value; return; }
    if (e.type !== 'change') return;
    if (act === 'diet') state.people[i] = setDiet(p, t.value);
    else if (act === 'main') { p.main = t.value; clearErr('main_' + i); return; }
    else if (act === 'child') state.people[i] = setChild(p, t.checked);
    else if (act === 'highChair') { p.highChair = t.checked; return; }
    else if (act === 'alg') {
      p.allergies = t.checked ? p.allergies.concat([t.value]) : p.allergies.filter(function (a) { return a !== t.value; });
      return;
    }
    renderPeople();
  }

  /* ---------- 錯誤顯示 ---------- */
  function clearErr(code) {
    var el = $('[data-err="' + code + '"]');
    if (el) { el.textContent = ''; var f = el.closest('.field'); if (f) f.classList.remove('has-err'); }
  }
  function showErrors(codes) {
    $$('[data-err]').forEach(function (el) { el.textContent = ''; var f = el.closest('.field'); if (f) f.classList.remove('has-err'); });
    var first = null;
    codes.forEach(function (c) {
      var el = $('[data-err="' + c + '"]');
      if (!el && c === 'people_count') el = $('[data-err="count_range"]');
      if (!el) return;
      el.textContent = /^main_/.test(c) ? ERR_TEXT.main : (ERR_TEXT[c] || '請檢查這一欄');
      var f = el.closest('.field'); if (f) f.classList.add('has-err');
      if (!first) first = el;
    });
    if (first) {
      var target = first.closest('.field') || first;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = $('input,select,textarea', target);
      if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 400);
    }
  }

  /* ---------- 送出 ---------- */
  var submitting = false;
  function onSubmit(e) {
    e.preventDefault();
    if (submitting || readOnly) return;
    var payload = toPayload(state);
    var v = validatePayload(payload);
    $('#submit-err').textContent = '';
    if (!v.ok) { console.log('[RSVP] validate fail', v.errors); showErrors(v.errors); return; }
    submitting = true;
    var btn = $('#submit-btn');
    btn.disabled = true; btn.textContent = '送出中…';
    api.submit(payload).then(function (res) {
      console.log('[RSVP] submit result', res);
      if (res.ok) return showDone(payload, res.token);
      submitting = false; btn.disabled = false; updateSteps();
      if (res.error === 'closed') { setClosed(); return; }
      if (res.error === 'invalid' && res.errors) { showErrors(res.errors); return; }
      $('#submit-err').textContent = '送出失敗，請稍後再試；一直失敗的話請私訊新人。';
    });
  }

  function editUrl(token) {
    var base = (typeof SITE_URL !== 'undefined' && SITE_URL) ? SITE_URL : location.origin + location.pathname;
    var mock = params.get('mock');
    return base + '?t=' + encodeURIComponent(token) + (mock ? '&mock=' + mock : '');
  }

  function showDone(p, token) {
    var wasEdit = !!state.token;
    $('#rsvp').hidden = true;
    var lines = ['<p><b>' + esc(p.name) + '</b>（' + esc(SIDES[p.side]) + '）</p>', '<p>' + esc(ATTEND[p.attend]) + '</p>'];
    if (isAttending(p.attend)) {
      lines.push('<p>出席 ' + p.count + ' 位：</p>');
      p.people.forEach(function (x, i) {
        lines.push('<p>　' + (i + 1) + '. ' + esc(x.label || '') + '　' + esc(MENU[x.diet].label) + '－' + esc(MENU[x.diet].mains[x.main]) +
          (x.child ? '（小朋友）' : '') + '</p>');
      });
    }
    $('#done-title').textContent = wasEdit ? '已更新您的回覆！' : '謝謝您的回覆！';
    $('#done-summary').innerHTML = lines.join('');
    $('#done-link').value = editUrl(token);
    $('#done-edit').hidden = false;
    $('#done').hidden = false;
    $('#done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setClosed() {
    $('#closed-banner').hidden = false;
    if (!state.token) { $('#rsvp').hidden = true; return; }
    readOnly = true;
    $$('#rsvp input, #rsvp select, #rsvp textarea').forEach(function (x) { x.disabled = true; });
    updateSteps();
  }

  /* ---------- 載入既有回覆 ---------- */
  function fillForm(p) {
    state.name = p.name; state.side = p.side; state.attend = p.attend;
    state.count = isAttending(p.attend) ? p.count : 1;
    state.people = isAttending(p.attend) ? p.people.map(function (x) { return Object.assign(emptyPerson(), x); }) : resizePeople([], 1);
    state.transport = p.transport || ''; state.wheelchair = !!p.wheelchair;
    state.phone = p.phone || ''; state.contact = p.contact || ''; state.message = p.message || '';
    $('#f-name').value = state.name;
    setRadio('side', state.side); setRadio('attend', state.attend); setRadio('transport', state.transport);
    $('#f-count').value = String(state.count);
    $('#f-wheelchair').checked = state.wheelchair;
    $('#f-phone').value = state.phone; $('#f-contact').value = state.contact; $('#f-message').value = state.message;
    renderedPeople = state.people.length;
    renderPeople();
    updateSteps();
  }

  /* ---------- 事件綁定 ---------- */
  function bind() {
    $('#f-name').addEventListener('input', function (e) { state.name = e.target.value; clearErr('name'); });
    $('#f-side').addEventListener('change', function (e) { state.side = e.target.value; clearErr('side'); });
    $('#f-attend').addEventListener('change', function (e) {
      state.attend = e.target.value; clearErr('attend'); updateSteps();
    });
    $('#f-count').addEventListener('change', function (e) {
      state.count = Number(e.target.value);
      state.people = resizePeople(state.people, state.count);
      renderedPeople = Math.min(renderedPeople, state.count);
      clearErr('count_range');
      renderPeople();
    });
    $('#people').addEventListener('change', onPeopleEvent);
    $('#people').addEventListener('input', onPeopleEvent);
    $('#f-transport').addEventListener('change', function (e) { state.transport = e.target.value; });
    $('#f-wheelchair').addEventListener('change', function (e) { state.wheelchair = e.target.checked; });
    $('#f-phone').addEventListener('input', function (e) { state.phone = e.target.value; clearErr('phone'); });
    $('#f-contact').addEventListener('input', function (e) { state.contact = e.target.value; clearErr('contact'); });
    $('#f-message').addEventListener('input', function (e) { state.message = e.target.value; });
    $('#rsvp').addEventListener('submit', onSubmit);
    $('#copy-btn').addEventListener('click', function () {
      var input = $('#done-link'), btn = this;
      var ok = function () { btn.textContent = '已複製 ✓'; setTimeout(function () { btn.textContent = '複製'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(ok, function () { input.select(); });
      else { input.select(); try { document.execCommand('copy'); ok(); } catch (err) {} }
    });
  }

  function reveal() {
    if (!('IntersectionObserver' in window)) { $$('.reveal').forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.08 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  }

  function init() {
    radioList($('#f-side'), 'side', SIDES);
    radioList($('#f-attend'), 'attend', ATTEND);
    radioList($('#f-transport'), 'transport', TRANSPORT);
    $('#f-count').innerHTML = [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '">' + n + ' 位</option>'; }).join('');
    bind();
    reveal();
    renderPeople();
    updateSteps();

    var token = params.get('t');
    api.loadConfig().then(function (cfg) {
      if (!token) { if (cfg.closed) setClosed(); return; }
      return api.load(token).then(function (res) {
        if (!res.ok) { $('#notfound-banner').hidden = false; $('#rsvp').hidden = true; return; }
        state.token = token;
        $('#edit-hint').hidden = false;
        fillForm(res.payload);
        if (res.closed) setClosed();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
