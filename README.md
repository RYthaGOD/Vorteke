# VORTEX

A Solana market screener and trading terminal. Traders find tokens, read price, liquidity and holder data, and swap through Jupiter. Project teams claim their token's profile and pay for an Enhanced profile or a Trending boost. Traders can buy Elite for faster prices, no swap fee and linked-wallet research.

Live at https://web-production-d0455.up.railway.app (Railway project `vorteke`, auto-deploys from `master`).

## Products

All prices are set in USD and charged in SOL at the Jupiter rate when the payment starts (`src/lib/payments/pricing.mjs`).

| Product | Price | What it does |
|---|---|---|
| Enhanced profile | $29 once | The claimed project wallet can show a banner, logo, links and description. |
| Trending boost | $5 per 24 hours | Promoted tab, Featured panel and ticker until `boostExpiresAt`. Renewals stack. Never changes organic order. |
| Elite access | $29 per 30 days | 5-second prices, no 0.0075 SOL swap fee, linked-wallet research. Belongs to the paying wallet. |
| Swap fee | 0.0075 SOL per swap | Added to the swap transaction and shown before signing. Waived for Elite. |
| Holder scan | Free | Top holders, wallet concentration, creator, mint and freeze authority (`/api/scan/[address]`). |

## How the important flows work

- **Claiming a profile** (`/api/claim`): the wallet signs a message, and the server reads chain state to check it controls the token: Pump.fun bonding-curve creator, mint authority, or metadata update authority (`src/lib/solana/creator.mjs`). Nothing sent by a browser is trusted for this. Tokens no check covers are assigned by an admin.
- **Payments** (`/api/pay/initiate` → wallet signs → `/api/pay/verify`): the server creates a payment intent with a fixed lamport amount and a memo `VORTEX_PAY:<intent id>`. Verification needs a finalized transfer of exactly that amount to the treasury, signed by the paying wallet, with that memo (`src/lib/payments/validate.mjs`). A receipt row makes each signature usable once.
- **Elite research** (`/api/elite/session`, `/api/elite/research/[address]`): an Elite wallet signs in for 24 hours, then the server traces who first funded the creator and the top 10 wallets and groups wallets that share a funder (`src/lib/scan/funding.mjs`).
- **Admin** (`/admin`): the `NEXT_PUBLIC_ADMIN_PUBKEY` wallet signs in to see payments and revenue, clear profile content, assign or revoke claims, grant boosts and grant or revoke Elite.

## Stack

- Next.js 15, React 19, TanStack Query, lightweight-charts
- PostgreSQL on Railway with Prisma; migrations in `prisma/migrations/` run on deploy
- Helius RPC and DAS, Jupiter price and swap APIs, Jito bundles for Turbo swaps
- GeckoTerminal for market lists, cached in `src/lib/server/gecko.ts`; set `COINGECKO_API_KEY` to use CoinGecko's paid on-chain API instead

## Local development

```bash
cp .env.example .env.local   # fill in the values, see docs/DEPLOYMENT.md
pnpm install
pnpm exec prisma migrate deploy
pnpm dev
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit tests), `pnpm test:devnet` (end-to-end payments on devnet, needs a funded devnet key in `.scratch/`). CI runs the first three and a build on every push (`.github/workflows/ci.yml`).

## Docs

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): environment variables, deploys, rollback, monitoring
- [`docs/PRICING.md`](docs/PRICING.md): products and the parked data API pricing
- [`docs/COMPARISON.md`](docs/COMPARISON.md): VORTEX against Dex Screener
- [`docs/API.md`](docs/API.md): the parked public data API

## Parked

- A public data API (`/api/v1`, `sdk/node`) exists as a scaffold; signup is off in production and there is no billing.
- The Aether indexer in `aether/` is not deployed; the app skips it unless `NEXT_PUBLIC_AETHER_API_URL` is set.
- There is no VORTEX token.

## License

MIT
