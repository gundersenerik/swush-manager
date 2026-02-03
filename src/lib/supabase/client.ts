import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase client for browser components
// Handles cookie-based auth session automatically
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey)
}
