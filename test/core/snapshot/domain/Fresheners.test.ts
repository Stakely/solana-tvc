/**
 * @jest-environment node
 */
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ValidatorSnapshotFreshener } from '@/core/snapshot/domain/ValidatorSnapshotFreshener.ts';
import { SnapshotSource } from '@/core/snapshot/domain/SnapshotSource.ts';
import { EpochFreshener } from '@/core/epoch/domain/EpochFreshener.ts';
import { SolanaCli } from '@/core/solana/SolanaCli.ts';

describe('fresheners', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('the snapshot freshener asks the shared source and never rejects', async () => {
    const source = { get: jest.fn().mockRejectedValue(new Error('rpc down')) };
    const freshener = new ValidatorSnapshotFreshener(
      source as unknown as SnapshotSource,
      5_000
    );

    await expect(freshener.ensureFresh()).resolves.toBeUndefined();
    expect(source.get).toHaveBeenCalledWith(5_000);
  });

  it('the epoch freshener tries again after a CLI failure', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tvc-'));
    const cli = {
      epochInfo: jest
        .fn<Promise<string>, []>()
        .mockRejectedValueOnce(new Error('rpc down'))
        .mockResolvedValueOnce('{"epoch":1065}'),
    };
    const freshener = new EpochFreshener(
      cli as unknown as SolanaCli,
      dir,
      5_000
    );

    await freshener.ensureFresh();
    await freshener.ensureFresh();
    expect(cli.epochInfo).toHaveBeenCalledTimes(2);
    await expect(readFile(path.join(dir, 'epoch.json'), 'utf-8')).resolves.toBe(
      '{"epoch":1065}'
    );
  });
});
