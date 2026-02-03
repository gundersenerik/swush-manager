'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Bell,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Game, SyncLog, GameTrigger } from '@/types'
import SnippetBuilder from '@/components/SnippetBuilder'

// Extended Game type with additional API response data
interface GameWithDetails extends Game {
  stats?: {
    user_count: number
    element_count: number
  }
  sync_logs?: SyncLog[]
  triggers?: GameTrigger[]
}

// Liquid tag documentation with examples
const liquidTags = [
  { category: 'User Stats', name: 'team_name', tag: '{{response.data.user.team_name}}', description: 'User\'s team name', example: '"FC Vikings"' },
  { category: 'User Stats', name: 'rank', tag: '{{response.data.user.rank}}', description: 'Current overall rank', example: '142' },
  { category: 'User Stats', name: 'score', tag: '{{response.data.user.score}}', description: 'Total score', example: '2,450' },
  { category: 'User Stats', name: 'round_score', tag: '{{response.data.user.round_score}}', description: 'Score for current round', example: '89' },
  { category: 'User Stats', name: 'round_rank', tag: '{{response.data.user.round_rank}}', description: 'Rank for current round', example: '56' },
  { category: 'User Stats', name: 'position_change', tag: '{{response.data.user.position_change}}', description: 'Positions gained/lost this round', example: '+12' },
  { category: 'User Stats', name: 'percentile', tag: '{{response.data.user.percentile}}', description: 'User\'s percentile (0-100)', example: '85' },
  { category: 'User Stats', name: 'injured_count', tag: '{{response.data.user.injured_count}}', description: 'Number of injured players in lineup', example: '1' },
  { category: 'User Stats', name: 'suspended_count', tag: '{{response.data.user.suspended_count}}', description: 'Number of suspended players in lineup', example: '0' },
  { category: 'Game Info', name: 'game.name', tag: '{{response.data.game.name}}', description: 'Game display name', example: '"Champions Manager 2025"' },
  { category: 'Game Info', name: 'game.current_round', tag: '{{response.data.game.current_round}}', description: 'Current round number', example: '12' },
  { category: 'Game Info', name: 'game.total_rounds', tag: '{{response.data.game.total_rounds}}', description: 'Total number of rounds', example: '38' },
  { category: 'Game Info', name: 'game.round_state', tag: '{{response.data.game.round_state}}', description: 'Current state (CurrentOpen, Ended, etc.)', example: '"CurrentOpen"' },
  { category: 'Game Info', name: 'game.trade_deadline', tag: '{{response.data.game.trade_deadline}}', description: 'Next trade deadline (ISO date)', example: '"2025-02-15T18:00:00Z"' },
  { category: 'Game Info', name: 'game.days_until_deadline', tag: '{{response.data.game.days_until_deadline}}', description: 'Days until next deadline', example: '3' },
  { category: 'Alerts', name: 'alerts.injured_players', tag: '{{response.data.alerts.injured_players}}', description: 'Array of injured player names', example: '["Haaland", "Salah"]' },
  { category: 'Alerts', name: 'alerts.suspended_players', tag: '{{response.data.alerts.suspended_players}}', description: 'Array of suspended player names', example: '["Bruno Fernandes"]' },
  { category: 'Alerts', name: 'alerts.top_performer.name', tag: '{{response.data.alerts.top_performer.name}}', description: 'Best performing player in lineup', example: '"Palmer"' },
  { category: 'Alerts', name: 'alerts.top_performer.trend', tag: '{{response.data.alerts.top_performer.trend}}', description: 'Trend value of top performer', example: '15.2' },
  { category: 'Alerts', name: 'alerts.worst_performer.name', tag: '{{response.data.alerts.worst_performer.name}}', description: 'Worst performing player in lineup', example: '"Werner"' },
  { category: 'Trending', name: 'trending.hot', tag: '{{response.data.trending.hot}}', description: 'Array of top 5 trending players', example: '[{name: "Palmer", team: "Chelsea", trend: 15.2}]' },
  { category: 'Trending', name: 'trending.falling', tag: '{{response.data.trending.falling}}', description: 'Array of 5 falling players', example: '[{name: "Werner", team: "Spurs", trend: -8.4}]' },
  { category: 'Lineup', name: 'lineup', tag: '{{response.data.lineup}}', description: 'Array of lineup players with details', example: '[{name: "Salah", team: "Liverpool", ...}]' },
]

