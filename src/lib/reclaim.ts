import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createWithdrawExcessLamportsInstruction } from './withdraw';
import type { ReclaimItem } from './scan';
import { signAll, type InjectedProvider } from './wallet';

/** WithdrawExcessLamports instructions per transaction, kept well under the size limit. */
export const IX_PER_TRANSACTION = 10;

export interface ReclaimBatch {
  items: ReclaimItem[];
  signature?: string;
  error?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Signs one transaction per batch of accounts and sends them in order.
 * A failed batch does not stop the remaining batches; every outcome is returned.
 */
export async function reclaim(
  connection: Connection,
  provider: InjectedProvider,
  wallet: PublicKey,
  items: ReclaimItem[],
  onProgress?: (batches: ReclaimBatch[]) => void,
): Promise<ReclaimBatch[]> {
  const batches = chunk(items, IX_PER_TRANSACTION);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const transactions = batches.map((batch) => {
    const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: wallet });
    for (const item of batch) {
      tx.add(
        createWithdrawExcessLamportsInstruction({
          source: new PublicKey(item.address),
          destination: wallet,
          authority: wallet,
          programId: new PublicKey(item.programId),
        }),
      );
    }
    return tx;
  });

  const signed = await signAll(provider, transactions);
  const results: ReclaimBatch[] = batches.map((items) => ({ items }));

  for (let i = 0; i < signed.length; i++) {
    try {
      const signature = await connection.sendRawTransaction(signed[i].serialize());
      results[i].signature = signature;
      onProgress?.([...results]);
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
    } catch (err) {
      results[i].error = err instanceof Error ? err.message : String(err);
    }
    onProgress?.([...results]);
  }

  return results;
}
