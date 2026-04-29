'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader2, Terminal, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess: (weekLabel: string) => void
}

export default function UploadModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.match(/\.json$/i)) {
      setStatus('error')
      setMessage('local_uploader.py 로 생성된 .json 파일만 업로드 가능합니다.')
      return
    }
    setFile(f)
    setStatus('idle')
    setMessage('')
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onUpload = async () => {
    if (!file) return
    setStatus('uploading')
    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })

      // 응답이 JSON이 아닐 수도 있으므로 text 먼저 읽기
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { /* non-JSON */ }

      if (!res.ok) {
        const errMsg = (json.error as string) || `서버 오류 (HTTP ${res.status}): ${text.slice(0, 200)}`
        throw new Error(errMsg)
      }
      setStatus('success')
      setMessage(`✅ ${(json.row_count as number).toLocaleString()}개 스타일 업로드 완료 (${json.week_label})`)
      setTimeout(() => { onSuccess(json.week_label as string); onClose() }, 1800)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : '업로드 실패 (원인 불명)')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">주간 실적 데이터 업로드</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* 사용 가이드 */}
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-700"
            onClick={() => setShowGuide(!showGuide)}
          >
            <span className="flex items-center gap-2">
              <Terminal size={15} />
              업로드 전 준비 단계 (처음 사용 시 필독)
            </span>
            {showGuide ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showGuide && (
            <div className="px-4 pb-4 text-xs text-blue-800 space-y-2 border-t border-blue-100 pt-3">
              <p className="font-semibold">SAP BI 원본 파일은 직접 업로드가 불가합니다.<br />아래 변환기를 먼저 실행해 JSON으로 변환하세요.</p>
              <ol className="list-decimal list-inside space-y-1.5 text-blue-700">
                <li>
                  <span className="font-medium">변환기 스크립트 위치:</span>
                  <code className="ml-1 bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 text-[11px] break-all">
                    Desktop\클로드코드\local_uploader.py
                  </code>
                </li>
                <li>
                  명령 프롬프트(CMD) 또는 PowerShell 열기
                </li>
                <li>
                  아래 명령 실행:
                  <code className="block mt-1 bg-blue-100 px-2 py-1.5 rounded text-blue-900 text-[11px]">
                    python &quot;C:\Users\KOO_SEOAH01\Desktop\클로드코드\local_uploader.py&quot;
                  </code>
                </li>
                <li>파일 선택 창에서 주간 실적 xlsx 선택</li>
                <li>
                  생성된 <code className="bg-blue-100 px-1 rounded">upload_YYYYMMDD.json</code> 파일을 아래에 업로드
                </li>
              </ol>
              <p className="text-blue-600 text-[11px]">
                💡 처음 한 번만 <code className="bg-blue-100 px-1 rounded">pip install pywin32</code> 설치 필요
              </p>
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
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Upload className="mx-auto mb-3 text-gray-400" size={32} />
          {file ? (
            <div>
              <p className="font-medium text-gray-700 text-sm">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">JSON 파일을 드래그하거나 클릭하여 선택</p>
              <p className="text-xs text-gray-400 mt-1">local_uploader.py 가 생성한 .json 파일</p>
            </div>
          )}
        </div>

        {/* Status */}
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
            disabled={!file || status === 'uploading' || status === 'success'}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              flex items-center justify-center gap-2"
          >
            {status === 'uploading' && <Loader2 size={14} className="animate-spin" />}
            {status === 'uploading' ? '업로드 중...' : '업로드'}
          </button>
        </div>
      </div>
    </div>
  )
}
