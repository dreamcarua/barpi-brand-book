// =====================================================================
// Barpi HQ — Стіл SMM
// Конфігурація бекенду
//
// ВАЖЛИВО: цей файл містить лише ПУБЛІЧНІ ключі (anon — read-only
// до публічних даних, RLS-захищений). Service-role key зберігається
// ТІЛЬКИ в Edge Functions secrets, не тут.
//
// Supabase проект: barpi-hq (id zrcqmwlpsggiqgipvxhv, eu-central-1)
// =====================================================================

window.HQ_CONFIG = {
  // ---- Supabase ----
  SUPABASE_URL:      'https://zrcqmwlpsggiqgipvxhv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3Ftd2xwc2dnaXFnaXB2eGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzcyMTYsImV4cCI6MjA5NTUxMzIxNn0.ROzbQ6aGRs-9rDVIDv0UyzlrvBRWFmFMQ7n77bLALmY',

  // ---- Telegram bot (поки не налаштовано) ----
  TG_BOT_USERNAME: '',  // напр. 'barpi_team_bot' — створити через @BotFather
  TG_LOGIN_BOT:    '',  // /setdomain dreamcarua.github.io у @BotFather
  TG_BOT_TOKEN:    '',  // bot токен — НЕ ставити сюди у production (тримати в Edge Function secrets)
  TG_GROUP_CHAT:   '',  // chat_id групи Barpi-команди

  // ---- AI Copy Assistant (опціонально) ----
  HQ_AI_SECRET:    '',
  DEFAULT_BRAND:   'barpi',

  // ---- Поведінка ----
  // true = показати кнопку «Demo» в логіні (можна заходити без OAuth)
  // Поки що корисно для перевірки UX перед налаштуванням Google OAuth.
  ALLOW_DEMO_FALLBACK: true,
};
