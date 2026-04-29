'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, X, CheckCircle, AlertCircle, Loader2,
  ChevronDown, ChevronUp, FileSpreadsheet, FileJson,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseXlsxBuffer, deriveWeekLabel, deriveMonthLabel } from '@/lib/xlsx-parser'

interface Props {
  onClose: () => void
  onSuccess: (weekLabel: string) => void
}

type FileMode = 'xlsx' | 'json'

export default function UploadModal({ onClose, onSuccess }: Props) {
  const [file, setFile]           = useState<File | null>(null)
  const [fileMode, setFileMode]   = useState<FileMode | null>(null)
  const [weekLabel, setWeekLabel] = useState('')
  const [monthLabel, setMonthLabel] = useState('')
  const [status, setStatus]       = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage]     = useState('')
  const [progress, setProgress]   = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    const isXlsx = /\.xlsx?$/i.test(f.name)
    const isJson = /\.json$/i.test(f.name)
    if (!isXlsx && !isJson) {
      setStatus('error')
      setMessage('.xlsx 또는 .json 파일만 업로드 가능합니다.')
      return
    }
    setFile(f)
    setFileMode(isXlsx ? 'xlsx' : 'json')
    setStatus('idle')
    setMessage('')
    setProgress('')
    if (isXlsx) {
      setWeekLabel(deriveWeekLabel(f.name))
      setMonthLabel(deriveMonthLabel(f.name))
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── xlsx 업로드 ─────────────────────────────────
  const uploadXlsx = async () => {
    if (!file) return
    setStatus('parsing')
    setProgress('xlsx 파일 파싱 중...')

    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseXlsxBuffer(buffer, file.name)

      setProgress(`파싱 완료: 주간 ${parsed.weeklyRows.length}행, 전년주간 ${parsed.prevWeeklyRows.length}행, 월간 ${parsed.monthlyRows.length}행, 전년월간 ${parsed.prevMonthlyRows.length}행`)

      if (parsed.totalRows === 0) {
        throw new Error('파싱된 데이터가 없습니다. 시트명(주간/월간/전년주간/전년월간)을 확인해주세요.')
      }

      setStatus('uploading')

      // 1. 업로드 로그
      setProgress('업로드 로그 생성 중...')
      const { data: logData, error: logError } = await supabase
        .from('upload_logs')
        .insert({
          filename:   file.name,
          week_label: weekLabel,
          week_start: null,
          week_end:   null,
          row_count:  parsed.totalRows,
        })
        .select()
        .single()

      if (logError) throw new Error(logError.message)

      // 2. 기존 데이터 삭제 (같은 period label + data_type 세트)
      setProgress('기존 데이터 삭제 중...')
      const deletes = [
        supabase.from('sales_weekly').delete()
          .eq('week_label', weekLabel).eq('data_type', 'weekly_current'),
        supabase.from('sales_weekly').delete()
          .eq('week_label', weekLabel).eq('data_type', 'weekly_prev'),
        supabase.from('sales_weekly').delete()
          .eq('week_label', monthLabel).eq('data_type', 'monthly_current'),
        supabase.from('sales_weekly').delete()
          .eq('week_label', monthLabel).eq('data_type', 'monthly_prev'),
      ]
      await Promise.all(deletes)

      // 3. 배치 삽입
      const allSheets: Array<{ rows: typeof parsed.weeklyRows; label: string }> = [
        { rows: parsed.weeklyRows,      label: '주간' },
        { rows: parsed.prevWeeklyRows,  label: '전년주간' },
        { rows: parsed.monthlyRows,     label: '월간' },
        { rows: parsed.prevMonthlyRows, label: '전년월간' },
      ]

      for (const { rows, label } of allSheets) {
        if (rows.length === 0) continue
        const batchSize  = 1000
        const totalBatch = Math.ceil(rows.length / batchSize)
        for (let i = 0; i < rows.length; i += batchSize) {
          const batchNum = Math.floor(i / batchSize) + 1
          setProgress(`[${label}] ${batchNum}/${totalBatch} 배치 저장 중... (${Math.min(i + batchSize, rows.length).toLocaleString()}/${rows.length.toLocaleString()}행)`)
          const batch = rows.slice(i, i + batchSize).map((r) => ({ ...r, upload_id: logData.id }))
          const { error } = await supabase.from('sales_weekly').insert(batch)
          if (error) throw new Error(`[${label}] ${error.message}`)
        }
      }

      setStatus('success')
      setProgress('')
      setMessage(`✅ 총 ${parsed.totalRows.toLocaleString()}행 업로드 완료 (주간: ${weekLabel}, 월간: ${monthLabel})`)
      setTimeout(() => { onSuccess(weekLabel); onClose() }, 2200)
    } catch (err) {
      setStatus('error')
      setProgress('')
      setMessage(err instanceof Error ? err.message : '업로드 실패 (원인 불명)')
    }
  }

  // ── JSON 업로드 (기존 방식) ──────────────────────
  const uploadJson = async () => {
    if (!file) return
    setStatus('uploading')
    setProgress('파일 읽는 중...')

    try {
      const rawText = await file.text()
      let payload: { week_info: Record<string, string>; rows: Record<string, unknown>[] }
      try { payload = JSON.parse(rawText) } catch {
        throw new Error('JSON 파싱 실패. local_uploader.py 로 생성된 파일인지 확인해주세요.')
      }

      const { week_info, rows } = payload
      if (!week_info?.week_label || !Array.isArray(rows) || rows.length === 0) {
        throw new Error('유효하지 않은 데이터 형식입니다.')
      }

      setProgress('업로드 로그 생성 중...')
      const { data: logData, error: logError } = await supabase
        .from('upload_logs')
        .insert({
          filename:   file.name,
          week_label: week_info.week_label,
          week_start: week_info.week_start ?? null,
          week_end:   week_info.week_end   ?? null,
          row_count:  rows.length,
        })
        .select()
        .single()

      if (logError) throw new Error(logError.message)

      setProgress('기존 데이터 삭제 중...')
      await supabase.from('sales_weekly').delete().eq('week_label', week_info.week_label)

      const batchSize   = 1000
      const totalBatches = Math.ceil(rows.length / batchSize)
      for (let i = 0; i < rows.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1
        setProgress(`데이터 저장 중... ${batchNum}/${totalBatches} (${Math.min(i + batchSize, rows.length).toLocaleString()}/${rows.length.toLocaleString()}행)`)
        const batch = rows.slice(i, i + batchSize).map((r) => ({ ...r, upload_id: logData.id }))
        const { error } = await supabase.from('sales_weekly').insert(batch)
        if (error) throw new Error(error.message)
      }

      setStatus('success')
      setProgress('')
      setMessage(`✅ ${rows.length.toLocaleString()}개 업로드 완료 (${week_info.week_label})`)
      setTimeout(() => { onSuccess(week_info.week_label); onClose() }, 1800)
    } catch (err) {
      setStatus('error')
      setProgress('')
      setMessage(err instanceof Error ? err.message : '업로드 실패 (원인 불명)')
    }
  }

  const onUpload = () => fileMode === 'xlsx' ? uploadXlsx() : uploadJson()
  const isDisabled = !file || status === 'uploading' || status === 'parsing' || status === 'success'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">주간 실적 데이터 업로드</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* 파일 타입 안내 */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded-xl border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700 mb-1">
              <FileSpreadsheet size={15} /> 전마백판_MMDD.xlsx
            </div>
            <p className="text-xs text-green-600">
              4개 시트 자동 처리<br />
              (주간 / 월간 / 전년주간 / 전년월간)
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-1">
              <FileJson size={15} /> upload_YYYYMMDD.json
            </div>
            <p className="text-xs text-gray-500">
              local_uploader.py 변환 파일<br />
              (SAP BI 암호화 파일용)
            </p>
          </div>
        </div>

        {/* JSON 사용 가이드 */}
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-blue-600"
            onClick={() => setShowGuide(!showGuide)}
          >
            <span>JSON 변환기 사용법 (SAP BI 암호화 파일인 경우)</span>
            {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showGuide && (
            <div className="px-4 pb-4 text-xs text-blue-800 space-y-1.5 border-t border-blue-100 pt-3">
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>CMD 또는 PowerShell 열기</li>
                <li>
                  <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                    python &quot;C:\Users\KOO_SEOAH01\Desktop\클로드코드\local_uploader.py&quot;
                  </code>
                </li>
                <li>파일 선택 창에서 xlsx 파일 선택</li>
                <li>생성된 .json 파일을 아래에 업로드</li>
              </ol>
              <p className="text-blue-500 text-[11px]">💡 처음 한 번만 <code className="bg-blue-100 px-1 rounded">pip install pywin32</code> 필요</p>
            </div>
          )}
        </div>

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Upload className="mx-auto mb-3 text-gray-400" size={32} />
          {file ? (
            <div>
              <p className="font-medium text-gray-700 text-sm">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(file.size / 1024).toFixed(0)} KB
                {fileMode === 'xlsx' && <span className="ml-2 text-green-600 font-medium">• xlsx 자동 처리</span>}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">파일을 드래그하거나 클릭하여 선택</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx 또는 .json</p>
            </div>
          )}
        </div>

        {/* xlsx 파일 선택 시: 기간 레이블 확인 */}
        {fileMode === 'xlsx' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">주간 기간 레이블</label>
              <input
                type="text"
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="예: 2026-W16"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">월간 기간 레이블</label>
              <input
                type="text"
                value={monthLabel}
                onChange={(e) => setMonthLabel(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="예: 2026-M04"
              />
            </div>
            <p className="col-span-2 text-[11px] text-gray-400">
              파일명에서 자동 추출됐습니다. 틀리면 직접 수정해주세요.
            </p>
          </div>
        )}

        {/* 진행 상황 */}
        {(status === 'uploading' || status === 'parsing') && progress && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span>{progress}</span>
          </div>
        )}

        {/* 결과 메시지 */}
        {message && (
          <div className={`mt-3 flex items-start gap-2 text-sm p-3 rounded-lg
            ${status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {status === 'success'
              ? <CheckCircle size={16} className="mt-0.5 shrink-0" />
              : <AlertCircle  size={16} className="mt-0.5 shrink-0" />}
            <span>{message}</span>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onUpload}
            disabled={isDisabled}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              flex items-center justify-center gap-2"
          >
            {(status === 'uploading' || status === 'parsing') && <Loader2 size={14} className="animate-spin" />}
            {status === 'uploading' || status === 'parsing' ? '처리 중...' : '업로드'}
          </button>
        </div>
      </div>
    </div>
  )
}
