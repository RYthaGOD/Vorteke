'use client';
import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw } from 'lucide-react';
import { purchaseEnhancement, claimProject, verifyPayment } from '@/lib/monetizationService';
import { Transaction } from '@solana/web3.js';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Modal } from './DesignSystem';
import { SOLANA_NETWORK, TIER_PRICES_SOL, TREASURY_ENHANCEMENTS } from '@/lib/constants';
import bs58 from 'bs58';

type Tier = 'Enhanced' | 'Elite';
type Pending = { signature: string; tier: Tier; wallet: string };
export function EnhancementModal({ address, onClose, onPurchase, notify }: {
    address: string; onClose: () => void; onPurchase: () => void;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
    const { connection } = useConnection();
    const { publicKey, connected } = useVortexAuth();
    const { signMessage, sendTransaction } = useWallet();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState<Pending | null>(null);
    const wallet = publicKey?.toBase58();
    const storageKey = 'vortex-payment:' + SOLANA_NETWORK + ':' + address + ':' + wallet;
    useEffect(() => {
        setPending(null);
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (saved && typeof saved.signature === 'string' && ['Enhanced', 'Elite'].includes(saved.tier) && saved.wallet === wallet) setPending(saved);
        } catch { /* Storage can be unavailable in private browsing. */ }
    }, [storageKey, wallet]);
    const remember = (value: Pending | null) => {
        setPending(value);
        try { if (value) localStorage.setItem(storageKey, JSON.stringify(value)); else localStorage.removeItem(storageKey); } catch {}
    };
    const recheck = async (payment: Pending) => {
        const success = await verifyPayment(payment.signature, address, payment.tier, payment.wallet);
        if (success) {
            remember(null);
            notify('success', 'Your profile upgrade is active.');
            onPurchase(); onClose();
        } else setMessage('Waiting for verification. Recheck this payment before making another purchase. If the transaction failed, no upgrade charge was settled.');
    };
    const claim = async () => {
        if (!wallet || !signMessage) return;
        setBusy(true); setMessage('');
        try {
            const timestamp = Date.now();
            const bytes = await signMessage(new TextEncoder().encode('VORTEX_CLAIM::' + address + '::' + wallet + '::' + timestamp));
            if (!await claimProject(address, wallet, bs58.encode(bytes), timestamp)) throw new Error('Could not claim this profile. Use its creator or mint-authority wallet; existing claims cannot be overwritten.');
            setMessage('Profile claimed. Choose your upgrade below.');
            onPurchase();
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Claim failed. Try again.'); }
        finally { setBusy(false); }
    };
    const purchase = async (tier: Tier) => {
        if (!wallet || busy || pending) return;
        setBusy(true); setMessage('Preparing your payment…');
        try {
            const encoded = await purchaseEnhancement(address, tier, wallet);
            if (!encoded) throw new Error('Could not prepare payment.');
            const transaction = Transaction.from(Buffer.from(encoded, 'base64'));
            const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
            const payment = { signature, tier, wallet };
            remember(payment);
            setMessage('Payment submitted. Waiting for final confirmation…');
            await recheck(payment);
        } catch (error) {
            const text = error instanceof Error ? error.message : 'Payment could not be completed.';
            setMessage(text === 'CLAIM_PROJECT_FIRST' ? 'Claim this profile with your project wallet before purchasing.' : text);
        } finally { setBusy(false); }
    };
    return <Modal isOpen onClose={() => { if (!busy) onClose(); }} title="Upgrade your token profile" size="lg">
        <p className="vortex-purchase-intro">Give traders a clear view of your project. One-time SOL payments, with no subscription.</p>
        <div className="vortex-purchase-context"><span>Token profile</span><code title={address}>{address.slice(0, 8)}…{address.slice(-8)}</code><span>{SOLANA_NETWORK}</span></div>
        {!connected ? <div className="vortex-empty"><p>Connect your project wallet to claim and upgrade this profile.</p><WalletMultiButton /></div> :
            <div className="vortex-claim-row"><div><strong>01 / Claim your profile</strong><p>Sign a message to prove wallet control. This step costs no SOL.</p></div><button className="btn-vortex btn-vortex-secondary" disabled={busy || !!pending} onClick={claim}>Claim profile</button></div>}
        <div className="vortex-purchase-grid">
            {(['Enhanced', 'Elite'] as Tier[]).map(tier => <section key={tier} className="vortex-plan">
                <span className="vortex-eyebrow">{tier === 'Enhanced' ? 'PROJECT IDENTITY' : 'PROJECT VISIBILITY'}</span>
                <h3>{tier === 'Enhanced' ? 'Enhanced profile' : 'Trending boost'}</h3>
                <p className="vortex-plan-price">{TIER_PRICES_SOL[tier]} <span>SOL</span></p>
                <ul>{(tier === 'Enhanced' ? ['Custom banner and logo', 'Website and social links', 'One-time profile upgrade'] : ['Priority discovery placement', 'Elite profile badge', 'Placement is paid promotion']).map(item => <li key={item}><Check size={16} aria-hidden />{item}</li>)}</ul>
                <button className="btn-vortex btn-vortex-primary" disabled={!connected || busy || !!pending} aria-busy={busy} onClick={() => purchase(tier)}>Pay {TIER_PRICES_SOL[tier]} SOL</button>
            </section>)}
        </div>
        <p className="vortex-text-muted">Network fees are additional and shown by your wallet. Paid placement is not a safety endorsement or a guarantee of views.</p>
        <p className="vortex-payment-destination">Recipient: <a href={'https://solscan.io/account/' + TREASURY_ENHANCEMENTS + (SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '')} target="_blank" rel="noreferrer">VORTEX treasury <ExternalLink size={12} aria-hidden /></a></p>
        {message && <p role="status" className="vortex-inline-notice">{message}</p>}
        {pending && <div className="vortex-payment-recovery">
            <strong>Payment saved — do not pay again</strong>
            <a href={'https://solscan.io/tx/' + pending.signature + (SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '')} target="_blank" rel="noreferrer">View transaction <ExternalLink size={14} aria-hidden /></a>
            <button className="btn-vortex btn-vortex-secondary" disabled={busy} onClick={async () => { setBusy(true); try { await recheck(pending); } finally { setBusy(false); } }}><RefreshCw size={16} aria-hidden /> Recheck payment</button>
        </div>}
        <p className="vortex-text-muted">Have an access code? <a href="/elite">Open Elite access</a>.</p>
    </Modal>;
}
