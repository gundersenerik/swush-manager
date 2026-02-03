// ============================================
// SWUSH API Types (from their API)
// ============================================

export interface SwushRound {
  index: number
  start: string
  tradeCloses: string
  end: string
  isVerified: number
  state: 'Pending' | 'CurrentOpen' | 'Ended' | 'EndedLastest'
}

export interface SwushElement {
  elementId: number
  imageUrl: string
  url: string
  shortName: string
  fullName: string
  teamName: string
  popularity: number
  trend: number
  growth: number
  totalGrowth: number
  value: number
}

export interface SwushUserteam {
  id: number
  name: string
  key: string
  score: number
  rank: number
  roundScore: number
  roundRank: number
  roundJump: number
  injured: number
  suspended: number
  lineupElementIds?: number[]
}

export interface SwushUser {
  id: number
  name: string
  key: string
  email: string
  externalId: string
  permissions: string[]
  injured: number
  suspended: number
  userteams: SwushUserteam[]
}

export interface SwushGameResponse {
  gameId: number
  tournamentId: number
  gameKey: string
  userteamsCount: number
  competitionsCount: number
  currentRoundIndex: number
  rounds: SwushRound[]
  elements?: {
    byGrowth: SwushElement[]
    byTotalGrowth: SwushElement[]
    byPopularity: SwushElement[]
    byTrend: SwushElement[]
    byTrendReverse: SwushElement[]
  }
  competitions: any[]
}

export interface SwushUsersResponse {
  functionVersion: string
  subsiteKey: string
  gameId: number
  gameKey: string
  gameUrl: string
  roundsTotal: number
  roundIndex: number
  roundState: string
  usersTotal: number
  pageSizeMax: number
  pages: number
  page: number
  pageSize: number
  users: SwushUser[]
}

// ============================================
// Database Types (Supabase)
// ============================================

export interface Game {
  id: string
  game_key: string
  name: string
  sport_type: 'FOOTBALL' | 'HOCKEY' | 'F1' | 'OTHER'
  subsite_key: string
  is_active: boolean
  current_round: number
  total_rounds: number
  round_state: string | null
  next_trade_deadline: string | null
  current_round_start: string | null
  current_round_end: string | null
  sync_interval_minutes: number
  last_synced_at: string | null
  swush_game_id: number | null
  game_url: string | null
  users_total: number
  created_at: string
  updated_at: string
}

export interface Element {
  id: string
  game_id: string
  element_id: number
  short_name: string
  full_name: string
  team_name: string
  image_url: string | null
  popularity: number
  trend: number
  growth: number
  total_growth: number
  value: number
  is_injured: boolean
  is_suspended: boolean
  updated_at: string
}

export interface UserGameStats {
  id: string
  external_id: string
  game_id: string
  swush_user_id: number
  team_name: string
  score: number
  rank: number
  round_score: number
  round_rank: number
  round_jump: number
  injured_count: number
  suspended_count: number
  lineup_element_ids: number[]
  synced_at: string
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  name: string
  key_hash: string
  key_preview: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export interface SyncLog {
  id: string
  game_id: string
  sync_type: 'manual' | 'scheduled'
  status: 'started' | 'completed' | 'failed'
  users_synced: number
  elements_synced: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface GameTrigger {
  id: string
  game_id: string
  trigger_type: 'deadline_reminder_24h' | 'round_started' | 'round_ended'
  braze_campaign_id: string
  is_active: boolean
  last_triggered_at: string | null
  last_triggered_round: number | null
  created_at: string
}

export interface TriggerLog {
  id: string
  game_id: string
  trigger_id: string
  trigger_type: string
  round_index: number
  status: 'triggered' | 'failed' | 'skipped'
  braze_response: any | null
  error_message: string | null
  triggered_at: string
}

// ============================================
// API Response Types (for Braze)
// ============================================

export interface BrazeUserResponse {
  user: {
    team_name: string
    rank: number
    score: number
    round_score: number
    round_rank: number
    position_change: number
    percentile: number
    injured_count: number
    suspended_count: number
  }
  game: {
    name: string
    current_round: number
    total_rounds: number
    round_state: string
    trade_deadline: string | null
    days_until_deadline: number | null
  }
  lineup: {
    name: string
    team: string
    trend: number
    value: number
    growth: number
    is_injured: boolean
    is_suspended: boolean
  }[]
  alerts: {
    injured_players: string[]
    suspended_players: string[]
    top_performer: { name: string; trend: number } | null
    worst_performer: { name: string; trend: number } | null
  }
  trending: {
    hot: { name: string; team: string; trend: number }[]
    falling: { name: string; team: string; trend: number }[]
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}
