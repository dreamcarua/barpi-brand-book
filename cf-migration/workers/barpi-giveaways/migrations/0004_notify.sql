-- Barpi Giveaways 1.5.0 (27.11.2026): журнал надісланих сповіщень у Telegram, щоб нагадування не повторювались.
CREATE TABLE IF NOT EXISTS gw_notify (
  key TEXT PRIMARY KEY,           -- напр. ended:12, ship:2026-11-28, hello
  at INTEGER NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0 -- у скільки чатів пішло
);
