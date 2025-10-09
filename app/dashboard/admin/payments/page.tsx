"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DollarSign, Calendar, CheckCircle, XCircle, FileText, Loader2, Filter } from "lucide-react"

interface Payment {
  id: string
  reportId: string
  artistId: string
  artistName: string
  quarter: string
  year: number
  amount: number
  date: string
  isPaid: boolean
  isSigned: boolean
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unpaid'>('all')

  const fetchPayments = async () => {
    try {
      console.log('Загружаем выплаты...')
      const response = await fetch('/api/payments')
      const result = await response.json()
      
      if (result.success) {
        console.log('Загружено выплат:', result.payments.length)
        setPayments(result.payments)
      }
    } catch (error) {
      console.error('Ошибка при загрузке выплат:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
    
    // Обновляем данные каждые 10 секунд для синхронизации с отчетами
    const interval = setInterval(() => {
      fetchPayments()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const handlePaymentStatusUpdate = async (reportId: string, isPaid: boolean) => {
    console.log(`Обновляем статус выплаты для отчета ${reportId} на ${isPaid}`)
    
    try {
      const response = await fetch('/api/reports/update-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          statusType: 'paid',
          value: isPaid
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка при обновлении статуса')
      }

      console.log(`Статус выплаты успешно обновлен для отчета ${reportId}`)

      // Обновляем локальное состояние
      setPayments(prevPayments => prevPayments.map(payment => {
        if (payment.reportId === reportId) {
          return { ...payment, isPaid }
        }
        return payment
      }))
    } catch (error) {
      console.error('Ошибка при обновлении статуса выплаты:', error)
      alert(`Ошибка при обновлении статуса выплаты: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Фильтруем выплаты по выбранному фильтру
  const filteredPayments = payments.filter(payment => {
    switch (filter) {
      case 'unpaid':
        return !payment.isPaid
      default:
        return true
    }
  })

  // Group filtered payments by year
  const paymentsByYear = filteredPayments.reduce((acc, payment) => {
    if (!acc[payment.year]) {
      acc[payment.year] = []
    }
    acc[payment.year].push(payment)
    return acc
  }, {} as Record<number, Payment[]>)

  // Sort years in descending order
  const years = Object.keys(paymentsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  if (isLoading) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">Загрузка выплат...</span>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Выплаты</h1>
          <div className="text-sm text-slate-400">
            Показано: {filteredPayments.length} из {payments.length} выплат
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilter('all')}
            style={{
              backgroundColor: filter === 'all' ? '#10b981' : 'transparent',
              borderColor: filter === 'all' ? '#10b981' : '#64748b',
              color: filter === 'all' ? 'white' : '#cbd5e1'
            }}
            onMouseEnter={(e) => {
              if (filter !== 'all') {
                e.currentTarget.style.backgroundColor = '#334155'
                e.currentTarget.style.color = 'white'
              }
            }}
            onMouseLeave={(e) => {
              if (filter !== 'all') {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#cbd5e1'
              }
            }}
          >
            Все выплаты
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilter('unpaid')}
            style={{
              backgroundColor: filter === 'unpaid' ? '#f97316' : 'transparent',
              borderColor: filter === 'unpaid' ? '#f97316' : '#64748b',
              color: filter === 'unpaid' ? 'white' : '#cbd5e1'
            }}
            onMouseEnter={(e) => {
              if (filter !== 'unpaid') {
                e.currentTarget.style.backgroundColor = '#334155'
                e.currentTarget.style.color = 'white'
              }
            }}
            onMouseLeave={(e) => {
              if (filter !== 'unpaid') {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#cbd5e1'
              }
            }}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Невыплаченные ({payments.filter(p => !p.isPaid).length})
          </Button>
        </div>

        {filteredPayments.length === 0 ? (
          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">
              {filter === 'unpaid' ? 'Нет невыплаченных выплат' : 'Нет выплат'}
            </h2>
            <p className="text-slate-400">
              {filter === 'unpaid' 
                ? 'Все выплаты обработаны' 
                : 'Выплаты появятся автоматически после создания отчетов для зарегистрированных артистов.'
              }
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {years.map((year) => (
              <div key={year} className="space-y-4">
                <h2 className="text-xl font-semibold text-white">{year}</h2>

                <div className="space-y-3">
                  {paymentsByYear[year].map((payment) => (
                    <Card key={payment.id} className="bg-transparent border-slate-600/30 hover:border-slate-500/50 transition-colors text-white rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-slate-700/30">
                              <FileText className="h-5 w-5 text-green-400" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-white">
                                Выплата за {payment.quarter} {payment.year}
                              </h4>
                              <p className="text-sm text-slate-400">Артист: {payment.artistName}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4 text-slate-400" />
                                  <span className="text-xs text-slate-400">
                                    {new Date(payment.date).toLocaleDateString('ru-RU')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {payment.isSigned ? (
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-400" />
                                  )}
                                  <span className="text-xs text-slate-400">
                                    {payment.isSigned ? "Подписан" : "Не подписан"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xl font-bold text-white">
                                {Math.floor(payment.amount).toLocaleString()} ₽
                              </div>
                              <div className="text-xs text-slate-400">
                                {payment.isPaid ? "Выплачено" : "Не выплачено"}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {payment.isPaid ? (
                                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                )}
                                <Label htmlFor={`paid-${payment.id}`} className="text-slate-300 whitespace-nowrap">
                                  Выплачено
                                </Label>
                              </div>
                              <Switch
                                id={`paid-${payment.id}`}
                                checked={payment.isPaid}
                                onCheckedChange={(checked) => handlePaymentStatusUpdate(payment.reportId, checked)}
                                style={{
                                  backgroundColor: payment.isPaid ? '#10b981' : '#475569',
                                  border: '1px solid #64748b'
                                }}
                              />
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
        )}
      </div>
    </Layout>
  )
}
