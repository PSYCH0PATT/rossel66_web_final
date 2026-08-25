import type { Prisma } from '@prisma/client'

/**
 * Тестовые учётки: одно правило на всю систему (F-37).
 *
 * В боевом списке артистов висели карточки «test» и учётки прогонов — рядом с
 * живыми артистами, с теми же бейджами. Разовая чистка данных тут не помогает:
 * следующий прогон заводит их заново. Поэтому признак тестовой учётки записан
 * в коде, сид стенда обязан ему соответствовать (проверяется тестом), а список
 * артистов в админке спрашивает данные уже без них.
 *
 * Правило намеренно узкое: только точные логины, префиксы стендов и почтовые
 * домены стенда. Подстрокой не матчим — «testarossa» и «protest» живые.
 */

/** Логины-однословки, которые заводят руками для проверки. */
export const TEST_ACCOUNT_USERNAMES = ['test', 'тест', 'demo', 'qa'] as const

/** Префиксы логинов, которыми пользуются прогоны и стенды. */
export const TEST_ACCOUNT_USERNAME_PREFIXES = ['e2e-', 'e2e_', 'test-', 'test_', 'playwright'] as const

/** Почтовые домены стенда: живой артист такой почты не имеет. */
export const TEST_ACCOUNT_EMAIL_DOMAINS = ['@example.test', '@example.com'] as const

export interface TestAccountCandidate {
  username: string
  email?: string | null
}

export function isTestAccount({ username, email }: TestAccountCandidate): boolean {
  const login = (username ?? '').trim().toLowerCase()
  if (!login) return false

  if ((TEST_ACCOUNT_USERNAMES as readonly string[]).includes(login)) return true
  if (TEST_ACCOUNT_USERNAME_PREFIXES.some((prefix) => login.startsWith(prefix))) return true

  const mail = (email ?? '').trim().toLowerCase()
  if (mail && TEST_ACCOUNT_EMAIL_DOMAINS.some((domain) => mail.endsWith(domain))) return true

  return false
}

/**
 * Фрагмент условия для Prisma: то же правило, но на стороне запроса — чтобы
 * список и счётчики считались по одной выборке и пагинация не «дырявила».
 */
export function excludeTestAccountsWhere(): Prisma.UserWhereInput {
  return {
    NOT: [
      { username: { in: [...TEST_ACCOUNT_USERNAMES], mode: 'insensitive' } },
      ...TEST_ACCOUNT_USERNAME_PREFIXES.map((prefix) => ({
        username: { startsWith: prefix, mode: 'insensitive' as const },
      })),
      ...TEST_ACCOUNT_EMAIL_DOMAINS.map((domain) => ({
        email: { endsWith: domain, mode: 'insensitive' as const },
      })),
    ],
  }
}

/**
 * Прятать ли тестовые учётки в этой выдаче.
 *
 * На стенде их прятать нельзя: там ВСЕ учётки тестовые, и экраны списков стали
 * бы пустыми — под этим стендом снимается визуальный baseline и гоняются
 * прогоны. Поэтому стенд поднимает SHOW_TEST_ACCOUNTS=true (.env.e2e), а бой
 * этой переменной не знает.
 */
export function shouldHideTestAccounts(
  requested: boolean,
  env: { SHOW_TEST_ACCOUNTS?: string | undefined; [key: string]: string | undefined } = process.env
): boolean {
  if (!requested) return false
  return env.SHOW_TEST_ACCOUNTS !== 'true'
}
