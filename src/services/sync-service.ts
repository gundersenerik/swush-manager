import { supabaseAdmin } from '@/lib/supabase/server'
import { createSwushClient } from './swush-client'
import { alertService } from './alert-service'
import { log } from '@/lib/logger'
import {
  Game,
  SwushElement,
  SwushUser,
  SwushRound,
} from '@/types'

// Configuration constants
const BATCH_SIZE = 100 // Number of items to upsert in a single batch
const GAME_BASE_URL = process.env.GAME_BASE_URL || 'https://manager.aftonbladet.se/se'

interface SyncResult {
  success: boolean
  gamesSynced?: number
  elementsSynced?: number
  usersSynced?: number
  error?: string
}

interface SyncLogEntry {
  gameId: string
  syncType: 'manual' | 'scheduled'
  status: 'started' | 'completed' | 'failed'
  usersSynced: number
  elementsSynced: number
  errorMessage?: string
}

/**
 * Sync Service
 * Handles syncing data from SWUSH API to Supabase
 */
export class SyncService {
  private get supabase() {
    return supabaseAdmin()
  }
  private get swush() {
    return createSwushClient()
  }

  /**
   * Create a sync log entry
   */
  private async createSyncLog(entry: SyncLogEntry): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('sync_logs')
      .insert({
        game_id: entry.gameId,
        sync_type: entry.syncType,
        status: entry.status,
        users_synced: entry.usersSynced,
        elements_synced: entry.elementsSynced,
        error_message: entry.errorMessage,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      log.sync.error({ err: error }, 'Failed to create sync log')
      return null
    }

    return data.id
  }

  /**
   * Update a sync log entry
   */
  private async updateSyncLog(
    logId: string,
    updates: Partial<SyncLogEntry> & { completedAt?: string }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sync_logs')
      .update({
        status: updates.status,
        users_synced: updates.usersSynced,
        elements_synced: updates.elementsSynced,
        error_message: updates.errorMessage,
        completed_at: updates.completedAt,
      })
      .eq('id', logId)

    if (error) {
      log.sync.error({ err: error }, 'Failed to update sync log')
    }
  }

  /**
   * Find the current round from rounds array
   */
  private findCurrentRound(rounds: SwushRound[]): SwushRound | null {
    return rounds.find(r => r.state === 'CurrentOpen') || null
  }

  /**
   * Sync game details from SWUSH
   */
  async syncGameDetails(game: Game): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Syncing game details')

    const response = await this.swush.getGame(game.subsite_key, game.game_key)

    if (response.error || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch game' }
    }

    const swushGame = response.data
    const currentRound = this.findCurrentRound(swushGame.rounds)

    // Also find the next pending round for timing info
    const nextPendingRound = swushGame.rounds.find(r => r.state === 'Pending')
    // Find the most recently ended round for post-round sync
    const endedRound = swushGame.rounds.find(r => r.state === 'Ended' || r.state === 'EndedLastest')

