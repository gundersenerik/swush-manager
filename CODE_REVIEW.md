# Code Review: SWUSH Manager API

**Review Date:** 2026-02-02
**Reviewer:** Claude Code
**Commit Reviewed:** 430e35a (Initial commit)

---

## Executive Summary

This is a well-structured Next.js 15 application serving as a data synchronization platform between SWUSH Partner API and Braze marketing automation. The codebase demonstrates good architectural decisions, proper TypeScript usage, and thoughtful security measures. However, there are several areas requiring attention, particularly around testing, error handling, and potential production scalability issues.

**Overall Assessment:** ⭐⭐⭐⭐ (4/5) - Good, with room for improvement

### Key Findings Summary

| Category | Status | Priority Items |
|----------|--------|----------------|
| Security | ✅ Good | Minor: Timing attack vulnerability, rate limit bypass |
| Code Quality | ✅ Good | Minor: Some type assertions, silent error handling |
| Performance | ⚠️ Moderate | Major: In-memory rate limiting, sequential processing |
| Testing | ❌ Missing | Critical: No tests present |
| Error Handling | ⚠️ Moderate | Moderate: Inconsistent error reporting |
| Documentation | ✅ Good | Well documented with JSDoc and README |

---

## 1. Security Review

### 1.1 Strengths

**API Key Management** (`src/lib/api-auth.ts`)
- ✅ API keys are properly hashed using SHA-256 before storage (line 10-20)
- ✅ Optional HMAC with secret for rainbow table protection (line 13-15)
- ✅ Cryptographically secure key generation using `crypto.randomBytes` (line 25-28)
- ✅ Keys are returned only once at creation (line 80 in api-keys/route.ts)
- ✅ Key preview shows only first 8 + last 4 characters (line 34-37)

**Authentication & Authorization**
- ✅ Proper separation between public API (API key) and admin routes (Supabase Auth)
- ✅ Cron endpoints protected by `CRON_SECRET` (cron/sync/route.ts:17-21)
- ✅ Row-Level Security (RLS) enabled on all database tables
- ✅ Service role key used only server-side

**Input Validation**
- ✅ Zod schema validation on all API inputs
- ✅ URL parameter validation with regex patterns (e.g., `^[a-z0-9-]+$` for gameKey)

### 1.2 Issues

#### CRITICAL: None Found

#### HIGH: Potential Timing Attack on API Key Validation

**File:** `src/lib/api-auth.ts:57-70`
```typescript
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
```

**Issue:** The database query timing could potentially leak information about whether a key hash exists. While the hash comparison is constant-time at the database level, the response time difference between "key found but inactive" vs "key not found" could be measurable.

**Recommendation:** Consider using constant-time comparison and ensuring consistent response times for both valid and invalid keys.

#### MEDIUM: Rate Limiting Bypass via Header Manipulation

**File:** `src/lib/rate-limit.ts:51-64`
```typescript
export function getRateLimitKey(request: NextRequest): string {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    return `api:${apiKey.substring(0, 12)}`
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'
  return `ip:${ip}`
}
```

**Issue:**
1. Using only the first 12 characters of the API key means different keys with the same prefix share rate limits
2. `x-forwarded-for` can be spoofed if the application is not behind a trusted proxy

**Recommendation:**
1. Hash the full API key for rate limit tracking
2. Verify that Vercel's edge network is properly stripping/replacing x-forwarded-for headers

#### LOW: Missing CSRF Protection on Admin Routes

Admin routes use Supabase Auth which handles session management, but explicit CSRF tokens are not implemented. Supabase's cookie-based auth should provide SameSite protection, but adding explicit CSRF tokens would be defense-in-depth.

---

## 2. Code Quality Review

### 2.1 Strengths

- ✅ **TypeScript:** Strict mode enabled with comprehensive type definitions
- ✅ **Code Organization:** Clear separation of concerns (services, lib, types, routes)
- ✅ **Logging:** Structured logging with Pino and context-specific loggers
- ✅ **Documentation:** JSDoc comments on all major functions
- ✅ **Naming Conventions:** Consistent and descriptive naming

