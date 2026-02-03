import pino from 'pino'

/**
 * Application logger using Pino
 *
 * Log levels (from most to least severe):
 * - fatal: Application is unusable
 * - error: Error conditions (e.g., failed API calls)
 * - warn: Warning conditions (e.g., deprecated usage)
 * - info: Informational messages (e.g., sync started)
 * - debug: Debug messages (e.g., detailed flow)
 * - trace: Trace messages (e.g., function entry/exit)
 */

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

// Configure log level from environment or use defaults
const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')

// Create the base logger
const logger = pino({
  level,
  // In development, use pretty formatting if pino-pretty is available
  // In production, use JSON for better parsing by log aggregators
  ...(isDevelopment && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
  // Add base context
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'swush-manager',
  },
  // Customize timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * Create a child logger with additional context
 */
export function createLogger(context: string, bindings?: Record<string, unknown>) {
  return logger.child({ context, ...bindings })
}

// Pre-configured loggers for different parts of the application
export const log = {
  // General application logger
  app: createLogger('app'),

  // API route logger
  api: createLogger('api'),

  // Authentication logger
  auth: createLogger('auth'),

  // Sync service logger
  sync: createLogger('sync'),

  // SWUSH client logger
  swush: createLogger('swush'),

  // Braze trigger logger
  braze: createLogger('braze'),

  // Cron job logger
  cron: createLogger('cron'),

  // Database logger
  db: createLogger('db'),
}

// Export the base logger for advanced use cases
export { logger }

// Type exports for use in other files
export type Logger = typeof logger
export type ChildLogger = ReturnType<typeof createLogger>
