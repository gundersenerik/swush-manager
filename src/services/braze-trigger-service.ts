import { supabaseAdmin } from '@/lib/supabase/server'
import { Game, GameTrigger } from '@/types'
import { differenceInHours } from 'date-fns'
import { log } from '@/lib/logger'

// Configuration constants for deadline reminder trigger
// Window to trigger 24h reminder (allows for cron timing variance)
const DEADLINE_REMINDER_MIN_HOURS = 20
const DEADLINE_REMINDER_MAX_HOURS = 28
const BRAZE_REQUEST_TIMEOUT_MS = 30000 // 30 seconds

interface BrazeTriggerProperties {
  game_key: string
  game_name: string
  current_round: number
  total_rounds: number
  trade_deadline: string | null
  trigger_type: string
}

interface BrazeApiResponse {
  dispatch_id?: string
  message?: string
  errors?: string[]
}

interface TriggerResult {
  success: boolean
  triggered: boolean
  message: string
  brazeResponse?: BrazeApiResponse
}

interface CheckResult {
  shouldTrigger: boolean
  reason: string
}

/**
 * Braze Trigger Service
 * Handles automated campaign triggers based on game state
 */
export class BrazeTriggerService {
  private get supabase() {
    return supabaseAdmin()
  }

  private get brazeApiUrl(): string {
    return process.env.BRAZE_REST_ENDPOINT || ''
  }

  private get brazeApiKey(): string {
    return process.env.BRAZE_API_KEY || ''
  }

