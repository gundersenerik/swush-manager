import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateGameSchema = z.object({
  name: z.string().min(1).optional(),
  sport_type: z.enum(['FOOTBALL', 'HOCKEY', 'F1', 'OTHER']).optional(),
  subsite_key: z.string().optional(),
  sync_interval_minutes: z.number().min(5).max(1440).optional(),
  is_active: z.boolean().optional(),
})

/**
 * GET /api/admin/games/:id
 * Get a single game with stats
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()
  const { id } = await params

  try {
    // Fetch game first to check existence
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !game) {
      return errorResponse('Game not found', 404)
    }

    // Fetch related data in parallel for better performance
    const [userCountResult, elementCountResult, syncLogsResult, triggersResult] = await Promise.all([
      supabase
        .from('user_game_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', id),
      supabase
        .from('elements')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', id),
      supabase
        .from('sync_logs')
        .select('*')
        .eq('game_id', id)
        .order('started_at', { ascending: false })
        .limit(10),
      supabase
        .from('game_triggers')
        .select('*')
        .eq('game_id', id),
    ])

    return jsonResponse({
      success: true,
      data: {
        ...game,
        stats: {
          user_count: userCountResult.count ?? 0,
          element_count: elementCountResult.count ?? 0,
        },
        sync_logs: syncLogsResult.data ?? [],
        triggers: triggersResult.data ?? [],
      },
    })
  } catch (error) {
    return errorResponse('Failed to fetch game', 500)
  }
}

/**
 * PUT /api/admin/games/:id
 * Update a game
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()
  const { id } = await params

  try {
    const body = await request.json()
    const validated = UpdateGameSchema.parse(body)

    const { data: game, error } = await supabase
      .from('games')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    if (!game) {
      return errorResponse('Game not found', 404)
    }

    return jsonResponse({
      success: true,
      data: game,
      message: 'Game updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to update game', 500)
  }
}

/**
 * DELETE /api/admin/games/:id
 * Delete a game (soft delete by setting is_active = false)
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()
  const { id } = await params

  try {
    const { error } = await supabase
      .from('games')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      message: 'Game deactivated successfully',
    })
  } catch (error) {
    return errorResponse('Failed to delete game', 500)
  }
}