### 2.2 Issues

#### MEDIUM: Type Assertions Instead of Proper Typing

**File:** `src/services/sync-service.ts:355, 389`
```typescript
const result = await this.syncGame(game as Game, syncType)
// ...
return games.filter((game: Game) => {
```

**Issue:** Using `as Game` type assertions bypasses type checking. The Supabase response type should be properly inferred or validated.

**Recommendation:** Create proper database types using Supabase's type generator:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

#### MEDIUM: Silent Error Swallowing

**File:** `src/lib/supabase/server.ts:41-43`
```typescript
} catch {
  // Handle cookie setting in read-only context
}
```

**File:** `src/services/sync-service.ts:177-180`
```typescript
if (error) {
  log.sync.error({ err: error }, 'Failed to upsert elements batch')
  continue  // Silently continues to next batch
}
```

**Issue:** Errors are logged but not surfaced to callers. This can make debugging difficult in production.

**Recommendation:** Track partial failures and include them in the return value:
```typescript
interface SyncResult {
  success: boolean
  partialFailures?: { batch: number; error: string }[]
  // ...
}
```

#### LOW: Inconsistent Error Response Format

Some routes return `{ success: false, error: message }` while others return `{ error: message }`. The `errorResponse` helper is used inconsistently.

**Recommendation:** Standardize all error responses through the `errorResponse` helper.

#### LOW: Unused Variable in Logger

**File:** `src/lib/logger.ts:16`
```typescript
const isDevelopment = process.env.NODE_ENV === 'development'
```

The `isDevelopment` variable is used but `isProduction` (line 15) is declared but only indirectly used in the level assignment.

---

## 3. Performance Review

### 3.1 Strengths

- ✅ **Batch Processing:** Elements and users are upserted in batches of 100
- ✅ **Rate Limit Delays:** SWUSH API requests include 100ms delay between pages
- ✅ **Response Caching:** 5-minute cache on public API responses
- ✅ **Indexed Queries:** Database has appropriate indexes for common queries

### 3.2 Issues

#### HIGH: In-Memory Rate Limiting Won't Work at Scale

**File:** `src/lib/rate-limit.ts:15`
```typescript
const rateLimitStore = new Map<string, RateLimitEntry>()
```

**Issue:** This in-memory store is per-serverless-instance. In a Vercel deployment with multiple instances, rate limits are not shared, allowing attackers to bypass limits by hitting different instances.

**Recommendation:** Implement distributed rate limiting using Upstash Redis:
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '60 s'),
})
```

The code already has a comment acknowledging this (line 7), but it should be prioritized for production.

#### MEDIUM: Sequential Game Processing

**File:** `src/services/sync-service.ts:354-361`
```typescript
for (const game of games) {
  const result = await this.syncGame(game as Game, syncType)
  // ...
}
```

**Issue:** Games are synced sequentially. For multiple active games, this significantly increases cron job duration.

**Recommendation:** Process games in parallel with concurrency control:
```typescript
import pLimit from 'p-limit'

const limit = pLimit(3) // Max 3 concurrent syncs
const results = await Promise.all(
  games.map(game => limit(() => this.syncGame(game, syncType)))
)
```

#### MEDIUM: N+1 Query Pattern in Public API

**File:** `src/app/api/v1/users/[externalId]/games/[gameKey]/route.ts:69-118`

The endpoint makes 4 sequential database queries:
1. Fetch game
2. Fetch user stats
3. Fetch lineup elements
4. Fetch trending elements (2 queries)

**Recommendation:** Combine queries using Supabase's join capabilities or create a database function for this common operation.

#### LOW: No Connection Pooling Configuration

The Supabase client is created fresh for each request via `supabaseAdmin()`. While Supabase handles connection pooling internally, explicit configuration for serverless environments would be beneficial.

---

## 4. Architecture Review

### 4.1 Strengths

- ✅ **Clear Service Layer:** Business logic separated from route handlers
- ✅ **Singleton Pattern:** Services exported as singletons for consistency
- ✅ **Environment Configuration:** Clear env var documentation in `.env.example`
- ✅ **Soft Deletes:** Games use `is_active` flag instead of hard deletes

### 4.2 Issues

#### MEDIUM: No Circuit Breaker for External APIs

**File:** `src/services/swush-client.ts`, `src/services/braze-trigger-service.ts`

**Issue:** If SWUSH or Braze APIs become unavailable or slow, the application will continue making requests, potentially causing cascading failures during cron jobs.

**Recommendation:** Implement circuit breaker pattern:
```typescript
import CircuitBreaker from 'opossum'

