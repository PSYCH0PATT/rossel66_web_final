"use client"

import type { ArtistBalance } from "@/lib/storage"
import { MIN_PAYOUT_AMOUNT, moneyThresholdsHint } from "@/lib/report-acknowledgment"
import { Banner } from "@/components/ui/banner"
import { StatCard } from "@/components/ui/stat-card"

/**
 * Денежная шапка экрана «Отчёты и выплаты» артиста — решение 0-а, артистская
 * половина (docs/ia-decisions.md).
 *
 * Блок переехал сюда целиком с бывшего /payments: три StatCard, карточка аванса
 * и баннер «недостаточно средств». Ничего не потеряно — потерялся только второй
 * экран, который повторял историю отчётов карточка-в-карточку (Б-16).
 *
 * `data-testid` сохранены дословно: на них смотрит tests/e2e/cabinet-advances.spec.ts.
 */

/** Две цифры после запятой — формат баланса; на нём завязаны e2e-проверки. */
function fmt(n: number): string {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ArtistBalanceSummary({
  balance,
  paidAmount,
}: {
  balance: ArtistBalance | null
  paidAmount: number
}) {
  const totalBal = balance?.totalBalance ?? 0
  const avail = balance?.availableForPayout ?? 0

  const advanceTotal = balance?.advanceTotal ?? 0
  const advanceRecouped = balance?.advanceRecouped ?? 0
  const advanceRemaining = balance?.advanceRemaining ?? 0
  const advanceProgress =
    advanceTotal > 0 ? Math.min(100, Math.round((advanceRecouped / advanceTotal) * 100)) : 0

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
        <StatCard
          className="border border-white/5"
          label="Общий баланс"
          icon="currency_ruble"
          tone="primary"
          bgIcon="account_balance_wallet"
          value={
            <span data-testid="total-balance">
              {fmt(totalBal)} <span className="text-sm text-gray-400 font-sans font-normal md:text-lg">₽</span>
            </span>
          }
          footer="Накопленные средства"
        />

        <StatCard
          className="border border-white/5"
          label="Доступно к выплате"
          icon="account_balance"
          tone="warning"
          bgIcon="savings"
          bgIconClassName="text-status-moderation"
          value={
            <span data-testid="available-for-payout">
              {fmt(avail)} <span className="text-sm text-gray-400 font-sans font-normal md:text-lg">₽</span>
            </span>
          }
          footer={<>Минимум: {MIN_PAYOUT_AMOUNT.toLocaleString("ru-RU")}&nbsp;₽</>}
        />

        <StatCard
          className="col-span-2 border border-white/5 md:col-span-2 xl:col-span-1"
          label="Выплачено"
          icon="done_all"
          tone="purple"
          bgIcon="check_circle"
          value={
            <>
              {fmt(paidAmount)} <span className="text-sm text-gray-500 font-sans">₽</span>
            </>
          }
          footer="За всё время"
        />
      </div>

      {/*
        F-17: 500 ₽ жили в хелпере кнопки «Ознакомился», 3 000 ₽ — на карточке
        выплаты, и связи между ними не было ни одной. Теперь оба порога на одном
        экране и объяснены одной строкой; числа берутся из констант.
      */}
      <p className="text-xs leading-relaxed text-gray-500">{moneyThresholdsHint()}</p>

      {advanceTotal > 0 && (
        <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex-shrink-0">
                <span className="material-symbols-outlined text-xl">payments</span>
              </span>
              <div>
                <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-1">Аванс</h3>
                <p className="text-sm text-gray-400 font-light max-w-md">
                  {advanceRemaining > 0
                    ? "Роялти идут в погашение аванса. Как только он будет закрыт, начисления снова станут доступны к выплате."
                    : "Аванс полностью погашен — начисления снова доступны к выплате."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">Выдано</p>
                <p data-testid="advance-total" className="text-xl font-bold text-white font-display tabular-nums">
                  {fmt(advanceTotal)} ₽
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">Погашено</p>
                <p
                  data-testid="advance-recouped"
                  className="text-xl font-bold text-emerald-400 font-display tabular-nums"
                >
                  {fmt(advanceRecouped)} ₽
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">Осталось</p>
                <p
                  data-testid="advance-remaining"
                  className="text-xl font-bold text-orange-400 font-display tabular-nums"
                >
                  {fmt(advanceRemaining)} ₽
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all"
              style={{ width: `${advanceProgress}%` }}
            />
          </div>
          <p data-testid="advance-progress" className="mt-2 text-xs text-gray-500 tabular-nums">
            Погашено {advanceProgress}% аванса
          </p>
        </div>
      )}

      {/* Про минимальную сумму говорим только когда дело действительно в ней:
          при непогашенном авансе к выплате ноль по другой причине, её объясняет
          карточка выше. Сам порог назван строкой о двух порогах — здесь остаётся
          то, чего там нет: сколько накоплено и сколько осталось. */}
      {balance && balance.totalBalance > 0 && balance.availableForPayout === 0 && advanceRemaining === 0 && (
        <Banner variant="warning" icon="info" className="p-4 md:p-5">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Недостаточно средств для выплаты</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              У вас накоплено {fmt(balance.totalBalance)} ₽. Осталось накопить{" "}
              {fmt(Math.max(0, MIN_PAYOUT_AMOUNT - balance.totalBalance))} ₽.
            </p>
          </div>
        </Banner>
      )}
    </>
  )
}