  /**
   * Trigger a Braze campaign
   */
  private async triggerBrazeCampaign(
    campaignId: string,
    triggerProperties?: BrazeTriggerProperties
  ): Promise<{ success: boolean; response?: BrazeApiResponse; error?: string }> {
    if (!this.brazeApiUrl || !this.brazeApiKey) {
      log.braze.info('Skipping trigger - no Braze credentials configured')
      return { success: true, response: { message: 'Skipped - no Braze credentials' } }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), BRAZE_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${this.brazeApiUrl}/campaigns/trigger/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.brazeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          trigger_properties: triggerProperties || {},
          broadcast: true, // Send to all users in the campaign's segment
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle JSON parsing errors
      let data: BrazeApiResponse
      try {
        data = await response.json()
      } catch {
        log.braze.error('Braze returned non-JSON response')
        return { success: false, error: 'Invalid response from Braze' }
      }

      if (!response.ok) {
        log.braze.error({ response: data }, 'Campaign trigger failed')
        return { success: false, error: data.message || 'Braze API error' }
      }

      log.braze.info({ response: data }, 'Campaign triggered successfully')
      return { success: true, response: data }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        log.braze.error('Braze request timeout')
        return { success: false, error: 'Braze request timeout' }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log.braze.error({ err: errorMessage }, 'Campaign trigger error')
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Log a trigger execution
   */
  private async logTrigger(
    gameId: string,
    triggerId: string,
    triggerType: string,
    roundIndex: number,
    status: 'triggered' | 'failed' | 'skipped',
    brazeResponse?: BrazeApiResponse,
    errorMessage?: string
  ): Promise<void> {
    const { error } = await this.supabase.from('trigger_logs').insert({
      game_id: gameId,
      trigger_id: triggerId,
      trigger_type: triggerType,
      round_index: roundIndex,
      status,
      braze_response: brazeResponse,
      error_message: errorMessage,
    })

    if (error) {
      log.braze.error({ err: error }, 'Failed to log trigger')
    }
  }

  /**
   * Update trigger's last triggered info
   */
  private async updateTriggerLastTriggered(
    triggerId: string,
    roundIndex: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from('game_triggers')
      .update({
        last_triggered_at: new Date().toISOString(),
        last_triggered_round: roundIndex,
      })
      .eq('id', triggerId)

    if (error) {
      log.braze.error({ err: error }, 'Failed to update trigger')
    }
  }

  /**
   * Check if deadline_reminder_24h should trigger
   */
  private checkDeadlineReminder24h(game: Game, trigger: GameTrigger): CheckResult {
    if (!game.next_trade_deadline) {
      return { shouldTrigger: false, reason: 'No trade deadline set' }
    }

    const deadline = new Date(game.next_trade_deadline)
    const now = new Date()
    const hoursUntilDeadline = differenceInHours(deadline, now)

    // Trigger if deadline is within the configured window (allows for cron timing variance)
    if (hoursUntilDeadline < DEADLINE_REMINDER_MIN_HOURS || hoursUntilDeadline > DEADLINE_REMINDER_MAX_HOURS) {
      return {
        shouldTrigger: false,
        reason: `Deadline is ${hoursUntilDeadline}h away (need ${DEADLINE_REMINDER_MIN_HOURS}-${DEADLINE_REMINDER_MAX_HOURS}h)`,
      }
    }

    // Check if already triggered for this round
    if (trigger.last_triggered_round === game.current_round) {
      return {
        shouldTrigger: false,
        reason: `Already triggered for round ${game.current_round}`,
      }
    }

    return { shouldTrigger: true, reason: 'Deadline is within 24h window' }
  }

  /**
   * Check if round_started should trigger
   */
  private checkRoundStarted(game: Game, trigger: GameTrigger): CheckResult {
    // Round is "started" when it's CurrentOpen
    if (game.round_state !== 'CurrentOpen') {
      return { shouldTrigger: false, reason: `Round state is ${game.round_state}, not CurrentOpen` }
    }

    // Check if already triggered for this round
    if (trigger.last_triggered_round === game.current_round) {
      return {
        shouldTrigger: false,
        reason: `Already triggered for round ${game.current_round}`,
      }
    }

    return { shouldTrigger: true, reason: 'Round is now open' }
  }

  /**
   * Check if round_ended should trigger
   */
  private checkRoundEnded(game: Game, trigger: GameTrigger): CheckResult {
    // Round is "ended" when it's Ended or EndedLastest
    if (game.round_state !== 'Ended' && game.round_state !== 'EndedLastest') {
      return { shouldTrigger: false, reason: `Round state is ${game.round_state}, not Ended` }
    }

    // Check if already triggered for this round
    if (trigger.last_triggered_round === game.current_round) {
      return {
        shouldTrigger: false,
        reason: `Already triggered for round ${game.current_round}`,
      }
    }

    return { shouldTrigger: true, reason: 'Round has ended' }
  }

  /**
   * Check if a trigger should fire for a game
   */
  private checkTrigger(game: Game, trigger: GameTrigger): CheckResult {
    switch (trigger.trigger_type) {
      case 'deadline_reminder_24h':
        return this.checkDeadlineReminder24h(game, trigger)
      case 'round_started':
        return this.checkRoundStarted(game, trigger)
      case 'round_ended':
        return this.checkRoundEnded(game, trigger)
      default:
        return { shouldTrigger: false, reason: `Unknown trigger type: ${trigger.trigger_type}` }
    }
  }

  /**
   * Process a single trigger for a game
   */
  async processTrigger(game: Game, trigger: GameTrigger): Promise<TriggerResult> {
    log.braze.info({ triggerType: trigger.trigger_type, gameKey: game.game_key }, 'Processing trigger')

    // Check if trigger should fire
    const check = this.checkTrigger(game, trigger)

    if (!check.shouldTrigger) {
      log.braze.info({ triggerType: trigger.trigger_type, reason: check.reason }, 'Skipping trigger')
      return {
        success: true,
        triggered: false,
        message: check.reason,
      }
    }

    log.braze.info({ triggerType: trigger.trigger_type, reason: check.reason }, 'Triggering campaign')

    // Trigger the Braze campaign
    const triggerProperties = {
      game_key: game.game_key,
      game_name: game.name,
      current_round: game.current_round,
      total_rounds: game.total_rounds,
      trade_deadline: game.next_trade_deadline,
      trigger_type: trigger.trigger_type,
    }

    const result = await this.triggerBrazeCampaign(
      trigger.braze_campaign_id,
      triggerProperties
    )

    // Log the trigger
    await this.logTrigger(
      game.id,
      trigger.id,
      trigger.trigger_type,
      game.current_round || 1,
      result.success ? 'triggered' : 'failed',
      result.response,
      result.error
    )

    // Update last triggered
    if (result.success) {
      await this.updateTriggerLastTriggered(trigger.id, game.current_round || 1)
    }

    return {
      success: result.success,
      triggered: true,
      message: result.success
        ? `Campaign triggered for ${trigger.trigger_type}`
        : `Failed to trigger: ${result.error}`,
      brazeResponse: result.response,
    }
  }

  /**
   * Process all triggers for a game
   */
  async processGameTriggers(game: Game): Promise<TriggerResult[]> {
    // Fetch active triggers for this game
    const { data: triggers, error } = await this.supabase
      .from('game_triggers')
      .select('*')
      .eq('game_id', game.id)
      .eq('is_active', true)

    if (error) {
      log.braze.error({ err: error }, 'Failed to fetch triggers')
      return []
    }

    if (!triggers || triggers.length === 0) {
      return []
    }

    const results: TriggerResult[] = []

    for (const trigger of triggers) {
      const result = await this.processTrigger(game, trigger as GameTrigger)
      results.push(result)
    }

    return results
  }

  /**
   * Process triggers for all active games
   */
  async processAllTriggers(): Promise<{
    gamesProcessed: number
    triggersExecuted: number
    errors: number
  }> {
    log.braze.info('Processing triggers for all active games')

    const { data: games, error } = await this.supabase
      .from('games')
      .select('*')
      .eq('is_active', true)

    if (error || !games) {
      log.braze.error({ err: error }, 'Failed to fetch games')
      return { gamesProcessed: 0, triggersExecuted: 0, errors: 1 }
    }

    let triggersExecuted = 0
    let errors = 0

    for (const game of games) {
      const results = await this.processGameTriggers(game as Game)

      for (const result of results) {
        if (result.triggered) {
          if (result.success) {
            triggersExecuted++
          } else {
            errors++
          }
        }
      }
    }

    log.braze.info(
      { gamesProcessed: games.length, triggersExecuted, errors },
      'Trigger processing completed'
    )

    return {
      gamesProcessed: games.length,
      triggersExecuted,
      errors,
    }
  }
}

// Export singleton instance
export const brazeTriggerService = new BrazeTriggerService()
