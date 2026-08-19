"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"

import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { chartXAxisProps, chartYAxisProps } from "@/components/charts/chart-axis"
import { DSP_SERIES_COLORS } from "@/lib/chart-colors"
import { CHART_TOOLTIP_COLORS } from "@/lib/chart-colors"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

interface DspStreamChartProps {
  data: Array<{ date: string; [dsp: string]: string | number }>
  dsps: string[]
  formatDate: (dateStr: any) => string
}

export default function DspStreamChart({ data, dsps, formatDate }: DspStreamChartProps) {
  const isMobile = useMobileDetector()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <defs>
          {dsps.map((dsp, i) => (
            <linearGradient key={`color-${i}`} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DSP_SERIES_COLORS[i % DSP_SERIES_COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={DSP_SERIES_COLORS[i % DSP_SERIES_COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatDate} {...chartXAxisProps({ mobile: isMobile })} />
        <YAxis {...chartYAxisProps()} />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(label) => formatDate(label)}
              showTotal
              totalLabel="Общее"
            />
          }
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
            stroke={DSP_SERIES_COLORS[i % DSP_SERIES_COLORS.length]}
            fill={`url(#color-${i})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: CHART_TOOLTIP_COLORS.background, strokeWidth: 2 }}
            isAnimationActive={false}
            style={(dsp === "Яндекс Музыка" || i === 0) ? { filter: `drop-shadow(0 0 8px ${DSP_SERIES_COLORS[i % DSP_SERIES_COLORS.length]}80)` } : {}}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
