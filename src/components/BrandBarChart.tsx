'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { BrandSummary } from '@/types'

interface Props {
  data: BrandSummary[]
  metric: 'cum_sale_amt' | 'margin_amt' | 'margin_rate'
}

const COLORS = [
  '#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444',
  '#06b6d4','#84cc16','#f97316','#ec4899','#6366f1',
]

export default function BrandBarChart({ data, metric }: Props) {
  const top10 = data.slice(0, 10)

  const chartData = top10.map((b) => ({
    name: b.brand,
    value: metric === 'margin_rate'
      ? Math.round(b.margin_rate * 10) / 10
      : Math.round((b[metric] as number) / 10000),
  }))

  const unit = metric === 'margin_rate' ? '%' : '만원'

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 50, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v.toLocaleString()}${unit}`}
        />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}${unit}`, '']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
