/**
 * @jest-environment node
 */
import { GetMeasure } from '@/core/measure/application/GetMeasure.ts';
import { MeasureResponse } from '@/types/measure.ts';

describe('GetMeasure', () => {
  const response = { instance: 'x' } as MeasureResponse;
  const service = { measure: jest.fn(async () => response) };
  const sut = new GetMeasure(service);
  const VOTE = 'PUFFiNkUHF2DMfbKeUcYTSQckDDtkswfxZCDv5WQqwp';

  it('measures a valid vote account', async () => {
    await expect(sut.exec({ vote: VOTE })).resolves.toBe(response);
    expect(service.measure).toHaveBeenCalledWith(VOTE);
  });

  it.each([null, '', 'not a key', '0OIl'.repeat(10)])(
    'rejects %p',
    async (vote) => {
      await expect(sut.exec({ vote })).rejects.toThrow('Invalid vote account');
    }
  );
});
