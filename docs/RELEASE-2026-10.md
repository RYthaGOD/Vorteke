# October 2026 completion release

What changed between commit 0a4174a (29 Sep) and this release, and how it was checked. The plan it follows is the "VORTEX Completion Plan" doc.

## Changes

| Area | Change |
|---|---|
| Security | Claims are verified on chain (Pump.fun creator, mint authority, metadata authority); browser-sent token data is no longer trusted; paid profile content is gated by tier; tighter rate limits |
| Swaps | Jito tips go to the eight official tip accounts; Turbo falls back to RPC after 8 seconds; fee shown in SOL and USD |
| Products | USD pricing; Trending boost lasts 24 hours and stacks; Elite access sold per wallet for 30 days; paid DeepScan replaced by a free holder scan |
| Elite | 5-second prices, no swap fee, linked-wallet research (first funders of the creator and top 10 wallets) |
| Data | Shared provider cache with stale fallback and on-page notice; optional CoinGecko key; real mint and freeze authority; made-up metrics removed |
| Pages | New pairs rebuilt; Elite page rebuilt; swap panel follows the chart on phones; server rendering; per-token link previews; Terms, Privacy and Risk pages |
| Operations | `/admin` page; webhook alerts for payments and failures; browser error reporting; first-party funnel counts; CI on every push |
| Database | Migration `20261005000000_boosts_elite_access` |

## Verification

- `pnpm typecheck`: passes.
- `pnpm test`: 44 unit tests pass (claims, pricing, profiles, boosts, holder summary, funding links, sessions, Jito list, payments, swap fee, candles); one live Jito check is opt-in.
- Migration: applied to an embedded Postgres (PGlite) after the September migration, with sample rows. `prisma migrate diff` against `schema.prisma` reports no difference; existing grants survive the rename, legacy Elite profiles become Enhanced with a 24-hour boost, browser-written creators are cleared.
- Local production build against that database, with live providers:
  - holder scan returned the Pump.fun creator and separated pools from wallets;
  - a planted creator in `POST /api/tokens` was ignored;
  - a random wallet's claim was refused (403), as were edits to an unclaimed profile, an Elite session for a non-Elite wallet and research with a forged token;
  - Elite research traced funders of a live token's top wallets in about 4 seconds.
- Browser checks (Playwright, axe WCAG A/AA) at 1440 and 375 px on the home, Markets, New pairs, Elite and token pages: no horizontal overflow, no accessibility violations, swap panel above the signals on phones.

## Not done here

- Real-money payment and swap tests on mainnet (need the owner's go; steps in `docs/DEPLOYMENT.md`).
- Owner actions: restrict the Helius key to the domain, set `ALERT_WEBHOOK_URL`, `NEXT_PUBLIC_SUPPORT_URL` and `COINGECKO_API_KEY`, add an uptime monitor, turn on database backups and "Wait for CI" in Railway, move treasuries to a multisig, choose the domain, have the legal pages reviewed.
- About 100 lint warnings for `any` types in older modules remain.
