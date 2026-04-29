import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const weeks = searchParams.get('weeks')    // 콤마 구분 week_label
  const brands = searchParams.get('brands')  // 콤마 구분 brand

  let query = supabase.from('sales_weekly').select('*').order('week_label', { ascending: true })

  if (weeks) {
    query = query.in('week_label', weeks.split(','))
  }
  if (brands) {
    query = query.in('brand', brands.split(','))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
