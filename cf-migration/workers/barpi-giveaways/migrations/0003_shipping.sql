-- Barpi Giveaways 1.4.0 (27.11.2026): відправка подарунка переможцю. Лише статус, ТТН і нотатка: адрес і телефонів не зберігаємо.
ALTER TABLE gw_winners ADD COLUMN ship_status TEXT;   -- contact | address | sent | received | refused
ALTER TABLE gw_winners ADD COLUMN ship_ttn TEXT;      -- номер ТТН Нової пошти або іншого перевізника
ALTER TABLE gw_winners ADD COLUMN ship_note TEXT;
ALTER TABLE gw_winners ADD COLUMN ship_by TEXT;
ALTER TABLE gw_winners ADD COLUMN ship_at INTEGER;
