// SAP BI 올해/전년 RAW 시트 기반 스타일별 주간/월간 실적
export interface SalesWeekly {
  id: string
  upload_id: string
  week_label: string
  data_type: string   // 'weekly_current' | 'weekly_prev' | 'monthly_current' | 'monthly_prev'

  // 스타일 식별
  style_code: string
  product_name: string
  season: string
  cd: string
  cell_type: string
  brand: string
  month: number
  category_l: string
  category_m: string
  category_s: string
  original_price: number
  current_price: number

  // 기간 데이터 (해당 주차/월)
  period_sale_qty: number
  period_sale_amt: number
  period_receipt_amt: number
  period_cost_amt: number
  period_margin_rate: number

  // 누적 데이터 (시즌 YTD)
  cum_sale_qty: number
  cum_sale_amt: number
  cum_receipt_amt: number
  cum_cost_amt: number
  cum_margin_rate: number
  cum_sale_rate: number
  cum_jungpan_rate: number

  // 발주 / 원가
  order_amt: number
  cost_rate_raw: number
}

export interface UploadLog {
  id: string
  filename: string
  week_label: string
  week_start: string
  week_end: string
  row_count: number
  uploaded_at: string
}

export interface KpiData {
  totalPeriodSaleAmt: number
  totalCumSaleAmt: number
  totalMarginAmt: number
  marginRate: number
  totalCumReceiptAmt: number
  totalCumSaleQty: number
  totalOrderAmt: number
}

export interface BrandSummary {
  brand: string
  period_sale_amt: number
  period_receipt_amt: number
  cum_sale_qty: number
  cum_sale_amt: number
  cum_receipt_amt: number
  cum_cost_amt: number
  order_amt: number
  margin_amt: number
  margin_rate: number       // (cum_sale - cum_cost) / cum_sale %
  cost_rate: number         // cum_cost / cum_sale %
  receipt_share: number
  sale_share: number
  sales_efficiency: number
  cum_sale_rate: number     // 판매율 %
  cum_jungpan_rate: number  // 정판율 %
}

export interface BrandYoY {
  brand: string
  current: BrandSummary
  prev?: BrandSummary
  // 성장률
  order_growth: number
  receipt_growth: number
  period_sale_growth: number
  cum_sale_growth: number
  margin_growth: number
  // 차이
  sale_rate_diff: number
  jungpan_rate_diff: number
  margin_rate_diff: number
  cost_rate_diff: number
}

export interface ProductSummary {
  style_code: string
  product_name: string
  brand: string
  category_l: string
  category_m: string
  cum_sale_qty: number
  cum_sale_amt: number
  cum_receipt_amt: number
  cum_cost_amt: number
  cum_sale_rate: number
  cum_jungpan_rate: number
  margin_amt: number
  margin_rate: number
  sales_efficiency: number
}

export interface WeeklyTrend {
  week_label: string
  cum_sale_amt: number
  period_sale_amt: number
  margin_amt: number
}

export interface FilterState {
  weekLabels: string[]
  brands: string[]
}
