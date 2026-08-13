-- Baseline для колонки, которую добавляли в базу руками и миграцией не оформили.
--
-- G7: подтверждён ли артист админом. Парсеры создают найденных артистов с
-- verified=false — они попадают во вкладку «Новые» и ждут подтверждения.
-- DEFAULT true нужен для существующих строк и для артистов, заведённых вручную.
--
-- Дыру нашёл `prisma migrate deploy` на пустой базе: schema.prisma объявляла поле,
-- а цепочка миграций его не создавала. На проде колонка уже есть, поэтому
-- IF NOT EXISTS — там это no-op.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "User_role_verified_idx" ON "User"("role", "verified");
