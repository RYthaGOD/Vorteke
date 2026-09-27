'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TokenInfo } from '@/lib/dataService';

export function BoostedTicker() {
    const { data = [] } = useQuery<TokenInfo[]>({ queryKey: ['boosted-tokens'], queryFn: async () => {
        const res = await fetch('/api/discovery?type=verified');
        if (!res.ok) throw new Error('Unavailable');
        const data = await res.json();
        return Array.isArray(data) ? data.filter((token: TokenInfo) => token.tier === 'Elite').slice(0, 5) : [];
    }, staleTime: 60000 });
    if (!data.length) return null;
    return <aside className="vortex-promoted-strip" aria-label="Paid token promotions"><span>Promoted</span>{data.map(token => <Link key={token.address} href={'/token/' + token.address}>{token.symbol} ↗</Link>)}</aside>;
}
