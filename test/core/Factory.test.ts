/**
 * @jest-environment node
 */
import { Factory } from '@/core/Factory.ts';

describe('Factory', () => {
  const original = process.env.SNAPSHOT_FILE_TTL;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.SNAPSHOT_FILE_TTL;
    } else {
      process.env.SNAPSHOT_FILE_TTL = original;
    }
  });

  it.each<[string | undefined, number]>([
    [undefined, 5_000],
    ['50', 3_000],
    ['7000', 7_000],
    ['30000', 10_000],
    ['soon', 5_000],
  ])('SNAPSHOT_FILE_TTL=%s gives %d ms', (value, expected) => {
    if (value === undefined) {
      delete process.env.SNAPSHOT_FILE_TTL;
    } else {
      process.env.SNAPSHOT_FILE_TTL = value;
    }
    expect(Factory.snapshotTtlMs()).toBe(expected);
  });

  it('shares one snapshot source per process', () => {
    expect(Factory.SnapshotSource()).toBe(Factory.SnapshotSource());
  });

  it('shares one measure service per process', () => {
    expect(Factory.MeasureService()).toBe(Factory.MeasureService());
  });
});
