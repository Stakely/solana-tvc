// Short names for the gossip client ids (getClusterNodes `clientId`), to fit
// under the version in the table. An id not listed here is split into words.
const LABELS: Record<string, string> = {
  SolanaLabs: 'Solana Labs',
  JitoLabs: 'Jito',
  Agave: 'Agave',
  AgaveBam: 'Agave BAM',
  AgavePaladin: 'Paladin',
  HarmonicAgave: 'Harmonic',
  HarmonicFiredancer: 'Harmonic FD',
  Firedancer: 'Firedancer',
  Frankendancer: 'Frankendancer',
  FireBAM: 'FireBAM',
  Rakurai: 'Rakurai',
};

export function clientLabel(clientId: string | undefined): string {
  if (!clientId) return '';
  return LABELS[clientId] ?? clientId.replace(/([a-z])([A-Z])/g, '$1 $2');
}
