"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"

const DSP_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
]

interface DspStreamChartProps {
  data: Array<{ date: string; [dsp: string]: string | number }>
  dsps: string[]
  formatDate: (dateStr: any) => string
}

function CustomTooltip({ active, payload, label, formatDate }: any) {
  if (!active || !payload?.length || !label) return null
  const total = payload.reduce((s: number, p: any) => s + (Number(p.value) || 0), 0)
  return (
    <div style={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", padding: "10px 12px" }}>
      <div style={{ color: "#d1d5db", marginBottom: "6px", fontWeight: 600 }}>
        {formatDate(label)}
      </div>
      <div style={{ color: "#fff", marginBottom: "4px" }}>
        Общее: {total.toLocaleString("ru-RU")}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontSize: "12px" }}>
          {p.name} : {(Number(p.value) || 0).toLocaleString("ru-RU")}
        </div>
      ))}
    </div>
  )
}

export default function DspStreamChart({ data, dsps, formatDate }: DspStreamChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={formatDate} />
        <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          content={<CustomTooltip formatDate={formatDate} />}
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
          labelStyle={{ color: "#d1d5db" }}
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
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
