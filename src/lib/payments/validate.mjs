export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// Validate explicit instructions rather than unrelated aggregate balance changes.
export function validatePayment(tx, intent, treasury) {
    if (!tx?.meta || tx.meta.err) return 'TRANSACTION_FAILED';
    if (!tx.blockTime || tx.blockTime * 1000 < new Date(intent.createdAt).getTime() - 60_000 ||
        tx.blockTime * 1000 > new Date(intent.expiresAt).getTime()) return 'PAYMENT_EXPIRED';
    const keys = tx.transaction.message.accountKeys;
    if (!keys.some(k => k.pubkey.toString() === intent.wallet && k.signer)) return 'INVALID_PAYER';
    const instructions = tx.transaction.message.instructions;
    const memo = instructions.filter(i => i.programId.toString() === MEMO_PROGRAM);
    if (memo.length !== 1 || memo[0].parsed !== `VORTEX_PAY:${intent.id}`) return 'INVALID_PAYMENT_REFERENCE';
    const paid = instructions.filter(i => i.programId.toString() === '11111111111111111111111111111111' &&
        i.parsed?.type === 'transfer' && i.parsed.info.source === intent.wallet && i.parsed.info.destination === treasury)
        .reduce((total, i) => total + Number(i.parsed.info.lamports), 0);
    if (!Number.isSafeInteger(paid) || paid !== intent.lamports) return 'INCORRECT_PAYMENT_AMOUNT';
    return null;
}
