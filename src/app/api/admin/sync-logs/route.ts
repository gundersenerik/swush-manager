import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'

/**
 * GET /api/admin/sync-logs
 * List all sync logs with game info
 */
export async function GET() {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const { data: logs, error } = await supabase
      .from('sync_logs')
      .select(`
        *,
        game:games(name, game_key)
      `)
      .order('started_at', { ascending: false })
      .limit(100)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: logs || [],
    })
  } catch (error) {
    return errorResponse('Failed to fetch sync logs', 500)
  }
}
