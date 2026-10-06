# Dex Screener Workspace - Agent Directives

## Environment

- **OS**: Windows / WSL ONLY.
- **Forbidden**: `brew`, `launchd`, `openclaw-mac`, `pbcopy`, `osascript`.
- **Preferred Shell**: `powershell` (Windows) or `bash` (WSL).

## Technical Focus

- Solana DEX integration (Jupiter, Dex Screener API).
- Fast, tactical UI with `lightweight-charts`.

## Current state (October 2026)

- Read `README.md` first: products, how claims, payments, Elite research and admin work.
- Deploys, environment variables and rollback: `docs/DEPLOYMENT.md`. Pushing to `master` deploys production.
- Before committing, run `pnpm typecheck`, `pnpm lint` and `pnpm test` (CI runs them too).
- Never trust browser-sent data for ownership, prices or creators; read chain state on the server.
- Real-money (mainnet) payment or swap tests need the owner's explicit go.

## Continuity

- Consult the root `AGENTS.md` and `LEARNINGS.md` in `d:\Rykiri` for global heuristics and memory.
