import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createSwushClient } from '@/services/swush-client'
import { jsonResponse, requireAdminAuth } from '@/lib/api-auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/games/:id/debug-sync
 * Debug endpoint to see exactly what happens during sync
 * Returns detailed info at each step
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()
  const { id } = await params

  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    steps: [],
  }

  const addStep = (name: string, data: unknown) => {
    (debug.steps as unknown[]).push({ step: name, ...data as object })
  }

  try {
    // Step 1: Fetch game from database
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single()

    if (gameError || !game) {
      addStep('fetch_game', { success: false, error: gameError?.message || 'Game not found' })
      return jsonResponse(debug, 404)
    }

    addStep('fetch_game', {
      success: true,
      game_key: game.game_key,
      subsite_key: game.subsite_key,
      is_active: game.is_active,
    })

    // Step 2: Check SWUSH client configuration
    const swushBaseUrl = process.env.SWUSH_API_BASE_URL
    const swushApiKey = process.env.SWUSH_API_KEY

    addStep('swush_config', {
      base_url_set: !!swushBaseUrl,
      base_url_value: swushBaseUrl || 'NOT SET',
      api_key_set: !!swushApiKey,
      api_key_preview: swushApiKey ? `${swushApiKey.substring(0, 8)}...${swushApiKey.substring(swushApiKey.length - 4)}` : 'NOT SET',
      api_key_length: swushApiKey?.length || 0,
      api_key_expected_length: 40,
    })

    if (!swushBaseUrl || !swushApiKey) {
      return jsonResponse(debug, 200)
    }

    // Step 3: Try to fetch game details from SWUSH
    const swush = createSwushClient()
    const gameResponse = await swush.getGame(game.subsite_key, game.game_key)

    addStep('swush_game_api', {
      success: !gameResponse.error,
      status: gameResponse.status,
      error: gameResponse.error,
      data_preview: gameResponse.data ? {
        gameId: gameResponse.data.gameId,
        userteamsCount: gameResponse.data.userteamsCount,
        currentRoundIndex: gameResponse.data.currentRoundIndex,
        roundsCount: gameResponse.data.rounds?.length,
      } : null,
    })

    // Step 4: Try to fetch users from SWUSH with RAW fetch to see exactly what happens
    const usersUrl = `${swushBaseUrl}/season/subsites/${game.subsite_key}/games/${game.game_key}/users?includeUserteams=true&includeLineups=false&page=1&pageSize=10`

    addStep('swush_users_request', {
      url: usersUrl,
      headers: {
        'x-api-key': `${swushApiKey?.substring(0, 8)}...${swushApiKey?.substring(swushApiKey.length - 4)}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SWUSH-Manager/1.0)',
      },
    })

    let usersRawResponse: Response | null = null
    let usersResponseBody: string | null = null
    let usersResponseHeaders: Record<string, string> = {}

    try {
      usersRawResponse = await fetch(usersUrl, {
        method: 'GET',
        headers: {
          'x-api-key': swushApiKey!,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SWUSH-Manager/1.0)',
        },
      })

      // Capture response headers
      usersRawResponse.headers.forEach((value, key) => {
        usersResponseHeaders[key] = value
      })

      usersResponseBody = await usersRawResponse.text()
    } catch (fetchError) {
      addStep('swush_users_fetch_error', {
        error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
      })
    }

    addStep('swush_users_api', {
      success: usersRawResponse?.ok ?? false,
      status: usersRawResponse?.status,
      statusText: usersRawResponse?.statusText,
      response_headers: usersResponseHeaders,
      response_body_preview: usersResponseBody?.substring(0, 500),
    })

    // Parse the response if successful
    let usersData: { users?: unknown[]; page?: number; pages?: number; pageSize?: number; usersTotal?: number } | null = null
    if (usersRawResponse?.ok && usersResponseBody) {
      try {
        usersData = JSON.parse(usersResponseBody)
      } catch {
        addStep('swush_users_parse_error', { error: 'Failed to parse JSON' })
      }
    }

    if (usersData) {
      addStep('swush_users_parsed', {
        pagination: {
          page: usersData.page,
          pages: usersData.pages,
          pageSize: usersData.pageSize,
          usersTotal: usersData.usersTotal,
        },
      })
    }

    // Step 5: Analyze user data structure
    interface DebugUserteam {
      id: number
      name: string
      score: number
      rank: number
      roundScore?: number
      roundRank?: number
      roundJump?: number
      lineupElementIds?: number[]
    }
    interface DebugUser {
      id: number
      name: string
      externalId?: string
      injured?: number
      suspended?: number
      userteams?: DebugUserteam[]
    }
    if (usersData?.users && Array.isArray(usersData.users)) {
      const users = usersData.users as DebugUser[]
      const usersWithExternalId = users.filter(u => u.externalId)

      addStep('users_analysis', {
        users_in_response: users.length,
        users_with_externalId: usersWithExternalId.length,
        users_without_externalId: users.length - usersWithExternalId.length,
        sample_user: users[0] ? {
          id: users[0].id,
          id_type: typeof users[0].id,
          name: users[0].name,
          externalId: users[0].externalId,
          externalId_type: typeof users[0].externalId,
          has_userteams: !!users[0].userteams,
          userteams_count: users[0].userteams?.length || 0,
          userteam_sample: users[0].userteams?.[0] ? {
            id: users[0].userteams[0].id,
            name: users[0].userteams[0].name,
            score: users[0].userteams[0].score,
            rank: users[0].userteams[0].rank,
          } : null,
        } : null,
      })

      // Step 6: Try to upsert a single test user (if we have one with externalId)
      const testUser = usersWithExternalId[0]
      if (testUser) {
        const userteam = testUser.userteams?.[0]

        const testUpsertData = {
          external_id: String(testUser.externalId),
          game_id: game.id,
          swush_user_id: typeof testUser.id === 'string' ? parseInt(testUser.id, 10) : testUser.id,
          team_name: userteam?.name ?? testUser.name ?? 'Unknown',
          score: userteam?.score ?? 0,
          rank: userteam?.rank ?? null,
          round_score: userteam?.roundScore ?? 0,
          round_rank: userteam?.roundRank ?? null,
          round_jump: userteam?.roundJump ?? 0,
          injured_count: testUser.injured ?? 0,
          suspended_count: testUser.suspended ?? 0,
          lineup_element_ids: userteam?.lineupElementIds ?? [],
          synced_at: new Date().toISOString(),
        }

        addStep('test_upsert_data', {
          data_to_insert: testUpsertData,
        })

        const { data: upsertResult, error: upsertError } = await supabase
          .from('user_game_stats')
          .upsert(testUpsertData, {
            onConflict: 'external_id,game_id',
          })
          .select()

        addStep('test_upsert_result', {
          success: !upsertError,
          error: upsertError ? {
            message: upsertError.message,
            code: upsertError.code,
            details: upsertError.details,
            hint: upsertError.hint,
          } : null,
          inserted_data: upsertResult,
        })
      }
    }

    // Step 7: Check current state of user_game_stats for this game
    const { data: existingStats, error: statsError, count } = await supabase
      .from('user_game_stats')
      .select('*', { count: 'exact' })
      .eq('game_id', game.id)
      .limit(5)

    addStep('current_user_stats', {
      success: !statsError,
      error: statsError?.message,
      total_count: count,
      sample_records: existingStats,
    })

    return jsonResponse(debug, 200, { cache: false })
  } catch (error) {
    addStep('unexpected_error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return jsonResponse(debug, 500, { cache: false })
  }
}
