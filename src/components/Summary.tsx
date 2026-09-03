import { formatSol } from '../lib/format';
import { IX_PER_TRANSACTION } from '../lib/reclaim';
import type { ReclaimItem } from '../lib/scan';

interface Props {
  items: ReclaimItem[];
  chosen: ReclaimItem[];
  scanning: boolean;
  sending: boolean;
  onScan(): void;
  onReclaim(): void;
}

export function Summary({ items, chosen, scanning, sending, onScan, onReclaim }: Props) {
  const reclaimable = items.filter((i) => i.excess > 0);
  const total = reclaimable.reduce((sum, i) => sum + i.excess, 0);
  const selectedTotal = chosen.reduce((sum, i) => sum + i.excess, 0);
  const transactions = Math.ceil(chosen.length / IX_PER_TRANSACTION);

  return (
    <section className="summary">
      <div className="stats">
        <div className="stat">
          <span className="label">Accounts scanned</span>
          <span className="value">{items.length}</span>
        </div>
        <div className="stat">
          <span className="label">Over-funded</span>
          <span className="value">{reclaimable.length}</span>
        </div>
        <div className="stat highlight">
          <span className="label">Total reclaimable</span>
          <span className="value">{formatSol(total)} SOL</span>
        </div>
        <div className="stat">
          <span className="label">Selected</span>
          <span className="value">
            {formatSol(selectedTotal)} SOL
            <small>
              {chosen.length} account{chosen.length === 1 ? '' : 's'}
              {transactions > 0 &&
                ` · ${transactions} transaction${transactions === 1 ? '' : 's'}`}
            </small>
          </span>
        </div>
      </div>

      <div className="actions">
        <button onClick={onScan} disabled={scanning || sending}>
          {scanning ? 'Scanning…' : items.length ? 'Rescan' : 'Scan wallet'}
        </button>
        <button className="primary" onClick={onReclaim} disabled={sending || chosen.length === 0}>
          {sending ? 'Reclaiming…' : `Reclaim ${formatSol(selectedTotal)} SOL`}
        </button>
      </div>
    </section>
  );
}
