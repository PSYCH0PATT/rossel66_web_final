import type { SessionUser } from '@/lib/server-auth'

/**
 * Куда ведёт «домой» из кабинета (F-95).
 *
 * Артист на админском роуте упирался в ненайденную страницу Next — по-английски
 * и без единой ссылки. Проверка доступа правильная, тупик — нет: у пользователя
 * всегда есть свой кабинет, и путь туда считается здесь, одинаково для 404 и
 * для любого другого «отсюда некуда идти».
 */
export function dashboardHomeHref(session: SessionUser | null): string {
  if (!session) return '/dashboard/login'
  if (session.role === 'admin') return '/dashboard/admin/dashboard'
  return `/dashboard/artist/${session.username}/dashboard`
}
