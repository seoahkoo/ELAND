/**
 * xlsx-parser.ts
 *
 * 전마백판_MMDD.xlsx (4시트) → Supabase 삽입용 row 배열 변환
 *
 * ※ SheetJS는 column A(항상 null)를 건너뛰므로 openpyxl 인덱스에서 -1 보정 필요
 *
 * 확인된 컬럼 매핑 (SheetJS 0-indexed):
 *   [0]  계절연도       [1]  브랜드코드      [2]  브랜드명
 *   [3]  시즌코드       [4]  시즌명           [5]  아이템코드
 *   [6]  아이템명       [7]  스타일코드        [8]  상품명
 *   [9]  최초판매가     [10] 현재판매가
 *   [19] 누적입고액     [21] 기간입고액       [22] 기간판매량
 *   [23] 기간총매출액   [28] 기간정판율       [29] 누적판매량
 *   [30] 누적총매출액   [32] 누적판매율       [35] 누적정판율
 *   [44] 기간총매출원가 [45] 기간마진율       [46] 누적총매출원가
 *   [47] 누적마진율
 */

import * as XLSX from 'xlsx'

// 데이터가 시작되는 행 (0-indexed) — 행6(1-indexed) = index 5
const DATA_START_ROW = 5

// "애니바디(ANYBODY)" → "애니바디"
function stripEnglishSuffix(s: string): string {
  return s.replace(/\s*\([A-Z0-9 &/._-]+\)/g, '').trim()
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''))
    return isNaN(n) ? 0 : n
  }
  return 0
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export type XlsxRow = Record<string, unknown>

function parseSheet(ws: XLSX.WorkSheet, dataType: string, periodLabel: string): XlsxRow[] {
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
  const result: XlsxRow[] = []

  for (let i = DATA_START_ROW; i < allRows.length; i++) {
    const r = allRows[i] as unknown[]

    // SheetJS 기준 컬럼 (openpyxl 인덱스 - 1)
    const styleCode = toStr(r[7])   // openpyxl [8]
    if (!styleCode) continue

    const brand = stripEnglishSuffix(toStr(r[2]))  // openpyxl [3]
    if (!brand) continue

    result.push({
      week_label:        periodLabel,
      data_type:         dataType,
      season:            toStr(r[0]) + toStr(r[4]),  // 계절연도 + 시즌명 (ex: "2026봄")
      brand,
      style_code:        styleCode,
      product_name:      toStr(r[8]),   // openpyxl [9]
      original_price:    toNum(r[9]),   // openpyxl [10]  — string "39900"
      current_price:     toNum(r[10]),  // openpyxl [11]
      category_l:        '',
      category_m:        toStr(r[6]),   // 아이템명 (파자마세트, 스커트 등) openpyxl [7]
      category_s:        '',
      cd:                toStr(r[5]),   // 아이템코드 openpyxl [6]
      cell_type:         '',
      month:             0,
      // 기간 데이터
      period_sale_qty:      toNum(r[22]),  // openpyxl [23]
      period_sale_amt:      toNum(r[23]),  // openpyxl [24]
      period_receipt_amt:   toNum(r[21]),  // openpyxl [22] 기간입고액
      period_cost_amt:      toNum(r[44]),  // openpyxl [45]
      period_margin_rate:   toNum(r[45]),  // openpyxl [46]
      // 누적 데이터
      cum_sale_qty:         toNum(r[29]),  // openpyxl [30]
      cum_sale_amt:         toNum(r[30]),  // openpyxl [31]
      cum_receipt_amt:      toNum(r[19]),  // openpyxl [20]
      cum_cost_amt:         toNum(r[46]),  // openpyxl [47]
      cum_margin_rate:      toNum(r[47]),  // openpyxl [48]
      cum_sale_rate:        toNum(r[32]),  // openpyxl [33]
      cum_jungpan_rate:     toNum(r[35]),  // openpyxl [36]
    })
  }

  return result
}

export interface ParsedXlsx {
  weekLabel:       string
  monthLabel:      string
  weeklyRows:      XlsxRow[]
  monthlyRows:     XlsxRow[]
  prevWeeklyRows:  XlsxRow[]
  prevMonthlyRows: XlsxRow[]
  totalRows:       number
  sheets:          string[]
}

export function parseXlsxBuffer(buffer: ArrayBuffer, filename: string): ParsedXlsx {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })

  const weekLabel  = deriveWeekLabel(filename)
  const monthLabel = deriveMonthLabel(filename)

  const weeklyWs       = wb.Sheets['주간']
  const monthlyWs      = wb.Sheets['월간']
  const prevWeeklyWs   = wb.Sheets['전년주간']
  const prevMonthlyWs  = wb.Sheets['전년월간']

  const weeklyRows      = weeklyWs      ? parseSheet(weeklyWs,      'weekly_current',  weekLabel)  : []
  const monthlyRows     = monthlyWs     ? parseSheet(monthlyWs,     'monthly_current', monthLabel) : []
  const prevWeeklyRows  = prevWeeklyWs  ? parseSheet(prevWeeklyWs,  'weekly_prev',     weekLabel)  : []
  const prevMonthlyRows = prevMonthlyWs ? parseSheet(prevMonthlyWs, 'monthly_prev',    monthLabel) : []

  return {
    weekLabel,
    monthLabel,
    weeklyRows,
    monthlyRows,
    prevWeeklyRows,
    prevMonthlyRows,
    totalRows: weeklyRows.length + monthlyRows.length + prevWeeklyRows.length + prevMonthlyRows.length,
    sheets: wb.SheetNames,
  }
}

/** 파일명 "전마백판_0413.xlsx" → "2026-W16" */
export function deriveWeekLabel(filename: string): string {
  const m = filename.match(/[_-](\d{2})(\d{2})/)
  if (m) {
    const month = parseInt(m[1])
    const day   = parseInt(m[2])
    const week  = getISOWeek(new Date(2026, month - 1, day))
    return `2026-W${String(week).padStart(2, '0')}`
  }
  return `2026-W${String(getISOWeek(new Date())).padStart(2, '0')}`
}

/** 파일명 "전마백판_0413.xlsx" → "2026-M04" */
export function deriveMonthLabel(filename: string): string {
  const m = filename.match(/[_-](\d{2})\d{2}/)
  if (m) return `2026-M${m[1]}`
  return `2026-M${String(new Date().getMonth() + 1).padStart(2, '0')}`
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
