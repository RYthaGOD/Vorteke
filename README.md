# VORTEX 🌪️

**A Solana DEX screener where projects pay $29 to unlock a verified token profile — instead of $299 on Dex Screener.**

VORTEX is a Next.js Solana DEX screener/terminal. Its primary business model is undercutting Dex Screener's token profile enhancement fee: project teams pay a flat SOL fee to unlock "Enhanced"/"Elite" status (custom banner, logo, socials, trending placement) on their token's page. See the full comparison in [`docs/COMPARISON.md`](docs/COMPARISON.md).

> **⚠️ If you're reading this after 2025-09, check `src/app/api/pay/verify/route.ts` before assuming payments work.** As of this commit, the verify endpoint was checking for a `$VTX` token burn that the payment flow never performs (`/api/pay/initiate` sends a plain SOL transfer) — meaning every payment attempt failed after the user's SOL had already left their wallet. That's now fixed to verify the actual SOL transfer instead. If you change pricing or the payment flow again, keep `TIER_PRICES_SOL` in `src/lib/constants.ts` as the single source of truth for both `initiate` and `verify` — the drift between two hardcoded copies is exactly what broke it last time.

## 💰 How monetization actually works

| Tier | Price | What it unlocks | Verified against |
|------|-------|------------------|-------------------|
| **Enhanced** ("BOOST_PROFILE") | $29 (0.20 SOL) | Permanent banner/logo, social link sync | `src/app/api/pay/verify/route.ts` checks the treasury wallet's SOL balance increased by the expected amount |
| **Elite** ("TRENDING_BOOST") | $5 (0.035 SOL) | Priority trending placement, Elite badge | same |
| **DeepScan** | ~$7 (0.05 SOL) | One-off forensic token scan | `DeepScanRecord` table, signature-gated against replay |

Flow: `EnhancementModal.tsx` → `purchaseEnhancement()` in `monetizationService.ts` → `POST /api/pay/initiate` (builds unsigned SOL transfer to `TREASURY_ENHANCEMENTS`) → wallet signs & sends → `POST /api/pay/verify` (confirms the transfer landed, upserts `Enhancement`).

**Known gaps, not yet fixed:**
- No `$VTX` token exists. The burn flow (buy-and-burn builder, burn copy, Burn Leaderboard) was removed; the live path is a direct SOL transfer to treasury.
- Elite trial access codes are read from `ELITE_ACCESS_CODES` (comma-separated). Unset means redemption is disabled.

## 🛠️ Stack

- **Framework**: Next.js 15 + React Server Components
- **Database**: PostgreSQL on Railway (Prisma ORM, migrations in `prisma/migrations/`). See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **Data Sources**: Helius RPC + GeckoTerminal proxy + Jupiter routing
- **Decoder**: Custom transaction parser (`src/lib/solana/txDecoder.ts`) — reconciles signer balance deltas so bot-routed trades (Trojan, BananaGun) still resolve to correct buy/sell direction and size

## 📊 Real on-chain features (implemented)

- **Bot-aware transaction decoding** (`txDecoder.ts`) — buy/sell + volume, robust to Telegram router bots
- **LP burn/lock verification** (`metrics.ts: verifyLPBurn`) — checks largest LP accounts against known burn addresses + mint authority
- **Whale cluster detection** (`metrics.ts: getHolderConcentration`) — top-10-holder concentration, LOW/MEDIUM/HIGH risk
- **Market velocity score** (`metrics.ts: getMarketVelocity`) — volume/liquidity ratio + momentum
- **Token-2022 transfer-tax extraction** (`dataService.ts`, `types.ts`) — surfaces hidden transfer fees in mint extensions
- **Jito-aware trade execution** (`useSwap.ts`) — Jupiter V6 + Jito tip injection + pre-flight simulation

## 🚀 Local Development

```bash
cp .env.example .env.local
# fill in HELIUS_API_KEY and DATABASE_URL (Postgres, see docs/DEPLOYMENT.md)
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

The database is provisioned on Railway; the web service is not deployed yet (see docs/DEPLOYMENT.md).

---

## 🧪 Secondary idea, not built out: a public data API

Separate from the profile-upgrade business above, there's a partial scaffold for a B2B REST API (external developers paying for programmatic access to VORTEX's on-chain data/risk signals, competing with Dex Screener's *data* API rather than its profile-upgrade product). This is **not prioritized** — the profile-upgrade flow above is the real, revenue-bearing product.

What exists: `ApiKey` model + `requireApiKey()` auth helper with per-key monthly usage caps (`src/lib/apiAuth.ts`), a dev-only signup endpoint (`POST /api/v1/auth/signup`), and one real endpoint (`GET /api/v1/tokens/trending`) that wraps the GeckoTerminal proxy and enriches the top 10 results with the real risk signals above. No billing integration, no public deployment, no published SDK — `sdk/node/vortex.js` is a local fetch wrapper you'd vendor, not an npm package.

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup -H "Content-Type: application/json" -d '{"email":"your@email.com"}'
curl http://localhost:3000/api/v1/tokens/trending?limit=20 -H "Authorization: Bearer YOUR_API_KEY"
```

Treat the pricing tiers in [`docs/PRICING.md`](docs/PRICING.md) as a proposal for *this* secondary product, not live billing. Revisit this once the profile-upgrade flow is confirmed working end-to-end in production.

## License

MIT
