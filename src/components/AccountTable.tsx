import type { ClusterName } from '../App';
import { TOKEN_2022_PROGRAM_ID } from '../lib/constants';
import { explorerUrl, formatSol, shortAddress } from '../lib/format';
import type { ReclaimItem } from '../lib/scan';

interface Props {
  items: ReclaimItem[];
  selected: Set<string>;
  onToggle(address: string): void;
  onToggleAll(): void;
  cluster: ClusterName;
}

export function AccountTable({ items, selected, onToggle, onToggleAll, cluster }: Props) {
  const reclaimable = items.filter((i) => i.excess > 0);
  const allSelected = reclaimable.length > 0 && selected.size === reclaimable.length;

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
            <th className="num">Reclaimable</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isToken2022 = item.programId === TOKEN_2022_PROGRAM_ID.toBase58();
            const canReclaim = item.excess > 0;
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
                <td>
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
                <td>
                  <span className="tag">
                    {item.kind === 'token-account' ? 'Token account' : 'Mint'}
                  </span>
                  {isToken2022 && <span className="tag alt">Token-2022</span>}
                </td>
                <td className="num">{item.dataLength} B</td>
                <td className="num">{formatSol(item.lamports)}</td>
                <td className="num">{formatSol(item.rentExempt)}</td>
                <td className={`num ${canReclaim ? 'gain' : ''}`}>
                  {canReclaim ? formatSol(item.excess) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
