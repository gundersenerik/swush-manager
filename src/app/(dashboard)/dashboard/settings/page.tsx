'use client'

import { useEffect, useState } from 'react'
import {
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

interface SettingsData {
  swush_api_key: string
  swush_api_base_url: string
  braze_api_key: string
  braze_rest_endpoint: string
  default_sync_interval: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    swush_api_key: '',
    swush_api_base_url: '',
    braze_api_key: '',
    braze_rest_endpoint: '',
    default_sync_interval: 30,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingSwush, setTestingSwush] = useState(false)
  const [testingBraze, setTestingBraze] = useState(false)
  const [swushStatus, setSwushStatus] = useState<'success' | 'error' | null>(null)
  const [brazeStatus, setBrazeStatus] = useState<'success' | 'error' | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (data.success && data.data) {
        setSettings(prev => ({ ...prev, ...data.data }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const testSwushConnection = async () => {
    setTestingSwush(true)
    setSwushStatus(null)

    try {
      const res = await fetch('/api/admin/settings/test-swush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: settings.swush_api_key,
          base_url: settings.swush_api_base_url,
        }),
      })

      const data = await res.json()
      setSwushStatus(data.success ? 'success' : 'error')
    } catch (error) {
      setSwushStatus('error')
    } finally {
      setTestingSwush(false)
    }
  }

  const testBrazeConnection = async () => {
    setTestingBraze(true)
    setBrazeStatus(null)

    try {
      const res = await fetch('/api/admin/settings/test-braze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: settings.braze_api_key,
          endpoint: settings.braze_rest_endpoint,
        }),
      })

      const data = await res.json()
      setBrazeStatus(data.success ? 'success' : 'error')
    } catch (error) {
      setBrazeStatus('error')
    } finally {
      setTestingBraze(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
        <p className="text-sm text-gray-500">Loading settings...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
          <p className="mt-2 text-gray-500">
            Configure API integrations and default behaviors
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={`mb-8 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={message.type === 'success' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* SWUSH API Settings */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">SWUSH Partner API</h2>
              <p className="text-sm text-gray-500">
                Configure your SWUSH Partner API credentials
              </p>
            </div>
            <button
              onClick={testSwushConnection}
              disabled={testingSwush || !settings.swush_api_key}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {testingSwush ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : swushStatus === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : swushStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : null}
              Test Connection
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Base URL
              </label>
              <input
                type="text"
                value={settings.swush_api_base_url}
                onChange={(e) => setSettings(prev => ({ ...prev, swush_api_base_url: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                placeholder="https://season.swush.com/v1/partner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={settings.swush_api_key}
                onChange={(e) => setSettings(prev => ({ ...prev, swush_api_key: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                placeholder="Enter your SWUSH Partner API key"
              />
            </div>
          </div>
        </div>

        {/* Braze API Settings */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Braze API</h2>
              <p className="text-sm text-gray-500">
                Configure Braze for campaign triggers
              </p>
            </div>
            <button
              onClick={testBrazeConnection}
              disabled={testingBraze || !settings.braze_api_key}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {testingBraze ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : brazeStatus === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : brazeStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : null}
              Test Connection
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                REST API Endpoint
              </label>
              <input
                type="text"
                value={settings.braze_rest_endpoint}
                onChange={(e) => setSettings(prev => ({ ...prev, braze_rest_endpoint: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                placeholder="https://rest.fra-02.braze.eu"
              />
              <p className="mt-2 text-xs text-gray-500">
                <a href="https://www.braze.com/docs/api/basics/" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 hover:underline inline-flex items-center gap-1">
                  Find your endpoint <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={settings.braze_api_key}
                onChange={(e) => setSettings(prev => ({ ...prev, braze_api_key: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                placeholder="Enter your Braze API key"
              />
            </div>
          </div>
        </div>

        {/* Default Settings */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50/50 to-white">
            <h2 className="text-lg font-semibold text-gray-900">Default Settings</h2>
            <p className="text-sm text-gray-500">Configure default behaviors</p>
          </div>

          <div className="p-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Sync Interval (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="1440"
                value={settings.default_sync_interval}
                onChange={(e) => setSettings(prev => ({ ...prev, default_sync_interval: parseInt(e.target.value) || 30 }))}
                className="w-32 px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow tabular-nums"
              />
              <p className="mt-2 text-xs text-gray-500">
                How often new games sync by default (5-1440 minutes)
              </p>
            </div>
          </div>
        </div>

        {/* Environment Info */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Environment Variables</h3>
          <p className="text-sm text-gray-600 mb-4">
            These settings are stored securely. You can also configure them via environment variables:
          </p>
          <div className="relative">
            <div className="absolute top-3 right-3 px-2 py-1 bg-gray-700 text-gray-300 text-xs font-mono rounded">
              .env
            </div>
            <pre className="bg-gray-900 text-gray-100 p-5 rounded-xl text-sm overflow-x-auto leading-relaxed">
<span className="text-emerald-400">SWUSH_API_KEY</span>=your-swush-api-key
<span className="text-emerald-400">SWUSH_API_BASE_URL</span>=https://season.swush.com/v1/partner
<span className="text-emerald-400">BRAZE_API_KEY</span>=your-braze-api-key
<span className="text-emerald-400">BRAZE_REST_ENDPOINT</span>=https://rest.fra-02.braze.eu
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
