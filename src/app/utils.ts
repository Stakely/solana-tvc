const LAMPORTS_PER_SOL = 1_000_000_000;
const LAMPORTS_PER_HUNDRED_SOL = 100n * 1_000_000_000n;

export function formatLamportsToSol(lamportsStr: string): string {
  return `${formatLamportsCompact(lamportsStr)} SOL`;
}

// The SOL amount without its unit ("12,3M"), for the Stake column.
export function formatLamportsCompact(lamportsStr: string): string {
  const cleaned = lamportsStr.replace(/[,\s_]/g, '');
  if (!/^\d+$/.test(cleaned)) return '0';

  const lamports = BigInt(cleaned);

  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  if (!Number.isFinite(sol) || sol <= 0) return '0';

  const units = [
    { suffix: '', value: 1 },
    { suffix: 'K', value: 1e3 },
    { suffix: 'M', value: 1e6 },
    { suffix: 'B', value: 1e9 },
    { suffix: 'T', value: 1e12 },
  ] as const;

  // eslint-disable-next-line
  let unit: any = units[0];
  for (let i = units.length - 1; i >= 0; i--) {
    if (sol >= units[i].value) {
      unit = units[i];
      break;
    }
  }

  const scaled = sol / unit.value;
  let decimals: number;
  if (unit.suffix) {
    decimals = scaled >= 100 ? 0 : 1;
  } else {
    decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  }

  // Round, drop trailing zeros and print with a decimal comma.
  const formatted = scaled
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace('.', ',');

  return `${formatted}${unit.suffix}`;
}

// Share (0 to 1) as a percentage with a dot: 0.9876 → '98.76%'.
export function formatPercent(share: number, decimals: number): string {
  if (!Number.isFinite(share)) return '—';
  return `${(share * 100).toFixed(decimals)}%`;
}

// Epoch ratio with 4 decimals: 0.99942 → '0.9994'.
export function formatRatio(ratio: number): string {
  return ratio.toFixed(4);
}

// Whole SOL with English digit grouping ("1,200 SOL"), for English copy;
// the table keeps formatLamportsToSol.
export function formatWholeSol(lamportsStr: string): string {
  return `${(BigInt(lamportsStr) / 1_000_000_000n).toLocaleString('en-US')} SOL`;
}

// Lamports (decimal string) rounded to the nearest 100 SOL, at least 100 SOL;
// null when the text is not a lamport amount.
export function roundLamportsToHundredSol(lamportsStr: string): string | null {
  if (!/^\d+$/.test(lamportsStr)) return null;
  const lamports = BigInt(lamportsStr);
  const half = LAMPORTS_PER_HUNDRED_SOL / 2n;
  const rounded =
    ((lamports + half) / LAMPORTS_PER_HUNDRED_SOL) * LAMPORTS_PER_HUNDRED_SOL;
  return (
    rounded < LAMPORTS_PER_HUNDRED_SOL ? LAMPORTS_PER_HUNDRED_SOL : rounded
  ).toString();
}
