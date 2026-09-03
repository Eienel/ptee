import type { PublicKey } from '@solana/web3.js';
import { CLUSTERS, type ClusterName } from '../App';
import { shortAddress } from '../lib/format';
import { browseDeepLinks, isMobile } from '../lib/mobile';
import type { DetectedWallet } from '../lib/wallet';

interface Props {
  cluster: ClusterName;
  endpoint: string;
  onCluster(cluster: ClusterName): void;
  onEndpoint(endpoint: string): void;
  wallets: DetectedWallet[];
  wallet: DetectedWallet | null;
  pubkey: PublicKey | null;
  onConnect(wallet: DetectedWallet): void;
  onDisconnect(): void;
}

export function Header({
  cluster,
  endpoint,
  onCluster,
  onEndpoint,
  wallets,
  wallet,
  pubkey,
  onConnect,
  onDisconnect,
}: Props) {
  return (
    <header>
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <strong>Rent Reclaim</strong>
      </div>

      <div className="controls">
        {/* Network settings are for people bringing their own endpoint. On a
            phone they would push the connect button below the fold, so they
            start collapsed there and stay open on desktop. */}
        <details className="network" open={!isMobile()}>
          <summary>Network</summary>
          <div className="network-fields">
            <label className="field">
                  <select value={cluster} onChange={(e) => onCluster(e.target.value as ClusterName)}>
                {Object.keys(CLUSTERS).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field grow">
              <span>RPC endpoint</span>
              <input
                value={endpoint}
                onChange={(e) => onEndpoint(e.target.value)}
                spellCheck={false}
                placeholder="https://your-rpc-provider"
              />
            </label>
          </div>
        </details>

        {pubkey && wallet ? (
          <button className="wallet" onClick={onDisconnect} title={pubkey.toBase58()}>
            {wallet.name} · {shortAddress(pubkey.toBase58())} · Disconnect
          </button>
        ) : wallets.length > 0 ? (
          wallets.map((w) => (
            <button key={w.name} className="wallet primary" onClick={() => onConnect(w)}>
              Connect {w.name}
            </button>
          ))
        ) : (
          // No injected provider: on a phone, hand off to a wallet's in-app browser.
          isMobile() &&
          browseDeepLinks().map((link) => (
            <a key={link.name} className="wallet primary" href={link.url}>
              Open in {link.name}
            </a>
          ))
        )}
      </div>
    </header>
  );
}
