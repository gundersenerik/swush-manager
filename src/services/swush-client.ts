import {
  SwushGameResponse,
  SwushUsersResponse,
  SwushElement,
} from '@/types'
import { log } from '@/lib/logger'

// Configuration constants
const DEFAULT_TIMEOUT_MS = 30000 // 30 seconds
const RATE_LIMIT_DELAY_MS = 100 // Delay between paginated requests to avoid rate limiting
const MAX_PAGE_SIZE = 10 // SWUSH API maximum page size
const MAX_RETRIES = 3 // Number of retries for failed requests
const RETRY_BASE_DELAY_MS = 1000 // Base delay for exponential backoff (1s, 2s, 4s)

interface SwushClientConfig {
  baseUrl: string
  apiKey: string
  timeout?: number
}

interface SwushApiResponse<T> {
  data: T | null
  error: string | null
  status: number
}

/**
 * SWUSH Partner API Client
 * Handles all communication with the SWUSH API
 */
export class SwushClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number

  constructor(config: SwushClientConfig) {
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
    this.timeout = config.timeout || DEFAULT_TIMEOUT_MS
  }

  /**
   * Make a request to the SWUSH API
   */
  private async request<T>(endpoint: string): Promise<SwushApiResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = `${this.baseUrl}${endpoint}`
      log.swush.debug(`[SWUSH] Fetching: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SWUSH-Manager/1.0)',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        log.swush.error(`[SWUSH] Error ${response.status}: ${errorText}`)
        return {
          data: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        }
      }

      // Handle JSON parsing errors
      let data: T
      try {
        data = await response.json()
      } catch {
        log.swush.error('[SWUSH] Invalid JSON response')
        return {
          data: null,
          error: 'Invalid JSON response from SWUSH API',
          status: 500,
        }
      }

      return {
        data,
        error: null,
        status: response.status,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          log.swush.error(`[SWUSH] Request timeout after ${this.timeout}ms`)
          return {
            data: null,
            error: `Request timeout after ${this.timeout}ms`,
            status: 408,
          }
        }
        log.swush.error(`[SWUSH] Request error: ${error.message}`)
        return {
          data: null,
          error: error.message,
          status: 500,
        }
      }

      return {
        data: null,
        error: 'Unknown error occurred',
        status: 500,
      }
    }
  }

  /**
   * Make a request with retry logic and exponential backoff
   * Retries on transient failures (5xx, timeouts, network errors)
   */
  private async requestWithRetry<T>(
    endpoint: string,
    maxRetries: number = MAX_RETRIES
  ): Promise<SwushApiResponse<T>> {
    let lastResponse: SwushApiResponse<T> | null = null

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const response = await this.request<T>(endpoint)

      // Success - return immediately
      if (response.data && !response.error) {
        return response
      }

      lastResponse = response

      // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
      const isClientError = response.status >= 400 && response.status < 500
      const isRetryableClientError = response.status === 408 || response.status === 429

      if (isClientError && !isRetryableClientError) {
        log.swush.warn(`[SWUSH] Non-retryable error ${response.status} on attempt ${attempt}`)
        return response
      }

      // If we have more attempts, wait and retry
      if (attempt <= maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) // 1s, 2s, 4s
        log.swush.warn(
          `[SWUSH] Attempt ${attempt}/${maxRetries + 1} failed with status ${response.status}. ` +
          `Retrying in ${delay}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    log.swush.error(
      `[SWUSH] All ${maxRetries + 1} attempts failed for ${endpoint}`
    )
    return lastResponse!
  }

  /**
   * Verify API key is valid
   */
  async verifyApiKey(): Promise<boolean> {
    const response = await this.request<{ message: string }>('/apikeycheck')
    return response.data?.message === 'Ok: Valid API Key'
  }

  /**
   * Get game details including rounds and top elements
   */
  async getGame(subsiteKey: string, gameKey: string): Promise<SwushApiResponse<SwushGameResponse>> {
    return this.request<SwushGameResponse>(
      `/season/subsites/${subsiteKey}/games/${gameKey}`
    )
  }

  /**
   * Get all elements (players) for a game
   */
  async getElements(subsiteKey: string, gameKey: string): Promise<SwushApiResponse<SwushElement[]>> {
    return this.request<SwushElement[]>(
      `/season/subsites/${subsiteKey}/games/${gameKey}/elements`
    )
  }

  /**
   * Get users for a game (paginated) - with retry logic
   */
  async getUsers(
    subsiteKey: string,
    gameKey: string,
    page: number = 1,
    pageSize: number = MAX_PAGE_SIZE,
    includeUserteams: boolean = true
  ): Promise<SwushApiResponse<SwushUsersResponse>> {
    // SWUSH API has a maximum page size limit
    const actualPageSize = Math.min(pageSize, MAX_PAGE_SIZE)
    return this.requestWithRetry<SwushUsersResponse>(
      `/season/subsites/${subsiteKey}/games/${gameKey}/users?includeUserteams=${includeUserteams}&includeLineups=false&page=${page}&pageSize=${actualPageSize}`
    )
  }

  /**
   * Get all users for a game (handles pagination automatically)
   * Warning: This can be slow for games with many users
   */
  async getAllUsers(
    subsiteKey: string,
    gameKey: string,
    onProgress?: (page: number, totalPages: number) => void
  ): Promise<SwushApiResponse<SwushUsersResponse>> {
    // First request to get total pages
    const firstResponse = await this.getUsers(subsiteKey, gameKey, 1, MAX_PAGE_SIZE)

    if (firstResponse.error || !firstResponse.data) {
      return firstResponse
    }

    const totalPages = firstResponse.data.pages
    const allUsers = [...firstResponse.data.users]

    onProgress?.(1, totalPages)

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const response = await this.getUsers(subsiteKey, gameKey, page, MAX_PAGE_SIZE)

      if (response.error || !response.data) {
        log.swush.error(`[SWUSH] Failed to fetch page ${page}: ${response.error}`)
        continue
      }

      allUsers.push(...response.data.users)
      onProgress?.(page, totalPages)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
    }

    return {
      data: {
        ...firstResponse.data,
        users: allUsers,
        page: 1,
        pages: 1,
      },
      error: null,
      status: 200,
    }
  }
}

/**
 * Create a SWUSH client instance with environment variables
 */
export function createSwushClient(): SwushClient {
  const baseUrl = process.env.SWUSH_API_BASE_URL
  const apiKey = process.env.SWUSH_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('Missing SWUSH API environment variables (SWUSH_API_BASE_URL, SWUSH_API_KEY)')
  }

  return new SwushClient({
    baseUrl,
    apiKey,
    timeout: DEFAULT_TIMEOUT_MS,
  })
}
