import { isWorthwhile, type ClusterName } from '../App';
import type { FeeEstimate } from '../lib/fees';
import { TOKEN_2022_PROGRAM_ID } from '../lib/constants';
import { explorerUrl, formatSol, shortAddress } from '../lib/format';
import type { ReclaimItem } from '../lib/scan';

interface Props {
  items: ReclaimItem[];
  selected: Set<string>;
  onToggle(address: string): void;
  onToggleAll(): void;
  cluster: ClusterName;
  fee: FeeEstimate | null;
}

export function AccountTable({ items, selected, onToggle, onToggleAll, cluster, fee }: Props) {
  const reclaimable = fee ? items.filter((i) => isWorthwhile(i, fee)) : [];
  const allSelected = reclaimable.length > 0 && selected.size === reclaimable.length;

  /** Why an over-funded account still cannot be reclaimed. */
  function blockedReason(item: ReclaimItem): string | null {
    if (!item.eligible) return item.reason ?? 'Not supported';
    if (item.excess === 0) return 'Already at the rent floor';
    if (fee && item.excess <= fee.perAccount) return 'Costs more in fees than it returns';
    return null;
  }

  return (
    <section className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all reclaimable accounts"
                disabled={reclaimable.length === 0}
              />
            </th>
            <th>Account</th>
            <th>Type</th>
            <th className="num">Size</th>
            <th className="num">Balance</th>
            <th className="num">Rent floor</th>
            <th className="num">Surplus</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isToken2022 = item.programId === TOKEN_2022_PROGRAM_ID.toBase58();
            const blocked = blockedReason(item);
            const canReclaim = blocked === null;
            return (
              <tr key={item.address} className={canReclaim ? '' : 'muted'}>
                <td className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(item.address)}
                    onChange={() => onToggle(item.address)}
                    disabled={!canReclaim}
                    aria-label={`Select ${item.address}`}
                  />
                </td>
                <td data-label="Account">
                  <a
                    href={explorerUrl(`address/${item.address}`, cluster)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddress(item.address, 6)}
                  </a>
                  <small>
                    {item.kind === 'token-account'
                      ? `mint ${shortAddress(item.mint)}`
                      : `decimals ${item.decimals}`}
                  </small>
                </td>
                <td data-label="Type">
                  <span className="tag">
                    {item.kind === 'token-account' ? 'Token account' : 'Mint'}
                  </span>
                  {isToken2022 && <span className="tag alt">Token-2022</span>}
                </td>
                <td className="num" data-label="Size">
                  {item.dataLength} B
                </td>
                <td className="num" data-label="Balance">
                  {formatSol(item.lamports)}
                </td>
                <td className="num" data-label="Rent floor">
                  {formatSol(item.rentExempt)}
                </td>
                <td className={`num ${canReclaim ? 'gain' : ''}`} data-label="Surplus">
                  {item.excess > 0 ? formatSol(item.excess) : '—'}
                </td>
                <td className="status" data-label="Status">
                  {blocked ? <span className="tag warn">{blocked}</span> : 'Ready'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
