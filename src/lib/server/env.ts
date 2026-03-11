export const requiredEnv = [
    'NEXT_PUBLIC_SOLANA_RPC_PRIMARY',
    'NEXT_PUBLIC_ADMIN_PUBKEY',
    'HELIUS_API_KEY',
    'BIRDEYE_API_KEY',
    'DATABASE_URL',
    'VORTEX_JWT_SECRET',
];

export const validateEnv = () => {
    const missing = requiredEnv.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error("CRITICAL_CONFIGURATION_ERROR: Missing required environment variables:");
        missing.forEach(key => console.error(` - ${key}`));

        // BUILD_TIME_RESILIENCE: During 'next build', we only warn.
        // During production runtime, we throw to prevent silent system degradation.
        const isNextBuild = process.env.NEXT_PHASE === 'phase-production-build';

        if (process.env.NODE_ENV === 'production' && !isNextBuild) {
            throw new Error(`DEPLOYMENT_BLOCKED: Missing configuration for ${missing.join(', ')}`);
        } else if (isNextBuild) {
            console.warn("BUILD_PHASE: Proceeding without strict enforcement (static hydration may be degraded).");
        }
    } else {
        console.log("CONFIGURATION_VERIFIED: All production systems ready.");
    }
};
