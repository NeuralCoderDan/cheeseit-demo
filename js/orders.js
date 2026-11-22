/* ============================================================
   Заказы — общее хранилище для сайта и админки. Два режима:

   • БАЗА (в js/config.js заполнены SUPABASE_URL и SUPABASE_ANON_KEY):
     заказ уходит в Supabase (функция place_order), покупатель видит свои
     заказы по секретному ключу из своего браузера (my_orders), владелец
     после входа видит все заказы и меняет статусы. Схема — supabase/schema.sql.
   • ДЕМО (config пустой): заказы лежат в localStorage этого браузера
     (ключ mk-orders), админка показывает примеры.

   Все функции API асинхронные — одинаково для обоих режимов.

   Статусы: new — новый (предстоит), ready — готов к выдаче,
            done — выдан, cancel — отменён.
   Имена и телефоны в демо не сохраняем — в админке «Покупатель №…».
   В базе они есть, но видит их только владелец (права в схеме).
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'mk-orders';
  const FIRST_NO = 1051;          // примеры занимают №1041–1050, настоящие заказы — дальше
  const STATUSES = ['new', 'ready', 'done', 'cancel'];
  const LABEL = { new: 'Новый', ready: 'Готов к выдаче', done: 'Выдан', cancel: 'Отменён' };

  const products = () => (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []);
  const byId = id => products().find(p => p.id === id);

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(o => o && Number.isFinite(o.no) && Array.isArray(o.items) && STATUSES.indexOf(o.status) > -1);
    } catch (e) {
      console.error('[orders] не читается — начинаем с пустого списка', e);
      return [];
    }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { console.error('[orders]', e); }
    try { window.dispatchEvent(new CustomEvent('mk-orders')); } catch (e) {}
  }
  const nextNo = list => list.reduce((m, o) => Math.max(m, o.no), FIRST_NO - 1) + 1;

  /* ПРИМЕР для показа админки: пожелания — как пишут покупатели к базовому торту */
  function seedExamples() {
    const list = read();
    if (list.some(o => o.example)) return list;
    const h = 3600e3, d = 24 * h, now = Date.now();
    const at = ms => new Date(now - ms).toISOString();
    const ahead = days => { const x = new Date(now + days * d); x.setHours(15, 0, 0, 0); return x.toISOString(); };
    const EX = [
      { no: 1041, st: 'cancel', ago: 5 * d + 3 * h, when: -3, dlv: 'delivery', items: [['basque', 1.5, 1, '']], at: 4 * d + 20 * h },
      { no: 1042, st: 'done',   ago: 4 * d + 2 * h, when: -2, dlv: 'pickup',   items: [['cupcakes-set', 0.9, 2, 'Половину — без посыпки']], at: 2 * d + 5 * h },
      { no: 1043, st: 'done',   ago: 3 * d + 6 * h, when: -1, dlv: 'pickup',   items: [['mango', 1.5, 1, 'Побольше фруктов сверху']], at: 1 * d + 2 * h },
      { no: 1044, st: 'ready',  ago: 2 * d + 4 * h, when: 0,  dlv: 'pickup',   items: [['velvet', 2.5, 1, 'Добавить побольше ягод, надпись «С днём рождения!»']], at: 1 * h },
      { no: 1045, st: 'ready',  ago: 2 * d + 1 * h, when: 0,  dlv: 'delivery', items: [['dino', 2, 1, 'Три фигурки динозавров, зелёный декор']], at: 2 * h },
      { no: 1046, st: 'new',    ago: 1 * d + 5 * h, when: 1,  dlv: 'pickup',   items: [['velvet', 2, 1, 'Меньше крема, больше ягод']], at: 0 },
      { no: 1047, st: 'new',    ago: 20 * h,        when: 2,  dlv: 'delivery', items: [['choco-caramel', 3, 1, 'Добавить шоколадную крошку'], ['bento-love', 0.5, 1, 'Надпись «Спасибо!»']], at: 0 },
      { no: 1048, st: 'new',    ago: 6 * h,         when: 3,  dlv: 'pickup',   items: [['pistachio', 2.5, 1, '']], at: 0 },
      { no: 1049, st: 'cancel', ago: 4 * h,         when: 4,  dlv: 'delivery', items: [['ivory', 5, 1, 'Живые цветы на верхнем ярусе']], at: 1 * h },
      { no: 1050, st: 'new',    ago: 1 * h,         when: 5,  dlv: 'pickup',   items: [['velvet', 1.5, 1, 'Побольше ягод']], at: 0 }
    ];
    const ex = EX.map(e => {
      const items = e.items.map(i => ({ id: i[0], w: i[1], qty: i[2], note: i[3] }));
      return {
        no: e.no, example: true, created: at(e.ago), when: ahead(e.when), dlv: e.dlv,
        items: items, total: items.reduce((s, i) => s + Math.round((byId(i.id) || { perKg: 0 }).perKg * i.w) * i.qty, 0),
        status: e.st, statusAt: e.at ? at(e.at) : at(e.ago)
      };
    });
    // настоящий заказ никогда не затирается примером: при совпадении номера пример пропускаем
    const merged = list.concat(ex.filter(x => !list.some(o => o.no === x.no)));
    write(merged);
    return merged;
  }

  /* оформить заказ из корзины: items = [{id, w, qty, note}] */
  function create(items, opts) {
    const list = read();
    const clean = (items || []).filter(i => byId(i.id) && i.w > 0)
      .map(i => ({ id: i.id, w: Number(i.w), qty: Math.max(1, Math.round(i.qty) || 1), note: String(i.note || '').slice(0, 200) }));
    if (!clean.length) return null;
    const now = new Date().toISOString();
    const order = {
      no: nextNo(list), mine: true, created: now,
      when: opts && opts.when ? new Date(opts.when).toISOString() : null,
      dlv: opts && opts.dlv === 'delivery' ? 'delivery' : 'pickup',
      items: clean,
      total: clean.reduce((s, i) => s + Math.round(byId(i.id).perKg * i.w) * i.qty, 0),
      status: 'new', statusAt: now
    };
    list.push(order);
    write(list);
    return order;
  }

  function setStatus(no, status) {
    if (STATUSES.indexOf(status) < 0) return false;
    const list = read(), o = list.find(x => x.no === no);
    if (!o) return false;
    o.status = status;
    o.statusAt = new Date().toISOString();
    write(list);
    return true;
  }

  function resetExamples() {
    write(read().filter(o => !o.example));
    return seedExamples();
  }

  /* ═════════════════════ РЕЖИМ БАЗЫ (Supabase) ═════════════════════ */
  const CFG = window.MK_CONFIG || {};
  const DB = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  const TOKENS = 'mk-order-tokens';                 // [{no, token}] — «мои заказы» в этом браузере
  let clientP = null;

  function client() {
    if (clientP) return clientP;
    clientP = new Promise((resolve, reject) => {
      const make = () => {
        try {
          resolve(window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mk-auth' }
          }));
        } catch (e) { reject(e); }
      };
      if (window.supabase && window.supabase.createClient) return make();
      const sc = document.createElement('script');
      sc.src = SDK; sc.async = true; sc.crossOrigin = 'anonymous';
      sc.onload = make;
      sc.onerror = () => { clientP = null; reject(new Error('Supabase SDK не загрузился')); };
      document.head.appendChild(sc);
    });
    return clientP;
  }
  const must = r => { if (r.error) throw r.error; return r.data; };

  const tokens = () => {
    try { const t = JSON.parse(localStorage.getItem(TOKENS) || '[]'); return Array.isArray(t) ? t.filter(x => x && x.token) : []; }
    catch (e) { return []; }
  };
  const addToken = (no, token) => {
    const t = tokens().filter(x => x.no !== no).concat([{ no: no, token: token }]).slice(-50);
    try { localStorage.setItem(TOKENS, JSON.stringify(t)); } catch (e) {}
  };

  /* строка базы → заказ в том же виде, что и в демо */
  const fromRow = (r, mine) => ({
    no: Number(r.id != null ? r.id : r.order_no), mine: !!mine,
    created: r.created_at, when: r.receive_at, dlv: r.delivery,
    items: Array.isArray(r.items) ? r.items : [], total: r.total,
    status: r.status, statusAt: r.status_at,
    name: r.customer_name || '', phone: r.customer_phone || '', address: r.address || null
  });

  const dbApi = {
    async create(items, opts) {
      const clean = (items || []).filter(i => byId(i.id) && i.w > 0).map(i => {
        const p = byId(i.id);
        return { id: i.id, name: p.name, w: Number(i.w), qty: Math.max(1, Math.round(i.qty) || 1),
                 price: Math.round(p.perKg * i.w), note: String(i.note || '').slice(0, 200) };
      });
      if (!clean.length) return null;
      opts = opts || {};
      const sb = await client();
      const rows = must(await sb.rpc('place_order', {
        p_items: clean,
        p_total: clean.reduce((s, i) => s + i.price * i.qty, 0),
        p_delivery: opts.dlv === 'delivery' ? 'delivery' : 'pickup',
        p_receive_at: opts.when ? new Date(opts.when).toISOString() : null,
        p_name: opts.name || '', p_phone: opts.phone || '',
        p_address: opts.dlv === 'delivery' ? (opts.address || null) : null
      }));
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || !row.order_no) throw new Error('place_order: пустой ответ');
      addToken(Number(row.order_no), row.order_token);
      window.dispatchEvent(new CustomEvent('mk-orders'));
      return { no: Number(row.order_no), mine: true, status: 'new' };
    },
    async mine() {
      const t = tokens();
      if (!t.length) return [];
      const sb = await client();
      return must(await sb.rpc('my_orders', { p_tokens: t.map(x => x.token) })).map(r => fromRow(r, true));
    },
    async all() {
      const sb = await client();
      return must(await sb.from('orders').select('*').order('id', { ascending: false }).limit(1000)).map(r => fromRow(r, false));
    },
    async setStatus(no, status) {
      if (STATUSES.indexOf(status) < 0) return false;
      const sb = await client();
      must(await sb.from('orders').update({ status: status }).eq('id', no));
      return true;
    },
    async session() {
      const sb = await client();
      const s = must(await sb.auth.getSession());
      return s && s.session ? { email: s.session.user.email } : null;
    },
    async signIn(email, password) {
      const sb = await client();
      const r = await sb.auth.signInWithPassword({ email: email, password: password });
      if (r.error) return { ok: false, reason: /invalid/i.test(r.error.message) ? 'wrong' : 'other' };
      return { ok: true };
    },
    async signOut() { const sb = await client(); await sb.auth.signOut(); },
    async isOwner() {
      const sb = await client();
      const r = await sb.rpc('is_owner');
      return !r.error && r.data === true;
    },
    /* роль вошедшего: 'owner' | 'staff' | null */
    async role() {
      const sb = await client();
      return must(await sb.rpc('my_role')) || null;
    },
    /* кухня: текущие заказы без сумм (база сама убирает цены) */
    async kitchen() {
      const sb = await client();
      return must(await sb.rpc('kitchen_orders')).map(r => {
        const o = fromRow(r, false);
        delete o.total;
        return o;
      });
    },
    /* смена статуса через базу: кондитер — только «готов» и «выдан», отмена — владелец */
    async kitchenStatus(no, status) {
      const sb = await client();
      must(await sb.rpc('set_order_status', { p_no: no, p_status: status }));
      return true;
    }
  };

  const demoApi = {
    async create(items, opts) { return create(items, opts); },
    async mine() { return read().filter(o => o.mine).sort((a, b) => b.no - a.no); },
    async all() { return read(); },
    async setStatus(no, status) { return setStatus(no, status); },
    async session() { return null; },
    async signIn() { return { ok: false, reason: 'demo' }; },
    async signOut() {},
    async isOwner() { return false; },
    async role() { return 'owner'; },               // в демо — показ владельцу
    async kitchen() {
      const day = Date.now() - 864e5;
      return read().filter(o => o.status === 'new' || o.status === 'ready' ||
                                (o.status === 'done' && new Date(o.statusAt).getTime() > day))
                   .map(o => { const c = Object.assign({}, o); delete c.total; return c; });
    },
    async kitchenStatus(no, status) { return setStatus(no, status); }
  };
  const api = DB ? dbApi : demoApi;

  // заказы поменяли в другой вкладке (админка ↔ сайт) — сообщаем странице
  window.addEventListener('storage', e => {
    if (e.key === KEY) { try { window.dispatchEvent(new CustomEvent('mk-orders')); } catch (err) {} }
  });

  window.MKOrders = {
    mode: DB ? 'db' : 'demo',
    all: api.all,
    mine: api.mine,
    create: api.create,
    setStatus: api.setStatus,
    session: api.session,
    signIn: api.signIn,
    signOut: api.signOut,
    isOwner: api.isOwner,
    role: api.role,
    kitchen: api.kitchen,
    kitchenStatus: api.kitchenStatus,
    /* есть ли у этого браузера заказы — без запроса к сети (для пункта меню) */
    hasMine: () => (DB ? tokens().length > 0 : read().some(o => o.mine)),
    seedExamples: () => (DB ? [] : seedExamples()),
    resetExamples: () => (DB ? [] : resetExamples()),
    label: s => LABEL[s] || '',
    product: byId,
    STATUSES: STATUSES
  };
})();
