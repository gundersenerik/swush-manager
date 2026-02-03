import { jsonResponse, requireAdminAuth } from '@/lib/api-auth'

/**
 * GET /api/admin/settings
 * Retrieve application settings (masked for security)
 */
export async function GET() {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  // Settings are stored as environment variables for security
  // Return masked versions for display
  const settings = {
    swush_api_key: process.env.SWUSH_API_KEY ? '••••••••' + process.env.SWUSH_API_KEY.slice(-4) : '',
    swush_api_base_url: process.env.SWUSH_API_BASE_URL || '',
    braze_api_key: process.env.BRAZE_API_KEY ? '••••••••' + process.env.BRAZE_API_KEY.slice(-4) : '',
    braze_rest_endpoint: process.env.BRAZE_REST_ENDPOINT || '',
    default_sync_interval: parseInt(process.env.DEFAULT_SYNC_INTERVAL || '30'),
  }

  return jsonResponse({
    success: true,
    data: settings,
    message: 'Settings are configured via environment variables for security',
  })
}

/**
 * PUT /api/admin/settings
 * Note: In production, settings should be managed via environment variables
 * This endpoint exists for documentation purposes
 */
export async function PUT() {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  return jsonResponse({
    success: true,
    message: 'Settings should be configured via environment variables in Vercel dashboard',
  })
}
