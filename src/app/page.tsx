'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Upload, RefreshCw, Download, Copy, CheckCheck,
  BarChart2, TrendingUp, Package, Percent, TrendingDown,
} from 'lucide-react'
import KpiCard from '@/components/KpiCard'
import SalesTrendChart from '@/components/SalesTrendChart'
import BrandBarChart from '@/components/BrandBarChart'
import RankingTable, { fmtAmt } from '@/components/RankingTable'
import InsightSection from '@/components/InsightSection'
import UploadModal from '@/components/UploadModal'
import { BrandSummary, BrandYoY, ProductSummary, KpiData, WeeklyTrend, FilterState } from '@/types'

type RankTab   = 'brand' | 'product' | 'category'
type MetricTab = 'cum_sale_amt' | 'margin_amt' | 'margin_rate'
type ViewMode  = 'weekly' | 'monthly'

interface SummaryResponse {
  kpi:          KpiData
  kpiPrev:      KpiData | null
  brands:       BrandSummary[]
  brandsPrev:   BrandSummary[] | null
  brandYoY:     BrandYoY[] | null
  categories:   BrandSummary[]
  products:     ProductSummary[]
  trend:        WeeklyTrend[]
  rowCount:     number
  prevRowCount: number
  mode:         string
}

const defaultKpi: KpiData = {
  totalPeriodSaleAmt: 0, totalCumSaleAmt: 0,
  totalMarginAmt: 0, marginRate: 0,
  totalCumReceiptAmt: 0, totalCumSaleQty: 0,
}