const breaker = new CircuitBreaker(this.request.bind(this), {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
})
```

#### MEDIUM: Hardcoded Configuration Values

**File:** `src/services/sync-service.ts:12`
```typescript
const BATCH_SIZE = 100
```

**File:** `src/services/braze-trigger-service.ts:8-9`
```typescript
const DEADLINE_REMINDER_MIN_HOURS = 20
const DEADLINE_REMINDER_MAX_HOURS = 28
```

**Issue:** These values are hardcoded and require code changes to modify.

**Recommendation:** Move to environment variables or database configuration.

#### LOW: Missing Health Check Endpoint

No `/api/health` endpoint exists for monitoring and load balancer health checks.

**Recommendation:** Add a health check endpoint that verifies:
- Database connectivity
- External API availability (optional)
- Memory/resource usage

---

## 5. Testing Review

### 5.1 Current State

**CRITICAL: No automated tests exist in the codebase.**

- No test files found (`*.test.ts`, `*.spec.ts`)
- No test framework configured (Jest, Vitest)
- No test scripts in `package.json`
- No test coverage reporting

### 5.2 Recommendations

#### Priority 1: Unit Tests for Core Services

```typescript
// Example: src/services/__tests__/swush-client.test.ts
describe('SwushClient', () => {
  it('should handle API timeout gracefully', async () => {
    // ...
  })

  it('should paginate through all users', async () => {
    // ...
  })
})
```

#### Priority 2: Integration Tests for API Routes

```typescript
// Example: src/app/api/v1/__tests__/users.test.ts
describe('GET /api/v1/users/:id/games/:key', () => {
  it('should return 401 without API key', async () => {
    // ...
  })

  it('should return user data with valid key', async () => {
    // ...
  })
})
```

#### Priority 3: E2E Tests for Critical Flows

- Full sync workflow
- Trigger processing
- Admin authentication flow

#### Recommended Setup

```json
// package.json additions
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "msw": "^2.0.0"
  }
}
```

---

## 6. Error Handling Review

### 6.1 Strengths

- ✅ Try-catch blocks around async operations
- ✅ Structured error logging with context
- ✅ Timeout handling for external API calls

### 6.2 Issues

#### MEDIUM: Generic Error Messages to Clients

**File:** `src/app/api/v1/users/[externalId]/games/[gameKey]/route.ts:218-221`
```typescript
} catch (error) {
  log.api.error({ error, externalId, gameKey }, 'Error fetching user data')
  return errorResponse('Internal server error', 500)
}
```

**Issue:** All errors return "Internal server error" which makes client-side debugging difficult.

**Recommendation:** Return error codes that clients can use for debugging:
```typescript
return errorResponse('Internal server error', 500, { code: 'USER_FETCH_FAILED' })
```

#### MEDIUM: Missing Request ID for Tracing

No correlation ID is generated for requests, making it difficult to trace issues across logs.

**Recommendation:** Generate and include a request ID:
```typescript
const requestId = crypto.randomUUID()
log.api.info({ requestId, externalId, gameKey }, 'Processing request')
// Include in response headers: X-Request-ID
```

#### LOW: Unhandled Promise in API Key Update

**File:** `src/lib/api-auth.ts:73-81`
```typescript
supabase
  .from('api_keys')
  .update({ last_used_at: new Date().toISOString() })
  .eq('id', data.id)
  .then(({ error: updateError }) => {
    if (updateError) {
      log.auth.error({ err: updateError }, 'Failed to update last_used_at')
    }
  })
