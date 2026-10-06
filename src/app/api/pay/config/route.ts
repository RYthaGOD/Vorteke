import { NextResponse } from 'next/server';
import { SOLANA_NETWORK, TREASURY_ENHANCEMENTS } from '@/lib/constants';
import { PRODUCTS, usdToLamports } from '@/lib/payments/pricing.mjs';
import { getSolUsdPrice } from '@/lib/payments/solPrice';

export const dynamic = 'force-dynamic';

/** Prices in USD, with an indicative SOL amount at the current rate. The charge is fixed when a payment starts. */
export async function GET() {
    const solUsd = await getSolUsdPrice().catch(() => null);
    const products = Object.fromEntries(Object.entries(PRODUCTS).map(([name, product]) => {
        let lamports: number | null = null;
        try { if (solUsd) lamports = usdToLamports(product.usdCents, solUsd); } catch { /* no quote */ }
        return [name, { ...product, lamports }];
    }));
    return NextResponse.json({ network: SOLANA_NETWORK, treasury: TREASURY_ENHANCEMENTS, solUsd, products });
}
