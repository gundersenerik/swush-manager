import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { validateApiKey, errorResponse } from '@/lib/api-auth'
import { checkRateLimit, getRateLimitKey, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { log } from '@/lib/logger'
import { BrazeUserResponse, Element } from '@/types'
import { differenceInHours } from 'date-fns'
import { z } from 'zod'

// Validation schemas for URL parameters
const paramsSchema = z.object({
  externalId: z.string().min(1).max(255),
  gameKey: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid game key format'),
})

interface RouteContext {
  params: Promise<{
    externalId: string
    gameKey: string
  }>
}

/**
 * Extract the numeric user ID from various external ID formats.
 * Supports:
 * - Plain numeric IDs: "699590"
 * - Schibsted URN format: "sdrn:schibsted.com:user:699590"
 */
function normalizeExternalId(externalId: string): string {
  // Check for Schibsted URN format: sdrn:schibsted.com:user:XXXXX
  const schibstedMatch = externalId.match(/^sdrn:schibsted\.com:user:(.+)$/)
  if (schibstedMatch && schibstedMatch[1]) {
    return schibstedMatch[1]
  }
  // Return as-is for plain IDs
  return externalId
}

/**
 * GET /api/v1/users/:externalId/games/:gameKey
 *
 * Braze Connected Content endpoint
 * Returns personalized fantasy game data for a user
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  // Validate API key FIRST (before rate limiting to prevent enumeration attacks)
  const isValid = await validateApiKey(request)
  if (!isValid) {
    return errorResponse('Invalid or missing API key', 401)
  }

  // Check rate limit after authentication
  const rateLimitKey = getRateLimitKey(request)
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.publicApi)

  if (!rateLimitResult.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders(rateLimitResult),
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  // Validate URL parameters
  const resolvedParams = await params
  const validation = paramsSchema.safeParse(resolvedParams)
  if (!validation.success) {
    return errorResponse('Invalid request parameters', 400)
  }

  const { gameKey } = validation.data
  // Normalize external ID to handle Braze's Schibsted URN format
  const externalId = normalizeExternalId(validation.data.externalId)
  const supabase = supabaseAdmin()

  try {
    // Fetch game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('game_key', gameKey)
      .eq('is_active', true)
      .single()

    if (gameError || !game) {
      return errorResponse(`Game not found: ${gameKey}`, 404)
    }

    // Fetch user stats
    const { data: userStats, error: userError } = await supabase
      .from('user_game_stats')
      .select('*')
      .eq('external_id', externalId)
      .eq('game_id', game.id)
      .single()

    if (userError || !userStats) {
      return errorResponse(`User not found in game: ${externalId}`, 404)
    }

    // Fetch user's lineup elements
    let lineupElements: Element[] = []
    if (userStats.lineup_element_ids && userStats.lineup_element_ids.length > 0) {
      const { data: elements } = await supabase
        .from('elements')
        .select('*')
        .eq('game_id', game.id)
        .in('element_id', userStats.lineup_element_ids)

      lineupElements = (elements || []) as Element[]
    }

    // Fetch trending elements for this game
    const { data: trendingUp } = await supabase
      .from('elements')
      .select('*')
      .eq('game_id', game.id)
      .order('trend', { ascending: false })
      .limit(5)

    const { data: trendingDown } = await supabase
      .from('elements')
      .select('*')
      .eq('game_id', game.id)
      .order('trend', { ascending: true })
      .limit(5)

    // Calculate percentile (handle null rank to avoid NaN)
    const percentile = game.users_total > 0 && userStats.rank != null
      ? Math.round((1 - (userStats.rank / game.users_total)) * 100)
      : 0

    // Calculate days until deadline
    let daysUntilDeadline: number | null = null
    if (game.next_trade_deadline) {
      const deadline = new Date(game.next_trade_deadline)
      const now = new Date()
      const hours = differenceInHours(deadline, now)
      daysUntilDeadline = hours > 0 ? Math.ceil(hours / 24) : 0
    }

    // Find injured/suspended players in lineup
    const injuredPlayers = lineupElements
      .filter(el => el.is_injured)
      .map(el => el.full_name)

    const suspendedPlayers = lineupElements
      .filter(el => el.is_suspended)
      .map(el => el.full_name)

    // Find top and worst performers in user's lineup
    const sortedByTrend = [...lineupElements].sort((a, b) => b.trend - a.trend)
    const topPerformer = sortedByTrend[0] || null
    const worstPerformer = sortedByTrend[sortedByTrend.length - 1] || null

    // Build response
    const response: BrazeUserResponse = {
      user: {
        team_name: userStats.team_name || '',
        rank: userStats.rank || 0,
        score: userStats.score || 0,
        round_score: userStats.round_score || 0,
        round_rank: userStats.round_rank || 0,
        position_change: userStats.round_jump || 0,
        percentile,
        injured_count: userStats.injured_count || 0,
        suspended_count: userStats.suspended_count || 0,
      },
      game: {
        name: game.name,
        current_round: game.current_round || 1,
        total_rounds: game.total_rounds || 0,
        round_state: game.round_state || 'Unknown',
        trade_deadline: game.next_trade_deadline,
        days_until_deadline: daysUntilDeadline,
      },
      lineup: lineupElements.map(el => ({
        name: el.full_name,
        team: el.team_name || '',
        trend: el.trend,
        value: el.value,
        growth: el.growth,
        is_injured: el.is_injured,
        is_suspended: el.is_suspended,
      })),
      alerts: {
        injured_players: injuredPlayers,
        suspended_players: suspendedPlayers,
        top_performer: topPerformer
          ? { name: topPerformer.full_name, trend: topPerformer.trend }
          : null,
        worst_performer: worstPerformer && sortedByTrend.length > 1
          ? { name: worstPerformer.full_name, trend: worstPerformer.trend }
          : null,
      },
      trending: {
        hot: (trendingUp || []).map((el: Element) => ({
          name: el.full_name,
          team: el.team_name || '',
          trend: el.trend,
        })),
        falling: (trendingDown || []).map((el: Element) => ({
          name: el.full_name,
          team: el.team_name || '',
          trend: el.trend,
        })),
      },
    }

    // Return response with rate limit headers
    return new Response(
      JSON.stringify({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...rateLimitHeaders(rateLimitResult),
        },
      }
    )
  } catch (error) {
    log.api.error({ error, externalId, gameKey }, 'Error fetching user data')
    return errorResponse('Internal server error', 500)
  }
}
