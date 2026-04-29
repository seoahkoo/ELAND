/**
 * xlsx-parser.ts
 *
 * 전마백판_MMDD.xlsx (4시트) → Supabase 삽입용 row 배열 변환
 *
 * 시트 구성:
 *   주간      → data_type='weekly_current'
 *   전년주간  → data_type='weekly_prev'
 *   월간      → data_type='monthly_current'
 *   전년월간  → data_type='monthly_prev'
 *
 * 컬럼 매핑 (0-indexed, 확인된 값):
 *   [1]  계절연도       [3]  브랜드          [4]  대분류
 *   [5]  중분류         [6]  소분류           [8]  스타일코드
 *   [9]  상품명         [10] 최초판매가       [11] 현재판매가
 *   [20] 누적입고액     [23] 기간판매량       [24] 기간총매출액
 *   [26] 기간판매율     [29] 기간정판율       [30] 누적판매량
 *   [31] 누적총매출액   [33] 누적판매율       [36] 누적정판율
 *   [45] 기간총매출원가 [46] 기간마진율       [47] 누적총매출원가
 *   [48] 누적마진율
 */

import * as XLSX from 'xlsx'

// 데이터가 시작되는 행 (0-indexed) - SAP BI 파일은 5행 헤더
const DATA_START_ROW = 5

// "애니바디(ANYBODY)" → "애니바디"
function stripEnglishSuffix(s: string): string {
  return s.replace(/\s*\([A-Z0-9 &/.-]+\)/g, '').trim()
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
  // header:1 → 각 행을 배열로 반환 (0-indexed 컬럼)
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
  const result: XlsxRow[] = []

  for (let i = DATA_START_ROW; i < allRows.length; i++) {
    const r = allRows[i] as unknown[]
    const styleCode = toStr(r[8])
    if (!styleCode) continue // 빈 행 스킵

    const brand = stripEnglishSuffix(toStr(r[3]))
    if (!brand) continue

    result.push({
      week_label:        periodLabel,
      data_type:         dataType,
      season:            toStr(r[1]),
      brand,
      style_code:        styleCode,
      product_name:      toStr(r[9]),
      original_price:    toNum(r[10]),
      current_price:     toNum(r[11]),
      category_l:        toStr(r[4]),
      category_m:        toStr(r[5]),
      category_s:        toStr(r[6]),
      cd:                toStr(r[2]),
      cell_type:         '',
      month:             0,
      // 기간 데이터
      period_sale_qty:      toNum(r[23]),
      period_sale_amt:      toNum(r[24]),
      period_receipt_amt:   0,          // 개별 행 기간입고액 없음
      period_cost_amt:      toNum(r[45]),
      period_margin_rate:   toNum(r[46]),
      // 누적 데이터
      cum_sale_qty:         toNum(r[30]),
      cum_sale_amt:         toNum(r[31]),
      cum_receipt_amt:      toNum(r[20]),
      cum_cost_amt:         toNum(r[47]),
      cum_margin_rate:      toNum(r[48]),
      cum_sale_rate:        toNum(r[33]),
      cum_jungpan_rate:     toNum(r[36]),
    })
  }

  return result
}

export interface ParsedXlsx {
  weekLabel:       string   // e.g. "2026-W16"
  monthLabel:      string   // e.g. "2026-M04"
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

  const prevWeekLabel  = weekLabel.replace(/^(\d{4})/, (_, y) => String(parseInt(y) - 1))
  const prevMonthLabel = monthLabel.replace(/^(\d{4})/, (_, y) => String(parseInt(y) - 1))

  const weeklyWs       = wb.Sheets['주간']
  const monthlyWs      = wb.Sheets['월간']
  const prevWeeklyWs   = wb.Sheets['전년주간']
  const prevMonthlyWs  = wb.Sheets['전년월간']

  const weeklyRows      = weeklyWs      ? parseSheet(weeklyWs,      'weekly_current',  weekLabel)      : []
  const monthlyRows     = monthlyWs     ? parseSheet(monthlyWs,     'monthly_current', monthLabel)     : []
  const prevWeeklyRows  = prevWeeklyWs  ? parseSheet(prevWeeklyWs,  'weekly_prev',     weekLabel)      : []
  const prevMonthlyRows = prevMonthlyWs ? parseSheet(prevMonthlyWs, 'monthly_prev',    monthLabel)     : []

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
  if (m) {
    return `2026-M${m[1]}`
  }
  return `2026-M${String(new Date().getMonth() + 1).padStart(2, '0')}`
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
