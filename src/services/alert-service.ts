import { log } from '@/lib/logger'

/**
 * Alert Service
 * Sends alerts to configured webhook for sync failures and other critical events
 */

interface SyncFailureAlert {
  type: 'sync_failure'
  gameKey: string
  gameName?: string
  error: string
  failedPages?: number[]
  totalPages?: number
  usersSynced?: number
  timestamp: string
  lastSuccessfulSync?: string
}

interface AlertPayload {
  event: string
  severity: 'info' | 'warning' | 'error'
  message: string
  details: Record<string, unknown>
  timestamp: string
}

class AlertService {
  private webhookUrl: string | null = null

  constructor() {
    this.webhookUrl = process.env.ALERT_WEBHOOK_URL || null
  }

  /**
   * Check if alerts are configured
   */
  isConfigured(): boolean {
    return !!this.webhookUrl
  }

  /**
   * Send an alert to the configured webhook
   */
  private async sendAlert(payload: AlertPayload): Promise<boolean> {
    if (!this.webhookUrl) {
      log.sync.debug('Alert webhook not configured, skipping alert')
      return false
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        log.sync.error({
          status: response.status,
          statusText: response.statusText,
        }, 'Failed to send alert to webhook')
        return false
      }

      log.sync.info({ event: payload.event }, 'Alert sent successfully')
      return true
    } catch (error) {
      log.sync.error({
        err: error,
        webhookUrl: this.webhookUrl.substring(0, 30) + '...',
      }, 'Error sending alert to webhook')
      return false
    }
  }

  /**
   * Send a Slack-formatted alert (compatible with Slack incoming webhooks)
   */
  private async sendSlackAlert(payload: AlertPayload): Promise<boolean> {
    if (!this.webhookUrl) {
      return false
    }

    // Format for Slack
    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '🚨',
    }

    const slackPayload = {
      text: `${severityEmoji[payload.severity]} *${payload.event}*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${severityEmoji[payload.severity]} ${payload.event}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.message,
          },
        },
        {
          type: 'section',
          fields: Object.entries(payload.details).slice(0, 10).map(([key, value]) => ({
            type: 'mrkdwn',
            text: `*${key}:*\n${value}`,
          })),
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Timestamp: ${payload.timestamp}`,
            },
          ],
        },
      ],
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackPayload),
      })

      if (!response.ok) {
        // If Slack format fails, try plain JSON
        return this.sendAlert(payload)
      }

      log.sync.info({ event: payload.event }, 'Slack alert sent successfully')
      return true
    } catch {
      // Fall back to plain JSON
      return this.sendAlert(payload)
    }
  }

  /**
   * Alert on sync failure
   */
  async alertSyncFailure(alert: SyncFailureAlert): Promise<void> {
    const payload: AlertPayload = {
      event: 'Sync Failure',
      severity: 'error',
      message: `Sync failed for game *${alert.gameKey}*: ${alert.error}`,
      details: {
        game_key: alert.gameKey,
        game_name: alert.gameName || 'N/A',
        error: alert.error,
        failed_pages: alert.failedPages?.join(', ') || 'N/A',
        total_pages: alert.totalPages || 'N/A',
        users_synced: alert.usersSynced || 0,
        last_successful_sync: alert.lastSuccessfulSync || 'Never',
      },
      timestamp: alert.timestamp,
    }

    // Try Slack format first (works with Slack incoming webhooks)
    await this.sendSlackAlert(payload)
  }

  /**
   * Alert on critical sync (for monitoring)
   */
  async alertCriticalSync(gameKey: string, reason: string): Promise<void> {
    const payload: AlertPayload = {
      event: 'Critical Sync Started',
      severity: 'info',
      message: `Critical sync triggered for *${gameKey}*`,
      details: {
        game_key: gameKey,
        reason: reason,
      },
      timestamp: new Date().toISOString(),
    }

    await this.sendSlackAlert(payload)
  }

  /**
   * Alert when sync recovers after failure
   */
  async alertSyncRecovered(gameKey: string, usersSynced: number): Promise<void> {
    const payload: AlertPayload = {
      event: 'Sync Recovered',
      severity: 'info',
      message: `Sync recovered for *${gameKey}*`,
      details: {
        game_key: gameKey,
        users_synced: usersSynced,
      },
      timestamp: new Date().toISOString(),
    }

    await this.sendSlackAlert(payload)
  }
}

// Export singleton instance
export const alertService = new AlertService()
