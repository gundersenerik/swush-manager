import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, generateApiKey, hashApiKey, getKeyPreview, requireAdminAuth } from '@/lib/api-auth'
import { z } from 'zod'

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
})

/**
 * GET /api/admin/api-keys
 * List all API keys (without actual keys)
 */
export async function GET(_request: NextRequest) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_preview, is_active, last_used_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: keys,
    })
  } catch (error) {
    return errorResponse('Failed to fetch API keys', 500)
  }
}

/**
 * POST /api/admin/api-keys
 * Create a new API key
 * Returns the actual key ONLY ONCE - must be saved by the user
 */
export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const body = await request.json()
    const validated = CreateApiKeySchema.parse(body)

    // Generate new API key
    const apiKey = generateApiKey()
    const keyHash = hashApiKey(apiKey)
    const keyPreview = getKeyPreview(apiKey)

    const { data: key, error } = await supabase
      .from('api_keys')
      .insert({
        name: validated.name,
        key_hash: keyHash,
        key_preview: keyPreview,
        is_active: true,
      })
      .select('id, name, key_preview, is_active, created_at')
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: {
        ...key,
        api_key: apiKey, // Return actual key only once!
      },
      message: 'API key created. Save this key - it will not be shown again!',
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to create API key', 500)
  }
}

/**
 * DELETE /api/admin/api-keys
 * Revoke an API key
 */
export async function DELETE(request: NextRequest) {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  const supabase = supabaseAdmin()

  try {
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return errorResponse('id is required', 400)
    }

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      message: 'API key revoked successfully',
    })
  } catch (error) {
    return errorResponse('Failed to revoke API key', 500)
  }
}
