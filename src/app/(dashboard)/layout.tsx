'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Gamepad2,
  Hexagon,
  RefreshCw,
  Key,
  Settings,
  LogOut,
  User,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2 },
  { name: 'Sync Logs', href: '/dashboard/sync-logs', icon: RefreshCw },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || null)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email || null)
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200 bg-gradient-to-r from-white to-red-50/30">
          <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3">
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              SWUSH
            </span>
            <span className="text-lg font-normal text-gray-500 tracking-tight ml-1">
              Manager
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-red-100 text-red-700 border-l-4 border-red-600 pl-2 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent pl-2'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-red-600' : ''}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User & Sign Out */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50/50">
          {userEmail && (
            <div className="flex items-center gap-3 mb-4 p-2 bg-white rounded-lg border border-gray-100">
              <div className="w-9 h-9 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center shadow-sm">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail}
                </p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:shadow-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-red-200"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">Aftonbladet Fantasy</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
