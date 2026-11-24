/* ============================================================
   Журнал модели: последние 20 обменов помощника с Ollama
   (localStorage, ключ mk-llm-log — пишет js/assistant.js).
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'mk-llm-log';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const time = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') + ', ' +
                           d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  function read() {
    try { const l = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(l) ? l : []; }
    catch (e) { return []; }
  }

  function render() {
    const list = read().slice().reverse();
    const fall = list.filter(e => e.fallback).length, filt = list.filter(e => e.filter).length;
    $('#logSum').textContent = list.length
      ? 'Записей: ' + list.length + ' · ответила модель: ' + (list.length - fall) + ' · фильтр: ' + filt + ' · откат: ' + (fall - filt)
      : '';
    if (!list.length) {
      $('#logList').innerHTML = '<p class="col__empty">Пока пусто. Задайте помощнику пару вопросов на сайте, открытом на этом компьютере с запущенной Ollama.</p>';
      return;
    }
    $('#logList').innerHTML = list.map(e => {
      const kind = e.filter ? 'filter' : e.fallback ? 'fallback' : 'ok';
      const badge = kind === 'ok' ? 'ответила модель' : kind === 'filter' ? 'фильтр: ' + esc(e.filter) : 'откат: ' + esc(e.fallback);
      const facts = e.sent && e.sent.facts ? JSON.stringify(e.sent.facts) : '';
      return '<details class="llog__item llog__item--' + kind + '">' +
        '<summary>' +
          '<span class="llog__t">' + time(e.at) + (e.ms ? ' · ' + (e.ms / 1000).toFixed(1) + ' с' : '') + (e.tries > 1 ? ' · попыток: ' + e.tries : '') + '</span>' +
          '<b class="llog__q">' + esc(e.q) + '</b>' +
          '<span class="llog__badge">' + badge + '</span>' +
          (e.reply ? '<span class="llog__r">' + esc(e.reply) + '</span>' : '') +
          (e.cakes && e.cakes.length ? '<span class="llog__c">торты: ' + esc(e.cakes.join(', ')) + '</span>' : '') +
        '</summary>' +
        '<div class="llog__more">' +
          (facts ? '<p><b>Отправили:</b> последних реплик — ' + esc(e.sent.messages) + ', факты — <code>' + esc(facts) + '</code></p>' : '') +
          (e.understood ? '<p><b>Модель поняла:</b> <code>' + esc(JSON.stringify(e.understood)) + '</code></p>' : '') +
          (e.dropped && e.dropped.length ? '<p><b>Выброшены несуществующие id:</b> ' + esc(e.dropped.join(', ')) + '</p>' : '') +
          (e.stripped ? '<p><b>Из ответа вырезаны числа</b> с ₽, кг или порциями.</p>' : '') +
          (e.raw && e.raw.length ? e.raw.map((r, i) => '<p><b>Сырой ответ' + (e.raw.length > 1 ? ' №' + (i + 1) : '') + ':</b></p><pre>' + esc(r) + '</pre>').join('')
                                 : '<p>Модель не вызывалась.</p>') +
        '</div>' +
      '</details>';
    }).join('');
  }

  $('#logRefresh').addEventListener('click', render);
  $('#logClear').addEventListener('click', () => {
    try { localStorage.removeItem(KEY); } catch (e) {}
    render();
  });
  window.addEventListener('storage', e => { if (e.key === KEY) render(); });   // помощник в соседней вкладке
  render();
})();
