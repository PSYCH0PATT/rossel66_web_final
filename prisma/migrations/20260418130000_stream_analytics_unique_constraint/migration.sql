-- Удаляем дубликаты по бизнес-ключу (оставляем строку с меньшим id / cuid лексикографически)
DELETE FROM "StreamAnalytics" a
USING "StreamAnalytics" b
WHERE a.id > b.id
  AND a.date = b.date
  AND a.isrc = b.isrc
  AND a.dsp = b.dsp
  AND a.length = b.length
  AND a.source = b.source
  AND a."isMonthlyAggregate" = b."isMonthlyAggregate";

-- Уникальность строки Flash-импорта (дневные и месячные различаются флагом isMonthlyAggregate)
CREATE UNIQUE INDEX IF NOT EXISTS "stream_analytics_flash_row_key"
ON "StreamAnalytics" ("date", "isrc", "dsp", "length", "source", "isMonthlyAggregate");
