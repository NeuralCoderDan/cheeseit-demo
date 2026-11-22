/* ============================================================
   Админ-панель.
   • ДЕМО (js/config.js пустой): цифры и заказы — ПРИМЕР, плюс заказы,
     оформленные на сайте в этом браузере.
   • БАЗА (Supabase подключён): вход владельца по почте и паролю,
     настоящие заказы, сводка и график считаются по ним; список
     обновляется сам раз в 30 секунд.
   Названия тортов и цены за кг — из js/data.js.
   ============================================================ */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const html = document.documentElement;
  const nf = new Intl.NumberFormat('ru-RU');
  const money = n => nf.format(Math.round(n)) + ' ₽';
  const kg = n => (Math.round(n * 100) / 100).toLocaleString('ru-RU') + ' кг';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ───────── тема — общая с сайтом (mk-theme) ───────── */
  const themeBtn = $('#themeBtn'), themeLbl = $('#themeLbl');
  function applyTheme(mode, save) {
    html.setAttribute('data-theme', mode);
    themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    themeLbl.textContent = mode === 'dark' ? 'Тёмная' : 'Светлая';
    if (save) { try { localStorage.setItem('mk-theme', mode); } catch (e) {} }
  }
  applyTheme(html.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);
  themeBtn.addEventListener('click', () => applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));

  const O = window.MKOrders;
  const DB = O.mode === 'db';

  /* ───────── ПРИМЕР: заказы и выручка по месяцам (последний — текущий месяц) ─────────
     В режиме базы те же плитки и график считаются по настоящим заказам. */
  const EXAMPLE_ORDERS  = [18, 21, 24, 22, 27, 31, 26, 23, 29, 33, 38, 46];
  const EXAMPLE_REVENUE = [104000, 121500, 143000, 128500, 166000, 197000, 152500, 139000, 178500, 205000, 241500, 296000];

  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTHS_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const now = new Date();
  const monthIdx = [];                                   // [{y, m}] последних 12 месяцев
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); monthIdx.push({ y: d.getFullYear(), m: d.getMonth() }); }
  const labels = monthIdx.map(x => ({ short: MONTHS[x.m], full: MONTHS_FULL[x.m] }));
  const sum = a => a.reduce((x, y) => x + y, 0);
  const last = a => a[a.length - 1];

  let stats = { orders: EXAMPLE_ORDERS, revenue: EXAMPLE_REVENUE, example: true };
  function statsFrom(list) {
    const orders = monthIdx.map(() => 0), revenue = monthIdx.map(() => 0);
    list.filter(o => o.status !== 'cancel').forEach(o => {
      const d = new Date(o.created), i = monthIdx.findIndex(x => x.y === d.getFullYear() && x.m === d.getMonth());
      if (i > -1) { orders[i]++; revenue[i] += Number(o.total) || 0; }
    });
    return { orders: orders, revenue: revenue, example: false };
  }

  /* ───────── плитки ───────── */
  function renderTiles() {
    const t = [
      ['Заказов за месяц', nf.format(last(stats.orders))],
      ['Выручка за месяц', money(last(stats.revenue))],
      ['Заказов за год', nf.format(sum(stats.orders))],
      ['Выручка за год', money(sum(stats.revenue))]
    ];
    $('#tiles').innerHTML = t.map(x =>
      '<div class="tile"><span class="tile__k">' + x[0] + '</span><b class="tile__v">' + x[1] + '</b>' +
      '<span class="tile__ex">' + (stats.example ? 'пример' : 'без отменённых') + '</span></div>').join('');
  }

  /* ───────── столбчатый график — inline SVG, без библиотек ─────────
     ширина viewBox = реальная ширина блока: подписи всегда читаемого размера */
  function chart() {
    const box = $('#chart'), data = stats.orders, ex = stats.example;
    const W = Math.round(Math.max(300, Math.min(760, box.clientWidth || 720)));
    const H = W < 480 ? 230 : 300, padL = 30, padR = 6, padT = 24, padB = 28;
    const max = Math.max(5, Math.ceil(Math.max.apply(null, data) / 5) * 5);
    const n = data.length, slot = (W - padL - padR) / n, bw = Math.min(34, slot * 0.62);
    const y = v => padT + (H - padT - padB) * (1 - v / max);
    let g = '';
    for (let v = 0; v <= max; v += max / 5) {
      g += '<line class="ch__grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
           '<text class="ch__ax" x="' + (padL - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }
    data.forEach((v, i) => {
      const x = padL + slot * i + (slot - bw) / 2, top = y(v), cur = i === n - 1;
      g += '<g class="ch__bar' + (cur ? ' is-cur' : '') + '">' +
             '<title>' + labels[i].full + ': ' + v + ' заказов' + (ex ? ' (пример)' : '') + '</title>' +
             '<rect x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, H - padB - top).toFixed(1) + '" rx="5"/>' +
             '<text class="ch__val" x="' + (x + bw / 2).toFixed(1) + '" y="' + (top - 7).toFixed(1) + '" text-anchor="middle">' + v + '</text>' +
             '<text class="ch__ax" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + labels[i].short + '</text>' +
           '</g>';
    });
    const desc = (ex ? 'Пример данных. ' : '') + labels.map((l, i) => l.full + ' — ' + data[i]).join(', ') + '.';
    box.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="chT chD" preserveAspectRatio="xMidYMid meet">' +
        '<title id="chT">Заказы по месяцам за год</title><desc id="chD">' + esc(desc) + '</desc>' + g +
      '</svg>';
  }
  let rT = 0, lastW = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { if ($('#chart').clientWidth !== lastW) { lastW = $('#chart').clientWidth; chart(); } }, 120);
  });

  /* ───────── заказы по статусам: Новые · Готов к выдаче · Выдано · Отменено ───────── */
  const COLS = [
    ['new',    'Новые',          'предстоят — сначала ближайшие'],
    ['ready',  'Готов к выдаче', 'можно забирать'],
    ['done',   'Выдано',         'продано'],
    ['cancel', 'Отменено',       '']
  ];
  const fmt = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') + ', ' +
           d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };
  /* с базой владелец видит имя и телефон; в демо — «Покупатель №…» */
  const who = o => {
    if (DB) {
      const tel = String(o.phone || '').replace(/[^\d+]/g, '');
      return esc(o.name || 'Покупатель') + (o.phone ? ' · <a href="tel:' + esc(tel) + '">' + esc(o.phone) + '</a>' : '');
    }
    return o.mine ? 'Покупатель (заказ с сайта)' : 'Покупатель №' + (300 + (o.no * 37) % 600);
  };
  const addr = o => {
    const a = o.address;
    if (!a || o.dlv !== 'delivery') return '';
    const line = [a.street, a.house && 'д. ' + a.house, a.flat && 'кв. ' + a.flat].filter(Boolean).join(', ');
    return '<div class="oc__addr">' + esc(line) + (a.comment ? '<small>' + esc(a.comment) + '</small>' : '') + '</div>';
  };
  const weight = o => o.items.reduce((s, i) => s + (Number(i.w) || 0) * (Number(i.qty) || 1), 0);

  /* «Красный бархат, добавить побольше ягод» — без «добавить: Добавить …» */
  const wish = t => /^(добав|без |меньше|больше|побольше|поменьше|надпис|убрат)/i.test(t)
    ? esc(t.charAt(0).toLowerCase() + t.slice(1)) : 'пожелание: ' + esc(t);

  function card(o) {
    const lines = o.items.map(i => {
      const name = (O.product(i.id) || {}).name || i.name || '—';
      return '<li><span><b>' + esc(name) + '</b> · ' + kg(i.w) + (i.qty > 1 ? ' × ' + i.qty : '') + '</span>' +
             (i.note ? '<small>' + esc(name) + ', ' + wish(i.note) + '</small>' : '') + '</li>';
    }).join('');
    let state = '';
    if (o.status === 'new')    state = '<span class="oc__when">К получению: <b>' + fmt(o.when) + '</b></span>';
    if (o.status === 'ready')  state = '<span class="oc__ready">№' + o.no + ' — ' + (o.dlv === 'pickup' ? 'можно забирать' : 'передать курьеру') + '</span>';
    if (o.status === 'done')   state = '<span class="oc__when">Выдан: ' + fmt(o.statusAt) + '</span>';
    if (o.status === 'cancel') state = '<span class="oc__when">Отменён: ' + fmt(o.statusAt) + '</span>';
    const acts = {
      new:   [['ready', 'Готов к выдаче', 'main'], ['cancel', 'Отменить', '']],
      ready: [['done', 'Выдан', 'main'], ['cancel', 'Отменить', '']]
    }[o.status] || [];
    const tag = DB ? '' : (o.example ? '<span class="oc__tag">пример</span>' : '<span class="oc__tag oc__tag--live">с сайта</span>');
    return '<article class="oc oc--' + o.status + '" data-no="' + o.no + '">' +
      '<header class="oc__hdr"><b class="oc__no">№' + o.no + '</b>' + tag + '</header>' +
      '<div class="oc__who">' + who(o) + ' · оформлен ' + fmt(o.created) + '</div>' +
      '<ul class="oc__lines">' + lines + '</ul>' +
      '<div class="oc__meta"><span>' + (o.dlv === 'delivery' ? 'Доставка' : 'Самовывоз') + ' · ' + kg(weight(o)) + '</span><b>' + money(o.total) + '</b></div>' +
      addr(o) + state +
      (acts.length ? '<div class="oc__acts">' + acts.map(a =>
        '<button type="button" class="oc__btn' + (a[2] ? ' oc__btn--main' : '') + '" data-to="' + a[0] + '">' + a[1] + '</button>').join('') + '</div>' : '') +
    '</article>';
  }

  const msg = $('#admMsg');
  let msgT = 0;
  function say(text) {
    msg.textContent = text; msg.hidden = false;
    clearTimeout(msgT); msgT = setTimeout(() => { msg.hidden = true; }, 5000);
  }

  let orders = [], loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    try {
      orders = await O.all();
      if (DB) stats = statsFrom(orders);
      renderTiles(); chart(); lastW = $('#chart').clientWidth;
      renderBoard();
    } catch (err) {
      console.error('[admin] заказы не загрузились', err);
      say('Не получилось загрузить заказы. Проверьте интернет и нажмите «Обновить».');
    } finally { loading = false; }
  }

  function renderBoard() {
    $('#board').innerHTML = COLS.map(c => {
      const list = orders.filter(o => o.status === c[0]);
      if (c[0] === 'new') list.sort((a, b) => new Date(a.when || a.created) - new Date(b.when || b.created));
      else list.sort((a, b) => new Date(b.statusAt) - new Date(a.statusAt));
      return '<section class="col col--' + c[0] + '" aria-labelledby="col-' + c[0] + '">' +
        '<h3 class="col__ttl" id="col-' + c[0] + '">' + c[1] + ' <span class="col__n">' + list.length + '</span></h3>' +
        (c[2] ? '<p class="col__sub">' + c[2] + '</p>' : '') +
        (list.length ? list.map(card).join('') : '<p class="col__empty">Пусто</p>') +
      '</section>';
    }).join('');
    renderTop(orders);
  }

  /* отмена — со вторым нажатием, чтобы не отменить случайно */
  $('#board').addEventListener('click', async e => {
    const b = e.target.closest('.oc__btn');
    if (!b || b.disabled) return;
    const no = Number(b.closest('.oc').dataset.no), to = b.dataset.to;
    if (to === 'cancel' && !b.classList.contains('is-confirm')) {
      b.classList.add('is-confirm');
      b.textContent = 'Точно отменить?';
      setTimeout(() => { if (b.isConnected) { b.classList.remove('is-confirm'); b.textContent = 'Отменить'; } }, 3500);
      return;
    }
    b.disabled = true;
    try {
      await O.setStatus(no, to);
      const o = orders.find(x => x.no === no);
      if (o) { o.status = to; o.statusAt = new Date().toISOString(); }
      if (DB) stats = statsFrom(orders), renderTiles(), chart();
      renderBoard();
      const again = document.querySelector('.oc[data-no="' + no + '"]');
      if (again) { again.setAttribute('tabindex', '-1'); again.focus(); }
    } catch (err) {
      console.error('[admin] статус не сменился', err);
      say('Не получилось сменить статус заказа №' + no + '. Проверьте интернет и попробуйте ещё раз.');
      if (b.isConnected) b.disabled = false;
    }
  });
  window.addEventListener('mk-orders', () => { if (!DB) load(); });   // демо: заказ из соседней вкладки

  /* ───────── что больше нравится: топ-3 тортов и их частое пожелание ───────── */
  function renderTop(all) {
    const stat = new Map();
    all.filter(o => o.status !== 'cancel').forEach(o => o.items.forEach(i => {
      const s = stat.get(i.id) || { n: 0, notes: [], name: i.name };
      s.n += Number(i.qty) || 1;
      if (i.note) s.notes.push(i.note);
      stat.set(i.id, s);
    }));
    const top = Array.from(stat.entries()).sort((a, b) => b[1].n - a[1].n).slice(0, 3);
    const max = top.length ? top[0][1].n : 1;
    $('#top').innerHTML = top.length ? top.map(([id, s], i) => {
      const name = (O.product(id) || {}).name || s.name || '—';
      const n = s.n, word = n % 10 === 1 && n % 100 !== 11 ? 'заказ' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'заказа' : 'заказов');
      return '<li class="top__item">' +
        '<span class="top__rank">' + (i + 1) + '</span>' +
        '<div class="top__body">' +
          '<div class="top__row"><b>' + esc(name) + '</b><span>' + n + ' ' + word + '</span></div>' +
          '<span class="top__bar" aria-hidden="true"><i style="width:' + Math.round(n / max * 100) + '%"></i></span>' +
          (s.notes.length ? '<small>Просят: ' + s.notes.slice(0, 2).map(t => '«' + esc(t) + '»').join(', ') + '</small>' : '') +
        '</div>' +
      '</li>';
    }).join('') : '<li class="col__empty">Пока нет заказов</li>';
  }

  /* ───────── режим владельца на сайте: выйти ───────── */
  const ownerOff = $('#ownerOff');
  try { ownerOff.hidden = localStorage.getItem('mk-owner') !== '1'; } catch (e) {}
  ownerOff.addEventListener('click', () => {
    try { localStorage.removeItem('mk-owner'); } catch (e) {}
    ownerOff.hidden = true;
  });

  /* ───────── запуск: демо — сразу; база — после входа владельца ───────── */
  const main = $('#main'), refresh = $('#resetDemo');
  const setState = st => { main.dataset.state = st; };
  let pollT = 0;

  async function enterDash() {
    setState('dash');
    $('#signOut').hidden = false;
    await load();
    clearInterval(pollT);
    pollT = setInterval(() => { if (!document.hidden) load(); }, 30000);   // новые заказы — без перезагрузки
  }
  async function gate() {
    try {
      const s = await O.session();
      if (!s) { setState('login'); $('#lgEmail').focus(); return; }
      if (!(await O.isOwner())) { setState('notowner'); $('#notOwnerEmail').textContent = s.email; $('#signOut').hidden = false; return; }
      await enterDash();
    } catch (err) {
      console.error('[admin] база недоступна', err);
      setState('offline');
    }
  }

  if (!DB) {
    O.seedExamples();
    refresh.addEventListener('click', () => { O.resetExamples(); load(); });
    load();
  } else {
    $('.adm-bar').innerHTML = 'Подключена база: здесь настоящие заказы. Имена и телефоны покупателей видит только владелец.';
    $('.adm-bar').classList.add('adm-bar--db');
    document.title = 'Админ-панель — Моя кондитерская';
    $('#admTag').hidden = true;
    $('#chartNote').textContent = 'по заказам из базы, без отменённых';
    $('#chartCap').textContent = 'Заказы за последние 12 месяцев — по дате оформления';
    $('#privacyNote').textContent = 'Имена, телефоны и адреса видит только владелец после входа';
    $('#admFoot').textContent = 'Админ-панель. Блоки «Уведомления» и «Что можно менять» пока показаны как пример.';
    refresh.textContent = 'Обновить';
    refresh.addEventListener('click', load);
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#lgGo'), err = $('#lgErr');
      err.hidden = true; btn.disabled = true; btn.textContent = 'Входим…';
      try {
        const r = await O.signIn($('#lgEmail').value.trim(), $('#lgPass').value);
        if (!r.ok) {
          err.textContent = r.reason === 'wrong' ? 'Неверная почта или пароль.' : 'Не получилось войти. Проверьте интернет и попробуйте ещё раз.';
          err.hidden = false;
          return;
        }
        $('#lgPass').value = '';
        await gate();
      } catch (e2) {
        console.error('[admin] вход', e2);
        err.textContent = 'Не получилось войти. Проверьте интернет и попробуйте ещё раз.';
        err.hidden = false;
      } finally { btn.disabled = false; btn.textContent = 'Войти'; }
    });
    $('#signOut').addEventListener('click', async () => {
      clearInterval(pollT);
      try { await O.signOut(); } catch (e) { console.error(e); }
      orders = []; $('#signOut').hidden = true;
      setState('login');
    });
    $('#retryDb').addEventListener('click', gate);
    gate();
  }

  /* ───────── что можно менять самому (в демо — неактивно) ───────── */
  const IC = {
    price: '<path d="M4 12.5 12.5 4H20v7.5L11.5 20 4 12.5Z"/><circle cx="16" cy="8" r="1.4"/>',
    cake:  '<path d="M5 20h14v-5a2.5 2.5 0 0 0-2.5-2.5h-9A2.5 2.5 0 0 0 5 15v5Z"/><path d="M12 12.5V9M12 6.5v-.01"/><path d="M16 4v4M14 6h4"/>',
    text:  '<path d="M5 6h14M5 10h14M5 14h9M5 18h6"/>',
    pin:   '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    chat:  '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4h0A2.5 2.5 0 0 1 4 13.5v-7Z"/>'
  };
  const EDITS = [
    ['price', 'Цены и вес'],
    ['cake',  'Добавить или скрыть торт'],
    ['text',  'Тексты сайта'],
    ['pin',   'Адрес и часы работы'],
    ['truck', 'Условия доставки'],
    ['chat',  'Ответы помощника']
  ];
  $('#edits').innerHTML = EDITS.map(e =>
    '<button class="edit" type="button" disabled aria-disabled="true" title="Станет доступно после подключения базы">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + IC[e[0]] + '</svg>' +
      '<span>' + e[1] + '</span>' +
    '</button>'
  ).join('');
})();
