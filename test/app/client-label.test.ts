import { clientLabel } from '@/app/client-label.ts';

describe('clientLabel', () => {
  it('shortens the known client ids', () => {
    expect(clientLabel('JitoLabs')).toBe('Jito');
    expect(clientLabel('AgaveBam')).toBe('Agave BAM');
    expect(clientLabel('HarmonicFiredancer')).toBe('Harmonic FD');
    expect(clientLabel('Firedancer')).toBe('Firedancer');
  });

  it('splits an unknown id into words and is empty without one', () => {
    expect(clientLabel('SomeNewClient')).toBe('Some New Client');
    expect(clientLabel('Unknown(28598)')).toBe('Unknown');
    expect(clientLabel(undefined)).toBe('');
    expect(clientLabel('')).toBe('');
  });
});
