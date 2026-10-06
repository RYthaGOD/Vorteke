import type { Metadata } from 'next';
import { LegalPage, supportUrl } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy | VORTEX', description: 'What VORTEX stores and why.' };

export default function PrivacyPage() {
    return <LegalPage title="Privacy" updated="6 October 2026">
        <p>VORTEX does not ask for your name, email or account details. Using the site does not require a wallet.</p>
        <h2>What we store</h2>
        <ul>
            <li><strong>Wallet addresses</strong> you use to claim a profile, pay or sign in to Elite, with the related transaction signatures. Blockchain data is public by nature.</li>
            <li><strong>Profile content</strong> a project adds: banner and logo links, social links and description.</li>
            <li><strong>Tokens viewed</strong>: the token address, so name, logo and creator can be looked up once and reused.</li>
            <li><strong>Server logs</strong>: IP address, browser type and error reports, kept by our host for security and rate limiting.</li>
        </ul>
        <h2>In your browser</h2>
        <p>Recently viewed tokens, pending payment references and your Elite sign-in are kept in your browser&apos;s local storage. Clearing site data removes them.</p>
        <h2>Third parties</h2>
        <p>Your browser connects directly to your wallet extension, to Helius for blockchain reads and to Jupiter for prices and swaps. Their privacy policies apply to those requests. We do not sell data or run advertising trackers.</p>
        <h2>Contact</h2>
        <p>{supportUrl ? <>Questions or removal requests: <a href={supportUrl} target="_blank" rel="noreferrer">{supportUrl}</a>.</> : 'Contact us through the links on the home page.'}</p>
    </LegalPage>;
}
