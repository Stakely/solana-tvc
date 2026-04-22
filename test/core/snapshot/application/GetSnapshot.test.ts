/**
 * @jest-environment node
 */

import { GetSnapshot } from '@/core/snapshot/application/GetSnapshot.ts';
import { SnapshotQuery } from '@/core/snapshot/domain/SnapshotQuery.ts';
import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';
import path from 'path';
import { GetSnapshotArgs, GetSnapshotResponse } from '@/types/snapshot.ts';
import { Factory } from '@/core/Factory.ts';
import { ValidatorInfoParser } from '@/core/snapshot/domain/ValidatorInfoParser.ts';

describe('Get Snapshot test', () => {
  let sut: (args: GetSnapshotArgs) => Promise<GetSnapshotResponse>;

  beforeEach(() => {
    const filePath = path.join(
      process.cwd(),
      'test/core/snapshot/application',
      'snapshot.test.json'
    );

    const filePathValidatorInfo = path.join(
      process.cwd(),
      'test/core/snapshot/application',
      'validator_info.test.json'
    );
    const parser = new SnapshotParser(filePath);
    const validatorInfoParser = new ValidatorInfoParser(filePathValidatorInfo);
    const reducer = Factory.SnapshotReducer();
    const query = new SnapshotQuery(parser, validatorInfoParser, reducer);

    const appService = new GetSnapshot(query);
    sut = ((args: GetSnapshotArgs) => appService.exec(args)) as (
      args: GetSnapshotArgs
    ) => Promise<GetSnapshotResponse>;
  });

  it('should return the snapshot with default order (credits)', async () => {
    const response = await sut({});
    expect(response.snapshot.validators).toHaveLength(2);
    expect(response.snapshot.validators[0].epochCredits).toBeGreaterThan(
      response.snapshot.validators[1].epochCredits
    );
    expect(response.snapshot.validators[0].identityPubkey).toBe(
      '7pR7t5axFfkg2VZB1uAuFNUvpAeowq2v15J4gw5MmHTB'
    );
    expect(response.snapshot.validators[1].identityPubkey).toBe(
      'puffinQSvKFriPbyE5atyx1ptfnyytovbzxybr1jsyy'
    );
  });

  it('should return the snapshot with the correct pagination', async () => {
    let response = await sut({ page: 1, size: 1 });
    expect(response.snapshot.validators).toHaveLength(1);
    expect(response.snapshot.validators[0].identityPubkey).toBe(
      '7pR7t5axFfkg2VZB1uAuFNUvpAeowq2v15J4gw5MmHTB'
    );

    response = await sut({ page: 2, size: 1 });
    expect(response.snapshot.validators).toHaveLength(1);
    expect(response.snapshot.validators[0].identityPubkey).toBe(
      'puffinQSvKFriPbyE5atyx1ptfnyytovbzxybr1jsyy'
    );
  });

  it('should return the snapshot by commission order', async () => {
    const response = await sut({
      orderCriteria: 'commission',
      orderDirection: 'desc',
    });
    expect(response.snapshot.validators).toHaveLength(2);
    expect(response.snapshot.validators[0].commission).toBeGreaterThan(
      response.snapshot.validators[1].commission
    );
    expect(response.snapshot.validators[0].identityPubkey).toBe(
      'puffinQSvKFriPbyE5atyx1ptfnyytovbzxybr1jsyy'
    );
    expect(response.snapshot.validators[1].identityPubkey).toBe(
      '7pR7t5axFfkg2VZB1uAuFNUvpAeowq2v15J4gw5MmHTB'
    );
  });

  it('should return the snapshot with identity filter', async () => {
    const response = await sut({
      publicKey: '7pR7t5axFfkg2VZB1uAuFNUvpAeowq2v15J4gw5MmHTB',
    });
    expect(response.snapshot.validators).toHaveLength(1);
    expect(response.snapshot.validators[0].identityPubkey).toBe(
      '7pR7t5axFfkg2VZB1uAuFNUvpAeowq2v15J4gw5MmHTB'
    );
  });

  it('should return the snapshot with validator name filter', async () => {
    const response = await sut({
      publicKey: 'Puffin Validator',
    });
    expect(response.snapshot.validators).toHaveLength(1);
    expect(response.snapshot.validators[0].identityPubkey).toBe(
      'puffinQSvKFriPbyE5atyx1ptfnyytovbzxybr1jsyy'
    );
  });

  it('should return error if is order criteria is invalid', async () => {
    await expect(
      sut({ orderCriteria: 'invalid' as 'commission' })
    ).rejects.toThrow('Invalid order criteria');
  });

  it('should return error if is order direction is invalid', async () => {
    await expect(sut({ orderDirection: 'invalid' as 'asc' })).rejects.toThrow(
      'Invalid order direction'
    );
  });

  it('should return error if is page is invalid', async () => {
    await expect(sut({ page: -10 })).rejects.toThrow('Invalid page');
  });

  it('should return error if is size is invalid', async () => {
    await expect(sut({ size: 51 })).rejects.toThrow('Invalid size');

    await expect(sut({ size: -1 })).rejects.toThrow('Invalid size');
  });
});
