'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyEliteAccess } from '@/lib/monetizationService';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import EliteDashboard from '@/components/EliteDashboard';
import { VortexPanel } from '@/components/DesignSystem';
import { Loader2, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
    async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
    { ssr: false }
);

export default function ElitePage() {
    const { publicKey, connected, signMessage } = useVortexAuth();
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
            <main className="vortex-main vortex-center">
                <div className="vortex-flex-column vortex-center vortex-gap-6 animate-pulse">
                    <div className="vortex-logo-geometry size-xl text-vortex-cyan" />
                    <div className="vortex-text-tiny vortex-text-bold vortex-ls-wide vortex-uppercase text-vortex-cyan">
                        VERIFYING_ELITE_CREDENTIALS...
                    </div>
                </div>
            </main>
        );
    }

    if (!isVerified) {
        return (
            <main className="vortex-main vortex-center">
                <div className="vortex-container-sm">
                    <VortexPanel
                        title="TACTICAL_GATEKEEPER_V3"
                        subTitle="ELITE_ENCRYPTED_SECTOR"
                        glowColor="yellow"
                        showCorners={true}
                        variant="glass"
                    >
                        <div className="vortex-flex-column vortex-center vortex-gap-8 vortex-py-8">
                            <div className="gate-icon hud-flicker">
                                <ShieldAlert size={48} className="text-vortex-yellow" />
                            </div>

                            <div className="vortex-text-center px-4">
                                <h2 className="vortex-text-xl vortex-text-extrabold vortex-mb-2">ACCESS_LOCKED</h2>
                                <p className="vortex-text-xs vortex-text-muted vortex-max-w-xs vortex-mx-auto">
                                    This terminal requires Vortex Elite authorization. Hold an Elite Pass NFT or provide a verified Alpha access key.
                                </p>
                            </div>

                            {!connected ? (
                                <div className="vortex-flex-column vortex-center vortex-gap-4 vortex-w-full px-8">
                                    <div className="vortex-text-tiny vortex-text-muted vortex-font-mono text-vortex-cyan">AUTHORIZATION_PENDING...</div>
                                    <WalletMultiButton className="vortex-wallet-btn" />
                                </div>
                            ) : (
                                <div className="vortex-w-full px-8">
                                    <div className="vortex-divider-text">ENTER_ALPHA_KEY</div>
                                    <div className="vortex-flex vortex-gap-2 vortex-mt-4">
                                        <input
                                            type="password"
                                            className="vortex-input-tactical"
                                            placeholder="INPUT_ACCESS_KEY"
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter' && e.currentTarget.value === 'VORTEKE' && publicKey && signMessage) {
                                                    try {
                                                        const timestamp = Date.now();
                                                        const message = `VORTEX_PROVISION_ACCESS:${publicKey.toBase58()}:${timestamp}`;
                                                        const signatureBytes = await signMessage(new TextEncoder().encode(message));
                                                        const signature = Buffer.from(signatureBytes).toString('base64');

                                                        const res = await fetch('/api/auth/provision', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ wallet: publicKey.toBase58(), code: 'VORTEKE', signature, timestamp })
                                                        });

                                                        if (res.ok) setIsVerified(true);
                                                        else alert('INVALID_ACCESS_KEY');
                                                    } catch (err) {
                                                        alert('SIGNATURE_REJECTED');
                                                    }
                                                }
                                            }}
                                        />
                                        <div className="vortex-btn-icon text-vortex-yellow">
                                            <Loader2 size={18} className="animate-spin" />
                                        </div>
                                    </div>
                                    <p className="vortex-text-tiny vortex-text-muted vortex-mt-2 vortex-text-center">PRESS_ENTER_TO_DECRYPT</p>
                                </div>
                            )}

                            <button className="vortex-btn-secondary vortex-w-full mt-4" onClick={() => router.push('/')}>
                                RETURN_TO_BASE
                            </button>
                        </div>
                    </VortexPanel>
                </div>

                <style jsx>{`
                    .gate-icon {
                        width: 80px;
                        height: 80px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(229, 255, 0, 0.05);
                        border: 1px solid rgba(229, 255, 0, 0.2);
                        box-shadow: 0 0 30px rgba(229, 255, 0, 0.05);
                    }
                `}</style>
            </main>
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
