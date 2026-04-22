const LAMPORTS_PER_SOL = 1_000_000_000;

export function formatLamportsToSol(lamportsStr: string): string {
  const cleaned = lamportsStr.replace(/[,\s_]/g, '');
  if (!/^\d+$/.test(cleaned)) return '0 SOL';

  const lamports = BigInt(cleaned);

  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  if (!Number.isFinite(sol) || sol <= 0) return '0 SOL';

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

  // Redondeo y sustitución de punto por coma
  const formatted = scaled
    .toFixed(decimals)
    .replace(/\.0+$/, '') // quita .0 / .00
    .replace('.', ',');

  return `${formatted}${unit.suffix} SOL`;
}
