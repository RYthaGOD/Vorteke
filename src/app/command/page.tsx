'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Shield, Zap, Globe, Cpu } from 'lucide-react';

export default function CommandPage() {
    const [history, setHistory] = useState<string[]>([
        'VORTEKE_OS [Version 1.0.42]',
        '(c) 2026 Vortex Protocol. All rights reserved.',
        '',
        'Initializing cryptic subsystem...',
        'Syncing neural links...',
        'READY.',
        'Type "help" for a list of available commands.'
    ]);
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const fullCmd = input.trim();
        const args = fullCmd.split(' ');
        const cmd = args[0].toLowerCase();
        let response = '';

        setHistory(prev => [...prev, `> ${fullCmd}`]);
        setInput('');

        switch (cmd) {
            case 'help':
                response = 'COMMANDS: help, clear, status, net, scan <addr>, elite <wallet>, quote <addr>';
                break;
            case 'status':
                response = 'SYSTEM_OK | LATENCY [22ms] | NODES [ACTIVE: 4] | VORTEX_STRATA [v1.0.42]';
                break;
            case 'clear':
                setHistory([]);
                return;
            case 'net':
                response = 'SOLANA_MAINNET_CONNECTED | RPC: HELIUS_PREMIUM | JITO_TURBO: ON';
                break;
            case 'scan':
                if (!args[1]) { response = 'USAGE: scan <token_address>'; break; }
                setHistory(prev => [...prev, '[...] INITIATING_DEEP_RECON_SCAN...']);
                try {
                    const res = await fetch(`/api/discovery?type=search&q=${args[1]}`);
                    const data = await res.json();
                    if (data && data[0]) {
                        const token = data[0];
                        response = `[MATCH] ${token.name} (${token.symbol})\n` +
                            `MCAP: $${(token.mcap / 1000000).toFixed(2)}M | LIQ: $${(token.liquidityUsd / 1000).toFixed(1)}K\n` +
                            `SECURITY: ${token.securityTags?.join(' | ') || 'ANALYZED'}\n` +
                            `THREAT_LEVEL: ${token.liquidityUsd < 10000 ? 'HIGH (LOW_LIQUIDITY)' : 'STABLE'}`;
                    } else {
                        response = 'SCAN_ERROR: TOKEN_NOT_FOUND_ON_CHAIN';
                    }
                } catch (err) { response = 'SCAN_CRITICAL_FAILURE: NODE_TIMEOUT'; }
                break;
            case 'elite':
                if (!args[1]) { response = 'USAGE: elite <wallet_address>'; break; }
                setHistory(prev => [...prev, '[...] VERIFYING_ELITE_CLEARANCE...']);
                try {
                    const res = await fetch(`/api/auth/elite-check?wallet=${args[1]}`);
                    const data = await res.json();
                    response = data.isElite ? 'ACCESS_GRANTED | USER_TIER: ELITE_TRADER' : 'ACCESS_DENIED | NO_ACCESS_NFT_DETECTED';
                } catch (err) { response = 'AUTH_SERVICE_UNAVAILABLE'; }
                break;
            case 'quote':
                if (!args[1]) { response = 'USAGE: quote <token_address>'; break; }
                setHistory(prev => [...prev, '[...] PULLING_LIVE_QUOTATION...']);
                try {
                    const res = await fetch(`/api/proxy/jup-price?ids=${args[1]}`);
                    const data = await res.json();
                    const price = data?.data?.[args[1]]?.price;
                    response = price ? `[LIVE] $${parseFloat(price).toFixed(8)} USD` : 'QUOTE_ERROR: SYMBOL_NOT_FETCHABLE';
                } catch (err) { response = 'AGGREGATOR_FETCH_FAILURE'; }
                break;
            default:
                response = `Unknown command: ${cmd}. Type "help" for options.`;
        }

        setHistory(prev => [...prev, response]);
    };

    return (
        <div className="vortex-page-container bg-vortex-obsidian font-mono">
            <div className="vortex-container vortex-pt-32">
                <div className="vortex-flex-center vortex-mb-8">
                    <div className="vortex-flex-start vortex-gap-2 text-vortex-cyan">
                        <Terminal size={24} />
                        <span className="vortex-h3 vortex-m-0">COMMAND_STRATA</span>
                    </div>
                </div>

                <div className="vortex-terminal-window vortex-bg-obsidian-2 vortex-border-cyan vortex-p-6 vortex-rounded-lg shadow-vortex-cyan min-h-[500px] vortex-flex-column">
                    <div className="vortex-terminal-content vortex-flex-1 vortex-overflow-y-auto vortex-mb-4 vortex-scrollbar-none">
                        {history.map((line, i) => (
                            <div key={i} className={`vortex-text-sm vortex-mb-1 ${line.startsWith('>') ? 'text-vortex-white' : 'text-vortex-cyan/80'}`}>
                                {line}
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    <form onSubmit={handleCommand} className="vortex-flex-start vortex-gap-2">
                        <span className="text-vortex-cyan">&gt;</span>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="vortex-terminal-input vortex-bg-transparent vortex-border-none vortex-text-white vortex-text-sm vortex-full-width focus:outline-none"
                            autoFocus
                        />
                    </form>
                </div>

                <div className="vortex-grid-3 vortex-gap-4 vortex-mt-8">
                    <div className="vortex-glass-card vortex-p-4 vortex-flex-column vortex-gap-2">
                        <div className="vortex-flex-start vortex-gap-2 text-vortex-yellow">
                            <Shield size={16} />
                            <span className="vortex-text-tiny vortex-text-bold">SECURE_PIPE</span>
                        </div>
                        <p className="vortex-text-xs vortex-text-muted vortex-m-0">End-to-end encrypted terminal session.</p>
                    </div>
                    <div className="vortex-glass-card vortex-p-4 vortex-flex-column vortex-gap-2">
                        <div className="vortex-flex-start vortex-gap-2 text-vortex-cyan">
                            <Cpu size={16} />
                            <span className="vortex-text-tiny vortex-text-bold">NEURAL_SYNC</span>
                        </div>
                        <p className="vortex-text-xs vortex-text-muted vortex-m-0">Direct RPC injection enabled.</p>
                    </div>
                    <div className="vortex-glass-card vortex-p-4 vortex-flex-column vortex-gap-2">
                        <div className="vortex-flex-start vortex-gap-2 text-vortex-purple">
                            <Globe size={16} />
                            <span className="vortex-text-tiny vortex-text-bold">GRID_ACCESS</span>
                        </div>
                        <p className="vortex-text-xs vortex-text-muted vortex-m-0">Multi-cluster monitoring active.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
