-- История запусков парсеров: SQLite (parsing_history) -> Postgres.
-- Причина: SQLite-файлы лежат на эфемерном диске Timeweb и стираются при
-- ребилде, плюс требуют нативный sqlite3 (см. F-PARS-3, F-PARS-10, F-PARS-11).

CREATE TABLE "ParserRun" (
    "id" TEXT NOT NULL,
    "parserType" TEXT NOT NULL,
    "artists" TEXT NOT NULL,
    "playlistsFound" INTEGER NOT NULL DEFAULT 0,
    "playlistsAdded" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ParserRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParserRun_parserType_startedAt_idx" ON "ParserRun"("parserType", "startedAt");
CREATE INDEX "ParserRun_status_idx" ON "ParserRun"("status");
CREATE INDEX "ParserRun_startedAt_idx" ON "ParserRun"("startedAt");

-- Server-only таблица: закрываем от PostgREST (anon/authenticated),
-- как остальные таблицы в 20260609120000_enable_rls_server_only.
ALTER TABLE "ParserRun" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ParserRun" FROM anon, authenticated;
