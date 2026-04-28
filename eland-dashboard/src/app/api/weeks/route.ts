import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('sales_weekly')
    .select('week_label, week_start, week_end')
    .order('week_start', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 중복 제거
  const unique = Array.from(
    new Map(data.map((r) => [r.week_label, r])).values()
  )
  return NextResponse.json({ data: unique })
}
