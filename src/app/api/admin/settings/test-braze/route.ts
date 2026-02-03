import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'

/**
 * POST /api/admin/settings/test-braze
 * Test Braze API connection
 */
export async function POST() {
  // Verify admin authentication
  const authError = await requireAdminAuth()
  if (authError) return authError

  try {
    const apiKey = process.env.BRAZE_API_KEY
    const endpoint = process.env.BRAZE_REST_ENDPOINT || 'https://rest.fra-02.braze.eu'

    if (!apiKey) {
      return errorResponse('Braze API key not configured', 400)
    }

    // Test the connection by fetching subscription groups (lightweight endpoint)
    const response = await fetch(`${endpoint}/subscription/status/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        subscription_group_id: 'test',
        external_id: ['test'],
      }),
    })

    // A 400 error with specific message means the API key is valid but the request is invalid
    // That's fine - it means authentication worked
    if (response.ok || response.status === 400) {
      return jsonResponse({
        success: true,
        message: 'Braze API connection successful',
      })
    }

    if (response.status === 401) {
      return errorResponse('Braze API key is invalid', 401)
    }

    return errorResponse(`Braze API returned status ${response.status}`, 500)
  } catch (error) {
    return errorResponse('Failed to connect to Braze API', 500)
  }
}
