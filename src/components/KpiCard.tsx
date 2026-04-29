'use client'

interface KpiCardProps {
  title: string
  value: string
  sub?: React.ReactNode
  color?: 'blue' | 'green' | 'purple' | 'orange'
  icon?: React.ReactNode
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
}

export default function KpiCard({ title, value, sub, color = 'blue', icon }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-80">{title}</span>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  )
}
