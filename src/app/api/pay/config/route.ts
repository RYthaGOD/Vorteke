import { NextResponse } from 'next/server';
import { SOLANA_NETWORK, TREASURY_ENHANCEMENTS, TIER_PRICES_SOL } from '@/lib/constants';

export function GET() {
    return NextResponse.json({ network: SOLANA_NETWORK, treasury: TREASURY_ENHANCEMENTS, prices: TIER_PRICES_SOL });
}
