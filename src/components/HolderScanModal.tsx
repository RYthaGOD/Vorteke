'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from './DesignSystem';

export interface HolderScan {
    scannedAt: string;
    program: string;
    mintAuthority: string | null;
    freezeAuthority: string | null;
    transferFeeBps: number;
    creator: string | null;
    creatorSource: string | null;
    top10WalletPercent: number;
    programPercent: number;
    burnedPercent: number;
    creatorPercent: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    holders: { owner: string; percent: number; kind: 'wallet' | 'program' | 'burn'; isCreator: boolean }[];
}

export const fetchHolderScan = async (address: string, signal?: AbortSignal): Promise<HolderScan> => {
    const response = await fetch('/api/scan/' + encodeURIComponent(address), { signal });
    if (!response.ok) throw new Error('Scan unavailable');
    return response.json();
};

const short = (key: string) => key.slice(0, 4) + '…' + key.slice(-4);
const pct = (n: number) => n.toFixed(2) + '%';
const KIND = { wallet: 'Wallet', program: 'Pool or program', burn: 'Burned' } as const;
const CREATOR_SOURCE: Record<string, string> = {
    'pump-creator': 'Pump.fun creator',
    'mint-authority': 'mint authority',
    'token-metadata-authority': 'metadata authority',
    'metadata-update-authority': 'metadata authority',
};

export function HolderScanModal({ isOpen, onClose, tokenSymbol, tokenAddress }: { isOpen: boolean; onClose: () => void; tokenSymbol: string; tokenAddress: string }) {
    const scan = useQuery({
        queryKey: ['holder-scan', tokenAddress],
        queryFn: ({ signal }) => fetchHolderScan(tokenAddress, signal),
        enabled: isOpen, staleTime: 60_000, retry: 1,
    });
    const data = scan.data;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={'Holder scan · ' + tokenSymbol} size="md">
            {scan.isLoading ? <div className="vortex-empty" role="status"><Loader2 size={24} className="animate-spin" aria-hidden /><p>Reading holders from the chain…</p></div>
                : scan.isError || !data ? <div className="vortex-empty" role="alert"><ShieldAlert size={24} aria-hidden /><h2>Scan unavailable</h2><p>The RPC provider did not answer. Try again in a moment.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => scan.refetch()}>Try again</button></div>
                    : <div className="vortex-flex-column vortex-gap-4">
                        <dl className="vortex-check-list vortex-scan-summary">
                            <div><dt>Top 10 wallets hold</dt><dd>{pct(data.top10WalletPercent)}{data.riskLevel !== 'LOW' ? ' · ' + (data.riskLevel === 'HIGH' ? 'very concentrated' : 'concentrated') : ''}</dd></div>
                            <div><dt>In pools and curves</dt><dd>{pct(data.programPercent)}</dd></div>
                            {data.burnedPercent > 0 && <div><dt>Burned</dt><dd>{pct(data.burnedPercent)}</dd></div>}
                            <div><dt>Creator</dt><dd>{data.creator ? <a href={'https://solscan.io/account/' + data.creator} target="_blank" rel="noreferrer">{short(data.creator)}</a> : 'Not found on chain'}{data.creatorSource ? ' · ' + (CREATOR_SOURCE[data.creatorSource] || data.creatorSource) : ''}</dd></div>
                            {data.creator && <div><dt>Creator holds</dt><dd>{data.creatorPercent > 0 ? pct(data.creatorPercent) : 'Not among the top 20 holders'}</dd></div>}
                            <div><dt>Mint authority</dt><dd>{data.mintAuthority ? 'Active · ' + short(data.mintAuthority) : 'Revoked'}</dd></div>
                            <div><dt>Freeze authority</dt><dd>{data.freezeAuthority ? 'Active · ' + short(data.freezeAuthority) : 'Revoked'}</dd></div>
                            <div><dt>Transfer fee</dt><dd>{data.transferFeeBps > 0 ? (data.transferFeeBps / 100).toFixed(2) + '%' : 'None'}</dd></div>
                            <div><dt>Token program</dt><dd>{data.program}</dd></div>
                        </dl>
                        <div className="vortex-data-table-container" tabIndex={0} role="region" aria-label="Largest holders">
                            <table className="vortex-data-table vortex-table-compact">
                                <thead><tr><th scope="col">#</th><th scope="col">Holder</th><th scope="col">Type</th><th scope="col">Share</th></tr></thead>
                                <tbody>{data.holders.map((h, i) => <tr key={h.owner}>
                                    <td>{i + 1}</td>
                                    <td><a href={'https://solscan.io/account/' + h.owner} target="_blank" rel="noreferrer">{short(h.owner)} <ExternalLink size={12} aria-hidden /></a>{h.isCreator ? ' · creator' : ''}</td>
                                    <td>{KIND[h.kind]}</td>
                                    <td>{pct(h.percent)}</td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                        <p className="vortex-disclosure">Read from chain at {new Date(data.scannedAt).toLocaleTimeString()}. Concentration is a signal, not a safety rating. <Link href="/elite">Elite</Link> adds linked-wallet clusters and funding sources.</p>
                    </div>}
        </Modal>
    );
}
