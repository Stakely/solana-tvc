/**
 * @jest-environment node
 */
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SnapshotSource } from '@/core/snapshot/domain/SnapshotSource.ts';

const TEXT = JSON.stringify({
  totalActiveStake: '10',
  totalCurrentStake: '10',
  totalDelinquentStake: '0',
  averageSkipRate: 0,
  averageStakeWeightedSkipRate: 0,
  stakeByVersion: {},
  validators: [],
});

describe('SnapshotSource', () => {
  it('shares one CLI call between concurrent requests', async () => {
    const cli = { validators: jest.fn(async () => TEXT) };
    const source = new SnapshotSource(cli, null);

    const [a, b] = await Promise.all([source.get(5_000), source.get(5_000)]);
    expect(cli.validators).toHaveBeenCalledTimes(1);
    expect(a.seq).toBe(1);
    expect(b).toBe(a);
    expect(source.latest()).toBe(a);
  });

  it('reuses a snapshot younger than maxAge and refreshes an older one', async () => {
    const clock = { t: 0 };
    const cli = { validators: jest.fn(async () => TEXT) };
    const source = new SnapshotSource(cli, null, () => clock.t);

    expect((await source.get(5_000)).seq).toBe(1);
    clock.t = 4_000;
    expect((await source.get(5_000)).seq).toBe(1);
    clock.t = 6_000;
    const fresh = await source.get(5_000);
    expect(fresh.seq).toBe(2);
    expect(fresh.takenAt).toBe(6_000);
    expect(cli.validators).toHaveBeenCalledTimes(2);
  });

  it('retries after a CLI failure', async () => {
    const cli = {
      validators: jest
        .fn<Promise<string>, []>()
        .mockRejectedValueOnce(new Error('rpc down'))
        .mockResolvedValueOnce(TEXT),
    };
    const source = new SnapshotSource(cli, null);

    await expect(source.get(5_000)).rejects.toThrow('rpc down');
    await expect(source.get(5_000)).resolves.toMatchObject({ seq: 1 });
  });

  it('writes snapshot.json for the table', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tvc-'));
    const source = new SnapshotSource({ validators: async () => TEXT }, dir);

    await source.get(5_000);
    await expect(
      readFile(path.join(dir, 'snapshot.json'), 'utf-8')
    ).resolves.toBe(TEXT);
  });
});
