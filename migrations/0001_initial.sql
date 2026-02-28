-- Migration 001: Initial schema
-- Creates tables for agent-human linkages, data offerings, access requests, and trust signals

-- Linkages table: stores agent-human relationships
CREATE TABLE IF NOT EXISTS linkages (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  owner_provider TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  owner_display_name TEXT,
  owner_pseudonym TEXT,
  privacy_level TEXT NOT NULL DEFAULT 'full',
  verified_at TEXT NOT NULL,
  revoked_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_id ON linkages(agent_id);
CREATE INDEX IF NOT EXISTS idx_owner ON linkages(owner_provider, owner_id);
CREATE INDEX IF NOT EXISTS idx_verified_at ON linkages(verified_at);

-- Offers table: data offerings published by verified agents
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL,
  tags TEXT,
  access_level TEXT NOT NULL DEFAULT 'handshake_verified',
  price_amount INTEGER,
  price_currency TEXT,
  content_url TEXT,
  content_hash TEXT,
  verification_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES linkages(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_agent ON offers(agent_id);
CREATE INDEX IF NOT EXISTS idx_offers_type ON offers(data_type);
CREATE INDEX IF NOT EXISTS idx_offers_tags ON offers(tags);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- Access requests table: requests from agents to access data offerings
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  requester_agent_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  granted_at TEXT,
  denied_at TEXT,
  denial_reason TEXT,
  access_token TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_agent_id) REFERENCES linkages(agent_id),
  FOREIGN KEY (offer_id) REFERENCES offers(id)
);

CREATE INDEX IF NOT EXISTS idx_requests_requester ON access_requests(requester_agent_id);
CREATE INDEX IF NOT EXISTS idx_requests_offer ON access_requests(offer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON access_requests(status);

-- Trust signals table: aggregated trust metrics per human owner
CREATE TABLE IF NOT EXISTS trust_signals (
  id TEXT PRIMARY KEY,
  owner_provider TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  agents_owned INTEGER DEFAULT 1,
  offers_published INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  denied_requests INTEGER DEFAULT 0,
  revoked_linkages INTEGER DEFAULT 0,
  reputation_score REAL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_provider, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_trust_owner ON trust_signals(owner_provider, owner_id);
