'use client'

import { BrandSummary, ProductSummary } from '@/types'
import { TrendingUp, TrendingDown, Star } from 'lucide-react'

interface Props {
  brands: BrandSummary[]
  products: ProductSummary[]
}

export default function InsightSection({ brands, products }: Props) {
  // 고효율: 판매효율 음수 (판매비중 > 입고비중) + 마진율 양수
  const highEff = [...brands]
    .filter((b) => b.sales_efficiency < 0 && b.margin_rate > 0)
    .sort((a, b) => a.sales_efficiency - b.sales_efficiency)
    .slice(0, 3)

  // 저효율: 판매효율 양수 (입고비중 > 판매비중)
  const lowEff = [...brands]
    .filter((b) => b.sales_efficiency > 0)
    .sort((a, b) => b.sales_efficiency - a.sales_efficiency)
    .slice(0, 3)

  // BEST 상품 TOP5 (누적판매금액 기준)
  const bestProducts = [...products]
    .sort((a, b) => b.cum_sale_amt - a.cum_sale_amt)
    .slice(0, 5)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 고효율 브랜드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-emerald-500" />
          <h3 className="font-semibold text-sm text-gray-800">고효율 브랜드</h3>
          <span className="text-xs text-gray-400">(판매비중 &gt; 입고비중)</span>
        </div>
        {highEff.length === 0 ? (
          <p className="text-sm text-gray-400">데이터 없음</p>
        ) : (
          <div className="space-y-3">
            {highEff.map((b) => (
              <div key={b.brand} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.brand}</p>
                  <p className="text-xs text-gray-400">마진율 {b.margin_rate.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-600">
                    {b.sales_efficiency.toFixed(2)}%p
                  </span>
                  <p className="text-xs text-gray-400">효율지수</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 저효율 브랜드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={16} className="text-red-400" />
          <h3 className="font-semibold text-sm text-gray-800">저효율 브랜드</h3>
          <span className="text-xs text-gray-400">(입고비중 &gt; 판매비중)</span>
        </div>
        {lowEff.length === 0 ? (
          <p className="text-sm text-gray-400">데이터 없음</p>
        ) : (
          <div className="space-y-3">
            {lowEff.map((b) => (
              <div key={b.brand} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.brand}</p>
                  <p className="text-xs text-gray-400">마진율 {b.margin_rate.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-red-500">
                    +{b.sales_efficiency.toFixed(2)}%p
                  </span>
                  <p className="text-xs text-gray-400">효율지수</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BEST 상품 TOP5 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star size={16} className="text-amber-500" />
          <h3 className="font-semibold text-sm text-gray-800">BEST 상품 TOP5</h3>
        </div>
        {bestProducts.length === 0 ? (
          <p className="text-sm text-gray-400">데이터 없음</p>
        ) : (
          <div className="space-y-3">
            {bestProducts.map((p, i) => (
              <div key={p.product_code} className="flex items-start gap-2">
                <span className="text-xs font-bold text-amber-500 w-4 shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.style_name || p.product_code}</p>
                  <p className="text-xs text-gray-400">{p.brand} · {p.category_l}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-gray-700">
                    {p.cum_sale_amt >= 100_000_000
                      ? `${(p.cum_sale_amt / 100_000_000).toFixed(1)}억`
                      : `${Math.round(p.cum_sale_amt / 10000).toLocaleString()}만`}
                  </p>
                  <p className="text-xs text-gray-400">{p.margin_rate.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
