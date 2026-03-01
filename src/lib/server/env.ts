export const requiredEnv = [
    'NEXT_PUBLIC_SOLANA_RPC_PRIMARY',
    'NEXT_PUBLIC_ADMIN_PUBKEY',
];

export const validateEnv = () => {
    const missing = requiredEnv.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error("CRITICAL_CONFIGURATION_ERROR: Missing required environment variables:");
        missing.forEach(key => console.error(` - ${key}`));

        if (process.env.NODE_ENV === 'production') {
            throw new Error(`DEPLOYMENT_BLOCKED: Missing configuration for ${missing.join(', ')}`);
        }
    } else {
        console.log("CONFIGURATION_VERIFIED: All production systems ready.");
    }
};
