'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useState, useEffect } from 'react';
import { EliteStatus, fetchEliteStatus } from '@/lib/monetizationService';

export function useVortexAuth() {
    const { publicKey: realPK, connected: realConnected, wallet, disconnect, select, connecting, disconnecting, signMessage } = useWallet();
    const [auditPK, setAuditPK] = useState<PublicKey | null>(null);
    const [isAuditMode, setIsAuditMode] = useState(false);
    const [elite, setElite] = useState<EliteStatus>({ isElite: false, expiresAt: null });
    const [eliteCheck, setEliteCheck] = useState(0);

    useEffect(() => {
        // SECURITY: Only allow audit mode in development builds — never in production
        if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'development') return;

        const params = new URLSearchParams(window.location.search);
        const pkParam = params.get('audit_pk');

        if (pkParam) {
            try {
                setAuditPK(new PublicKey(pkParam));
                setIsAuditMode(true);
            } catch (e) {
                console.warn("INVALID_AUDIT_PK");
            }
        }
    }, []);

    const publicKey = realPK || auditPK;
    const connected = realConnected || isAuditMode;

    useEffect(() => {
        if (publicKey && connected) {
            fetchEliteStatus(publicKey.toString()).then(setElite);
        } else {
            setElite({ isElite: false, expiresAt: null });
        }
    }, [publicKey, connected, eliteCheck]);

    return {
        publicKey: publicKey as any,
        connected,
        realPK,
        realConnected,
        isAuditMode,
        isElite: elite.isElite,
        eliteExpiresAt: elite.expiresAt,
        refreshElite: () => setEliteCheck(n => n + 1),
        wallet,
        disconnect,
        select,
        connecting,
        disconnecting,
        signMessage
    };
}
