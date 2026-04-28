import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseExcelFile } from '@/lib/excel-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const { rows, weekInfo, rowCount } = parseExcelFile(buffer)

    if (rows.length === 0) {
      return NextResponse.json({ error: '파싱된 데이터가 없습니다. 파일 형식을 확인해주세요.' }, { status: 400 })
    }

    // 업로드 로그 생성
    const { data: logData, error: logError } = await supabase
      .from('upload_logs')
      .insert({
        filename: file.name,
        week_label: weekInfo.week_label,
        row_count: rowCount,
        status: 'success',
      })
      .select()
      .single()

    if (logError) throw logError

    // 기존 동일 주차 데이터 삭제 (덮어쓰기)
    await supabase
      .from('sales_weekly')
      .delete()
      .eq('week_label', weekInfo.week_label)

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
      success: true,
      week_label: weekInfo.week_label,
      week_start: weekInfo.week_start,
      week_end: weekInfo.week_end,
      row_count: rowCount,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '업로드 실패' },
      { status: 500 }
    )
  }
}
