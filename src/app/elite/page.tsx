'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Check, ExternalLink, RefreshCw, Zap } from 'lucide-react';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { formatSol, usePayment, usePrices } from '@/hooks/usePayment';
import { formatUsd } from '@/lib/payments/pricing.mjs';
import { getRecentlyViewed, TokenInfo } from '@/lib/dataService';
import { useNotificationStore } from '@/lib/store';
import { VortexPanel } from '@/components/DesignSystem';
import { TokenAvatar } from '@/components/TokenAvatar';
import { MobileNav } from '@/components/MobileNav';
import { SOLANA_NETWORK } from '@/lib/constants';

const WalletMultiButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton, { ssr: false });

const BENEFITS = [
    ['5-second prices', 'Token prices refresh every 5 seconds instead of every 15.'],
    ['No VORTEX swap fee', 'The 0.0075 SOL fee is waived on every swap you make here.'],
    ['Linked-wallet research', 'See who first funded the creator and the top 10 wallets, and which of them share a funder.'],
];

export default function ElitePage() {
    const { publicKey, connected, isElite, eliteExpiresAt, refreshElite, signMessage } = useVortexAuth();
    const wallet = publicKey?.toBase58();
    const notify = useNotificationStore(state => state.notify);
    const prices = usePrices();
    const price = prices.data?.products?.EliteAccess;
    const payment = usePayment(wallet, (_, expiresAt) => {
        notify('success', expiresAt ? 'Elite is active until ' + new Date(expiresAt).toLocaleDateString() + '.' : 'Elite is active.');
        refreshElite();
    });
    const [recent, setRecent] = useState<TokenInfo[]>([]);
    const [code, setCode] = useState('');
    const [codeState, setCodeState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
    useEffect(() => { setRecent(getRecentlyViewed().slice(0, 6)); }, []);

    const redeem = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!code.trim() || !publicKey || !signMessage || codeState.busy) return;
        setCodeState({ busy: true, error: null });
        try {
            const timestamp = Date.now();
            const bytes = await signMessage(new TextEncoder().encode(`VORTEX_PROVISION_ACCESS:${publicKey.toBase58()}:${timestamp}`));
            const res = await fetch('/api/auth/provision', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: publicKey.toBase58(), code: code.trim(), signature: Buffer.from(bytes).toString('base64'), timestamp }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error === 'ACCESS_CODES_DISABLED' ? 'Access codes are not being accepted right now.' : 'That access code was not accepted.');
            }
            setCode('');
            setCodeState({ busy: false, error: null });
            notify('success', 'Access code accepted.');
            refreshElite();
        } catch (error) {
            setCodeState({ busy: false, error: error instanceof Error ? error.message : 'Could not redeem the code.' });
        }
    };

    const until = eliteExpiresAt ? new Date(eliteExpiresAt) : null;
    return <main id="main-content" className="vortex-workspace vortex-pulse-workspace">
        <div className="vortex-page-heading"><div>
            <span className="vortex-eyebrow"><Zap size={14} aria-hidden /> VORTEX ELITE</span>
            <h1>Trade with <em>more context.</em></h1>
            <p>Faster prices, no swap fee, and research into who really holds a token.</p>
        </div></div>
        <div className="vortex-purchase-grid vortex-elite-grid">
            <section className="vortex-plan">
                <span className="vortex-eyebrow">WHAT YOU GET</span>
                <h3>Elite</h3>
                <ul>{BENEFITS.map(([title, text]) => <li key={title}><Check size={16} aria-hidden /><span><strong>{title}.</strong> {text}</span></li>)}</ul>
                <p className="vortex-text-muted">The free holder scan stays free for everyone.</p>
            </section>
            <section className="vortex-plan" aria-live="polite">
                <span className="vortex-eyebrow">{isElite ? 'YOUR ACCESS' : '30 DAYS'}</span>
                <h3>{isElite ? 'Elite is active' : 'Get Elite'}</h3>
                <p className="vortex-plan-price">{price ? formatUsd(price.usdCents) : '…'} <span>per 30 days</span></p>
                <p className="vortex-text-muted">{isElite ? (until ? 'Active until ' + until.toLocaleDateString() + '. Renewing adds 30 days.' : 'No end date on this wallet.') : price?.lamports ? 'About ' + formatSol(price.lamports) + ' now, paid in SOL. No auto-renewal.' : 'Paid in SOL. No auto-renewal.'}</p>
                {!connected ? <WalletMultiButton /> :
                    (!isElite || until) && <button className="btn-vortex btn-vortex-primary" disabled={payment.busy || !!payment.pending || !price} aria-busy={payment.busy} onClick={() => payment.purchase('EliteAccess')}>{isElite ? 'Add 30 days' : 'Pay ' + (price ? formatUsd(price.usdCents) : '') + ' in SOL'}</button>}
                {payment.message && <p role="status" className="vortex-inline-notice">{payment.message}</p>}
                {payment.pending && <div className="vortex-payment-recovery">
                    <strong>Payment saved. Do not pay again.</strong>
                    <a href={'https://solscan.io/tx/' + payment.pending.signature + (SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '')} target="_blank" rel="noreferrer">View transaction <ExternalLink size={14} aria-hidden /></a>
                    <button className="btn-vortex btn-vortex-secondary" disabled={payment.busy} onClick={payment.recheckPending}><RefreshCw size={16} aria-hidden /> Recheck payment</button>
                </div>}
                {connected && !isElite && <details className="vortex-access-code">
                    <summary>Have an access code?</summary>
                    <form onSubmit={redeem} className="vortex-flex vortex-gap-2 vortex-mt-2">
                        <label htmlFor="elite-code" className="vortex-sr-only">Access code</label>
                        <input id="elite-code" className="vortex-input-tactical" type="password" autoComplete="off" spellCheck={false} placeholder="Access code" value={code}
                            onChange={e => { setCode(e.target.value); setCodeState({ busy: false, error: null }); }} aria-invalid={codeState.error ? true : undefined} aria-describedby={codeState.error ? 'elite-code-error' : undefined} disabled={codeState.busy} />
                        <button type="submit" className="btn-vortex btn-vortex-secondary" disabled={codeState.busy || !code.trim()} aria-busy={codeState.busy}>Redeem</button>
                    </form>
                    {codeState.error && <p id="elite-code-error" role="alert" className="vortex-inline-notice">{codeState.error}</p>}
                </details>}
            </section>
        </div>
        {isElite && <VortexPanel title="Research a token" subTitle="Open a token to run linked-wallet research" glowColor="none">
            {recent.length ? <ul className="vortex-featured-list">{recent.map(token => <li key={token.address}><Link href={'/token/' + token.address}><TokenAvatar symbol={token.symbol} src={token.logoURI} /><strong>{token.symbol}</strong><ArrowUpRight size={14} aria-hidden /></Link></li>)}</ul>
                : <p className="vortex-text-muted">Tokens you open will appear here. <Link href="/terminal">Browse markets</Link>.</p>}
        </VortexPanel>}
        <p className="vortex-disclosure">Research shows on-chain facts and patterns, not a safety rating. Elite does not change how tokens are ranked. By paying you agree to the <Link href="/terms">Terms</Link>.</p>
        <MobileNav />
    </main>;
}
