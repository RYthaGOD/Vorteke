'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, RefreshCw } from 'lucide-react';
import { claimProject, fetchTokenEnhancement, Product } from '@/lib/monetizationService';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Modal } from './DesignSystem';
import { SOLANA_NETWORK, TREASURY_ENHANCEMENTS } from '@/lib/constants';
import { formatSol, usePayment, usePrices } from '@/hooks/usePayment';
import { formatUsd } from '@/lib/payments/pricing.mjs';
import bs58 from 'bs58';
import { trackEvent } from '@/lib/analytics';

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL || '';

const PLANS: { product: Extract<Product, 'Enhanced' | 'Boost'>; eyebrow: string; title: string; unit: string; features: string[] }[] = [
    { product: 'Enhanced', eyebrow: 'PROJECT IDENTITY', title: 'Enhanced profile', unit: 'one time', features: ['Custom banner and logo', 'Website and social links', 'Project description'] },
    { product: 'Boost', eyebrow: 'PROJECT VISIBILITY', title: 'Trending boost', unit: 'per 24 hours', features: ['Promoted tab, Featured panel and ticker', 'Renewals add 24 hours each', 'Always labelled as paid promotion'] },
];

export function EnhancementModal({ address, onClose, onPurchase, notify }: {
    address: string; onClose: () => void; onPurchase: () => void;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
    const { publicKey, connected } = useVortexAuth();
    const { signMessage } = useWallet();
    const [claiming, setClaiming] = useState(false);
    const prices = usePrices();
    const profile = useQuery({ queryKey: ['profile', address], queryFn: () => fetchTokenEnhancement(address), staleTime: 10_000 });
    const payment = usePayment(address, (product, expiresAt) => {
        notify('success', product === 'Boost' && expiresAt ? 'Boost active until ' + new Date(expiresAt).toLocaleString() + '.' : 'Your Enhanced profile is active. Add your banner and links from the token page.');
        void profile.refetch();
        onPurchase();
    });
    const wallet = publicKey?.toBase58();
    const owner = profile.data?.owner ?? null;
    const isOwner = !!wallet && owner === wallet;
    const busy = claiming || payment.busy;

    const claim = async () => {
        if (!wallet || !signMessage) return;
        setClaiming(true); payment.setMessage('');
        trackEvent('claim_started');
        try {
            const timestamp = Date.now();
            const bytes = await signMessage(new TextEncoder().encode('VORTEX_CLAIM::' + address + '::' + wallet + '::' + timestamp));
            if (!await claimProject(address, wallet, bs58.encode(bytes), timestamp)) throw new Error("This wallet couldn't be verified as the token's creator. Use the Pump.fun creator, mint authority or metadata authority wallet.");
            trackEvent('claim_done');
            payment.setMessage('Profile claimed. Choose an upgrade below.');
            await profile.refetch();
            onPurchase();
        } catch (error) { payment.setMessage(error instanceof Error ? error.message : 'Claim failed. Try again.'); }
        finally { setClaiming(false); }
    };

    const boostUntil = profile.data?.boosted && profile.data.boostExpiresAt ? new Date(profile.data.boostExpiresAt) : null;
    return <Modal isOpen onClose={() => { if (!busy) onClose(); }} title="Upgrade your token profile" size="lg">
        <p className="vortex-purchase-intro">Give traders a clear view of your project. Prices are in USD and paid in SOL at the current rate.</p>
        <div className="vortex-purchase-context"><span>Token profile</span><code title={address}>{address.slice(0, 8)}…{address.slice(-8)}</code><span>{SOLANA_NETWORK}</span></div>
        {!connected ? <div className="vortex-empty"><p>Connect your project wallet to claim and upgrade this profile.</p><WalletMultiButton /></div> :
            <div className="vortex-claim-row"><div><strong>01 / Claim your profile</strong>
                <p>{isOwner ? 'Claimed by your wallet.' : owner ? 'This profile is claimed by another wallet.' : "Sign a message from the token's creator wallet: the Pump.fun creator, mint authority or metadata authority. Claiming costs no SOL."}{!isOwner && !owner && SUPPORT_URL && <> Can&apos;t be verified? <a href={SUPPORT_URL} target="_blank" rel="noreferrer">Ask for a manual check</a>.</>}</p></div>
                {isOwner ? <span className="vortex-profile-label vortex-profile-paid"><Check size={14} aria-hidden /> Claimed</span>
                    : <button className="btn-vortex btn-vortex-secondary" disabled={busy || !!owner || !!payment.pending} onClick={claim}>Claim profile</button>}
            </div>}
        <div className="vortex-purchase-grid">
            {PLANS.map(plan => {
                const price = prices.data?.products?.[plan.product];
                const active = plan.product === 'Enhanced' ? profile.data?.tier === 'Enhanced' : !!boostUntil;
                const label = plan.product === 'Enhanced'
                    ? active ? 'Active' : 'Pay ' + (price ? formatUsd(price.usdCents) : '') + ' in SOL'
                    : active ? 'Add 24 hours' : 'Boost for 24 hours';
                return <section key={plan.product} className="vortex-plan">
                    <span className="vortex-eyebrow">{plan.eyebrow}</span>
                    <h3>{plan.title}</h3>
                    <p className="vortex-plan-price">{price ? formatUsd(price.usdCents) : '…'} <span>{plan.unit}</span></p>
                    <p className="vortex-text-muted">{price?.lamports ? 'About ' + formatSol(price.lamports) + ' now' : prices.isError ? 'SOL price unavailable' : ' '}</p>
                    <ul>{plan.features.map(item => <li key={item}><Check size={16} aria-hidden />{item}</li>)}</ul>
                    {plan.product === 'Boost' && boostUntil && <p className="vortex-text-muted">Active until {boostUntil.toLocaleString()}.</p>}
                    <button className="btn-vortex btn-vortex-primary" disabled={!isOwner || busy || !!payment.pending || (plan.product === 'Enhanced' && active)} aria-busy={payment.busy} onClick={() => payment.purchase(plan.product)}>{label}</button>
                </section>;
            })}
        </div>
        <p className="vortex-text-muted">The SOL amount is fixed when you start a payment. Network fees are extra and shown by your wallet. Paid placement is not a safety endorsement or a guarantee of views. By paying you agree to the <a href="/terms">Terms</a>.</p>
        <p className="vortex-payment-destination">Recipient: <a href={'https://solscan.io/account/' + TREASURY_ENHANCEMENTS + (SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '')} target="_blank" rel="noreferrer">VORTEX treasury <ExternalLink size={12} aria-hidden /></a></p>
        {payment.message && <p role="status" className="vortex-inline-notice">{payment.message}</p>}
        {payment.pending && <div className="vortex-payment-recovery">
            <strong>Payment saved. Do not pay again.</strong>
            <a href={'https://solscan.io/tx/' + payment.pending.signature + (SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '')} target="_blank" rel="noreferrer">View transaction <ExternalLink size={14} aria-hidden /></a>
            <button className="btn-vortex btn-vortex-secondary" disabled={busy} onClick={payment.recheckPending}><RefreshCw size={16} aria-hidden /> Recheck payment</button>
        </div>}
    </Modal>;
}
