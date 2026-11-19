/* 婚禮回覆表單共用規則：網頁、Apps Script、Node 測試共用。
   不使用 module 語法；Node 端靠檔尾的 module.exports。 */

var MENU = {
  meat: {
    label: '葷食套餐',
    mains: { a: '美國精選無骨牛小排', b: '西班牙 Bellota 伊比利豬肋眼蓋', c: '爐烤巴黎奶油龍蝦' },
    courses: [
      ['前菜', '北海道帆立貝柱／東北角鮑魚／翠玉蔥油雞／繽紛沙拉'],
      ['湯品', '主廚慢熬南瓜海鮮濃湯'],
      ['主食', '熱那亞羅勒青醬鮮蝦燉飯'],
      ['主菜一', '清蒸紅條石斑／大院自釀鳳梨醬'],
      ['主菜二', '您選的這道'],
      ['甜點', '桂花春茶（慕斯）、季節繽紛水果'],
      ['飲料', '自助飲料吧']
    ]
  },
  veg: {
    label: '素食套餐',
    mains: { a: '焗烤日本茄子搭蕈菇堡', b: '焗烤栗子南瓜搭蕈菇堡', c: '焗烤紅甜椒搭蕈菇堡' },
    courses: [
      ['前菜', '四季水果／什錦堅果／馬芝瑞拉奶酪／繽紛沙拉搭檸檬沙拉醬'],
      ['湯品', '主廚慢熬南光蔬菜濃湯'],
      ['主食', '皮埃蒙特松露蕈菇燉飯'],
      ['主菜', '您選的這道'],
      ['甜點', '重乳酪起士蛋糕'],
      ['飲料', '濃厚奶香咖啡／無糖紅茶／柳橙汁']
    ]
  }
};

var SIDES = { groom: '男方親友－榕宸', bride: '女方親友－佩親', both: '共同好友' };

var ATTEND = {
  both: '要！午宴與晚宴時間都可以！',
  lunch: '要！只有午宴時間方便',
  dinner: '要！只有晚宴時間方便',
  card: '非常想去但無法出席，請寄喜帖給我沾沾喜氣',
  none: '當天無法出席，心意與祝福滿滿，不需寄送喜帖'
};

var TRANSPORT = {
  transit: '大眾運輸（捷運／公車）／步行',
  car: '開車前來',
  scooter: '機車',
  taxi: '計程車／親友接送'
};

var ALLERGENS = ['海鮮', '蝦蟹', '牛肉', '豬肉', '蛋奶', '堅果'];

var MAX_PEOPLE = 4;

function isAttending(attend) {
  return attend === 'both' || attend === 'lunch' || attend === 'dinner';
}

function str_(v) { return v == null ? '' : String(v).trim(); }

function validatePayload(p) {
  var errors = [];
  p = p || {};
  if (!str_(p.name)) errors.push('name');
  if (!SIDES.hasOwnProperty(p.side)) errors.push('side');
  if (!ATTEND.hasOwnProperty(p.attend)) errors.push('attend');

  var people = Array.isArray(p.people) ? p.people : [];
  if (isAttending(p.attend)) {
    var n = Number(p.count);
    if (!(n >= 1 && n <= MAX_PEOPLE && Math.floor(n) === n)) errors.push('count_range');
    if (people.length !== n) errors.push('people_count');
    people.forEach(function (x, i) {
      var menu = MENU[x && x.diet];
      if (!menu || !menu.mains.hasOwnProperty(x.main)) errors.push('main_' + i);
    });
  } else if (people.length !== 0) {
    errors.push('people_count');
  }

  if (p.attend !== 'none') {
    if (!str_(p.phone)) errors.push('phone');
    if (!str_(p.contact)) errors.push('contact');
  }
  return { ok: errors.length === 0, errors: errors };
}

/* ---------- 試算表欄位與轉換 ---------- */

var RESPONSE_COLS = ['送出時間', '最後修改', 'token', 'clientId', '名字', '親友', '出席', '人數', '交通', '輪椅',
  '手機', 'Email/LINE', '祝福', '安排場次', '場次來源', '場次有變動', '原始資料'];

var GUEST_COLS = ['token', '填表人', '稱呼', '場次', '餐別', '主菜', '小朋友', '兒童椅', '過敏'];

var SESSION_BY_ATTEND = { lunch: '午宴', dinner: '晚宴' };

function yesNo_(b) { return b ? '是' : '否'; }

/* 寫進試算表的文字：避免開頭 0 被吃掉、避免 = + - @ 開頭被當公式。試算表讀回時不含 ' */
function cellText_(v) {
  var s = str_(v);
  if (/^[=+\-@]/.test(s) || /^\d[\d\s\-()]*$/.test(s)) return "'" + s;
  return s;
}

