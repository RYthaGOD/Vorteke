import Link from 'next/link';
import { ArrowUpRight, Radar, ChartNoAxesCombined, Layers, Check } from 'lucide-react';
import { PRODUCTS, formatUsd } from '@/lib/payments/pricing.mjs';

export default function LandingPage() {
    return <main id="main-content" className="vortex-home">
        <section className="vortex-home-hero">
            <div className="vortex-hero-copy">
                <span className="vortex-eyebrow"><span className="vortex-status-dot" /> THE SOLANA MARKET TERMINAL</span>
                <h1>Less noise.<br /><em>More signal.</em></h1>
                <p>Find your next token. Read the market. See the details that matter — all in one focused workspace.</p>
                <div className="vortex-hero-actions"><Link href="/terminal" className="btn-vortex btn-vortex-primary">Explore markets <ArrowUpRight size={18} aria-hidden /></Link><Link href="#projects" className="vortex-text-link">Building a project? ↗</Link></div>
                <div className="vortex-hero-note"><span>No wallet needed to explore</span><span>Built for Solana</span></div>
            </div>
            <div className="vortex-signal-art" aria-label="Illustration of the VORTEX market workspace">
                <div className="vortex-art-header"><span>V / MARKET VIEW</span><span>01 — DISCOVER</span></div>
                <div className="vortex-orbit"><span className="vortex-orbit-label">SOLANA</span><div className="vortex-orbit-ring" /><div className="vortex-orbit-ring inner" /><strong>V</strong></div>
                <div className="vortex-art-caption"><span>Follow the market.<br /><strong>Keep your perspective.</strong></span><Layers size={28} aria-hidden /></div>
                <div className="vortex-art-footer"><span>PRICE · VOLUME · LIQUIDITY</span><ArrowUpRight size={20} aria-hidden /></div>
            </div>
        </section>
        <section className="vortex-value-strip" aria-label="Product features"><span><Radar aria-hidden /> Discover emerging pairs</span><span><ChartNoAxesCombined aria-hidden /> Read price and liquidity</span><span><Layers aria-hidden /> Explore on-chain signals</span></section>
        <section className="vortex-home-section">
            <div className="vortex-section-heading"><span className="vortex-eyebrow">YOUR WORKSPACE / 01</span><h2>A clearer view of<br />a market that never stops.</h2><p>Move from discovery to a token’s details without losing context.</p></div>
            <div className="vortex-feature-rows">{[
                ['01', 'Discover', 'Browse trending tokens and new pools. Search by name or mint address.', '/terminal'],
                ['02', 'Investigate', 'Compare trading activity, liquidity, holder concentration, and token information.', '/terminal'],
                ['03', 'Follow', 'Connect your wallet to view holdings alongside the market. Revisit tokens you have explored.', '/terminal?tab=portfolio'],
            ].map(([n, title, description, href]) => <Link key={n} href={href}><span>{n}</span><div><h3>{title}</h3><p>{description}</p></div><ArrowUpRight aria-hidden /></Link>)}</div>
        </section>
        <section id="projects" className="vortex-home-section vortex-project-section">
            <div className="vortex-section-heading"><span className="vortex-eyebrow">FOR PROJECT TEAMS / 02</span><h2>Your token.<br />A better first impression.</h2><p>Claim your profile, add your project identity, and help traders find the right links. Priced in USD, paid in SOL.</p><Link className="vortex-text-link" href="/terminal?focusSearch=true">Find your token to get started ↗</Link></div>
            <div className="vortex-purchase-grid">{[
                ['Enhanced profile', formatUsd(PRODUCTS.Enhanced.usdCents), 'one time', ['Custom banner and logo', 'Website and social links', 'Project description']],
                ['Trending boost', formatUsd(PRODUCTS.Boost.usdCents), 'per 24 hours', ['Promoted tab, Featured panel and ticker', 'Renew any time to add 24 hours', 'Clearly labelled as paid']],
            ].map(([name, price, unit, features]) => <section className="vortex-plan" key={String(name)}><span className="vortex-eyebrow">PROJECT UPGRADE</span><h3>{name}</h3><p className="vortex-plan-price">{price} <span>{unit}</span></p><ul>{(features as string[]).map(item => <li key={item}><Check size={16} aria-hidden />{item}</li>)}</ul><Link className="btn-vortex btn-vortex-secondary" href="/terminal?focusSearch=true">Find your project <ArrowUpRight size={16} aria-hidden /></Link></section>)}</div>
            <p className="vortex-project-note">Network fees are additional. Paid profiles and placement do not certify token safety or guarantee traffic. The VORTEX token has not launched.</p>
        </section>
        <footer className="vortex-site-footer"><Link href="/" className="vortex-wordmark">VORTEX</Link><span>Solana markets, in focus.</span><Link href="/terminal">Explore the terminal ↗</Link><nav className="vortex-legal-nav" aria-label="Legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/risk">Risk notice</Link></nav></footer>
    </main>;
}
