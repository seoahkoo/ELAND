// SAP BI 올해 RAW 시트 기반 스타일별 주간 실적
export interface SalesWeekly {
  id: string
  upload_id: string
  week_label: string

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

  // 기간 데이터 (해당 주차)
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
  totalPeriodSaleAmt: number   // 기간 판매금액 (해당 주)
  totalCumSaleAmt: number      // 누적 판매금액 (YTD)
  totalMarginAmt: number       // 마진금액 (누적판매 - 누적원가)
  marginRate: number           // 마진율 (%)
  totalCumReceiptAmt: number   // 누적 입고금액
}

export interface BrandSummary {
  brand: string
  period_sale_amt: number
  period_receipt_amt: number
  cum_sale_qty: number
  cum_sale_amt: number
  cum_receipt_amt: number
  cum_cost_amt: number
  margin_amt: number
  margin_rate: number
  receipt_share: number    // 입고비중 (%)
  sale_share: number       // 판매비중 (%)
  sales_efficiency: number // 판매효율 = 입고비중 - 판매비중 (음수 = 효율 우수)
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
