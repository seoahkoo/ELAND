import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  calcKpi, calcBrandSummary, calcProductSummary,
  calcWeeklyTrend, calcCategorySummary,
} from '@/lib/analytics'
import type { SalesWeekly } from '@/types'

/**
 * GET /api/summary?weeks=2026-W08,...&brands=애니바디,...
 *
 * 5,662개 원본 행을 서버에서 집계한 뒤 요약본만 반환합니다.
 * 응답 크기: ~20KB (원본 대비 ~200배 축소)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const weeks  = searchParams.get('weeks')
  const brands = searchParams.get('brands')

  // 집계에 필요한 컬럼만 선택 (select * 대신) → 응답 크기 대폭 축소
  let query = supabase
    .from('sales_weekly')
    .select([
      'week_label', 'brand', 'category_l', 'category_m',
      'style_code', 'product_name', 'cum_sale_rate',
      'period_sale_qty', 'period_sale_amt', 'period_receipt_amt', 'period_cost_amt',
      'cum_sale_qty', 'cum_sale_amt', 'cum_receipt_amt', 'cum_cost_amt',
    ].join(','))
    .limit(50000)

  if (weeks)  query = query.in('week_label', weeks.split(','))
  if (brands) query = query.in('brand',      brands.split(','))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as SalesWeekly[]

  return NextResponse.json({
    kpi:        calcKpi(rows),
    brands:     calcBrandSummary(rows),
    categories: calcCategorySummary(rows),
    products:   calcProductSummary(rows).slice(0, 200),
    trend:      calcWeeklyTrend(rows),
    rowCount:   rows.length,
  })
}
