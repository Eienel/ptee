import { Connection, PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountTable } from './components/AccountTable';
import { Header } from './components/Header';
import { Summary } from './components/Summary';
import { explorerUrl } from './lib/format';
import { reclaim, type ReclaimBatch } from './lib/reclaim';
import { RentCache } from './lib/rent';
import { scanMints, scanTokenAccounts, type ReclaimItem } from './lib/scan';
import { detectWallets, type DetectedWallet } from './lib/wallet';

export const CLUSTERS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
} as const;

export type ClusterName = keyof typeof CLUSTERS;

const ENDPOINT_KEY = 'ptee.endpoint';
const CLUSTER_KEY = 'ptee.cluster';

export default function App() {
  const [cluster, setCluster] = useState<ClusterName>(
    () => (localStorage.getItem(CLUSTER_KEY) as ClusterName) ?? 'mainnet-beta',
  );
  const [endpoint, setEndpoint] = useState<string>(
    () => localStorage.getItem(ENDPOINT_KEY) ?? CLUSTERS['mainnet-beta'],
  );
  const [wallets] = useState<DetectedWallet[]>(() => detectWallets());
  const [wallet, setWallet] = useState<DetectedWallet | null>(null);
  const [pubkey, setPubkey] = useState<PublicKey | null>(null);

  const [items, setItems] = useState<ReclaimItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [mintWarning, setMintWarning] = useState<string | null>(null);
  const [batches, setBatches] = useState<ReclaimBatch[] | null>(null);
  const [sending, setSending] = useState(false);

  const connection = useMemo(() => new Connection(endpoint, 'confirmed'), [endpoint]);

  useEffect(() => {
    localStorage.setItem(ENDPOINT_KEY, endpoint);
    localStorage.setItem(CLUSTER_KEY, cluster);
  }, [endpoint, cluster]);

  const chooseCluster = useCallback((next: ClusterName) => {
    setCluster(next);
    setEndpoint(CLUSTERS[next]);
    setItems([]);
    setSelected(new Set());
    setBatches(null);
  }, []);

  const connect = useCallback(async (detected: DetectedWallet) => {
    const { publicKey } = await detected.provider.connect();
    setWallet(detected);
    setPubkey(new PublicKey(publicKey.toString()));
    setBatches(null);
  }, []);

  const disconnect = useCallback(async () => {
    await wallet?.provider.disconnect().catch(() => {});
    setWallet(null);
    setPubkey(null);
    setItems([]);
    setSelected(new Set());
    setBatches(null);
  }, [wallet]);

  const scan = useCallback(async () => {
    if (!pubkey) return;
    setScanning(true);
    setScanError(null);
    setMintWarning(null);
    setBatches(null);
    try {
      const rent = new RentCache(connection);
      const tokenAccounts = await scanTokenAccounts(connection, rent, pubkey);

      // getProgramAccounts is disabled on some public endpoints; a failed mint
      // scan should not throw away the token-account results.
      let mints: ReclaimItem[] = [];
      try {
        mints = await scanMints(connection, rent, pubkey);
      } catch (err) {
        setMintWarning(
          `Could not scan mints on this RPC endpoint (${
            err instanceof Error ? err.message : String(err)
          }). Token accounts below are still complete — use a custom RPC that allows getProgramAccounts to include mints you control.`,
        );
      }

      const all = [...tokenAccounts, ...mints].sort((a, b) => b.excess - a.excess);
      setItems(all);
      setSelected(new Set(all.filter((i) => i.excess > 0).map((i) => i.address)));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
      setItems([]);
    } finally {
      setScanning(false);
    }
  }, [connection, pubkey]);

  const toggle = useCallback((address: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(address)) next.add(address);
      return next;
    });
  }, []);

  const reclaimable = useMemo(() => items.filter((i) => i.excess > 0), [items]);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === reclaimable.length ? new Set() : new Set(reclaimable.map((i) => i.address)),
    );
  }, [reclaimable]);

  const chosen = useMemo(
    () => reclaimable.filter((i) => selected.has(i.address)),
    [reclaimable, selected],
  );

  const onReclaim = useCallback(async () => {
    if (!wallet || !pubkey || chosen.length === 0) return;
    setSending(true);
    setBatches(null);
    try {
      const results = await reclaim(connection, wallet.provider, pubkey, chosen, setBatches);
      setBatches(results);
      const reclaimed = new Set(
        results.filter((b) => b.signature && !b.error).flatMap((b) => b.items.map((i) => i.address)),
      );
      // Reflect the new on-chain state without a full re-scan.
      setItems((prev) =>
        prev.map((item) =>
          reclaimed.has(item.address)
            ? { ...item, lamports: item.rentExempt, excess: 0 }
            : item,
        ),
      );
      setSelected(new Set());
    } catch (err) {
      setBatches([{ items: chosen, error: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setSending(false);
    }
  }, [chosen, connection, pubkey, wallet]);

  return (
    <div className="page">
      <Header
        cluster={cluster}
        endpoint={endpoint}
        onCluster={chooseCluster}
        onEndpoint={setEndpoint}
        wallets={wallets}
        wallet={wallet}
        pubkey={pubkey}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main>
        <section className="intro">
          <h1>Reclaim your excess rent</h1>
          <p>
            Solana&rsquo;s rent-exempt minimum is coming down in phases, which leaves every account
            created at an older rate over-funded. Connect a wallet to see the surplus SOL sitting on
            your token accounts and mints, and withdraw it with the Token Program&rsquo;s{' '}
            <code>WithdrawExcessLamports</code> instruction. Token balances are untouched and
            nothing is closed &mdash; only the lamports above the current floor move.
          </p>
        </section>

        {pubkey && (
          <Summary
            items={items}
            chosen={chosen}
            scanning={scanning}
            onScan={scan}
            onReclaim={onReclaim}
            sending={sending}
          />
        )}

        {scanError && <p className="alert error">Scan failed: {scanError}</p>}
        {mintWarning && <p className="alert warn">{mintWarning}</p>}

        {batches && (
          <section className="results">
            <h2>Transactions</h2>
            <ul>
              {batches.map((batch, i) => (
                <li key={i} className={batch.error ? 'error' : batch.signature ? 'ok' : ''}>
                  <span>
                    {batch.items.length} account{batch.items.length === 1 ? '' : 's'}
                  </span>
                  {batch.signature && (
                    <a
                      href={explorerUrl(`tx/${batch.signature}`, cluster)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on explorer
                    </a>
                  )}
                  {batch.error && <span className="msg">{batch.error}</span>}
                  {!batch.signature && !batch.error && <span className="msg">Sending&hellip;</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pubkey && !scanning && items.length > 0 && (
          <AccountTable
            items={items}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            cluster={cluster}
          />
        )}

        {pubkey && !scanning && items.length === 0 && !scanError && (
          <p className="empty">
            No token accounts or mints found for this wallet yet. Run a scan to check.
          </p>
        )}

        {!pubkey && (
          <p className="empty">
            {wallets.length === 0
              ? 'No Solana wallet detected in this browser. Install Phantom, Solflare, or Backpack to continue.'
              : 'Connect a wallet to scan for reclaimable rent.'}
          </p>
        )}
      </main>

      <footer>
        <a href="https://solana.com/upgrades/reduced-rent" target="_blank" rel="noreferrer">
          Rent reduction rollout
        </a>
        <a
          href="https://solana.com/docs/tokens/advanced/withdraw-excess-lamports"
          target="_blank"
          rel="noreferrer"
        >
          WithdrawExcessLamports docs
        </a>
        <span>
          Rent floors are read live from the cluster, never hardcoded, so this stays correct at every
          phase.
        </span>
      </footer>
    </div>
  );
}
