-- 20.10.2026: ретро-бонус партнера (взаємозалік, % від відвантажень). MasterZoo: 5 % (взаємозалік 24.06.2026,
-- «Ретро-бонус 5 % від замовлень», МойСклад, вихідний платіж 00340). Зменшує нашу виручку з кожної пачки в аналізі й калькуляторі.
ALTER TABLE mkt_partners ADD COLUMN retro_pct REAL;
UPDATE mkt_partners SET retro_pct = 5, note = COALESCE(note, '') || ' · ретро-бонус 5 % (взаємозалік)' WHERE name = 'MasterZoo' AND retro_pct IS NULL;
