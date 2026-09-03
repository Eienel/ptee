import { Connection } from '@solana/web3.js';

/**
 * Rent-exempt minimums are read from the cluster, never hardcoded, so the
 * dashboard stays correct across every phase of the rent reduction rollout.
 * Results are cached per data length for the lifetime of the page.
 */
export class RentCache {
  private cache = new Map<number, Promise<number>>();

  constructor(private connection: Connection) {}

  minimumBalance(dataLength: number): Promise<number> {
    let pending = this.cache.get(dataLength);
    if (!pending) {
      pending = this.connection.getMinimumBalanceForRentExemption(dataLength);
      this.cache.set(dataLength, pending);
    }
    return pending;
  }
}
