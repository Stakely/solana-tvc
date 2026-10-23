import {
  formatPercent,
  formatRatio,
  formatWholeSol,
  roundLamportsToHundredSol,
} from '@/app/utils.ts';

describe('formatPercent', () => {
  it('prints a share as a percentage with a dot', () => {
    expect(formatPercent(0.98766, 2)).toBe('98.77%');
    expect(formatPercent(1, 2)).toBe('100.00%');
    expect(formatPercent(0.2, 1)).toBe('20.0%');
  });

  it('prints a dash for a share that is not a number', () => {
    expect(formatPercent(Number.NaN, 2)).toBe('—');
    expect(formatPercent(Infinity, 2)).toBe('—');
  });
});

describe('formatRatio', () => {
  it('keeps 4 decimals', () => {
    expect(formatRatio(0.99942)).toBe('0.9994');
    expect(formatRatio(1)).toBe('1.0000');
  });
});

describe('roundLamportsToHundredSol', () => {
  it('rounds to the nearest 100 SOL, at least 100 SOL', () => {
    expect(roundLamportsToHundredSol('612000000000')).toBe('600000000000');
    expect(roundLamportsToHundredSol('649999999999')).toBe('600000000000');
    expect(roundLamportsToHundredSol('650000000000')).toBe('700000000000');
    expect(roundLamportsToHundredSol('10000000000')).toBe('100000000000');
  });

  it('rejects what is not a lamport amount', () => {
    expect(roundLamportsToHundredSol('6e11')).toBeNull();
    expect(roundLamportsToHundredSol('')).toBeNull();
  });

  it('is printed in whole SOL with English digits', () => {
    expect(formatWholeSol('600000000000')).toBe('600 SOL');
    expect(formatWholeSol('1200000000000')).toBe('1,200 SOL');
  });
});
