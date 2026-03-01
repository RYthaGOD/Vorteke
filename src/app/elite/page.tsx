'use client';
import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { verifyEliteAccess } from '@/lib/monetizationService';
import EliteDashboard from '@/components/EliteDashboard';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function ElitePage() {
    const { publicKey, connected } = useWallet();
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        const verify = async () => {
            if (connected && publicKey) {
                const status = await verifyEliteAccess(publicKey.toString());
                setIsVerified(status);
            } else if (!connected) {
                setIsVerified(false);
            }
        };
        verify();
    }, [connected, publicKey]);

    if (isVerified === null) {
        return (
            <div className="vortex-full-screen-center">
                <div className="vortex-flex-column vortex-center">
                    <Loader2 size={48} className="text-vortex-yellow animate-spin vortex-mb-4" />
                    <p className="vortex-text-xs vortex-text-muted vortex-ls-wider">VERIFYING_ELITE_CREDENTIALS...</p>
                </div>
            </div>
        );
    }

    if (!isVerified) {
        return (
            <div className="vortex-full-screen-center">
                <div className="vortex-panel vortex-w-400 vortex-text-center">
                    <ShieldAlert size={48} className="text-vortex-red vortex-m-auto vortex-mb-4" />
                    <h2 className="vortex-h-hud vortex-text-red">ACCESS_DENIED</h2>
                    <p className="vortex-text-sm vortex-text-muted vortex-mb-6">
                        This terminal requires Vortex Elite authorization.
                        Hold an Elite Pass NFT or gain Admin approval to proceed.
                    </p>
                    <button className="btn-vortex btn-vortex-primary vortex-w-full" onClick={() => router.push('/')}>
                        RETURN_TO_BASE
                    </button>
                </div>
            </div>
        );
    }

    return (
        <main className="app-container">
            <div className="main-content vortex-pt-8">
                <EliteDashboard />
            </div>
        </main>
    );
}
