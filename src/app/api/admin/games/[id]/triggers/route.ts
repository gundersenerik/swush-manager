import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ id: string }>
}

const CreateTriggerSchema = z.object({
  trigger_type: z.enum(['deadline_reminder_24h', 'round_started', 'round_ended']),
  braze_campaign_id: z.string().min(1),
  is_active: z.boolean().default(true),
})

const UpdateTriggerSchema = z.object({
  trigger_id: z.string().uuid(),
  braze_campaign_id: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
})

/**
 * GET /api/admin/games/:id/triggers
 * Get all triggers for a game
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()
  const { id } = await params

  try {
    const { data: triggers, error } = await supabase
      .from('game_triggers')
      .select('*')
      .eq('game_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: triggers,
    })
  } catch (error) {
    return errorResponse('Failed to fetch triggers', 500)
  }
}

/**
 * POST /api/admin/games/:id/triggers
 * Create a new trigger for a game
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()
  const { id } = await params

  try {
    const body = await request.json()
    const validated = CreateTriggerSchema.parse(body)

    // Check if trigger type already exists for this game
    const { data: existing } = await supabase
      .from('game_triggers')
      .select('id')
      .eq('game_id', id)
      .eq('trigger_type', validated.trigger_type)
      .single()

    if (existing) {
      return errorResponse(`Trigger type '${validated.trigger_type}' already exists for this game`, 400)
    }

    const { data: trigger, error } = await supabase
      .from('game_triggers')
      .insert({
        game_id: id,
        trigger_type: validated.trigger_type,
        braze_campaign_id: validated.braze_campaign_id,
        is_active: validated.is_active,
      })
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: trigger,
      message: 'Trigger created successfully',
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to create trigger', 500)
  }
}

/**
 * PUT /api/admin/games/:id/triggers
 * Update a trigger
 */
export async function PUT(request: NextRequest, _context: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const body = await request.json()
    const validated = UpdateTriggerSchema.parse(body)

    const updateData: { braze_campaign_id?: string; is_active?: boolean } = {}
    if (validated.braze_campaign_id) updateData.braze_campaign_id = validated.braze_campaign_id
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active

    const { data: trigger, error } = await supabase
      .from('game_triggers')
      .update(updateData)
      .eq('id', validated.trigger_id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: trigger,
      message: 'Trigger updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to update trigger', 500)
  }
}

/**
 * DELETE /api/admin/games/:id/triggers
 * Delete a trigger
 */
export async function DELETE(request: NextRequest, _context: RouteContext) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const { searchParams } = new URL(request.url)
    const triggerId = searchParams.get('trigger_id')

    if (!triggerId) {
      return errorResponse('trigger_id is required', 400)
    }

    const { error } = await supabase
      .from('game_triggers')
      .delete()
      .eq('id', triggerId)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      message: 'Trigger deleted successfully',
    })
  } catch (error) {
    return errorResponse('Failed to delete trigger', 500)
  }
}
