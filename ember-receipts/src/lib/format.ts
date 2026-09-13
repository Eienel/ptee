export function formatAmount(value: number, maxDecimals = 4): string {
  if (value === 0) return '0';
  if (value < 0.0001) return value.toExponential(2);
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return value.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

export function formatUsd(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const shortAddress = (a: string, n = 4) => `${a.slice(0, n)}…${a.slice(-n)}`;

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** "3 days" / "17 hours" — for how long a wallet has been earning. */
export function humanSpan(fromSeconds: number, toSeconds: number): string {
  const hours = Math.max(0, (toSeconds - fromSeconds) / 3600);
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}
