import * as XLSX from 'xlsx'
import { SalesWeekly } from '@/types'

// 누적 시트의 헤더 행 인덱스 (0-based, 실제 데이터는 5행부터)
const DATA_START_ROW = 5
const SHEET_NAME = '누적'

interface RawRow {
  [key: number]: string | number | null | undefined
}

function safeNum(val: unknown): number {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

// 주간 라벨 파싱 (예: "2026-02-23 - 2026-03-01" → "2026-W09")
function parseWeekLabel(raw: string): { week_label: string; week_start: string; week_end: string } {
  const match = raw.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/)
  if (match) {
    const start = match[1]
    const date = new Date(start)
    const year = date.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const weekNo = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return {
      week_label: `${year}-W${String(weekNo).padStart(2, '0')}`,
      week_start: start,
      week_end: match[2],
    }
  }
  return { week_label: raw, week_start: '', week_end: '' }
}

export function parseExcelFile(file: ArrayBuffer): {
  rows: Omit<SalesWeekly, 'id' | 'upload_id'>[]
  weekInfo: { week_label: string; week_start: string; week_end: string }
  rowCount: number
} {
  const workbook = XLSX.read(file, { type: 'array' })

  // 누적 시트 우선, 없으면 첫 번째 시트
  const sheetName = workbook.SheetNames.includes(SHEET_NAME)
    ? SHEET_NAME
    : workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]
  const raw: RawRow[] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as RawRow[]

  // 1행에서 조회기간 파싱
  const row1 = raw[1] || {}
  let weekRaw = ''
  for (const v of Object.values(row1)) {
    if (typeof v === 'string' && v.includes(' - ')) {
      weekRaw = v
      break
    }
  }
  const weekInfo = parseWeekLabel(weekRaw)

  // 컬럼 인덱스 매핑 (4행 = 인덱스 4가 실제 컬럼 헤더)
  // 파일 구조상 고정 컬럼 위치 사용
  const COL = {
    product_code: 0,   // 상품코드
    season: 1,         // 시즌
    color_cd: 2,       // CD
    brand: 4,          // 브랜드
    category_l: 6,     // 대분류
    category_m: 7,     // 중분류
    category_s: 8,     // 소분류
    style_name: 25,    // 스타일명 (Now)
    planned_qty: 20,   // 기획수량
    planned_receipt_amt: 21, // 기획입고금액
    period_sale_qty: 30,     // 기간 판매량
    period_sale_amt: 32,     // 기간 판매금액
    period_discount_rate: 33, // 기간 할인율
    period_sale_rate: 34,    // 기간 판매율
    cum_sale_qty: 38,        // 누적 판매량
    cum_sale_amt: 40,        // 누적 판매금액
    cum_sale_rate: 41,       // 누적 판매율
    cost_total_cum: 57,      // 원가합계(누적)
    remain_qty: 44,          // 잔여 판매량
    remain_amt: 46,          // 잔여 판매금액
  }

  const rows: Omit<SalesWeekly, 'id' | 'upload_id'>[] = []

  for (let i = DATA_START_ROW; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue
    const code = safeStr(r[COL.product_code])
    if (!code || code === '상품코드' || code === '') continue

    rows.push({
      week_label: weekInfo.week_label,
      week_start: weekInfo.week_start,
      week_end: weekInfo.week_end,
      product_code: code,
      brand: safeStr(r[COL.brand]),
      season: safeStr(r[COL.season]),
      color_cd: safeStr(r[COL.color_cd]),
      category_l: safeStr(r[COL.category_l]),
      category_m: safeStr(r[COL.category_m]),
      category_s: safeStr(r[COL.category_s]),
      style_name: safeStr(r[COL.style_name]),
      planned_qty: safeNum(r[COL.planned_qty]),
      planned_receipt_amt: safeNum(r[COL.planned_receipt_amt]),
      period_sale_qty: safeNum(r[COL.period_sale_qty]),
      period_sale_amt: safeNum(r[COL.period_sale_amt]),
      period_discount_rate: safeNum(r[COL.period_discount_rate]),
      period_sale_rate: safeNum(r[COL.period_sale_rate]),
      cum_sale_qty: safeNum(r[COL.cum_sale_qty]),
      cum_sale_amt: safeNum(r[COL.cum_sale_amt]),
      cum_sale_rate: safeNum(r[COL.cum_sale_rate]),
      cost_total_cum: safeNum(r[COL.cost_total_cum]),
      remain_qty: safeNum(r[COL.remain_qty]),
      remain_amt: safeNum(r[COL.remain_amt]),
    })
  }

  return { rows, weekInfo, rowCount: rows.length }
}
