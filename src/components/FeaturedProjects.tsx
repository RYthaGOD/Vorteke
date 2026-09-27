'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { VortexPanel } from './DesignSystem';
import type { TokenInfo } from '@/lib/dataService';

export function FeaturedProjects() {
    const query = useQuery<TokenInfo[]>({ queryKey: ['promoted-projects'], queryFn: async () => {
        const response = await fetch('/api/discovery?type=verified');
        if (!response.ok) throw new Error('Profiles unavailable');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid profiles response');
        return data.filter((token: TokenInfo) => token.tier && token.tier !== 'Basic').slice(0, 5);
    }, staleTime: 60000 });
    return <VortexPanel title="Featured projects" subTitle="Paid profiles" glowColor="none">
        {query.isLoading ? <p role="status">Loading project profiles…</p> : query.isError ? <div className="vortex-empty"><p>Could not load profiles.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => query.refetch()}>Retry</button></div> : !query.data?.length ? <p className="vortex-text-muted">No featured projects yet. Open your token page to add your profile.</p> :
            <ul className="vortex-featured-list">{query.data.map(token => <li key={token.address}><Link href={'/token/' + token.address}><strong>{token.symbol}</strong><span>{token.tier} · Promoted ↗</span></Link></li>)}</ul>}
        <p className="vortex-disclosure">Paid placement is not a safety endorsement.</p>
    </VortexPanel>;
}