```

**Issue:** If the promise rejects (not just returns an error), it will be unhandled.

**Recommendation:** Add `.catch()` handler:
```typescript
.catch(err => log.auth.error({ err }, 'Failed to update last_used_at'))
```

---

## 7. Database Schema Review

### 7.1 Strengths

- ✅ Appropriate use of UUIDs for primary keys
- ✅ Foreign key constraints with CASCADE deletes
- ✅ Unique constraints preventing duplicate data
- ✅ Indexes on frequently queried columns
- ✅ RLS policies properly configured
- ✅ Auto-update triggers for `updated_at`

### 7.2 Issues

#### LOW: Missing Index for Sync Interval Check

**File:** `supabase/schema.sql`

The `getGamesDueForSync()` function queries:
```sql
SELECT * FROM games WHERE is_active = true
```

Then filters in application code by `last_synced_at` and `sync_interval_minutes`. A composite index would be more efficient:

```sql
CREATE INDEX IF NOT EXISTS idx_games_sync_check
ON games(is_active, last_synced_at, sync_interval_minutes);
```

#### LOW: No Partitioning for Log Tables

`sync_logs` and `trigger_logs` will grow indefinitely. Consider:
- Time-based partitioning
- Automatic cleanup of old entries
- Archival strategy

---

## 8. Dependency Review

### 8.1 Current Dependencies

| Package | Version | Status |
|---------|---------|--------|
| next | ^15.3.0 | ✅ Latest |
| react | ^18.3.1 | ✅ Latest |
| @supabase/supabase-js | ^2.49.0 | ✅ Latest |
| @supabase/ssr | ^0.8.0 | ✅ Latest |
| zod | ^3.25.0 | ✅ Latest |
| pino | ^10.3.0 | ✅ Latest |
| date-fns | ^3.6.0 | ✅ Latest |

### 8.2 Recommendations

#### Add Security Scanning

```json
{
  "scripts": {
    "audit": "npm audit --production",
    "audit:fix": "npm audit fix"
  }
}
```

#### Consider Adding

- `p-limit`: For controlled parallel processing
- `@upstash/ratelimit`: For distributed rate limiting
- `opossum`: For circuit breaker pattern
- `vitest` + `msw`: For testing

---

## 9. Prioritized Recommendations

### Critical (Address Immediately)

1. **Add automated tests** - No tests exist; this is a significant risk for production code
2. **Implement distributed rate limiting** - Current in-memory approach won't work with multiple instances

### High Priority (Address This Sprint)

3. **Add circuit breaker for external APIs** - Prevent cascading failures
4. **Fix timing attack vulnerability in API key validation**
5. **Implement request ID tracing** - Essential for production debugging
6. **Parallelize game sync processing** - Reduce cron job duration

### Medium Priority (Address This Month)

7. **Generate proper Supabase types** - Replace type assertions
8. **Optimize N+1 queries in public API** - Combine database calls
9. **Add health check endpoint**
10. **Standardize error response format**
11. **Make configuration values configurable**

### Low Priority (Backlog)

12. **Add CSRF protection to admin routes**
13. **Implement log table partitioning/cleanup**
14. **Add composite index for sync interval queries**
15. **Improve rate limit key generation**

---

## 10. Conclusion

The SWUSH Manager codebase is well-architected and follows good practices for a Next.js application. The main areas requiring immediate attention are:

1. **Testing infrastructure** - Critical gap for production readiness
2. **Scalability concerns** - Rate limiting and parallel processing
3. **Operational tooling** - Health checks, request tracing, and monitoring

The security posture is generally good with proper authentication, authorization, and input validation. The code is readable, well-documented, and follows consistent patterns.

With the recommended improvements, this application will be production-ready for handling the data synchronization workload at scale.

---

*This code review was generated as part of a comprehensive analysis of the repository. For questions or clarifications, please refer to the specific file locations and line numbers mentioned throughout this document.*
