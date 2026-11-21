/* ============================================================
   ИИ-помощник (локальный, без API) + веер соцсетей.
   Сценарий: сначала разобраться (гости → вкусы → бюджет), потом
   предложить. Не торопит, не выдумывает, не поднимает бюджет.
   Зависит от window.MK — публичного API из js/app.js.
   ============================================================ */
(function () {
  'use strict';

  if (!window.MK) { console.warn('[assistant] js/app.js не загружен'); return; }

  const MK = window.MK;
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = MK.money, kg = MK.kg;

  const LS_KEY = 'mk-chat-v2';     // новый сценарий — новый ключ, старая история не мешает
  const PER = 170;                 // порция, г — как в калькуляторе модалки
  const R = 90, A_FROM = 180, A_TO = 270, STAGGER = 40;

  /* ───────────────────────── иконки (рисуем сами) ───────────────────────── */
  const I = {
    ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="8" y="2.6" width="13.4" height="9.4" rx="3.2" opacity=".55"/>' +
          '<path d="M12.6 12v2.7l3-2.7" opacity=".55"/>' +
          '<rect x="2.6" y="7.8" width="14" height="11.2" rx="3.4"/>' +
          '<path d="M6.8 19v3.1l3.5-3.1"/>' +
          '<circle cx="6.9" cy="13.4" r="1.05" fill="currentColor" stroke="none"/>' +
          '<circle cx="9.9" cy="13.4" r="1.05" fill="currentColor" stroke="none"/>' +
          '<circle cx="12.9" cy="13.4" r="1.05" fill="currentColor" stroke="none"/>' +
        '</svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
             '<circle cx="18" cy="5.2" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.8" r="2.6"/>' +
             '<path d="M8.3 10.8 15.7 6.5M8.3 13.2l7.4 4.3"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
             '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v5h5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 3 10.5 13.5M21 3l-6.6 18-3.9-7.5L3 9.6 21 3Z"/></svg>'
  };

  /* соцсети: нейтральные глифы, НЕ официальные логотипы */
  const SOCIALS = [
    { name: 'MAX', svg: '<path d="M4.5 18.5V5.8l7.5 9 7.5-9v12.7"/>' },
    { name: 'Telegram', svg: '<path d="M21.3 3.4 2.9 10.6l6.4 2.5 2.5 6.4 9.5-16.1Z"/><path d="M21.3 3.4 9.3 13.1"/>' },
    { name: 'VK', svg: '<circle cx="9" cy="8.6" r="3.1"/><path d="M3 19.4c0-3 2.7-4.9 6-4.9s6 1.9 6 4.9"/><path d="M16.2 6.2a3 3 0 0 1 0 5.6M18 19.4c0-2-.8-3.6-2.2-4.6"/>' },
    { name: 'Instagram', svg: '<rect x="2.6" y="6.6" width="18.8" height="13.4" rx="3.2"/><path d="M8.6 6.6 10 4h4l1.4 2.6"/><circle cx="12" cy="13.3" r="3.5"/>' },
    { name: 'TikTok', svg: '<circle cx="7.4" cy="17.6" r="3.2"/><path d="M10.6 17.6V3.6L19 6.3"/>' }
  ];
  const glyph = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  /* ═════════════════════════ СЛОВАРЬ И РАЗБОР ТЕКСТА ═════════════════════════ */

  const norm = t => String(t).toLowerCase().replace(/ё/g, 'е');
  // \b не работает с кириллицей — своя граница слова
  const word = w => new RegExp('(^|[^а-яa-z])(' + w + ')(?![а-яa-z])');

  const pl = (n, f) => MK.plural(n, f);
  const nomN = n => n + ' ' + pl(n, ['человек', 'человека', 'человек']);          // «будет 5 человек»
  const onN  = n => 'на ' + n + ' ' + pl(n, ['человека', 'человека', 'человек']);  // «на 2 человека», «на 15 человек»
  const joinAnd = a => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1];
  const CAKES_WORD = { 1: 'Один торт', 2: 'Два торта', 3: 'Три торта' };

  /* числа словами: «тысяч пять», «до пяти тысяч», «двадцать пять» */
  const WORD_NUM = {
    'один': 1, 'одного': 1, 'одной': 1, 'полтора': 1.5, 'полторы': 1.5,
    'два': 2, 'две': 2, 'двух': 2, 'три': 3, 'трех': 3, 'четыре': 4, 'четырех': 4,
    'пять': 5, 'пяти': 5, 'шесть': 6, 'шести': 6, 'семь': 7, 'семи': 7,
    'восемь': 8, 'восьми': 8, 'девять': 9, 'девяти': 9, 'десять': 10, 'десяти': 10,
    'одиннадцать': 11, 'двенадцать': 12, 'двенадцати': 12, 'пятнадцать': 15, 'пятнадцати': 15,
    'двадцать': 20, 'двадцати': 20, 'тридцать': 30, 'тридцати': 30,
    'сорок': 40, 'сорока': 40, 'пятьдесят': 50, 'пятидесяти': 50
  };
  function wordNum(t) {
    const toks = norm(t).split(/[^а-я0-9]+/).filter(Boolean);    // токены целиком: «стоит» ≠ «сто»
    for (let i = 0; i < toks.length; i++) {
      const v = WORD_NUM[toks[i]];
      if (v == null) continue;
      const next = WORD_NUM[toks[i + 1]];
      if (v >= 20 && v % 10 === 0 && next && next < 10) return v + next;   // «двадцать пять»
      return v;
    }
    return null;
  }

  const clampG = n => Math.max(1, Math.min(300, Math.round(n)));

  /* гости */
  function parseGuests(raw, strict) {
    const t = norm(raw);
    if (/не знаю|пока не|без понятия|сложно сказать|не уверен|затрудня|понятия не/.test(t)) return { unsure: true };
    const people = /человек|чел\.|гост|персон|участник/.test(t);
    if (strict && !people) return null;

    let m = t.match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (m) return { n: clampG((+m[1] + +m[2]) / 2), range: [+m[1], +m[2]] };
    m = t.match(/\d+/);
    if (m) {
      if (/больше|более|свыше|за\s+\d/.test(t)) return { more: +m[0] };
      return { n: clampG(+m[0]) };
    }
    const w = wordNum(t);
    if (w && w >= 1 && w <= 100) return { n: clampG(w) };
    if (strict) return null;
    if (/вдвоем|двое|на двоих/.test(t)) return { n: 2 };
    if (/небольш|семья|семьей|узк|пара друзей|немного|маленьк/.test(t)) return { n: 6, approx: 'небольшой круг' };
    if (/средн/.test(t)) return { n: 12, approx: 'что-то среднее' };
    if (/больш|много|застол|толп/.test(t)) return { n: 25, approx: 'большое застолье' };
    return null;
  }

  /* вкус */
  const FLAVORS = {
    choc:  { label: 'Шоколад',          tags: ['шоколад'],          say: 'шоколадный' },
    fruit: { label: 'Фрукты и ягоды',   tags: ['фрукты', 'ягоды'],  say: 'фруктово-ягодный' },
    cream: { label: 'Сливки, нежное',   tags: ['сливки'],           say: 'сливочный' },
    light: { label: 'Не очень сладкое', tags: ['не сладко'],        say: 'не очень сладкий' },
    any:   { label: 'Без разницы',      tags: null,                 say: '' }
  };
  const FLAVOR_KEYS = ['choc', 'fruit', 'cream', 'light', 'any'];
  const hasTags = f => !!(f && FLAVORS[f] && FLAVORS[f].tags);

  function parseFlavor(raw) {
    const t = norm(raw);
    if (/без разниц|любой|любые|все равно|не важн|неважн|какой угодно/.test(t)) return 'any';
    if (/не (очень )?слад|несладк|не приторн|кисл|легк|поменьше сахар/.test(t)) return 'light';
    if (/шокол|какао|брауни/.test(t)) return 'choc';
    if (/ягод|фрукт|малин|клубник|вишн|смород|манго|маракуй|черник|цитрус|апельсин|банан/.test(t)) return 'fruit';
    if (/сливк|сливоч|крем|нежн|ванил|сыр|чиз|молоч/.test(t)) return 'cream';
    return null;
  }

  /* бюджет: «5000», «5 000», «5к», «тысяч пять», «до пяти тысяч»,
     «не дороже 4000», «в пределах 3-4 тысяч», «6000+» */
  function parseBudget(raw) {
    let t = norm(raw).replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1');
    if (/пропуст|без бюджет|нет бюджет|не скажу/.test(t)) return { skip: true };
    if (/не важн|неважн|любой|без разниц|все равно|не принцип|не огранич/.test(t)) return { any: true };
    const f = s => parseFloat(String(s).replace(',', '.'));
    const K = '(?:к|k|тыс[а-я]*|тыщ[а-я]*)(?![а-яa-z])';

    let m = t.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*[-–—]\\s*(\\d+(?:[.,]\\d+)?)\\s*' + K));
    if (m) return { min: f(m[1]) * 1000, max: f(m[2]) * 1000 };
    m = t.match(/(\d{3,})\s*[-–—]\s*(\d{3,})/);
    if (m) return { min: +m[1], max: +m[2] };

    const nums = [];
    t.replace(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*' + K, 'g'), (_, a) => { nums.push(f(a) * 1000); return ''; });
    if (!nums.length) (t.match(/\d+/g) || []).forEach(x => { if (+x >= 100) nums.push(+x); });
    if (!nums.length && /тыс|тыщ/.test(t)) {
      const w = wordNum(t);
      if (w) {
        const both = t.match(/(\S+)\s*[-–—]\s*(\S+)\s*тыс/);                         // «три-четыре тысячи»
        if (both && WORD_NUM[both[1]] && WORD_NUM[both[2]]) return { min: WORD_NUM[both[1]] * 1000, max: WORD_NUM[both[2]] * 1000 };
        nums.push(w * 1000);
      }
    }
    if (!nums.length) return null;
    const n = Math.max.apply(null, nums);
    const ceiling = word('до').test(t) || /не дороже|не больше|в пределах|максимум|потолок/.test(t);
    if (!ceiling && (word('от').test(t) || /\d\s*\+|больше|выше|не меньше/.test(t))) return { min: n };
    return { max: n };
  }

  function budgetLabel(b) {
    if (!b) return 'без ограничений';
    if (b.min && b.max) return 'в пределах ' + money(b.min).replace(' ₽', '') + '–' + money(b.max);
    if (b.max) return 'до ' + money(b.max);
    if (b.min) return 'от ' + money(b.min);
    return 'без ограничений';
  }

  function detectOccasion(raw) {
    const t = norm(raw);
    if (/свадьб|венчан|жених|невест/.test(t)) return 'wedding';
    if (/детск|ребен|сын|дочк|дочер|малыш|ребят|школ|садик/.test(t)) return 'kids';
    if (/день рожд|днюх|юбиле/.test(t) || word('др').test(t)) return 'birthday';
    return null;
  }

  const INTENT = {
    contacts:    /адрес|телефон|позвон|номер|доставк|самовывоз|где вы|где наход|как добрат|как проехать|контакт|режим работ|часы работ|во сколько|ватсап|whatsapp|телеграм|telegram|почт|e-?mail/,
    composition: /состав|аллерг|глютен|лактоз|орех|арахис|без сахара|сахарозам|калори|ккал|срок годност|хран[ия]т|хранени|веган|постн|халяль|кошер/,
    discount:    /скидк|акци|промокод|бонус|распродаж|дешевле нельзя|уступ/,
    price:       /сколько стоит|сколько стоят|почем|какие цены|цен[аыу]|стоимост|ценник|по деньгам/,
    choose:      /какой торт|подбер|подобр|выбрат|выбери|посовет|помоги|что взять|хочу торт|нужен торт|нужно торт/,
    hello:       /^(привет|здравств|добрый|доброе|хай|hello|hi)/,
    thanks:      /спасибо|благодар/,
    domain:      /торт|десерт|чизкейк|бенто|капкейк|вкус|гост|человек|бюджет|рубл|₽|праздн|день рожд|свадьб|кг|вес/
  };

  /* ═════════════════════════ КАТАЛОГ И РАСЧЁТЫ ═════════════════════════ */

  const ALL = MK.products;
  const P_MIN = Math.min.apply(null, ALL.map(MK.price));
  const P_MAX = Math.max.apply(null, ALL.map(MK.price));

  /* средняя (медианная) цена за кг у обычных тортов — для честного сравнения «один vs два» */
  const MED_KG = (function () {
    const v = ALL.filter(p => ['birthday', 'mousse', 'cheesecake'].indexOf(p.cat) > -1).map(p => p.perKg).sort((a, b) => a - b);
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  })();
  const GENERIC = { minWeight: 1.2 };
  const needW = g => MK.weightForGuests(GENERIC, g, PER);         // вес под гостей «вообще»
  const rawW  = g => MK.weightForGuests({ minWeight: 0 }, g, PER); // без учёта минимального веса

  function compare(n, k) {
    const one = needW(n);
    const g = Math.ceil(n / k);
    const each = needW(g);
    return { one: one, each: each, k: k, g: g, sumOne: one * MED_KG, sumEach: each * MED_KG, sumMany: each * MED_KG * k };
  }

  const OCC_CATS = { kids: ['kids'], wedding: ['wedding'], birthday: ['birthday'] };

  function pool(perCake, occasion, tiered) {
    return ALL.filter(p => {
      if (tiered) return p.tiers >= 2;
      if (p.cat === 'cupcakes') return false;             // продаются наборами, не на вес
      if (p.cat === 'bento') return perCake <= 4;          // бенто — на 1–4 человек
      if (p.cat === 'kids') return occasion === 'kids';
      if (p.cat === 'wedding') return occasion === 'wedding';
      return true;
    });
  }
  const matches = (p, f) => hasTags(f) && FLAVORS[f].tags.some(t => p.flavors.indexOf(t) > -1);
  function fit(p, f, occasion) {
    let s = 0;
    if (matches(p, f)) s += 3;
    if (occasion && OCC_CATS[occasion] && OCC_CATS[occasion].indexOf(p.cat) > -1) s += 2;
    if (p.hit) s += 0.5;
    return s;
  }
  function option(p, g) {
    const w = MK.weightForGuests(p, g, PER);
    return { p: p, g: g, w: w, sum: w * p.perKg };
  }

  /* один торт: сначала подходящие по вкусу, внутри — от дешёвых к дорогим (не подтягиваем цену) */
  function pickSingle(a, tiered) {
    const n = a.guests, f = a.flavors[0];
    return pool(n, a.occasion, tiered)
      .map(p => Object.assign(option(p, n), { s: fit(p, f, a.occasion) }))
      .sort((x, y) => y.s - x.s || x.sum - y.sum);
  }
  function topByFlavor(list, f, k) {
    const m = list.filter(o => matches(o.p, f));
    return (hasTags(f) && m.length >= 2 ? m : list).slice(0, k);
  }

  /* несколько тортов: перебор наборов, бюджет — на общую сумму */
  function combos(a, k) {
    const g = Math.ceil(a.guests / k);
    const opts = pool(g, a.occasion, false).map(p => option(p, g));
    const slots = [a.flavors[0] || 'any', a.flavors[1] || 'any', 'any'].slice(0, k);
    const res = [];
    (function rec(i, chosen) {
      if (i === k) {
        let s = 0;
        chosen.forEach((o, j) => { s += fit(o.p, slots[j], a.occasion); });
        res.push({ set: chosen.slice(), s: s, sum: chosen.reduce((t, o) => t + o.sum, 0), slots: slots });
        return;
      }
      opts.forEach(o => {
        if (chosen.some(c => c.p.id === o.p.id)) return;
        chosen.push(o); rec(i + 1, chosen); chosen.pop();
      });
    })(0, []);
    return res.sort((x, y) => y.s - x.s || x.sum - y.sum);
  }

  /* одна строка «почему именно этот» */
  function flavorAdj(p, f) {
    if (f === 'fruit') {
      const b = p.flavors.indexOf('ягоды') > -1, fr = p.flavors.indexOf('фрукты') > -1;
      return b && fr ? 'фруктово-ягодный' : b ? 'ягодный' : 'фруктовый';
    }
    return { choc: 'шоколадный', cream: 'сливочный, нежный', light: 'не приторный' }[f] || '';
  }
  function sizeNote(o) { return (o.w > rawW(o.g) ? 'с запасом ' : 'как раз ') + onN(o.g); }

  function whySingle(o, f, budget) {
    if (hasTags(f) && !matches(o.p, f)) return 'Вкус другой, но по весу ' + sizeNote(o) + ' — оставил для сравнения.';
    const parts = [];
    if (hasTags(f)) parts.push(flavorAdj(o.p, f));
    else if (o.p.hit) parts.push('отмечен в каталоге как хит');
    parts.push(sizeNote(o));
    if (budget && budget.max) parts.push('в рамках бюджета');
    return 'Взял, потому что ' + joinAnd(parts) + '.';
  }
  function whySlot(o, f, i) {
    const who = ['Первый', 'Второй', 'Третий'][i] || 'Ещё один';
    if (hasTags(f)) {
      return matches(o.p, f)
        ? who + ' — ' + flavorAdj(o.p, f) + ', ' + onN(o.g) + '.'
        : who + ' — точного совпадения по вкусу не нашлось, взял близкий, ' + onN(o.g) + '.';
    }
    return who + ' — ' + (o.p.hit ? 'хит каталога' : 'другой вкус для разнообразия') + ', ' + onN(o.g) + '.';
  }

  /* ═════════════════════════ РАЗМЕТКА ═════════════════════════ */

  const fabs = document.createElement('div');
  fabs.className = 'fabs';
  fabs.innerHTML =
    '<div class="fan" id="mkFan">' +
      '<button class="fab fab--soc" id="mkSocBtn" type="button" aria-label="Поделиться" aria-expanded="false">' + I.share + '</button>' +
      SOCIALS.map(s =>
        '<a class="fan__item" href="#" tabindex="-1" aria-label="Поделиться: ' + s.name + '">' +
          glyph(s.svg) + '<span class="fan__tip">' + s.name + '</span>' +
        '</a>').join('') +
    '</div>' +
    '<div class="fabwrap">' +
      '<button class="fab fab--ai" id="mkAiBtn" type="button" aria-label="ИИ-помощник" aria-expanded="false" aria-controls="mkChat">' + I.ai + '</button>' +
      '<span class="fab__tip">ИИ-помощник</span>' +
      '<span class="fab__cap">ИИ-помощник</span>' +
    '</div>';

  const chat = document.createElement('section');
  chat.className = 'chat';
  chat.id = 'mkChat';
  chat.hidden = true;
  chat.setAttribute('role', 'dialog');
  chat.setAttribute('aria-label', 'ИИ-помощник');
  chat.innerHTML =
    '<header class="chat__hdr">' +
      '<span class="chat__dot" aria-hidden="true">' + I.ai + '</span>' +
      '<span class="chat__ttl">ИИ-помощник<small>помогу выбрать торт</small></span>' +
      '<button class="chat__ico" id="mkReset" type="button" aria-label="Начать заново" title="Начать заново">' + I.reset + '</button>' +
      '<button class="chat__ico" id="mkClose" type="button" aria-label="Закрыть чат">' + I.close + '</button>' +
    '</header>' +
    '<div class="chat__log" id="mkLog" aria-live="polite"></div>' +
    '<form class="chat__form" id="mkForm">' +
      '<input class="chat__in" id="mkInput" type="text" autocomplete="off" placeholder="Напишите сообщение…" aria-label="Сообщение">' +
      '<button class="chat__send" type="submit" aria-label="Отправить">' + I.send + '</button>' +
    '</form>';

  document.body.append(fabs, chat);
  const log = $('#mkLog'), input = $('#mkInput'), aiBtn = $('#mkAiBtn');

  /* ───────────────────────── потоковая печать ───────────────────────── */
  function streamText(element, text) {
    return new Promise(resolve => {
      if (reduced()) { element.textContent = text; toBottom(); resolve(); return; }
      const words = String(text).split(' ');
      element.textContent = '';
      element.classList.add('is-streaming');
      let i = 0;
      (function tick() {
        if (i >= words.length) { element.classList.remove('is-streaming'); resolve(); return; }
        element.textContent += words[i] + (i < words.length - 1 ? ' ' : '');
        i++;
        toBottom();
        setTimeout(tick, 25 + Math.random() * 20);          // 25–45 мс на слово
      })();
    });
  }
  function toBottom() { log.scrollTop = log.scrollHeight; }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ───────────────────────── состояние ───────────────────────── */
  const fresh = () => ({
    stage: 'start',
    answers: { guests: null, occasion: null, flavors: [], plan: null, budget: null, askedPrice: false },
    pending: null,
    entries: []
  });
  let state = fresh();
  let busy = false;

  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} };
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!d || !Array.isArray(d.entries) || !d.entries.length) return false;
      state = d;
      return true;
    } catch (e) { return false; }
  }

  /* ───────────────────────── отрисовка ───────────────────────── */
  function bubble(role, text, stream) {
    const el = document.createElement('div');
    el.className = 'msg msg--' + role;
    log.append(el);
    toBottom();
    if (stream && role === 'bot') return streamText(el, text);
    el.textContent = text;
    toBottom();
    return Promise.resolve();
  }
  function chipsRow(items, done) {
    const row = document.createElement('div');
    row.className = 'chips' + (done ? ' is-done' : '');
    row.innerHTML = items.map(c => '<button class="chip-btn" type="button" data-val="' + c[1] + '">' + c[0] + '</button>').join('');
    log.append(row); toBottom();
  }
  function recsRow(e) {
    const box = document.createElement('div');
    box.className = 'recs';
    box.innerHTML = (e.title ? '<div class="recs__ttl">' + e.title + '</div>' : '') + e.items.map(it => {
      const p = ALL.find(x => x.id === it.id);
      if (!p) return '';
      const w = MK.weightForGuests(p, it.g, PER);
      return '<button class="rec" type="button" data-id="' + p.id + '">' +
               '<span class="rec__ph">' + MK.placeholder(p) + '</span>' +
               '<span><span class="rec__n">' + p.name + '</span>' +
               '<span class="rec__m">' + MK.catName(p.cat) + ' · ' + kg(w) + '</span>' +
               '<span class="rec__p">≈ ' + money(w * p.perKg) + '</span>' +
               '<span class="rec__why">' + it.why + '</span></span>' +
             '</button>';
    }).join('');
    log.append(box); toBottom();
  }
  function renderEntry(e) {
    if (e.r === 'bot' || e.r === 'me') bubble(e.r, e.t, false);
    else if (e.r === 'chips') chipsRow(e.items, e.done);
    else if (e.r === 'recs') recsRow(e);
  }

  const push = e => { state.entries.push(e); save(); };

  async function say(text) {
    busy = true;
    const t = document.createElement('div');
    t.className = 'typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    log.append(t); toBottom();
    await wait(reduced() ? 40 : 380);
    t.remove();
    push({ r: 'bot', t: text });
    await bubble('bot', text, true);
    busy = false;
  }
  function me(text) { closeChips(); push({ r: 'me', t: text }); bubble('me', text, false); }
  function chips(items) { push({ r: 'chips', items: items, done: false }); chipsRow(items, false); }
  function recs(items, title) { const e = { r: 'recs', items: items, title: title || '' }; push(e); recsRow(e); }

  function closeChips() {
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (state.entries[i].r === 'chips') { state.entries[i].done = true; break; }
    }
    $$('.chips:not(.is-done)', log).forEach(r => r.classList.add('is-done'));
    save();
  }

  /* ═════════════════════════ КНОПКИ ПО СТАДИЯМ ═════════════════════════ */

  function chipsFor(stage) {
    const a = state.answers;
    switch (stage) {
      case 'start':  return [['Подобрать торт', 'choose'], ['Сколько стоит торт?', 'price'], ['Просто смотрю', 'browse']];
      case 'browse': return [['Подобрать торт', 'choose'], ['Сколько стоит торт?', 'price']];
      case 'guests': return [['до 5', '5'], ['5-10', '8'], ['10-20', '15'], ['больше 20', 'more'], ['Пока не знаю', 'unsure']];
      case 'guests_more':   return [['20–30', '25'], ['30–50', '40'], ['больше 50', '60']];
      case 'guests_unsure': return [['Небольшой круг', '6'], ['Что-то среднее', '12'], ['Большое застолье', '25'], ['Тоже не знаю', '10']];
      case 'plan2':  return [['Давайте два', 'two'], ['Лучше один', 'one'], ['А насколько дороже?', 'diff']];
      case 'plan2b': return [['Давайте два', 'two'], ['Лучше один', 'one']];
      case 'plan3':  return [['Важнее вкусы', 'three'], ['Важнее вид на фото', 'tiered'], ['Покажи оба варианта', 'both']];
      case 'flavor': case 'flavor1':
        return FLAVOR_KEYS.map(k => [FLAVORS[k].label, k]);
      case 'flavor2':
        return FLAVOR_KEYS.filter(k => k !== a.flavors[0]).map(k => [FLAVORS[k].label, k]);
      case 'budget': return [['до 3 000', 'lt3'], ['3 000-6 000', '3-6'], ['6 000+', 'gt6'], ['Не важно', 'any'], ['Пропустить', 'skip']];
      case 'over':   return [['Покажи', 'show'], ['Не надо', 'no']];
      case 'fewer':  return [['Покажи этот вариант', 'fewer'], ['Покажи исходный всё равно', 'many'], ['Не надо', 'no']];
      case 'upgrade':return [['Покажи', 'show'], ['Не надо, этого хватит', 'no']];
      case 'done':   return [['Начать заново', 'reset']];
      default:       return [];
    }
  }
  function go(stage) { state.stage = stage; save(); const c = chipsFor(stage); if (c.length) chips(c); }

  /* повторить текущий вопрос кнопками (после побочного ответа) */
  function rechips() { const c = chipsFor(state.stage); if (c.length) chips(c); }

  /* ═════════════════════════ СЦЕНАРИЙ ═════════════════════════ */

  async function greet() {
    await say('Здравствуйте! Я помогу выбрать торт из каталога. Подобрать вариант — или сначала подсказать по ценам?');
    go('start');
  }

  async function askGuests(lead) {
    await say((lead ? lead + ' ' : '') + 'Для начала — примерно сколько человек будет?');
    go('guests');
  }

  /* 5.6 — про цену спросили сразу: отвечаем, а не уходим от ответа */
  async function answerPrice() {
    const a = state.answers;
    if (!a.guests) {
      a.askedPrice = true;
      await say('Торты у нас от ' + money(P_MIN) + ' до ' + money(P_MAX) + ' — зависит от веса и сложности. Подскажете, на сколько человек? Тогда назову точнее.');
      go('guests');
      return;
    }
    const list = pickSingle(a, false);
    const sums = list.map(o => o.sum);
    await say('В каталоге торты от ' + money(P_MIN) + ' до ' + money(P_MAX) + '. ' + onN(a.guests)[0].toUpperCase() + onN(a.guests).slice(1) +
              ' подходящие выходят примерно от ' + money(Math.min.apply(null, sums)) + ' до ' + money(Math.max.apply(null, sums)) + '.');
    rechips();
  }

  async function setGuests(n, note) {
    state.answers.guests = n;
    save();
    if (note) await say(note);
    await afterGuests();
  }

  /* 5.3 — пороги */
  async function afterGuests() {
    const a = state.answers, n = a.guests;

    if (a.askedPrice) {
      a.askedPrice = false;
      const sums = pickSingle(a, false).map(o => o.sum);
      await say('Тогда точнее: ' + onN(n) + ' торты выходят примерно от ' + money(Math.min.apply(null, sums)) + ' до ' + money(Math.max.apply(null, sums)) + '.');
    }

    if (n <= 7) {
      a.plan = 'one';
      await say('Одного торта хватит с запасом.');
      return askFlavor();
    }
    if (n <= 15) {
      a.plan = 'one';
      await say('Хватит одного торта — примерно на ' + kg(needW(n)) + '.');
      return askFlavor();
    }
    if (n <= 30) {
      const c = compare(n, 2);
      const extra = Math.round(c.sumMany - c.sumOne);
      await say('Гостей прилично. Один торт на такую компанию — это около ' + kg(c.one) + ': резать неудобно, да и один вкус нравится не всем. ' +
                'Обычно в таком случае берут два торта поменьше и разных — например, шоколадный и фруктовый, — чтобы каждый нашёл своё. ' +
                (extra > 0
                  ? 'Сразу скажу честно: два торта выйдут немного дороже одного большого. '
                  : 'По деньгам, если считать по весу, выйдет примерно одинаково. ') +
                'Посмотрим вариант с двумя или всё-таки один?');
      return go('plan2');
    }
    await say('Компания большая — тут два пути. Несколько тортов, обычно три: разные вкусы, и резать проще. ' +
              'Или один многоярусный: эффектнее смотрится на фото, но вкус будет один. Что для вас важнее?');
    go('plan3');
  }

  async function explainDiff() {
    const n = state.answers.guests, c = compare(n, 2);
    const half = money(c.each * MED_KG);
    const diff = Math.round(c.sumMany - c.sumOne);
    await say('Считаю по средней цене за килограмм в каталоге — ' + money(MED_KG) + '. ' +
              'Один торт ' + onN(n) + ': ' + kg(c.one) + ' — около ' + money(c.sumOne) + '. ' +
              'Два торта по ' + kg(c.each) + ': ' + half + ' + ' + half + ' = ' + money(c.sumMany) + '. ' +
              (diff > 0 ? 'Разница — около ' + money(diff) + '.' : 'Разницы по весу нет.') +
              ' Точная сумма зависит от того, какие торты выберем. Решать вам.');
    go('plan2b');
  }

  async function askFlavor() {
    const a = state.answers;
    const multi = a.plan === 'two' || a.plan === 'three' || a.plan === 'both';
    if (!multi) {
      if (a.flavors[0]) return askBudget();                       // вкус назвали заранее
      await say('Какие вкусы больше любите?');
      return go('flavor');
    }
    if (!a.flavors[0]) {
      await say('Возьмём разные вкусы, чтобы был выбор. Какой будет первый?');
      return go('flavor1');
    }
    await say('Возьмём разные, чтобы был выбор. Первый — ' + FLAVORS[a.flavors[0]].say + '. А второй — что-то другое?');
    go('flavor2');
  }

  async function setFlavor(key) {
    const a = state.answers, st = state.stage;
    if (st === 'flavor') { a.flavors = [key]; save(); return askBudget(); }
    if (st === 'flavor1') {
      a.flavors = [key];
      if (key === 'any') { a.flavors = ['any', 'any']; save(); await say('Хорошо, тогда подберу разные сам.'); return askBudget(); }
      save();
      await say('А второй — что-то другое?');
      return go('flavor2');
    }
    if (st === 'flavor2') {
      a.flavors[1] = key;
      save();
      if (a.plan === 'three' || a.plan === 'both') await say('Третий возьму из хитов каталога — другим тортом, не повторяя первые два.');
      return askBudget();
    }
  }

  async function askBudget() {
    const multi = ['two', 'three', 'both'].indexOf(state.answers.plan) > -1;
    if (state.answers.budget) return present();                    // бюджет уже назвали
    await say(multi ? 'Есть примерный бюджет — на все торты вместе? Если нет — просто пропустите.'
                    : 'Есть примерный бюджет? Если нет — просто пропустите.');
    go('budget');
  }

  async function setBudget(b, confirm) {
    state.answers.budget = (b && (b.max || b.min)) ? { min: b.min || null, max: b.max || null } : null;
    save();
    if (confirm && state.answers.budget) await say('Понял, ориентируемся ' + budgetLabel(state.answers.budget) + '.');
    await present();
  }

  /* ───────────────────────── подбор ───────────────────────── */
  async function present() {
    const plan = state.answers.plan;
    let r;
    if (plan === 'one')         r = await presentSingle(false);
    else if (plan === 'tiered') r = await presentSingle(true);
    else if (plan === 'two')    r = await presentCombo(2);
    else if (plan === 'three')  r = await presentCombo(3);
    else if (plan === 'both') {
      await say('Покажу оба варианта — сравните сами.');
      r = await presentSingle(true, 'Вариант 1 — многоярусный');
      if (r !== 'pending') r = await presentCombo(3, 'Вариант 2 — три торта');
    }
    if (r !== 'pending') await finish();
  }

  async function presentSingle(tiered, title) {
    const a = state.answers, n = a.guests, f = a.flavors[0], b = a.budget, max = b && b.max;
    const list = pickSingle(a, tiered);
    const within = max ? list.filter(o => o.sum <= max) : list;

    // 5.10 — бюджет мал: говорим прямо, без уговоров и без «урежем вес»
    if (!within.length) {
      const cheap = list.slice().sort((x, y) => x.sum - y.sum)[0];
      state.pending = { kind: 'show', items: [{ id: cheap.p.id, g: n, why: 'Самый доступный ' + (tiered ? 'многоярусный ' : '') + 'вариант ' + onN(n) + '.' }] };
      await say('Самый доступный ' + (tiered ? 'многоярусный ' : '') + 'торт ' + onN(n) + ' у нас — ' + money(cheap.sum) + '. Это ' +
                (cheap.sum <= max * 1.25 ? 'чуть ' : '') + 'выше вашего бюджета. Если готовы рассмотреть — покажу, если нет, ничего страшного.');
      go('over');
      return 'pending';
    }

    const top = tiered ? within.slice(0, 2) : topByFlavor(within, f, 3);
    const lead = title ? '' : (hasTags(f)
      ? 'Вот что подойдёт ' + onN(n) + ' — вкус ' + FLAVORS[f].say + ':'
      : 'Вот что подойдёт ' + onN(n) + ':');
    if (lead) await say(lead);
    recs(top.map(o => ({ id: o.p.id, g: n, why: whySingle(o, f, b) })), title);

    // 5.9 — бюджет с запасом: не подтягиваем к потолку, только предлагаем
    if (max && !title) {
      const shownMax = Math.max.apply(null, top.map(o => o.sum));
      if (shownMax <= max * 0.7) {
        const ids = top.map(o => o.p.id);
        const up = within.filter(o => ids.indexOf(o.p.id) < 0 && o.sum > shownMax && (!hasTags(f) || matches(o.p, f)))
                         .sort((x, y) => y.sum - x.sum)[0];
        if (up) {
          state.pending = { kind: 'show', items: [{ id: up.p.id, g: n, why: 'Подороже, но тоже ' + sizeNote(up) + ' и в рамках бюджета.' }] };
          await say('Под ваши условия это подходит — от ' + money(Math.min.apply(null, top.map(o => o.sum))) +
                    ', заметно ниже вашего потолка. Если хочется чего-то поинтереснее, есть вариант за ' + money(up.sum) + ' — показать?');
          go('upgrade');
          return 'pending';
        }
        await say('Все варианты заметно ниже вашего потолка в ' + money(max) + '.');
      }
    }
    return 'ok';
  }

  async function showSet(c, k, title) {
    const g = c.set[0].g;
    if (!title) await say((k === 2 ? 'Предлагаю два разных торта, каждый ' : 'Предлагаю три торта, каждый ') + onN(g) + ':');
    recs(c.set.map((o, i) => ({ id: o.p.id, g: g, why: whySlot(o, c.slots[i], i) })), title);
    const parts = c.set.map(o => money(o.sum));
    let line = CAKES_WORD[k] + ': ' + parts.join(' + ') + ' = ' + money(c.sum) + '.';   // 5.7 — итог явно
    const max = state.answers.budget && state.answers.budget.max;
    if (max && c.sum <= max * 0.7) line += ' Это заметно ниже вашего потолка.';
    await say(line);
  }

  async function presentCombo(k, title) {
    const a = state.answers, max = a.budget && a.budget.max;
    const all = combos(a, k);
    const within = max ? all.filter(c => c.sum <= max) : all;
    if (within.length) { await showSet(within[0], k, title); return 'ok'; }

    // 5.7 — не влезло: ищем комбинацию поменьше, которая влезает, а не молчим о превышении
    const cheapSet = all.slice().sort((x, y) => x.sum - y.sum)[0];
    for (let j = k - 1; j >= 1; j--) {
      if (j === 1) {
        const one = pickSingle(a, false).filter(o => o.sum <= max);
        if (one.length) {
          const o = topByFlavor(one, a.flavors[0], 1)[0];
          state.pending = {
            kind: 'fewer',
            fewer: { items: [{ id: o.p.id, g: a.guests, why: whySingle(o, a.flavors[0], a.budget) }], line: 'Один торт: ' + money(o.sum) + '.' },
            many: { k: k }
          };
          await say(CAKES_WORD[k] + ' в ' + budgetLabel(a.budget) + ' не помещаются — самый доступный набор выходит ' + money(cheapSet.sum) +
                    '. Зато помещается один торт на всех — ' + money(o.sum) + '. Показать его?');
          go('fewer');
          return 'pending';
        }
      } else {
        const smaller = combos(a, j).filter(c => c.sum <= max)[0];
        if (smaller) {
          state.pending = { kind: 'fewer', fewerK: j, many: { k: k } };
          await say(CAKES_WORD[k] + ' в ' + budgetLabel(a.budget) + ' не помещаются — самый доступный набор выходит ' + money(cheapSet.sum) +
                    '. А ' + CAKES_WORD[j].toLowerCase() + ' помещаются — ' + money(smaller.sum) + '. Показать?');
          go('fewer');
          return 'pending';
        }
      }
    }
    // 5.10 — не влезает даже один торт
    const cheapOne = pickSingle(a, false).slice().sort((x, y) => x.sum - y.sum)[0];
    state.pending = { kind: 'show', items: [{ id: cheapOne.p.id, g: a.guests, why: 'Самый доступный вариант ' + onN(a.guests) + '.' }] };
    await say('Самый доступный вариант ' + onN(a.guests) + ' — один торт за ' + money(cheapOne.sum) + '. Это ' +
              (cheapOne.sum <= max * 1.25 ? 'чуть ' : '') + 'выше вашего бюджета. Если готовы рассмотреть — покажу, если нет, ничего страшного.');
    go('over');
    return 'pending';
  }

  async function finish() {
    state.pending = null;
    await say('Нажмите на карточку — откроется описание и калькулятор веса. Захотите что-то поменять — начните заново.');
    go('done');
  }

  /* ответы на «отложенные» вопросы */
  async function resolvePending(v) {
    const pnd = state.pending, a = state.answers;
    state.pending = null; save();
    if (!pnd) return finish();
    if (v === 'no') {
      await say(state.stage === 'upgrade' ? 'Хорошо, остаёмся на этом.' : 'Хорошо. Если захотите посмотреть другие варианты — я здесь.');
      await wait(100);
      return go('done');
    }
    if (pnd.kind === 'show') { recs(pnd.items); return finish(); }
    if (pnd.kind === 'fewer') {
      if (v === 'fewer') {
        if (pnd.fewer) { recs(pnd.fewer.items); await say(pnd.fewer.line); }
        else await showSet(combos(a, pnd.fewerK).filter(c => c.sum <= a.budget.max)[0], pnd.fewerK);
        return finish();
      }
      if (v === 'many') {
        const cheap = combos(a, pnd.many.k).sort((x, y) => x.sum - y.sum)[0];
        await showSet(cheap, pnd.many.k);
        return finish();
      }
    }
    return finish();
  }

  /* ═════════════════════════ ВВОД ═════════════════════════ */

  async function onChip(v, label) {
    if (busy) return;
    me(label);
    const st = state.stage, a = state.answers;

    if (v === 'reset') return restart();
    if (st === 'start' || st === 'browse') {
      if (v === 'choose') return askGuests('Давайте подберу.');
      if (v === 'price')  return answerPrice();
      if (v === 'browse') { await say('Хорошо, не буду мешать. Если понадобится помощь с выбором — я здесь.'); return go('browse'); }
    }
    if (st === 'guests') {
      if (v === 'unsure') {
        await say('Ничего страшного, давайте прикинем. Это скорее небольшой круг — семья, пара друзей? Или большое застолье?');
        return go('guests_unsure');
      }
      if (v === 'more') { await say('А примерно сколько?'); return go('guests_more'); }
      const n = +v;
      return setGuests(n, n === 8 ? 'Хорошо, считаю примерно на 8 человек.' : n === 15 ? 'Хорошо, считаю примерно на 15 человек.' : '');
    }
    if (st === 'guests_more') return setGuests(+v, 'Хорошо, считаю примерно ' + onN(+v) + '.');
    if (st === 'guests_unsure') {
      if (v === '10') return setGuests(10, 'Хорошо, буду считать примерно на 10 человек — потом уточним.');
      return setGuests(+v, 'Хорошо, считаю примерно ' + onN(+v) + '.');
    }
    if (st === 'plan2' || st === 'plan2b') {
      if (v === 'diff') return explainDiff();
      a.plan = v === 'two' ? 'two' : 'one';
      if (a.plan === 'one') await say('Хорошо, один торт — примерно на ' + kg(needW(a.guests)) + '.');
      return askFlavor();
    }
    if (st === 'plan3') { a.plan = v; save(); return askFlavor(); }
    if (st === 'flavor' || st === 'flavor1' || st === 'flavor2') return setFlavor(v);
    if (st === 'budget') {
      const map = { lt3: { max: 3000 }, '3-6': { min: 3000, max: 6000 }, gt6: { min: 6000 } };
      return setBudget(map[v] || null, false);
    }
    if (st === 'over' || st === 'fewer' || st === 'upgrade') return resolvePending(v);
  }

  async function onText(raw) {
    const text = raw.trim();
    if (!text) return;
    me(text);
    const t = norm(text);
    const st = state.stage, a = state.answers;

    if (/^(заново|сначала|начать заново|сброс)/.test(t)) return restart();

    const occ = detectOccasion(t);
    if (occ) { a.occasion = occ; save(); }

    // 5.12 — честные ответы на «не про выбор»
    if (INTENT.contacts.test(t)) { await say('Это демо-сайт, реальные контакты владелец заполнит сам.'); return rechips(); }
    if (INTENT.composition.test(t)) { await say('Состав и аллергены заполняет владелец — я их не знаю и гадать не буду.'); return rechips(); }
    if (INTENT.discount.test(t)) { await say('Про скидки и акции ничего сказать не могу — это решает владелец. Я помогаю с выбором торта.'); return rechips(); }

    // ответ на текущий вопрос
    if (st === 'guests' || st === 'guests_more' || st === 'guests_unsure') {
      const g = parseGuests(t, false);
      if (g && g.unsure) {
        if (st === 'guests_unsure') return setGuests(10, 'Хорошо, буду считать примерно на 10 человек — потом уточним.');
        await say('Ничего страшного, давайте прикинем. Это скорее небольшой круг — семья, пара друзей? Или большое застолье?');
        return go('guests_unsure');
      }
      if (g && g.more) { await say('А примерно сколько?'); return go('guests_more'); }
      if (g && g.n) {
        const note = g.range ? 'Хорошо, считаю примерно ' + onN(g.n) + '.' : g.approx ? 'Хорошо, считаю примерно ' + onN(g.n) + '.' : '';
        return setGuests(g.n, note);
      }
    }
    if (st === 'flavor' || st === 'flavor1' || st === 'flavor2') {
      const f = parseFlavor(t);
      if (f && !(st === 'flavor2' && f === a.flavors[0] && f !== 'any')) return setFlavor(f);
      if (f) { await say('Этот вкус уже есть — давайте второй возьмём другой, чтобы был выбор.'); return rechips(); }
    }
    if (st === 'budget') {
      const b = parseBudget(t);
      if (b) return setBudget(b.skip || b.any ? null : b, !(b.skip || b.any));
      // 5.8 — не распознали: не гадаем
      await say('Не совсем понял сумму. Можно кнопкой или числом — например, «до 5000».');
      return rechips();
    }
    if (st === 'plan2' || st === 'plan2b') {
      if (/дорож|разниц|насколько/.test(t)) return explainDiff();
      if (/два|двумя|оба|давайте|да(?![а-я])/.test(t)) return onChipSilent('two');
      if (/один|одним|одного|большой/.test(t)) return onChipSilent('one');
    }
    if (st === 'plan3') {
      if (/вкус|разн|несколько|три/.test(t)) return onChipSilent('three');
      if (/фото|вид|эффект|ярус|красив/.test(t)) return onChipSilent('tiered');
      if (/оба|обоих|оба варианта|не знаю/.test(t)) return onChipSilent('both');
    }
    if (st === 'over' || st === 'upgrade' || st === 'fewer') {
      if (/^(да|покажи|давай|ок|хорошо)/.test(t)) return resolvePending(st === 'fewer' ? 'fewer' : 'show');
      if (/^(нет|не надо|не нужно|хватит)/.test(t)) return resolvePending('no');
    }

    // старт: можно сразу написать «шоколадный торт на 12 человек, до 5000»
    // и в конце диалога: «а если нас 21?» — считаем заново, а не «не понял»
    if (['start', 'browse', 'done', 'over', 'fewer', 'upgrade'].indexOf(st) > -1) {
      const g = parseGuests(t, true);
      const f = parseFlavor(t);
      const moneyHint = /₽|руб|бюджет|тыс|\dк|\d\s*k|не дороже|в пределах/.test(t) || /(^|[^а-я])до\s*\d{3,}/.test(t);
      const b = moneyHint ? parseBudget(t) : null;
      if (g && g.n) {
        if (st !== 'start' && st !== 'browse') { state.answers = fresh().answers; state.answers.occasion = occ || a.occasion; state.pending = null; }
        if (INTENT.price.test(t)) state.answers.askedPrice = true;   // «сколько стоит торт на 10 человек»
        if (f && f !== 'any') state.answers.flavors = [f];
        if (b && (b.max || b.min)) state.answers.budget = { min: b.min || null, max: b.max || null };
        save();
        return setGuests(g.n, '');
      }
      if (f && f !== 'any' && (st === 'start' || st === 'browse')) { a.flavors = [f]; save(); return askGuests('Понял, ' + FLAVORS[f].say + '. Давайте подберу.'); }
    }

    if (INTENT.price.test(t)) return answerPrice();
    if (INTENT.choose.test(t)) {
      if (st === 'start' || st === 'browse') return askGuests('Давайте подберу.');
      if (st === 'done') return restart();
    }
    if (INTENT.thanks.test(t)) { await say('Пожалуйста! Если что-то ещё — пишите.'); return rechips(); }
    if (INTENT.hello.test(t)) { await say('Здравствуйте! Помочь выбрать торт?'); return rechips(); }

    // не поняли — мягко переспрашиваем; вне темы — честно говорим, чем помогаю
    if (!INTENT.domain.test(t) && ['start', 'browse', 'done'].indexOf(st) > -1) {
      await say('Я помогаю только с выбором торта — с остальным, к сожалению, не подскажу.');
      return rechips();
    }
    const hint = {
      guests: 'Не совсем понял, сколько будет гостей. Можно числом — например, «12» — или кнопкой:',
      guests_more: 'Не совсем понял. Сколько примерно гостей?',
      guests_unsure: 'Не совсем понял. Какой примерно круг?',
      flavor: 'Не совсем понял, какой вкус. Выберите вариант:',
      flavor1: 'Не совсем понял, какой вкус. Выберите вариант:',
      flavor2: 'Не совсем понял, какой второй вкус. Выберите вариант:',
      plan2: 'Не совсем понял — два торта или один?',
      plan2b: 'Не совсем понял — два торта или один?',
      plan3: 'Не совсем понял — что важнее?'
    }[st] || (INTENT.domain.test(t) ? 'Не совсем понял. Выберите вариант ниже:' : 'Я помогаю только с выбором торта — с остальным, к сожалению, не подскажу.');
    await say(hint);
    rechips();
  }
  /* выбор, распознанный из текста: как нажатие кнопки, но без повторного «эха» */
  async function onChipSilent(v) {
    const st = state.stage, a = state.answers;
    if (st === 'plan2' || st === 'plan2b') {
      a.plan = v === 'two' ? 'two' : 'one';
      if (a.plan === 'one') await say('Хорошо, один торт — примерно на ' + kg(needW(a.guests)) + '.');
      return askFlavor();
    }
    if (st === 'plan3') { a.plan = v; save(); return askFlavor(); }
  }

  /* ───────────────────────── события чата ───────────────────────── */
  log.addEventListener('click', e => {
    const chip = e.target.closest('.chip-btn');
    if (chip && !chip.closest('.is-done')) { onChip(chip.dataset.val, chip.textContent); return; }
    const rec = e.target.closest('.rec');
    if (rec) {
      MK.openProduct(rec.dataset.id, rec);
      if (window.innerWidth <= 620) closeChat(false);
    }
  });

  $('#mkForm').addEventListener('submit', e => {
    e.preventDefault();
    if (busy) return;                     // пока бот печатает — текст не теряем
    const v = input.value;
    input.value = '';
    onText(v);
  });

  function restart() {
    state = fresh();
    log.innerHTML = '';
    try { localStorage.removeItem(LS_KEY); } catch (err) {}
    greet();
  }
  $('#mkReset').addEventListener('click', () => { if (!busy) restart(); });
  $('#mkClose').addEventListener('click', () => closeChat());

  /* ───────────────────────── открытие / закрытие ───────────────────────── */
  let started = false, closeT = 0;

  function openChat() {
    clearTimeout(closeT);
    chat.classList.remove('is-closing');
    chat.hidden = false;
    document.body.classList.add('mk-chat-open');
    aiBtn.setAttribute('aria-expanded', 'true');
    setFan(false);
    if (!started) {
      started = true;
      if (load()) {
        state.entries.forEach(renderEntry);
        // активной остаётся только последняя строка кнопок, если она последняя в ленте
        const last = state.entries[state.entries.length - 1];
        $$('.chips', log).forEach((row, i, rows) => {
          if (!(last && last.r === 'chips' && i === rows.length - 1)) row.classList.add('is-done');
        });
        toBottom();
      } else {
        greet();
      }
    }
    if (window.innerWidth > 620) input.focus();
  }
  function closeChat(focusBack) {
    if (chat.hidden) return;
    const done = () => {
      chat.hidden = true;
      chat.classList.remove('is-closing');
      document.body.classList.remove('mk-chat-open');
    };
    aiBtn.setAttribute('aria-expanded', 'false');
    if (focusBack !== false) aiBtn.focus();
    if (reduced()) { done(); return; }
    chat.classList.add('is-closing');      // slide + fade вниз
    closeT = setTimeout(done, 180);
  }
  aiBtn.addEventListener('click', () => (chat.hidden || chat.classList.contains('is-closing')) ? openChat() : closeChat());

  /* ───────────────────────── веер соцсетей ───────────────────────── */
  const fan = $('#mkFan'), socBtn = $('#mkSocBtn');
  const items = $$('.fan__item', fan);
  const N = items.length;

  items.forEach((el, i) => {
    const rad = (A_FROM + (A_TO - A_FROM) * (i / (N - 1))) * Math.PI / 180;   // 180° (влево) → 270° (вверх)
    el.style.setProperty('--x', (Math.cos(rad) * R).toFixed(1) + 'px');
    el.style.setProperty('--y', (Math.sin(rad) * R).toFixed(1) + 'px');
    el.addEventListener('click', ev => {
      ev.preventDefault();
      setFan(false);
      toast('Демо: ссылка на ' + SOCIALS[i].name + ' не настроена');
    });
  });

  function setFan(open) {
    if (open && !chat.hidden) closeChat(false);     // веер раскрывается поверх панели — показываем что-то одно
    fan.classList.toggle('is-open', open);
    socBtn.setAttribute('aria-expanded', String(open));
    items.forEach((el, i) => {
      el.style.transitionDelay = (open ? i : (N - 1 - i)) * STAGGER + 'ms';   // при закрытии — в обратном порядке
      el.tabIndex = open ? 0 : -1;
    });
  }
  socBtn.addEventListener('click', e => { e.stopPropagation(); setFan(!fan.classList.contains('is-open')); });
  document.addEventListener('click', e => { if (!fan.contains(e.target)) setFan(false); });

  /* перехват: видим модалку ДО того, как её закроет app.js — один Esc закрывает что-то одно */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (fan.classList.contains('is-open')) { setFan(false); socBtn.focus(); return; }
    const m = $('#modal');
    if (m && m.hidden === false) return;
    if (!chat.hidden) closeChat();
  }, true);

  function toast(text) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  /* наружу — для отладки и тестов */
  window.MKChat = {
    streamText: streamText, open: openChat, close: closeChat, reset: restart,
    _t: { parseGuests, parseBudget, parseFlavor, detectOccasion, pickSingle, combos, compare, P_MIN, P_MAX, MED_KG, INTENT }
  };
})();
