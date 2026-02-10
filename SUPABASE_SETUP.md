# Подробная инструкция: интеграция Supabase (PostgreSQL)

Вы уже зарегистрированы и создали проект. Дальше — по шагам.

---

## Шаг 1. Получить строку подключения в Supabase

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard) и выберите ваш проект.
2. Слева откройте **Project Settings** (иконка шестерёнки внизу).
3. В меню слева выберите **Database**.
4. В блоке **Connection string** выберите вкладку **URI**.
5. Скопируйте строку вида:
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. Замените `[YOUR-PASSWORD]` на пароль пользователя `postgres` (если забыли — в том же разделе есть **Reset database password**).

Для **миграций Prisma** лучше использовать **прямое** подключение (не через pooler):

- В **Connection string** переключитесь на **Session mode** (или найдите **Direct connection**).
- Либо замените в URI порт `6543` на `5432` и хост на что-то вроде `db.[ref].supabase.co` (точный хост смотрите в разделе **Connection info**).

Итог: у вас будет две переменные (или одна — см. ниже):

- `DATABASE_URL` — для приложения (можно pooler, порт 6543).
- `DIRECT_URL` — для `prisma migrate` (порт 5432, direct).

Если используете один URI с портом 5432 (direct), миграции и приложение могут работать с одной и той же `DATABASE_URL`.

---

## Шаг 2. Добавить переменные в проект

1. В корне проекта откройте или создайте файл **`.env.local`** (для Next.js).
2. Добавьте (подставьте свою строку и пароль):

```env
# Supabase PostgreSQL
DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

Если Supabase показывает один URI для **Direct connection**, можно пока задать только:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

И в Prisma schema использовать один и тот же URL для `url` и `directUrl` (см. ниже).

3. Добавьте `.env.local` в `.gitignore`, если его там ещё нет (чтобы пароль не попал в репозиторий).

---

## Шаг 3. Установить Prisma

В корне проекта выполните:

```bash
npm install prisma @prisma/client --save
npx prisma init
```

Появится папка `prisma` и файл `prisma/schema.prisma`.

---

## Шаг 4. Схема БД (Prisma)

Откройте **`prisma/schema.prisma`** и замените содержимое на:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
// Если у вас только DATABASE_URL (direct), используйте:
// datasource db {
//   provider  = "postgresql"
//   url       = env("DATABASE_URL")
// }

model User {
  id         String   @id  // без @default — при миграции из JSON подставляем старые id ("2", "user_1759...")
  username   String   @unique
  name       String
  email      String   @default("")
  role       String   // "admin" | "artist"
  password   String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  avatarUrl  String?
  vkMusicUrl String?
  yandexMusicUrl String?
  spotifyUrl String?
  fio        String?
  fioShort   String?
  contract   String?
  percentage Int?

  reports    Report[]
  activities Activity[]
}

model Release {
  id                String   @id  // без @default — при миграции из JSON подставляем старые id (release_1759...)
  title             String
  artistId          String
  releaseDate       String
  type              String?  // single | album | ep
  coverUrl          String?
  upc               String?
  status            String?
  koalaId           String?
  bandlinkUrl       String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  // Треки и доп. поля храним как JSON (как у вас сейчас)
  tracks            Json     @default("[]")
  featuredArtistIds String[] @default([])
  featuredArtistNames String[] @default([])
  // Произвольные поля из парсеров (artistName, genre, zvonko_data и т.д.)
  metadata          Json?

  @@index([artistId])
  @@index([koalaId])
}

model Report {
  id           String   @id  // без @default — при миграции подставляем старые id
  quarter      String
  artistId     String?
  artistName   String
  fileName     String
  filePath     String
  uploadedAt   DateTime @default(now())
  processed    Boolean  @default(true)
  year         Int?
  totalPlays   Int?
  totalAmount  Float?
  isPaid       Boolean?
  isSigned     Boolean?
  isRegistered Boolean?
  status       String?
  uploadDate   String?
  fileUrl      String?

  @@index([artistId])
  @@index([quarter])
}

model Activity {
  id          String   @id  // без @default — при миграции подставляем старые id (Date.now().toString())
  type        String
  userId      String?
  userRole    String   // "artist" | "admin"
  title       String
  description String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([userRole])
  @@index([createdAt])
}
```

Важно:

- У вас в коде `User.id` бывает числовой строкой (`"2"`, `"25"`) или `user_1759011689584`. В схеме ниже для всех моделей указано `id String @id` **без** `@default(cuid())`, чтобы при переносе данных подставлять ваши текущие id из JSON. Тогда ссылки (artistId, userId и т.д.) останутся корректными.
- При создании **новых** записей после миграции в коде нужно самим задавать `id`, например `id: Date.now().toString()` или `id: crypto.randomUUID()` / nanoid, как вы делали в `storage.ts`.

---

## Шаг 5. Создать таблицы в Supabase (миграция)

В корне проекта:

```bash
npx prisma migrate dev --name init
```

Введите имя миграции, например `init`. Prisma создаст таблицы в вашей БД Supabase.

Если будет ошибка подключения:

- Проверьте `DIRECT_URL` (порт 5432, без `?pgbouncer=true`).
- В Supabase: **Project Settings → Database → Connection pooling** — для миграций нужен **Session** (direct), не Transaction.

После успешного выполнения появится папка `prisma/migrations` и таблицы в Supabase. В дашборде Supabase: **Table Editor** — должны быть таблицы `User`, `Release`, `Report`, `Activity`.

---

## Шаг 6. Сгенерировать Prisma Client

После каждой смены схемы запускайте:

```bash
npx prisma generate
```

Использовать в коде:

```ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

В Next.js лучше создать синглтон, чтобы не плодить соединения при hot reload. Например, в `lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Дальше везде импортировать `prisma` из `@/lib/prisma`.

---

## Шаг 7. Перенос данных из JSON в Supabase (одноразово)

Пока приложение ещё читает из `data/*.json`, можно один раз заполнить БД из этих файлов.

Идея:

1. Прочитать `data/users.json`, `data/releases.json`, `data/reports.json`, `data/activities.json`.
2. Преобразовать записи в формат таблиц (например, `tracks` и лишние поля релиза — в `metadata` или в поле `tracks` как JSON).
3. Вставить в БД через `prisma.user.createMany`, `prisma.release.createMany` и т.д. (или по одной записи, если нужны старые id).

Пример для пользователей (сохраняем старые id):

```ts
const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'))
for (const u of users) {
  await prisma.user.create({
    data: {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email || '',
      role: u.role,
      password: u.password,
      createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
      updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
      avatarUrl: u.avatarUrl ?? undefined,
      vkMusicUrl: u.vkMusicUrl ?? undefined,
      yandexMusicUrl: u.yandexMusicUrl ?? undefined,
      spotifyUrl: u.spotifyUrl ?? undefined,
      fio: u.fio ?? undefined,
      fioShort: u.fioShort ?? undefined,
      contract: u.contract ?? undefined,
      percentage: u.percentage ?? undefined,
    },
  })
}
```

Для релизов: маппинг полей, `tracks` передать как `JSON.stringify(release.tracks)` или как объект (Prisma сам сериализует в JSON/JSONB). Дополнительные поля вроде `artistName`, `genre`, `zvonko_data` можно положить в `metadata`.

Такой скрипт удобно сделать в `scripts/migrate-to-supabase.ts` и запустить один раз: `npx ts-node scripts/migrate-to-supabase.ts` (или через `tsx`). После успешного переноса можно переключить приложение на чтение/запись только из Supabase.

---

## Шаг 8. Переключить приложение на Supabase

Сейчас данные читаются и пишутся в `lib/storage.ts` через `loadUsers()`, `saveUsers()`, `loadReleases()` и т.д.

Варианты:

### Вариант A. Заменить реализацию внутри `lib/storage.ts`

- Оставить те же экспорты (`loadUsers`, `getUserById`, `addUser`, …).
- Внутри каждой функции вместо чтения/записи JSON вызывать `prisma.user.findMany()`, `prisma.user.create()` и т.д.
- Типы (интерфейсы `User`, `Release`, …) можно оставить или постепенно перейти на типы из `Prisma.User`, `Prisma.Release` и т.д.

Плюс: минимум правок в коде (все API и компоненты продолжают импортировать из `@/lib/storage`). Минус: нужно аккуратно переписать все функции.

### Вариант B. Новый слой `lib/db.ts` и постепенное переключение

- Создать `lib/db.ts` с функциями вида `getUsers()`, `getUserById()`, `createUser()`, … поверх Prisma.
- В API-роутах и сервисах по одному переключать импорты с `@/lib/storage` на `@/lib/db`.
- В конце удалить файловую логику из `storage.ts` или оставить её только для бэкапов.

Рекомендация: начать с **варианта A** — заменить в `storage.ts` только низкий уровень (чтение/запись), оставив прежнюю бизнес-логику и сигнатуры функций.

Пример замены для пользователей:

- `loadUsers()` → `return await prisma.user.findMany({ orderBy: { id: 'asc' } })`
- `getUserById(id)` → `return await prisma.user.findUnique({ where: { id } })`
- `addUser(user)` → хеш пароля (как сейчас), затем `prisma.user.create({ data: { ... } })`
- `saveUsers(users)` — больше не нужна при полном переходе на Prisma; обновления делаются через `prisma.user.update()`.

Аналогично для релизов, отчётов и активностей. Для релизов поле `tracks` и доп. данные класть в поля типа `Json`/`metadata`.

---

## Шаг 9. Проверка в Supabase

1. **Table Editor** — убедиться, что данные появились после миграции.
2. **SQL Editor** — выполнить, например: `SELECT id, username, name, role FROM "User" LIMIT 5;`
3. Запустить приложение: `npm run dev`, проверить логин, список артистов, релизов, отчётов.

---

## Важно по безопасности

- Пароль БД храните только в `.env.local` (и на сервере в переменных окружения), не коммитьте в git.
- В Supabase: **Authentication → Policies** — при необходимости настройте RLS (Row Level Security), если позже будете подключать клиентский доступ к БД. Пока доступ только с сервера Next.js по `DATABASE_URL` — RLS можно не трогать.

---

## Краткий чеклист

- [ ] Взять Connection string (URI) в Supabase → Project Settings → Database.
- [ ] Добавить `DATABASE_URL` и при необходимости `DIRECT_URL` в `.env.local`.
- [ ] Установить Prisma: `npm i prisma @prisma/client`, `npx prisma init`.
- [ ] Вписать схему в `prisma/schema.prisma` (User, Release, Report, Activity).
- [ ] Выполнить `npx prisma migrate dev --name init`.
- [ ] Выполнить `npx prisma generate`.
- [ ] Создать `lib/prisma.ts` с синглтоном `prisma`.
- [ ] (Опционально) Написать и запустить скрипт переноса данных из `data/*.json`.
- [ ] Переписать функции в `lib/storage.ts` на вызовы Prisma (или перенести вызовы в `lib/db.ts` и переключить импорты).
- [ ] Проверить приложение и при необходимости отключить запись в JSON / удалить старые вызовы `saveUsers`/`saveReleases` и т.д.

После этого ваша «база» будет в Supabase и не будет сбрасываться при деплое на Timeweb.
