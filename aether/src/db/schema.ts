export const DUCKDB_SCHEMA = `
-- DuckDB Schema: Analytical OHLCV Storage
CREATE TABLE IF NOT EXISTS raw_swaps (
    timestamp TIMESTAMP_MS,
    token_address VARCHAR,
    price_usd DOUBLE,
    volume_usd DOUBLE,
    side ENUM('buy', 'sell'),
    signature VARCHAR,
    slot UINTEGER,
    dex_id VARCHAR,
    maker VARCHAR
);

CREATE TABLE IF NOT EXISTS tokens (
    mint VARCHAR PRIMARY KEY,
    symbol VARCHAR,
    name VARCHAR,
    decimals INTEGER,
    created_at TIMESTAMP_MS DEFAULT CURRENT_TIMESTAMP
);

CREATE VIEW IF NOT EXISTS prices_1m AS
SELECT 
    time_bucket(INTERVAL '1 minute', timestamp) as bucket,
    token_address,
    first(price_usd ORDER BY timestamp) as open,
    max(price_usd) as high,
    min(price_usd) as low,
    last(price_usd ORDER BY timestamp) as close,
    sum(volume_usd) as volume
FROM raw_swaps
GROUP BY 1, 2;

CREATE VIEW IF NOT EXISTS top_movers_24h AS
WITH hourly_prices AS (
    SELECT 
        token_address,
        last(price_usd ORDER BY timestamp) as current_price,
        first(price_usd ORDER BY timestamp) as old_price
    FROM raw_swaps
    WHERE timestamp > (current_timestamp - INTERVAL '24 hours')::TIMESTAMP_MS
    GROUP BY token_address
)
SELECT 
    token_address,
    current_price,
    old_price,
    ((current_price - old_price) / old_price) * 100 as pct_change
FROM hourly_prices
WHERE old_price > 0
ORDER BY pct_change DESC;

CREATE VIEW IF NOT EXISTS volume_clusters_1h AS
SELECT 
    token_address,
    sum(volume_usd) as total_volume,
    count(*) as trade_count
FROM raw_swaps
WHERE timestamp > (current_timestamp - INTERVAL '1 hour')::TIMESTAMP_MS
GROUP BY token_address
HAVING total_volume > 1000
ORDER BY total_volume DESC;
`;

export const SQLITE_SCHEMA = `
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
    dex TEXT,
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
    reputation TEXT,
    funded_by TEXT,
    launch_count INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;
