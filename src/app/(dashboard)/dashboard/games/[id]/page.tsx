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

// Extended Game type with additional API response data
interface GameWithDetails extends Game {
  stats?: {
    user_count: number
    element_count: number
  }
  sync_logs?: SyncLog[]
  triggers?: GameTrigger[]
}

// Liquid tag documentation
const liquidTags = [
  { category: 'User Stats', tag: '{{response.data.user.team_name}}', description: 'User\'s team name' },
  { category: 'User Stats', tag: '{{response.data.user.rank}}', description: 'Current overall rank' },
  { category: 'User Stats', tag: '{{response.data.user.score}}', description: 'Total score' },
  { category: 'User Stats', tag: '{{response.data.user.round_score}}', description: 'Score for current round' },
  { category: 'User Stats', tag: '{{response.data.user.round_rank}}', description: 'Rank for current round' },
  { category: 'User Stats', tag: '{{response.data.user.position_change}}', description: 'Positions gained/lost this round' },
  { category: 'User Stats', tag: '{{response.data.user.percentile}}', description: 'User\'s percentile (0-100)' },
  { category: 'User Stats', tag: '{{response.data.user.injured_count}}', description: 'Number of injured players in lineup' },
  { category: 'User Stats', tag: '{{response.data.user.suspended_count}}', description: 'Number of suspended players in lineup' },
  { category: 'Game Info', tag: '{{response.data.game.name}}', description: 'Game display name' },
  { category: 'Game Info', tag: '{{response.data.game.current_round}}', description: 'Current round number' },
  { category: 'Game Info', tag: '{{response.data.game.total_rounds}}', description: 'Total number of rounds' },
  { category: 'Game Info', tag: '{{response.data.game.round_state}}', description: 'Current state (CurrentOpen, Ended, etc.)' },
  { category: 'Game Info', tag: '{{response.data.game.trade_deadline}}', description: 'Next trade deadline (ISO date)' },
  { category: 'Game Info', tag: '{{response.data.game.days_until_deadline}}', description: 'Days until next deadline' },
  { category: 'Alerts', tag: '{{response.data.alerts.injured_players}}', description: 'Array of injured player names' },
  { category: 'Alerts', tag: '{{response.data.alerts.suspended_players}}', description: 'Array of suspended player names' },
  { category: 'Alerts', tag: '{{response.data.alerts.top_performer.name}}', description: 'Best performing player in lineup' },
  { category: 'Alerts', tag: '{{response.data.alerts.top_performer.trend}}', description: 'Trend value of top performer' },
  { category: 'Alerts', tag: '{{response.data.alerts.worst_performer.name}}', description: 'Worst performing player in lineup' },
  { category: 'Trending', tag: '{{response.data.trending.hot}}', description: 'Array of top 5 trending players (name, team, trend)' },
  { category: 'Trending', tag: '{{response.data.trending.falling}}', description: 'Array of 5 falling players (name, team, trend)' },
  { category: 'Lineup', tag: '{{response.data.lineup}}', description: 'Array of lineup players with name, team, trend, value, growth, is_injured, is_suspended' },
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
      setTimeout(() => setCopiedText(null), 2000)
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
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
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

  // Group liquid tags by category
  const tagsByCategory = liquidTags.reduce<Record<string, typeof liquidTags>>((acc, tag) => {
    const category = tag.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category]!.push(tag)
    return acc
  }, {})

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
            <p className="mt-2 text-gray-500 font-mono text-sm bg-gray-100 inline-block px-2 py-1 rounded">{game.game_key}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDebug}
              disabled={debugging}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-200 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 hover:shadow-md disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
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

        <div className="p-6 space-y-6">
          {/* API Endpoint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Endpoint
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 px-4 py-2 rounded-lg text-sm font-mono text-gray-800 overflow-x-auto">
                {connectedContentUrl}
              </code>
              <button
                onClick={() => copyToClipboard(connectedContentUrl, 'endpoint')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Copy endpoint"
              >
                {copiedText === 'endpoint' ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Replace <code className="bg-gray-100 px-1 rounded">{'{{$'}{'{user_id}}}'}</code> with your Braze user identifier attribute
            </p>
          </div>

          {/* Connected Content String */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connected Content String
            </label>
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
            <p className="text-xs text-gray-500 mt-1">
              Paste this at the top of your email template. Replace <code className="bg-gray-100 px-1 rounded">YOUR_API_KEY</code> with your actual API key.
            </p>
          </div>

          {/* Liquid Tags Table */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Liquid Tags
            </label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Category</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Liquid Tag</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(tagsByCategory).map(([category, tags]) =>
                    tags.map((item, idx) => (
                      <tr key={item.tag} className="hover:bg-gray-50">
                        {idx === 0 && (
                          <td
                            className="px-4 py-2 font-medium text-gray-900 bg-gray-50 align-top"
                            rowSpan={tags.length}
                          >
                            {category}
                          </td>
                        )}
                        <td className="px-4 py-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded text-red-600 font-mono">
                            {item.tag}
                          </code>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{item.description}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => copyToClipboard(item.tag, item.tag)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            title="Copy tag"
                          >
                            {copiedText === item.tag ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Example Usage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Example Email Template
            </label>
            <pre className="bg-gray-900 text-green-400 px-4 py-3 rounded-lg text-xs font-mono overflow-x-auto">
{`{% connected_content ${apiBaseUrl}/api/v1/users/{{$\{user_id}}}/games/${game.game_key} :headers {"x-api-key": "YOUR_API_KEY"} :save response %}

{% if response.success %}
  Hi! Your team "{{response.data.user.team_name}}" is ranked #{{response.data.user.rank}}!

  Current round: {{response.data.game.current_round}} of {{response.data.game.total_rounds}}
  Your score: {{response.data.user.score}} points

  {% if response.data.alerts.injured_players.size > 0 %}
    Warning: You have injured players: {{response.data.alerts.injured_players | join: ", "}}
  {% endif %}
{% endif %}`}
            </pre>
          </div>
        </div>
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
