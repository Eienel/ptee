/**
 * Card styles. Same numbers, different clothes — the figures are read from the
 * receipt in every case, so a variant can only change how it looks.
 */
export interface Variant {
  id: string;
  label: string;
  /** Background stops, top-left to bottom-right. */
  bg: [string, string, string];
  /** Glow behind the top-left corner. */
  glow: string;
  /** Accent used for the rule, the ticker and the dollar figure. */
  accent: string;
  accent2: string;
  ink: string;
  muted: string;
  /** Optional watermark behind the numbers. */
  stamp?: string;
  stampColor?: string;
}

export const VARIANTS: Variant[] = [
  {
    id: 'ember',
    label: 'Ember',
    bg: ['#1a0d04', '#0a0705', '#000000'],
    glow: '#ff7a1a',
    accent: '#ff6a00',
    accent2: '#ffb300',
    ink: '#ffffff',
    muted: '#6e6e73',
  },
  {
    id: 'trench',
    label: 'Trench',
    bg: ['#03140b', '#02100a', '#000000'],
    glow: '#00ff88',
    accent: '#00c853',
    accent2: '#69f0ae',
    ink: '#eafff2',
    muted: '#5f7a68',
    stamp: 'GM',
    stampColor: '#00ff88',
  },
  {
    id: 'gold',
    label: 'Bullion',
    bg: ['#1c1505', '#100c04', '#000000'],
    glow: '#ffd54f',
    accent: '#d4a017',
    accent2: '#ffe082',
    ink: '#fffaf0',
    muted: '#8a7a52',
    stamp: 'PAID',
    stampColor: '#ffd54f',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    bg: ['#0a0a0a', '#050505', '#000000'],
    glow: '#9aa3b0',
    accent: '#e8ecf1',
    accent2: '#ffffff',
    ink: '#ffffff',
    muted: '#5a5f66',
  },
  {
    id: 'candy',
    label: 'Degen',
    bg: ['#1a041a', '#0c0410', '#000000'],
    glow: '#ff2bd1',
    accent: '#ff2bd1',
    accent2: '#7c4dff',
    ink: '#ffffff',
    muted: '#7a6180',
    stamp: 'WAGMI',
    stampColor: '#ff2bd1',
  },
];

export const DEFAULT_VARIANT = VARIANTS[0];

export function variantById(id: string | null | undefined): Variant {
  return VARIANTS.find((v) => v.id === id) ?? DEFAULT_VARIANT;
}
