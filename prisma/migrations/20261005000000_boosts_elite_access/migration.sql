-- Trending boosts now expire, Elite access is sold per wallet, and payments record their USD price.

-- AlterTable
ALTER TABLE "Enhancement" ADD COLUMN     "boostExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Enhancement_boostExpiresAt_idx" ON "Enhancement"("boostExpiresAt");

-- The old 'Elite' profile tier was the paid boost. It becomes an Enhanced profile with a 24-hour boost.
UPDATE "Enhancement" SET "tier" = 'Enhanced', "boostExpiresAt" = CURRENT_TIMESTAMP + INTERVAL '24 hours' WHERE "tier" = 'Elite';

-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "usdCents" INTEGER;

-- Rename TestAccess to EliteAccess, keeping existing grants.
ALTER TABLE "TestAccess" RENAME TO "EliteAccess";
ALTER TABLE "EliteAccess" RENAME CONSTRAINT "TestAccess_pkey" TO "EliteAccess_pkey";
ALTER INDEX "TestAccess_expiresAt_idx" RENAME TO "EliteAccess_expiresAt_idx";
ALTER TABLE "EliteAccess" DROP COLUMN "tier";
ALTER TABLE "EliteAccess" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'grant';
ALTER TABLE "EliteAccess" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Token rows were written from browser-sent data until now. Clear the creator and mark every row
-- stale so the next view refreshes name, symbol, logo and creator from chain and Helius.
UPDATE "Token" SET "creator" = NULL, "lastUpdated" = to_timestamp(0);

-- CreateTable: daily funnel counts (token view, claim started, claim done, payment started, paid).
CREATE TABLE "FunnelEvent" (
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("day","name")
);
