/* ============================================================
   Корзина: иконка в шапке со счётчиком, полёт торта по дуге,
   тост «Добавлено», панель с позициями и формой оформления.
   Хранится в localStorage (mk-cart). Заказ никуда не уходит — это демо.
   Зависит от window.MK из js/app.js.
   ============================================================ */
(function () {
  'use strict';
  if (!window.MK) return;

  const MK = window.MK;
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'mk-cart';
  const MAX_QTY = 20;

  const byId = id => MK.products.find(p => p.id === id);
  const keyOf = it => it.id + '@' + it.w;

  /* ───────────── хранение ───────────── */
  let items = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(raw)) {
      items = raw.filter(it => it && byId(it.id) && it.w > 0)
                 .map(it => ({ id: it.id, w: Number(it.w), qty: Math.min(MAX_QTY, Math.max(1, Math.round(it.qty) || 1)) }));
    }
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} };

  const count = () => items.reduce((n, it) => n + it.qty, 0);
  const sumOf = it => MK.priceAt(byId(it.id), it.w) * it.qty;
  const total = () => items.reduce((s, it) => s + sumOf(it), 0);
  const totalKg = () => items.reduce((s, it) => s + it.w * it.qty, 0);

  /* ───────────── счётчик на иконках ───────────── */
  function syncBadges(bump) {
    const n = count();
    $$('.js-cart-open').forEach(b => {
      const el = $('.cartbtn__n', b);
      el.textContent = n > 99 ? '99+' : String(n);
      b.classList.toggle('has-items', n > 0);
      b.setAttribute('aria-label', 'Корзина, позиций: ' + n);
      if (bump && !reduced()) {
        el.classList.remove('is-bump');
        void el.offsetWidth;                       // перезапуск анимации отскока
        el.classList.add('is-bump');
      }
    });
  }

  /* видимая сейчас иконка корзины: в шапке или в мобильной строке фильтров */
  function cartTarget() {
    return $$('.js-cart-open').find(b => {
      if (!b.offsetParent) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }) || null;
  }

  /* ───────────── полёт по дуге ───────────── */
  function fly(fromEl, done) {
    const target = cartTarget();
    if (!fromEl || !target || reduced() || !fromEl.animate) { done(); return; }
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!a.width) { done(); return; }

    const size = Math.min(a.width, a.height, 220);
    const ghost = fromEl.cloneNode(true);
    ghost.classList.add('fly');
    Object.assign(ghost.style, {
      position: 'fixed', left: '0px', top: '0px', width: size + 'px', height: size + 'px',
      margin: '0', zIndex: '300', pointerEvents: 'none', borderRadius: '24px', aspectRatio: 'auto'
    });
    document.body.appendChild(ghost);

    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const ex = b.left + b.width / 2, ey = b.top + b.height / 2;
    // вершина дуги — выше обеих точек, но не за краем экрана
    const cx = (sx + ex) / 2, cy = Math.max(30, Math.min(sy, ey) - Math.max(120, Math.abs(ex - sx) * 0.35));
    const end = 22 / size;
    const frames = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, u = 1 - t;
      const x = u * u * sx + 2 * u * t * cx + t * t * ex;
      const y = u * u * sy + 2 * u * t * cy + t * t * ey;
      const k = 1 + (end - 1) * (t * t * (3 - 2 * t));
      frames.push({
        transform: 'translate(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px) scale(' + k.toFixed(4) + ')',
        borderRadius: (24 + 76 * t).toFixed(1) + 'px',
        opacity: t > 0.9 ? (1 - (t - 0.9) * 6).toFixed(2) : 1
      });
    }
    const anim = ghost.animate(frames, { duration: 720, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
    anim.onfinish = anim.oncancel = () => { ghost.remove(); done(); };
  }

  /* ───────────── тост «Добавлено» ───────────── */
  const ct = $('#ctoast');
  let ctT = 0;
  function showAdded(name, w) {
    $('#ctoastT').textContent = 'Добавлено: ' + name + ', ' + MK.kg(w);
    clearTimeout(ctT);
    ct.hidden = false;
    requestAnimationFrame(() => ct.classList.add('is-on'));
    ctT = setTimeout(hideAdded, 6000);
  }
  function hideAdded() {
    clearTimeout(ctT);
    ct.classList.remove('is-on');
    ctT = setTimeout(() => { ct.hidden = true; }, reduced() ? 0 : 260);
  }
  ct.addEventListener('mouseenter', () => clearTimeout(ctT));
  ct.addEventListener('mouseleave', () => { ctT = setTimeout(hideAdded, 2500); });
  $('#ctoastGo').addEventListener('click', hideAdded);
  $('#ctoastCart').addEventListener('click', () => { hideAdded(); open(); });

  /* ───────────── добавление ───────────── */
  function add(id, w, opts) {
    const p = byId(id);
    if (!p || !(w > 0)) return;
    opts = opts || {};
    const ex = items.find(it => it.id === id && it.w === w);
    if (ex) ex.qty = Math.min(MAX_QTY, ex.qty + 1);
    else items.push({ id: id, w: w, qty: 1 });
    save();
    if (!panel.hidden) render();
    if (opts.silent) { syncBadges(false); return; }
    fly(opts.from, () => { syncBadges(true); showAdded(p.name, w); });
  }

  /* ───────────── панель корзины ───────────── */
  const panel = $('#cart'), body = $('#cartBody');
  let lastFocus = null, closeT = 0, formEl = null;

  const IC_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  const IC_BAG = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 16h30l-2.4 22.4a4 4 0 0 1-4 3.6H15.4a4 4 0 0 1-4-3.6L9 16Z"/><path d="M17 21v-7a7 7 0 0 1 14 0v7"/></svg>';

  function nowLocal() {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  function shell() {
    body.innerHTML =
      '<ul class="citems" id="cItems"></ul>' +
      '<div class="csum" id="cSum"></div>' +
      '<form class="cform" id="cForm">' +
        '<fieldset class="segf"><legend class="h-mini">Получение</legend><div class="seg">' +
          '<label><input type="radio" name="dlv" value="pickup" checked><span>Самовывоз</span></label>' +
          '<label><input type="radio" name="dlv" value="delivery"><span>Доставка</span></label>' +
        '</div></fieldset>' +
        '<p class="cform__note" data-when="pickup">Адрес самовывоза укажет владелец: г. ______, ул. ______</p>' +
        '<div class="cform__grp" data-when="delivery" hidden>' +
          '<label class="field"><span>Улица</span><input name="street" autocomplete="address-line1" required disabled></label>' +
          '<div class="cform__row">' +
            '<label class="field"><span>Дом</span><input name="house" required disabled></label>' +
            '<label class="field"><span>Квартира</span><input name="flat" autocomplete="address-line2" disabled></label>' +
          '</div>' +
          '<label class="field"><span>Комментарий</span><textarea name="comment" rows="2" placeholder="Подъезд, этаж, код домофона" disabled></textarea></label>' +
        '</div>' +
        '<label class="field"><span>Дата и время получения</span><input name="when" type="datetime-local" required></label>' +
        '<div class="cform__row">' +
          '<label class="field"><span>Имя</span><input name="name" autocomplete="name" required></label>' +
          '<label class="field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7" required></label>' +
        '</div>' +
        '<button class="btn btn--lg cform__go" type="submit">Оформить заказ</button>' +
        '<p class="cform__demo">Демо-сайт: заявка никуда не отправляется.</p>' +
      '</form>';
    formEl = $('#cForm', body);
    formEl.elements.when.min = nowLocal();
    formEl.addEventListener('change', e => { if (e.target.name === 'dlv') syncDelivery(); });
    formEl.addEventListener('submit', e => {
      e.preventDefault();
      if (!formEl.reportValidity()) return;
      MK.toast('Это демо-сайт, заявка не отправлена');
    });
  }
  function syncDelivery() {
    const mode = formEl.elements.dlv.value;
    $$('[data-when]', formEl).forEach(el => {
      const on = el.dataset.when === mode;
      el.hidden = !on;
      $$('input, textarea', el).forEach(i => { i.disabled = !on; });   // скрытые поля не проверяются и не отправляются
    });
  }

  function render() {
    if (!items.length) {
      formEl = null;
      body.innerHTML =
        '<div class="cart__empty">' + IC_BAG +
          '<h4>Корзина пуста</h4>' +
          '<p>Выберите торт в каталоге — вес и цену можно настроить в его карточке.</p>' +
          '<button class="btn btn--lg" type="button" data-go-catalog>Перейти в каталог</button>' +
        '</div>';
      return;
    }
    if (!formEl) { shell(); syncDelivery(); }
    $('#cItems', body).innerHTML = items.map(it => {
      const p = byId(it.id);
      return '<li class="citem" data-key="' + keyOf(it) + '">' +
          '<span class="citem__ph">' + MK.placeholder(p) + '</span>' +
          '<span class="citem__main"><b>' + p.name + '</b><span>' + MK.kg(it.w) + ' · ' + MK.money(MK.priceAt(p, it.w)) + '</span></span>' +
          '<span class="qty" role="group" aria-label="Количество">' +
            '<button type="button" data-d="-1" aria-label="Меньше"' + (it.qty <= 1 ? ' disabled' : '') + '>−</button>' +
            '<output aria-live="polite">' + it.qty + '</output>' +
            '<button type="button" data-d="1" aria-label="Больше"' + (it.qty >= MAX_QTY ? ' disabled' : '') + '>+</button>' +
          '</span>' +
          '<b class="citem__sum">' + MK.money(sumOf(it)) + '</b>' +
          '<button class="citem__rm" type="button" aria-label="Удалить: ' + p.name + '">' + IC_TRASH + '</button>' +
        '</li>';
    }).join('');
    const n = count();
    $('#cSum', body).innerHTML =
      '<div><span>Общий вес</span><b>' + MK.kg(totalKg()) + '</b></div>' +
      '<div><span>' + n + ' ' + MK.plural(n, ['позиция', 'позиции', 'позиций']) + '</span></div>' +
      '<div class="csum__total"><span>Итого</span><b>' + MK.money(total()) + '</b></div>' +
      '<p>Цена ориентировочная — точную сумму подтвердит кондитер.</p>';
  }

  body.addEventListener('click', e => {
    if (e.target.closest('[data-go-catalog]')) {
      close(false);
      const cat = document.getElementById('catalog');
      if (cat) cat.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const li = e.target.closest('.citem');
    if (!li) return;
    const it = items.find(x => keyOf(x) === li.dataset.key);
    if (!it) return;
    const d = e.target.closest('[data-d]');
    if (d) {
      it.qty = Math.min(MAX_QTY, Math.max(1, it.qty + Number(d.dataset.d)));
    } else if (e.target.closest('.citem__rm')) {
      items = items.filter(x => x !== it);
    } else return;
    save(); render(); syncBadges(false);
    // фокус не теряем: на ту же кнопку той же строки, иначе — на заголовок
    const again = $('.citem[data-key="' + li.dataset.key + '"]', body);
    const btn = again && d ? $('[data-d="' + d.dataset.d + '"]', again) : null;
    (btn && !btn.disabled ? btn : $('[data-cclose].iconbtn', panel)).focus();
  });

  function open() {
    lastFocus = document.activeElement;
    // открыли из модалки или тоста — они сейчас исчезнут, фокус вернём на иконку корзины
    if (!lastFocus || lastFocus.closest('.modal, .ctoast')) lastFocus = cartTarget() || $('#hdrCart');
    if (!ct.hidden) hideAdded();
    render();
    clearTimeout(closeT);
    panel.classList.remove('is-closing');
    panel.hidden = false;
    document.body.classList.add('is-locked');
    $('[data-cclose].iconbtn', panel).focus();
  }
  function close(restore) {
    if (panel.hidden || panel.classList.contains('is-closing')) return;
    const done = () => {
      panel.hidden = true;
      panel.classList.remove('is-closing');
      if (!document.querySelector('.modal:not([hidden]), .sheet:not([hidden])')) document.body.classList.remove('is-locked');
      if (restore !== false && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    };
    if (reduced()) { done(); return; }
    panel.classList.add('is-closing');
    closeT = setTimeout(done, 240);
  }
  panel.addEventListener('click', e => { if (e.target.closest('[data-cclose]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });
  document.addEventListener('click', e => { if (e.target.closest('.js-cart-open')) open(); });

  // корзину поменяли в другой вкладке
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    try { items = JSON.parse(e.newValue || '[]').filter(it => it && byId(it.id)); } catch (err) { items = []; }
    syncBadges(false);
    if (!panel.hidden) render();
  });

  syncBadges(false);

  window.MKCart = { add: add, open: open, close: close, items: () => items.slice(), count: count, total: total };
})();
