'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { VortexPanel } from '@/components/DesignSystem';

const WalletMultiButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton, { ssr: false });

interface Overview {
    payments: { signature: string; at: string; product: string; wallet: string; address: string; lamports: number; usdCents: number | null }[];
    totals: { product: string; count: number; lamports: number; usdCents: number }[];
    profiles: { address: string; tier: string; owner: string | null; boostExpiresAt: string | null; hasMedia: boolean; lastPaymentTime: string | null }[];
    elite: { wallet: string; expiresAt: string; source: string }[];
    funnel: Record<string, number>;
}

const short = (key: string) => key.slice(0, 4) + '…' + key.slice(-4);
const link = (key: string, kind: 'account' | 'tx' = 'account') => <a href={`https://solscan.io/${kind}/${key}`} target="_blank" rel="noreferrer">{short(key)}</a>;
const usd = (cents: number | null) => cents == null ? '—' : '$' + (cents / 100).toFixed(2);
const TOKEN_KEY = 'vortex-admin-session';

export default function AdminPage() {
    const { publicKey, signMessage } = useWallet();
    const wallet = publicKey?.toBase58();
    const admin = process.env.NEXT_PUBLIC_ADMIN_PUBKEY;
    const [token, setToken] = useState<string | null>(null);
    const [data, setData] = useState<Overview | null>(null);
    const [message, setMessage] = useState('');
    const [form, setForm] = useState({ eliteWallet: '', eliteDays: '30', address: '', owner: '' });

    useEffect(() => { try { setToken(sessionStorage.getItem(TOKEN_KEY)); } catch { /* storage unavailable */ } }, []);

    const load = useCallback(async (session: string) => {
        const res = await fetch('/api/admin/overview', { headers: { Authorization: 'Bearer ' + session } });
        if (res.status === 401) { setToken(null); try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } return; }
        if (res.ok) setData(await res.json()); else setMessage('Could not load the overview.');
    }, []);
    useEffect(() => { if (token) void load(token); }, [token, load]);

    const signIn = async () => {
        if (!wallet || !signMessage) return;
        try {
            const timestamp = Date.now();
            const signature = bs58.encode(await signMessage(new TextEncoder().encode(`VORTEX_ADMIN:${wallet}:${timestamp}`)));
            const res = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet, signature, timestamp }) });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error);
            try { sessionStorage.setItem(TOKEN_KEY, body.token); } catch { /* ignore */ }
            setToken(body.token);
        } catch (error) { setMessage('Sign-in failed: ' + (error instanceof Error ? error.message : 'unknown error')); }
    };

    const act = async (payload: Record<string, unknown>, confirmText?: string) => {
        if (!token || (confirmText && !window.confirm(confirmText))) return;
        const res = await fetch('/api/admin/action', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
        const body = await res.json().catch(() => ({}));
        setMessage(res.ok ? 'Done: ' + payload.action : 'Failed: ' + (body.error || res.status));
        void load(token);
    };

    return <main id="main-content" className="vortex-workspace vortex-pulse-workspace">
        <div className="vortex-page-heading"><div><span className="vortex-eyebrow">VORTEX / ADMIN</span><h1>Operations</h1><p>Payments, profiles and Elite access.</p></div></div>
        {!wallet ? <WalletMultiButton /> : wallet !== admin ? <p className="vortex-inline-notice">This wallet is not the admin wallet.</p>
            : !token ? <button className="btn-vortex btn-vortex-primary" onClick={signIn}>Sign in with the admin wallet</button>
                : !data ? <p role="status">Loading…</p> : <div className="vortex-flex-column vortex-gap-4">
                    {message && <p role="status" className="vortex-inline-notice">{message}</p>}
                    <VortexPanel title="Project funnel" subTitle="Last 14 days" glowColor="none">
                        <table className="vortex-data-table vortex-table-compact"><thead><tr>{['Token views', 'Claims started', 'Claims done', 'Payments started', 'Paid'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
                            <tbody><tr>{['token_view', 'claim_started', 'claim_done', 'payment_started', 'paid'].map(k => <td key={k}>{data.funnel[k] ?? 0}</td>)}</tr></tbody></table>
                    </VortexPanel>
                    <VortexPanel title="Revenue" subTitle="Verified payments, all time" glowColor="none">
                        <table className="vortex-data-table vortex-table-compact"><thead><tr><th scope="col">Product</th><th scope="col">Payments</th><th scope="col">SOL</th><th scope="col">USD at sale</th></tr></thead>
                            <tbody>{data.totals.length ? data.totals.map(t => <tr key={t.product}><td>{t.product}</td><td>{t.count}</td><td>{(t.lamports / 1e9).toFixed(4)}</td><td>{usd(t.usdCents)}</td></tr>) : <tr><td colSpan={4}>No payments yet.</td></tr>}</tbody></table>
                    </VortexPanel>
                    <VortexPanel title="Recent payments" subTitle="Last 50" glowColor="none">
                        <div className="vortex-data-table-container" tabIndex={0} role="region" aria-label="Recent payments"><table className="vortex-data-table vortex-table-compact"><thead><tr><th scope="col">When</th><th scope="col">Product</th><th scope="col">Wallet</th><th scope="col">Token or wallet</th><th scope="col">Amount</th><th scope="col">Transaction</th></tr></thead>
                            <tbody>{data.payments.map(p => <tr key={p.signature}><td>{new Date(p.at).toLocaleString()}</td><td>{p.product}</td><td>{link(p.wallet)}</td><td>{link(p.address)}</td><td>{(p.lamports / 1e9).toFixed(4)} SOL · {usd(p.usdCents)}</td><td>{link(p.signature, 'tx')}</td></tr>)}</tbody></table></div>
                    </VortexPanel>
                    <VortexPanel title="Profiles" subTitle="Claimed, paid or boosted" glowColor="none">
                        <div className="vortex-data-table-container" tabIndex={0} role="region" aria-label="Profiles"><table className="vortex-data-table vortex-table-compact"><thead><tr><th scope="col">Token</th><th scope="col">Tier</th><th scope="col">Owner</th><th scope="col">Boost until</th><th scope="col">Actions</th></tr></thead>
                            <tbody>{data.profiles.map(p => <tr key={p.address}><td><a href={'/token/' + p.address}>{short(p.address)}</a></td><td>{p.tier}</td><td>{p.owner ? link(p.owner) : '—'}</td><td>{p.boostExpiresAt && new Date(p.boostExpiresAt) > new Date() ? new Date(p.boostExpiresAt).toLocaleString() : '—'}</td>
                                <td className="vortex-flex vortex-gap-2">
                                    {p.hasMedia && <button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'clear-media', address: p.address }, 'Remove this profile\'s banner, logo, links and description?')}>Clear media</button>}
                                    {p.owner && <button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'revoke-claim', address: p.address }, 'Remove the owner of this profile?')}>Revoke claim</button>}
                                    <button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'boost', address: p.address, hours: 24 })}>+24h boost</button>
                                    {p.boostExpiresAt && <button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'boost', address: p.address, hours: -1 }, 'End this boost now?')}>End boost</button>}
                                </td></tr>)}</tbody></table></div>
                    </VortexPanel>
                    <VortexPanel title="Manual claim or tier" subTitle="For tokens the automatic checks can't verify" glowColor="none">
                        <div className="vortex-flex vortex-gap-2 vortex-wrap">
                            <label className="vortex-sr-only" htmlFor="admin-address">Token mint</label>
                            <input id="admin-address" className="vortex-input-tactical" placeholder="Token mint" value={form.address} onChange={e => setForm({ ...form, address: e.target.value.trim() })} />
                            <label className="vortex-sr-only" htmlFor="admin-owner">Owner wallet</label>
                            <input id="admin-owner" className="vortex-input-tactical" placeholder="Owner wallet" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value.trim() })} />
                            <button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'set-owner', address: form.address, wallet: form.owner }, 'Assign this owner? Check their proof of control first.')}>Set owner</button>
                            <button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'set-tier', address: form.address, tier: 'Enhanced' }, 'Grant Enhanced without payment?')}>Grant Enhanced</button>
                        </div>
                    </VortexPanel>
                    <VortexPanel title="Elite access" subTitle="Active wallets" glowColor="none">
                        <div className="vortex-flex vortex-gap-2 vortex-wrap vortex-mb-4">
                            <label className="vortex-sr-only" htmlFor="admin-elite-wallet">Wallet</label>
                            <input id="admin-elite-wallet" className="vortex-input-tactical" placeholder="Wallet" value={form.eliteWallet} onChange={e => setForm({ ...form, eliteWallet: e.target.value.trim() })} />
                            <label className="vortex-sr-only" htmlFor="admin-elite-days">Days</label>
                            <input id="admin-elite-days" className="vortex-input-tactical" inputMode="numeric" placeholder="Days" value={form.eliteDays} onChange={e => setForm({ ...form, eliteDays: e.target.value })} />
                            <button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'grant-elite', wallet: form.eliteWallet, days: Number(form.eliteDays) })}>Grant days</button>
                        </div>
                        <table className="vortex-data-table vortex-table-compact"><thead><tr><th scope="col">Wallet</th><th scope="col">Until</th><th scope="col">Source</th><th scope="col">Actions</th></tr></thead>
                            <tbody>{data.elite.map(e => <tr key={e.wallet}><td>{link(e.wallet)}</td><td>{new Date(e.expiresAt).toLocaleDateString()}</td><td>{e.source}</td><td><button className="btn-vortex btn-vortex-secondary" onClick={() => act({ action: 'revoke-elite', wallet: e.wallet }, 'Revoke Elite for this wallet?')}>Revoke</button></td></tr>)}</tbody></table>
                    </VortexPanel>
                </div>}
    </main>;
}