function growthColor(v: number) {
  if (v > 0) return 'text-red-500'
  if (v < 0) return 'text-blue-500'
  return 'text-gray-400'
}
function growthBg(v: number) {
  if (v > 0) return 'bg-red-50 text-red-600'
  if (v < 0) return 'bg-blue-50 text-blue-600'
  return 'bg-gray-50 text-gray-400'
}
function fmtGrowth(v: number) {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}
function fmtDiff(v: number) {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%p`
}

export default function Dashboard() {
  const [summary, setSummary]         = useState<SummaryResponse | null>(null)
  const [weeks, setWeeks]             = useState<string[]>([])
  const [brands, setBrands]           = useState<string[]>([])
  const [filter, setFilter]           = useState<FilterState>({ weekLabels: [], brands: [] })
  const [loading, setLoading]         = useState(false)
  const [showUpload, setShowUpload]   = useState(false)
  const [copied, setCopied]           = useState(false)
  const [rankTab, setRankTab]         = useState<RankTab>('brand')
  const [metricTab, setMetricTab]     = useState<MetricTab>('cum_sale_amt')
  const [viewMode, setViewMode]       = useState<ViewMode>('weekly')
  const [showYoY, setShowYoY]         = useState(true)

  const kpi            = summary?.kpi        ?? defaultKpi
  const kpiPrev        = summary?.kpiPrev
  const brandSummary   = summary?.brands     ?? []
  const brandYoY       = summary?.brandYoY   ?? null
  const categorySummary = summary?.categories ?? []
  const productSummary = summary?.products   ?? []
  const weeklyTrend    = summary?.trend      ?? []
  const hasPrev        = (summary?.prevRowCount ?? 0) > 0

  const loadData = useCallback(async (f?: FilterState, mode?: ViewMode) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f?.weekLabels?.length) params.set('weeks',  f.weekLabels.join(','))
      if (f?.brands?.length)     params.set('brands', f.brands.join(','))
      params.set('mode', mode ?? viewMode)
      const qs = '?' + params.toString()

      const [summaryRes, weeksRes, brandsRes] = await Promise.all([
        fetch(`/api/summary${qs}`),
        fetch('/api/weeks'),
        fetch('/api/brands'),
      ])
      const [summaryJson, weeksJson, brandsJson] = await Promise.all([
        summaryRes.json(), weeksRes.json(), brandsRes.json(),
      ])
      setSummary(summaryJson)
      setWeeks(weeksJson.data  ?? [])
      setBrands(brandsJson.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [viewMode])

  useEffect(() => { loadData() }, [loadData])

  const applyFilter = (newFilter: FilterState) => {
    setFilter(newFilter)
    loadData(newFilter)
  }
  const handleReset = () => applyFilter({ weekLabels: [], brands: [] })
  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    loadData(filter, mode)
  }

  // ── CSV 다운로드 ──────────────────────────────
  const handleCsvDownload = () => {
    const header = ['스타일코드', '상품명', '브랜드', '대분류', '중분류',
                    '누적판매량', '누적판매금액', '누적입고금액',
                    '마진금액', '마진율', '판매율', '정판율', '판매효율']
    const rows = productSummary.map((p) => [
      p.style_code, p.product_name, p.brand, p.category_l, p.category_m,
      p.cum_sale_qty, p.cum_sale_amt, p.cum_receipt_amt,
      p.margin_amt.toFixed(0), p.margin_rate.toFixed(2),
      p.cum_sale_rate.toFixed(2), (p.cum_jungpan_rate ?? 0).toFixed(2),
      p.sales_efficiency.toFixed(4),
    ])
    const csv  = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `eland_cu_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── 결과 복사 ─────────────────────────────────
  const handleCopy = async () => {
    const wLabel = filter.weekLabels.length ? filter.weekLabels.join(', ') : weeks[0] ?? '전체'
    const text = [
      `📊 ELAND CU 판매 대시보드 (${wLabel})`,
      ``,
      `📌 KPI`,
      `· 기간 판매금액: ${fmtAmt(kpi.totalPeriodSaleAmt)}원`,
      `· 누적 판매금액: ${fmtAmt(kpi.totalCumSaleAmt)}원`,
      `· 마진금액: ${fmtAmt(kpi.totalMarginAmt)}원`,
      `· 마진율: ${kpi.marginRate.toFixed(1)}%`,
      ``,
      `🏆 브랜드 TOP3`,
      ...brandSummary.slice(0, 3).map((b, i) =>
        `${i + 1}. ${b.brand} | 판매 ${fmtAmt(b.cum_sale_amt)}원 | 마진율 ${b.margin_rate.toFixed(1)}%`
      ),
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasData = (summary?.rowCount ?? 0) > 0

  // ── KPI 성장률 계산 ───────────────────────────
  const saleGrowth = kpiPrev && kpiPrev.totalCumSaleAmt > 0
    ? ((kpi.totalCumSaleAmt - kpiPrev.totalCumSaleAmt) / kpiPrev.totalCumSaleAmt) * 100
    : null
  const marginGrowth = kpiPrev && kpiPrev.totalMarginAmt > 0
    ? ((kpi.totalMarginAmt - kpiPrev.totalMarginAmt) / kpiPrev.totalMarginAmt) * 100
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <BarChart2 size={20} className="text-blue-600" />
            <span className="font-bold text-gray-800 text-base">ELAND CU 판매 대시보드</span>
          </div>

          {/* 주간/월간 토글 */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['weekly', 'monthly'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-3 py-1.5 transition-colors ${viewMode === m
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {m === 'weekly' ? '주간' : '월간'}
              </button>
            ))}
          </div>

          {/* 필터 */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                applyFilter({
                  ...filter,
                  weekLabels: filter.weekLabels.includes(v)
                    ? filter.weekLabels.filter((x) => x !== v)
                    : [...filter.weekLabels, v],
                })
              }}
            >
              <option value="">
                {filter.weekLabels.length ? `기간: ${filter.weekLabels.join(', ')}` : '전체 기간'}
              </option>
              {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>

            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                applyFilter({
                  ...filter,
                  brands: filter.brands.includes(v)
                    ? filter.brands.filter((x) => x !== v)
                    : [...filter.brands, v],
                })
              }}
            >
              <option value="">
                {filter.brands.length ? `브랜드: ${filter.brands.join(', ')}` : '전체 브랜드'}
              </option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            {(filter.weekLabels.length > 0 || filter.brands.length > 0) && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <RefreshCw size={12} /> 초기화
              </button>
            )}
            {loading && <span className="text-xs text-blue-500 animate-pulse">불러오는 중...</span>}
          </div>

          {/* 우측 버튼 */}
          <div className="flex items-center gap-2 ml-auto">
            {hasPrev && (
              <button
                onClick={() => setShowYoY(!showYoY)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showYoY
                  ? 'border-orange-300 text-orange-600 bg-orange-50'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
              >
                전년 대비 {showYoY ? 'ON' : 'OFF'}
              </button>
            )}
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              {copied ? <CheckCheck size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? '복사됨' : '결과 복사'}
            </button>
            <button onClick={handleCsvDownload}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors font-medium">
              <Upload size={14} /> 데이터 업로드
            </button>
          </div>
        </div>
      </header>

      {/* ── 메인 ── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        {/* 빈 상태 */}
        {!hasData && !loading && (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
            <Upload size={40} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium mb-2">업로드된 데이터가 없습니다</p>
            <p className="text-sm text-gray-400 mb-6">
              <strong>전마백판_MMDD.xlsx</strong> 파일을 바로 업로드하거나,<br />
              SAP BI 암호화 파일은 local_uploader.py로 변환 후 업로드해주세요.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="bg-blue-600 text-white text-sm rounded-lg px-5 py-2.5 hover:bg-blue-700 transition-colors">
              데이터 업로드 시작
            </button>
          </div>
        )}

        {hasData && (
          <>
            {/* ── KPI 카드 ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="기간 판매금액"
                value={fmtAmt(kpi.totalPeriodSaleAmt) + '원'}
                sub={kpiPrev ? `전년 ${fmtAmt(kpiPrev.totalPeriodSaleAmt)}원` : `${viewMode === 'weekly' ? '해당 주차' : '해당 월'} 판매 합계`}
                color="blue"
                icon={<TrendingUp size={18} />}
              />
              <KpiCard
                title="누적 판매금액"
                value={fmtAmt(kpi.totalCumSaleAmt) + '원'}
                sub={
                  saleGrowth !== null
                    ? <span className={growthColor(saleGrowth)}>전년比 {fmtGrowth(saleGrowth)}</span>
                    : '시즌 누적 합계'
                }
                color="green"
                icon={<BarChart2 size={18} />}
              />
              <KpiCard
                title="마진금액"
                value={fmtAmt(kpi.totalMarginAmt) + '원'}
                sub={
                  marginGrowth !== null
                    ? <span className={growthColor(marginGrowth)}>전년比 {fmtGrowth(marginGrowth)}</span>
                    : '누적판매 − 누적원가'
                }
                color="purple"
                icon={<Package size={18} />}
              />
              <KpiCard
                title="마진율"
                value={kpi.marginRate.toFixed(1) + '%'}
                sub={kpiPrev
                  ? <span className={growthColor(kpi.marginRate - kpiPrev.marginRate)}>
                      전년比 {fmtDiff(kpi.marginRate - kpiPrev.marginRate)}
                    </span>
                  : '마진금액 ÷ 누적판매금액'
                }
                color="orange"
                icon={<Percent size={18} />}
              />
            </div>

            {/* ── 주차별 추이 ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">
                {viewMode === 'weekly' ? '주차별' : '월별'} 매출 추이
              </h2>
              <SalesTrendChart data={weeklyTrend} />
            </div>

            {/* ── 랭킹 / YoY 테이블 ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex gap-1">
                  {(['brand', 'product', 'category'] as RankTab[]).map((t) => (
                    <button key={t} onClick={() => setRankTab(t)}
                      className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${rankTab === t
                        ? 'bg-blue-600 text-white font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {t === 'brand' ? '브랜드별' : t === 'product' ? '상품별' : '카테고리별'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {([
                    { k: 'cum_sale_amt', l: '판매금액' },
                    { k: 'margin_amt',   l: '마진금액' },
                    { k: 'margin_rate',  l: '마진율'   },
                  ] as { k: MetricTab; l: string }[]).map(({ k, l }) => (
                    <button key={k} onClick={() => setMetricTab(k)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${metricTab === k
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 브랜드 YoY 테이블 */}
              {rankTab === 'brand' && showYoY && brandYoY && (
                <YoYBrandTable data={brandYoY} />
              )}

              {/* 기존 차트+테이블 (YoY 없거나 상품/카테고리 탭) */}
              {!(rankTab === 'brand' && showYoY && brandYoY) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <BrandBarChart
                    data={rankTab === 'brand'
                      ? brandSummary
                      : rankTab === 'category'
                      ? categorySummary
                      : []}
                    metric={metricTab}
                  />
                  <div className="overflow-hidden">
                    {rankTab === 'brand' && (
                      <BrandRankTable data={brandSummary.slice(0, 25)} />
                    )}
                    {rankTab === 'product' && (
                      <ProductRankTable data={productSummary.slice(0, 25)} />
                    )}
                    {rankTab === 'category' && (
                      <BrandRankTable data={categorySummary.slice(0, 25)} />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── 인사이트 ── */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">판매 효율 인사이트</h2>
              <InsightSection brands={brandSummary} products={productSummary} />
            </div>
          </>
        )}
      </main>

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => loadData()} />
      )}
    </div>
  )
}

