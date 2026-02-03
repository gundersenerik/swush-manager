'use client'

import { useEffect, useState } from 'react'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface SyncLog {
  id: string
  game_id: string
  trigger_type: string
  status: string
  elements_synced: number
  users_synced: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  game?: {
    name: string
    game_key: string
  }
}

export default function SyncLogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/sync-logs')
      const data = await res.json()
      if (data.success) {
        setLogs(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch sync logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress...'
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    const durationMs = endTime - startTime
    if (durationMs < 1000) return `${durationMs}ms`
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`
    return `${(durationMs / 60000).toFixed(1)}m`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      running: 'bg-blue-100 text-blue-700',
    }
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'
  }

  const getTriggerBadge = (trigger: string) => {
    const styles: Record<string, string> = {
      manual: 'bg-purple-100 text-purple-700',
      scheduled: 'bg-blue-100 text-blue-700',
      webhook: 'bg-orange-100 text-orange-700',
    }
    return styles[trigger] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sync Logs</h1>
          <p className="mt-2 text-gray-500">
            View synchronization history across all games
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchLogs() }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No sync logs yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Sync logs will appear here when games are synchronized
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Game
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Trigger
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Synced
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Duration
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Started
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <>
                  <tr
                    key={log.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-red-50/30 transition-colors duration-150 ${
                      index % 2 === 1 ? 'bg-gray-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg capitalize ${getStatusBadge(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">
                        {log.game?.name || 'Unknown Game'}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {log.game?.game_key}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg capitalize ${getTriggerBadge(log.trigger_type)}`}>
                        {log.trigger_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 tabular-nums">
                      <span className="font-medium">{log.elements_synced}</span>
                      <span className="text-gray-500"> elements, </span>
                      <span className="font-medium">{log.users_synced}</span>
                      <span className="text-gray-500"> users</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 tabular-nums font-mono">
                      {formatDuration(log.started_at, log.completed_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">
                      {formatDate(log.started_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {log.error_message && (
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {expandedLog === log.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedLog === log.id && log.error_message && (
                    <tr key={`${log.id}-error`}>
                      <td colSpan={7} className="px-6 py-4 bg-red-50 border-b border-red-100">
                        <div className="text-sm">
                          <span className="font-semibold text-red-800">Error: </span>
                          <span className="text-red-700 font-mono">{log.error_message}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
