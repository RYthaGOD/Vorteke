// Products sold for SOL at a USD price, converted when the payment is created.
export const PRODUCTS = {
    Enhanced: { usdCents: 2900, label: 'Enhanced profile', needsProfile: true },
    Boost: { usdCents: 500, label: 'Trending boost', needsProfile: true, hours: 24 },
    EliteAccess: { usdCents: 2900, label: 'Elite access', needsProfile: false, days: 30 },
};

export const PRODUCT_NAMES = Object.keys(PRODUCTS);

// Quotes are rounded up to 0.00001 SOL so wallets show a tidy amount.
const LAMPORT_STEP = 10_000;

/**
 * Lamports for a USD price at the given SOL/USD rate. Refuses implausible rates rather
 * than charging a wildly wrong amount when a price feed misbehaves.
 */
export function usdToLamports(usdCents, solUsd) {
    if (!Number.isSafeInteger(usdCents) || usdCents <= 0) throw new Error('INVALID_PRICE');
    if (!Number.isFinite(solUsd) || solUsd < 5 || solUsd > 10_000) throw new Error('SOL_PRICE_UNAVAILABLE');
    const exact = (usdCents / 100 / solUsd) * 1e9;
    return Math.ceil(exact / LAMPORT_STEP) * LAMPORT_STEP;
}

export function formatUsd(usdCents) {
    return '$' + (usdCents % 100 === 0 ? String(usdCents / 100) : (usdCents / 100).toFixed(2));
}
