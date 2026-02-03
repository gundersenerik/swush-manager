import { NextRequest } from 'next/server'
import { syncService } from '@/services/sync-service'
import { jsonResponse, errorResponse } from '@/lib/api-auth'
import { log } from '@/lib/logger'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/sync
 *
 * Scheduled job to sync data from SWUSH for games due for sync
 * Protected by CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 401)
  }

  log.cron.info('Starting scheduled sync job')

  try {
    // Get games that are due for sync
    const gamesDue = await syncService.getGamesDueForSync()

    if (gamesDue.length === 0) {
      log.cron.info('No games due for sync')
      return jsonResponse({
        success: true,
        message: 'No games due for sync',
        gamesChecked: 0,
        gamesSynced: 0,
      })
    }

    log.cron.info({ gamesDue: gamesDue.length }, 'Found games due for sync')

    let totalUsers = 0
    let totalElements = 0
    let syncedGames = 0

    for (const game of gamesDue) {
      const result = await syncService.syncGame(game, 'scheduled')

      if (result.success) {
        syncedGames++
        totalUsers += result.usersSynced || 0
        totalElements += result.elementsSynced || 0
      }
    }

    log.cron.info({ syncedGames, totalUsers, totalElements }, 'Sync job completed')

    return jsonResponse({
      success: true,
      message: `Synced ${syncedGames} games`,
      gamesChecked: gamesDue.length,
      gamesSynced: syncedGames,
      usersSynced: totalUsers,
      elementsSynced: totalElements,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.cron.error({ err: error }, 'Sync job failed')
    return errorResponse('Sync job failed', 500)
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}
