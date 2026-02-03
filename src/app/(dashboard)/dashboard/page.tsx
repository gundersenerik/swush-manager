'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Gamepad2,
  Users,
  RefreshCw,
  Bell,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { Game } from '@/types'

interface DashboardStats {
  totalGames: number
  activeGames: number
  totalUsers: number
  recentSyncs: number
}

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalGames: 0,
    activeGames: 0,
    totalUsers: 0,
    recentSyncs: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/games')
      const data = await res.json()

      if (data.success) {
        const gamesList = data.data || []
        setGames(gamesList)

        setStats({
          totalGames: gamesList.length,
          activeGames: gamesList.filter((g: Game) => g.is_active).length,
          totalUsers: gamesList.reduce((sum: number, g: Game) => sum + (g.users_total || 0), 0),
          recentSyncs: gamesList.filter((g: Game) => g.last_synced_at).length,
        })
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const getTimeUntilDeadline = (deadline: string | null) => {
    if (!deadline) return null
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diff = deadlineDate.getTime() - now.getTime()
    if (diff < 0) return 'Passed'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    return `${hours}h`
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
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="mt-2 text-gray-500">
          Overview of your SWUSH fantasy game integrations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Primary stat - Active Games */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 shadow-lg shadow-red-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-red-100">Active Games</span>
            </div>
            <div className="text-4xl font-bold text-white tabular-nums">{stats.activeGames}</div>
          </div>
        </div>

        {/* Secondary stats */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Users</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">
            {stats.totalUsers.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <RefreshCw className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Synced Games</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{stats.recentSyncs}</div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Pending Triggers</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">0</div>
        </div>
      </div>

      {/* Games List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Games</h2>
          <Link
            href="/dashboard/games/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
          >
            Add Game
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No games yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">Get started by adding your first fantasy game integration</p>
            <Link
              href="/dashboard/games/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              Add Game
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {games.map((game, index) => (
              <Link
                key={game.id}
                href={`/dashboard/games/${game.id}`}
                className={`flex items-center justify-between p-5 hover:bg-gray-50 transition-all duration-150 group ${
                  index % 2 === 1 ? 'bg-gray-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-105 ${
                    game.is_active ? 'bg-emerald-100' : 'bg-gray-100'
                  }`}>
                    {game.is_active ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">{game.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{game.game_key}</span>
                      <span className="mx-2">·</span>
                      <span>Round {game.current_round}/{game.total_rounds || '?'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900 tabular-nums">
                      {(game.users_total || 0).toLocaleString()} users
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Synced: {formatDate(game.last_synced_at)}
                    </div>
                  </div>

                  {game.next_trade_deadline && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700 font-medium text-sm tabular-nums">
                        {getTimeUntilDeadline(game.next_trade_deadline)}
                      </span>
                    </div>
                  )}

                  <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-red-500 group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
