-- ============================================
-- SWUSH Manager Database Schema
-- Run this in your Supabase SQL editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- GAMES TABLE
-- Stores fantasy game configurations
-- ============================================
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sport_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (sport_type IN ('FOOTBALL', 'HOCKEY', 'F1', 'OTHER')),
  subsite_key TEXT NOT NULL DEFAULT 'aftonbladet',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_round INTEGER DEFAULT 1,
  total_rounds INTEGER,
  round_state TEXT,
  next_trade_deadline TIMESTAMPTZ,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_synced_at TIMESTAMPTZ,
  swush_game_id INTEGER,
  game_url TEXT,
  users_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_games_game_key ON games(game_key);
CREATE INDEX IF NOT EXISTS idx_games_is_active ON games(is_active);

-- ============================================
-- ELEMENTS TABLE
-- Cached player/element data from SWUSH
-- ============================================
CREATE TABLE IF NOT EXISTS elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  element_id INTEGER NOT NULL,
  short_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  team_name TEXT,
  image_url TEXT,
  popularity DECIMAL DEFAULT 0,
  trend INTEGER DEFAULT 0,
  growth INTEGER DEFAULT 0,
  total_growth INTEGER DEFAULT 0,
  value INTEGER DEFAULT 0,
  is_injured BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(game_id, element_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_elements_game_id ON elements(game_id);
CREATE INDEX IF NOT EXISTS idx_elements_element_id ON elements(element_id);
CREATE INDEX IF NOT EXISTS idx_elements_trend ON elements(trend DESC);

-- ============================================
-- USER_GAME_STATS TABLE
-- User stats per game (no PII except external_id)
-- ============================================
CREATE TABLE IF NOT EXISTS user_game_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT NOT NULL,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  swush_user_id INTEGER NOT NULL,
  team_name TEXT,
  score INTEGER DEFAULT 0,
  rank INTEGER,
  round_score INTEGER DEFAULT 0,
  round_rank INTEGER,
  round_jump INTEGER DEFAULT 0,
  injured_count INTEGER DEFAULT 0,
  suspended_count INTEGER DEFAULT 0,
  lineup_element_ids INTEGER[] DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(external_id, game_id)
);

-- Indexes for faster lookups (especially for Braze queries)
CREATE INDEX IF NOT EXISTS idx_user_game_stats_external_id ON user_game_stats(external_id);
CREATE INDEX IF NOT EXISTS idx_user_game_stats_game_id ON user_game_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_user_game_stats_lookup ON user_game_stats(external_id, game_id);

-- ============================================
-- API_KEYS TABLE
-- API keys for Braze authentication
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_preview TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- ============================================
-- SYNC_LOGS TABLE
-- Track sync operations for debugging
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'manual' CHECK (sync_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  users_synced INTEGER DEFAULT 0,
  elements_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_game_id ON sync_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);

-- ============================================
-- GAME_TRIGGERS TABLE
-- Configure Braze campaign triggers per game
-- ============================================
CREATE TABLE IF NOT EXISTS game_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('deadline_reminder_24h', 'round_started', 'round_ended')),
  braze_campaign_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_triggered_round INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(game_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_game_triggers_game_id ON game_triggers(game_id);
CREATE INDEX IF NOT EXISTS idx_game_triggers_is_active ON game_triggers(is_active);

-- ============================================
-- TRIGGER_LOGS TABLE
-- Track trigger executions
-- ============================================
CREATE TABLE IF NOT EXISTS trigger_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  trigger_id UUID NOT NULL REFERENCES game_triggers(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('triggered', 'failed', 'skipped')),
  braze_response JSONB,
  error_message TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_logs_game_id ON trigger_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_triggered_at ON trigger_logs(triggered_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to games table
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_game_stats table
DROP TRIGGER IF EXISTS update_user_game_stats_updated_at ON user_game_stats;
CREATE TRIGGER update_user_game_stats_updated_at
  BEFORE UPDATE ON user_game_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to elements table
DROP TRIGGER IF EXISTS update_elements_updated_at ON elements;
CREATE TRIGGER update_elements_updated_at
  BEFORE UPDATE ON elements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users (admin) can do everything
CREATE POLICY "Admin full access to games" ON games
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to elements" ON elements
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to user_game_stats" ON user_game_stats
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to api_keys" ON api_keys
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to sync_logs" ON sync_logs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to game_triggers" ON game_triggers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to trigger_logs" ON trigger_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- Policy: Service role can do everything (for API routes)
CREATE POLICY "Service role full access to games" ON games
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to elements" ON elements
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to user_game_stats" ON user_game_stats
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to api_keys" ON api_keys
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to sync_logs" ON sync_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to game_triggers" ON game_triggers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to trigger_logs" ON trigger_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- DONE
-- ============================================
