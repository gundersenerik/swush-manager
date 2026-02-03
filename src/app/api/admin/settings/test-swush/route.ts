import { SwushClient } from '@/services/swush-client'
import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'

/**
 * POST /api/admin/settings/test-swush
 * Test SWUSH API connection
 */
export async function POST() {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  try {
    const apiKey = process.env.SWUSH_API_KEY
    const baseUrl = process.env.SWUSH_API_BASE_URL

    if (!apiKey || !baseUrl) {
      return errorResponse('SWUSH API credentials not configured (SWUSH_API_KEY, SWUSH_API_BASE_URL)', 400)
    }

    const client = new SwushClient({ apiKey, baseUrl })
    const isValid = await client.verifyApiKey()

    if (isValid) {
      return jsonResponse({
        success: true,
        message: 'SWUSH API connection successful',
      })
    } else {
      return errorResponse('SWUSH API key is invalid', 401)
    }
  } catch (error) {
    return errorResponse('Failed to connect to SWUSH API', 500)
  }
}
