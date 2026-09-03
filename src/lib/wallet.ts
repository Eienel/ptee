import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

type AnyTransaction = Transaction | VersionedTransaction;

export interface InjectedProvider {
  publicKey: PublicKey | null;
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction<T extends AnyTransaction>(tx: T): Promise<T>;
  signAllTransactions?<T extends AnyTransaction>(txs: T[]): Promise<T[]>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface DetectedWallet {
  name: string;
  provider: InjectedProvider;
}

interface WalletWindow {
  phantom?: { solana?: InjectedProvider };
  solana?: InjectedProvider & { isPhantom?: boolean };
  solflare?: InjectedProvider & { isSolflare?: boolean };
  backpack?: InjectedProvider;
}

/** Injected Solana wallets present in this browser, in display order. */
export function detectWallets(): DetectedWallet[] {
  const w = window as unknown as WalletWindow;
  const candidates: Array<[string, InjectedProvider | undefined]> = [
    ['Phantom', w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined)],
    ['Solflare', w.solflare?.isSolflare ? w.solflare : undefined],
    ['Backpack', w.backpack],
    ['Injected wallet', w.solana],
  ];

  const seen = new Set<InjectedProvider>();
  const wallets: DetectedWallet[] = [];
  for (const [name, provider] of candidates) {
    if (!provider || seen.has(provider)) continue;
    seen.add(provider);
    wallets.push({ name, provider });
  }
  return wallets;
}

/** Signs every transaction in one wallet prompt when the wallet supports it. */
export async function signAll(
  provider: InjectedProvider,
  transactions: Transaction[],
): Promise<Transaction[]> {
  if (provider.signAllTransactions) return provider.signAllTransactions(transactions);
  const signed: Transaction[] = [];
  for (const tx of transactions) signed.push(await provider.signTransaction(tx));
  return signed;
}
