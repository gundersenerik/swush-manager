import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { syncService } from '@/services/sync-service'
import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { log } from '@/lib/logger'
import { Game } from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/games/:id/sync
 * Trigger a manual sync for a game
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()
  const { id } = await params

  try {
    // Fetch the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single()

    if (gameError || !game) {
      return errorResponse('Game not found', 404)
    }

    log.sync.info({ gameKey: game.game_key }, 'Manual sync triggered')

    // Run the sync
    const result = await syncService.syncGame(game as Game, 'manual')

    if (!result.success) {
      return errorResponse(result.error || 'Sync failed', 500)
    }

    return jsonResponse({
      success: true,
      message: 'Sync completed successfully',
      data: {
        elements_synced: result.elementsSynced,
        users_synced: result.usersSynced,
      },
    })
  } catch (error) {
    log.sync.error({ error }, 'Admin sync error')
    return errorResponse('Failed to sync game', 500)
  }
}
