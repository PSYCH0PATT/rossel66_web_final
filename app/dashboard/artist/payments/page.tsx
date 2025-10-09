import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getArtistPayments, getTotalEarnings } from "@/lib/data"
import { DollarSign, TrendingUp, Calendar, CheckCircle, Clock } from "lucide-react"

export default function PaymentsPage() {
  // В реальном приложении ID артиста будет получен из сессии
  const artistId = "1" // Это нужно будет заменить на получение ID из сессии
  const payments = getArtistPayments(artistId)
  const totalEarnings = getTotalEarnings(artistId)

  // Группировка выплат по годам
  const paymentsByYear = payments.reduce(
    (acc, payment) => {
      if (!acc[payment.year]) {
        acc[payment.year] = []
      }
      acc[payment.year].push(payment)
      return acc
    },
    {} as Record<number, typeof payments>,
  )

  // Сортировка годов в порядке убывания
  const years = Object.keys(paymentsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  // Расчет заработка по кварталам для текущего года
  const currentYear = new Date().getFullYear()
  const quarterlyEarnings = [0, 0, 0, 0] // Q1, Q2, Q3, Q4

  payments.forEach((payment) => {
    if (payment.year === currentYear) {
      const quarter = Number.parseInt(payment.quarter.substring(1)) - 1
      quarterlyEarnings[quarter] = payment.amount
    }
  })

  return (
    <Layout role="artist" requiredRole="artist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Выплаты</h1>

        {payments.length > 0 ? (
          <>
            {/* Карточка общего заработка */}
            <Card className="bg-card border-border text-card-foreground rounded-xl">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-category-amber/10">
                    <DollarSign className="h-5 w-5 text-category-amber" />
                  </div>
                  <span className="text-white">Общий заработок</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4">{totalEarnings.toLocaleString()} ₽</div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-400">Заработок по кварталам ({currentYear})</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {quarterlyEarnings.map((amount, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-xl bg-accent/50 flex flex-col items-center justify-center"
                      >
                        <span className="text-sm text-gray-400">Q{index + 1}</span>
                        <span className="text-xl font-bold">{amount.toLocaleString()} ₽</span>
                      </div>
                    ))}
                  </div>

                  <div className="h-64 bg-accent/50 rounded-xl p-4 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-gray-400">
                      <TrendingUp className="h-5 w-5" />
                      <span>График заработка по кварталам</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* История выплат */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-category-amber/10">
                  <DollarSign className="h-5 w-5 text-category-amber" />
                </div>
                <span className="text-white">История выплат</span>
              </h2>

              {years.map((year) => (
                <div key={year} className="space-y-4">
                  <h3 className="text-lg font-medium text-white">{year}</h3>

                  <div className="space-y-3">
                    {paymentsByYear[year]
                      .sort((a, b) => {
                        // Сортировка по кварталам (Q1, Q2, Q3, Q4)
                        const quarterA = Number.parseInt(a.quarter.substring(1))
                        const quarterB = Number.parseInt(b.quarter.substring(1))
                        return quarterB - quarterA
                      })
                      .map((payment) => (
                        <Card key={payment.id} className="bg-card border-border text-card-foreground rounded-xl">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {payment.status === "completed" ? (
                                  <div className="p-1.5 rounded-lg bg-category-green/20">
                                    <CheckCircle className="h-5 w-5 text-category-green" />
                                  </div>
                                ) : (
                                  <div className="p-1.5 rounded-lg bg-category-amber/20">
                                    <Clock className="h-5 w-5 text-category-amber" />
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-medium text-white">
                                    Выплата за {payment.quarter} {payment.year}
                                  </h4>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>{new Date(payment.date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xl font-bold text-white">{payment.amount.toLocaleString()} ₽</div>
                                <div className="text-xs text-muted-foreground">
                                  {payment.status === "completed" ? "Выплачено" : "В обработке"}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-card border-border text-card-foreground rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">У вас пока нет выплат</h2>
            <p className="text-muted-foreground">
              Здесь будут отображаться ваши выплаты после их создания и обработки в системе.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