    const { error } = await this.supabase
      .from('games')
      .update({
        swush_game_id: swushGame.gameId,
        current_round: swushGame.currentRoundIndex,
        total_rounds: swushGame.rounds.length,
        round_state: currentRound?.state || endedRound?.state || null,
        next_trade_deadline: currentRound?.tradeCloses || nextPendingRound?.tradeCloses || null,
        current_round_start: currentRound?.start || nextPendingRound?.start || null,
        current_round_end: currentRound?.end || endedRound?.end || null,
        users_total: swushGame.userteamsCount,
        game_url: `${GAME_BASE_URL}/${game.game_key}`,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', game.id)

    if (error) {
      log.sync.error({ err: error }, 'Failed to update game')
      return { success: false, error: error.message }
    }

    return { success: true, gamesSynced: 1 }
  }

  /**
   * Sync all elements (players) for a game
   */
  async syncElements(game: Game): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Syncing elements')

    const response = await this.swush.getElements(game.subsite_key, game.game_key)

    if (response.error || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch elements' }
    }

    const elements = response.data
    let syncedCount = 0

    // Upsert elements in batches
    for (let i = 0; i < elements.length; i += BATCH_SIZE) {
      const batch = elements.slice(i, i + BATCH_SIZE)

      const upsertData = batch.map((el: SwushElement) => ({
        game_id: game.id,
        element_id: el.elementId,
        short_name: el.shortName,
        full_name: el.fullName,
        team_name: el.teamName || '',
        image_url: el.imageUrl,
        popularity: el.popularity,
        trend: el.trend,
        growth: el.growth,
        total_growth: el.totalGrowth,
        value: el.value,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await this.supabase
        .from('elements')
        .upsert(upsertData, {
          onConflict: 'game_id,element_id',
        })

      if (error) {
        log.sync.error({ err: error }, 'Failed to upsert elements batch')
        continue
      }

      syncedCount += batch.length
    }

    log.sync.info({ count: syncedCount }, 'Synced elements')
    return { success: true, elementsSynced: syncedCount }
  }

  /**
   * Sync all users for a game - with progressive saving
   * Fetches page by page and saves immediately after each fetch
   * This ensures partial data is preserved if sync is interrupted
   */
  async syncUsers(
    game: Game,
    onProgress?: (current: number, total: number) => void
  ): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Syncing users with progressive saving')

    // First request to get total pages
    const firstResponse = await this.swush.getUsers(game.subsite_key, game.game_key, 1)

    if (firstResponse.error || !firstResponse.data) {
      return { success: false, error: firstResponse.error || 'Failed to fetch users' }
    }

    const totalPages = firstResponse.data.pages
    const totalUsers = firstResponse.data.usersTotal
    log.sync.info({ totalPages, totalUsers, gameKey: game.game_key }, 'Starting progressive user sync')

    let syncedCount = 0
    let errorCount = 0
    let failedPages: number[] = []

    // Process first page
    const firstPageResult = await this.saveUsersPage(game, firstResponse.data.users, 1)
    if (firstPageResult.success) {
      syncedCount += firstPageResult.count
    } else {
      errorCount++
      failedPages.push(1)
    }
    onProgress?.(1, totalPages)

    // Fetch and save remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const response = await this.swush.getUsers(game.subsite_key, game.game_key, page)

      if (response.error || !response.data) {
        log.sync.error({
          page,
          totalPages,
          error: response.error,
          gameKey: game.game_key,
        }, 'Failed to fetch page after retries')
        errorCount++
        failedPages.push(page)
        continue
      }

      // Save this page immediately
      const pageResult = await this.saveUsersPage(game, response.data.users, page)
      if (pageResult.success) {
        syncedCount += pageResult.count
      } else {
        errorCount++
        failedPages.push(page)
      }

      onProgress?.(page, totalPages)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Log summary
    if (failedPages.length > 0) {
      log.sync.warn({
        syncedCount,
        errorCount,
        failedPages,
        totalPages,
        gameKey: game.game_key,
      }, 'Completed users sync with some failed pages')
    } else {
      log.sync.info({
        syncedCount,
        totalPages,
        gameKey: game.game_key,
      }, 'Completed users sync successfully')
    }

    // Consider sync failed if more than 10% of pages failed
    const failureRate = failedPages.length / totalPages
    if (failureRate > 0.1) {
      return {
        success: false,
        error: `Too many failed pages: ${failedPages.length}/${totalPages} (${Math.round(failureRate * 100)}%)`,
        usersSynced: syncedCount,
      }
    }

    return { success: true, usersSynced: syncedCount }
  }

  /**
   * Save a single page of users to the database
   */
  private async saveUsersPage(
    game: Game,
    users: SwushUser[],
    pageNumber: number
  ): Promise<{ success: boolean; count: number }> {
    // Filter users with externalId
    const usersWithExternalId = users.filter((user: SwushUser) => user.externalId)

    if (usersWithExternalId.length === 0) {
      return { success: true, count: 0 }
    }

    const upsertData = usersWithExternalId.map((user: SwushUser) => {
      const userteam = user.userteams?.[0] // Get primary team

      return {
        external_id: String(user.externalId),
        game_id: game.id,
        swush_user_id: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
        team_name: userteam?.name ?? user.name ?? 'Unknown',
        score: userteam?.score ?? 0,
        rank: userteam?.rank ?? null,
        round_score: userteam?.roundScore ?? 0,
        round_rank: userteam?.roundRank ?? null,
        round_jump: userteam?.roundJump ?? 0,
        injured_count: user.injured ?? 0,
        suspended_count: user.suspended ?? 0,
        lineup_element_ids: userteam?.lineupElementIds ?? [],
        synced_at: new Date().toISOString(),
      }
    })

    const { error } = await this.supabase
      .from('user_game_stats')
      .upsert(upsertData, {
        onConflict: 'external_id,game_id',
      })

    if (error) {
      log.sync.error({
        err: error,
        page: pageNumber,
        usersInPage: upsertData.length,
        gameKey: game.game_key,
      }, 'Failed to save users page')
      return { success: false, count: 0 }
    }

    return { success: true, count: upsertData.length }
  }

  /**
   * Run a full sync for a game (game details + elements + users)
   */
  async syncGame(
    game: Game,
    syncType: 'manual' | 'scheduled' = 'manual'
  ): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Starting full sync')

    // Create sync log
    const logId = await this.createSyncLog({
      gameId: game.id,
      syncType,
      status: 'started',
      usersSynced: 0,
      elementsSynced: 0,
    })

    try {
      // Sync game details
      const gameResult = await this.syncGameDetails(game)
      if (!gameResult.success) {
        throw new Error(gameResult.error)
      }

      // Sync elements
      const elementsResult = await this.syncElements(game)
      if (!elementsResult.success) {
        throw new Error(elementsResult.error)
      }

      // Sync users
      const usersResult = await this.syncUsers(game)
      if (!usersResult.success) {
        throw new Error(usersResult.error)
      }

      // Update sync log
      if (logId) {
        await this.updateSyncLog(logId, {
          status: 'completed',
          elementsSynced: elementsResult.elementsSynced || 0,
          usersSynced: usersResult.usersSynced || 0,
          completedAt: new Date().toISOString(),
        })
      }

      log.sync.info({ gameKey: game.game_key }, 'Completed sync')

      return {
        success: true,
        gamesSynced: 1,
        elementsSynced: elementsResult.elementsSynced,
        usersSynced: usersResult.usersSynced,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log.sync.error({ gameKey: game.game_key, error: errorMessage }, 'Failed sync')

      // Update sync log with error
      if (logId) {
        await this.updateSyncLog(logId, {
          status: 'failed',
          errorMessage,
          completedAt: new Date().toISOString(),
        })
      }

      // Send alert for sync failure
      await alertService.alertSyncFailure({
        type: 'sync_failure',
        gameKey: game.game_key,
        gameName: game.name,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        lastSuccessfulSync: game.last_synced_at || undefined,
      })

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Sync all active games
   */
  async syncAllActiveGames(syncType: 'manual' | 'scheduled' = 'scheduled'): Promise<SyncResult> {
    log.sync.info('Starting sync for all active games')

    const { data: games, error } = await this.supabase
      .from('games')
      .select('*')
      .eq('is_active', true)

    if (error) {
      log.sync.error({ err: error }, 'Failed to fetch games')
      return { success: false, error: error.message }
    }

    if (!games || games.length === 0) {
      log.sync.info('No active games to sync')
      return { success: true, gamesSynced: 0 }
    }

    let totalGames = 0
    let totalElements = 0
    let totalUsers = 0

    for (const game of games) {
      const result = await this.syncGame(game as Game, syncType)
      if (result.success) {
        totalGames++
        totalElements += result.elementsSynced || 0
        totalUsers += result.usersSynced || 0
      }
    }

    log.sync.info({ totalGames }, 'Completed sync for all games')

    return {
      success: true,
      gamesSynced: totalGames,
      elementsSynced: totalElements,
      usersSynced: totalUsers,
    }
  }

  /**
   * Check if a game is in a critical sync period (round starting/ending soon)
   * Returns the reason if critical, null otherwise
   */
  private isInCriticalPeriod(game: Game): { critical: boolean; reason: string } {
    const now = new Date()

    // Check if round is starting within 2 hours (pre-round sync for email)
    if (game.current_round_start) {
      const roundStart = new Date(game.current_round_start)
      const hoursUntilStart = (roundStart.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntilStart > 0 && hoursUntilStart <= 2) {
        return { critical: true, reason: `Round starting in ${Math.round(hoursUntilStart * 60)} minutes` }
      }
    }

    // Check if trade deadline is within 2 hours
    if (game.next_trade_deadline) {
      const deadline = new Date(game.next_trade_deadline)
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 2) {
        return { critical: true, reason: `Trade deadline in ${Math.round(hoursUntilDeadline * 60)} minutes` }
      }
    }

    // Check if round ended within last hour (post-round sync for results email)
    if (game.current_round_end && (game.round_state === 'Ended' || game.round_state === 'EndedLastest')) {
      const roundEnd = new Date(game.current_round_end)
      const hoursSinceEnd = (now.getTime() - roundEnd.getTime()) / (1000 * 60 * 60)

      if (hoursSinceEnd >= 0 && hoursSinceEnd <= 1) {
        return { critical: true, reason: `Round ended ${Math.round(hoursSinceEnd * 60)} minutes ago` }
      }
    }

    return { critical: false, reason: '' }
  }

  /**
   * Get games that need syncing - smart logic aware of round timing
   *
   * Sync priorities:
   * 1. CRITICAL: Round starting within 2 hours (pre-round email)
   * 2. CRITICAL: Trade deadline within 2 hours
   * 3. CRITICAL: Round ended within last hour (results email)
   * 4. ROUTINE: Last sync exceeds sync_interval_minutes
   */
  async getGamesDueForSync(): Promise<Game[]> {
    const { data: games, error } = await this.supabase
      .from('games')
      .select('*')
      .eq('is_active', true)

    if (error || !games) {
      log.sync.error({ err: error }, 'Failed to fetch games for sync check')
      return []
    }

    const now = new Date()
    const gamesDue: Game[] = []

    for (const game of games as Game[]) {
      // Never synced - always sync
      if (!game.last_synced_at) {
        log.sync.info({ gameKey: game.game_key }, 'Game never synced, adding to queue')
        gamesDue.push(game)
        continue
      }

      const lastSync = new Date(game.last_synced_at)
      const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60)

      // Check for critical period
      const { critical, reason } = this.isInCriticalPeriod(game)

      if (critical) {
        // In critical period - sync if last sync was more than 30 minutes ago
        if (minutesSinceSync >= 30) {
          log.sync.info({
            gameKey: game.game_key,
            reason,
            minutesSinceSync: Math.round(minutesSinceSync),
          }, 'Critical period sync needed')
          gamesDue.push(game)
        }
        continue
      }

      // Routine sync based on configured interval
      if (minutesSinceSync >= game.sync_interval_minutes) {
        log.sync.debug({
          gameKey: game.game_key,
          minutesSinceSync: Math.round(minutesSinceSync),
          interval: game.sync_interval_minutes,
        }, 'Routine sync due')
        gamesDue.push(game)
      }
    }

    return gamesDue
  }
}

// Export singleton instance
export const syncService = new SyncService()
