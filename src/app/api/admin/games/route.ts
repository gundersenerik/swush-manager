import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { z } from 'zod'

const CreateGameSchema = z.object({
  game_key: z.string().min(1),
  name: z.string().min(1),
  sport_type: z.enum(['FOOTBALL', 'HOCKEY', 'F1', 'OTHER']).default('OTHER'),
  subsite_key: z.string().default('aftonbladet'),
  sync_interval_minutes: z.number().min(5).max(1440).default(60),
})

/**
 * GET /api/admin/games
 * List all games
 */
export async function GET(_request: NextRequest) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: games,
    })
  } catch (error) {
    return errorResponse('Failed to fetch games', 500)
  }
}

/**
 * POST /api/admin/games
 * Create a new game
 */
export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const body = await request.json()
    const validated = CreateGameSchema.parse(body)

    // Check if game already exists
    const { data: existing } = await supabase
      .from('games')
      .select('id')
      .eq('game_key', validated.game_key)
      .single()

    if (existing) {
      return errorResponse('Game with this key already exists', 400)
    }

    const { data: game, error } = await supabase
      .from('games')
      .insert({
        game_key: validated.game_key,
        name: validated.name,
        sport_type: validated.sport_type,
        subsite_key: validated.subsite_key,
        sync_interval_minutes: validated.sync_interval_minutes,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: game,
      message: 'Game created successfully',
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to create game', 500)
  }
}
