'use client';
import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { verifyEliteAccess } from '@/lib/monetizationService';
import { Loader2, ShieldAlert, Activity, Wifi, Grid3x3, MonitorPlay } from 'lucide-react';
import { VortexPanel } from '@/components/DesignSystem';
import dynamic from 'next/dynamic';

const TokenChart = dynamic(() => import('@/components/TokenChart').then(mod => mod.TokenChart), { ssr: false });

export default function CommandCenter() {
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
                    <p className="vortex-text-xs vortex-text-muted vortex-ls-wider">VERIFYING_COMMAND_AUTHORIZATION...</p>
                </div>
            </div>
        );
    }

    if (!isVerified) {
        return (
            <div className="vortex-full-screen-center">
                <div className="vortex-panel vortex-w-400 vortex-text-center vortex-border-red vortex-glow-red">
                    <ShieldAlert size={48} className="text-vortex-red vortex-m-auto vortex-mb-4" />
                    <h2 className="vortex-h-hud vortex-text-red">COMMAND_ACCESS_DENIED</h2>
                    <p className="vortex-text-sm vortex-text-muted vortex-mb-6">
                        This terminal requires Vortex Elite authorization.
                        Hold an Elite Pass NFT to initialize the Command Center protocol.
                    </p>
                    <button className="btn-vortex btn-vortex-primary vortex-bg-red vortex-w-full" onClick={() => router.push('/')}>
                        RETURN_TO_BASE
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="vortex-fullscreen vortex-bg-obsidian vortex-flex-column vortex-overflow-hidden">
            {/* Header / HUD */}
            <header className="vortex-p-4 vortex-border-b border-vortex-obsidian vortex-flex-between vortex-bg-obsidian-soft">
                <div className="vortex-flex-start vortex-gap-4">
                    <div className="vortex-logo-icon vortex-logo-sm"></div>
                    <div className="vortex-h-hud vortex-m-0 text-vortex-purple">VORTEX_COMMAND_CENTER</div>
                    <div className="badge-vortex vortex-bg-purple text-vortex-obsidian">ELITE_SYNDICATE_ACTIVE</div>
                </div>
                <div className="vortex-flex-end vortex-gap-4">
                    <div className="vortex-flex-start vortex-gap-2">
                        <Wifi size={14} className="text-vortex-cyan animate-pulse" />
                        <span className="vortex-text-tiny vortex-font-mono text-vortex-cyan">SYNDICATE_ROUTER_PING: 12ms</span>
                    </div>
                    <div className="vortex-flex-start vortex-gap-2">
                        <Activity size={14} className="text-vortex-green animate-pulse" />
                        <span className="vortex-text-tiny vortex-font-mono text-vortex-green">WS_FEED_STABLE</span>
                    </div>
                </div>
            </header>

            {/* Main Terminal Grid */}
            <div className="vortex-flex-1 vortex-p-4 vortex-grid-2 vortex-gap-4">

                {/* Quadrant 1 */}
                <VortexPanel title="TARGET_ALPHA" subTitle="JUPITER (JUP)" className="vortex-flex-column">
                    <div className="vortex-flex-1 vortex-w-full vortex-min-h-[300px]">
                        {/* Placeholder for real multi-chart logic */}
                        <div className="vortex-full-size vortex-flex-column vortex-center vortex-border-dashed border-vortex-cyan vortex-opacity-50">
                            <MonitorPlay size={32} className="vortex-mb-2 text-vortex-cyan" />
                            <div className="vortex-text-xs vortex-font-mono text-vortex-cyan">INITIALIZING_STREAM_ALPHA...</div>
                        </div>
                    </div>
                </VortexPanel>

                {/* Quadrant 2 */}
                <VortexPanel title="TARGET_BETA" subTitle="AWAITING_INPUT" className="vortex-flex-column">
                    <div className="vortex-flex-1 vortex-w-full vortex-min-h-[300px]">
                        <div className="vortex-full-size vortex-flex-column vortex-center vortex-border-dashed border-vortex-muted vortex-opacity-30">
                            <Grid3x3 size={32} className="vortex-mb-2 text-vortex-muted" />
                            <div className="vortex-text-xs vortex-font-mono text-vortex-muted">AWAITING_CHART_TARGET...</div>
                        </div>
                    </div>
                </VortexPanel>

                {/* Quadrant 3 */}
                <div className="vortex-flex-column vortex-gap-4">
                    <VortexPanel title="SYNDICATE_MEMPOOL_SNIPER" subTitle="LIVE_BLOCKS" variant="glass" className="vortex-flex-1">
                        <div className="vortex-h-full vortex-overflow-y-auto">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="vortex-flex-between vortex-p-2 vortex-border-b border-vortex-obsidian vortex-font-mono vortex-text-xs">
                                    <span className="text-vortex-purple">Block {3141592 + i}</span>
                                    <span className="vortex-text-muted">Targeted 0.04s ago</span>
                                    <span className="text-vortex-green">Extracted +0.{Math.floor(Math.random() * 99)} SOL</span>
                                </div>
                            ))}
                        </div>
                    </VortexPanel>
                </div>

                {/* Quadrant 4 */}
                <div className="vortex-flex-column vortex-gap-4">
                    <VortexPanel title="ELITE_EXECUTION_ROUTER" subTitle="PRIVATE_MEV_POOL" glowColor="cyan">
                        <div className="vortex-p-4 vortex-bg-obsidian-soft vortex-border-radius-md vortex-text-center vortex-mb-4 text-vortex-purple">
                            <ShieldAlert size={24} className="vortex-m-auto vortex-mb-2" />
                            <div className="vortex-text-sm vortex-text-bold">SYNDICATE ROUTING ENGAGED</div>
                            <div className="vortex-text-tiny vortex-text-muted">Bypassing public Jito mempool. Zero-latency frontrun protection active.</div>
                        </div>

                        <div className="vortex-input-group vortex-mb-4">
                            <input type="text" className="vortex-input-field vortex-full-width vortex-font-mono" placeholder="Target Contract Address..." />
                        </div>
                        <div className="vortex-grid-2 vortex-gap-2 vortex-mb-4">
                            <div className="vortex-input-group">
                                <input type="number" className="vortex-input-field vortex-full-width" placeholder="SOL Amount" />
                            </div>
                            <div className="vortex-input-group">
                                <input type="number" className="vortex-input-field vortex-full-width" placeholder="Slippage %" value="1.5" readOnly />
                            </div>
                        </div>
                        <button className="btn-vortex btn-vortex-primary vortex-bg-purple vortex-w-full vortex-text-lg vortex-py-4">
                            EXECUTE SYNDICATE SWAP
                        </button>
                    </VortexPanel>
                </div>

            </div>
        </div>
    );
}
