import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/upload
 *
 * local_uploader.py 가 생성한 JSON 파일을 받아 Supabase에 저장합니다.
 *
 * 요청 형식: application/json (raw body)
 *   또는 multipart/form-data (file 필드)
 *
 * JSON 구조:
 *   { week_info: { week_label, week_start, week_end }, rows: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let payload: { week_info: Record<string, string>; rows: Record<string, unknown>[] }
    let filename = 'upload.json'

    if (contentType.includes('application/json')) {
      // UploadModal 이 직접 JSON body 로 전송하는 경우
      const text = await req.text()
      try {
        payload = JSON.parse(text)
      } catch {
        return NextResponse.json(
          { error: 'JSON 파싱 실패. local_uploader.py 로 생성된 파일인지 확인해주세요.' },
          { status: 400 }
        )
      }
    } else {
      // multipart/form-data fallback
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
      }
      filename = file.name
      const text = await file.text()
      try {
        payload = JSON.parse(text)
      } catch {
        return NextResponse.json(
          { error: 'JSON 파싱 실패. local_uploader.py 로 생성된 파일인지 확인해주세요.' },
          { status: 400 }
        )
      }
    }

    const { week_info, rows } = payload
    if (!week_info?.week_label || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 데이터 형식입니다.' },
        { status: 400 }
      )
    }

    // 업로드 로그 생성
    const { data: logData, error: logError } = await supabase
      .from('upload_logs')
      .insert({
        filename:   filename,
        week_label: week_info.week_label,
        week_start: week_info.week_start ?? null,
        week_end:   week_info.week_end   ?? null,
        row_count:  rows.length,
      })
      .select()
      .single()

    if (logError) throw logError

    // 기존 동일 주차 데이터 삭제 (덮어쓰기)
    await supabase
      .from('sales_weekly')
      .delete()
      .eq('week_label', week_info.week_label)

    // 배치 삽입 (500행씩)
    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((r) => ({
        ...r,
        upload_id: logData.id,
      }))
      const { error } = await supabase.from('sales_weekly').insert(batch)
      if (error) throw error
    }

    return NextResponse.json({
      success:    true,
      week_label: week_info.week_label,
      week_start: week_info.week_start,
      week_end:   week_info.week_end,
      row_count:  rows.length,
    })
  } catch (err) {
    console.error('Upload error:', err)
    // Supabase PostgrestError 는 Error 인스턴스가 아니므로 .message 직접 추출
    const errMsg =
      err instanceof Error
        ? err.message
        : typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string; details?: string; code?: string }).message +
            ((err as { details?: string }).details ? ` (${(err as { details: string }).details})` : '') +
            ((err as { code?: string }).code ? ` [code: ${(err as { code: string }).code}]` : '')
          : JSON.stringify(err)
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    )
  }
}
