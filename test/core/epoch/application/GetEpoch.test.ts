/**
 * @jest-environment node
 */

import path from 'path';
import { GetEpochResponse } from '@/types/epoch.ts';
import { EpochParser } from '@/core/epoch/domain/EpochParser.ts';
import { EpochQuery } from '@/core/epoch/domain/EpochQuery.ts';
import { GetEpoch } from '@/core/epoch/application/GetEpoch.ts';

describe('Get Eppoch test', () => {
  let sut: () => Promise<GetEpochResponse>;

  beforeEach(() => {
    const filePath = path.join(
      process.cwd(),
      'test/core/epoch/application',
      'epoch.test.json'
    );
    const parser = new EpochParser(filePath);
    const query = new EpochQuery(parser);
    const appService = new GetEpoch(query);

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
});
