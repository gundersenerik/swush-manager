import { NextRequest } from 'next/server'
import { createHash, createHmac, randomBytes } from 'crypto'
import { supabaseAdmin, createUserServerClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

/**
 * Hash an API key for storage/comparison
 * Uses HMAC with server secret when available for additional security
 */
export function hashApiKey(key: string): string {
  const hashSecret = process.env.API_KEY_HASH_SECRET

  if (hashSecret) {
    // Use HMAC for better security against rainbow table attacks
    return createHmac('sha256', hashSecret).update(key).digest('hex')
  }

  // Fallback to simple hash (for backwards compatibility)
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Generate a new API key using cryptographically secure random bytes
 */
export function generateApiKey(): string {
  // Use crypto.randomBytes for secure key generation
  // 24 bytes = 32 characters in base64url encoding
  return 'swm_' + randomBytes(24).toString('base64url')
}

/**
 * Get preview of API key (first 8 chars + last 4 chars)
 */
export function getKeyPreview(key: string): string {
  if (key.length < 12) return key
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
}

/**
 * Validate API key from request headers
 * Returns true if valid, false otherwise
 */
export async function validateApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-api-key')

  if (!apiKey) {
    log.auth.warn('[Auth] No API key provided')
    return false
  }

  // Validate key format before database lookup
  if (!apiKey.startsWith('swm_') || apiKey.length < 20) {
    log.auth.warn('[Auth] Invalid API key format')
    return false
  }

  const keyHash = hashApiKey(apiKey)
  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    log.auth.warn('[Auth] Invalid API key')
    return false
  }

  // Update last used timestamp (fire and forget for performance)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: updateError }) => {
      if (updateError) {
        log.auth.error({ err: updateError }, 'Failed to update last_used_at')
      }
    })

  return true
}

/**
 * Verify admin authentication for protected routes
 * Returns the user if authenticated, null otherwise
 */
export async function verifyAdminAuth(): Promise<{ id: string; email?: string } | null> {
  try {
    const supabase = await createUserServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      log.auth.warn({ reason: error?.message || 'No user' }, 'Admin auth failed')
      return null
    }

    return { id: user.id, email: user.email }
  } catch (error) {
    log.auth.error({ err: error }, 'Admin auth error')
    return null
  }
}

/**
 * Middleware helper to require admin authentication
 * Returns an error response if not authenticated, null if authenticated
 */
export async function requireAdminAuth(): Promise<Response | null> {
  const user = await verifyAdminAuth()
  if (!user) {
    return errorResponse('Unauthorized', 401)
  }
  return null
}

/**
 * API response helpers
 */
interface JsonResponseOptions {
  /** Cache duration in seconds. Set to false to disable caching. Default: 300 (5 min) */
  cache?: number | false
}

export function jsonResponse(
  data: unknown,
  status: number = 200,
  options: JsonResponseOptions = {}
) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add cache headers unless explicitly disabled
  if (options.cache !== false) {
    const maxAge = typeof options.cache === 'number' ? options.cache : 300
    headers['Cache-Control'] = `public, max-age=${maxAge}`
  } else {
    headers['Cache-Control'] = 'no-store'
  }

  return Response.json(data, { status, headers })
}

export function errorResponse(message: string, status: number = 400) {
  return Response.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}
