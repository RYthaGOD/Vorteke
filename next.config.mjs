/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            os: false,
            path: false,
            crypto: false,
        };
        return config;
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                    {
                        key: 'Content-Security-Policy',
                        // FIX: Hardened CSP (Removed dexscreener domains, conditional unsafe-eval for dev)
                        value: `default-src 'self'; script-src 'self' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ""} 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: wss: https://*.solflare.com https://connect.solflare.com https://*.jup.ag; frame-src 'self' https://jup.ag https://*.jup.ag https://*.solflare.com https://connect.solflare.com; object-src 'none'; base-uri 'self';`,
                    },
                ],
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

export default nextConfig;