export default function GameDetailPage() {
  const params = useParams()
  const [game, setGame] = useState<GameWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ users: number; elements: number } | null>(null)
  const [showTriggerForm, setShowTriggerForm] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null)
  const [debugging, setDebugging] = useState(false)
  const [triggerForm, setTriggerForm] = useState({
    trigger_type: 'deadline_reminder_24h',
    braze_campaign_id: '',
  })

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/games/${params.id}`)
      const data = await res.json()
      if (data.success) {
        setGame(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch game:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) {
      fetchGame()
    }
  }, [params.id, fetchGame])

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/admin/games/${params.id}/sync`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({
          users: data.data?.users_synced ?? 0,
          elements: data.data?.elements_synced ?? 0,
        })
        await fetchGame()
      } else {
        setSyncError(data.error || 'Sync failed - check Vercel logs for details')
      }
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncError(error instanceof Error ? error.message : 'Network error - sync request failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleDebug = async () => {
    setDebugging(true)
    setDebugData(null)
    try {
      const res = await fetch(`/api/admin/games/${params.id}/debug-sync`)
      const data = await res.json()
      setDebugData(data)
    } catch (error) {
      console.error('Debug failed:', error)
      setDebugData({ error: error instanceof Error ? error.message : 'Debug request failed' })
    } finally {
      setDebugging(false)
    }
  }

  const handleAddTrigger = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/admin/games/${params.id}/triggers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(triggerForm),
      })
      const data = await res.json()
      if (data.success) {
        setShowTriggerForm(false)
        setTriggerForm({ trigger_type: 'deadline_reminder_24h', braze_campaign_id: '' })
        fetchGame()
      }
    } catch (error) {
      console.error('Failed to add trigger:', error)
    }
  }

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return
    try {
      await fetch(`/api/admin/games/${params.id}/triggers?trigger_id=${triggerId}`, {
        method: 'DELETE',
      })
      fetchGame()
    } catch (error) {
      console.error('Failed to delete trigger:', error)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(label)
      setTimeout(() => setCopiedText(null), 3000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const getTriggerTypeName = (type: string) => {
    switch (type) {
      case 'deadline_reminder_24h': return '24h Deadline Reminder'
      case 'round_started': return 'Round Started'
      case 'round_ended': return 'Round Ended'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
        <p className="text-sm text-gray-500">Loading game details...</p>
      </div>
    )
  }

  if (!game) {
    return <div>Game not found</div>
  }

  // Generate the Connected Content URL and string
  const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const connectedContentUrl = `${apiBaseUrl}/api/v1/users/{{$\{user_id}}}/games/${game.game_key}`
  const connectedContentString = `{% connected_content ${connectedContentUrl} :headers {"x-api-key": "YOUR_API_KEY"} :save response %}`

  // Get visible sync logs (2 or all)
  const syncLogs = game.sync_logs || []
  const visibleLogs = showAllLogs ? syncLogs : syncLogs.slice(0, 2)

  return (
    <div>
      <div className="mb-10">
        <Link
          href="/dashboard/games"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Games
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{game.name}</h1>
            <p className="mt-2 text-gray-500 text-sm">{game.game_key}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDebug}
              disabled={debugging}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {debugging ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Code className="w-4 h-4" />
              )}
              Debug Sync
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sync Now
            </button>
          </div>
        </div>

        {/* Sync feedback */}
        {syncError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800">Sync Failed</p>
                <p className="text-sm text-red-600 mt-1">{syncError}</p>
              </div>
            </div>
          </div>
        )}
        {syncResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Sync Completed</p>
                <p className="text-sm text-green-600 mt-1">
                  Synced {syncResult.elements} elements and {syncResult.users} users
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Debug Output */}
        {debugData && (
          <div className="mt-4 p-4 bg-gray-900 rounded-lg overflow-auto max-h-96">
            <div className="flex justify-between items-center mb-2">
              <p className="font-medium text-gray-200">Debug Output</p>
              <button
                onClick={() => setDebugData(null)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <pre className="text-xs text-green-400 whitespace-pre-wrap">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Status</div>
          <div className="flex items-center gap-2">
            {game.is_active ? (
              <>
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="font-semibold text-emerald-700">Active</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-gray-400" />
                </div>
                <span className="font-semibold text-gray-500">Inactive</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Round</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {game.current_round} <span className="text-gray-400 text-lg font-normal">/</span> {game.total_rounds || '?'}
          </div>
          <div className="text-xs text-gray-500 mt-1 font-medium">{game.round_state}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Users</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {(game.stats?.user_count || game.users_total || 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Elements</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {(game.stats?.element_count || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Deadline Info */}
      {game.next_trade_deadline && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Next Trade Deadline</div>
              <div className="text-lg font-semibold text-amber-900 tabular-nums">{formatDate(game.next_trade_deadline)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Braze Integration Section */}
      <div className="bg-white rounded-xl border border-gray-200 mb-8 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Code className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Braze Integration</h2>
              <p className="text-sm text-gray-500">
                Use Connected Content in your Braze campaigns for personalized emails
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Connected Content String */}
        <div className="p-6 border-b border-gray-200">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">
              Step 1: Add this to the top of your template
            </h3>
            <p className="text-xs text-gray-500">
              Replace <code className="bg-gray-100 px-1 rounded">YOUR_API_KEY</code> with your actual API key
            </p>
          </div>
          <div className="flex items-start gap-2">
            <code className="flex-1 bg-gray-900 text-green-400 px-4 py-3 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
              {connectedContentString}
            </code>
            <button
              onClick={() => copyToClipboard(connectedContentString, 'connected')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
              title="Copy Connected Content"
            >
              {copiedText === 'connected' ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Step 2: Snippet Builder */}
        <SnippetBuilder
          tags={liquidTags}
          onCopy={copyToClipboard}
          copiedText={copiedText}
        />
      </div>

      {/* Triggers */}
      <div className="bg-white rounded-xl border border-gray-200 mb-8 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Braze Triggers</h2>
              <p className="text-sm text-gray-500">Automate campaign triggers</p>
            </div>
          </div>
          <button
            onClick={() => setShowTriggerForm(!showTriggerForm)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Trigger
          </button>
        </div>

        {showTriggerForm && (
          <form onSubmit={handleAddTrigger} className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Type
                </label>
                <select
                  value={triggerForm.trigger_type}
                  onChange={(e) => setTriggerForm({ ...triggerForm, trigger_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="deadline_reminder_24h">24h Deadline Reminder</option>
                  <option value="round_started">Round Started</option>
                  <option value="round_ended">Round Ended</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Braze Campaign ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="campaign_id_here"
                  value={triggerForm.braze_campaign_id}
                  onChange={(e) => setTriggerForm({ ...triggerForm, braze_campaign_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Add Trigger
              </button>
              <button
                type="button"
                onClick={() => setShowTriggerForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-gray-200">
          {(game.triggers || []).length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No triggers configured. Add a trigger to automate Braze campaigns.
            </div>
          ) : (
            (game.triggers || []).map((trigger) => (
              <div key={trigger.id} className="p-6 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {getTriggerTypeName(trigger.trigger_type)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Campaign: {trigger.braze_campaign_id}
                  </div>
                  {trigger.last_triggered_at && (
                    <div className="text-xs text-gray-400 mt-1">
                      Last triggered: {formatDate(trigger.last_triggered_at)} (Round {trigger.last_triggered_round})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    trigger.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {trigger.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleDeleteTrigger(trigger.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Sync Logs - Collapsed by default */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Sync Logs</h2>
              <p className="text-sm text-gray-500">Synchronization history</p>
            </div>
          </div>
          {syncLogs.length > 2 && (
            <button
              onClick={() => setShowAllLogs(!showAllLogs)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              {showAllLogs ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show all ({syncLogs.length})
                </>
              )}
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-200">
          {visibleLogs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No sync logs yet. Trigger a sync to see logs here.
            </div>
          ) : (
            visibleLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {log.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : log.status === 'failed' ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {log.sync_type === 'manual' ? 'Manual Sync' : 'Scheduled Sync'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(log.started_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-900">
                    {log.users_synced} users, {log.elements_synced} elements
                  </div>
                  {log.error_message && (
                    <div className="text-xs text-red-500">{log.error_message}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
