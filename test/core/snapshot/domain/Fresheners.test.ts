/**
 * @jest-environment node
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ValidatorSnapshotFreshener } from '@/core/snapshot/domain/ValidatorSnapshotFreshener.ts';
import { ValidatorInfoFreshener } from '@/core/snapshot/domain/ValidatorInfoFreshener.ts';
import { SnapshotSource } from '@/core/snapshot/domain/SnapshotSource.ts';
import { EpochFreshener } from '@/core/epoch/domain/EpochFreshener.ts';
import { SolanaCli } from '@/core/solana/SolanaCli.ts';

describe('fresheners', () => {
  const dirs: string[] = [];
  const tempDir = async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tvc-'));
    dirs.push(dir);
    return dir;
  };

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(
      dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

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
    const dir = await tempDir();
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

  it('the validator info freshener shares one CLI call between concurrent callers', async () => {
    const dir = await tempDir();
    // The CLI call takes as long as the test wants: until `release()`.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started: () => void = () => undefined;
    const inFlight = new Promise<void>((resolve) => {
      started = resolve;
    });
    const cli = {
      validatorInfo: jest.fn<Promise<string>, []>(async () => {
        started();
        await gate;
        return '[]';
      }),
    };
    const freshener = new ValidatorInfoFreshener(
      cli as unknown as SolanaCli,
      dir,
      5_000
    );

    const first = freshener.ensureFresh();
    const second = freshener.ensureFresh();
    await inFlight;
    // The CLI is running now: a caller that arrives joins it.
    const third = freshener.ensureFresh();
    // Keep it running while the callers reach it, as a slow call would.
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    await Promise.all([first, second, third]);

    expect(cli.validatorInfo).toHaveBeenCalledTimes(1);
    await expect(
      readFile(path.join(dir, 'validator_info.json'), 'utf-8')
    ).resolves.toBe('[]');
  });

  it('the validator info freshener never rejects and tries again after a CLI failure', async () => {
    const dir = await tempDir();
    const failure = new Error('rpc down');
    const cli = {
      validatorInfo: jest
        .fn<Promise<string>, []>()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce('[]'),
    };
    const freshener = new ValidatorInfoFreshener(
      cli as unknown as SolanaCli,
      dir,
      5_000
    );

    await expect(freshener.ensureFresh()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      'validator info refresh failed',
      failure
    );

    await freshener.ensureFresh();
    expect(cli.validatorInfo).toHaveBeenCalledTimes(2);
    await expect(
      readFile(path.join(dir, 'validator_info.json'), 'utf-8')
    ).resolves.toBe('[]');

    // The file is fresh now: no more CLI calls.
    await freshener.ensureFresh();
    expect(cli.validatorInfo).toHaveBeenCalledTimes(2);
  });
});
