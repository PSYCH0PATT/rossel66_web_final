import * as React from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

/**
 * Страница «здесь ничего нет» для кабинета (F-95).
 *
 * Артист, открывший админский адрес, упирался в стандартную заглушку Next:
 * «404 | This page could not be found.» — по-английски, без брендинга и без
 * единой ссылки. Доступ закрыт правильно, а вот тупик — нет: объясняем
 * по-русски и даём дорогу обратно в свой кабинет.
 */
export function DashboardNotFound({ homeHref }: { homeHref: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <img src="/images/logo.png" alt="Rossel Music" className="h-8 w-auto object-contain" />

      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-gray-500">Ошибка 404</p>
        <h1 className="text-2xl font-bold text-white">Страница не найдена</h1>
        <p className="max-w-md text-sm text-gray-400">
          Такого раздела нет или он доступен только другой роли. Всё, что открыто вам, — в вашем
          кабинете.
        </p>
      </div>

      <Button asChild variant="cta">
        <Link href={homeHref}>Вернуться в кабинет</Link>
      </Button>
    </div>
  )
}
