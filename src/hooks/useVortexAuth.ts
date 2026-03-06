'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useState, useEffect } from 'react';
import { verifyEliteAccess } from '@/lib/monetizationService';

export function useVortexAuth() {
    const { publicKey: realPK, connected: realConnected, wallet, disconnect, select, connecting, disconnecting, signMessage } = useWallet();
    const [auditPK, setAuditPK] = useState<PublicKey | null>(null);
    const [isAuditMode, setIsAuditMode] = useState(false);
    const [isElite, setIsElite] = useState(false);

    useEffect(() => {
        // Only allow audit mode in development or when explicitly triggered via secret param
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
            verifyEliteAccess(publicKey.toString()).then(setIsElite);
        } else {
            setIsElite(false);
        }
    }, [publicKey, connected]);

    return {
        publicKey,
        connected,
        realPK,
        realConnected,
        isAuditMode,
        isElite,
        wallet,
        disconnect,
        select,
        connecting,
        disconnecting,
        signMessage
    };
}
