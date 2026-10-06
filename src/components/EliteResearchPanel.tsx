'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Loader2, Lock } from 'lucide-react';
import { VortexPanel } from './DesignSystem';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useEliteSession } from '@/hooks/useEliteSession';

type Funding = { status: 'found'; funder: string; signature: string } | { status: 'established' | 'empty' | 'unknown' };
interface Research {
    scannedAt: string;
    creator: string | null;
    creatorFunding: Funding | null;
    holders: { owner: string; percent: number; isCreator: boolean; funding: Funding }[];
    linked: { funder: string; fundedByCreator: boolean; wallets: string[]; percent: number }[];
    linkedPercent: number;
}

const short = (key: string) => key.slice(0, 4) + '…' + key.slice(-4);
const account = (key: string) => <a href={'https://solscan.io/account/' + key} target="_blank" rel="noreferrer">{short(key)} <ExternalLink size={11} aria-hidden /></a>;
const describe = (f: Funding | null) => !f ? '—'
    : f.status === 'found' ? <>Funded by {account(f.funder)}</>
        : f.status === 'established' ? '1,000+ transactions, not traced'
            : f.status === 'empty' ? 'No history' : 'Funder not found';

export function EliteResearchPanel({ address }: { address: string }) {
    const { isElite, connected } = useVortexAuth();
    const { getToken, clear } = useEliteSession();
    const [state, setState] = useState<{ loading: boolean; error: string | null; data: Research | null }>({ loading: false, error: null, data: null });

    const run = async () => {
        setState({ loading: true, error: null, data: null });
        try {
            let token = await getToken();
            let response = await fetch('/api/elite/research/' + encodeURIComponent(address), { headers: { Authorization: 'Bearer ' + token } });
            if (response.status === 401) { clear(); token = await getToken(); response = await fetch('/api/elite/research/' + encodeURIComponent(address), { headers: { Authorization: 'Bearer ' + token } }); }
            if (!response.ok) throw new Error(response.status === 401 ? 'This wallet has no active Elite access.' : 'Research is unavailable right now. Try again shortly.');
            setState({ loading: false, error: null, data: await response.json() });
        } catch (error) {
            setState({ loading: false, error: error instanceof Error ? error.message : 'Research failed.', data: null });
        }
    };

    if (!isElite) return <VortexPanel title="Linked wallets" subTitle="Elite research" glowColor="none">
        <div className="vortex-empty"><Lock size={20} aria-hidden /><p>See who funded the creator and the top 10 wallets, and which of them share a funder.</p>
            <Link className="btn-vortex btn-vortex-secondary" href="/elite">{connected ? 'Get Elite' : 'Learn about Elite'}</Link></div>
    </VortexPanel>;

    const data = state.data;
    return <VortexPanel title="Linked wallets" subTitle="Elite research" glowColor="none">
        {!data ? <div className="vortex-flex-column vortex-gap-2">
            <p className="vortex-text-muted">Traces the first funder of the creator and each of the top 10 wallets. Takes up to a minute.</p>
            <button className="btn-vortex btn-vortex-primary" onClick={run} disabled={state.loading} aria-busy={state.loading}>{state.loading ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Tracing wallets…</> : 'Run research'}</button>
            {state.error && <p role="alert" className="vortex-inline-notice">{state.error}</p>}
        </div> : <div className="vortex-flex-column vortex-gap-4">
            <dl className="vortex-check-list">
                <div><dt>Creator</dt><dd>{data.creator ? account(data.creator) : 'Not found on chain'}</dd></div>
                {data.creator && <div><dt>Creator funding</dt><dd>{describe(data.creatorFunding)}</dd></div>}
                <div><dt>Wallets sharing a funder</dt><dd>{data.linked.length ? data.linkedPercent.toFixed(2) + '% of supply' : 'None found'}</dd></div>
            </dl>
            {data.linked.map(group => <div key={group.funder} className="vortex-inline-notice">
                <strong>{group.wallets.length} wallet{group.wallets.length > 1 ? 's' : ''} · {group.percent.toFixed(2)}%</strong>{' '}
                {group.fundedByCreator ? 'funded by the creator' : <>share the funder {account(group.funder)}</>}: {group.wallets.map((w, i) => <span key={w}>{i ? ', ' : ''}{account(w)}</span>)}
            </div>)}
            <div className="vortex-data-table-container" tabIndex={0} role="region" aria-label="Top wallet funding">
                <table className="vortex-data-table vortex-table-compact">
                    <thead><tr><th scope="col">Wallet</th><th scope="col">Share</th><th scope="col">First funded by</th></tr></thead>
                    <tbody>{data.holders.map(h => <tr key={h.owner}><td>{account(h.owner)}{h.isCreator ? ' · creator' : ''}</td><td>{h.percent.toFixed(2)}%</td><td>{describe(h.funding)}</td></tr>)}</tbody>
                </table>
            </div>
            <p className="vortex-disclosure">Traced {new Date(data.scannedAt).toLocaleTimeString()}. A shared funder can be an exchange or a service; check it before drawing conclusions.</p>
        </div>}
    </VortexPanel>;
}
