import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, supportUrl } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms of use | VORTEX', description: 'The terms for using VORTEX and buying profile upgrades, boosts and Elite access.' };

export default function TermsPage() {
    return <LegalPage title="Terms of use" updated="6 October 2026">
        <p>VORTEX is a Solana market screener. By using the site you agree to these terms. If you do not agree, do not use VORTEX.</p>
        <h2>Information only</h2>
        <p>Prices, charts, holder scans, research and labels come from public blockchain data and third-party providers. They can be delayed, incomplete or wrong. Nothing on VORTEX is financial, investment or legal advice, and no label is a safety rating. Read the <Link href="/risk">risk notice</Link>.</p>
        <h2>Your wallet and your trades</h2>
        <ul>
            <li>VORTEX never holds your funds or keys. Every transaction is built for you to review and sign in your own wallet.</li>
            <li>Swaps are routed through Jupiter. A flat VORTEX fee of 0.0075 SOL is added to each swap and shown before you sign, unless you hold Elite. Network fees and any Turbo tip are extra.</li>
            <li>Confirmed blockchain transactions cannot be reversed by VORTEX.</li>
        </ul>
        <h2>Paid products</h2>
        <ul>
            <li><strong>Enhanced profile</strong> ($29, one time): lets the verified project wallet show a banner, logo, links and description on its token page.</li>
            <li><strong>Trending boost</strong> ($5 per 24 hours): places the token in the labelled Promoted tab, Featured panel and ticker. It does not change organic rankings and does not guarantee views.</li>
            <li><strong>Elite access</strong> ($29 per 30 days): faster price updates, no VORTEX swap fee and linked-wallet research for the paying wallet. It does not renew automatically.</li>
        </ul>
        <p>Prices are set in US dollars and charged in SOL at the rate shown when you start the payment. Paid placement and profiles are promotion, not endorsement.</p>
        <h2>Refunds</h2>
        <p>Payments are final once the product is applied. If a payment was taken but the product was not applied, contact us with the transaction link and we will apply it or refund the SOL to the paying wallet.</p>
        <h2>Project profiles</h2>
        <p>Only a wallet that controls a token on chain (its Pump.fun creator, mint authority or metadata authority) can claim its profile. We may remove images, links or text that are misleading, infringing, harmful or illegal, and may revoke a claim made in error, without refund where the content broke these terms.</p>
        <h2>Acceptable use</h2>
        <p>Do not attack, overload or scrape the service, bypass its limits, or use it to mislead other people. We may block access that does.</p>
        <h2>Changes and liability</h2>
        <p>The service is provided as is. To the extent the law allows, VORTEX is not liable for trading losses, provider outages or data errors. We may change these terms; the date above shows the latest version.</p>
        <h2>Contact</h2>
        <p>{supportUrl ? <>Reach us at <a href={supportUrl} target="_blank" rel="noreferrer">{supportUrl}</a>.</> : 'Contact us through the links on the home page.'}</p>
    </LegalPage>;
}
