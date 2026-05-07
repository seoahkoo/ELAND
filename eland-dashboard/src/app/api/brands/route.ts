import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('sales_weekly')
    .select('brand')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unique = [...new Set(data.map((r) => r.brand).filter(Boolean))].sort()
  return NextResponse.json({ data: unique })
}
