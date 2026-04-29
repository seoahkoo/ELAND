import { SalesWeekly, BrandSummary, BrandYoY, ProductSummary, KpiData, WeeklyTrend } from '@/types'

// ──────────────────────────────────────────────
//  KPI 계산
// ──────────────────────────────────────────────
export function calcKpi(data: SalesWeekly[]): KpiData {
  const totalPeriodSaleAmt  = data.reduce((s, r) => s + r.period_sale_amt, 0)
  const totalCumSaleAmt     = data.reduce((s, r) => s + r.cum_sale_amt, 0)
  const totalCumCostAmt     = data.reduce((s, r) => s + r.cum_cost_amt, 0)
  const totalCumReceiptAmt  = data.reduce((s, r) => s + r.cum_receipt_amt, 0)
  const totalCumSaleQty     = data.reduce((s, r) => s + r.cum_sale_qty, 0)
  const totalMarginAmt      = totalCumSaleAmt - totalCumCostAmt
  const marginRate          = totalCumSaleAmt > 0
    ? (totalMarginAmt / totalCumSaleAmt) * 100
    : 0

  return {
    totalPeriodSaleAmt,
    totalCumSaleAmt,
    totalMarginAmt,
    marginRate,
    totalCumReceiptAmt,
    totalCumSaleQty,
  }
}

// ──────────────────────────────────────────────
//  브랜드별 집계
// ──────────────────────────────────────────────
export function calcBrandSummary(data: SalesWeekly[]): BrandSummary[] {
  const totalCumReceipt = data.reduce((s, r) => s + r.cum_receipt_amt, 0)
  const totalCumSale    = data.reduce((s, r) => s + r.cum_sale_amt, 0)

  const map = new Map<string, BrandSummary>()

  for (const r of data) {
    const brand = r.brand || '미분류'
    if (!map.has(brand)) {
      map.set(brand, {
        brand,
        period_sale_amt:   0,
        period_receipt_amt: 0,
        cum_sale_qty:      0,
        cum_sale_amt:      0,
        cum_receipt_amt:   0,
        cum_cost_amt:      0,
        margin_amt:        0,
        margin_rate:       0,
        receipt_share:     0,
        sale_share:        0,
        sales_efficiency:  0,
        cum_sale_rate:     0,
        cum_jungpan_rate:  0,
      })
    }
    const b = map.get(brand)!
    b.period_sale_amt    += r.period_sale_amt
    b.period_receipt_amt += r.period_receipt_amt
    b.cum_sale_qty       += r.cum_sale_qty
    b.cum_sale_amt       += r.cum_sale_amt
    b.cum_receipt_amt    += r.cum_receipt_amt
    b.cum_cost_amt       += r.cum_cost_amt
  }

  return Array.from(map.values())
    .map((b) => {
      b.margin_amt       = b.cum_sale_amt - b.cum_cost_amt
      b.margin_rate      = b.cum_sale_amt > 0
        ? (b.margin_amt / b.cum_sale_amt) * 100 : 0
      b.receipt_share    = totalCumReceipt > 0
        ? (b.cum_receipt_amt / totalCumReceipt) * 100 : 0
      b.sale_share       = totalCumSale > 0
        ? (b.cum_sale_amt / totalCumSale) * 100 : 0
      b.sales_efficiency = b.receipt_share - b.sale_share
      // 브랜드 누적판매율/정판율: 입고액 대비 판매액으로 계산
      b.cum_sale_rate    = b.cum_receipt_amt > 0
        ? (b.cum_sale_amt / b.cum_receipt_amt) * 100 : 0
      b.cum_jungpan_rate = b.cum_receipt_amt > 0
        ? (b.cum_sale_amt / b.cum_receipt_amt) * 100 : 0
      return b
    })
    .sort((a, b) => b.cum_sale_amt - a.cum_sale_amt)
}

// ──────────────────────────────────────────────
//  브랜드별 전년 대비 (YoY)
// ──────────────────────────────────────────────
export function calcBrandYoY(
  current: SalesWeekly[],
  prev: SalesWeekly[],
): BrandYoY[] {
  const curMap  = new Map(calcBrandSummary(current).map((b) => [b.brand, b]))
  const prevMap = new Map(calcBrandSummary(prev).map((b) => [b.brand, b]))

  // 올해 브랜드 기준으로 병합 (전년에만 있는 브랜드는 제외)
  const brands = Array.from(curMap.keys())

  return brands.map((brand) => {
    const cur  = curMap.get(brand)!
    const prv  = prevMap.get(brand)

    const saleGrowth = prv && prv.cum_sale_amt > 0
      ? ((cur.cum_sale_amt - prv.cum_sale_amt) / prv.cum_sale_amt) * 100
      : 0
    const qtyGrowth  = prv && prv.cum_sale_qty > 0
      ? ((cur.cum_sale_qty - prv.cum_sale_qty) / prv.cum_sale_qty) * 100
      : 0
    const saleRateDiff = prv
      ? cur.cum_sale_rate - prv.cum_sale_rate : 0
    const jungpanDiff  = prv
      ? cur.cum_jungpan_rate - prv.cum_jungpan_rate : 0

    return {
      brand,
      current:          cur,
      prev:             prv,
      sale_growth:      saleGrowth,
      qty_growth:       qtyGrowth,
      sale_rate_diff:   saleRateDiff,
      jungpan_rate_diff: jungpanDiff,
    }
  }).sort((a, b) => b.current.cum_sale_amt - a.current.cum_sale_amt)
}

