-- SQLite Schema: Sovereign Transaction Log & Sync State
-- Used for reconciliation and metadata with zero hosting cost.

CREATE TABLE IF NOT EXISTS tokens (
    address TEXT PRIMARY KEY,
    symbol TEXT,
    name TEXT,
    decimals INTEGER NOT NULL,
    logo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swaps (
    signature TEXT PRIMARY KEY,
    slot INTEGER NOT NULL,
    block_time DATETIME NOT NULL,
    token_in_address TEXT NOT NULL,
    token_out_address TEXT NOT NULL,
    amount_in REAL NOT NULL,
    amount_out REAL NOT NULL,
    price_usd REAL,
    maker TEXT,
    dex TEXT, -- 'raydium', 'jupiter', 'orca'
    is_reconciled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    last_processed_slot INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swaps_slot ON swaps(slot);
CREATE INDEX IF NOT EXISTS idx_swaps_token_in ON swaps(token_in_address);
CREATE INDEX IF NOT EXISTS idx_swaps_token_out ON swaps(token_out_address);
CREATE INDEX IF NOT EXISTS idx_swaps_block_time ON swaps(block_time);

CREATE TABLE IF NOT EXISTS creators (
    address TEXT PRIMARY KEY,
    reputation TEXT, -- 'CLEAN', 'SUSPICIOUS', 'RUGGER'
    funded_by TEXT,
    launch_count INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
