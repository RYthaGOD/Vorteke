import Link from 'next/link';

/** Shared layout for the Terms, Privacy and Risk pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
    return <main id="main-content" className="vortex-workspace vortex-legal">
        <div className="vortex-page-heading"><div><span className="vortex-eyebrow">VORTEX / LEGAL</span><h1>{title}</h1><p>Last updated {updated}.</p></div></div>
        <article className="vortex-legal-body">{children}</article>
        <nav className="vortex-legal-nav" aria-label="Legal pages"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/risk">Risk notice</Link><Link href="/">Home</Link></nav>
    </main>;
}

export const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || '';
