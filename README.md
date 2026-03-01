# VORTEX 🌪️

**The Industrial Intelligence Network on Solana.**

VORTEX is an elite-grade, high-fidelity DEX Screener and Reconnaissance terminal. Engineered to merge the raw "Industrial Futurism" aesthetic of cyberpunk mainframes with precise on-chain intelligence, VORTEX is not just a platform; it's a weaponized dashboard for the Solana elite.

## ✨ Core Architecture & Elite Features

### 1. Universal DEX Decoder Engine (Zero-IDL Emulation)
VORTEX abandons fragile Pump.fun/Raydium IDL parsing. Our custom `txDecoder` engine mathematically distills true `BUY`/`SELL` momentum and precise volume logic via exact Token Rebalance Deltas across all transaction signers. This guarantees **100% visibility** on Telegram Router Bots (Trojan, Banana Gun) and immediate compatibility with future AMMs.

### 2. Tactical Execution (Jito Turbo & Jupiter V6)
The built-in trader interface isn't just a swap terminal:
- **Jito Turbo Routing:** Priority slippage logic automatically injects strategic lamport tips to ensure execution during severe high-congestion events.
- **Pre-Flight Simulation:** Live simulation intercepts failing routes instantly, protecting capital from harsh reversion penalties.

### 3. Industrial Security Armor (Token2022 Ready)
- **Token2022 Transfer Tax Extraction:** VORTEX aggressively unpacks `TransferFeeConfig` extensions, throwing an immediate "MALICIOUS CONTRACT DETECTED" HUD warning if stealth taxes are found.
- **LP Veracity Check:** Burns and liquidity locks are validated directly from the RPC payload.

### 4. Elite Monetization & Identity
- **Solana Pay Dual-Layer Verification:** VORTEX accepts frictionless, decentralized $USDC payments for Token Profile Upgrades (Enhanced/Elite), instantly unlocking permanent social routing and advanced metrics.
- **Double-Spend Immunity:** Built with rigorous database locking, isolating payment signatures to ensure singular NFT upgrades.
- **Lamport Buoyancy:** Payment decoders tolerate up to a 5% priority fee slip, preventing unwarranted payment failures during network swarms.

### 5. 8K High-Fidelity UX
Wrapped in a brutalist, "Terminal Hacker" aesthetic powered by Tailwind CSS, featuring:
- Live Canvas WebSocket Charting (with nanosecond deduplication).
- Mobile-responsive architecture without losing desktop "Pro Mode" rigidity.

## 🛠️ Stack Infrastructure
- **Framework**: Next.js 14 App Router (React Server Components)
- **Database**: PostgreSQL (Prisma ORM)
- **State Hooks**: Zustand + Tanstack React Query
- **Telemetry**: Helius RPC + Jupiter API V2 + GeckoTerminal Proxy
- **Execution Matrix**: Solana Web3.js + Wallet Adapter

## 📦 Tactical Deployment

1. **Environment Matrix**:
   Duplicate `.env.example` to `.env.local` and inject essential keys.
   ```bash
   NEXT_PUBLIC_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=...
   DATABASE_URL=postgresql://...
   HELIUS_API_KEY=your_key
   ```

2. **Initialize Protocols**:
   ```bash
   npm install
   npx prisma generate
   ```

3. **Engage Local Development**:
   ```bash
   npm run dev
   ```

4. **Verify Production Build (Recommended before deployment)**:
   ```bash
   npm run build
   ```

---
*Built for the Solana Elite.*
