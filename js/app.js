/* ============================================================
   Логика демо-сайта: тема (с круговым раскрытием), вкладки категорий,
   фильтр по цене и сортировка (FLIP), сетка 2/3/4, 3D-наклон карточек,
   модалка: вес кнопками, подсказка по гостям, «В корзину».
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
  /* ── вес и цена: торт делается под заказ на нужный вес ──
     Цена всегда считается от веса: perKg × вес. Фиксированной цены у торта нет. */
  const PER_GUEST = 0.18;                                   // кг на человека — внутри, не показываем
  const STEPS = [1, 1.5, 2, 2.5, 3, 4];
  const BIG_STEPS = [3, 4, 5, 6, 8, 10];                   // для свадебных и многоярусных
  function weightOptions(p) {
    if (p.weights) return p.weights.slice();
    const big = p.tiers >= 2 || p.minWeight >= 3;
    const list = (big ? BIG_STEPS : STEPS).filter(w => w >= p.minWeight);
    if (!list.length || list[0] > p.minWeight) list.unshift(p.minWeight);
    return list.slice(0, 6);
  }
  const minW = p => weightOptions(p)[0];
  const priceAt = (p, w) => Math.round(p.perKg * w);
  const price = p => priceAt(p, minW(p));                  // цена «от» — за минимальный вес
  const kgForGuests = g => Math.max(1, Number(g) || 1) * PER_GUEST;
  /* вес под гостей: ближайший вес из кнопок торта, не меньше нужного;
     если гостей больше, чем на самый большой вес, — округляем вверх до 0,5 кг */
  function weightForGuests(p, g) {
    const need = kgForGuests(g), opts = weightOptions(p);
    const hit = opts.find(w => w >= need - 1e-9);
    if (hit != null) return hit;
    return p.weights ? opts[opts.length - 1] : Math.ceil(need * 2 - 1e-9) / 2;
  }
  const hasTiers = p => p.tiers >= 2 || p.cat === 'wedding';
  const fromWord = p => weightOptions(p).length > 1 ? 'от\u00a0' : '';

  /* срок приготовления: число из js/data.js или заглушка «___» */
  const leadDays = p => (typeof p.leadDays === 'number' && p.leadDays >= 0 ? p.leadDays : null);
  function leadText(p) {
    const d = leadDays(p);
    return d == null ? '___ дня' : d + '\u00a0' + plural(d, ['день', 'дня', 'дней']);
  }

  /* ── 4: поиск по названию и описанию — вместе с категорией и ценой ── */
  const normQ = t => String(t || '').toLowerCase().replace(/ё/g, 'е').trim();
  const HAY = new Map(PRODUCTS.map(p => [p.id, normQ(p.name + ' ' + p.desc + ' ' + (CATEGORIES.find(c => c.id === p.cat) || {}).name)]));
  /* грубое отсечение окончаний: «свадьба» находит «Свадебные», «ягоды» — «с ягодами» */
  const stem = w => (w.length >= 5 ? w.slice(0, Math.max(4, w.length - 4)) : w);
  const inQuery = (p, q) => !q || normQ(q).split(/\s+/).every(w => HAY.get(p.id).indexOf(stem(w)) > -1);

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
      '<div class="ph" aria-hidden="true" style="background:linear-gradient(155deg,' + p.c1 + ',' + p.c2 + ')">' +
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
  const f = { cat: 'all', price: 'any', sort: 'popular', q: '' };   // q (поиск) не сохраняем
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
    const list = PRODUCTS.filter(p => (f.cat === 'all' || p.cat === f.cat) && inPrice(p, f.price) && inQuery(p, f.q));
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
      const n = PRODUCTS.filter(p => (c === 'all' || p.cat === c) && inPrice(p, f.price) && inQuery(p, f.q)).length;
      $('.tab__n', t).textContent = n;
      const off = n === 0 && c !== f.cat;          // выбранную не блокируем — у неё есть «Сбросить фильтры»
      t.disabled = off;
      t.setAttribute('aria-disabled', String(off));
    });
    $$('.pchip', pricesBox).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.price === f.price)));
    sortSel.value = f.sort;
    $('#catTitle').textContent = catalogTitle();
    updateScrollers();
    if (typeof syncBar === 'function') syncBar();
  }

  /* 5.2 — при смене фильтра страница не прыгает: позиция прокрутки сохраняется.
     Если карточек стало меньше, сетка временно держит высоту до низа экрана (min-height):
     следующая секция не выезжает под прилипшую панель, панель остаётся на месте.
     По мере прокрутки вверх лишняя высота уходит — за краем экрана, без рывка.
     Если ни одной карточки не осталось в поле зрения — плавно подводим к началу результатов. */
  let gridNatural = 0;
  function update() {
    const y = window.scrollY;
    const inCatalog = bar.classList.contains('is-stuck');
    saveFilters();
    syncControls();
    render();
    grid.style.minHeight = '';
    gridNatural = grid.offsetHeight;
    const gridTop = grid.getBoundingClientRect().top + window.scrollY;     // в координатах документа
    let hold = inCatalog ? y + window.innerHeight - gridTop : 0;
    const deficit = y + window.innerHeight - document.documentElement.scrollHeight;
    if (deficit > 0) hold = Math.max(hold, gridNatural + deficit);
    if (hold > gridNatural) grid.style.minHeight = Math.ceil(hold) + 'px';
    if (Math.abs(window.scrollY - y) > 0.5) window.scrollTo({ top: y, behavior: 'instant' });

    if (inCatalog) {
      const under = stickTop() + barH;                                    // низ прилипшей панели
      let bottom = gridTop - y + gridNatural;
      if (!emptyMsg.hidden) bottom += emptyMsg.offsetHeight;
      if (bottom < under + 60) window.scrollTo({ top: Math.max(0, gridTop - under - 16), behavior: reduced() ? 'auto' : 'smooth' });
    }
    updateStick();
  }
  function relaxGrid() {
    if (!grid.style.minHeight) return;
    const want = Math.max(gridNatural, Math.ceil(window.innerHeight - grid.getBoundingClientRect().top));
    if (want < grid.offsetHeight - 1) grid.style.minHeight = want > gridNatural + 1 ? want + 'px' : '';
  }

  tabsBox.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab || tab.disabled || tab.dataset.cat === f.cat) return;
    f.cat = tab.dataset.cat;
    update();
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
    update();
    e.preventDefault();
  });
  pricesBox.addEventListener('click', e => {
    const b = e.target.closest('.pchip');
    if (!b || b.dataset.price === f.price) return;
    f.price = b.dataset.price;
    update();
  });
  sortSel.addEventListener('change', () => { f.sort = sortSel.value; update(); });
  $('#resetFilters').addEventListener('click', () => { f.cat = 'all'; f.price = 'any'; setQuery(''); update(); });

  const searchIns = $$('.js-search');
  function setQuery(v) {
    f.q = v;
    searchIns.forEach(i => { if (i.value !== v) i.value = v; });
    $$('.js-search-clear').forEach(b => { b.hidden = !v; });
  }
  searchIns.forEach(inp => {
    inp.addEventListener('input', () => { setQuery(inp.value); update(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape' && inp.value) { e.stopPropagation(); setQuery(''); update(); }
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }       // на телефоне прячем клавиатуру
    });
  });
  $$('.js-search-clear').forEach(b => b.addEventListener('click', () => {
    const inp = $('.js-search', b.parentNode);
    setQuery(''); update(); inp.focus();
  }));

  /* ───────── 5.3 — телефон: кнопка «Фильтры (2)» и панель снизу ───────── */
  const SORT_LABEL = { popular: 'Сначала популярные', asc: 'Дешевле', desc: 'Дороже' };
  const countIn = (cat, pr) => PRODUCTS.filter(p => (cat === 'all' || p.cat === cat) && inPrice(p, pr) && inQuery(p, f.q)).length;
  const activeN = o => (o.cat !== 'all') + (o.price !== 'any') + (o.sort !== 'popular');
  const sheet = $('#fsheet'), fOpen = $('#fOpen');
  let draft = null, sheetT = 0;

  function syncBar() {
    const n = activeN(f);
    $('#fOpenLbl').textContent = n ? 'Фильтры (' + n + ')' : 'Фильтры';
    fOpen.classList.toggle('is-active', n > 0);
    const shown = visible().length;
    const sum = $('#fSum');
    if (sum) sum.textContent = shown + ' ' + plural(shown, ['торт', 'торта', 'тортов']);
  }
  function renderSheet() {
    const chip = (attr, val, label, on, off) =>
      '<button class="schip" type="button" data-' + attr + '="' + val + '" aria-pressed="' + on + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
    $('#fsCats').innerHTML = CATEGORIES.map(c => {
      const n = countIn(c.id, draft.price);
      return chip('cat', c.id, c.name + ' <span>' + n + '</span>', c.id === draft.cat, n === 0 && c.id !== draft.cat);
    }).join('');
    $('#fsPrices').innerHTML = PRICES.map(r => chip('price', r.id, r.label, r.id === draft.price, false)).join('');
    $('#fsSort').innerHTML = SORTS.map(v => chip('sort', v, SORT_LABEL[v], v === draft.sort, false)).join('');
    const n = countIn(draft.cat, draft.price);
    $('#fsApply').textContent = 'Применить · ' + n + ' ' + plural(n, ['торт', 'торта', 'тортов']);
  }
  function openSheet() {
    draft = { cat: f.cat, price: f.price, sort: f.sort };
    renderSheet();
    clearTimeout(sheetT);
    sheet.classList.remove('is-closing');
    sheet.hidden = false;
    document.body.classList.add('is-locked');
    $('[data-sclose].iconbtn', sheet).focus();
  }
  function closeSheet() {
    if (sheet.hidden || sheet.classList.contains('is-closing')) return;
    const done = () => { sheet.hidden = true; sheet.classList.remove('is-closing'); document.body.classList.remove('is-locked'); fOpen.focus(); };
    if (reduced()) { done(); return; }
    sheet.classList.add('is-closing');
    sheetT = setTimeout(done, 220);
  }
  fOpen.addEventListener('click', openSheet);
  sheet.addEventListener('click', e => {
    if (e.target.closest('[data-sclose]')) { closeSheet(); return; }
    const b = e.target.closest('.schip');
    if (!b || b.disabled) return;
    if (b.dataset.cat) draft.cat = b.dataset.cat;
    if (b.dataset.price) { draft.price = b.dataset.price; if (countIn(draft.cat, draft.price) === 0) draft.cat = 'all'; }
    if (b.dataset.sort) draft.sort = b.dataset.sort;
    renderSheet();
  });
  $('#fsReset').addEventListener('click', () => { draft = { cat: 'all', price: 'any', sort: 'popular' }; renderSheet(); });
  $('#fsApply').addEventListener('click', () => {
    f.cat = draft.cat; f.price = draft.price; f.sort = draft.sort;
    update();
    closeSheet();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

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

  // меню в шапке на телефоне листается: растушёвка справа, пока не докрутили до конца
  const nav = $('.nav');
  const navEnd = () => nav.classList.toggle('is-end', nav.scrollLeft >= nav.scrollWidth - nav.clientWidth - 2);
  nav.addEventListener('scroll', navEnd, { passive: true });
  window.addEventListener('resize', navEnd);
  navEnd();

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
  const queueStick = () => { if (!stickRaf) stickRaf = requestAnimationFrame(() => { relaxGrid(); updateStick(); }); };
  window.addEventListener('scroll', queueStick, { passive: true });
  window.addEventListener('resize', () => {
    bar.classList.toggle('is-stuck', false); spacer.style.height = ''; grid.style.minHeight = ''; queueStick();
  });

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
          '<span class="card__price">' + fromWord(p) + money(price(p)) + '</span>' +
          '<span class="card__weight">' + fromWord(p) + kg(minW(p)) + '</span>' +
        '</span>' +
        '<span class="card__lead">Готовим ' + leadText(p) + '</span>' +
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
    if (!list.length) {
      $('#emptyText').textContent = f.q ? 'Ничего не нашли по запросу «' + f.q.trim() + '».' : 'По этим условиям ничего нет.';
      $('#resetFilters').textContent = f.q ? 'Сбросить поиск и фильтры' : 'Сбросить фильтры';
    }
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

  let curW = 0;

  function open(id, trigger, weight) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    current = p;
    lastFocus = trigger || null;

    $('#mMedia').innerHTML = placeholder(p, true);
    $('#mCat').textContent = catName(p.cat);
    $('#mTitle').textContent = p.name;
    $('#mDesc').textContent = p.desc;
    $('#mLead').innerHTML = 'Готовим <b>' + leadText(p) + '</b>' +
      (leadDays(p) == null ? '<small>срок укажет владелец</small>' : '<small>учитывайте при выборе даты</small>');
    $('#mMeta').innerHTML = [
      ['Минимальный вес', kg(minW(p))],
      hasTiers(p) ? ['Ярусов', String(p.tiers)] : null,
      ['Декор', p.decor]
    ].filter(Boolean).map(r => '<li><span>' + r[0] + '</span><b>' + r[1] + '</b></li>').join('');

    // вес: из подбора помощника, иначе — минимальный
    const opts = weightOptions(p);
    if (weight && opts.indexOf(weight) < 0) { opts.push(weight); opts.sort((x, y) => x - y); }
    curW = weight || opts[0];
    wBtns.innerHTML = opts.map(w =>
      '<button class="wbtn" type="button" role="radio" data-w="' + w + '" aria-checked="false">' + kg(w) + '</button>').join('');
    $('.wcalc', modal).classList.toggle('is-single', opts.length < 2);
    $('#wLbl').textContent = p.cat === 'cupcakes' ? 'Вес набора' : 'Вес торта';
    guests.value = '';
    calc();

    clearTimeout(closingT);
    modal.classList.remove('is-closing');
    modal.hidden = false;
    document.body.classList.add('is-locked');
    $('.modal__x').focus();

    remember(p.id);
    setCakeParam(p.id);
  }

  function close(keepFocus) {
    if (modal.hidden || modal.classList.contains('is-closing')) return;
    if (keepFocus === true) lastFocus = null;
    const finish = () => {
      modal.hidden = true;
      modal.classList.remove('is-closing');
      if (!document.querySelector('.cart:not([hidden]), .sheet:not([hidden])')) document.body.classList.remove('is-locked');
      current = null;
      setCakeParam(null);
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    };
    if (reduced()) { finish(); return; }
    modal.classList.add('is-closing');                 // fade + scale до 0.96, потом прячем
    closingT = setTimeout(finish, 190);
  }

  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  /* ───────── 1: ссылка прямо на торт — ?cake=ID ───────── */
  const cakeUrl = id => {
    const u = new URL(location.href);
    u.hash = '';
    u.search = '';
    u.searchParams.set('cake', id);
    return u.toString();
  };
  function setCakeParam(id) {
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set('cake', id); else u.searchParams.delete('cake');
      history.replaceState(history.state, '', u.toString());   // адресная строка тоже ведёт на торт
    } catch (e) {}
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement('textarea');                 // запасной путь
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }
  /* на телефоне — системное меню «Поделиться», на десктопе — копируем ссылку */
  const isTouch = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  $('#mShare').addEventListener('click', async () => {
    if (!current) return;
    const url = cakeUrl(current.id);
    const data = { title: current.name + ' — Моя кондитерская', text: current.name + ': ' + current.desc, url: url };
    if (navigator.share && isTouch()) {
      try { await navigator.share(data); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }      // человек закрыл меню — ничего не делаем
    }
    toast(await copyText(url) ? 'Ссылка скопирована' : 'Не удалось скопировать: ' + url);
  });

  /* ───────── 6: недавно смотрели — последние 6, в localStorage ───────── */
  const RECENT_KEY = 'mk-recent', recentBox = $('#recent'), recentList = $('#recentList');
  let recent = [];
  try { recent = (JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []).filter(id => PRODUCTS.some(p => p.id === id)).slice(0, 6); } catch (e) {}
  function renderRecent() {
    recentBox.hidden = recent.length === 0;                  // пусто — блока нет вовсе
    recentList.innerHTML = recent.map(id => {
      const p = PRODUCTS.find(x => x.id === id);
      return '<li><button class="rcard" type="button" data-id="' + p.id + '">' +
               '<span class="rcard__ph">' + placeholder(p) + '</span>' +
               '<span class="rcard__t"><b>' + p.name + '</b><span>' + fromWord(p) + money(price(p)) + '</span></span>' +
             '</button></li>';
    }).join('');
  }
  function remember(id) {
    recent = [id].concat(recent.filter(x => x !== id)).slice(0, 6);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {}
    renderRecent();
  }
  recentList.addEventListener('click', e => {
    const b = e.target.closest('.rcard');
    if (b) open(b.dataset.id, b);
  });
  $('#recentClear').addEventListener('click', () => {
    recent = [];
    try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
    renderRecent();
    const t = $('#catTitle'); t.setAttribute('tabindex', '-1'); t.focus();   // фокус не теряется вместе с блоком
  });

  /* ───────── фокус не уходит из открытого окна (модалка, корзина, фильтры) ───────── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const box = $('.cart:not([hidden]) .cart__box') || $('.sheet:not([hidden]) .sheet__box') || $('.modal:not([hidden]) .modal__box');
    if (!box) return;
    const items = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', box)
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!box.contains(document.activeElement)) { first.focus(); e.preventDefault(); return; }
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });

  /* ───────────────── вес кнопками + подсказка по гостям ───────────────── */
  const wBtns = $('#wBtns'), guests = $('#cGuests'), gHint = $('#gHint'), wTotal = $('#wTotal');

  /* «На 15 человек обычно берут 2,5–3 кг» — диапазон с шагом 0,5 кг */
  function guestRange(g) {
    const need = kgForGuests(g);
    return [Math.max(0.5, Math.floor(need * 2 + 1e-9) / 2), Math.max(0.5, Math.ceil(need * 2 - 1e-9) / 2)];
  }
  function guestText(g) {
    const r = guestRange(g), lo = r[0], hi = r[1];
    const range = lo === hi ? kg(lo) : (lo.toLocaleString('ru-RU') + '–' + kg(hi));
    return 'На ' + g + ' ' + plural(g, ['человека', 'человека', 'человек']) + ' обычно берут ' + range;
  }

  function calc() {
    if (!current) return;
    const g = Math.round(Number(guests.value));
    let suggest = null, marked = [];
    if (g >= 1 && g <= 300) {
      const need = kgForGuests(g), opts = $$('.wbtn', wBtns).map(b => Number(b.dataset.w));
      suggest = opts.find(w => w >= need - 1e-9);
      // подсвечиваем все веса из диапазона подсказки; если ни одного нет — ближайший подходящий
      const r = guestRange(g);
      marked = opts.filter(w => w >= r[0] - 1e-9 && w <= r[1] + 1e-9);
      if (!marked.length && suggest != null) marked = [suggest];
      let extra = '';
      if (suggest == null) extra = ' — это больше самого большого веса этого торта, лучше взять два';
      else if (suggest === opts[0] && suggest / need >= 1.5) extra = '. Минимальный вес этого торта ' + kg(suggest) + ' — хватит с запасом';
      gHint.textContent = guestText(g) + extra;
    } else {
      gHint.textContent = 'Подскажем вес по числу гостей';
    }
    $$('.wbtn', wBtns).forEach(b => {
      const w = Number(b.dataset.w);
      b.setAttribute('aria-checked', String(w === curW));
      b.tabIndex = w === curW ? 0 : -1;
      b.classList.toggle('is-suggested', marked.indexOf(w) > -1);   // подсвечиваем, но не выбираем
    });
    wTotal.textContent = kg(curW) + ' — ' + money(priceAt(current, curW));
  }
  wBtns.addEventListener('click', e => {
    const b = e.target.closest('.wbtn');
    if (!b) return;
    curW = Number(b.dataset.w);
    calc();
  });
  wBtns.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    const bs = $$('.wbtn', wBtns), i = bs.findIndex(b => Number(b.dataset.w) === curW);
    const n = bs[(i + d + bs.length) % bs.length];
    curW = Number(n.dataset.w); calc(); n.focus();
    e.preventDefault();
  });
  guests.addEventListener('input', calc);

  /* корзина (js/cart.js): «В корзину» — полёт и тост; «Оформить заказ» — сразу в корзину */
  $('#mAdd').addEventListener('click', () => {
    if (!current || !window.MKCart) return;
    window.MKCart.add(current.id, curW, { from: $('.ph', $('#mMedia')) });
    close(true);
  });
  $('#mOrder').addEventListener('click', () => {
    if (!current || !window.MKCart) return;
    window.MKCart.add(current.id, curW, { silent: true });
    close(true);
    window.MKCart.open();
  });

  /* ───────────────────────── мелочи ───────────────────────── */
  const toastEl = $('#toast');
  let toastT = 0;
  function toast(text) {
    clearTimeout(toastT);
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }
  document.addEventListener('click', e => {
    if (e.target.closest('.js-demo')) toast('Это демо-сайт — заявки не отправляются');
  });

  /* 8 — телефон владельца: одна константа OWNER_PHONE в js/data.js */
  const phone = typeof OWNER_PHONE === 'string' ? OWNER_PHONE.trim() : '';
  const phoneSet = phone !== '' && phone.indexOf('_') < 0 && phone.replace(/\D/g, '').length >= 10;
  $$('[data-phone]').forEach(el => { el.textContent = phone || '+7 (___) ___-__-__'; });
  const callBtn = $('#callBtn');
  if (phoneSet) {
    callBtn.href = 'tel:' + phone.replace(/[^\d+]/g, '');
    callBtn.setAttribute('aria-label', 'Позвонить: ' + phone);
  } else {
    callBtn.addEventListener('click', e => { e.preventDefault(); toast('Номер пока не указан: ' + (phone || '+7 (___) ___-__-__')); });
  }

  // факты в герое — считаются из каталога, а не придумываются; цена — «от», за минимальный вес
  $('#fCount').textContent = PRODUCTS.length;
  $('#fCats').textContent = new Set(PRODUCTS.map(p => p.cat)).size;
  $('#fMin').textContent = 'от\u00a0' + money(Math.min.apply(null, PRODUCTS.map(price)));

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
    priceAt: priceAt,
    weightOptions: weightOptions,
    kgForGuests: kgForGuests,
    weightForGuests: weightForGuests,
    toast: toast,
    leadDays: leadDays,
    leadText: leadText,
    openProduct: function (id, trigger, weight) { open(id, trigger || null, weight); }
  };

  // первое выставление состояния — без переходов, иначе активные кнопки «наплывают» цветом при загрузке
  html.classList.add('is-booting');
  applyCols();
  syncControls();
  render();
  updateStick();
  renderRecent();
  setTimeout(() => html.classList.remove('is-booting'), 60);

  // открыли ссылку ?cake=ID — сразу показываем этот торт
  try {
    const id = new URL(location.href).searchParams.get('cake');
    if (id && PRODUCTS.some(p => p.id === id)) open(id, null);
    else if (id) setCakeParam(null);
  } catch (e) {}
})();
