'use client'

import { useState } from 'react'
import { BrandSummary, ProductSummary } from '@/types'
import { ChevronUp, ChevronDown } from 'lucide-react'

type Row = BrandSummary | ProductSummary
type SortKey = string

interface ColDef {
  key: string
  label: string
  fmt?: (v: number) => string
  align?: 'left' | 'right'
}

interface Props {
  rows: Row[]
  columns: ColDef[]
  nameKey: string
}

function fmtAmt(v: number) {
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`
  return v.toLocaleString()
}

export { fmtAmt }

export default function RankingTable({ rows, columns, nameKey }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(columns[1]?.key ?? '')
  const [asc, setAsc] = useState(false)

  const sorted = [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey]
    const bv = (b as unknown as Record<string, unknown>)[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') return asc ? av - bv : bv - av
    return 0
  })

  const handleSort = (key: string) => {
    if (sortKey === key) setAsc(!asc)
    else { setSortKey(key); setAsc(false) }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium w-8">#</th>
            <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">{nameKey === 'brand' ? '브랜드' : '상품명'}</th>
            {columns.map((col) => (
              <th
                key={col.key}
                className="py-2 px-3 text-right text-xs text-gray-500 font-medium cursor-pointer hover:text-gray-800 select-none"
                onClick={() => handleSort(col.key)}
              >
                <span className="flex items-center justify-end gap-1">
                  {col.label}
                  {sortKey === col.key ? (
                    asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const r = row as unknown as Record<string, unknown>
            return (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-2 px-3 text-gray-400 text-xs">{idx + 1}</td>
                <td className="py-2 px-3 font-medium text-gray-800">
                  <div>{String(r[nameKey] ?? '-')}</div>
                  {nameKey === 'product_code' && Boolean(r['brand']) && (
                    <div className="text-xs text-gray-400">{String(r['brand'])}</div>
                  )}
                </td>
                {columns.map((col) => {
                  const val = r[col.key]
                  const num = typeof val === 'number' ? val : Number(val)
                  return (
                    <td key={col.key} className="py-2 px-3 text-right text-gray-700">
                      {col.fmt ? col.fmt(num) : fmtAmt(num)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length + 2} className="py-8 text-center text-gray-400 text-sm">데이터가 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
