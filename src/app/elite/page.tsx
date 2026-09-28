'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { verifyEliteAccess } from '@/lib/monetizationService';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import EliteDashboard from '@/components/EliteDashboard';
import { VortexPanel } from '@/components/DesignSystem';
import { Loader2, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useNotificationStore } from '@/lib/store';

const WalletMultiButton = dynamic(
    async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
    { ssr: false }
);

export default function ElitePage() {
    const { publicKey, connected, signMessage } = useVortexAuth();
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [accessKey, setAccessKey] = useState('');
    const [keyError, setKeyError] = useState<string | null>(null);
    const notify = useNotificationStore(state => state.notify);

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
            <main id="main-content" className="vortex-main vortex-center">
                <div className="vortex-flex-column vortex-center vortex-gap-6 animate-pulse">
                    <div className="vortex-logo-geometry size-xl text-vortex-cyan" />
                    <div className="vortex-text-tiny vortex-text-bold vortex-ls-wide vortex-uppercase text-vortex-cyan">
                        Checking your access…
                    </div>
                </div>
            </main>
        );
    }

    if (!isVerified) {
        return (
            <main id="main-content" className="vortex-main vortex-center">
                <div className="vortex-container-sm">
                    <VortexPanel
                        title="Elite intelligence"
                        subTitle="Access required"
                        glowColor="yellow"
                        showCorners={false}
                        variant="glass"
                    >
                        <div className="vortex-flex-column vortex-center vortex-gap-8 vortex-py-8">
                            <div className="gate-icon hud-flicker">
                                <ShieldAlert size={48} className="text-vortex-yellow" aria-hidden="true" />
                            </div>

                            <div className="vortex-text-center px-4">
                                <h2 className="vortex-text-xl vortex-text-extrabold vortex-mb-2">Your research workspace</h2>
                                <p className="vortex-text-sm vortex-text-secondary vortex-max-w-xs vortex-mx-auto">
                                    Elite is for holders of the Elite Pass NFT or an access code. Connect your wallet to check.
                                </p>
                            </div>

                            {!connected ? (
                                <div className="vortex-flex-column vortex-center vortex-gap-4 vortex-w-full px-8">
                                    <WalletMultiButton className="vortex-wallet-btn" />
                                </div>
                            ) : (
                                <div className="vortex-w-full px-8">
                                    <div className="vortex-divider-text">Enter your access code</div>
                                    <form
                                        className="vortex-flex vortex-gap-2 vortex-mt-4"
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (!accessKey.trim() || !publicKey || !signMessage || isSubmitting) return;
                                            setIsSubmitting(true);
                                            setKeyError(null);
                                            try {
                                                const code = accessKey.trim();
                                                const timestamp = Date.now();
                                                const message = `VORTEX_PROVISION_ACCESS:${publicKey.toBase58()}:${timestamp}`;
                                                let signature: string;
                                                try {
                                                    const signatureBytes = await signMessage(new TextEncoder().encode(message));
                                                    signature = Buffer.from(signatureBytes).toString('base64');
                                                } catch {
                                                    setKeyError('Your wallet declined to sign the verification message.');
                                                    notify('error', 'SIGNATURE_REJECTED: Wallet refused to sign.');
                                                    return;
                                                }

                                                const res = await fetch('/api/auth/provision', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ wallet: publicKey.toBase58(), code, signature, timestamp })
                                                });

                                                if (res.ok) {
                                                    setIsVerified(true);
                                                } else {
                                                    const body = await res.json().catch(() => ({}));
                                                    setKeyError(body.error === 'ACCESS_CODES_DISABLED'
                                                        ? 'Access codes are not being accepted right now.'
                                                        : 'That access key was not accepted.');
                                                    notify('error', 'INVALID_ACCESS_KEY: Clearance denied.');
                                                }
                                            } catch {
                                                setKeyError('Could not reach the server. Try again in a moment.');
                                                notify('error', 'NETWORK_ERROR: Provision request failed.');
                                            } finally {
                                                setIsSubmitting(false);
                                            }
                                        }}
                                    >
                                        <label htmlFor="vortex-alpha-key" className="vortex-sr-only">Alpha access key</label>
                                        <input
                                            id="vortex-alpha-key"
                                            type="password"
                                            autoComplete="off"
                                            spellCheck={false}
                                            className="vortex-input-tactical"
                                            placeholder="Access code"
                                            value={accessKey}
                                            onChange={(e) => { setAccessKey(e.target.value); setKeyError(null); }}
                                            aria-invalid={keyError ? true : undefined}
                                            aria-describedby={keyError ? 'alpha-key-error' : undefined}
                                            disabled={isSubmitting}
                                        />
                                        <button
                                            type="submit"
                                            className="vortex-btn-icon vortex-icon-btn text-vortex-yellow"
                                            aria-label="Submit access key"
                                            disabled={isSubmitting || !accessKey.trim()}
                                            aria-busy={isSubmitting}
                                        >
                                            <Loader2 size={18} className={isSubmitting ? 'animate-spin' : ''} aria-hidden="true"  />
                                        </button>
                                    </form>
                                    {keyError && (
                                        <p id="alpha-key-error" role="alert" className="vortex-text-tiny vortex-text-red vortex-mt-2 vortex-text-center">
                                            {keyError}
                                        </p>
                                    )}
                                    <p className="vortex-text-xs vortex-text-secondary vortex-mt-2 vortex-text-center">No Elite Pass found in this wallet. Have an access code? Enter it above.</p>
                                </div>
                            )}

                            <Link className="vortex-btn-secondary vortex-w-full mt-4" href="/terminal">
                                Back to markets
                            </Link>
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
        <main id="main-content" className="app-container">

            <div className="vortex-container-centered vortex-mt-6 animate-stagger">
                <EliteDashboard />
            </div>
        </main>
    );
}
