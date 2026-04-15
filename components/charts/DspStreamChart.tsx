"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <defs>
          {dsps.map((dsp, i) => (
            <linearGradient key={`color-${i}`} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DSP_COLORS[i % DSP_COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={DSP_COLORS[i % DSP_COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickFormatter={formatDate} tickLine={false} axisLine={false} />
        <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} width={40} tickLine={false} axisLine={false} />
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
          <Area
            key={dsp}
            type="monotone"
            dataKey={dsp}
            stroke={DSP_COLORS[i % DSP_COLORS.length]}
            fill={`url(#color-${i})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#1f2937", strokeWidth: 2 }}
            isAnimationActive={false}
            style={(dsp === "Яндекс Музыка" || i === 0) ? { filter: `drop-shadow(0 0 8px ${DSP_COLORS[i % DSP_COLORS.length]}80)` } : {}}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
