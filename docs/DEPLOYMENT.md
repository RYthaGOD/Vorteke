# Deployment

VORTEX runs on Railway: project `vorteke`, service `web`, plus a Postgres service. Pushing to `master` on GitHub deploys automatically.

- Live URL: https://web-production-d0455.up.railway.app
- Build: `npx prisma generate && next build` (`railway.json`)
- Start: `npx prisma migrate deploy && next start`. Pending migrations apply before the app starts; they never drop data.

## Environment variables

Set on the `web` service. `.env.example` lists every variable with a note.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `${{Postgres.DATABASE_URL}}` (private network) |
| `NEXT_PUBLIC_SOLANA_RPC_PRIMARY` | yes | Helius RPC URL with key. Restrict the key to the site's domain in the Helius dashboard. |
| `HELIUS_API_KEY` | yes | Server-side Helius calls |
| `BIRDEYE_API_KEY` | yes | Chart candles |
| `NEXT_PUBLIC_ADMIN_PUBKEY` | yes | Wallet allowed into `/admin` |
| `VORTEX_JWT_SECRET` | yes | Signs Elite and admin sessions. Changing it signs everyone out. |
| `NEXT_PUBLIC_APP_URL` | yes | Canonical URL for the sitemap and robots |
| `COINGECKO_API_KEY` | recommended | Paid market data. Without it, GeckoTerminal's free tier rate-limits busy periods; pages then show cached data. |
| `ALERT_WEBHOOK_URL` | recommended | Discord or Slack webhook for payments received, rejected payments and verification errors |
| `NEXT_PUBLIC_SUPPORT_URL` | recommended | Support link on the legal pages |
| `JUPITER_API_KEY` | optional | Higher Jupiter limits |
| `ELITE_ACCESS_CODES` | optional | Comma-separated trial codes; empty disables them |

`NEXT_PUBLIC_*` values are built into the browser bundle, so a change needs a redeploy.

## Database

- Prisma uses PostgreSQL (`prisma/schema.prisma`). Change the schema through migrations only: edit the schema, run `npx prisma migrate dev --name <change>` against a development database, and commit the migration folder. Never run `prisma db push` against production.
- `20261005000000_boosts_elite_access` added boost expiry, renamed `TestAccess` to `EliteAccess` (keeping grants), stored USD prices on payment intents, and cleared browser-written token creators.
- Turn on Railway's Postgres backups and test a restore before taking real payments.
- Use a separate development database. The production database is only reachable on Railway's private network unless a TCP proxy is enabled.

## Rollback

Railway dashboard → `web` → Deployments → pick the last good deployment → Redeploy. Code rolls back; database migrations do not, so a rollback across a migration needs the older code to tolerate the newer schema. `20261005000000` is not backwards compatible (it renames `TestAccess`), so roll back past it only with a database restore.

## Monitoring

- Server logs are JSON lines in Railway's log view. Browser errors arrive there as `CLIENT_ERROR` lines.
- With `ALERT_WEBHOOK_URL` set, every verified payment, rejected payment and verification error posts to the webhook.
- Add an uptime monitor (for example UptimeRobot or Better Stack, free tiers) on `/`, `/api/discovery` and `/api/pay/config`, alerting your phone.
- In Railway's GitHub settings, turn on "Wait for CI" so a failing check stops the deploy.

## Payment tests

`pnpm test:devnet` runs claims, Enhanced, boosts and Elite against a local server started with `NEXT_PUBLIC_SOLANA_NETWORK=devnet`, using a funded devnet key in `.scratch/devnet-test-keypair.json`. Mainnet tests with real SOL are a separate, manual step.
