-- C4: один отчёт на (artistId, quarter, year).
-- Шаг 1 (защитный): убираем возможные дубли, оставляя ПОСЛЕДНИЙ загруженный
--   (max uploadedAt, при равенстве — max id). Только для зарегистрированных
--   отчётов (artistId IS NOT NULL); NULL в уникальном индексе считаются различными,
--   поэтому неназначенные отчёты не ограничиваются.
DELETE FROM "Report" a
USING "Report" b
WHERE a."artistId" IS NOT NULL
  AND a."artistId" = b."artistId"
  AND a."quarter" = b."quarter"
  AND a."year" = b."year"
  AND (
    a."uploadedAt" < b."uploadedAt"
    OR (a."uploadedAt" = b."uploadedAt" AND a."id" < b."id")
  );

-- Шаг 2: уникальный индекс, предотвращающий дубли на уровне БД.
CREATE UNIQUE INDEX "Report_artistId_quarter_year_key"
  ON "Report" ("artistId", "quarter", "year");
