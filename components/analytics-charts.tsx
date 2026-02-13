"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"

const DSP_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
]

interface DspLineChartProps {
  data: Array<{ date: string; [dsp: string]: string | number }>
  dsps: string[]
  formatDate: (dateStr: any) => string
}

export function DspLineChart({ data, dsps, formatDate }: DspLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 40, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={formatDate} />
        <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
          labelStyle={{ color: "#d1d5db" }}
          labelFormatter={formatDate}
        />
        <Legend 
          wrapperStyle={{ 
            fontSize: 'clamp(9px, 2.5vw, 12px)', 
            paddingTop: '12px', 
            paddingBottom: '4px',
            lineHeight: '1.4'
          }} 
          iconSize={10}
        />
        {dsps.map((dsp, i) => (
          <Line
            key={dsp}
            type="monotone"
            dataKey={dsp}
            stroke={DSP_COLORS[i % DSP_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

interface TotalStreamsChartProps {
  data: Array<{ date: string; streams: number }>
  formatDate: (dateStr: any) => string
}

export function TotalStreamsChart({ data, formatDate }: TotalStreamsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 40, bottom: 20 }}>
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
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