function plain_(v) { return str_(v).replace(/^'/, ''); }

function attendFromText_(t) {
  t = plain_(t);
  for (var k in ATTEND) if (ATTEND[k] === t) return k;
  return null;
}

/* prev: {session, source} 或 null（首次送出） */
function nextSession(prev, newAttend) {
  var fixed = SESSION_BY_ATTEND[newAttend];
  var result;
  if (fixed) {
    result = { session: fixed, source: 'auto' };
  } else if (newAttend === 'both' && prev && prev.source === 'manual') {
    result = { session: prev.session, source: 'manual' };
  } else {
    result = { session: '', source: 'auto' };
  }
  result.changed = !!(prev && prev.source === 'manual' && prev.session && result.session !== prev.session);
  return result;
}

/* deadlineIso: 'YYYY-MM-DD'，台北時間當天 23:59:59 截止；空字串＝不截止 */
function isClosed(deadlineIso, now) {
  var d = str_(deadlineIso);
  if (!d) return false;
  var end = new Date(d + 'T23:59:59+08:00');
  if (isNaN(end.getTime())) return false;
  return now.getTime() > end.getTime();
}

function payloadToResponseRow(p, meta) {
  var byCol = {
    '送出時間': meta.createdAt, '最後修改': meta.updatedAt, 'token': meta.token, 'clientId': p.clientId || '',
    '名字': cellText_(p.name), '親友': SIDES[p.side] || '', '出席': ATTEND[p.attend] || '',
    '人數': isAttending(p.attend) ? Number(p.count) : 0,
    '交通': TRANSPORT[p.transport] || '', '輪椅': isAttending(p.attend) ? yesNo_(p.wheelchair) : '',
    '手機': cellText_(p.phone), 'Email/LINE': cellText_(p.contact), '祝福': cellText_(p.message),
    '安排場次': meta.session || '', '場次來源': meta.source || 'auto', '場次有變動': meta.changed ? '是' : '',
    '原始資料': JSON.stringify(p)
  };
  return RESPONSE_COLS.map(function (k) { return byCol[k]; });
}

function payloadToGuestRows(p, token, session) {
  if (!isAttending(p.attend)) return [];
  return (p.people || []).map(function (x, i) {
    var menu = MENU[x.diet];
    var alg = (x.allergies || []).slice();
    if (str_(x.allergyOther)) alg.push(str_(x.allergyOther));
    return [token, cellText_(p.name), cellText_(str_(x.label) || (i === 0 ? str_(p.name) : '第 ' + (i + 1) + ' 位')), session || '',
      x.diet === 'veg' ? '素食' : '葷食', menu ? menu.mains[x.main] : '', yesNo_(x.child), yesNo_(x.highChair), cellText_(alg.join('、'))];
  });
}

function rawPayload_(responseRow) {
  try { return JSON.parse(responseRow[RESPONSE_COLS.indexOf('原始資料')]); } catch (e) { return null; }
}

function mainKey_(diet, name) {
  var mains = MENU[diet].mains;
  for (var k in mains) if (mains[k] === name) return k;
  return null;
}

function emptySessionStats_() {
  return { meat: { a: 0, b: 0, c: 0 }, veg: { a: 0, b: 0, c: 0 }, meatTotal: 0, vegTotal: 0, children: 0, highChairs: 0, people: 0 };
}

function computeStats(responseRows, guestRows) {
  var sessions = { '午宴': emptySessionStats_(), '晚宴': emptySessionStats_(), '未安排': emptySessionStats_() };
  var allergyList = [];
  var gi = function (k) { return GUEST_COLS.indexOf(k); };
  guestRows.forEach(function (g) {
    var sessionName = g[gi('場次')] === '午宴' || g[gi('場次')] === '晚宴' ? g[gi('場次')] : '未安排';
    var s = sessions[sessionName];
    var diet = g[gi('餐別')] === '素食' ? 'veg' : 'meat';
    var key = mainKey_(diet, g[gi('主菜')]);
    if (key) s[diet][key]++;
    if (diet === 'veg') s.vegTotal++; else s.meatTotal++;
    if (g[gi('小朋友')] === '是') s.children++;
    if (g[gi('兒童椅')] === '是') s.highChairs++;
    s.people++;
    if (str_(g[gi('過敏')])) {
      allergyList.push({ session: sessionName, owner: g[gi('填表人')], label: g[gi('稱呼')], allergies: g[gi('過敏')] });
    }
  });
  var si = RESPONSE_COLS.indexOf('安排場次');
  var unassigned = responseRows.filter(function (r) {
    return isAttending(attendOf_(r)) && !str_(r[si]);
  }).length;
  return { sessions: sessions, allergyList: allergyList, unassignedResponses: unassigned };
}

/* 出席以畫面上的「出席」欄為準（新人可能手改）；文字對不上才退回原始資料 */
function attendOf_(r) {
  var k = attendFromText_(r[RESPONSE_COLS.indexOf('出席')]);
  if (k) return k;
  var p = rawPayload_(r);
  return p ? p.attend : null;
}

function inviteList(responseRows) {
  var out = [];
  var c = function (r, k) { return plain_(r[RESPONSE_COLS.indexOf(k)]); };
  responseRows.forEach(function (r) {
    var attend = attendOf_(r);
    if (!attend || attend === 'none') return;
    out.push({ name: c(r, '名字'), contact: c(r, 'Email/LINE'), phone: c(r, '手機'), attend: ATTEND[attend] });
  });
  return out;
}

if (typeof module !== 'undefined') module.exports = {
  MENU: MENU, SIDES: SIDES, ATTEND: ATTEND, TRANSPORT: TRANSPORT, ALLERGENS: ALLERGENS, MAX_PEOPLE: MAX_PEOPLE,
  RESPONSE_COLS: RESPONSE_COLS, GUEST_COLS: GUEST_COLS,
  isAttending: isAttending, validatePayload: validatePayload,
  nextSession: nextSession, isClosed: isClosed,
  payloadToResponseRow: payloadToResponseRow, payloadToGuestRows: payloadToGuestRows,
  computeStats: computeStats, inviteList: inviteList
};
