"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"

interface TotalStreamChartProps {
  data: Array<{ date: string; streams: number }>
  formatDate: (dateStr: any) => string
}

export default function TotalStreamChart({ data, formatDate }: TotalStreamChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={formatDate} />
        <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
          labelStyle={{ color: "#d1d5db" }}
          labelFormatter={formatDate}
        />
        <Line
          type="monotone"
          dataKey="streams"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="Стримы"
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
