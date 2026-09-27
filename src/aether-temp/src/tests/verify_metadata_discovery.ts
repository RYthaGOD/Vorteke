import axios from 'axios';
import { config } from '../config';

async function verifyMetadata() {
    console.log('--- Sovereign Metadata (DAS) Verification ---');
    
    // Test Mint: JUP (Jupiter)
    const mint = 'JUPyiK9yUQCvHksmQGpxp99DqPLtcHkL9LNiY1tSY6t';
    
    console.log(`Fetching DAS metadata for test mint: ${mint}`);
    
    const response = await axios.post(`https://mainnet.helius-rpc.com/?api-key=${config.helius.apiKey}`, {
        jsonrpc: "2.0",
        id: "test",
        method: "getAsset",
        params: {
            id: mint,
            displayOptions: { showFungible: true }
        }
    });

    const metadata = response.data.result;
    if (metadata && metadata.content) {
        const symbol = metadata.content.metadata?.symbol;
        const name = metadata.content.metadata?.name;
        
        console.log(`Successfully resolved: ${name} (${symbol})`);
        
        if (symbol !== 'JUP') {
            throw new Error(`Symbol mismatch! Expected JUP, got ${symbol}`);
        }
    } else {
        throw new Error('No metadata found in DAS response.');
    }

    console.log('✅ Metadata Verification Passed.');
    process.exit(0);
}

verifyMetadata().catch(err => {
    console.error('❌ Metadata Verification Failed:', err);
    process.exit(1);
});
