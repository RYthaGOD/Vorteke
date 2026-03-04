'use client';
import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

import { RPC_ENDPOINTS } from '@/lib/constants';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaProvider = ({ children }: { children: React.ReactNode }) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Mainnet;

    const [endpoint, setEndpoint] = React.useState<string>(RPC_ENDPOINTS[0] || clusterApiUrl(network));

    React.useEffect(() => {
        const pingEndpoints = async () => {
            if (RPC_ENDPOINTS.length <= 1) return;

            for (const ep of RPC_ENDPOINTS) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);

                    const res = await fetch(ep, {
                        method: 'POST',
                        body: JSON.stringify({ jsonrpc: '2.0', id: 'vortex-rpc-check', method: 'getVersion' }),
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (res.ok) {
                        setEndpoint(prev => (prev !== ep ? ep : prev));
                        break;
                    }
                } catch (e) {
                    console.warn(`[VORTEX_RPC] Node ${ep} unavailable. Rotating...`);
                }
            }
        };

        pingEndpoints();
        const interval = setInterval(pingEndpoints, 60000);
        return () => clearInterval(interval);
    }, []);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {mounted && children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
