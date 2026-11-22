/* ============================================================
   Кухня — страница кондитеров и продавцов.
   Показывает, ЧТО готовить: торт, вес, пожелания, к какому времени,
   имя и телефон покупателя, самовывоз или доставка. Сумм и выручки нет —
   их видит только владелец (база отдаёт кухне заказы без цен).
   Кондитер ставит «Готов к выдаче» и «Выдан»; отменить может только владелец.
   ============================================================ */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const html = document.documentElement;
  const O = window.MKOrders;
  const DB = O.mode === 'db';
  const kg = n => (Math.round(n * 100) / 100).toLocaleString('ru-RU') + ' кг';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ───────── тема — общая с сайтом ───────── */
  const themeBtn = $('#themeBtn'), themeLbl = $('#themeLbl');
  function applyTheme(mode, save) {
    html.setAttribute('data-theme', mode);
    themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    themeLbl.textContent = mode === 'dark' ? 'Тёмная' : 'Светлая';
    if (save) { try { localStorage.setItem('mk-theme', mode); } catch (e) {} }
  }
  applyTheme(html.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);
  themeBtn.addEventListener('click', () => applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));

  /* ───────── время получения: «сегодня, 14:00», «завтра, 10:30», «25 нояб, 15:00» ───────── */
  const time = d => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  function when(iso) {
    if (!iso) return { text: 'время не указано', soon: false, late: false };
    const d = new Date(iso), now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(now)) / 864e5);
    const text = diff === 0 ? 'сегодня, ' + time(d)
               : diff === 1 ? 'завтра, ' + time(d)
               : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') + ', ' + time(d);
    return { text: text, soon: diff <= 0, late: d < now };
  }
  const wish = t => /^(добав|без |меньше|больше|побольше|поменьше|надпис|убрат)/i.test(t)
    ? esc(t.charAt(0).toUpperCase() + t.slice(1)) : 'Пожелание: ' + esc(t);

  /* ───────── колонки ───────── */
  const COLS = [
    ['new',   'Готовить',        'сначала ближайшие'],
    ['ready', 'Готов к выдаче',  'ждут покупателя'],
    ['done',  'Выдано за сутки', '']
  ];
  let role = null, orders = [];

  function card(o) {
    const w = when(o.when);
    const lines = o.items.map(i => {
      const name = (O.product(i.id) || {}).name || i.name || '—';
      return '<li><span><b>' + esc(name) + '</b> · ' + kg(i.w) + (i.qty > 1 ? ' × ' + i.qty : '') + '</span>' +
             (i.note ? '<small>' + wish(i.note) + '</small>' : '') + '</li>';
    }).join('');
    const tel = String(o.phone || '').replace(/[^\d+]/g, '');
    const who = DB
      ? esc(o.name || 'Покупатель') + (o.phone ? ' · <a href="tel:' + esc(tel) + '">' + esc(o.phone) + '</a>' : '')
      : (o.mine ? 'Покупатель (заказ с сайта)' : 'Покупатель №' + (300 + (o.no * 37) % 600));
    const a = o.address;
    const addr = o.dlv === 'delivery' && a
      ? '<div class="oc__addr">' + esc([a.street, a.house && 'д. ' + a.house, a.flat && 'кв. ' + a.flat].filter(Boolean).join(', ')) +
        (a.comment ? '<small>' + esc(a.comment) + '</small>' : '') + '</div>' : '';
    const acts = [];
    if (o.status === 'new')   acts.push(['ready', 'Готов к выдаче', 'main']);
    if (o.status === 'ready') acts.push(['done', 'Выдан', 'main']);
    if (role === 'owner' && (o.status === 'new' || o.status === 'ready')) acts.push(['cancel', 'Отменить', '']);
    const head = o.status === 'ready'
      ? '<span class="oc__ready">№' + o.no + ' — ' + (o.dlv === 'pickup' ? 'ждёт покупателя' : 'передать курьеру') + '</span>'
      : o.status === 'new'
        ? '<span class="k-when' + (w.late ? ' is-late' : w.soon ? ' is-soon' : '') + '">Получение: ' + esc(w.text) + (w.late ? ' — просрочено' : '') + '</span>'
        : '<span class="oc__when">Выдан ' + esc(when(o.statusAt).text) + '</span>';
    return '<article class="oc oc--' + o.status + '" data-no="' + o.no + '">' +
      '<header class="oc__hdr"><b class="oc__no">№' + o.no + '</b><span class="oc__tag">' + (o.dlv === 'delivery' ? 'доставка' : 'самовывоз') + '</span></header>' +
      head +
      '<ul class="oc__lines k-lines">' + lines + '</ul>' +
      '<div class="oc__who">' + who + '</div>' + addr +
      (acts.length ? '<div class="oc__acts">' + acts.map(x =>
        '<button type="button" class="oc__btn' + (x[2] ? ' oc__btn--main' : '') + '" data-to="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' : '') +
    '</article>';
  }

  function render() {
    const byWhen = (a, b) => new Date(a.when || a.created) - new Date(b.when || b.created);
    $('#board').innerHTML = COLS.map(c => {
      const list = orders.filter(o => o.status === c[0]).sort(c[0] === 'done' ? (a, b) => new Date(b.statusAt) - new Date(a.statusAt) : byWhen);
      return '<section class="col col--' + c[0] + '" aria-labelledby="kc-' + c[0] + '">' +
        '<h2 class="col__ttl" id="kc-' + c[0] + '">' + c[1] + ' <span class="col__n">' + list.length + '</span></h2>' +
        (c[2] ? '<p class="col__sub">' + c[2] + '</p>' : '') +
        (list.length ? list.map(card).join('') : '<p class="col__empty">Пусто</p>') +
      '</section>';
    }).join('');
    const todo = orders.filter(o => o.status === 'new');
    const today = todo.filter(o => when(o.when).soon).length;
    $('#kSum').textContent = todo.length
      ? 'Готовить: ' + todo.length + (today ? ' · на сегодня и раньше: ' + today : '')
      : 'Новых заказов нет';
  }

  const msg = $('#kMsg');
  let msgT = 0;
  function say(text) { msg.textContent = text; msg.hidden = false; clearTimeout(msgT); msgT = setTimeout(() => { msg.hidden = true; }, 6000); }

  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    try { orders = await O.kitchen(); render(); }
    catch (err) { console.error('[kitchen] заказы не загрузились', err); say('Не получилось загрузить заказы. Проверьте интернет и нажмите «Обновить».'); }
    finally { loading = false; }
  }

  /* «Отменить» — со вторым нажатием */
  $('#board').addEventListener('click', async e => {
    const b = e.target.closest('.oc__btn');
    if (!b || b.disabled) return;
    const no = Number(b.closest('.oc').dataset.no), to = b.dataset.to;
    if (to === 'cancel' && !b.classList.contains('is-confirm')) {
      b.classList.add('is-confirm'); b.textContent = 'Точно отменить?';
      setTimeout(() => { if (b.isConnected) { b.classList.remove('is-confirm'); b.textContent = 'Отменить'; } }, 3500);
      return;
    }
    b.disabled = true;
    try {
      await O.kitchenStatus(no, to);
      const o = orders.find(x => x.no === no);
      if (o) { o.status = to; o.statusAt = new Date().toISOString(); }
      if (to === 'cancel') orders = orders.filter(x => x.no !== no);
      render();
      const again = document.querySelector('.oc[data-no="' + no + '"]');
      if (again) { again.setAttribute('tabindex', '-1'); again.focus(); }
    } catch (err) {
      console.error('[kitchen] статус не сменился', err);
      say('Не получилось отметить заказ №' + no + '. Проверьте интернет и попробуйте ещё раз.');
      if (b.isConnected) b.disabled = false;
    }
  });
  $('#refresh').addEventListener('click', load);

  /* ───────── запуск ───────── */
  const main = $('#main'), setState = st => { main.dataset.state = st; };
  let pollT = 0;
  function startPolling() {
    clearInterval(pollT);
    pollT = setInterval(() => { if (!document.hidden) load(); }, 30000);   // новые заказы — без перезагрузки
  }
  async function gate() {
    try {
      const s = await O.session();
      if (!s) { setState('login'); $('#lgEmail').focus(); return; }
      role = await O.role();
      $('#signOut').hidden = false;
      if (!role) { setState('notowner'); $('#noEmail').textContent = s.email; return; }
      $('#toAdmin').hidden = role !== 'owner';
      $('#whoTag').hidden = false;
      $('#whoTag').textContent = role === 'owner' ? 'владелец' : 'кондитер';
      setState('dash');
      await load();
      startPolling();
    } catch (err) {
      console.error('[kitchen] база недоступна', err);
      setState('offline');
    }
  }

  if (!DB) {
    role = 'owner';
    O.seedExamples();
    $('#toAdmin').hidden = false;
    load();
    window.addEventListener('mk-orders', load);
  } else {
    $('#kBar').textContent = 'Заказы из базы. Суммы и выручку видит только владелец.';
    $('#kBar').classList.add('adm-bar--db');
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#lgGo'), err = $('#lgErr');
      err.hidden = true; btn.disabled = true; btn.textContent = 'Входим…';
      try {
        const r = await O.signIn($('#lgEmail').value.trim(), $('#lgPass').value);
        if (!r.ok) {
          err.textContent = r.reason === 'wrong' ? 'Неверная почта или пароль.' : 'Не получилось войти. Проверьте интернет и попробуйте ещё раз.';
          err.hidden = false; return;
        }
        $('#lgPass').value = '';
        await gate();
      } catch (e2) {
        console.error('[kitchen] вход', e2);
        err.textContent = 'Не получилось войти. Проверьте интернет и попробуйте ещё раз.'; err.hidden = false;
      } finally { btn.disabled = false; btn.textContent = 'Войти'; }
    });
    $('#signOut').addEventListener('click', async () => {
      clearInterval(pollT);
      try { await O.signOut(); } catch (e) { console.error(e); }
      orders = []; role = null;
      $('#signOut').hidden = true; $('#toAdmin').hidden = true; $('#whoTag').hidden = true;
      setState('login');
    });
    $('#retryDb').addEventListener('click', gate);
    gate();
  }
})();
