-- CreateTable
CREATE TABLE "Token" (
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "logoURI" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceChange24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidityUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fdv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mcap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'Basic',
    "securityTags" TEXT,
    "advancedMetrics" TEXT,
    "creator" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "Enhancement" (
    "address" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'Basic',
    "owner" TEXT,
    "socials" TEXT,
    "customDescription" TEXT,
    "bannerURI" TEXT,
    "iconURI" TEXT,
    "lastPaymentTx" TEXT,
    "lastPaymentTime" TIMESTAMP(3),

    CONSTRAINT "Enhancement_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAccess" (
    "wallet" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'Elite',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestAccess_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "DeepScanRecord" (
    "signature" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeepScanRecord_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "key" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "requestsThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "lamports" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "signature" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("signature")
);

-- CreateIndex
CREATE INDEX "Token_creator_idx" ON "Token"("creator");

-- CreateIndex
CREATE UNIQUE INDEX "Enhancement_lastPaymentTx_key" ON "Enhancement"("lastPaymentTx");

-- CreateIndex
CREATE INDEX "Enhancement_lastPaymentTx_idx" ON "Enhancement"("lastPaymentTx");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_address_wallet_key" ON "Claim"("address", "wallet");

-- CreateIndex
CREATE INDEX "TestAccess_expiresAt_idx" ON "TestAccess"("expiresAt");

-- CreateIndex
CREATE INDEX "ApiKey_email_idx" ON "ApiKey"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_intentId_key" ON "PaymentReceipt"("intentId");

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

