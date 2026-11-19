/* 表單狀態純函式（瀏覽器全域使用；Node 測試用 module.exports） */

var FS_isAttending = (typeof isAttending === 'function') ? isAttending : require('../shared/rules.js').isAttending;

function emptyPerson() {
  return { label: '', diet: 'meat', main: '', child: false, highChair: false, allergies: [], allergyOther: '' };
}

function resizePeople(people, n) {
  var out = (people || []).slice(0, n);
  while (out.length < n) out.push(emptyPerson());
  return out;
}

function setDiet(person, diet) {
  var p = Object.assign({}, person, { diet: diet });
  if (diet !== person.diet) p.main = '';
  return p;
}

function setChild(person, child) {
  var p = Object.assign({}, person, { child: !!child });
  if (!child) p.highChair = false;
  return p;
}

function stepsFor(attend) {
  if (FS_isAttending(attend)) return ['info', 'attend', 'meals', 'extra', 'contact', 'message', 'done'];
  if (attend === 'card') return ['info', 'attend', 'contact', 'message', 'done'];
  if (attend === 'none') return ['info', 'attend', 'message', 'done'];
  return ['info', 'attend'];
}

function toPayload(state) {
  var attending = FS_isAttending(state.attend);
  var people = attending ? resizePeople(state.people, Number(state.count)).map(function (x, i) {
    var p = Object.assign({}, x, { allergies: (x.allergies || []).slice() });
    if (i === 0 && !String(p.label || '').trim()) p.label = String(state.name || '').trim();
    return p;
  }) : [];
  var payload = {
    clientId: state.clientId,
    name: String(state.name || '').trim(),
    side: state.side || '',
    attend: state.attend || '',
    count: attending ? Number(state.count) : 0,
    people: people,
    transport: attending ? (state.transport || '') : '',
    wheelchair: attending ? !!state.wheelchair : false,
    phone: String(state.phone || '').trim(),
    contact: String(state.contact || '').trim(),
    message: String(state.message || '').trim()
  };
  if (state.token) payload.token = state.token;
  return payload;
}

if (typeof module !== 'undefined') module.exports = {
  emptyPerson: emptyPerson, resizePeople: resizePeople, setDiet: setDiet, setChild: setChild,
  stepsFor: stepsFor, toPayload: toPayload
};
