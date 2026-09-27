import { VersionedTransaction, PublicKey, TransactionInstruction, AddressLookupTableAccount, TransactionMessage, SystemProgram } from '@solana/web3.js';
import { createBurnInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { VTX_MINT, SOL_MINT } from '../constants';
import { getResilientConnection } from './connection';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap-instructions';

export interface BuyAndBurnResult {
    transaction: VersionedTransaction;
    quoteAmountIn: number;
    quoteAmountOut: number;
}

/**
 * Builds a composite transaction that:
 * 1. Swaps SOL for $VTX via Jupiter.
 * 2. Burns the exact amount of $VTX received.
 * 3. Appends a Memo instruction to cryptographically link the burn to an action (e.g. upgrading a token profile).
 */
export async function buildBuyAndBurnTransaction(
    userWallet: string,
    amountSol: number,
    targetTokenAddress: string,
    tier: string
): Promise<BuyAndBurnResult> {
    const userPubkey = new PublicKey(userWallet);
    const vtxMint = new PublicKey(VTX_MINT);
    
    const amountLamports = Math.floor(amountSol * 1_000_000_000);

    // 1. Get Jupiter Quote (SOL -> VTX)
    const quoteResponse = await fetch(`${JUPITER_QUOTE_API}?inputMint=${SOL_MINT}&outputMint=${VTX_MINT}&amount=${amountLamports}&slippageBps=100`);
    if (!quoteResponse.ok) {
        throw new Error('Failed to fetch Jupiter quote for VTX burn');
    }
    const quoteData = await quoteResponse.json();
    const vtxAmountOutStr = quoteData.outAmount;

    // 2. Get Swap Instructions from Jupiter
    const swapReqBody = {
        quoteResponse: quoteData,
        userPublicKey: userWallet,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
    };

    const swapResponse = await fetch(JUPITER_SWAP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapReqBody)
    });

    if (!swapResponse.ok) {
        throw new Error('Failed to fetch Jupiter swap instructions');
    }

    const {
        tokenLedgerInstruction,
        computeBudgetInstructions,
        setupInstructions,
        swapInstruction: swapInstructionPayload,
        cleanupInstruction,
        addressLookupTableAddresses,
    } = await swapResponse.json();

    const deserializeInstruction = (instruction: any) => {
        if (!instruction) return null;
        return new TransactionInstruction({
            programId: new PublicKey(instruction.programId),
            keys: instruction.accounts.map((key: any) => ({
                pubkey: new PublicKey(key.pubkey),
                isSigner: key.isSigner,
                isWritable: key.isWritable,
            })),
            data: Buffer.from(instruction.data, "base64"),
        });
    };

    const instructions: TransactionInstruction[] = [];

    // Add Compute Budget Instructions
    computeBudgetInstructions.forEach((ix: any) => instructions.push(deserializeInstruction(ix)!));

    // Add Setup Instructions (ATAs, Wrapped SOL creation)
    setupInstructions.forEach((ix: any) => instructions.push(deserializeInstruction(ix)!));

    // Token Ledger (If applicable)
    if (tokenLedgerInstruction) instructions.push(deserializeInstruction(tokenLedgerInstruction)!);

    // The Actual Swap
    instructions.push(deserializeInstruction(swapInstructionPayload)!);

    // 3. Construct the Burn Instruction
    const userVtxAta = getAssociatedTokenAddressSync(vtxMint, userPubkey);
    
    const burnInstruction = createBurnInstruction(
        userVtxAta,
        vtxMint,
        userPubkey,
        BigInt(vtxAmountOutStr)
    );
    instructions.push(burnInstruction);

    // 4. Construct the Memo Instruction
    const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    const memoText = `VORTEX_BURN:${tier}:${targetTokenAddress}`;
    const memoInstruction = new TransactionInstruction({
        programId: memoProgramId,
        keys: [{ pubkey: userPubkey, isSigner: true, isWritable: false }],
        data: Buffer.from(memoText, 'utf8'),
    });
    instructions.push(memoInstruction);

    // Add Cleanup (Close Wrapped SOL accounts, etc.)
    if (cleanupInstruction) instructions.push(deserializeInstruction(cleanupInstruction)!);

    // 5. Resolve Address Lookup Tables
    const getAddressLookupTableAccounts = async (keys: string[]) => {
        const addressLookupTableAccountInfos = await getResilientConnection(c => c.getMultipleAccountsInfo(
            keys.map((key) => new PublicKey(key))
        ));

        return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
            const addressLookupTableAddress = keys[index];
            if (accountInfo) {
                const addressLookupTableAccount = new AddressLookupTableAccount({
                    key: new PublicKey(addressLookupTableAddress),
                    state: AddressLookupTableAccount.deserialize(accountInfo.data),
                });
                acc.push(addressLookupTableAccount);
            }
            return acc;
        }, new Array<AddressLookupTableAccount>());
    };

    const addressLookupTableAccounts = await getAddressLookupTableAccounts(addressLookupTableAddresses);
    
    // 6. Compile Versioned Transaction
    const blockhash = await getResilientConnection(c => c.getLatestBlockhash());
    
    const messageV0 = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash.blockhash,
        instructions,
    }).compileToV0Message(addressLookupTableAccounts);

    const transaction = new VersionedTransaction(messageV0);

    return {
        transaction,
        quoteAmountIn: amountSol,
        quoteAmountOut: Number(vtxAmountOutStr)
    };
}
