# VORTEX Data API (secondary, not prioritized)

Not the main product — see the root [`README.md`](../README.md) for the real, revenue-bearing token-profile-upgrade business. This is a partial scaffold for a separate idea: external developers paying for programmatic access to VORTEX's on-chain data and risk signals.

## Status

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/v1/auth/signup` | POST | Implemented — issues a free-tier key, no email verification, no billing |
| `/api/v1/tokens/trending` | GET | Implemented — wraps the GeckoTerminal discovery proxy, enriches top 10 with real risk signals |
| `/api/v1/tokens/{mint}` | GET | Not built |
| `/api/v1/alerts/subscribe` | POST | Not built |
| `/api/v1/portfolio/{wallet}` | GET | Not built |

No public hosted deployment exists. Everything below assumes `http://localhost:3000`.

## Auth

Every `/api/v1/*` route except `auth/signup` requires:

```
Authorization: Bearer <api-key>
```

Keys are validated and usage-tracked in `src/lib/apiAuth.ts` (`requireApiKey`). Each key has a monthly request cap by tier (`TIER_LIMITS` in that file), reset on a rolling 30-day window from `periodStart`. Exceeding the cap returns `429 RATE_LIMIT_EXCEEDED`.

## `POST /api/v1/auth/signup`

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

```json
{ "apiKey": "...", "tier": "free", "monthlyRequestLimit": 50000 }
```

No verification of the email — this is a dev-only signup path, not production auth. Add real email verification (or drop signup entirely in favor of manually-issued keys) before this is public.

## `GET /api/v1/tokens/trending`

```bash
curl "http://localhost:3000/api/v1/tokens/trending?limit=20" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

`limit` — 1 to 50, default 20.

Response:
```json
{
  "data": [
    {
      "address": "...",
      "name": "...",
      "symbol": "...",
      "priceUsd": 1.0,
      "volume24h": 2500000000,
      "liquidityUsd": 500000000,
      "mcap": 100000000,
      "logoURI": "...",
      "lpBurnStatus": "verified",
      "holderConcentration": { "clusterDetected": false, "riskLevel": "LOW", "top10Percent": 12.4 },
      "marketVelocity": { "score": 61, "activityLevel": "TRENDING" }
    }
  ]
}
```

`lpBurnStatus`, `holderConcentration`, and `marketVelocity` are only computed for the first 10 results (`ENRICH_LIMIT` in the route) — each one costs real RPC calls, so enriching a full 50-token page per request isn't done yet. Results past index 10 omit those fields.

## What's not real yet

- No billing (Stripe, Solana Pay, or otherwise) — `docs/PRICING.md` tiers are a proposal, not something a developer can actually purchase.
- No published SDK — `sdk/node/vortex.js` is a local file to vendor, not an npm package.
- No public domain, status page, or support channel.

Don't advertise this externally until those exist.