// ──────────────────────────────────────────────
//  상품별 집계
// ──────────────────────────────────────────────
export function calcProductSummary(data: SalesWeekly[]): ProductSummary[] {
  const totalCumReceipt = data.reduce((s, r) => s + r.cum_receipt_amt, 0)
  const totalCumSale    = data.reduce((s, r) => s + r.cum_sale_amt, 0)

  const map = new Map<string, ProductSummary>()

  for (const r of data) {
    const key = r.style_code
    if (!map.has(key)) {
      map.set(key, {
        style_code:     r.style_code,
        product_name:   r.product_name,
        brand:          r.brand,
        category_l:     r.category_l,
        category_m:     r.category_m,
        cum_sale_qty:   0,
        cum_sale_amt:   0,
        cum_receipt_amt: 0,
        cum_cost_amt:   0,
        cum_sale_rate:  r.cum_sale_rate,
        cum_jungpan_rate: r.cum_jungpan_rate ?? 0,
        margin_amt:     0,
        margin_rate:    0,
        sales_efficiency: 0,
      })
    }
    const p = map.get(key)!
    p.cum_sale_qty    += r.cum_sale_qty
    p.cum_sale_amt    += r.cum_sale_amt
    p.cum_receipt_amt += r.cum_receipt_amt
    p.cum_cost_amt    += r.cum_cost_amt
  }

  return Array.from(map.values())
    .map((p) => {
      p.margin_amt      = p.cum_sale_amt - p.cum_cost_amt
      p.margin_rate     = p.cum_sale_amt > 0
        ? (p.margin_amt / p.cum_sale_amt) * 100 : 0
      const rs          = totalCumReceipt > 0
        ? (p.cum_receipt_amt / totalCumReceipt) * 100 : 0
      const ss          = totalCumSale > 0
        ? (p.cum_sale_amt / totalCumSale) * 100 : 0
      p.sales_efficiency = rs - ss
      return p
    })
    .sort((a, b) => b.cum_sale_amt - a.cum_sale_amt)
}

// ──────────────────────────────────────────────
//  주차별 트렌드
// ──────────────────────────────────────────────
export function calcWeeklyTrend(data: SalesWeekly[]): WeeklyTrend[] {
  const map = new Map<string, WeeklyTrend>()

  for (const r of data) {
    if (!map.has(r.week_label)) {
      map.set(r.week_label, {
        week_label:     r.week_label,
        cum_sale_amt:   0,
        period_sale_amt: 0,
        margin_amt:     0,
      })
    }
    const w = map.get(r.week_label)!
    w.cum_sale_amt    += r.cum_sale_amt
    w.period_sale_amt += r.period_sale_amt
    w.margin_amt      += (r.cum_sale_amt - r.cum_cost_amt)
  }

  return Array.from(map.values())
    .sort((a, b) => a.week_label.localeCompare(b.week_label))
}

// ──────────────────────────────────────────────
//  카테고리별 집계
// ──────────────────────────────────────────────
export function calcCategorySummary(data: SalesWeekly[]): BrandSummary[] {
  const totalReceipt = data.reduce((s, r) => s + r.cum_receipt_amt, 0)
  const totalSale    = data.reduce((s, r) => s + r.cum_sale_amt, 0)
  const map = new Map<string, BrandSummary>()

  for (const r of data) {
    const key = r.category_l || '미분류'
    if (!map.has(key)) {
      map.set(key, {
        brand: key, period_sale_amt: 0, period_receipt_amt: 0,
        cum_sale_qty: 0, cum_sale_amt: 0, cum_receipt_amt: 0,
        cum_cost_amt: 0, margin_amt: 0, margin_rate: 0,
        receipt_share: 0, sale_share: 0, sales_efficiency: 0,
        cum_sale_rate: 0, cum_jungpan_rate: 0,
      })
    }
    const c = map.get(key)!
    c.period_sale_amt   += r.period_sale_amt
    c.cum_sale_qty      += r.cum_sale_qty
    c.cum_sale_amt      += r.cum_sale_amt
    c.cum_receipt_amt   += r.cum_receipt_amt
    c.cum_cost_amt      += r.cum_cost_amt
  }

  return Array.from(map.values())
    .map((c) => {
      c.margin_amt       = c.cum_sale_amt - c.cum_cost_amt
      c.margin_rate      = c.cum_sale_amt > 0 ? (c.margin_amt / c.cum_sale_amt) * 100 : 0
      c.receipt_share    = totalReceipt > 0 ? (c.cum_receipt_amt / totalReceipt) * 100 : 0
      c.sale_share       = totalSale    > 0 ? (c.cum_sale_amt    / totalSale)    * 100 : 0
      c.sales_efficiency = c.receipt_share - c.sale_share
      c.cum_sale_rate    = c.cum_receipt_amt > 0
        ? (c.cum_sale_amt / c.cum_receipt_amt) * 100 : 0
      return c
    })
    .sort((a, b) => b.cum_sale_amt - a.cum_sale_amt)
}

// ──────────────────────────────────────────────
//  포맷 유틸리티
// ──────────────────────────────────────────────
export function formatKRW(n: number): string {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000)      return `${Math.round(n / 10_000).toLocaleString()}만`
  return n.toLocaleString('ko-KR')
}
