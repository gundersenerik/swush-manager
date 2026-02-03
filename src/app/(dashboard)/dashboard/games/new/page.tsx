'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewGamePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    game_key: '',
    name: '',
    sport_type: 'FOOTBALL',
    subsite_key: 'aftonbladet',
    sync_interval_minutes: 60,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create game')
      }

      router.push(`/dashboard/games/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

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
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Add New Game</h1>
        <p className="mt-2 text-gray-500">
          Configure a new SWUSH fantasy game integration
        </p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {error && (
            <div className="m-6 mb-0 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Game Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., ab-champions-manager-2025-2026"
                value={formData.game_key}
                onChange={(e) => setFormData({ ...formData, game_key: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
              />
              <p className="mt-2 text-sm text-gray-500">
                The game key from SWUSH API (e.g., ab-premier-manager-2025-2026)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Champions Manager 2025-2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sport Type
                </label>
                <select
                  value={formData.sport_type}
                  onChange={(e) => setFormData({ ...formData, sport_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow bg-white"
                >
                  <option value="FOOTBALL">Football</option>
                  <option value="HOCKEY">Hockey</option>
                  <option value="F1">F1</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subsite Key
                </label>
                <input
                  type="text"
                  value={formData.subsite_key}
                  onChange={(e) => setFormData({ ...formData, subsite_key: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sync Interval
              </label>
              <select
                value={formData.sync_interval_minutes}
                onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow bg-white"
              >
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
                <option value={120}>Every 2 hours</option>
                <option value={360}>Every 6 hours</option>
                <option value={720}>Every 12 hours</option>
                <option value={1440}>Once a day</option>
              </select>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-4">
            <Link
              href="/dashboard/games"
              className="px-4 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Game
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
