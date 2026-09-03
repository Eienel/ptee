import { isWorthwhile } from '../App';
import type { FeeEstimate } from '../lib/fees';
import { formatSol } from '../lib/format';
import { IX_PER_TRANSACTION } from '../lib/reclaim';
import type { ReclaimItem } from '../lib/scan';

interface Props {
  items: ReclaimItem[];
  chosen: ReclaimItem[];
  fee: FeeEstimate | null;
  scanning: boolean;
  sending: boolean;
  onScan(): void;
  onReclaim(): void;
}

export function Summary({ items, chosen, fee, scanning, sending, onScan, onReclaim }: Props) {
  const worthwhile = fee ? items.filter((i) => isWorthwhile(i, fee)) : [];
  const gross = chosen.reduce((sum, i) => sum + i.excess, 0);
  const transactions = Math.ceil(chosen.length / IX_PER_TRANSACTION);
  const fees = fee ? transactions * fee.perTransaction : 0;
  const net = Math.max(0, gross - fees);

  return (
    <section className="summary">
      <div className="stats">
        <div className="stat">
          <span className="label">Accounts scanned</span>
          <span className="value">{items.length}</span>
        </div>
        <div className="stat">
          <span className="label">Worth reclaiming</span>
          <span className="value">
            {worthwhile.length}
            <small>of {items.filter((i) => i.excess > 0).length} over-funded</small>
          </span>
        </div>
        <div className="stat">
          <span className="label">Selected surplus</span>
          <span className="value">{formatSol(gross)} SOL</span>
        </div>
        <div className="stat">
          <span className="label">Network fee</span>
          <span className="value">
            &minus;{formatSol(fees)} SOL
            <small>
              {transactions} transaction{transactions === 1 ? '' : 's'}
              {fee && ` · ${fee.microLamportsPerCu.toLocaleString()} µlamports/CU`}
            </small>
          </span>
        </div>
        <div className="stat highlight">
          <span className="label">You receive</span>
          <span className="value">{formatSol(net)} SOL</span>
        </div>
      </div>

      <div className="actions">
        <button onClick={onScan} disabled={scanning || sending}>
          {scanning ? 'Scanning…' : items.length ? 'Rescan' : 'Scan wallet'}
        </button>
        <button className="primary" onClick={onReclaim} disabled={sending || chosen.length === 0}>
          {sending ? 'Reclaiming…' : `Reclaim ${formatSol(net)} SOL`}
        </button>
      </div>
    </section>
  );
}
