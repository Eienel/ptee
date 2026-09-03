import { ComputeBudgetProgram, Connection, TransactionInstruction } from '@solana/web3.js';

/** Lamports per signature. Our transactions carry exactly one. */
export const BASE_FEE_LAMPORTS = 5000;

/**
 * Measured cost of one WithdrawExcessLamports on mainnet: 269 compute units.
 * Budgeted generously so a batch never runs out, while staying small enough
 * that the priority fee (priced per compute unit) stays cheap.
 */
const CU_PER_WITHDRAWAL = 1500;
const CU_OVERHEAD = 1200;

/** Bounds on the priority fee we are willing to bid, in micro-lamports per CU. */
const MIN_PRIORITY_FEE = 1000;
const MAX_PRIORITY_FEE = 100_000;

export interface FeeEstimate {
  microLamportsPerCu: number;
  /** Total lamports one full batch costs: base fee + priority fee. */
  perTransaction: number;
  /** What one account in a full batch effectively costs. */
  perAccount: number;
}

function computeUnitLimit(instructionCount: number): number {
  return CU_PER_WITHDRAWAL * instructionCount + CU_OVERHEAD;
}

export function computeBudgetInstructions(
  instructionCount: number,
  microLamportsPerCu: number,
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit(instructionCount) }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamportsPerCu }),
  ];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Prices a full batch from recent network conditions. Without a priority fee a
 * reclaim can sit unconfirmed for a long time under load; without an estimate
 * of the total we cannot tell the user whether reclaiming is worth it at all.
 */
export async function estimateFee(
  connection: Connection,
  instructionsPerTransaction: number,
): Promise<FeeEstimate> {
  let microLamportsPerCu = MIN_PRIORITY_FEE;
  try {
    const recent = await connection.getRecentPrioritizationFees();
    const paid = recent.map((f) => f.prioritizationFee).filter((f) => f > 0);
    if (paid.length > 0) {
      microLamportsPerCu = Math.min(MAX_PRIORITY_FEE, Math.max(MIN_PRIORITY_FEE, median(paid)));
    }
  } catch {
    // Endpoint does not support the method — fall back to the floor bid.
  }

  const units = computeUnitLimit(instructionsPerTransaction);
  const priority = Math.ceil((units * microLamportsPerCu) / 1_000_000);
  const perTransaction = BASE_FEE_LAMPORTS + priority;

  return {
    microLamportsPerCu,
    perTransaction,
    perAccount: Math.ceil(perTransaction / instructionsPerTransaction),
  };
}
