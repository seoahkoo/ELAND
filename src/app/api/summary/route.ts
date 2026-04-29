import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  calcKpi, calcBrandSummary, calcProductSummary,
  calcWeeklyTrend, calcCategorySummary, calcBrandYoY,
} from '@/lib/analytics'
import type { SalesWeekly } from '@/types'

/**
 * GET /api/summary
 *   ?weeks=2026-W16,...   (period_label 필터)
 *   &brands=애니바디,...
 *   &mode=weekly|monthly  (기본: weekly)
 *
 * 올해(current) + 전년(prev) 데이터를 함께 집계해 YoY 포함 요약 반환
 * 응답 크기: ~30KB
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const weeks  = searchParams.get('weeks')
  const brands = searchParams.get('brands')
  const mode   = searchParams.get('mode') ?? 'weekly' // 'weekly' | 'monthly'

  const currentType = mode === 'monthly' ? 'monthly_current' : 'weekly_current'
  const prevType    = mode === 'monthly' ? 'monthly_prev'    : 'weekly_prev'

  const COLS = [
    'week_label', 'data_type', 'brand', 'category_l', 'category_m',
    'style_code', 'product_name', 'cum_sale_rate', 'cum_jungpan_rate',
    'period_sale_qty', 'period_sale_amt', 'period_receipt_amt', 'period_cost_amt',
    'cum_sale_qty', 'cum_sale_amt', 'cum_receipt_amt', 'cum_cost_amt',
  ].join(',')

  // 올해 데이터
  let curQuery = supabase
    .from('sales_weekly')
    .select(COLS)
    .eq('data_type', currentType)
    .limit(50000)

  if (weeks)  curQuery = curQuery.in('week_label', weeks.split(','))
  if (brands) curQuery = curQuery.in('brand', brands.split(','))

  // 전년 데이터 (같은 week_label 사용 — 전년 업로드 시 동일 label로 저장)
  let prevQuery = supabase
    .from('sales_weekly')
    .select(COLS)
    .eq('data_type', prevType)
    .limit(50000)

  if (weeks)  prevQuery = prevQuery.in('week_label', weeks.split(','))
  if (brands) prevQuery = prevQuery.in('brand', brands.split(','))

  const [{ data: curData, error: curErr }, { data: prevData, error: prevErr }] =
    await Promise.all([curQuery, prevQuery])

  if (curErr)  return NextResponse.json({ error: curErr.message },  { status: 500 })
  if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 })

  const curRows  = (curData  ?? []) as unknown as SalesWeekly[]
  const prevRows = (prevData ?? []) as unknown as SalesWeekly[]

  const hasPrev = prevRows.length > 0

  return NextResponse.json({
    kpi:        calcKpi(curRows),
    kpiPrev:    hasPrev ? calcKpi(prevRows) : null,
    brands:     calcBrandSummary(curRows),
    brandsPrev: hasPrev ? calcBrandSummary(prevRows) : null,
    brandYoY:   hasPrev ? calcBrandYoY(curRows, prevRows) : null,
    categories: calcCategorySummary(curRows),
    products:   calcProductSummary(curRows).slice(0, 200),
    trend:      calcWeeklyTrend(curRows),
    rowCount:   curRows.length,
    prevRowCount: prevRows.length,
    mode,
  })
}
