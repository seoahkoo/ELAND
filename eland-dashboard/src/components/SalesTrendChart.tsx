'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { WeeklyTrend } from '@/types'

interface Props {
  data: WeeklyTrend[]
}

function fmtAmt(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`
  return v.toLocaleString()
}

export default function SalesTrendChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        데이터가 없습니다.
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: d.week_label,
    '누적판매금액': Math.round(d.cum_sale_amt / 10000),
    '기간판매금액': Math.round(d.period_sale_amt / 10000),
    '마진금액': Math.round(d.margin_amt / 10000),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v.toLocaleString()}만`}
        />
        <Tooltip
          formatter={(value, name) => [`${Number(value).toLocaleString()}만원`, String(name)]}
        />
        <Legend />
        <Line type="monotone" dataKey="누적판매금액" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="기간판매금액" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="마진금액" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  )
}