// ── SAP BI 스타일 YoY 브랜드 테이블 ──────────────
function YoYBrandTable({ data }: { data: BrandYoY[] }) {
  // 헤더 그룹 정의
  const groups = [
    { label: '발주액',    cols: 3 },
    { label: '입고액',    cols: 3 },
    { label: '주간매출액', cols: 3 },
    { label: '누적매출액', cols: 3 },
    { label: '제조기여이익', cols: 3 },
    { label: '판매율',    cols: 3 },
    { label: '정판율',    cols: 3 },
    { label: '원가율',    cols: 3 },
    { label: '마진율(TCR)', cols: 3 },
  ]

  const G = 'bg-slate-100 text-slate-600 font-semibold text-center text-[11px] py-1.5 border-b border-slate-200'
  const SH = 'text-center text-[10px] text-gray-400 py-1 border-b border-gray-100 whitespace-nowrap'
  const TD = 'py-1.5 px-1.5 text-right tabular-nums text-[11px] whitespace-nowrap'
  const GROW = (v: number, hasP: boolean) => !hasP ? (
    <span className="text-gray-300">-</span>
  ) : (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${growthBg(v)}`}>
      {v > 0 ? <TrendingUp size={8} /> : v < 0 ? <TrendingDown size={8} /> : null}
      {fmtGrowth(v)}
    </span>
  )
  const DIFF = (v: number, hasP: boolean) => !hasP ? '-' : (
    <span className={`text-[11px] font-medium ${growthColor(v)}`}>{fmtDiff(v)}</span>
  )

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="text-xs border-collapse min-w-max">
        {/* 그룹 헤더 */}
        <thead>
          <tr>
            <th className={`${G} text-left px-2 sticky left-0 bg-slate-100 z-10`} rowSpan={2}>브랜드</th>
            {groups.map((g) => (
              <th key={g.label} className={`${G} px-2 border-l border-slate-200`} colSpan={g.cols}>
                {g.label}
              </th>
            ))}
          </tr>
          {/* 서브 헤더 */}
          <tr>
            {groups.flatMap((g) => {
              const isRate = ['판매율','정판율','원가율','마진율(TCR)'].includes(g.label)
              return [
                <th key={`${g.label}-c`} className={`${SH} px-2 border-l border-gray-100`}>26년</th>,
                <th key={`${g.label}-p`} className={`${SH} px-1.5`}>25년</th>,
                <th key={`${g.label}-d`} className={`${SH} px-1.5 text-orange-400`}>
                  {isRate ? '차이' : '성장률'}
                </th>,
              ]
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const c = row.current
            const p = row.prev
            const hp = !!p
            return (
              <tr key={row.brand}
                className={`border-b border-gray-50 hover:bg-blue-50/30 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                {/* 브랜드명 */}
                <td className="py-1.5 px-2 text-[11px] font-semibold text-gray-800 sticky left-0 bg-white whitespace-nowrap z-10 border-r border-gray-100">
                  <span className="text-gray-300 mr-1">{idx + 1}</span>{row.brand}
                </td>

                {/* 발주액 */}
                <td className={`${TD} border-l border-gray-100`}>{fmtAmt(c.order_amt)}</td>
                <td className={`${TD} text-gray-400`}>{hp ? fmtAmt(p!.order_amt) : '-'}</td>
                <td className={TD}>{GROW(row.order_growth, hp)}</td>

                {/* 입고액 */}
                <td className={`${TD} border-l border-gray-100`}>{fmtAmt(c.cum_receipt_amt)}</td>
                <td className={`${TD} text-gray-400`}>{hp ? fmtAmt(p!.cum_receipt_amt) : '-'}</td>
                <td className={TD}>{GROW(row.receipt_growth, hp)}</td>

                {/* 주간매출액 */}
                <td className={`${TD} border-l border-gray-100`}>{fmtAmt(c.period_sale_amt)}</td>
                <td className={`${TD} text-gray-400`}>{hp ? fmtAmt(p!.period_sale_amt) : '-'}</td>
                <td className={TD}>{GROW(row.period_sale_growth, hp)}</td>

                {/* 누적매출액 */}
                <td className={`${TD} border-l border-gray-100 font-medium`}>{fmtAmt(c.cum_sale_amt)}</td>
                <td className={`${TD} text-gray-400`}>{hp ? fmtAmt(p!.cum_sale_amt) : '-'}</td>
                <td className={TD}>{GROW(row.cum_sale_growth, hp)}</td>

                {/* 제조기여이익 */}
                <td className={`${TD} border-l border-gray-100`}>{fmtAmt(c.margin_amt)}</td>
                <td className={`${TD} text-gray-400`}>{hp ? fmtAmt(p!.margin_amt) : '-'}</td>
                <td className={TD}>{GROW(row.margin_growth, hp)}</td>

                {/* 판매율 */}
                <td className={`${TD} border-l border-gray-100`}>{c.cum_sale_rate.toFixed(1)}%</td>
                <td className={`${TD} text-gray-400`}>{hp ? `${p!.cum_sale_rate.toFixed(1)}%` : '-'}</td>
                <td className={TD}>{DIFF(row.sale_rate_diff, hp)}</td>

                {/* 정판율 */}
                <td className={`${TD} border-l border-gray-100`}>{c.cum_jungpan_rate.toFixed(1)}%</td>
                <td className={`${TD} text-gray-400`}>{hp ? `${p!.cum_jungpan_rate.toFixed(1)}%` : '-'}</td>
                <td className={TD}>{DIFF(row.jungpan_rate_diff, hp)}</td>

                {/* 원가율 */}
                <td className={`${TD} border-l border-gray-100`}>{c.cost_rate.toFixed(1)}%</td>
                <td className={`${TD} text-gray-400`}>{hp ? `${p!.cost_rate.toFixed(1)}%` : '-'}</td>
                <td className={TD}>{DIFF(row.cost_rate_diff, hp)}</td>

                {/* 마진율 (TCR) */}
                <td className={`${TD} border-l border-gray-100 font-medium`}>{c.margin_rate.toFixed(1)}%</td>
                <td className={`${TD} text-gray-400`}>{hp ? `${p!.margin_rate.toFixed(1)}%` : '-'}</td>
                <td className={TD}>{DIFF(row.margin_rate_diff, hp)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── 일반 브랜드 랭킹 테이블 ───────────────────────
function BrandRankTable({ data }: { data: BrandSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-2 text-gray-500 font-medium w-5">순위</th>
            <th className="text-left py-2 px-2 text-gray-500 font-medium">브랜드</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">기간판매액</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">누적판매액</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">판매율</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">정판율</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">마진율</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">판매효율</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b, idx) => (
            <tr key={b.brand} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-2 text-gray-400">{idx + 1}</td>
              <td className="py-2 px-2 font-medium text-gray-800">{b.brand}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtAmt(b.period_sale_amt)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtAmt(b.cum_sale_amt)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{b.cum_sale_rate.toFixed(1)}%</td>
              <td className="py-2 px-2 text-right tabular-nums">{b.cum_jungpan_rate.toFixed(1)}%</td>
              <td className="py-2 px-2 text-right tabular-nums">{b.margin_rate.toFixed(1)}%</td>
              <td className="py-2 px-2 text-right tabular-nums">
                <span className={b.sales_efficiency < 0 ? 'text-emerald-600' : 'text-red-400'}>
                  {b.sales_efficiency.toFixed(1)}%p
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 상품 랭킹 테이블 ────────────────────────────
function ProductRankTable({ data }: { data: ProductSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-2 text-gray-500 font-medium w-5">순위</th>
            <th className="text-left py-2 px-2 text-gray-500 font-medium">상품명</th>
            <th className="text-left py-2 px-2 text-gray-500 font-medium">브랜드</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">누적판매액</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">판매량</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">판매율</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">정판율</th>
            <th className="text-right py-2 px-2 text-gray-500 font-medium">마진율</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, idx) => (
            <tr key={p.style_code} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-2 text-gray-400">{idx + 1}</td>
              <td className="py-2 px-2 font-medium text-gray-800 max-w-[160px] truncate" title={p.product_name}>
                {p.product_name || p.style_code}
              </td>
              <td className="py-2 px-2 text-gray-500">{p.brand}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtAmt(p.cum_sale_amt)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{p.cum_sale_qty.toLocaleString()}개</td>
              <td className="py-2 px-2 text-right tabular-nums">{p.cum_sale_rate.toFixed(1)}%</td>
              <td className="py-2 px-2 text-right tabular-nums">{(p.cum_jungpan_rate ?? 0).toFixed(1)}%</td>
              <td className="py-2 px-2 text-right tabular-nums">{p.margin_rate.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
