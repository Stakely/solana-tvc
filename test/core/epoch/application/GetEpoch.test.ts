/**
 * @jest-environment node
 */

import path from 'path';
import { GetEpochResponse } from '@/types/epoch.ts';
import { EpochParser } from '@/core/epoch/domain/EpochParser.ts';
import { EpochQuery } from '@/core/epoch/domain/EpochQuery.ts';
import { GetEpoch } from '@/core/epoch/application/GetEpoch.ts';
import { EpochFreshener } from '@/core/epoch/domain/EpochFreshener.ts';

const epochQuery = () =>
  new EpochQuery(
    new EpochParser(
      path.join(
        process.cwd(),
        'test/core/epoch/application',
        'epoch.test.json'
      )
    )
  );

describe('Get Eppoch test', () => {
  let sut: () => Promise<GetEpochResponse>;

  beforeEach(() => {
    // The test reads a local fixture, so the freshener (which calls the
    // Solana CLI and rewrites public/epoch.json) is replaced by a double.
    const freshener = {
      ensureFresh: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    } as unknown as EpochFreshener;
    const appService = new GetEpoch(epochQuery(), freshener);

    sut = (() => appService.exec({})) as () => Promise<GetEpochResponse>;
  });

  it('should return epoch response', async () => {
    const response = await sut();
    expect(response.epoch).toBe(914);
    expect(response.slotIndex).toBe(328517);
    expect(response.slotsInEpoch).toBe(432000);
    expect(response.absoluteSlot).toBe('395176517');
    expect(response.blockHeight).toBe('373303465');
    expect(response.transactionCount).toBe('481206300023');
    expect(response.epochCompletedPercent).toBe(76.04560185185186);
  });

  describe('when the refresh fails', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    // The refresh is not awaited: nothing may be left unhandled, and the
    // failure goes to the log (spec §6.1, freshener row).
    it('logs the failure and answers from the file', async () => {
      const failure = new Error('rpc down');
      const freshener = {
        ensureFresh: jest.fn<Promise<void>, []>().mockRejectedValue(failure),
      } as unknown as EpochFreshener;
      const appService = new GetEpoch(epochQuery(), freshener);

      const response = (await appService.exec({})) as GetEpochResponse;
      await new Promise((resolve) => setImmediate(resolve));

      expect(response.epoch).toBe(914);
      expect(console.error).toHaveBeenCalledWith(
        'epoch refresh failed',
        failure
      );
    });
  });
});
