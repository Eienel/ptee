import { LAMPORTS_PER_SOL } from './constants';

export function formatSol(lamports: number, maxDecimals = 6): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol === 0) return '0';
  if (sol < 0.000001) return '<0.000001';
  return sol.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

export function shortAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function explorerUrl(path: string, endpointLabel: string): string {
  const cluster =
    endpointLabel === 'devnet' ? '?cluster=devnet'
    : endpointLabel === 'testnet' ? '?cluster=testnet'
    : '';
  return `https://explorer.solana.com/${path}${cluster}`;
}
