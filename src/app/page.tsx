'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Upload, RefreshCw, Download, Copy, CheckCheck,
  BarChart2, TrendingUp, Package, Percent,
} from 'lucide-react'
import KpiCard from '@/components/KpiCard'
import SalesTrendChart from '@/components/SalesTrendChart'
import BrandBarChart from '@/components/BrandBarChart'
import RankingTable, { fmtAmt } from '@/components/RankingTable'
import InsightSection from '@/components/InsightSection'
import UploadModal from '@/components/UploadModal'
import { BrandSummary, ProductSummary, KpiData, WeeklyTrend, FilterState } from '@/types'

type RankTab   = 'brand' | 'product' | 'category'
type MetricTab = 'cum_sale_amt' | 'margin_amt' | 'margin_rate'

interface SummaryResponse {
  kpi:        KpiData
  brands:     BrandSummary[]
  categories: BrandSummary[]
  products:   ProductSummary[]
  trend:      WeeklyTrend[]
  rowCount:   number
}

const defaultKpi: KpiData = {
  totalPeriodSaleAmt: 0, totalCumSaleAmt: 0,
  totalMarginAmt: 0, marginRate: 0, totalCumReceiptAmt: 0,
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

  // ── 집계 데이터 (API에서 받아온 것 그대로 사용) ──
  const kpi            = summary?.kpi        ?? defaultKpi
  const brandSummary   = summary?.brands     ?? []
  const categorySummary = summary?.categories ?? []
  const productSummary = summary?.products   ?? []
  const weeklyTrend    = summary?.trend      ?? []

  // ── 데이터 로드 (필터 변경 시 API 재호출) ──────
  const loadData = useCallback(async (f?: FilterState) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f?.weekLabels?.length) params.set('weeks',  f.weekLabels.join(','))
      if (f?.brands?.length)     params.set('brands', f.brands.join(','))
      const qs = params.toString() ? '?' + params.toString() : ''

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
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // 필터 변경 → API 재호출
  const applyFilter = (newFilter: FilterState) => {
    setFilter(newFilter)
    loadData(newFilter)
  }
  const handleReset = () => applyFilter({ weekLabels: [], brands: [] })

  // ── CSV 다운로드 ──────────────────────────────
  const handleCsvDownload = () => {
    const header = ['스타일코드', '상품명', '브랜드', '대분류', '중분류',
                    '누적판매량', '누적판매금액', '누적입고금액',
                    '마진금액', '마진율', '누적판매율', '판매효율']
    const rows = productSummary.map((p) => [
      p.style_code, p.product_name, p.brand, p.category_l, p.category_m,
      p.cum_sale_qty, p.cum_sale_amt,
      p.cum_receipt_amt,
      p.margin_amt.toFixed(0),
      p.margin_rate.toFixed(2),
      p.cum_sale_rate.toFixed(2),
      p.sales_efficiency.toFixed(4),
    ])
    const csv  = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `eland_cu_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
        `${i + 1}. ${b.brand} | 판매 ${fmtAmt(b.cum_sale_amt)}원 | 마진율 ${b.margin_rate.toFixed(1)}% | 효율 ${b.sales_efficiency.toFixed(1)}%p`
      ),
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── 컬럼 정의 ─────────────────────────────────
  const brandColumns = [
    { key: 'period_sale_amt',  label: '기간판매액', fmt: fmtAmt },
    { key: 'cum_sale_amt',     label: '누적판매액', fmt: fmtAmt },
    { key: 'cum_receipt_amt',  label: '누적입고액', fmt: fmtAmt },
    { key: 'margin_amt',       label: '마진금액',   fmt: fmtAmt },
    { key: 'margin_rate',      label: '마진율',     fmt: (v: number) => `${v.toFixed(1)}%` },
    { key: 'sales_efficiency', label: '판매효율',   fmt: (v: number) => `${v.toFixed(1)}%p` },
  ]
  const productColumns = [
    { key: 'cum_sale_qty',     label: '판매량',   fmt: (v: number) => `${v.toLocaleString()}개` },
    { key: 'cum_sale_amt',     label: '판매금액', fmt: fmtAmt },
    { key: 'cum_receipt_amt',  label: '입고금액', fmt: fmtAmt },
    { key: 'cum_sale_rate',    label: '판매율',   fmt: (v: number) => `${v.toFixed(1)}%` },
    { key: 'margin_rate',      label: '마진율',   fmt: (v: number) => `${v.toFixed(1)}%` },
    { key: 'sales_efficiency', label: '판매효율', fmt: (v: number) => `${v.toFixed(1)}%p` },
  ]

  const hasData = (summary?.rowCount ?? 0) > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <BarChart2 size={20} className="text-blue-600" />
            <span className="font-bold text-gray-800 text-base">ELAND CU 판매 대시보드</span>
          </div>

          {/* 필터 */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                const newFilter = {
                  ...filter,
                  weekLabels: filter.weekLabels.includes(v)
                    ? filter.weekLabels.filter((x) => x !== v)
                    : [...filter.weekLabels, v],
                }
                applyFilter(newFilter)
              }}
            >
              <option value="">
                {filter.weekLabels.length ? `주차: ${filter.weekLabels.join(', ')}` : '전체 주차'}
              </option>
              {weeks.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>

            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                const newFilter = {
                  ...filter,
                  brands: filter.brands.includes(v)
                    ? filter.brands.filter((x) => x !== v)
                    : [...filter.brands, v],
                }
                applyFilter(newFilter)
              }}
            >
              <option value="">
                {filter.brands.length ? `브랜드: ${filter.brands.join(', ')}` : '전체 브랜드'}
              </option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {(filter.weekLabels.length > 0 || filter.brands.length > 0) && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <RefreshCw size={12} /> 초기화
              </button>
            )}
            {loading && (
              <span className="text-xs text-blue-500 animate-pulse">불러오는 중...</span>
            )}
          </div>

          {/* 우측 버튼 */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              {copied
                ? <CheckCheck size={14} className="text-emerald-500" />
                : <Copy size={14} />}
              {copied ? '복사됨' : '결과 복사'}
            </button>
            <button
              onClick={handleCsvDownload}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors font-medium"
            >
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
            <p className="text-gray-600 font-medium mb-1">업로드된 데이터가 없습니다</p>
            <p className="text-sm text-gray-400 mb-2">
              먼저 <strong>local_uploader.py</strong>를 실행해 JSON 파일을 생성한 뒤,
            </p>
            <p className="text-sm text-gray-400 mb-6">
              우측 상단 <strong>데이터 업로드</strong> 버튼으로 JSON 파일을 올려주세요.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="bg-blue-600 text-white text-sm rounded-lg px-5 py-2.5 hover:bg-blue-700 transition-colors"
            >
              데이터 업로드 시작
            </button>
          </div>
        )}

        {hasData && (
          <>
            {/* KPI 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="기간 판매금액"
                value={fmtAmt(kpi.totalPeriodSaleAmt) + '원'}
                sub="해당 주차 판매 합계"
                color="blue"
                icon={<TrendingUp size={18} />}
              />
              <KpiCard
                title="누적 판매금액"
                value={fmtAmt(kpi.totalCumSaleAmt) + '원'}
                sub="시즌 누적 합계"
                color="green"
                icon={<BarChart2 size={18} />}
              />
              <KpiCard
                title="마진금액"
                value={fmtAmt(kpi.totalMarginAmt) + '원'}
                sub="누적판매 − 누적원가"
                color="purple"
                icon={<Package size={18} />}
              />
              <KpiCard
                title="마진율"
                value={kpi.marginRate.toFixed(1) + '%'}
                sub="마진금액 ÷ 누적판매금액"
                color="orange"
                icon={<Percent size={18} />}
              />
            </div>

            {/* 주차별 추이 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">주차별 매출 추이</h2>
              <SalesTrendChart data={weeklyTrend} />
            </div>

            {/* 랭킹 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex gap-1">
                  {(['brand', 'product', 'category'] as RankTab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setRankTab(t)}
                      className={`text-sm px-3 py-1.5 rounded-lg transition-colors
                        ${rankTab === t
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-gray-500 hover:bg-gray-100'}`}
                    >
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
                    <button
                      key={k}
                      onClick={() => setMetricTab(k)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                        ${metricTab === k
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
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
                    <RankingTable rows={brandSummary.slice(0, 25)} columns={brandColumns} nameKey="brand" />
                  )}
                  {rankTab === 'product' && (
                    <RankingTable rows={productSummary.slice(0, 25)} columns={productColumns} nameKey="product_name" />
                  )}
                  {rankTab === 'category' && (
                    <RankingTable rows={categorySummary.slice(0, 25)} columns={brandColumns} nameKey="brand" />
                  )}
                </div>
              </div>
            </div>

            {/* 인사이트 */}
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
