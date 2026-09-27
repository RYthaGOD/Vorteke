# 🚀 VORTEX Deployment Architecture Guide

**CRITICAL WARNING: DO NOT DEPLOY TO VERCEL USING SQLITE**

During the local development phase, we successfully bypassed the connection errors to your remote Supabase instance by migrating the Prisma schema to use a local `dev.db` (SQLite) file. 

While this allows for flawless, blazing-fast local iteration and offline development, **it is fundamentally incompatible with Vercel's serverless environment.**

## The Serverless Database Problem
Vercel operates using ephemeral, stateless serverless functions. 
If you deploy `Vorteke` right now, Vercel will spin up a function, create a brand-new `dev.db` file, and process the request. **The moment that function goes idle, it will be destroyed—along with the entire SQLite database.**
Every user's Elite status, every token's `$DEX` burn amount, and every DeepScan record will be instantly wiped on every cold boot.

## How to Fix This Before Mainnet Launch

To prepare VORTEX for production, you must switch back to a persistent PostgreSQL instance (like Supabase, Neon, or Vercel Postgres).

### Step 1: Fix Your Remote PostgreSQL Instance
Ensure your Supabase project (Project ID: `nviprdqpwrghznzkevns`) is actually active, un-paused, and allows connections from your deployment region.

### Step 2: Revert Prisma to PostgreSQL
In `prisma/schema.prisma`, change the provider back:
```prisma
datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
}
```

### Step 3: Re-Enable JSON Fields
Change the fields back to the native `Json?` type since PostgreSQL natively supports JSON indexing, which is much faster than parsing strings on the fly:
```prisma
model Token {
    // ...
    securityTags    Json?
    advancedMetrics Json?
}

model Enhancement {
    // ...
    socials           Json?
}
```
*(Remember to revert the `JSON.parse` / `JSON.stringify` logic in `src/app/api/claim/route.ts` and `src/app/api/enhancement/[address]/route.ts` when you do this!)*

### Step 4: Update Production `.env`
Ensure your Vercel Environment Variables contain the exact, verified connection strings for `DATABASE_URL` and `DIRECT_URL`.

Once these steps are completed, your application will be fully scalable, robust, and ready to dominate the Dex Screener monopoly.
