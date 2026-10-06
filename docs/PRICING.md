# Pricing

## Products (live)

Defined in `src/lib/payments/pricing.mjs`. Prices are in USD; the server converts to lamports with the Jupiter SOL price when a payment starts and stores both on the payment intent. Implausible SOL prices are refused rather than charged.

| Product | Price | Duration | Notes |
|---|---|---|---|
| Enhanced profile | $29 | Permanent | Unlocks banner, logo, links and description for the claimed wallet. Can't be bought twice. |
| Trending boost | $5 | 24 hours per payment | Renewals stack on the remaining time. Labelled as paid; never changes organic order. |
| Elite access | $29 | 30 days per payment | Per wallet. No auto-renewal; renewals stack. |
| Swap fee | 0.0075 SOL | Per swap | Waived for Elite. Review after 30 days of real data. |
| Holder scan | Free | — | Replaced the paid DeepScan in October 2026. |

Dex Screener charges $299 for an enhanced token profile, so the Enhanced profile undercuts it by about 10x.

## Data API tiers (proposal, not built)

Not wired to any billing system. `TIER_LIMITS` in `src/lib/apiAuth.ts` caps requests but charges nobody, and signup is disabled in production.

| Plan | Proposed price | Requests/mo |
|---|---|---|
| Free | $0 | 50,000 |
| Starter | $99/mo | 5,000,000 |
| Pro | $499/mo | 50,000,000 |
| Enterprise | Custom | Unlimited |

Revisit after profile revenue has been steady for 30 days and someone asks for API access.
