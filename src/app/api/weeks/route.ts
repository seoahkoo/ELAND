import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('sales_weekly')
    .select('week_label')
    .order('week_label', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 중복 제거
  const unique = [...new Set(data.map((r) => r.week_label).filter(Boolean))].sort().reverse()
  return NextResponse.json({ data: unique })
}
