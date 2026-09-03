import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { computeBudgetInstructions, type FeeEstimate } from './fees';
import type { ReclaimItem } from './scan';
import { createWithdrawExcessLamportsInstruction } from './withdraw';
import { signAll, type InjectedProvider } from './wallet';

/** WithdrawExcessLamports instructions per transaction, kept well under the size limit. */
export const IX_PER_TRANSACTION = 10;

/** How long to keep re-sending a signed transaction before its blockhash dies. */
const RESEND_INTERVAL_MS = 2000;

export interface ReclaimBatch {
  items: ReclaimItem[];
  signature?: string;
  error?: string;
  confirmed?: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const isExpiry = (message: string) =>
  /blockhash not found|block height exceeded|expired/i.test(message);

function buildTransaction(
  batch: ReclaimItem[],
  wallet: PublicKey,
  fee: FeeEstimate,
  blockhash: string,
  lastValidBlockHeight: number,
): Transaction {
  const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: wallet });
  tx.add(...computeBudgetInstructions(batch.length, fee.microLamportsPerCu));
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
}

/**
 * Re-sends until the transaction confirms or its blockhash expires. A dropped
 * transaction is normal under load; giving up after one send would strand the
 * user with a signed reclaim that never landed.
 */
async function sendAndConfirm(
  connection: Connection,
  transaction: Transaction,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<string> {
  const raw = transaction.serialize();
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: true });

  const confirmation = connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  let resending = true;
  void (async () => {
    while (resending) {
      await new Promise((r) => setTimeout(r, RESEND_INTERVAL_MS));
      if (!resending) return;
      await connection.sendRawTransaction(raw, { skipPreflight: true }).catch(() => {});
    }
  })();

  try {
    const { value } = await confirmation;
    if (value.err) throw new Error(`Transaction failed: ${JSON.stringify(value.err)}`);
    return signature;
  } finally {
    resending = false;
  }
}

/**
 * Signs and lands one transaction per batch of accounts.
 *
 * Transactions are simulated after signing and before broadcast, so a batch
 * that would fail on-chain is never sent. Batches whose blockhash expires while
 * the user is signing are rebuilt against a fresh blockhash and retried once.
 */
export async function reclaim(
  connection: Connection,
  provider: InjectedProvider,
  wallet: PublicKey,
  items: ReclaimItem[],
  fee: FeeEstimate,
  onProgress?: (batches: ReclaimBatch[]) => void,
): Promise<ReclaimBatch[]> {
  const batches = chunk(items, IX_PER_TRANSACTION);
  const results: ReclaimBatch[] = batches.map((batch) => ({ items: batch }));
  let pending = batches.map((_, index) => index);

  for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const transactions = pending.map((index) =>
      buildTransaction(batches[index], wallet, fee, blockhash, lastValidBlockHeight),
    );

    const signed = await signAll(provider, transactions);

    // Signed transactions simulate with real signatures, so this catches an
    // account the scanner should not have offered before any fee is paid.
    const simulations = await Promise.all(
      signed.map((tx) => connection.simulateTransaction(tx).catch(() => null)),
    );

    const expired: number[] = [];
    for (let i = 0; i < pending.length; i++) {
      const index = pending[i];
      const simulationError = simulations[i]?.value.err;
      if (simulationError) {
        results[index].error = `Simulation failed: ${JSON.stringify(simulationError)}`;
        onProgress?.([...results]);
        continue;
      }

      try {
        const signature = await sendAndConfirm(
          connection,
          signed[i],
          blockhash,
          lastValidBlockHeight,
        );
        results[index] = { ...results[index], signature, confirmed: true, error: undefined };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isExpiry(message) && attempt === 0) {
          expired.push(index);
          results[index].error = undefined;
        } else {
          results[index].error = message;
        }
      }
      onProgress?.([...results]);
    }

    pending = expired;
  }

  return results;
}
