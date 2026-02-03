'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Gamepad2,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { Game } from '@/types'

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGames()
  }, [])

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/admin/games')
      const data = await res.json()
      if (data.success) {
        setGames(data.data || [])
        setError(null)
      } else {
        setError(data.error || `Request failed with status ${res.status}`)
      }
    } catch (error) {
      console.error('Failed to fetch games:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch games')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const getSportBadgeColor = (sport: string) => {
    switch (sport) {
      case 'FOOTBALL': return 'bg-green-100 text-green-700'
      case 'HOCKEY': return 'bg-blue-100 text-blue-700'
      case 'F1': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
        <p className="text-sm text-gray-500">Loading games...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Games</h1>
          <p className="mt-2 text-gray-500">
            Manage your SWUSH fantasy game integrations
          </p>
        </div>
        <Link
          href="/dashboard/games/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Add Game
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-red-700 font-medium">Failed to load games</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button
            onClick={fetchGames}
            className="ml-auto px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded"
          >
            Retry
          </button>
        </div>
      )}

      {!error && games.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Gamepad2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No games yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">Get started by adding your first fantasy game integration</p>
          <Link
            href="/dashboard/games/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Add Game
          </Link>
        </div>
      )}

      {games.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Game
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sport
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Round
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Users
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sync interval
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Last synced
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {games.map((game, index) => (
                <tr
                  key={game.id}
                  className={`border-b border-gray-100 last:border-0 hover:bg-red-50/30 transition-colors duration-150 ${
                    index % 2 === 1 ? 'bg-gray-50/50' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{game.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{game.game_key}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${getSportBadgeColor(game.sport_type)}`}>
                      {game.sport_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 tabular-nums">
                    {game.current_round}/{game.total_rounds || '?'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 tabular-nums">
                    {(game.users_total || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">
                    {game.sync_interval_minutes} min
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">
                    {formatDate(game.last_synced_at)}
                  </td>
                  <td className="px-6 py-4">
                    {game.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/games/${game.id}`}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium hover:underline"
                    >
                      View
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
