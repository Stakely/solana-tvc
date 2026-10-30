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

// A snapshot whose most advanced validator is at (lastVote, rootSlot).
const at = (lastVote: number, rootSlot: number) =>
  JSON.stringify({
    ...JSON.parse(TEXT),
    validators: [
      { identityPubkey: 'a', lastVote: 10, rootSlot: 5 },
      { identityPubkey: 'b', lastVote, rootSlot },
    ],
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

  it('retries after a CLI failure once maxAge has passed', async () => {
    const clock = { t: 0 };
    const cli = {
      validators: jest
        .fn<Promise<string>, []>()
        .mockRejectedValueOnce(new Error('rpc down'))
        .mockResolvedValueOnce(TEXT),
    };
    const source = new SnapshotSource(cli, null, () => clock.t);

    await expect(source.get(5_000)).rejects.toThrow('rpc down');
    clock.t = 4_000;
    await expect(source.get(5_000)).rejects.toThrow('rpc down');
    expect(cli.validators).toHaveBeenCalledTimes(1);
    clock.t = 5_000;
    await expect(source.get(5_000)).resolves.toMatchObject({ seq: 1 });
    expect(cli.validators).toHaveBeenCalledTimes(2);
  });

  it('serves the last snapshot without calling the CLI again after a failure', async () => {
    const clock = { t: 0 };
    const cli = {
      validators: jest
        .fn<Promise<string>, []>()
        .mockResolvedValueOnce(TEXT)
        .mockRejectedValueOnce(new Error('rpc down'))
        .mockResolvedValueOnce(TEXT),
    };
    const source = new SnapshotSource(cli, null, () => clock.t);

    const first = await source.get(5_000);
    clock.t = 6_000;
    await expect(source.get(5_000)).rejects.toThrow('rpc down');
    clock.t = 10_000;
    expect(await source.get(5_000)).toBe(first);
    expect(cli.validators).toHaveBeenCalledTimes(2);
    clock.t = 11_000;
    expect((await source.get(5_000)).seq).toBe(2);
  });

  it('does not call the CLI again before maxAge after a parse failure', async () => {
    const clock = { t: 0 };
    const cli = { validators: jest.fn(async () => 'not json') };
    const source = new SnapshotSource(cli, null, () => clock.t);

    await expect(source.get(5_000)).rejects.toThrow();
    clock.t = 1_000;
    await expect(source.get(5_000)).rejects.toThrow();
    expect(cli.validators).toHaveBeenCalledTimes(1);
  });

  // Progress guard: with RPC_URLS in fallback a lagging backup RPC must not
  // move the table or snapshot.json backwards.
  describe('progress guard', () => {
    it('keeps the previous snapshot when the new one goes backwards', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'tvc-'));
      const clock = { t: 0 };
      const cli = {
        validators: jest
          .fn<Promise<string>, []>()
          .mockResolvedValueOnce(at(100, 90))
          .mockResolvedValueOnce(at(99, 90))
          .mockResolvedValueOnce(at(100, 89)),
      };
      const source = new SnapshotSource(cli, dir, () => clock.t);

      const first = await source.get(5_000);
      clock.t = 6_000;
      expect(await source.get(5_000)).toBe(first);
      clock.t = 12_000;
      expect(await source.get(5_000)).toBe(first);

      expect(cli.validators).toHaveBeenCalledTimes(3);
      expect(source.latest()).toBe(first);
      await expect(
        readFile(path.join(dir, 'snapshot.json'), 'utf-8')
      ).resolves.toBe(at(100, 90));
    });

    it('accepts a snapshot that does not go backwards', async () => {
      const clock = { t: 0 };
      const cli = {
        validators: jest
          .fn<Promise<string>, []>()
          .mockResolvedValueOnce(at(100, 90))
          .mockResolvedValueOnce(at(100, 90))
          .mockResolvedValueOnce(at(101, 91)),
      };
      const source = new SnapshotSource(cli, null, () => clock.t);

      await source.get(5_000);
      clock.t = 6_000;
      expect((await source.get(5_000)).seq).toBe(2);
      clock.t = 12_000;
      const third = await source.get(5_000);
      expect(third.seq).toBe(3);
      expect(third.takenAt).toBe(12_000);
    });

    it('does not call the CLI again before maxAge after a rejection', async () => {
      const clock = { t: 0 };
      const cli = {
        validators: jest
          .fn<Promise<string>, []>()
          .mockResolvedValueOnce(at(100, 90))
          .mockResolvedValueOnce(at(99, 90))
          .mockResolvedValueOnce(at(101, 91)),
      };
      const source = new SnapshotSource(cli, null, () => clock.t);

      await source.get(5_000);
      clock.t = 6_000;
      await source.get(5_000); // rejected: lagging RPC
      clock.t = 10_000;
      expect((await source.get(5_000)).seq).toBe(1);
      expect(cli.validators).toHaveBeenCalledTimes(2);

      clock.t = 11_000;
      expect((await source.get(5_000)).seq).toBe(2);
      expect(cli.validators).toHaveBeenCalledTimes(3);
    });
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
