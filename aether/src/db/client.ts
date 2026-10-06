import sqlite3 from 'sqlite3';
import { Database } from 'duckdb';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import { SwapEvent } from '../worker/parser';
import { DUCKDB_SCHEMA, SQLITE_SCHEMA } from './schema';

class DBClient {
    private sqlite: sqlite3.Database;
    private duckdb: Database;

    constructor() {
        // Ensure directories exist
        const sqliteDir = path.dirname(config.sqlite.filename);
        const duckdbDir = path.dirname(config.duckdb.filename);
        if (!fs.existsSync(sqliteDir)) fs.mkdirSync(sqliteDir, { recursive: true });
        if (!fs.existsSync(duckdbDir)) fs.mkdirSync(duckdbDir, { recursive: true });

        this.sqlite = new sqlite3.Database(config.sqlite.filename);
        this.duckdb = new Database(config.duckdb.filename);
        
        // Performance & Durability: Enable Write-Ahead Logging for SQLite
        this.sqlite.run('PRAGMA journal_mode=WAL');
    }

    async init() {
        // 1. Initialize SQLite (Token Metadata & Sync State)
        await new Promise<void>((resolve, reject) => {
            this.sqlite.exec(SQLITE_SCHEMA, (err: Error | null) => {
                if (err) reject(err);
                else {
                    console.log('SQLite Initialized.');
                    resolve();
                }
            });
        });

        // 2. Initialize DuckDB (High-Performance Analytical Store)
        await new Promise<void>((resolve, reject) => {
            const con = this.duckdb.connect();
            con.exec(DUCKDB_SCHEMA, (err: any) => {
                if (err) {
                    console.error('DuckDB Schema Init Failure:', err);
                    reject(err);
                } else {
                    console.log('DuckDB Initialized (Analytical Tables & Views).');
                    resolve();
                }
            });
        });
    }

    async insertSwapToSQLite(swap: any) {
        return new Promise<void>((resolve, reject) => {
            const query = `
                INSERT OR IGNORE INTO swaps (signature, slot, block_time, token_in_address, token_out_address, amount_in, amount_out, price_usd, maker, dex)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            this.sqlite.run(query, [
                swap.signature, swap.slot, swap.blockTime.toISOString(), swap.tokenIn, swap.tokenOut,
                swap.amountIn, swap.amountOut, swap.priceUsd, swap.maker, swap.dex
            ], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async upsertToken(token: { mint: string, symbol: string, name: string, decimals: number }) {
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(`
                INSERT INTO tokens (address, symbol, name, decimals)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(address) DO UPDATE SET
                    symbol = excluded.symbol,
                    name = excluded.name,
                    decimals = excluded.decimals
            `, [token.mint, token.symbol, token.name, token.decimals], (err: Error | null) => {
                if (err) return reject(err);
                
                const con = this.duckdb.connect();
                con.run(`
                    INSERT INTO tokens (mint, symbol, name, decimals)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(mint) DO UPDATE SET
                        symbol = excluded.symbol,
                        name = excluded.name,
                        decimals = excluded.decimals
                `, [token.mint, token.symbol, token.name, token.decimals], (err2: Error | null) => {
                    if (err2) reject(err2);
                    else resolve();
                });
            });
        });
    }

    async insertToDuckDB(swaps: Array<SwapEvent & { side?: 'buy' | 'sell' }>) {
        if (swaps.length === 0) return;
        const con = this.duckdb.connect();
        
        con.run('BEGIN TRANSACTION');
        try {
            for (const s of swaps) {
                const side = s.side || (s.tokenIn === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || s.tokenIn === 'So11111111111111111111111111111111111111112' ? 'buy' : 'sell');
                
                con.run(`
                    INSERT INTO raw_swaps (timestamp, token_address, price_usd, volume_usd, side, signature, slot, dex_id, maker)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, 
                    s.blockTime.getTime(),
                    side === 'buy' ? s.tokenOut : s.tokenIn,
                    s.priceUsd,
                    (side === 'buy' ? s.amountOut : s.amountIn) * s.priceUsd,
                    side,
                    s.signature,
                    s.slot,
                    s.dex,
                    s.maker,
                    (err: any) => { if (err) console.error('DuckDB row insert error:', err); }
                );
            }
            con.run('COMMIT');
        } catch (err: any) {
            con.run('ROLLBACK');
            throw err;
        }
    }

    async updateSyncState(slot: number) {
        return new Promise<void>((resolve, reject) => {
            const query = `
                INSERT INTO sync_state (key, last_processed_slot)
                VALUES ('default', ?)
                ON CONFLICT (key) DO UPDATE SET last_processed_slot = excluded.last_processed_slot
            `;
            this.sqlite.run(query, [slot], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getHistory(tokenAddress: string, interval: string) {
        const con = this.duckdb.connect();
        const sql = `
            SELECT 
                time_bucket(INTERVAL '1 ${interval}', timestamp) as window_start,
                first(price_usd) as open,
                max(price_usd) as high,
                min(price_usd) as low,
                last(price_usd) as close,
                sum(volume_usd) as volume
            FROM raw_swaps
            WHERE token_address = '${tokenAddress}'
            GROUP BY window_start
            ORDER BY window_start DESC
            LIMIT 1000
        `;
        return new Promise((resolve, reject) => {
            con.all(sql, (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    async searchTokens(query: string) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT address as mint, symbol, name, decimals 
                FROM tokens 
                WHERE symbol LIKE ? OR name LIKE ? OR address = ?
                LIMIT 20
            `;
            const param = `%${query}%`;
            this.sqlite.all(sql, [param, param, query], (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    async getTopMovers() {
        const con = this.duckdb.connect();
        return new Promise((resolve, reject) => {
            con.all('SELECT * FROM top_movers_24h LIMIT 10', (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res.map((r: any) => ({
                    tokenAddress: r.token_address,
                    current_price: r.current_price,
                    pct_change: r.pct_change
                })));
            });
        });
    }

    async getVolumeClusters() {
        const con = this.duckdb.connect();
        return new Promise((resolve, reject) => {
            con.all('SELECT * FROM volume_clusters_1h LIMIT 10', (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res.map((r: any) => ({
                    tokenAddress: r.token_address,
                    total_volume: r.total_volume,
                    trade_count: r.trade_count
                })));
            });
        });
    }

    async updateCreatorReputation(address: string, reputation: string, fundedBy: string, launchCount: number) {
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(`
                INSERT INTO creators (address, reputation, funded_by, launch_count)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(address) DO UPDATE SET
                    reputation = excluded.reputation,
                    funded_by = excluded.funded_by,
                    launch_count = excluded.launch_count
            `, [address, reputation, fundedBy, launchCount], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

export const db = new DBClient();
