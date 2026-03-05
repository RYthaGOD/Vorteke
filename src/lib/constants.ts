/**
 * VORTEX Global System Constants
 */

export const HELIUS_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || '';
export const HELIUS_API_KEY = HELIUS_RPC.split('api-key=')[1] || '';
export const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';

export const RPC_ENDPOINTS = [
    HELIUS_RPC,
    process.env.NEXT_PUBLIC_SOLANA_RPC_PRIMARY,
    process.env.NEXT_PUBLIC_SOLANA_RPC_SECONDARY,
    'https://rpc.ankr.com/solana',
    'https://solana-api.projectserum.com',
    'https://api.mainnet-beta.solana.com'
].filter((url): url is string => !!url);

export const PROTECTED_MINT_ADDRESSES = [
    'So11111111111111111111111111111111111111112', // Wrapped SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaDCSTMdUiAnQxt9shFBXon6mVeL3vpt3TSh', // USDT
    'JUPyiwrYPRnK3B9kR4A9p7YQ8vLwK2qNCjY7MkW99Ld', // JUP
    'DezXAZhfjsmAW3kz8fWkbeXp5oV8Xyit2nXU3C8sqxg', // BONK
    'HZ1JovncqS1sbph6YMa6S6fVyc92vBwkoayS9vntvS8P', // PYTH
    '4k3DyjR1Wms8n7jLxTOvUzr7p238a6m99FmQzo48MwnC', // RAY
];

export const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';

export const TREASURY_SWAPS = 'C29gx6Wq2fvuBXrj9YjoTTFYHXhsB5dD5cWd7bmu9PDp'; // Vortex Treasury Alpha
export const TREASURY_ENHANCEMENTS = 'jawKuQ3xtcYoAuqE9jyG2H35sv2pWJSzsyjoNpsxG38'; // Elite Enhancements Revenue
export const VORTEX_OPS = '8hLpEK6D2msZnC2HKeaxHiEiTLLSwRvd31FqUCNrYnP2'; // Vortex Ops Beta

// Jito-Turbo Protocol Constants
export const JITO_TIP_ACCOUNTS = [
    '96g9sAg9u3mBsJqcRepo4m9637jg7BSM7zXv8Uf8SdfS',
    'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gM8',
    'Cw8CFFL1T49q9895AB6Yv8sUygM96shKthshLdK8T7n6'
];
export const JITO_BUNDLE_API = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles';
export const JITO_DEFAULT_TIP_LAMPORTS = 100000; // 0.0001 SOL tactical base

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export const PROTOCOL_FLAT_FEE_SOL = 0.0075;
export const PROTOCOL_FLAT_FEE_LAMPORTS = 0.0075 * 1000000000;

export const VTX_MINT = process.env.NEXT_PUBLIC_VTX_MINT || '';
