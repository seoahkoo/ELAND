export interface SalesWeekly {
  id: string
  upload_id: string
  week_label: string
  week_start: string
  week_end: string
  product_code: string
  brand: string
  season: string
  color_cd: string
  category_l: string
  category_m: string
  category_s: string
  style_name: string
  planned_qty: number
  planned_receipt_amt: number
  period_sale_qty: number
  period_sale_amt: number
  period_discount_rate: number
  period_sale_rate: number
  cum_sale_qty: number
  cum_sale_amt: number
  cum_sale_rate: number
  cost_total_cum: number
  remain_qty: number
  remain_amt: number
}

export interface UploadLog {
  id: string
  filename: string
  week_label: string
  row_count: number
  status: string
  uploaded_at: string
}

export interface KpiData {
  totalSaleAmt: number
  totalCumSaleAmt: number
  totalMarginAmt: number
  marginRate: number
  totalPlannedAmt: number
  saleEfficiencyAvg: number
}

export interface BrandSummary {
  brand: string
  planned_receipt_amt: number
  cum_sale_amt: number
  cum_sale_qty: number
  cost_total_cum: number
  margin_amt: number
  margin_rate: number
  receipt_share: number
  sale_share: number
  sales_efficiency: number
}

export interface ProductSummary {
  product_code: string
  style_name: string
  brand: string
  category_l: string
  category_m: string
  planned_receipt_amt: number
  cum_sale_qty: number
  cum_sale_amt: number
  cost_total_cum: number
  margin_amt: number
  margin_rate: number
  sales_efficiency: number
}

export interface WeeklyTrend {
  week_label: string
  week_start: string
  cum_sale_amt: number
  period_sale_amt: number
  margin_amt: number
}

export interface FilterState {
  weekLabels: string[]
  brands: string[]
}
