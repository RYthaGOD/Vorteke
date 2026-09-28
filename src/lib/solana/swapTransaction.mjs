import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

/**
 * Keep the swap and the disclosed platform fee in one atomic transaction.
 * Nothing is signed or submitted here.
 * @param {import('@solana/web3.js').VersionedTransaction} transaction
 * @param {import('@solana/web3.js').PublicKey} payer
 * @param {import('@solana/web3.js').AddressLookupTableAccount[]} lookupTables
 * @param {{ treasury: string, feeLamports: number, tip?: { address: string, lamports: number } }} options
 */
export function prepareSwapTransaction(transaction, payer, lookupTables, options) {
    const message = TransactionMessage.decompile(transaction.message, { addressLookupTableAccounts: lookupTables });
    if (!message.payerKey.equals(payer)) throw new Error('The swap payer does not match the connected wallet.');
    if (!Number.isSafeInteger(options.feeLamports) || options.feeLamports < 0) throw new Error('Invalid platform fee.');
    if (options.feeLamports > 0) message.instructions.push(SystemProgram.transfer({
        fromPubkey: payer, toPubkey: new PublicKey(options.treasury), lamports: options.feeLamports,
    }));
    if (options.tip) {
        if (!Number.isSafeInteger(options.tip.lamports) || options.tip.lamports < 0) throw new Error('Invalid priority tip.');
        message.instructions.push(SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(options.tip.address), lamports: options.tip.lamports }));
    }
    return new VersionedTransaction(message.compileToV0Message(lookupTables));
}
