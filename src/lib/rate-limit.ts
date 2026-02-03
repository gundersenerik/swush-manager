import { NextRequest } from 'next/server'

/**
 * Simple in-memory rate limiter
 * Note: This works per serverless instance. For production with multiple instances,
 * consider using Upstash Redis (@upstash/ratelimit) for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (per serverless instance)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
const CLEANUP_INTERVAL_MS = 60000 // 1 minute
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return

  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  })
  lastCleanup = now
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
}

/**
 * Get a unique identifier for rate limiting
 * Uses API key if available, otherwise falls back to IP
 */
export function getRateLimitKey(request: NextRequest): string {
  // Prefer API key for rate limiting (more accurate for API clients)
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    // Use a hash prefix to avoid storing the full key
    return `api:${apiKey.substring(0, 12)}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'
  return `ip:${ip}`
}

/**
 * Check if a request is rate limited
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  // Clean up old entries periodically
  cleanupExpiredEntries()

  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const resetTime = now + windowMs

  let entry = rateLimitStore.get(key)

  // If no entry or entry has expired, create new one
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime }
    rateLimitStore.set(key, entry)
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: entry.resetTime,
    }
  }

  // Increment count
  entry.count++

  // Check if over limit
  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // Public API: 100 requests per minute per API key
  publicApi: { limit: 100, windowSeconds: 60 },
  // Admin API: 200 requests per minute
  adminApi: { limit: 200, windowSeconds: 60 },
  // Auth attempts: 5 per minute (stricter for security)
  auth: { limit: 5, windowSeconds: 60 },
} as const
