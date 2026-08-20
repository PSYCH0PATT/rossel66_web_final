import { mskDateString } from "@/lib/msk-date"

/**
 * Дефолтная «сегодняшняя» дата для форм кабинета (F-67).
 *
 * Считается по Москве, а не по часовому поясу браузера: рабочий день компании,
 * кварталы отчётов и ключи пайплайна аналитики живут в Europe/Moscow
 * (см. lib/msk-date.ts). Прежний расчёт через getTimezoneOffset() открывал
 * форму аванса завтрашним числом у любого зрителя восточнее МСК, и эта дата
 * уходила в базу: от неё lib/advance.ts решает, какие отчёты гасят аванс.
 */
export function todayIso(now: Date = new Date()): string {
  return mskDateString(now)
}
