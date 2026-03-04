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

    const handleCommand = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const cmd = input.toLowerCase().trim();
        let response = '';

        switch (cmd) {
            case 'help':
                response = 'Available commands: help, clear, status, net, scan, elite';
                break;
            case 'status':
                response = 'SYSTEM_OK | LATENCY [24ms] | UPTIME [1,442h]';
                break;
            case 'clear':
                setHistory([]);
                setInput('');
                return;
            case 'net':
                response = 'SOLANA_MAINNET_CONNECTED | AGGREGATOR_NODE_01_ACTIVE';
                break;
            case 'scan':
                response = 'Scanning global mempool... [OK] | Finding alpha... [4 tokens identified]';
                break;
            case 'elite':
                response = 'AUTHENTICATING... [DENIED] | Elite Pass NFT required for terminal access.';
                break;
            default:
                response = `Unknown command: ${cmd}`;
        }

        setHistory(prev => [...prev, `> ${input}`, response]);
        setInput('');
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
