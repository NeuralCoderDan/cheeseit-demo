/* ============================================================
   ИИ-помощник (локальный, без API) + веер соцсетей.

   Как устроен диалог:
   1. Каждое сообщение сначала разбирается на ФАКТЫ — гости, число
      тортов, бюджет, вкусы, повод — независимо от текущего вопроса.
      Числа привязываются к словам рядом с ними («3 торта», «гостей 15»,
      «бюджет 15 000»), а не берутся по порядку.
   2. Разобранное подтверждается одной строкой: «Понял: …».
   3. Планировщик задаёт следующий вопрос, пропуская уже известное.
      Повторный вопрос — короткой строкой, а не прежним абзацем.
   Помощник не торопит, не выдумывает и не поднимает бюджет.
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
  const num = n => new Intl.NumberFormat('ru-RU').format(Math.round(n));

  const LS_KEY = 'mk-chat-v3';
  const STAGGER = 40;
  const FAN_R = 110, FAN_ITEM = 56, FAN_GAP = 12;   // радиус веера, размер кнопки, зазор между ними
  const HINT_KEY = 'mk-ai-hint', OPENED_KEY = 'mk-ai-opened';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  /* ───────────────────────── иконки (рисуем сами) ───────────────────────── */
  const I = {
    ai: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="8" y="2.6" width="13.4" height="9.4" rx="3.2" opacity=".55"/>' +
          '<path d="M12.6 12v2.7l3-2.7" opacity=".55"/>' +
          '<rect x="2.6" y="7.8" width="14" height="11.2" rx="3.4"/>' +
          '<path d="M6.8 19v3.1l3.5-3.1"/>' +
          '<circle cx="6.9" cy="13.4" r="1.05" fill="currentColor" stroke="none"/>' +
          '<circle cx="9.9" cy="13.4" r="1.05" fill="currentColor" stroke="none"/>' +
          '<circle cx="12.9" cy="13.4" r="1.05" fill="currentColor" stroke="none"/>' +
        '</svg>',
    share: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
             '<circle cx="18" cy="5.2" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.8" r="2.6"/>' +
             '<path d="M8.3 10.8 15.7 6.5M8.3 13.2l7.4 4.3"/></svg>',
    close: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reset: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
             '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v5h5"/></svg>',
    send: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 3 10.5 13.5M21 3l-6.6 18-3.9-7.5L3 9.6 21 3Z"/></svg>'
  };

  /* соцсети: фирменные цвета, глифы нарисованы вручную (ничего не скачано) */
  const TT = 'M13.4 4v10.7a3.1 3.1 0 1 1-3.1-3.1M13.4 4c.4 2.4 2 3.9 4.6 4.1';
  const SOCIALS = [
    { name: 'Telegram', cls: 'tg',
      svg: '<path fill="#fff" d="M19.6 5.2 3.9 11.3c-.9.35-.88 1.63.03 1.94l3.86 1.3 1.5 4.7c.2.62.98.82 1.45.37l2.2-2.1 3.92 2.9c.58.43 1.42.12 1.58-.6l2.6-12.1c.18-.86-.66-1.57-1.44-1.21Z"/>' +
           '<path fill="none" stroke="#2AABEE" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" d="m8.2 14.5 8.4-6.3-6.5 7.2-.3 3.1"/>' },
    { name: 'VK', cls: 'vk',
      svg: '<path fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M3.4 8.2l3 7.8 3-7.8M12.6 8.2V16M12.6 12.3l4.2-4.1M13.8 11.3l3.9 4.7"/>' },
    { name: 'Instagram', cls: 'ig',
      svg: '<rect x="4" y="4" width="16" height="16" rx="4.6" fill="none" stroke="#fff" stroke-width="1.9"/>' +
           '<circle cx="12" cy="12" r="3.7" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="16.9" cy="7.1" r="1.15" fill="#fff"/>' },
    { name: 'TikTok', cls: 'tt',
      svg: '<g fill="none" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
             '<path stroke="#25F4EE" transform="translate(-1.1 -1)" d="' + TT + '"/>' +
             '<path stroke="#FE2C55" transform="translate(1.1 1)" d="' + TT + '"/>' +
             '<path stroke="#fff" d="' + TT + '"/></g>' },
    { name: 'MAX', cls: 'max',
      svg: '<path fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round" d="M12 3.6c4.9 0 8.6 3.4 8.6 7.8s-3.7 7.8-8.6 7.8c-1 0-2-.1-2.9-.4L5 20.6l1.2-3.6c-1.8-1.4-2.8-3.4-2.8-5.6C3.4 7 7.1 3.6 12 3.6Z"/>' +
           '<path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M8.3 14V8.9l3.7 3.6 3.7-3.6V14"/>' }
  ];
  const glyph = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';

  /* ═════════════════════════ СЛОВА И ФОРМЫ ═════════════════════════ */

  const norm = t => String(t).toLowerCase().replace(/ё/g, 'е');
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const pl = (n, f) => MK.plural(n, f);
  const guestsN = n => n + ' ' + pl(n, ['гость', 'гостя', 'гостей']);
  const cakesN  = n => n + ' ' + pl(n, ['торт', 'торта', 'тортов']);
  const onN = n => 'на ' + n + ' ' + pl(n, ['человека', 'человека', 'человек']);   // «на 2 человека», «на 15 человек»
  const COLLECTIVE = { 2: 'на двоих', 3: 'на троих', 4: 'на четверых', 5: 'на пятерых', 6: 'на шестерых', 7: 'на семерых' };
  const onWho = n => COLLECTIVE[n] || onN(n);
  const CAKES_WORD = { 1: 'один торт', 2: 'два торта', 3: 'три торта', 4: 'четыре торта', 5: 'пять тортов' };
  const ORD = ['Первый', 'Второй', 'Третий', 'Четвёртый', 'Пятый'];

  const FLAVORS = {
    choc:  { label: 'Шоколад',          tags: ['шоколад'],         say: 'шоколадный',        many: 'шоколадных' },
    fruit: { label: 'Фрукты и ягоды',   tags: ['фрукты', 'ягоды'], say: 'фруктово-ягодный',  many: 'фруктово-ягодных' },
    cream: { label: 'Сливки, нежное',   tags: ['сливки'],          say: 'сливочный',         many: 'сливочных' },
    light: { label: 'Не очень сладкое', tags: ['не сладко'],       say: 'не очень сладкий',  many: 'не очень сладких' },
    any:   { label: 'Без разницы',      tags: null,                say: 'любой',             many: '' }
  };
  const FLAVOR_KEYS = ['choc', 'fruit', 'cream', 'light', 'any'];
  const hasTags = f => !!(f && FLAVORS[f] && FLAVORS[f].tags);
  const TAG_ADJ = { 'шоколад': 'шоколадный', 'ягоды': 'ягодный', 'фрукты': 'фруктовый', 'сливки': 'сливочный', 'не сладко': 'не приторный' };

  /* ═════════════════════════ ЧИСЛА: parseAmount и привязка к словам ═════════════════════════ */

  const WORD_NUM = {
    'один': 1, 'одного': 1, 'одной': 1, 'одну': 1, 'полтора': 1.5, 'полторы': 1.5, 'пару': 2,
    'два': 2, 'две': 2, 'двух': 2, 'три': 3, 'трех': 3, 'четыре': 4, 'четырех': 4,
    'пять': 5, 'пяти': 5, 'шесть': 6, 'шести': 6, 'семь': 7, 'семи': 7,
    'восемь': 8, 'восьми': 8, 'девять': 9, 'девяти': 9, 'десять': 10, 'десяти': 10,
    'одиннадцать': 11, 'двенадцать': 12, 'двенадцати': 12, 'пятнадцать': 15, 'пятнадцати': 15,
    'двадцать': 20, 'двадцати': 20, 'тридцать': 30, 'тридцати': 30,
    'сорок': 40, 'сорока': 40, 'пятьдесят': 50, 'пятидесяти': 50
  };
  const RX = {
    cake:   /^(торт|торта|тортов|тортик|тортика|тортиков|штук|штуки|штука|шт|разных|разные)$/,
    guest:  /^(гост|человек|чел$|люд|персон|участник)/,
    gLabel: /^нас$/,
    mUnit:  /^(₽|р|руб|рубл[а-я]*)$/,
    mLabel: /^(бюджет[а-я]*|до|дороже|пределах|максимум|потолок|сумм[а-я]*)$/,
    mult:   /^(тыс|тысяч[а-я]*|тысяча|тысячу|тыщ[а-я]*)$/,
    kPost:  /^(к|k)$/,
    other:  /^(час[а-я]*|лет|год[а-я]*|числ[а-я]*|утра|вечера|минут[а-я]*|кг|килограм[а-я]*|грамм[а-я]*|г|см|ярус[а-я]*|этаж[а-я]*|процент[а-я]*|%)$/
  };

  /* «5 000» → «5000», «5к» → «5 к», «3-4» → «3 - 4», запятые и точки — границы фраз */
  function tokenize(text) {
    const t = norm(text)
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/(\d)[\s  ]+(?=\d{3}(?!\d))/g, '$1')
      .replace(/(\d)(?=[а-яa-z₽+])/g, '$1 ')
      .replace(/([а-яa-z₽])(?=\d)/g, '$1 ')
      .replace(/\s*[-–—]\s*/g, ' - ')
      .replace(/[,;:!?()«»"…]/g, ' | ')
      .replace(/\.(?!\d)/g, ' | ');
    return t.split(/\s+/).filter(Boolean);
  }

  function scan(tk) {
    const ms = [];
    for (let i = 0; i < tk.length; i++) {
      let v = null, e = i;
      if (/^\d+(\.\d+)?$/.test(tk[i])) v = parseFloat(tk[i]);
      else if (WORD_NUM[tk[i]] != null) {
        v = WORD_NUM[tk[i]];
        const nx = WORD_NUM[tk[i + 1]];
        if (v >= 20 && v % 10 === 0 && nx != null && nx < 10) { v += nx; e = i + 1; }   // «двадцать пять»
      }
      if (v == null) continue;
      ms.push({ v: v, s: i, e: e });
      i = e;
    }
    // диапазоны: «3 - 4», «трех - четырех»
    for (let i = 0; i < ms.length - 1; i++) {
      const a = ms[i], b = ms[i + 1];
      if (tk[a.e + 1] === '-' && b.s === a.e + 2) ms.splice(i, 2, { v: b.v, min: a.v, max: b.v, s: a.s, e: b.e, range: true });
    }
    // множители: «5 тысяч», «тысяч пять», «5к», «тыщ 10»
    const used = {};
    const moneyWord = w => w != null && (RX.mUnit.test(w) || w === '|');
    ms.forEach(m => {
      const nx = tk[m.e + 1];
      const kOk = nx && RX.kPost.test(nx) && (tk[m.e + 2] == null || moneyWord(tk[m.e + 2]) || !/^[а-я]/.test(tk[m.e + 2]));  // «к празднику» — не тысячи
      if (nx && (RX.mult.test(nx) || kOk) && !used[m.e + 1]) { used[m.e + 1] = 1; m.k = true; m.e2 = m.e + 1; }
      else if (tk[m.s - 1] && RX.mult.test(tk[m.s - 1]) && !used[m.s - 1]) { used[m.s - 1] = 1; m.k = true; m.s2 = m.s - 1; }
      if (m.k) {
        const x = n => n < 1000 ? n * 1000 : n;
        m.v = x(m.v);
        if (m.range) { m.min = x(m.min); m.max = x(m.max); }
      }
    });
    // «до тысячи» — без числа
    tk.forEach((w, i) => {
      if (/^(тысяча|тысячу|тысячи)$/.test(w) && !used[i] && !ms.some(m => m.s <= i && i <= m.e)) ms.push({ v: 1000, s: i, e: i, k: true });
    });
    return ms.sort((a, b) => a.s - b.s);
  }

  /* у каждого числа ищем опорное слово рядом */
  function classify(tk, ms) {
    const startOf = m => m.s2 != null ? m.s2 : m.s;
    const endOf = m => m.e2 != null ? m.e2 : m.e;
    const inM = i => ms.some(m => i >= startOf(m) && i <= endOf(m));
    const typeOf = w => RX.other.test(w) ? 'other' : RX.cake.test(w) ? 'cakes' : RX.guest.test(w) ? 'guests' : RX.mUnit.test(w) ? 'money' : null;
    const claimed = {};

    // 1) единица ПОСЛЕ числа: «15 гостей», «3 торта», «5000 ₽»
    ms.forEach(m => {
      if (m.k) { m.type = 'money'; return; }
      for (let d = 1; d <= 2; d++) {
        const i = endOf(m) + d, w = tk[i];
        if (w == null || w === '|' || inM(i)) break;
        const ty = typeOf(w);
        if (ty) { m.type = ty; claimed[i] = 1; break; }
        if (RX.mLabel.test(w) || RX.gLabel.test(w)) break;   // подпись к следующему числу
      }
    });
    // 2) подпись ПЕРЕД числом: «гостей 15», «бюджет 15000», «нас будет 20», «торт на 12»
    ms.forEach(m => {
      if (m.type) return;
      const st = startOf(m);
      if (tk[st - 1] === 'на' && m.v <= 300) { m.type = 'guests'; return; }
      for (let d = 1; d <= 3; d++) {
        const i = st - d, w = tk[i];
        if (w == null || w === '|' || inM(i)) break;
        if (claimed[i]) continue;
        const ty = typeOf(w) || (RX.gLabel.test(w) ? 'guests' : RX.mLabel.test(w) ? 'money' : null);
        if (ty) { m.type = ty; claimed[i] = 1; break; }
      }
    });
    // 3) направление: «до/не дороже/в пределах» — потолок; «от/больше/6000+» — нижняя граница
    ms.forEach(m => {
      const before = ' ' + tk.slice(Math.max(0, startOf(m) - 3), startOf(m)).join(' ') + ' ';
      m.ceil = / (до|дороже|пределах|максимум|потолок) | не больше | не выше /.test(before);
      m.floor = !m.ceil && (/ (от|больше|выше|более|свыше) /.test(before) || tk[endOf(m) + 1] === '+');
      if (!m.type && m.v > 500) m.type = 'money';      // больше 500 — почти наверняка деньги
    });
    return ms;
  }

  const moneyOf = m => m.range ? { min: m.min, max: m.max } : m.floor ? { min: m.v, max: null } : { min: null, max: m.v };

  /* 2.1 — сумма из свободного текста: «тысяч пять», «пяти тысяч», «полторы тысячи»,
     «5к», «до пяти тысяч», «в пределах трёх-четырёх тысяч», «тыщ 10» */
  function parseAmount(text) {
    const tk = tokenize(text);
    const ms = classify(tk, scan(tk)).filter(m => m.type !== 'other');
    const money = ms.filter(m => m.type === 'money');
    if (money.length) return moneyOf(money[money.length - 1]);
    const bare = ms.filter(m => !m.type && m.v >= 100);
    return bare.length ? moneyOf(bare[0]) : null;
  }

  function extractFlavors(t) {
    const rx = {
      light: /не (очень )?слад|несладк|не приторн|кислинк|поменьше сахар/,
      choc:  /шокол|какао|брауни/,
      fruit: /ягод|фрукт|малин|клубник|вишн|смород|манго|маракуй|черник|цитрус|апельсин|банан/,
      cream: /сливк|сливоч|нежн|ванил|крем|сыр|чиз|молоч/
    };
    return Object.keys(rx)
      .map(k => ({ k: k, i: t.search(rx[k]) }))
      .filter(x => x.i > -1)
      .sort((a, b) => a.i - b.i)
      .map(x => x.k);
  }

  function detectOccasion(t) {
    if (/свадьб|венчан|жених|невест/.test(t)) return 'wedding';
    if (/детск|ребен|сын|дочк|дочер|малыш|ребят|школ|садик/.test(t)) return 'kids';
    if (/день рожд|днюх|юбиле/.test(t) || /(^|[^а-я])др([^а-я]|$)/.test(t)) return 'birthday';
    return null;
  }
  const OCC_SAY = { wedding: 'свадьба', kids: 'детский праздник', birthday: 'день рождения' };

  /* все факты из одного сообщения; ctx — какой вопрос сейчас задан */
  function extract(text, ctx) {
    const t = norm(text), tk = tokenize(text);
    const ms = classify(tk, scan(tk)).filter(m => m.type !== 'other');
    const x = { ambiguous: [] };
    ms.forEach(m => {
      if (m.type === 'cakes') {
        if (m.v >= 1 && m.v <= 10 && m.v % 1 === 0) x.cakes = m.v; else x.ambiguous.push(m.v);
      } else if (m.type === 'guests') {
        if (m.floor && !m.range) x.guestsMore = m.v;
        else {
          x.guests = clampG(m.range ? (m.min + m.max) / 2 : m.v);
          if (m.range) x.guestsApprox = true;
        }
      } else if (m.type === 'money') {
        x.budget = moneyOf(m);
      } else {
        x.ambiguous.push(m.v);
      }
    });
    // одно «голое» число и других чисел нет — по контексту вопроса
    if (x.ambiguous.length === 1 && ms.length === 1) {
      const v = x.ambiguous[0];
      if (/^(plan2|plan3|mismatch)$/.test(ctx) && v >= 1 && v <= 5) { x.cakes = v; x.ambiguous = []; }
      else if (ctx === 'budget') { /* «15» в ответ на бюджет — не угадываем, переспросим */ }
      else if (v >= 1 && v <= 300 && v % 1 === 0) { x.guests = v; x.ambiguous = []; }
    }
    x.flavors = extractFlavors(t);
    x.occasion = detectOccasion(t);
    x.unsure = /не знаю|пока не|без понятия|сложно сказать|не уверен|затрудня|понятия не/.test(t);
    x.any = /без разниц|не важн|неважн|все равно|любой|любые|какой угодно/.test(t);
    x.skip = /пропуст|без бюджет|нет бюджет|не скажу/.test(t);
    x.yes = /^(да|ага|ок|окей|хорошо|давай|давайте|покажи|показывай|можно|конечно)([^а-я]|$)/.test(t);
    x.no = /^(нет|не надо|не нужно|не стоит|хватит|не)([^а-я]|$)/.test(t);
    return x;
  }
  const clampG = n => Math.max(1, Math.min(300, Math.round(n)));

  const INTENT = {
    contacts:    /адрес|телефон|позвон|номер|доставк|самовывоз|где вы|где наход|как добрат|как проехать|контакт|режим работ|часы работ|во сколько|ватсап|whatsapp|телеграм|telegram|почт|e-?mail/,
    composition: /состав|аллерг|глютен|лактоз|орех|арахис|без сахара|сахарозам|калори|ккал|срок годност|хран[ия]т|хранени|веган|постн|халяль|кошер/,
    discount:    /скидк|акци|промокод|бонус|распродаж|уступ/,
    lead:        /успеете|успеет|успеешь|за сколько дн|сколько дней|срок изготов|срок приготов|к субботе|к воскресень|к пятниц|к понедельн|к завтр|на завтра|срочн|предоплат|отмен|вернуть деньг|возврат/,
    price:       /сколько стоит|сколько стоят|почем|какие цены|цен[аыу]|стоимост|ценник|по деньгам/,
    choose:      /какой торт|подбер|подобр|выбрат|выбери|посовет|помоги|что взять|хочу торт|нужен торт/,
    hello:       /^(привет|здравств|добрый|доброе|хай|hello|hi)/,
    thanks:      /спасибо|благодар/,
    restart:     /^(заново|сначала|начать заново|сброс)/,
    domain:      /торт|десерт|чизкейк|бенто|капкейк|вкус|гост|человек|бюджет|рубл|₽|праздн|день рожд|свадьб|кг|вес/
  };

  /* ═════════════════════════ КАТАЛОГ И РАСЧЁТЫ ═════════════════════════ */

  const ALL = MK.products;
  const P_MIN = Math.min.apply(null, ALL.map(MK.price));
  const P_MAX = Math.max.apply(null, ALL.map(MK.price));
  const MED_KG = (function () {
    const v = ALL.filter(p => ['birthday', 'mousse', 'cheesecake'].indexOf(p.cat) > -1).map(p => p.perKg).sort((a, b) => a - b);
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  })();
  const exactKg = g => MK.kgForGuests(g);                              // точная потребность, 180 г на человека
  const rawW  = g => Math.max(0.5, Math.ceil(exactKg(g) * 2 - 1e-9) / 2); // она же с шагом 0,5 кг
  const needW = g => MK.weightForGuests({ minWeight: 1.5, tiers: 1 }, g); // вес под гостей «вообще»

  function compare(n, k) {
    const one = needW(n), g = Math.ceil(n / k), each = needW(g);
    return { one: one, each: each, g: g, sumOne: one * MED_KG, sumMany: each * MED_KG * k };
  }

  const OCC_CATS = { kids: ['kids'], wedding: ['wedding'], birthday: ['birthday'] };
  function pool(perCake, occasion, tiered) {
    return ALL.filter(p => {
      if (tiered) return p.tiers >= 2;
      if (p.cat === 'cupcakes') return false;             // продаются наборами, не на вес
      if (p.cat === 'bento') return perCake <= 2;          // бенто — на 1–2 человека (так в описании)
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
    const w = MK.weightForGuests(p, g);
    return { p: p, g: g, w: w, sum: MK.priceAt(p, w) };
  }
  /* вес сильно больше нужного (из-за минимального веса) — такой торт ниже в выдаче */
  function overshoot(o) {
    const r = o.w / exactKg(o.g);
    return r >= 2 ? 1.5 : r >= 1.5 ? 0.75 : 0;
  }

  /* один торт: сначала подходящие, внутри — от дешёвых к дорогим (не подтягиваем цену) */
  function pickSingle(n, f, occasion, tiered) {
    return pool(n, occasion, tiered)
      .map(p => { const o = option(p, n); o.s = fit(p, f, occasion) - overshoot(o); return o; })
      .sort((x, y) => y.s - x.s || x.sum - y.sum);
  }

  /* несколько тортов: перебор наборов, бюджет — на общую сумму */
  function combos(n, k, flavors, occasion) {
    const g = Math.ceil(n / k);
    const opts = pool(g, occasion, false).map(p => option(p, g));
    const slots = [];
    for (let i = 0; i < k; i++) slots.push(flavors[i] || 'any');
    const res = [];
    (function rec(i, chosen) {
      if (i === k) {
        let s = 0;
        chosen.forEach((o, j) => { s += fit(o.p, slots[j], occasion) - overshoot(o); });
        res.push({ set: chosen.slice(), s: s, sum: chosen.reduce((t, o) => t + o.sum, 0), w: chosen.reduce((t, o) => t + o.w, 0), slots: slots, g: g });
        return;
      }
      opts.forEach(o => {
        if (chosen.some(c => c.p.id === o.p.id)) return;
        chosen.push(o); rec(i + 1, chosen); chosen.pop();
      });
    })(0, []);
    return res.sort((x, y) => y.s - x.s || x.sum - y.sum);
  }

  /* ───────── обоснование — только из реальных полей торта ───────── */
  function ownAdj(p) {
    const a = p.flavors.map(t => TAG_ADJ[t]).filter(Boolean);
    return a.length ? a.slice(0, 2).join(' и ') : '';
  }
  function matchedAdj(p, f) {
    return FLAVORS[f].tags.filter(t => p.flavors.indexOf(t) > -1).map(t => TAG_ADJ[t]).join(' и ');
  }
  /* 5 — вес честно: «как раз», «с небольшим запасом» или «минимальный вес больше, чем нужно» */
  function sizeNote(o) {
    if (o.w <= rawW(o.g)) return 'как раз ' + onN(o.g);
    if (o.w / exactKg(o.g) >= 1.5) return 'минимальный вес этого торта ' + kg(o.p.minWeight) + ' — это больше, чем нужно ' + onWho(o.g);
    return 'с небольшим запасом ' + onN(o.g);
  }
  function flavorPart(o, f, matchCount) {
    if (!hasTags(f)) return o.p.hit ? 'отмечен в каталоге как хит' : '';
    if (matches(o.p, f)) return matchedAdj(o.p, f) + ', как вы просили';
    const own = ownAdj(o.p);
    if (matchCount === 0) return FLAVORS[f].many + ' на такой вес не нашлось' + (own ? ', это ' + own : ', вкус в описании не указан');
    return 'другой вкус' + (own ? ' — ' + own : '') + ', добавил по вашей просьбе';
  }
  function whyOne(o, f, budget, matchCount) {
    const parts = [flavorPart(o, f, matchCount), sizeNote(o)];
    if (budget && budget.max && o.sum <= budget.max) parts.push('укладывается в бюджет');
    const p = parts.filter(Boolean);
    return p.length ? cap(p.join('; ')) + '.' : '';
  }
  function whySlot(o, f, i) {
    const fp = hasTags(f) ? flavorPart(o, f, matches(o.p, f) ? 1 : 0)
                          : (o.p.hit ? 'хит каталога' : (ownAdj(o.p) ? 'другой вкус: ' + ownAdj(o.p) : ''));
    return (ORD[i] || 'Ещё один') + ' — ' + [fp, sizeNote(o)].filter(Boolean).join('; ') + '.';
  }

  /* ═════════════════════════ РАЗМЕТКА ═════════════════════════ */

  const fabs = document.createElement('div');
  fabs.className = 'fabs';
  fabs.innerHTML =
    '<div class="fan" id="mkFan">' +
      '<button class="fab fab--soc" id="mkSocBtn" type="button" aria-label="Поделиться" aria-expanded="false">' + I.share + '</button>' +
      SOCIALS.map(s =>
        '<a class="fan__item fan__item--' + s.cls + '" href="#" tabindex="-1" aria-label="Поделиться: ' + s.name + '">' +
          glyph(s.svg) + '<span class="fan__tip" aria-hidden="true">' + s.name + '</span>' +
        '</a>').join('') +
    '</div>' +
    '<div class="fabwrap">' +
      '<button class="fab fab--ai" id="mkAiBtn" type="button" aria-label="ИИ-помощник" aria-expanded="false" aria-controls="mkChat">' + I.ai + '</button>' +
      '<span class="fab__tip" aria-hidden="true">ИИ-помощник</span>' +
      '<div class="ai-hint" id="mkHint" hidden>' +
        '<button class="ai-hint__t" type="button">Не знаете, какой торт выбрать? Спросите — подберу за минуту</button>' +
        '<button class="ai-hint__x" type="button" aria-label="Закрыть подсказку">' + I.close + '</button>' +
      '</div>' +
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
      '<input class="chat__in" id="mkInput" type="text" autocomplete="off" placeholder="Например: 2 торта на 20 человек, до 10 000" aria-label="Сообщение">' +
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
  const freshFacts = () => ({
    guests: null, guestsApprox: false,
    cakes: null, cakesExplicit: false, tiered: false, both: false,
    flavors: [], flavorAny: false,
    budget: null, budgetDone: false,
    occasion: null, mismatchOk: false, shortChoice: null, askedPrice: false, diffShown: false
  });
  const fresh = () => ({ ask: 'start', asked: {}, misses: 0, pending: null, f: freshFacts(), entries: [] });
  let state = fresh();
  let busy = false;
  let chain = Promise.resolve();
  // очередь: следующее действие ждёт предыдущее; сбой одного не останавливает остальные
  const enqueue = fn => (chain = chain.then(fn, fn).catch(err => console.error('[assistant]', err)));

  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} };
  /* 8 — историю проверяем целиком; что-то не так — молча начинаем новый диалог */
  const OLD_KEYS = ['mk-chat', 'mk-chat-v1', 'mk-chat-v2'];
  const isStr = v => typeof v === 'string';
  function validEntry(e) {
    if (!e || typeof e !== 'object') return false;
    if (e.r === 'bot' || e.r === 'me') return isStr(e.t);
    if (e.r === 'chips') return Array.isArray(e.items) && e.items.every(c => Array.isArray(c) && isStr(c[0]) && isStr(c[1]));
    if (e.r === 'recs') return Array.isArray(e.items) && e.items.every(i => i && isStr(i.id) && ALL.some(p => p.id === i.id));
    return false;
  }
  function load() {
    OLD_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    try {
      const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!d || typeof d !== 'object' || !Array.isArray(d.entries) || !d.entries.length) return false;
      if (!d.entries.every(validEntry) || !d.f || typeof d.f !== 'object' || !isStr(d.ask)) throw new Error('история не читается');
      const f = Object.assign(freshFacts(), d.f);
      if (!Array.isArray(f.flavors)) f.flavors = [];
      state = {
        ask: QUESTIONS[d.ask] || d.ask === 'start' ? d.ask : 'start',
        asked: d.asked && typeof d.asked === 'object' ? d.asked : {},
        misses: Number(d.misses) || 0,
        pending: d.pending && typeof d.pending === 'object' ? d.pending : null,
        f: f,
        entries: d.entries
      };
      return true;
    } catch (e) {
      console.error('[assistant] старая история не читается — начинаем заново', e);
      try { localStorage.removeItem(LS_KEY); } catch (e2) {}
      state = fresh();
      return false;
    }
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
      const w = MK.weightForGuests(p, it.g);
      return '<button class="rec" type="button" data-id="' + p.id + '" data-w="' + w + '">' +
               '<span class="rec__ph">' + MK.placeholder(p) + '</span>' +
               '<span><span class="rec__n">' + p.name + '</span>' +
               '<span class="rec__m">' + MK.catName(p.cat) + ' · ' + kg(w) + '</span>' +
               '<span class="rec__p">≈ ' + money(MK.priceAt(p, w)) + '</span>' +
               (it.why ? '<span class="rec__why">' + it.why + '</span>' : '') + '</span>' +
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
  function lastBot() {
    for (let i = state.entries.length - 1; i >= 0; i--) if (state.entries[i].r === 'bot') return state.entries[i].t;
    return null;
  }

  /* 7 — сообщение не длиннее 500 символов: длинное обрезаем, а не падаем */
  const MAX_LEN = 500;
  function clip(raw) {
    const t = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (t.length <= MAX_LEN) return t;
    const cut = t.slice(0, MAX_LEN);
    return cut.slice(0, Math.max(cut.lastIndexOf(' '), MAX_LEN - 40)).trim() + '…';
  }

  /* ── индикатор «думает»: три точки в пузырьке, сразу после сообщения человека ── */
  let thinkingEl = null;
  function showThinking() {
    if (thinkingEl && thinkingEl.isConnected) { log.append(thinkingEl); toBottom(); return; }
    thinkingEl = document.createElement('div');
    thinkingEl.className = 'typing';
    thinkingEl.setAttribute('role', 'status');
    thinkingEl.setAttribute('aria-label', 'Помощник печатает');
    thinkingEl.innerHTML = '<span></span><span></span><span></span>';
    log.append(thinkingEl); toBottom();
  }
  function hideThinking() { if (thinkingEl) { thinkingEl.remove(); thinkingEl = null; } }

  /* ── пользователь никогда не видит технических слов: такой текст — это сбой ── */
  const TECH = /\b(undefined|null|NaN|error|exception|TypeError|ReferenceError|stack)\b|ошибк|не удалось выполнить|не число|∞|\.js\b|:\d+:\d+/i;
  function guard(text) {
    if (typeof text !== 'string' || TECH.test(text.replace(/[\s\u00a0\u202f]+/g, ' '))) {   // Intl ставит неразрывные пробелы
      console.error('[assistant] в ответ попал технический текст:', text);
      throw new Error('assistant: unsafe text');                  // поймает run() и ответит по-человечески
    }
  }

  /* после таймаута ответы «зависшего» действия не показываем (force — системные реплики) */
  let zombie = false;
  const markStarted = () => { if (active) active.started = true; };

  /* 2.2 — никогда не повторяем предыдущую реплику дословно */
  async function say(text, force) {
    if (zombie && !force) return;
    if (!text || text === lastBot()) return;
    guard(text);
    busy = true;
    showThinking();
    await wait(reduced() ? 40 : 360);
    if (zombie && !force) { busy = false; return; }
    hideThinking();                                     // точки исчезают с началом печати
    markStarted();
    push({ r: 'bot', t: text });
    await bubble('bot', text, true);
    busy = false;
  }
  function me(text, echo) {
    if (zombie) return;
    closeChips();
    if (echo !== false) { push({ r: 'me', t: text }); bubble('me', text, false); }
    showThinking();                                     // «думает» — сразу после отправки
  }
  function chips(items, force) {
    if ((zombie && !force) || !items.length) return;
    items.forEach(c => guard(c[0]));
    markStarted();
    push({ r: 'chips', items: items, done: false }); chipsRow(items, false);
  }
  function recs(items, title) {
    if (zombie) return;
    items.forEach(it => { if (it.why) guard(it.why); });
    markStarted();
    const e = { r: 'recs', items: items, title: title || '' }; push(e); recsRow(e);
  }
  function closeChips() {
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (state.entries[i].r === 'chips') { state.entries[i].done = true; break; }
    }
    $$('.chips:not(.is-done)', log).forEach(r => r.classList.add('is-done'));
    save();
  }

  /* ═════════════════════════ ВОПРОСЫ ═════════════════════════ */

  const F = () => state.f;
  const multi = () => (F().cakes || 0) > 1 || F().both;

  const QUESTIONS = {
    start:  { full: 'Здравствуйте! Я помогу выбрать торт из каталога. Подобрать вариант — или сначала подсказать по ценам?',
              short: 'Подобрать торт или подсказать по ценам?' },
    browse: { full: 'Хорошо, не буду мешать. Если понадобится помощь с выбором — я здесь.', short: 'Если что — я здесь.' },
    guests: { full: 'Для начала — примерно сколько человек будет?', short: 'Сколько примерно будет гостей?' },
    guests_more:   { full: 'А примерно сколько?', short: 'Сколько примерно гостей?' },
    guests_unsure: { full: 'Ничего страшного, давайте прикинем. Это скорее небольшой круг — семья, пара друзей? Или большое застолье?',
                     short: 'Какой примерно круг?' },
    plan2:  { full: () => plan2Text(), short: 'Так что — два торта или один?' },
    plan3:  { full: 'Компания большая — тут два пути. Несколько тортов, обычно три: разные вкусы, и резать проще. Или один многоярусный: эффектнее смотрится на фото, но вкус будет один. Что для вас важнее?',
              short: 'Что важнее — разные вкусы или эффектный вид?' },
    mismatch: { full: () => mismatchText(), short: () => 'Оставляем ' + cakesN(F().cakes) + ' или хватит одного?' },
    flavor1: { full: () => multi() ? 'Возьмём разные вкусы, чтобы был выбор. Какой будет первый?' : 'Какие вкусы больше любите?',
               short: () => multi() ? 'Какой первый вкус?' : 'Какой вкус?' },
    flavor2: { full: 'А второй — что-то другое?', short: 'Какой второй вкус?' },
    budget:  { full: () => multi() ? 'Есть примерный бюджет — на все торты вместе? Если нет — просто пропустите.'
                                   : 'Есть примерный бюджет? Если нет — просто пропустите.',
               short: 'Есть бюджет? Можно пропустить.' },
    short:   { full: '', short: () => 'Добавить другие вкусы или показать только ' + FLAVORS[F().flavors[0]].say + '?' },
    over:    { full: '', short: 'Показать этот вариант?' },
    upgrade: { full: '', short: 'Показать вариант подороже?' },
    fewer:   { full: '', short: 'Показать набор или подобрать меньше тортов?' },
    recount: { full: '', short: 'Сколько тортов взять?' },
    clarify: { full: '', short: () => 'К чему относится ' + num(state.pending.vals[0]) + '?' },
    done:    { full: 'Нажмите на карточку — откроется описание и калькулятор веса. Захотите что-то поменять — напишите или начните заново.',
               short: 'Могу подобрать заново или поменять условия.' }
  };
  const val = v => typeof v === 'function' ? v() : v;

  function chipsFor(key) {
    const f = F(), p = state.pending || {};
    switch (key) {
      case 'start':  return [['Подобрать торт', 'choose'], ['Сколько стоит торт?', 'price'], ['Просто смотрю', 'browse']];
      case 'browse': return [['Подобрать торт', 'choose'], ['Сколько стоит торт?', 'price']];
      case 'guests': return [['до 5', 'g:5'], ['5-10', 'g~8'], ['10-20', 'g~15'], ['больше 20', 'more'], ['Пока не знаю', 'unsure']];
      case 'guests_more':   return [['20–30', 'g~25'], ['30–50', 'g~40'], ['больше 50', 'g~60']];
      case 'guests_unsure': return [['Небольшой круг', 'g~6'], ['Что-то среднее', 'g~12'], ['Большое застолье', 'g~25'], ['Тоже не знаю', 'g10']];
      case 'plan2':  return [['Давайте два', 'c:2'], ['Лучше один', 'c:1']].concat(f.diffShown ? [] : [['А насколько дороже?', 'diff']]);
      case 'plan3':  return [['Важнее вкусы', 'p:three'], ['Важнее вид на фото', 'p:tiered'], ['Покажи оба варианта', 'p:both']];
      case 'mismatch': return [['Оставить ' + f.cakes, 'm:keep'], ['Хватит одного', 'm:one']];
      case 'flavor1':  return FLAVOR_KEYS.map(k => [FLAVORS[k].label, 'f:' + k]);
      case 'flavor2':  return FLAVOR_KEYS.filter(k => k !== f.flavors[0]).map(k => [FLAVORS[k].label, 'f:' + k]);
      case 'budget':   return [['до 3 000', 'b:lt3'], ['3 000-6 000', 'b:3-6'], ['6 000+', 'b:gt6'], ['Не важно', 'b:any'], ['Пропустить', 'b:skip']];
      case 'short':    return p.m > 0 ? [['Добавить другие', 's:add'], ['Только ' + FLAVORS[f.flavors[0]].say, 's:only']]
                                      : [['Показать другие', 's:add'], ['Не надо', 's:no']];
      case 'over':     return p.set && p.k > 1
                              ? [['Покажи', 'o:show'], ['Взять меньше тортов', 'o:fewer'], ['Не надо', 'o:no']]
                              : [['Покажи', 'o:show'], ['Не надо', 'o:no']];
      case 'recount': {
        const out = [];
        for (let t = (p.k || 2) - 1; t >= 1; t--) out.push([cap(CAKES_WORD[t]), 'rc:' + t]);
        return out;
      }
      case 'upgrade':  return [['Покажи', 'u:show'], ['Не надо, этого хватит', 'u:no']];
      case 'fewer':    return [['Показать набор', 'fw:many'], ['Меньше тортов', 'fw:fewer'], ['Не надо', 'fw:no']];
      case 'clarify': {
        const v = p.vals[0], out = [[guestsN(v), 'cl:g']];
        if (v >= 1 && v <= 10 && v % 1 === 0) out.push([cakesN(v), 'cl:c']);
        out.push([money(v < 100 ? v * 1000 : v), 'cl:b']);
        return out;
      }
      case 'done':     return [['Начать заново', 'reset']];
      default:         return [];
    }
  }

  /* задать вопрос: первый раз — полностью, повторно — коротко */
  async function ask(key, text) {
    const first = !state.asked[key];
    state.ask = key;
    state.asked[key] = true;
    save();
    const q = QUESTIONS[key];
    await say(text || (first ? val(q.full) : val(q.short)) || val(q.short));
    chips(chipsFor(key));
  }
  const reask = () => ask(state.ask);

  /* ═════════════════════════ ФАКТЫ ═════════════════════════ */

  function setGuests(n, approx) {
    const f = F();
    if (f.guests === n) return false;
    f.guests = n;
    f.guestsApprox = !!approx;
    if (!f.cakesExplicit) { f.cakes = null; f.tiered = false; f.both = false; }
    f.mismatchOk = false; f.shortChoice = null; state.pending = null;
    return true;
  }
  function setCakes(n) {
    const f = F();
    if (f.cakes === n && f.cakesExplicit) return false;
    f.cakes = n; f.cakesExplicit = true; f.tiered = false; f.both = false;
    f.mismatchOk = false; f.shortChoice = null; state.pending = null;
    return true;
  }
  function setBudget(b) {
    const f = F();
    f.budget = b && (b.max || b.min) ? { min: b.min || null, max: b.max || null } : null;
    f.budgetDone = true;
    state.pending = null;
  }
  function budgetLabel(b) {
    if (!b) return 'без ограничений';
    if (b.min && b.max) return 'в пределах ' + num(b.min) + '–' + money(b.max);
    if (b.max) return 'до ' + money(b.max);
    return 'от ' + money(b.min);
  }
  function setFlavors(list) {
    const f = F();
    const need = multi() ? 2 : 1;
    list.forEach(k => {
      if (f.flavors.indexOf(k) > -1) return;
      if (f.flavors.length < need) f.flavors.push(k);
      else if (need === 1) f.flavors = [k];
    });
    f.shortChoice = null;
  }

  /* «Понял: 3 торта, 15 гостей, бюджет до 15 000 ₽.» */
  function confirmLine(c) {
    const parts = [];
    if (c.cakes != null) parts.push(cakesN(c.cakes));
    if (c.guests != null) parts.push((c.approx ? 'примерно ' : '') + guestsN(c.guests));
    if (c.budget) parts.push('бюджет ' + budgetLabel(c.budget));
    if (c.flavors && c.flavors.length) parts.push('вкус ' + c.flavors.map(k => FLAVORS[k].say).join(' и '));
    if (c.occasion) parts.push(OCC_SAY[c.occasion]);
    return parts.length ? 'Понял: ' + parts.join(', ') + '.' : '';
  }

  /* ═════════════════════════ ПЛАНИРОВЩИК ═════════════════════════ */

  function plan2Text() {
    const n = F().guests, c = compare(n, 2);
    return 'Гостей прилично. Один торт на такую компанию — это около ' + kg(c.one) + ': резать неудобно, да и один вкус нравится не всем. ' +
           'Обычно в таком случае берут два торта поменьше и разных — например, шоколадный и фруктовый, — чтобы каждый нашёл своё. ' +
           (c.sumMany - c.sumOne > 0 ? 'Сразу скажу честно: два торта выйдут немного дороже одного большого. '
                                     : 'По деньгам, если считать по весу, выйдет примерно одинаково. ') +
           'Посмотрим вариант с двумя или всё-таки один?';
  }
  function mismatchText() {
    const f = F(), k = f.cakes, n = f.guests, g = Math.ceil(n / k);
    const minW = Math.min.apply(null, pool(g, f.occasion, false).map(p => p.minWeight));
    const total = k * Math.max(minW, rawW(g));
    return cap(cakesN(k)) + ' ' + onN(n) + ' — получится много: даже самые маленькие вместе потянут примерно на ' + kg(total) +
           ', а нужно около ' + kg(exactKg(n)) + '. Оставляем ' + cakesN(k) + ' или хватит одного?';
  }

  async function next() {
    const f = F();
    if (f.guests == null) return ask('guests');

    if (f.askedPrice) {
      f.askedPrice = false;
      const sums = pickSingle(f.guests, null, f.occasion, false).map(o => o.sum);
      await say('Тогда точнее: ' + onN(f.guests) + ' торты выходят примерно от ' + money(Math.min.apply(null, sums)) + ' до ' + money(Math.max.apply(null, sums)) + '.');
    }

    // своё мнение о количестве — только если человек сам не назвал число
    if (f.cakes == null) {
      const n = f.guests;
      if (n <= 7)  { f.cakes = 1; await say('Одного торта хватит с запасом.'); }
      else if (n <= 15) { f.cakes = 1; await say('Хватит одного торта — примерно на ' + kg(needW(n)) + '.'); }
      else if (n <= 30) return ask('plan2');
      else return ask('plan3');
      save();
    }

    // явно названное число тортов — закон; переспрашиваем один раз, если оно не бьётся с гостями
    if (f.cakesExplicit && f.cakes > 1 && !f.mismatchOk && f.guests / f.cakes < 3) return ask('mismatch');

    const want = f.tiered ? 1 : Math.min(f.cakes, 2);
    if (!f.flavorAny && f.flavors.length < want) return ask(f.flavors.length === 0 ? 'flavor1' : 'flavor2');
    if (!f.budgetDone) return ask('budget');
    return present();
  }

  /* ═════════════════════════ ПОДБОР ═════════════════════════ */

  async function present() {
    const f = F();
    let r;
    if (f.both) {
      await say('Покажу оба варианта — сравните сами.');
      r = await presentSingle(true, 'Вариант 1 — многоярусный');
      if (r !== 'pending') r = await presentCombo(3, 'Вариант 2 — три торта');
    } else if (f.tiered) r = await presentSingle(true);
    else if (f.cakes > 1) r = await presentCombo(f.cakes);
    else r = await presentSingle(false);
    if (r !== 'pending') await finish();
  }

  async function presentSingle(tiered, title) {
    const f = F(), n = f.guests, fl = f.flavorAny ? null : f.flavors[0], b = f.budget, max = b && b.max;
    const list = pickSingle(n, fl, f.occasion, tiered);
    const within = max ? list.filter(o => o.sum <= max) : list;

    // бюджет мал даже для самого доступного — прямо, без уговоров и без «урежем вес»
    if (!within.length) {
      const cheap = list.slice().sort((x, y) => x.sum - y.sum)[0];
      state.pending = { kind: 'over', items: [{ id: cheap.p.id, g: n, why: whyOne(cheap, fl, null, 1) }] };
      await ask('over', 'Самый доступный ' + (tiered ? 'многоярусный ' : '') + 'торт ' + onN(n) + ' у нас — ' + money(cheap.sum) + '. Это ' +
                        (cheap.sum <= max * 1.25 ? 'чуть ' : '') + 'выше вашего бюджета. Если готовы рассмотреть — покажу, если нет, ничего страшного.');
      return 'pending';
    }

    let top, mCount = 0;
    if (hasTags(fl)) {
      const m = within.filter(o => matches(o.p, fl));
      mCount = m.length;
      if (tiered || m.length >= 2 || f.shortChoice === 'only') top = (m.length ? m : within).slice(0, tiered ? 2 : 3);
      else if (!f.shortChoice) {
        // 4 — подходящих по вкусу мало: не добиваем молча, а спрашиваем
        state.pending = { kind: 'short', m: m.length };
        await ask('short', m.length
          ? cap(FLAVORS[fl].many) + ' подходящих — один. Добавить к нему другие вкусы или показать только ' + FLAVORS[fl].say + '?'
          : cap(FLAVORS[fl].many) + ' на такой вес' + (max ? ' и бюджет' : '') + ' не нашлось. Показать другие вкусы?');
        return 'pending';
      } else top = m.concat(within.filter(o => !matches(o.p, fl))).slice(0, 3);
    } else top = within.slice(0, tiered ? 2 : 3);

    if (!title) await say('Вот что подойдёт ' + onN(n) + ':');
    recs(top.map(o => ({ id: o.p.id, g: n, why: whyOne(o, fl, b, mCount) })), title);

    // бюджет с запасом: не подтягиваем к потолку, только предлагаем
    if (max && !title) {
      const shownMax = Math.max.apply(null, top.map(o => o.sum));
      if (shownMax <= max * 0.7) {
        const ids = top.map(o => o.p.id);
        const up = within.filter(o => ids.indexOf(o.p.id) < 0 && o.sum > shownMax && (!hasTags(fl) || matches(o.p, fl)))
                         .sort((x, y) => y.sum - x.sum)[0];
        if (up) {
          state.pending = { kind: 'upgrade', items: [{ id: up.p.id, g: n, why: whyOne(up, fl, b, 1) }] };
          await ask('upgrade', 'Это заметно ниже вашего потолка в ' + money(max) + '. Если хочется чего-то поинтереснее, есть вариант за ' + money(up.sum) + ' — показать?');
          return 'pending';
        }
        await say('Все варианты заметно ниже вашего потолка в ' + money(max) + '.');
      }
    }
    return 'ok';
  }

  function totalNote(w, n) {
    const r = w / exactKg(n);
    if (r < 1.25) return 'как раз ' + onN(n);
    if (r < 1.5) return onN(n) + ' с запасом';
    return 'это больше, чем нужно ' + onWho(n) + ' (около ' + kg(exactKg(n)) + ') — так выходит из-за минимального веса тортов';
  }

  /* 6 — несколько тортов: одна строка итога с суммой и весом */
  async function showSet(c, title) {
    const f = F(), k = c.set.length, n = f.guests, max = f.budget && f.budget.max;
    if (!title) await say('Предлагаю ' + CAKES_WORD[k] + ', каждый ' + onN(c.g) + ':');
    recs(c.set.map((o, i) => ({ id: o.p.id, g: c.g, why: whySlot(o, c.slots[i], i) })), title);
    let line = cap(CAKES_WORD[k]) + ': ' + c.set.map(o => num(o.sum)).join(' + ') + ' = ' + money(c.sum) +
               ', вместе ' + kg(c.w) + ' — ' + totalNote(c.w, n) + '.';
    if (max) line += ' Бюджет ' + money(max) + (c.sum <= max ? ', укладываемся.' : ' — выходит больше на ' + money(c.sum - max) + '.');
    await say(line);
  }

  async function presentCombo(k, title) {
    const f = F(), max = f.budget && f.budget.max;
    const flv = f.flavorAny ? [] : f.flavors;
    const all = combos(f.guests, k, flv, f.occasion);
    if (!all.length) { await say('Столько разных подходящих тортов в каталоге нет — подберу из того, что есть.'); return presentSingle(false, title); }
    const within = max ? all.filter(c => c.sum <= max) : all;
    if (within.length) { await showSet(within[0], title); return 'ok'; }

    // не влезло: число тортов не меняем сами — спрашиваем
    const cheap = all.slice().sort((x, y) => x.sum - y.sum)[0];
    let j = 0;
    for (let t = k - 1; t >= 1 && !j; t--) {
      const ok = t === 1 ? pickSingle(f.guests, flv[0], f.occasion, false).some(o => o.sum <= max)
                         : combos(f.guests, t, flv, f.occasion).some(c => c.sum <= max);
      if (ok) j = t;
    }
    if (j) {
      state.pending = { kind: 'fewer', k: k, j: j };
      await ask('fewer', cap(CAKES_WORD[k]) + ' в ' + budgetLabel(f.budget) + ' не укладываются — самый доступный набор выходит ' + money(cheap.sum) +
                         '. ' + cap(CAKES_WORD[j]) + ' укладывается. Показать набор или подобрать меньше тортов?');
      return 'pending';
    }
    state.pending = { kind: 'over', set: cheap.set.map(o => o.p.id), k: k };
    await ask('over', 'Самый доступный набор — ' + money(cheap.sum) + '. Это ' + (cheap.sum <= max * 1.25 ? 'чуть ' : '') +
                      'выше вашего бюджета. Могу показать его или пересобрать на меньшее число тортов.');
    return 'pending';
  }

  async function finish() {
    state.pending = null;
    await ask('done');
  }

  async function resolvePending(kind, v) {
    const p = state.pending, f = F();
    state.pending = null; save();
    if (!p) return finish();
    if (v === 'no') {
      await say(kind === 'upgrade' ? 'Хорошо, остаёмся на этом.' : 'Хорошо. Если захотите посмотреть другие варианты — я здесь.');
      return ask('done');
    }
    // человек хотел несколько тортов, но в бюджет не влезло — пересобираем на меньше
    if (p.kind === 'over' && v === 'fewer') {
      if (p.k <= 2) return recount(1);
      state.pending = { kind: 'recount', k: p.k };
      return ask('recount', 'Хорошо. На сколько пересобрать?');
    }
    if (p.kind === 'recount') return recount(Number(v));
    if (p.kind === 'over') {
      if (p.items) recs(p.items);
      else {
        const g = Math.ceil(f.guests / p.k);
        const set = p.set.map(id => option(ALL.find(x => x.id === id), g));
        const slots = []; for (let i = 0; i < p.k; i++) slots.push(f.flavors[i] || 'any');
        await showSet({ set: set, slots: slots, g: g, sum: set.reduce((t, o) => t + o.sum, 0), w: set.reduce((t, o) => t + o.w, 0) });
      }
      return finish();
    }
    if (p.kind === 'upgrade') { recs(p.items); return finish(); }
    if (p.kind === 'short') { f.shortChoice = v; save(); return present(); }
    if (p.kind === 'fewer') {
      if (v === 'many') {
        const cheap = combos(f.guests, p.k, f.flavorAny ? [] : f.flavors, f.occasion).sort((x, y) => x.sum - y.sum)[0];
        await showSet(cheap);
        return finish();
      }
      f.cakes = p.j; f.cakesExplicit = true; save();             // человек сам согласился на меньше
      await say('Хорошо, подберу ' + CAKES_WORD[p.j] + '.');
      return present();
    }
    return finish();
  }

  async function recount(n) {
    const f = F();
    f.cakes = Math.max(1, n); f.cakesExplicit = true;            // человек сам выбрал меньше
    if (f.cakes === 1) f.flavors = f.flavors.slice(0, 1);
    save();
    await say('Хорошо, пересоберу: ' + CAKES_WORD[f.cakes] + '.');
    return present();
  }

  /* 5.6 — про цену спросили сразу: отвечаем, а не уходим от ответа */
  async function answerPrice() {
    const f = F();
    if (!f.guests) {
      f.askedPrice = true;
      state.asked.guests = true;
      await say('Торты у нас от ' + money(P_MIN) + ' до ' + money(P_MAX) + ' — зависит от веса и сложности. Подскажете, на сколько человек? Тогда назову точнее.');
      state.ask = 'guests'; save();
      return chips(chipsFor('guests'));
    }
    const sums = pickSingle(f.guests, null, f.occasion, false).map(o => o.sum);
    await say('В каталоге торты от ' + money(P_MIN) + ' до ' + money(P_MAX) + '. ' + cap(onN(f.guests)) +
              ' подходящие выходят примерно от ' + money(Math.min.apply(null, sums)) + ' до ' + money(Math.max.apply(null, sums)) + '.');
    return reask();
  }

  async function explainDiff() {
    const f = F(), n = f.guests, c = compare(n, 2), half = money(c.each * MED_KG), diff = Math.round(c.sumMany - c.sumOne);
    f.diffShown = true; save();
    await say('Считаю по средней цене тортов в каталоге. ' +
              'Один торт ' + onN(n) + ': ' + kg(c.one) + ' — около ' + money(c.sumOne) + '. ' +
              'Два торта по ' + kg(c.each) + ': ' + half + ' + ' + half + ' = ' + money(c.sumMany) + '. ' +
              (diff > 0 ? 'Разница — около ' + money(diff) + '.' : 'Разницы по весу нет.') +
              ' Точная сумма зависит от того, какие торты выберем. Решать вам.');
    return ask('plan2');
  }

  /* 2.2 / 2.3 — не поняли: коротко, без повтора; второй раз подряд — кнопками */
  /* реплика из вариантов — первая, что не совпадает с предыдущей: не молчим и не повторяемся дословно */
  const sayOneOf = list => say(list.find(t => t !== lastBot()) || list[0] + ' ');
  const idle = () => /^(start|browse|done)$/.test(state.ask);
  const BAKER = 'Про это лучше спросить кондитера — я помогаю с выбором торта.';

  /* 6 — не знаем ответа: честно и с выходом */
  async function toBaker(topic) {
    state.misses = 0;
    const head = topic ? 'Про ' + topic + ' лучше спросить кондитера — я помогаю с выбором торта.' : BAKER;
    if (idle()) {
      await sayOneOf([head + ' Подобрать?', head + ' Подобрать вам торт?']);
      return chips([['Подобрать торт', 'choose'], ['Сколько стоит', 'price']]);
    }
    await sayOneOf([head + ' Продолжим?', head + ' Вернёмся к подбору?']);
    return reask();
  }

  /* непонятное: «не уловил» — только один раз подряд, дальше кнопки и честный выход */
  async function miss() {
    state.misses++;
    save();
    if (state.misses === 1) await sayOneOf(['Не уловил — уточните, пожалуйста.', 'Не совсем понял — переформулируете?']);
    else if (state.misses === 2) await sayOneOf(['Давайте кнопками, так быстрее.', 'Проще выбрать кнопкой — так быстрее.']);
    else await sayOneOf([BAKER + ' Нажмите кнопку — так быстрее.', 'Я лучше всего понимаю про торты: гости, вкус, бюджет. Выберите кнопку.']);
    chips(idle() ? [['Подобрать торт', 'choose'], ['Сколько стоит', 'price']] : chipsFor(state.ask));
  }

  /* 7 — странные сообщения */
  const EMOJI_ONLY = s => /\p{Extended_Pictographic}/u.test(s) && !/[\p{L}\p{N}]/u.test(s);
  function gibberish(t) {
    const flat = t.replace(/\s+/g, '');
    if (!/[a-zа-яё]/i.test(flat)) return true;                               // только знаки и цифры без смысла
    if (/(.)\1{3,}/.test(flat)) return true;                                // «аааааа», «??????»
    const words = t.split(/\s+/).filter(w => /[a-zа-яё]/i.test(w));
    const real = words.filter(w => /[аеёиоуыэюяaeiouy]/i.test(w) && !/[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz]{5,}/i.test(w));
    return real.length === 0;
  }
  /* вопрос «не про торты»: осмысленная фраза (несколько слов или вопрос), а не набор букв */
  const offTopicQuestion = (t, raw) => !gibberish(t) && !INTENT.domain.test(t) &&
                                        (/\?/.test(raw) || t.split(/\s+/).filter(Boolean).length >= 2);

  /* ═════════════════════════ ВВОД ═════════════════════════ */

  async function onChip(v, label, echo) {
    me(label, echo);
    state.misses = 0;
    const f = F();
    const [kind, arg] = v.indexOf(':') > -1 ? v.split(':') : [v, ''];

    if (v === 'reset') return restart();
    if (v === 'choose') return ask('guests', 'Давайте подберу. Для начала — примерно сколько человек будет?');
    if (v === 'price') return answerPrice();
    if (v === 'browse') return ask('browse');
    if (v === 'more') return ask('guests_more');
    if (v === 'unsure') return ask('guests_unsure');
    if (v === 'diff') return explainDiff();
    if (v === 'g10') { setGuests(10, true); await say('Хорошо, буду считать примерно на 10 человек — потом уточним.'); return next(); }
    if (v.indexOf('g~') === 0) { const n = +v.slice(2); setGuests(n, true); await say(confirmLine({ guests: n, approx: true })); return next(); }
    if (kind === 'g') { setGuests(+arg, false); return next(); }
    if (kind === 'c') { setCakes(+arg); return next(); }
    if (kind === 'p') {
      if (arg === 'tiered') { f.cakes = 1; f.cakesExplicit = true; f.tiered = true; }
      else if (arg === 'both') { f.cakes = 3; f.both = true; }
      else setCakes(3);
      save();
      return next();
    }
    if (kind === 'm') { if (arg === 'one') setCakes(1); else f.mismatchOk = true; save(); return next(); }
    if (kind === 'f') {
      if (arg === 'any') {
        if (state.ask === 'flavor2') f.flavors[1] = 'any';
        else { f.flavorAny = true; if (multi()) await say('Хорошо, тогда подберу разные сам.'); }
      } else setFlavors([arg]);
      if (state.ask === 'flavor2' && f.cakes >= 3) await say('Остальные возьму из хитов каталога — другими тортами, не повторяя первые два.');
      save();
      return next();
    }
    if (kind === 'b') {
      setBudget({ lt3: { max: 3000 }, '3-6': { min: 3000, max: 6000 }, gt6: { min: 6000 } }[arg] || null);
      save();
      return next();
    }
    if (kind === 's') return resolvePending('short', arg);
    if (kind === 'o') return resolvePending('over', arg === 'show' || arg === 'fewer' ? arg : 'no');
    if (kind === 'rc') return resolvePending('recount', arg);
    if (kind === 'u') return resolvePending('upgrade', arg === 'show' ? 'show' : 'no');
    if (kind === 'fw') return resolvePending('fewer', arg);
    if (kind === 'cl') return applyClarify(arg);
  }

  async function applyClarify(what) {
    const p = state.pending, v = p.vals.shift(), c = {};
    if (what === 'g') { setGuests(clampG(v), false); c.guests = clampG(v); }
    else if (what === 'c') { setCakes(v); c.cakes = v; }
    else { const b = { max: v < 100 ? v * 1000 : v }; setBudget(b); c.budget = b; }
    state.pending = p.vals.length ? p : null;
    save();
    await say(confirmLine(c));
    if (state.pending) return ask('clarify', 'А ' + num(state.pending.vals[0]) + ' — это гости, торты или бюджет?');
    return next();
  }

  async function onText(raw, echo) {
    const text = clip(raw);
    if (!text) return;
    me(text, echo);
    const t = norm(text), st = state.ask, f = F();

    if (EMOJI_ONLY(text)) {
      await sayOneOf(['Смайлики я пока не понимаю — напишите словами или выберите кнопку.',
                      'Красиво! Но лучше словами — или выберите кнопку.']);
      return chips(idle() ? [['Подобрать торт', 'choose'], ['Сколько стоит', 'price']] : chipsFor(state.ask));
    }

    if (INTENT.restart.test(t)) return restart();

    // честные ответы на «не про выбор»
    if (INTENT.contacts.test(t))    { state.misses = 0; await say('Это демо-сайт, реальные контакты владелец заполнит сам.'); return reask(); }
    if (INTENT.composition.test(t)) return toBaker('состав, аллергены и хранение');
    if (INTENT.discount.test(t))    return toBaker('скидки и акции');
    if (INTENT.lead.test(t))        return toBaker('сроки, предоплату и отмену');

    const x = extract(text, st);
    const c = {};             // что нового поняли — для строки «Понял: …»
    let handled = false;

    // ── ответы на текущий вопрос, которые не числа ──
    if ((st === 'guests' || st === 'guests_unsure') && x.unsure && x.guests == null) {
      if (st === 'guests_unsure') { setGuests(10, true); await say('Хорошо, буду считать примерно на 10 человек — потом уточним.'); state.misses = 0; return next(); }
      state.misses = 0;
      return ask('guests_unsure');
    }
    if (/^guests/.test(st) && x.guests == null && x.guestsMore == null) {
      const approx = /небольш|семья|семьей|узк|пара друзей|немного|маленьк/.test(t) ? 6 : /средн/.test(t) ? 12 : /больш|много|застол|толп/.test(t) ? 25 : 0;
      if (approx) { x.guests = approx; x.guestsApprox = true; }
    }
    if (x.guestsMore != null && x.guests == null) {
      if (x.guestsMore >= 30) { x.guests = x.guestsMore + 10; x.guestsApprox = true; }
      else { state.misses = 0; return ask('guests_more'); }
    }
    if (st === 'plan2' && /дорож|разниц|насколько/.test(t)) { state.misses = 0; return explainDiff(); }
    if (st === 'plan2' && x.cakes == null) {
      if (/давай|оба|двумя|два/.test(t)) x.cakes = 2;
      else if (/один|одним|одного|большой/.test(t)) x.cakes = 1;
    }
    if (st === 'plan3' && x.cakes == null) {
      if (/вид|фото|эффект|ярус|красив/.test(t)) { f.cakes = 1; f.cakesExplicit = true; f.tiered = true; handled = true; }
      else if (/оба|обоих/.test(t)) { f.cakes = 3; f.both = true; handled = true; }
      else if (/вкус|разн|несколько/.test(t)) x.cakes = 3;
    }
    if (st === 'mismatch') {
      if (/остав|да(?![а-я])|так и|верно|точно/.test(t) && x.cakes == null) { f.mismatchOk = true; handled = true; }
    }
    if ((st === 'flavor1' || st === 'flavor2') && !x.flavors.length && x.any) {
      if (st === 'flavor2') f.flavors[1] = 'any'; else f.flavorAny = true;
      handled = true;
    }
    if (st === 'flavor2' && x.flavors.length === 1 && x.flavors[0] === f.flavors[0]) {
      state.misses = 0;
      await say('Этот вкус уже есть — второй возьмём другой, чтобы был выбор.');
      return chips(chipsFor('flavor2'));
    }
    if (st === 'budget' && !x.budget && (x.skip || x.any || x.unsure)) { setBudget(null); handled = true; }
    if (st === 'clarify' && state.pending) {
      const what = /гост|человек|люд/.test(t) ? 'g' : /торт/.test(t) ? 'c' : /руб|₽|бюдж|тыс|денег|сумм/.test(t) ? 'b' : '';
      if (what) { state.misses = 0; return applyClarify(what); }
    }
    if (/^(over|upgrade|short|fewer)$/.test(st) && state.pending && !x.guests && !x.cakes && !x.budget) {
      if (x.yes) { state.misses = 0; return resolvePending(st, st === 'short' ? 'add' : st === 'fewer' ? 'fewer' : 'show'); }
      if (x.no)  { state.misses = 0; return resolvePending(st, 'no'); }
      if (st === 'short' && /только/.test(t)) { state.misses = 0; return resolvePending('short', 'only'); }
    }

    // ── факты из сообщения — независимо от текущего шага ──
    if (x.cakes != null && setCakes(x.cakes)) c.cakes = x.cakes;
    if (x.guests != null && setGuests(x.guests, x.guestsApprox)) { c.guests = x.guests; c.approx = x.guestsApprox; }
    if (x.budget) { setBudget(x.budget); c.budget = F().budget; }
    if (x.occasion && x.occasion !== f.occasion) { f.occasion = x.occasion; c.occasion = x.occasion; f.shortChoice = null; }
    if (x.flavors.length) {
      const before = f.flavors.join();
      setFlavors(x.flavors);
      f.flavorAny = false;
      if (f.flavors.join() !== before) c.flavors = x.flavors.filter(k => f.flavors.indexOf(k) > -1);
    }
    const learned = Object.keys(c).length > 0;
    save();

    // несколько чисел, и часть без опорных слов — спрашиваем, а не угадываем
    if (x.ambiguous.length) {
      state.misses = 0;
      if (learned) await say(confirmLine(c));
      state.pending = { kind: 'clarify', vals: x.ambiguous.slice() };
      return ask('clarify', 'Не уверен, к чему относится ' + num(x.ambiguous[0]) + ' — это гости, торты или бюджет?');
    }

    if (learned || handled) {
      state.misses = 0;
      if (learned) await say(confirmLine(c));
      return next();
    }

    // ── остальное ──
    if (INTENT.price.test(t)) { state.misses = 0; return answerPrice(); }
    if (INTENT.choose.test(t) && (st === 'start' || st === 'browse' || st === 'done')) {
      state.misses = 0;
      if (st === 'done') return restart();
      return ask('guests', 'Давайте подберу. Для начала — примерно сколько человек будет?');
    }
    if (INTENT.thanks.test(t)) { state.misses = 0; await say('Пожалуйста! Если что-то ещё — пишите.'); return chips(chipsFor(state.ask)); }
    if (INTENT.hello.test(t))  { state.misses = 0; await say('Здравствуйте! Помочь выбрать торт?'); return chips(chipsFor(state.ask)); }
    if (offTopicQuestion(t, text)) return toBaker();
    return miss();
  }

  /* ═════════════════════════ НАДЁЖНОСТЬ ═════════════════════════
     Каждое действие человека идёт через run():
     — любой сбой ловится, в чат идёт обычная фраза и кнопки, подробности — в console.error;
     — если ответ не начался за 8 с — «Что-то долго. Попробуем ещё раз?» + «Повторить»;
     — в finally всегда снимаются «думает» и блокировка поля ввода.
     Таймаут пригодится, когда вместо сценария подключат настоящую модель. */
  const TIMEOUT_MS = 8000;
  const TIMED_OUT = {};
  const hooks = { slow: 0, boom: false };        // только для тестов: задержка и искусственный сбой
  let active = null, lastAction = null;

  function exec(a) {
    switch (a.kind) {
      case 'text':  return onText(a.v, a.echo);
      case 'chip':  return onChip(a.v, a.label, a.echo);
      case 'reset': return restart();
      case 'start': return ask('start');
      case 'retry':                                    // сообщение человека уже в чате
        return lastAction ? exec(Object.assign({}, lastAction, { echo: false })) : ask('start');
    }
  }

  async function recover() {
    state.pending = null;
    state.ask = 'start';
    save();
    await say('Что-то я задумался. Давайте проще — что подбираем?', true);
    chips([['Подобрать торт', 'choose'], ['Сколько стоит', 'price'], ['Начать заново', 'reset']], true);
  }
  async function slowReply() {
    await say('Что-то долго. Попробуем ещё раз?', true);
    chips([['Повторить', 'retry']], true);
  }
  /* запасной вывод, если не сработал даже say() — без него человек остался бы перед пустотой */
  function lastResort() {
    try {
      hideThinking();
      const el = document.createElement('div');
      el.className = 'msg msg--bot';
      el.textContent = 'Что-то я задумался. Давайте проще — что подбираем?';
      log.append(el);
      chipsRow([['Подобрать торт', 'choose'], ['Сколько стоит', 'price'], ['Начать заново', 'reset']], false);
      toBottom();
    } catch (e) { console.error('[assistant]', e); }
  }

  function run(action) {
    const user = action.kind === 'text' || action.kind === 'chip';
    if (user) lastAction = action;
    return enqueue(async () => {
      const cur = active = { started: false, dead: false };
      zombie = false;
      input.setAttribute('aria-busy', 'true');
      let timer = 0;
      try {
        // сообщение человека появляется сразу — даже если дальше что-то сломается
        if (user && action.echo !== false) {
          const label = action.kind === 'text' ? clip(action.v) : clip(action.label);
          if (!label) return;                            // пустое и одни пробелы — просто ничего не отправляем
          me(label, true);
          action = Object.assign({}, action, { echo: false, v: action.kind === 'text' ? label : action.v });
          lastAction = action;
        } else if (action.kind === 'retry') {
          showThinking();
        }
        const work = (async () => {
          if (hooks.slow) await wait(hooks.slow);         // здесь будет запрос к настоящей модели
          if (cur.dead) return;                            // время вышло — это действие уже отменено
          if (hooks.boom) { hooks.boom = false; throw new Error('test: искусственный сбой'); }
          return exec(action);
        })();
        const timeout = new Promise(res => {
          timer = setTimeout(function check() {
            if (!cur.started) res(TIMED_OUT);
            else timer = 0;                              // ответ уже пошёл — ждём его до конца
          }, TIMEOUT_MS);
        });
        const r = await Promise.race([work, timeout]);
        if (r === TIMED_OUT) {
          cur.dead = true;                               // отменяем: продолжения не будет
          zombie = true;                                 // поздний ответ этого действия не покажем
          work.catch(err => console.error('[assistant] после таймаута:', err));
          active = null;
          hideThinking();
          await slowReply();
        }
      } catch (err) {
        console.error('[assistant]', err);
        cur.dead = true;
        active = null;
        zombie = true;                                   // недоделанный ответ не допечатываем
        hideThinking();
        try { await recover(); } catch (e2) { console.error('[assistant]', e2); lastResort(); }
      } finally {
        clearTimeout(timer);
        if (active === cur) active = null;
        hideThinking();
        busy = false;
        input.disabled = false;                          // поле ввода никогда не остаётся заблокированным
        input.removeAttribute('aria-busy');
      }
    });
  }

  /* ───────────────────────── события чата ───────────────────────── */
  log.addEventListener('click', e => {
    const chip = e.target.closest('.chip-btn');
    if (chip && !chip.closest('.is-done')) {
      chip.closest('.chips').classList.add('is-done');        // второй клик по этому ряду уже не пройдёт
      if (chip.dataset.val === 'retry') run({ kind: 'retry' });
      else run({ kind: 'chip', v: chip.dataset.val, label: chip.textContent, echo: true });
      return;
    }
    const rec = e.target.closest('.rec');
    if (rec) {
      MK.openProduct(rec.dataset.id, rec, Number(rec.dataset.w) || undefined);   // в карточке выбран тот же вес
      if (window.innerWidth <= 620) closeChat(false);
    }
  });

  $('#mkForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value;
    if (!v.trim()) return;
    input.value = '';
    run({ kind: 'text', v: v, echo: true });   // пока бот печатает — сообщение ждёт своей очереди
  });

  function restart() {
    state = fresh();
    log.innerHTML = '';
    try { localStorage.removeItem(LS_KEY); } catch (err) {}
    return ask('start');
  }
  $('#mkReset').addEventListener('click', () => run({ kind: 'reset' }));
  $('#mkClose').addEventListener('click', () => closeChat());

  /* ───────────────────────── открытие / закрытие ───────────────────────── */
  let started = false, closeT = 0;

  function openChat() {
    hideHint();
    aiBtn.classList.remove('is-pulse');
    lsSet(OPENED_KEY, '1');
    clearTimeout(closeT);
    chat.classList.remove('is-closing');
    chat.hidden = false;
    document.body.classList.add('mk-chat-open');
    aiBtn.setAttribute('aria-expanded', 'true');
    setFan(false);
    if (!started) {
      started = true;
      let restored = false;
      if (load()) {
        try {
          state.entries.forEach(renderEntry);
          const last = state.entries[state.entries.length - 1];
          $$('.chips', log).forEach((row, i, rows) => {
            if (!(last && last.r === 'chips' && i === rows.length - 1)) row.classList.add('is-done');
          });
          toBottom();
          restored = true;
        } catch (e) {
          console.error('[assistant] не удалось показать историю — начинаем заново', e);
          log.innerHTML = '';
          state = fresh();
          try { localStorage.removeItem(LS_KEY); } catch (e2) {}
        }
      }
      if (!restored) run({ kind: 'start' });
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
  // кнопка в герое «Подобрать торт с помощником»
  document.addEventListener('click', e => { if (e.target.closest('[data-open-ai]')) { e.preventDefault(); openChat(); } });

  /* ───────── 6.1 / 6.2 — облачко через 8 с и пульсация, пока помощника не открывали ───────── */
  const hint = $('#mkHint');
  let hintT = 0;
  function showHint() {
    hint.hidden = false;
    requestAnimationFrame(() => hint.classList.add('is-on'));
    lsSet(HINT_KEY, '1');                              // показываем один раз
  }
  function hideHint() {
    clearTimeout(hintT);
    if (hint.hidden) return;
    hint.classList.remove('is-on');
    if (reduced()) hint.hidden = true;
    else setTimeout(() => { hint.hidden = true; }, 220);
  }
  // на телефоне облачко перекрыло бы кнопку героя «Подобрать торт с помощником» — ждём, пока она уйдёт с экрана
  const heroAiVisible = () => {
    const b = window.innerWidth <= 620 && document.querySelector('.hero [data-open-ai]');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };
  const busyScreen = () => !chat.hidden || fan.classList.contains('is-open') || heroAiVisible() ||
                           document.querySelector('.modal:not([hidden]), .cart:not([hidden]), .sheet:not([hidden])');
  function tryHint() {
    if (lsGet(HINT_KEY) || lsGet(OPENED_KEY)) return;
    if (busyScreen()) { hintT = setTimeout(tryHint, 3000); return; }   // не перекрываем открытое окно — ждём
    showHint();
  }
  if (!lsGet(OPENED_KEY)) {
    aiBtn.classList.add('is-pulse');
    if (!lsGet(HINT_KEY)) hintT = setTimeout(tryHint, 8000);
  }
  $('.ai-hint__t', hint).addEventListener('click', openChat);
  $('.ai-hint__x', hint).addEventListener('click', () => { hideHint(); aiBtn.focus(); });

  /* ───────────────────────── веер соцсетей ───────────────────────── */
  const fan = $('#mkFan'), socBtn = $('#mkSocBtn');
  const items = $$('.fan__item', fan);
  const N = items.length;

  /* Дуга идёт от «влево-вниз» через «вверх» к «вверх-вправо» — сколько позволяют края экрана.
     Радиус 110px; если при нём между кнопками меньше 12px — радиус чуть растёт. */
  function layoutFan() {
    const r = socBtn.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, half = FAN_ITEM / 2;
    const capH = window.innerWidth <= 620 ? 18 : 4;          // на телефоне под кнопкой всегда подпись
    const right = window.innerWidth - cx - half - 4, down = window.innerHeight - cy - half - capH - 4;
    const deg = x => x * 180 / Math.PI, clamp = x => Math.max(-1, Math.min(1, x));
    let R = FAN_R, from = 180, to = 270;
    for (; R <= 140; R += 2) {
      from = 180 - deg(Math.asin(clamp(down / R)));
      to = 270 + deg(Math.asin(clamp(right / R)));
      const step = (to - from) / (N - 1);
      if (2 * R * Math.sin(step * Math.PI / 360) >= FAN_ITEM + FAN_GAP) break;
    }
    items.forEach((el, i) => {
      const a = (from + (to - from) * (i / (N - 1))) * Math.PI / 180;
      el.style.setProperty('--x', (Math.cos(a) * R).toFixed(1) + 'px');
      el.style.setProperty('--y', (Math.sin(a) * R).toFixed(1) + 'px');
    });
  }
  layoutFan();
  window.addEventListener('resize', layoutFan);

  items.forEach((el, i) => {
    el.addEventListener('click', ev => {
      ev.preventDefault();
      setFan(false);
      toast('Демо: ссылка на ' + SOCIALS[i].name + ' не настроена');
    });
  });

  function setFan(open) {
    if (open && !chat.hidden) closeChat(false);
    if (open) { layoutFan(); hideHint(); }
    fan.classList.toggle('is-open', open);
    socBtn.setAttribute('aria-expanded', String(open));
    items.forEach((el, i) => {
      el.style.transitionDelay = (open ? i : (N - 1 - i)) * STAGGER + 'ms';
      el.tabIndex = open ? 0 : -1;
    });
  }
  socBtn.addEventListener('click', e => { e.stopPropagation(); setFan(!fan.classList.contains('is-open')); });
  document.addEventListener('click', e => { if (!fan.contains(e.target)) setFan(false); });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (fan.classList.contains('is-open')) { setFan(false); socBtn.focus(); return; }
    const m = $('#modal');
    if (m && m.hidden === false) return;
    if (!chat.hidden) closeChat();
  }, true);

  const toast = text => MK.toast(text);

  /* наружу — для отладки и тестов */
  window.MKChat = {
    streamText: streamText, open: openChat, close: closeChat, reset: restart,
    _t: { extract, parseAmount, tokenize, pickSingle, combos, whyOne, whySlot, sizeNote, option, compare, P_MIN, P_MAX, INTENT,
          send: onText, chip: onChip, state: () => state, run: run, hooks: hooks, idle: () => chain }
  };
})();
