import { PriceOracle } from '../worker/parser';
import { solanaConnection } from '../config';

async function verifyAllOracles() {
    console.log('--- Multi-DEX Oracle Verification ---');
    
    await PriceOracle.refreshSolPrice();
    // @ts-ignore
    const price = PriceOracle.solPriceUsd;
    
    console.log(`Final Resolved Price: $${price.toFixed(2)}`);
    
    if (price && price > 0) {
        console.log('✅ Multi-DEX Price Discovery is Operational.');
    } else {
        throw new Error('All Oracle fetches failed.');
    }
}

verifyAllOracles().catch(err => {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
});
