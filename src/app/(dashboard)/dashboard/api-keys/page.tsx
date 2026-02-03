'use client'

import { useEffect, useState } from 'react'
import {
  Key,
  Plus,
  RefreshCw,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key_preview: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
  api_key?: string // Only present when just created
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<ApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/admin/api-keys')
      const data = await res.json()
      if (data.success) {
        setKeys(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      })

      const data = await res.json()

      if (data.success) {
        setNewKey(data.data)
        setNewKeyName('')
        setShowForm(false)
        fetchKeys()
      }
    } catch (error) {
      console.error('Failed to create API key:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return
    }

    try {
      await fetch(`/api/admin/api-keys?id=${keyId}`, {
        method: 'DELETE',
      })
      fetchKeys()
    } catch (error) {
      console.error('Failed to revoke API key:', error)
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">API Keys</h1>
          <p className="mt-2 text-gray-500">
            Manage API keys for Braze Connected Content
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* New Key Alert */}
      {newKey && newKey.api_key && (
        <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800">
                Save your API key now!
              </h3>
              <p className="text-sm text-yellow-700 mt-1 mb-4">
                This is the only time you&apos;ll see this key. Copy it now and store it securely.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-2 bg-white border border-yellow-300 rounded-lg font-mono text-sm">
                  {newKey.api_key}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey.api_key!)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-4 text-sm text-yellow-700 hover:text-yellow-800"
              >
                I&apos;ve saved the key, dismiss this message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h2>
          <form onSubmit={handleCreate} className="flex gap-4">
            <input
              type="text"
              required
              placeholder="Key name (e.g., Braze Production)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 hover:shadow-md disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Keys List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {keys.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Key className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No API keys yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Create an API key for Braze to access your data
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Create API Key
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Key
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Created
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Last used
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key, index) => (
                <tr
                  key={key.id}
                  className={`border-b border-gray-100 last:border-0 hover:bg-red-50/30 transition-colors duration-150 ${
                    index % 2 === 1 ? 'bg-gray-50/50' : ''
                  }`}
                >
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {key.name}
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-lg font-mono">
                      {key.key_preview}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">
                    {formatDate(key.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">
                    {formatDate(key.last_used_at)}
                  </td>
                  <td className="px-6 py-4">
                    {key.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {key.is_active && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="mt-8 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">How to use in Braze</h3>
        <p className="text-sm text-gray-600 mb-4">
          Use the Connected Content feature in Braze to fetch personalized data:
        </p>
        <div className="relative">
          <div className="absolute top-3 right-3 px-2 py-1 bg-gray-700 text-gray-300 text-xs font-mono rounded">
            liquid
          </div>
          <pre className="bg-gray-900 text-gray-100 p-5 rounded-xl text-sm overflow-x-auto leading-relaxed">
<span className="text-purple-400">{`{% connected_content`}</span>
{`
  https://your-domain.vercel.app/api/v1/users/`}<span className="text-amber-400">{`{{external_id}}`}</span>{`/games/ab-champions-manager-2025-2026
  :headers { "x-api-key": `}<span className="text-emerald-400">{`"your-api-key-here"`}</span>{` }
  :save response
`}<span className="text-purple-400">{`%}`}</span>{`

Hi `}<span className="text-amber-400">{`{{response.data.user.team_name}}`}</span>{`!
You're ranked #`}<span className="text-amber-400">{`{{response.data.user.rank}}`}</span>{` with `}<span className="text-amber-400">{`{{response.data.user.score}}`}</span>{` points.`}
          </pre>
        </div>
      </div>
    </div>
  )
}
