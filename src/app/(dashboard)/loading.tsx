import { RefreshCw } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  )
}
