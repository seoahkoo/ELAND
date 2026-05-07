import { SalesWeekly, BrandSummary, ProductSummary, KpiData, WeeklyTrend } from '@/types'

export function calcKpi(data: SalesWeekly[]): KpiData {
  const totalPlannedAmt = data.reduce((s, r) => s + r.planned_receipt_amt, 0)
  const totalCumSaleAmt = data.reduce((s, r) => s + r.cum_sale_amt, 0)
  const totalPeriodSaleAmt = data.reduce((s, r) => s + r.period_sale_amt, 0)
  const totalCostCum = data.reduce((s, r) => s + r.cost_total_cum, 0)
  const totalMarginAmt = totalCumSaleAmt - totalCostCum
  const marginRate = totalCumSaleAmt > 0 ? (totalMarginAmt / totalCumSaleAmt) * 100 : 0

  return {
    totalSaleAmt: totalPeriodSaleAmt,
    totalCumSaleAmt,
    totalMarginAmt,
    marginRate,
    totalPlannedAmt,
    saleEfficiencyAvg: 0,
  }
}

export function calcBrandSummary(data: SalesWeekly[]): BrandSummary[] {
  const totalPlanned = data.reduce((s, r) => s + r.planned_receipt_amt, 0)
  const totalSale = data.reduce((s, r) => s + r.cum_sale_amt, 0)

  const map = new Map<string, BrandSummary>()

  for (const r of data) {
    const brand = r.brand || '미분류'
    if (!map.has(brand)) {
      map.set(brand, {
        brand,
        planned_receipt_amt: 0,
        cum_sale_amt: 0,
        cum_sale_qty: 0,
        cost_total_cum: 0,
        margin_amt: 0,
        margin_rate: 0,
        receipt_share: 0,
        sale_share: 0,
        sales_efficiency: 0,
      })
    }
    const b = map.get(brand)!
    b.planned_receipt_amt += r.planned_receipt_amt
    b.cum_sale_amt += r.cum_sale_amt
    b.cum_sale_qty += r.cum_sale_qty
    b.cost_total_cum += r.cost_total_cum
  }

  return Array.from(map.values()).map((b) => {
    b.margin_amt = b.cum_sale_amt - b.cost_total_cum
    b.margin_rate = b.cum_sale_amt > 0 ? (b.margin_amt / b.cum_sale_amt) * 100 : 0
    b.receipt_share = totalPlanned > 0 ? (b.planned_receipt_amt / totalPlanned) * 100 : 0
    b.sale_share = totalSale > 0 ? (b.cum_sale_amt / totalSale) * 100 : 0
    b.sales_efficiency = b.receipt_share - b.sale_share // 음수 = 효율 좋음
    return b
  }).sort((a, b) => b.cum_sale_amt - a.cum_sale_amt)
}

export function calcProductSummary(data: SalesWeekly[]): ProductSummary[] {
  const totalPlanned = data.reduce((s, r) => s + r.planned_receipt_amt, 0)
  const totalSale = data.reduce((s, r) => s + r.cum_sale_amt, 0)

  const map = new Map<string, ProductSummary>()

  for (const r of data) {
    const key = r.product_code
    if (!map.has(key)) {
      map.set(key, {
        product_code: r.product_code,
        style_name: r.style_name,
        brand: r.brand,
        category_l: r.category_l,
        category_m: r.category_m,
        planned_receipt_amt: 0,
        cum_sale_qty: 0,
        cum_sale_amt: 0,
        cost_total_cum: 0,
        margin_amt: 0,
        margin_rate: 0,
        sales_efficiency: 0,
      })
    }
    const p = map.get(key)!
    p.planned_receipt_amt += r.planned_receipt_amt
    p.cum_sale_qty += r.cum_sale_qty
    p.cum_sale_amt += r.cum_sale_amt
    p.cost_total_cum += r.cost_total_cum
  }

  return Array.from(map.values()).map((p) => {
    p.margin_amt = p.cum_sale_amt - p.cost_total_cum
    p.margin_rate = p.cum_sale_amt > 0 ? (p.margin_amt / p.cum_sale_amt) * 100 : 0
    const receiptShare = totalPlanned > 0 ? (p.planned_receipt_amt / totalPlanned) * 100 : 0
    const saleShare = totalSale > 0 ? (p.cum_sale_amt / totalSale) * 100 : 0
    p.sales_efficiency = receiptShare - saleShare
    return p
  }).sort((a, b) => b.cum_sale_amt - a.cum_sale_amt)
}

export function calcWeeklyTrend(data: SalesWeekly[]): WeeklyTrend[] {
  const map = new Map<string, WeeklyTrend>()

  for (const r of data) {
    if (!map.has(r.week_label)) {
      map.set(r.week_label, {
        week_label: r.week_label,
        week_start: r.week_start,
        cum_sale_amt: 0,
        period_sale_amt: 0,
        margin_amt: 0,
      })
    }
    const w = map.get(r.week_label)!
    w.cum_sale_amt += r.cum_sale_amt
    w.period_sale_amt += r.period_sale_amt
    w.margin_amt += (r.cum_sale_amt - r.cost_total_cum)
  }

  return Array.from(map.values()).sort((a, b) =>
    a.week_label.localeCompare(b.week_label)
  )
}

export function formatKRW(n: number): string {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(0)}만`
  return n.toLocaleString('ko-KR')
}

export function formatKRWFull(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}
