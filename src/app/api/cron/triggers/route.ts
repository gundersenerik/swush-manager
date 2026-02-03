import { NextRequest } from 'next/server'
import { brazeTriggerService } from '@/services/braze-trigger-service'
import { jsonResponse, errorResponse } from '@/lib/api-auth'
import { log } from '@/lib/logger'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/triggers
 *
 * Scheduled job to check and execute Braze campaign triggers
 * Protected by CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 401)
  }

  log.cron.info('Starting trigger check job')

  try {
    const result = await brazeTriggerService.processAllTriggers()

    log.cron.info(result, 'Trigger job completed')

    return jsonResponse({
      success: true,
      message: `Processed ${result.gamesProcessed} games, executed ${result.triggersExecuted} triggers`,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.cron.error({ err: error }, 'Trigger job failed')
    return errorResponse('Trigger job failed', 500)
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}
