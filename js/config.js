/* ============================================================
   Подключение базы Supabase.

   Пока поля пустые — сайт работает в ДЕМО-режиме: заказы хранятся
   только в браузере, админка показывает примеры.

   Чтобы подключить базу:
   1. Supabase → Project Settings → API (или «Connect»):
      — Project URL       → SUPABASE_URL
      — anon / publishable key → SUPABASE_ANON_KEY
   2. Сохранить файл и обновить страницу.

   Ключ anon — публичный, его можно держать в коде сайта: права
   ограничены схемой (supabase/schema.sql).
   НИКОГДА не вставляйте сюда ключ service_role / secret.
   ============================================================ */
window.MK_CONFIG = {
  /* ИИ-помощник:
     'auto'   — сайт открыт на этом компьютере (localhost) и Ollama запущена с моделью OLLAMA_MODEL →
                отвечает модель; иначе (и всегда на опубликованном сайте) — встроенный сценарий;
     'local'  — всегда пробовать модель (при сбое всё равно ответит сценарий);
     'script' — только сценарий.
     Чтобы Ollama принимала запросы со страницы, нужна переменная
     OLLAMA_ORIGINS="https://neuralcoderdan.github.io,http://localhost:*" (см. README). */
  AI_MODE: 'auto',
  OLLAMA_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'qwen2.5:7b',

  SUPABASE_URL: 'https://fmiaxvroehkmpquxzatn.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaWF4dnJvZWhrbXBxdXh6YXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMDQzMDIsImV4cCI6MjExMDg4MDMwMn0.eIGDV_SPzFpSDTwM6sjQM5PlTFNZVgIGkPoNi8UOAFg'
};
