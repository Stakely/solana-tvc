/**
 * @jest-environment node
 */
import { DomainError } from '@/core/arch';
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

  describe('when the measurement fails', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    const failingWith = (error: Error) =>
      new GetMeasure({
        measure: async () => {
          throw error;
        },
      });

    // ArchResponse answers any error but a DomainError with a 500 and its
    // message. execFile's message names the CLI call, RPC URL included (a
    // private RPC carries its key in it, spec §10), and adds its stderr.
    it('hides the cause from the client and logs it', async () => {
      const cause = new Error(
        'Command failed: solana -u https://rpc.example.com/secret-key validators --output json'
      );
      await expect(failingWith(cause).exec({ vote: VOTE })).rejects.toThrow(
        /^measurement unavailable$/
      );
      expect(console.error).toHaveBeenCalledWith('measure failed', cause);
    });

    it('lets a domain error through', async () => {
      const error = new DomainError('Unknown vote account', { vote: VOTE });
      await expect(failingWith(error).exec({ vote: VOTE })).rejects.toBe(
        error
      );
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
