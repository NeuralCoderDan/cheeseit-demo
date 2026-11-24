/* ============================================================
   Кабинет покупателя «Мои заказы» и режим владельца.

   Режим владельца (пока нет входа с паролем):
     откройте сайт по ссылке  …/?owner=1  — в этом браузере в меню появится
     «Админ-панель». Выключить:  …/?owner=0  или кнопкой в самой админке.
     Покупатели этот пункт не видят. Настоящий вход — после подключения базы.

   «Мои заказы» — заказы, оформленные в этом браузере, с номером и статусом.
   Статус меняет владелец в админке; здесь он обновляется сам.
   ============================================================ */
(function () {
  'use strict';
  if (!window.MK || !window.MKOrders) return;

  const MK = window.MK, O = window.MKOrders;
  const $  = (s, r) => (r || document).querySelector(s);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const OWNER_KEY = 'mk-owner';

  /* ───────── режим владельца ───────── */
  try {
    const u = new URL(location.href), v = u.searchParams.get('owner');
    if (v === '1') localStorage.setItem(OWNER_KEY, '1');
    if (v === '0') localStorage.removeItem(OWNER_KEY);
    if (v !== null) { u.searchParams.delete('owner'); history.replaceState(history.state, '', u.toString()); }
  } catch (e) {}
  const isOwner = () => { try { return localStorage.getItem(OWNER_KEY) === '1'; } catch (e) { return false; } };

  /* ───────── меню ───────── */
  const navMine = $('#navMine'), navAdmin = $('#navAdmin');
  function syncNav() {
    navAdmin.hidden = !isOwner();
    navMine.hidden = !O.hasMine();
  }

  /* ───────── «Мои заказы» ───────── */
  const panel = $('#mine'), body = $('#mineBody');
  let lastFocus = null, closeT = 0;

  const fmtDate = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' +
           d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };
  /* статус человеческими словами — как в приложениях доставки */
  function statusBlock(o) {
    if (o.status === 'ready') {
      return '<div class="mo__st mo__st--ready">' +
               '<b>Готов! ' + (o.dlv === 'pickup' ? 'Можно забирать' : 'Ждёт передачи курьеру') + '</b>' +
               (o.dlv === 'pickup' ? '<span>Назовите номер заказа: <strong class="mo__no">№' + o.no + '</strong></span>' : '') +
             '</div>';
    }
    if (o.status === 'done')   return '<div class="mo__st mo__st--done"><b>Выдан</b><span>' + fmtDate(o.statusAt) + '</span></div>';
    if (o.status === 'cancel') return '<div class="mo__st mo__st--cancel"><b>Отменён</b><span>' + fmtDate(o.statusAt) + '</span></div>';
    return '<div class="mo__st mo__st--new"><b>Принят</b>' +
             (o.when ? '<span>Получение: ' + fmtDate(o.when) + '</span>' : '') + '</div>';
  }
  let loadSeq = 0, pollT = 0;
  async function render() {
    const seq = ++loadSeq;
    if (!body.querySelector('.mo')) body.innerHTML = '<p class="mo__load" role="status">Загружаем заказы…</p>';
    let list;
    try { list = await O.mine(); }
    catch (err) {
      console.error('[account] заказы не загрузились', err);
      if (seq !== loadSeq) return;
      body.innerHTML = '<div class="cart__empty"><h4>Не получилось загрузить заказы</h4>' +
                       '<p>Проверьте интернет и попробуйте ещё раз — заказы никуда не делись.</p>' +
                       '<button class="btn btn--lg" type="button" data-mretry>Обновить</button></div>';
      return;
    }
    if (seq !== loadSeq) return;                         // пришёл более свежий ответ
    if (!list.length) {
      body.innerHTML = '<div class="cart__empty"><h4>Заказов пока нет</h4><p>Оформленные заказы появятся здесь — с номером и статусом.</p>' +
                       '<button class="btn btn--lg" type="button" data-mclose>Перейти в каталог</button></div>';
      return;
    }
    body.innerHTML =
      '<p class="cform__demo">Демонстрационный сайт: так покупатель видит статус заказа у настоящей кондитерской. ' +
        'Здесь торт никто не испечёт.' + (O.mode === 'db' ? ' Статус обновляется сам.' : ' Заказы сохранены только в этом браузере.') + '</p>' +
      '<ul class="mo">' + list.map(o =>
        '<li class="mo__item">' +
          '<div class="mo__top"><b>Заказ №' + o.no + '</b><span>' + fmtDate(o.created) + '</span></div>' +
          statusBlock(o) +
          '<ul class="mo__lines">' + o.items.map(i => {
            const p = O.product(i.id) || { name: i.name || '—' };
            return '<li><span>' + esc(p.name) + ' · ' + MK.kg(i.w) + (i.qty > 1 ? ' × ' + i.qty : '') + '</span>' +
                   (i.note ? '<small>Пожелания: ' + esc(i.note) + '</small>' : '') + '</li>';
          }).join('') + '</ul>' +
          '<div class="mo__bottom"><span>' + (o.dlv === 'delivery' ? 'Доставка' : 'Самовывоз') + '</span><b>' + MK.money(o.total) + '</b></div>' +
        '</li>').join('') +
      '</ul>';
  }
  function openMine() {
    lastFocus = document.activeElement;
    if (!lastFocus || lastFocus.closest('.modal, .cart')) lastFocus = navMine;
    render();
    clearTimeout(closeT);
    panel.classList.remove('is-closing');
    panel.hidden = false;
    document.body.classList.add('is-locked');
    $('[data-mclose].iconbtn', panel).focus();
    clearInterval(pollT);
    if (O.mode === 'db') pollT = setInterval(() => { if (!panel.hidden && !document.hidden) render(); }, 30000);
  }
  function closeMine() {
    if (panel.hidden || panel.classList.contains('is-closing')) return;
    clearInterval(pollT);
    const done = () => {
      panel.hidden = true;
      panel.classList.remove('is-closing');
      if (!document.querySelector('.modal:not([hidden]), .sheet:not([hidden]), #cart:not([hidden])')) document.body.classList.remove('is-locked');
      if (lastFocus && document.contains(lastFocus) && lastFocus.offsetParent) lastFocus.focus();
    };
    if (reduced()) { done(); return; }
    panel.classList.add('is-closing');
    closeT = setTimeout(done, 240);
  }
  navMine.addEventListener('click', e => { e.preventDefault(); openMine(); });
  panel.addEventListener('click', e => {
    if (e.target.closest('[data-mclose]')) closeMine();
    if (e.target.closest('[data-mretry]')) render();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closeMine(); });

  // заказ оформлен здесь или владелец сменил статус в админке (другая вкладка)
  window.addEventListener('mk-orders', () => { syncNav(); if (!panel.hidden) render(); });

  syncNav();
  if (location.hash === '#my-orders' && O.hasMine()) openMine();

  window.MKAccount = { openMine: openMine, isOwner: isOwner };
})();
