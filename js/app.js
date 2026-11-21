/* ============================================================
   Логика демо-сайта: тема, вкладки-фильтр, сетка 2/3/4,
   3D-наклон карточек, модалка с калькулятором гостей.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const money = n => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';
  const kg = n => (Math.round(n * 100) / 100).toLocaleString('ru-RU') + ' кг';
  const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';
  const price = p => p.perKg * p.weight;

  /* ───────────────────────── тема ───────────────────────── */
  const THEME_KEY = 'mk-theme';
  const themeBtn = $('#themeBtn');
  const themeLbl = $('#themeLbl');

  function applyTheme(mode, save) {
    document.documentElement.setAttribute('data-theme', mode);
    themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    themeLbl.textContent = mode === 'dark' ? 'Тёмная' : 'Светлая';
    if (save) { try { localStorage.setItem(THEME_KEY, mode); } catch (e) {} }
  }
  let stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyTheme(stored === 'light' ? 'light' : 'dark', false);

  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
  });

  /* ───────────────────── плейсхолдер вместо фото ───────────────────── */
  function placeholder(p, big) {
    return (
      '<div class="ph" style="background:linear-gradient(155deg,' + p.c1 + ',' + p.c2 + ')">' +
        '<div class="ph__dots"></div>' +
        '<div class="ph__ic"' + (big ? ' style="width:34%;max-width:190px"' : '') + '>' + (ICONS[p.icon] || ICONS.cake) + '</div>' +
      '</div>'
    );
  }

  /* ───────────────────────── вкладки ───────────────────────── */
  const tabsBox = $('#tabs');
  let active = 'all';

  const countIn = id => id === 'all' ? PRODUCTS.length : PRODUCTS.filter(p => p.cat === id).length;

  tabsBox.innerHTML = CATEGORIES
    .filter(c => c.id === 'all' || countIn(c.id) > 0)
    .map(c =>
      '<button class="tab" type="button" role="tab" data-cat="' + c.id + '" aria-selected="' + (c.id === 'all') + '">' +
        c.name + '<span class="tab__n">' + countIn(c.id) + '</span>' +
      '</button>'
    ).join('');

  tabsBox.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    select(tab.dataset.cat);
  });

  tabsBox.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('.tab', tabsBox);
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus(); select(next.dataset.cat);
    e.preventDefault();
  });

  function select(cat) {
    if (cat === active) return;
    active = cat;
    $$('.tab', tabsBox).forEach(t => t.setAttribute('aria-selected', String(t.dataset.cat === cat)));
    $('#catTitle').textContent = cat === 'all' ? 'Все торты' : catName(cat);
    render();
    // фильтрация без перехода: мягко подводим к сетке, если каталог ушёл выше
    const top = $('#catalog').getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: $('#catalog').offsetTop - 110, behavior: 'smooth' });
  }

  /* ───────────────────────── каталог ───────────────────────── */
  const grid = $('#grid');
  const emptyMsg = $('#empty');

  function render() {
    const list = active === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === active);

    grid.innerHTML = list.map((p, i) =>
      '<button class="card" type="button" data-id="' + p.id + '" style="animation-delay:' + Math.min(i * 35, 320) + 'ms">' +
        placeholder(p) +
        '<span class="card__tag">' + catName(p.cat) + '</span>' +
        (p.hit ? '<span class="card__hit">хит</span>' : '') +
        '<span class="card__body">' +
          '<span class="card__name">' + p.name + '</span>' +
          '<span class="card__desc">' + p.desc + '</span>' +
          '<span class="card__foot">' +
            '<span class="card__price">' + money(price(p)) + '<span>' + money(p.perKg) + ' / кг</span></span>' +
            '<span class="card__weight">' + kg(p.weight) + '</span>' +
          '</span>' +
          '<span class="card__more">Подробнее и расчёт →</span>' +
        '</span>' +
      '</button>'
    ).join('');

    emptyMsg.hidden = list.length > 0;
    $('#count').textContent = list.length + ' ' + plural(list.length, ['позиция', 'позиции', 'позиций']);
    if (canTilt()) $$('.card', grid).forEach(bindTilt);
  }

  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  /* ───────────────── переключатель колонок 2/3/4 ───────────────── */
  let chosenCols = 3;
  const colBtns = $$('.cols button');

  function maxCols() {
    const w = window.innerWidth;
    if (w <= 620) return 1;
    if (w <= 900) return 2;
    if (w <= 1180) return 3;
    return 4;
  }
  function applyCols() {
    grid.style.setProperty('--cols', String(Math.min(chosenCols, maxCols())));
  }
  colBtns.forEach(b => b.addEventListener('click', () => {
    chosenCols = Number(b.dataset.cols);
    colBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    applyCols();
  }));
  window.addEventListener('resize', applyCols);

  /* ───────────────── 3D-наклон карточек (десктоп) ───────────────── */
  function canTilt() {
    return window.matchMedia('(hover:hover) and (pointer:fine)').matches
        && window.innerWidth >= 900
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function bindTilt(card) {
    let raf = 0;
    card.addEventListener('pointermove', e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - .5;
        const y = (e.clientY - r.top)  / r.height - .5;
        card.classList.add('is-tilt');
        card.style.transform =
          'perspective(1000px) rotateY(' + (x * 9).toFixed(2) + 'deg) rotateX(' + (-y * 7).toFixed(2) + 'deg) translateY(-6px) scale(1.012)';
      });
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilt');
      card.style.transform = '';
    });
  }

  /* ───────────────────────── модалка ───────────────────────── */
  const modal = $('#modal');
  let current = null, lastFocus = null;

  grid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) open(card.dataset.id, card);
  });

  function open(id, trigger) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    current = p;
    lastFocus = trigger || null;

    $('#mMedia').innerHTML = placeholder(p, true);
    $('#mCat').textContent = catName(p.cat);
    $('#mTitle').textContent = p.name;
    $('#mDesc').textContent = p.desc;
    $('#mPrice').textContent = money(price(p));
    $('#mWeight').textContent = kg(p.weight);
    $('#mPerKg').textContent = money(p.perKg);
    $('#mComp').innerHTML = p.comp.map(c => '<li>' + c + '</li>').join('');
    $('#mMeta').innerHTML = [
      ['Минимальный вес', kg(p.minWeight)],
      ['Ярусов', String(p.tiers)],
      ['Срок заказа', p.lead],
      ['Хранение', p.keeps],
      ['Декор', p.decor]
    ].map(r => '<li><span>' + r[0] + '</span><b>' + r[1] + '</b></li>').join('');

    calc();
    modal.hidden = false;
    document.body.classList.add('is-locked');
    $('.modal__x').focus();
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove('is-locked');
    current = null;
    if (lastFocus) lastFocus.focus();
  }

  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  /* ───────────────── калькулятор «сколько гостей» ───────────────── */
  const guests = $('#cGuests'), portion = $('#cPortion'), out = $('#cOut');

  function calc() {
    if (!current) return;
    const g = Math.max(1, Math.min(300, Number(guests.value) || 1));
    const per = Number(portion.value);

    let w = Math.ceil((g * per / 1000) / 0.25) * 0.25;   // округление вверх до 0,25 кг
    let note = '';
    if (w < current.minWeight) { w = current.minWeight; note = 'минимальный вес торта'; }

    const tiers = w >= 7 ? 3 : w >= 4 ? 2 : 1;
    const servings = Math.floor(w * 1000 / per);

    out.innerHTML =
      '<div class="chip chip--hl"><span>Нужный вес</span><b>' + kg(w) + '</b></div>' +
      '<div class="chip"><span>Примерная цена</span><b>' + money(w * current.perKg) + '</b></div>' +
      '<div class="chip"><span>Порций выйдет</span><b>' + servings + '</b></div>' +
      '<div class="chip"><span>Ярусов</span><b>' + tiers + '</b></div>' +
      (note ? '<p class="calc__hint" style="flex:1 1 100%;margin:0">Вес поднят до ' + kg(w) + ' — это ' + note + '.</p>' : '');
  }
  guests.addEventListener('input', calc);
  portion.addEventListener('change', calc);

  /* ───────────────────────── мелочи ───────────────────────── */
  const toast = $('#toast');
  let toastT = 0;
  document.addEventListener('click', e => {
    if (!e.target.closest('.js-demo')) return;
    clearTimeout(toastT);
    toast.textContent = 'Это демо-сайт — заявки не отправляются';
    toast.classList.add('is-on');
    toastT = setTimeout(() => toast.classList.remove('is-on'), 2600);
  });

  // декоративная карточка в герое
  $('#heroArt').innerHTML = placeholder(PRODUCTS.find(p => p.id === 'ivory'), true);

  applyCols();
  render();
})();
