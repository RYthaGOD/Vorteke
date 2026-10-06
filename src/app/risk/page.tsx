import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Risk notice | VORTEX', description: 'The risks of trading Solana tokens and how to read VORTEX signals.' };

export default function RiskPage() {
    return <LegalPage title="Risk notice" updated="6 October 2026">
        <p>Most new Solana tokens lose most or all of their value. Only trade what you can afford to lose.</p>
        <h2>Reading VORTEX signals</h2>
        <ul>
            <li>A holder scan shows who holds the largest balances right now. Low concentration does not make a token safe, and high concentration does not prove a scam.</li>
            <li>Linked-wallet research traces who first funded each wallet. A shared funder can be an exchange or a service, not a single person.</li>
            <li>Mint and freeze authority are read directly from the chain. A revoked authority removes some risks, not all of them.</li>
            <li>Enhanced profiles and boosts are paid by the project. They are labelled as paid and are not an endorsement.</li>
        </ul>
        <h2>Trading risks</h2>
        <ul>
            <li>Prices can move sharply between your quote and your transaction. Slippage settings limit, but do not remove, that risk.</li>
            <li>Low liquidity can make a token hard or impossible to sell at the shown price.</li>
            <li>Tokens can carry transfer fees, freeze authorities or other controls held by their creators.</li>
            <li>Blockchain transactions are final. A wrong address or a malicious token cannot be undone.</li>
        </ul>
        <p>Nothing on VORTEX is financial advice. Do your own research.</p>
    </LegalPage>;
}
