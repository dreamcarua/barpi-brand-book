-- Barpi Giveaways 1.2.0 (27.11.2026): гонка за лайки, спосіб вибору для кожного подарунка, статистика поста.
-- Виконується один раз (ALTER TABLE ADD COLUMN не повторюється).
ALTER TABLE gw_pool ADD COLUMN like_count INTEGER;
ALTER TABLE gw_winners ADD COLUMN method TEXT NOT NULL DEFAULT 'random';  -- random | top_likes
ALTER TABLE gw_winners ADD COLUMN likes INTEGER;                           -- лайків на момент фіксації (для top_likes)
ALTER TABLE gw_giveaways ADD COLUMN media_stats TEXT;                      -- JSON: likes, comments, reach, saved, shares, total_interactions, views, at
