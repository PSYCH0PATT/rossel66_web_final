-- Авансы артистов. Отдельная таблица, а не поле на User: авансов может быть
-- несколько во времени и нужна история выдач.
-- FK не ставим — в этой схеме внешних ключей нет нигде.
CREATE TABLE IF NOT EXISTS "Advance" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Advance_artistId_idx" ON "Advance"("artistId");
CREATE INDEX IF NOT EXISTS "Advance_artistId_issuedAt_idx" ON "Advance"("artistId", "issuedAt");

-- Тот же режим доступа, что у остальных таблиц: только серверный postgres-роль,
-- PostgREST (anon/authenticated) не видит ничего.
ALTER TABLE "Advance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Advance" FROM anon, authenticated;
