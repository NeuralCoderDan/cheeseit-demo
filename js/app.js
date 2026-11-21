/* ============================================================
   Логика демо-сайта: тема (с круговым раскрытием), вкладки категорий,
   фильтр по цене и сортировка (FLIP), сетка 2/3/4, 3D-наклон карточек,
   модалка с калькулятором гостей.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const html = document.documentElement;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22,.8,.3,1)';

  const money = n => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';
  const kg = n => (Math.round(n * 100) / 100).toLocaleString('ru-RU') + ' кг';
  const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';
  const price = p => p.perKg * p.weight;

  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  /* ───────────────────────── тема ───────────────────────── */
  const THEME_KEY = 'mk-theme';
  const themeBtn = $('#themeBtn');
  const themeLbl = $('#themeLbl');

  function applyTheme(mode, save) {
    html.setAttribute('data-theme', mode);
    themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    themeLbl.textContent = mode === 'dark' ? 'Тёмная' : 'Светлая';
    if (save) { try { localStorage.setItem(THEME_KEY, mode); } catch (e) {} }
  }
  let stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyTheme(stored === 'light' ? 'light' : 'dark', false);

  let fadeT = 0;
  function switchTheme() {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

    // 1.5: без анимаций вообще
    if (reduced()) { applyTheme(next, true); return; }

    // 1.2: нет View Transitions — плавный CSS-переход цветов на время смены
    if (!document.startViewTransition) {
      html.classList.add('theme-fade');
      applyTheme(next, true);
      clearTimeout(fadeT);
      fadeT = setTimeout(() => html.classList.remove('theme-fade'), 350);
      return;
    }

    // 1.1: новая тема раскрывается кругом из центра кнопки до дальнего угла
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    html.classList.add('vt-theme');
    const t = document.startViewTransition(() => applyTheme(next, true));
    t.ready.then(() => {
      html.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
    t.finished.finally(() => html.classList.remove('vt-theme'));
  }
  themeBtn.addEventListener('click', switchTheme);

  /* ───────────────────── плейсхолдер вместо фото ───────────────────── */
  function placeholder(p, big) {
    return (
      '<div class="ph" style="background:linear-gradient(155deg,' + p.c1 + ',' + p.c2 + ')">' +
        '<div class="ph__dots"></div>' +
        '<div class="ph__ic"' + (big ? ' style="width:34%;max-width:190px"' : '') + '>' + (ICONS[p.icon] || ICONS.cake) + '</div>' +
      '</div>'
    );
  }

  /* ───────────────────────── фильтры ───────────────────────── */
  const PRICES = [
    { id: 'any',  label: 'Любая' },
    { id: 'lt3',  label: 'до 3 000 ₽',                  max: 3000 },
    { id: '3-6',  label: '3 000 – 6 000 ₽',        min: 3000,  max: 6000 },
    { id: '6-10', label: '6 000 – 10 000 ₽',       min: 6000,  max: 10000 },
    { id: 'gt10', label: 'от 10 000 ₽',                 min: 10000 }
  ];
  const SORTS = ['popular', 'asc', 'desc'];
  const FILTER_KEY = 'mk-filters';
  const ORDER = new Map(PRODUCTS.map((p, i) => [p.id, i]));

  // границы без щелей и пересечений: (min; max]
  function inPrice(p, id) {
    const r = PRICES.find(x => x.id === id) || PRICES[0];
    const v = price(p);
    if (r.min != null && v <= r.min) return false;
    if (r.max != null && v > r.max) return false;
    return true;
  }

  /* сохраняем категорию и сортировку; цену — нет: при новом заходе всегда «Любая»,
     иначе человек возвращается к каталогу из двух позиций и категориям с нулями */
  const f = { cat: 'all', price: 'any', sort: 'popular' };
  try {
    const saved = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null');
    if (saved) {
      if (CATEGORIES.some(c => c.id === saved.cat)) f.cat = saved.cat;
      if (SORTS.indexOf(saved.sort) > -1)           f.sort = saved.sort;
    }
  } catch (e) {}
  const saveFilters = () => { try { localStorage.setItem(FILTER_KEY, JSON.stringify({ cat: f.cat, sort: f.sort })); } catch (e) {} };

  /* 8.2 — заголовок каталога по фильтру: «Детские торты до 3 000 ₽» */
  const CAT_TITLE = {
    all: 'Торты', birthday: 'Торты на день рождения', kids: 'Детские торты', wedding: 'Свадебные торты',
    mousse: 'Муссовые торты', cheesecake: 'Чизкейки', bento: 'Бенто-торты', cupcakes: 'Капкейки'
  };
  const PRICE_TITLE = {
    lt3: 'до 3\u00a0000 ₽', '3-6': 'от 3\u00a0000 до 6\u00a0000 ₽',
    '6-10': 'от 6\u00a0000 до 10\u00a0000 ₽', gt10: 'от 10\u00a0000 ₽'
  };
  function catalogTitle() {
    if (f.price === 'any') return f.cat === 'all' ? 'Все торты' : (CAT_TITLE[f.cat] || catName(f.cat));
    return (CAT_TITLE[f.cat] || catName(f.cat)) + ' ' + PRICE_TITLE[f.price];
  }

  function visible() {
    const list = PRODUCTS.filter(p => (f.cat === 'all' || p.cat === f.cat) && inPrice(p, f.price));
    if (f.sort === 'asc')  return list.sort((a, b) => price(a) - price(b) || ORDER.get(a.id) - ORDER.get(b.id));
    if (f.sort === 'desc') return list.sort((a, b) => price(b) - price(a) || ORDER.get(a.id) - ORDER.get(b.id));
    return list.sort((a, b) => (b.hit ? 1 : 0) - (a.hit ? 1 : 0) || ORDER.get(a.id) - ORDER.get(b.id));
  }

  /* вкладки категорий — счётчик учитывает выбранную цену */
  const tabsBox = $('#tabs');
  tabsBox.innerHTML = CATEGORIES.map(c =>
    '<button class="tab" type="button" role="tab" data-cat="' + c.id + '" aria-selected="false">' +
      c.name + '<span class="tab__n"></span>' +
    '</button>').join('');

  /* пресеты цены */
  const pricesBox = $('#prices');
  pricesBox.innerHTML = PRICES.map(r =>
    '<button class="pchip" type="button" data-price="' + r.id + '" aria-pressed="false">' + r.label + '</button>').join('');

  const sortSel = $('#sort');

  function syncControls() {
    $$('.tab', tabsBox).forEach(t => {
      const c = t.dataset.cat;
      t.setAttribute('aria-selected', String(c === f.cat));
      const n = PRODUCTS.filter(p => (c === 'all' || p.cat === c) && inPrice(p, f.price)).length;
      $('.tab__n', t).textContent = n;
      const off = n === 0 && c !== f.cat;          // выбранную не блокируем — у неё есть «Сбросить фильтры»
      t.disabled = off;
      t.setAttribute('aria-disabled', String(off));
    });
    $$('.pchip', pricesBox).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.price === f.price)));
    sortSel.value = f.sort;
    $('#catTitle').textContent = catalogTitle();
    updateScrollers();
  }

  function update(scroll) {
    saveFilters();
    syncControls();
    render();
    // фильтрация на месте: если каталог ушёл выше экрана — мягко подводим к его началу
    if (scroll && $('#catalog').getBoundingClientRect().top < 0) scrollToCatalog();
  }

  tabsBox.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab || tab.disabled || tab.dataset.cat === f.cat) return;
    f.cat = tab.dataset.cat;
    update(true);
  });
  tabsBox.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('.tab', tabsBox).filter(t => !t.disabled);
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    next.focus();
    f.cat = next.dataset.cat;
    update(true);
    e.preventDefault();
  });
  pricesBox.addEventListener('click', e => {
    const b = e.target.closest('.pchip');
    if (!b || b.dataset.price === f.price) return;
    f.price = b.dataset.price;
    update(true);
  });
  sortSel.addEventListener('change', () => { f.sort = sortSel.value; update(false); });
  $('#resetFilters').addEventListener('click', () => { f.cat = 'all'; f.price = 'any'; update(false); });

  /* ───────── ряды вкладок и цен: растушёвка у краёв + стрелки на десктопе ───────── */
  const ARROW = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' +
                     (d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '"/></svg>';
  const scrollers = [];
  function makeScroller(el) {
    const wrap = document.createElement('div');
    wrap.className = 'scroller';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    [[-1, 'l', 'Прокрутить влево'], [1, 'r', 'Прокрутить вправо']].forEach(([d, side, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scroller__btn scroller__btn--' + side;
      b.tabIndex = -1;                                  // с клавиатуры ряд и так проходится Tab / стрелками
      b.setAttribute('aria-hidden', 'true');
      b.title = label;
      b.innerHTML = ARROW(d);
      b.addEventListener('click', () => el.scrollBy({ left: d * el.clientWidth * 0.7, behavior: reduced() ? 'auto' : 'smooth' }));
      wrap.appendChild(b);
    });
    const upd = () => {
      const max = el.scrollWidth - el.clientWidth;
      wrap.classList.toggle('can-l', el.scrollLeft > 2);
      wrap.classList.toggle('can-r', el.scrollLeft < max - 2);
    };
    el.addEventListener('scroll', upd, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(upd).observe(el);
    scrollers.push(upd);
  }
  function updateScrollers() { scrollers.forEach(u => u()); }
  makeScroller(tabsBox);
  makeScroller(pricesBox);

  /* 8.1 — панель под шапкой не липнет над первым экраном; прилипает, когда доскроллили до каталога */
  const bar = $('#tabsbar'), hdr = $('.hdr'), catalogEl = $('#catalog');
  const spacer = document.createElement('div');
  spacer.className = 'tabsbar-spacer';
  bar.after(spacer);
  const stickTop = () => getComputedStyle(hdr).position === 'sticky' ? hdr.getBoundingClientRect().height : 0;
  let barH = 0, stickRaf = 0;
  function updateStick() {
    stickRaf = 0;
    const stuck = bar.classList.contains('is-stuck');
    if (!stuck) barH = bar.offsetHeight;
    const top = stickTop(), r = catalogEl.getBoundingClientRect();
    const want = r.top <= top + barH && r.bottom > top + barH + 80;
    if (want === stuck) return;
    bar.classList.toggle('is-stuck', want);
    bar.style.setProperty('--stick-top', top + 'px');
    spacer.style.height = want ? barH + 'px' : '';
  }
  const queueStick = () => { if (!stickRaf) stickRaf = requestAnimationFrame(updateStick); };
  window.addEventListener('scroll', queueStick, { passive: true });
  window.addEventListener('resize', () => { bar.classList.toggle('is-stuck', false); spacer.style.height = ''; queueStick(); });

  function scrollToCatalog() {
    const y = window.scrollY + catalogEl.getBoundingClientRect().top - stickTop() - (barH || bar.offsetHeight) - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* ───────────────────────── каталог ───────────────────────── */
  const grid = $('#grid');
  const emptyMsg = $('#empty');

  function createCard(p) {
    const el = document.createElement('button');
    el.className = 'card';
    el.type = 'button';
    el.dataset.id = p.id;
    el.innerHTML =
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
      '</span>';
    if (canTilt()) bindTilt(el);
    return el;
  }

  /* FLIP: запоминаем старые позиции, перестраиваем DOM, проигрываем сдвиг */
  function render() {
    const list = visible();
    const animate = !reduced();

    const old = new Map();
    $$('.card', grid).forEach(el => {
      if (animate) old.set(el.dataset.id, el.getBoundingClientRect());
      el.getAnimations().forEach(a => a.cancel());
      old.has(el.dataset.id) || old.set(el.dataset.id, null);
    });
    const byId = new Map($$('.card', grid).map(el => [el.dataset.id, el]));

    const els = list.map(p => byId.get(p.id) || createCard(p));
    grid.replaceChildren.apply(grid, els);

    if (animate) {
      let fresh = 0;
      els.forEach(el => {
        const first = old.get(el.dataset.id);
        if (first) {
          const last = el.getBoundingClientRect();
          const dx = first.left - last.left, dy = first.top - last.top;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
                       { duration: 420, easing: EASE });
          }
        } else {
          el.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }],
                     { duration: 320, delay: Math.min(fresh++ * 35, 280), easing: EASE, fill: 'backwards' });
        }
      });
    }

    emptyMsg.hidden = list.length > 0;
    $('#count').textContent = 'Найдено: ' + list.length + ' ' + plural(list.length, ['торт', 'торта', 'тортов']);
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
  /* смена колонок — через View Transitions: карточки плавно меняют размер и место */
  function setCols(n) {
    chosenCols = n;
    colBtns.forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.cols) === n)));
    if (reduced() || !document.startViewTransition) { applyCols(); return; }
    const cards = $$('.card', grid);
    cards.forEach(el => { el.style.viewTransitionName = 'card-' + el.dataset.id; });
    html.classList.add('vt-cols');
    const t = document.startViewTransition(applyCols);
    t.finished.finally(() => {
      cards.forEach(el => { el.style.viewTransitionName = ''; });
      html.classList.remove('vt-cols');
    });
  }
  colBtns.forEach(b => b.addEventListener('click', () => setCols(Number(b.dataset.cols))));
  window.addEventListener('resize', applyCols);

  /* ───────────────── 3D-наклон карточек (десктоп) ───────────────── */
  function canTilt() {
    return window.matchMedia('(hover:hover) and (pointer:fine)').matches
        && window.innerWidth >= 900
        && !reduced();
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
  let current = null, lastFocus = null, closingT = 0;

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
    $('#mMeta').innerHTML = [
      ['Минимальный вес', kg(p.minWeight)],
      ['Ярусов', String(p.tiers)],
      ['Декор', p.decor]
    ].map(r => '<li><span>' + r[0] + '</span><b>' + r[1] + '</b></li>').join('');

    calc();
    clearTimeout(closingT);
    modal.classList.remove('is-closing');
    modal.hidden = false;
    document.body.classList.add('is-locked');
    $('.modal__x').focus();
  }

  function close() {
    if (modal.hidden || modal.classList.contains('is-closing')) return;
    const finish = () => {
      modal.hidden = true;
      modal.classList.remove('is-closing');
      document.body.classList.remove('is-locked');
      current = null;
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    };
    if (reduced()) { finish(); return; }
    modal.classList.add('is-closing');                 // fade + scale до 0.96, потом прячем
    closingT = setTimeout(finish, 190);
  }

  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  /* ───────────────── калькулятор «сколько гостей» ───────────────── */
  const guests = $('#cGuests'), portion = $('#cPortion'), out = $('#cOut');

  /* формула веса — общая с ИИ-помощником */
  function rawWeight(guestsN, per) {
    const g = Math.max(1, Math.min(300, Number(guestsN) || 1));
    return Math.ceil((g * (Number(per) || 170) / 1000) / 0.25) * 0.25;   // округление вверх до 0,25 кг
  }
  function weightForGuests(p, guestsN, per) {
    return Math.max(rawWeight(guestsN, per), p.minWeight);
  }

  function calc() {
    if (!current) return;
    const per = Number(portion.value);
    const raw = rawWeight(guests.value, per);
    const w = Math.max(raw, current.minWeight);
    const note = w > raw ? 'минимальный вес торта' : '';

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

  // факты в герое — считаются из каталога, а не придумываются
  $('#fCount').textContent = PRODUCTS.length;
  $('#fCats').textContent = new Set(PRODUCTS.map(p => p.cat)).size;
  $('#fMin').textContent = money(Math.min.apply(null, PRODUCTS.map(price)));

  // декоративная карточка в герое
  $('#heroArt').innerHTML = placeholder(PRODUCTS.find(p => p.id === 'ivory'), true);

  /* ─────────── публичный API: им пользуется js/assistant.js ─────────── */
  window.MK = {
    products: PRODUCTS,
    catName: catName,
    placeholder: placeholder,
    money: money,
    kg: kg,
    price: price,
    plural: plural,
    weightForGuests: weightForGuests,
    openProduct: function (id, trigger) { open(id, trigger || null); }
  };

  // первое выставление состояния — без переходов, иначе активные кнопки «наплывают» цветом при загрузке
  html.classList.add('is-booting');
  applyCols();
  syncControls();
  render();
  updateStick();
  setTimeout(() => html.classList.remove('is-booting'), 60);
})();
