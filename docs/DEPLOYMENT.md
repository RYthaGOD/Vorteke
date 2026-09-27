# Deployment

VORTEX runs on Railway with a Railway Postgres database (project `vorteke`).

## Database

- Prisma uses PostgreSQL (`prisma/schema.prisma`). Schema changes go through migrations in `prisma/migrations/`, never `prisma db push` against production.
- On deploy, `railway.json` runs `npx prisma migrate deploy` before `next start`. It only applies pending migrations and never drops data.
- To change the schema locally: edit `schema.prisma`, then run `npx prisma migrate dev --name <change>` against a dev database and commit the new migration folder.

## Local development against Railway Postgres

The Postgres service is only reachable on Railway's private network until a public TCP proxy is enabled:

1. Railway dashboard → project `vorteke` → **Postgres** → **Settings** → **Networking** → **TCP Proxy** → enable (port 5432).
2. Copy `DATABASE_PUBLIC_URL` from the Postgres service's **Variables** tab into `.env.local` as `DATABASE_URL`.
3. `npx prisma migrate deploy` to create the tables, then `npm run dev`.

Prefer a separate database for development once real payments land, so local testing can't touch production records.

## App service (not created yet)

1. `railway add --service web --repo RYthaGOD/Vorteke`
2. Set its variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}` (private network), plus everything under "Required at runtime" in `.env.example` (`HELIUS_API_KEY`, `BIRDEYE_API_KEY`, `NEXT_PUBLIC_ADMIN_PUBKEY`, `NEXT_PUBLIC_SOLANA_RPC_PRIMARY`, `VORTEX_JWT_SECRET`). Production start fails fast if any are missing (`src/lib/server/env.ts`).
3. Generate a domain with `railway domain`.

Do not deploy to Vercel with this setup: that's fine for the app, but keep the database on Postgres, never SQLite.
