'use client';

import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body className="vortex-bg-obsidian text-vortex-primary" style={{ backgroundColor: '#050506', color: '#FFF', fontFamily: 'monospace' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '24px' }}>
                    <AlertOctagon size={48} color="#EF4444" style={{ marginBottom: '16px' }} />
                    <h1 style={{ color: '#EF4444', fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>CRITICAL_SYSTEM_FAILURE</h1>
                    <p style={{ color: '#A1A1AA', textAlign: 'center', maxWidth: '400px', marginBottom: '24px' }}>
                        The Vortex terminal encountered a fatal exception at the root layout boundary. System integrity compromised.
                    </p>
                    <code style={{ background: '#121216', padding: '12px', borderRadius: '4px', fontSize: '12px', color: '#EF4444', marginBottom: '24px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        {error.message || 'Unknown Segment Fault'}
                    </code>
                    <button
                        onClick={() => reset()}
                        style={{ display: 'flex', alignItems: 'center', background: '#EF4444', color: '#000', border: 'none', padding: '12px 24px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}
                    >
                        <RotateCcw size={16} style={{ marginRight: '8px' }} />
                        REBOOT_TERMINAL
                    </button>
                </div>
            </body>
        </html>
    );
}
