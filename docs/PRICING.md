# Pricing

Two separate things get priced in this repo — don't conflate them.

## 1. Token profile upgrades (the real product)

Defined in `src/lib/constants.ts: TIER_PRICES_SOL`, enforced in `src/app/api/pay/verify/route.ts`. This is live in code (see the payment-flow fix noted in the root README) and is what "VORTEX vs Dex Screener" in [`COMPARISON.md`](COMPARISON.md) is actually about.

| Tier | Price | vs Dex Screener |
|------|-------|------------------|
| Enhanced | $29 (0.20 SOL) | Dex Screener charges $299 for the equivalent profile upgrade |
| Elite | $5 (0.035 SOL) | Trending-boost style placement |
| DeepScan | ~$7 (0.05 SOL) | One-off forensic scan, no Dex Screener equivalent |

SOL amounts are fixed, not USD-pegged — actual USD cost drifts with SOL price. If that matters, quote against a live SOL/USD price at checkout instead of hardcoding SOL amounts next to a dollar figure in the UI.

## 2. Data API tiers (proposal, not implemented)

These are **not wired to any billing system**. No developer can actually pay for these today — `TIER_LIMITS` in `src/lib/apiAuth.ts` only caps requests, it doesn't charge anyone. Treat this table as a starting point for a pricing decision, not a live price list.

| Plan | Proposed price | Requests/mo | Notes |
|------|------|-------------|-------|
| Free | $0 | 50,000 | Default tier on signup |
| Starter | $99/mo (proposed) | 5,000,000 | No checkout flow exists |
| Pro | $499/mo (proposed) | 50,000,000 | No checkout flow exists |
| Enterprise | Custom (proposed) | Unlimited | No checkout flow exists |

Before quoting these to anyone: decide on a billing provider (Stripe for card, or a Solana Pay equivalent to match the rest of the product), and connect it to `ApiKey.tier` so upgrades are enforced rather than aspirational.
