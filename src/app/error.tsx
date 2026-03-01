'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('VORTEX_SYSTEM_CRASH:', error);
    }, [error]);

    return (
        <div className="vortex-flex-center vortex-full-height vortex-full-width vortex-bg-obsidian">
            <div className="vortex-panel vortex-w-260 vortex-text-center animate-stagger">
                <AlertTriangle size={48} className="text-vortex-red vortex-m-auto vortex-mb-4" />
                <h2 className="vortex-card-title vortex-text-bright">SYSTEM_CRITICAL_HALT</h2>
                <p className="vortex-text-xs vortex-text-muted vortex-mb-6">
                    Neural link severed. Protocol failure detected in telemetry uplink.
                </p>
                <div className="vortex-flex-column vortex-gap-3">
                    <button
                        onClick={() => reset()}
                        className="btn-vortex btn-vortex-primary vortex-w-full vortex-flex-center vortex-gap-2"
                    >
                        <RefreshCw size={14} />
                        RE-INITIALIZE
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="btn-vortex vortex-w-full vortex-flex-center vortex-gap-2"
                    >
                        <Home size={14} />
                        RETURN_TO_BASE
                    </button>
                </div>
                <div className="vortex-mt-6 vortex-text-tiny vortex-text-muted vortex-font-mono vortex-opacity-30">
                    ERROR_DIGEST: {error.digest || 'UNKNOWN'}
                </div>
            </div>
        </div>
    );
}
