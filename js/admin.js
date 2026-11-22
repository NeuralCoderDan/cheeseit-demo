/* ============================================================
   Админ-панель ВЛАДЕЛЬЦА: сколько заработано, сколько клиентов,
   последние заказы, график, топ-3. Текущие заказы ведут кондитеры
   на странице kitchen.html («Кухня»).
   • ДЕМО (js/config.js пустой): цифры — ПРИМЕР.
   • БАЗА: вход владельца; всё считается по настоящим заказам,
     обновляется само раз в 30 секунд.
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

  const EXAMPLE_CLIENTS = { month: 39, year: 214 };   // ПРИМЕР
  let stats = { orders: EXAMPLE_ORDERS, revenue: EXAMPLE_REVENUE, clients: EXAMPLE_CLIENTS, example: true };
  const monthOf = iso => { const d = new Date(iso); return monthIdx.findIndex(x => x.y === d.getFullYear() && x.m === d.getMonth()); };
  /* один клиент = один телефон (без пробелов и скобок); в демо — номер покупателя */
  const clientKey = o => String(o.phone || '').replace(/\D/g, '').slice(-10) || (o.name || '') || ('demo' + (300 + (o.no * 37) % 600));
  function statsFrom(list) {
    const orders = monthIdx.map(() => 0), revenue = monthIdx.map(() => 0);
    const yearC = new Set(), monthC = new Set();
    list.filter(o => o.status !== 'cancel').forEach(o => {
      const i = monthOf(o.created);
      if (i > -1) { orders[i]++; yearC.add(clientKey(o)); if (i === 11) monthC.add(clientKey(o)); }
    });
    // заработано — по выданным заказам, в месяц выдачи
    list.filter(o => o.status === 'done').forEach(o => {
      const i = monthOf(o.statusAt);
      if (i > -1) revenue[i] += Number(o.total) || 0;
    });
    return { orders: orders, revenue: revenue, clients: { month: monthC.size, year: yearC.size }, example: false };
  }

  /* ───────── плитки ───────── */
  function renderTiles() {
    const ex = stats.example;
    const t = [
      ['Заработано за месяц', money(last(stats.revenue)), 'по выданным заказам'],
      ['Заработано за год',   money(sum(stats.revenue)),  'по выданным заказам'],
      ['Клиентов за месяц',   nf.format(stats.clients.month), 'без повторов, по телефону'],
      ['Клиентов за год',     nf.format(stats.clients.year),  'заказов за год: ' + nf.format(sum(stats.orders))]
    ];
    $('#tiles').innerHTML = t.map(x =>
      '<div class="tile"><span class="tile__k">' + x[0] + '</span><b class="tile__v">' + x[1] + '</b>' +
      '<span class="tile__ex">' + (ex ? 'пример' : x[2]) + '</span></div>').join('');
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

  /* ───────── последние заказы — история для владельца ───────── */
  const STATUS = { new: 'Новый', ready: 'Готов к выдаче', done: 'Выдан', cancel: 'Отменён' };
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
      return esc(o.name || 'Покупатель') + (o.phone ? '<br><a href="tel:' + esc(tel) + '">' + esc(o.phone) + '</a>' : '');
    }
    return o.mine ? 'Покупатель (заказ с сайта)' : 'Покупатель №' + (300 + (o.no * 37) % 600);
  };
  const HIST_MAX = 30;
  function renderHistory() {
    const list = orders.slice().sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, HIST_MAX);
    $('#hist').innerHTML = list.length ? list.map(o => {
      const what = o.items.map(i => {
        const name = (O.product(i.id) || {}).name || i.name || '—';
        return esc(name) + ' · ' + kg(i.w) + (i.qty > 1 ? ' × ' + i.qty : '') + (i.note ? '<small>' + esc(i.note) + '</small>' : '');
      }).join('<br>');
      // data-label — подписи полей, когда на телефоне строка превращается в карточку
      return '<tr>' +
        '<td class="tbl__no" data-label="№">№' + o.no + '</td>' +
        '<td class="tbl__date" data-label="Дата">' + fmt(o.created) + '</td>' +
        '<td class="tbl__who" data-label="Клиент">' + who(o) + '</td>' +
        '<td class="tbl__what" data-label="Что заказали">' + what + '</td>' +
        '<td class="num tbl__sum" data-label="Сумма">' + money(o.total) + '</td>' +
        '<td class="tbl__dlv" data-label="Получение">' + (o.dlv === 'delivery' ? 'Доставка' : 'Самовывоз') + '</td>' +
        '<td class="tbl__st" data-label="Статус"><span class="st st--' + o.status + '">' + STATUS[o.status] + '</span></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="7" class="col__empty">Заказов пока нет</td></tr>';
    renderTop(orders);
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
      renderHistory();
    } catch (err) {
      console.error('[admin] заказы не загрузились', err);
      say('Не получилось загрузить заказы. Проверьте интернет и нажмите «Обновить».');
    } finally { loading = false; }
  }

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
