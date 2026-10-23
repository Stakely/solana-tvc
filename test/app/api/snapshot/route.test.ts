/**
 * @jest-environment node
 */
import { GET } from '@/app/api/snapshot/route.ts';
import { Factory } from '@/core/Factory.ts';
import { GetSnapshotResponse } from '@/types/snapshot.ts';

// The route builds its services as soon as it is loaded. The real ones call
// the Solana CLI and rewrite public/, so they are replaced by doubles.
// (jest.mock does not resolve the `@/` alias: the path is relative.)
jest.mock('../../../../src/core/Factory.ts', () => {
  const query = jest.fn();
  const freshener = { ensureFresh: async () => undefined };
  return {
    Factory: {
      SnapshotQuery: () => ({ query }),
      ValidatorSnapshotFreshener: () => freshener,
      ValidatorInfoFreshener: () => freshener,
      MeasureService: () => undefined,
    },
  };
});

const queryMock = jest.mocked(Factory.SnapshotQuery().query);

const get = (search: string) =>
  GET(new Request(`http://localhost/api/snapshot${search}`));

const requestedOrder = () => queryMock.mock.calls.at(-1)?.[0].order;

describe('GET /api/snapshot', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ totalItems: 0 } as GetSnapshotResponse);
  });

  // An empty value counts as a missing one. It used to reach the query as an
  // invalid order, and the client got a 400.
  it.each([
    '?orderCriteria=',
    '?orderDirection=',
    '?orderCriteria=&orderDirection=',
  ])(
    'falls back to the default order on an empty value (%s)',
    async (search) => {
      const response = await get(search);

      expect(response.status).toBe(200);
      expect(requestedOrder()).toEqual({
        criteria: 'stake',
        direction: 'desc',
      });
    }
  );

  it('orders as requested', async () => {
    const response = await get('?orderCriteria=epochRatio&orderDirection=asc');

    expect(response.status).toBe(200);
    expect(requestedOrder()).toEqual({
      criteria: 'epochRatio',
      direction: 'asc',
    });
  });

  it.each(['?orderCriteria=nope', '?orderDirection=nope'])(
    'still rejects an invalid value (%s)',
    async (search) => {
      const response = await get(search);

      expect(response.status).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    }
  );
});
