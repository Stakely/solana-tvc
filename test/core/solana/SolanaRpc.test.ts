/**
 * @jest-environment node
 */
import { SolanaRpc } from '@/core/solana/SolanaRpc.ts';

type Call = { url: string; body: { method: string; params: unknown[] } };

// fetch double: answers the queued replies in order; an Error is thrown.
function fakeFetch(...replies: unknown[]) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const reply = replies[calls.length - 1];
    if (reply instanceof Error) {
      throw reply;
    }
    return { ok: true, status: 200, json: async () => reply } as Response;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const ok = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

// HTTP 200 replies that carry no result at all. The CLI moves on to the next
// URL for these, so the client must too.
const NO_RESULT: [string, unknown][] = [
  ['a null body', null],
  ['a reply without result', { jsonrpc: '2.0', id: 1 }],
  ['a null result', ok(null)],
];

type Method = {
  name: string;
  rpcMethod: string;
  call: (rpc: SolanaRpc) => Promise<unknown>;
  good: unknown;
  expected: unknown;
  // Replies with a result whose shape the method cannot read.
  malformed: [string, unknown][];
};

const METHODS: Method[] = [
  {
    name: 'blockProduction',
    rpcMethod: 'getBlockProduction',
    call: (rpc) => rpc.blockProduction(0, 9),
    good: ok({
      context: { slot: 9 },
      value: {
        byIdentity: { n1: [4, 3] },
        range: { firstSlot: 0, lastSlot: 9 },
      },
    }),
    expected: { firstSlot: 0, lastSlot: 9, byIdentity: { n1: [4, 3] } },
    malformed: [
      ['a result that is not an object', ok('oops')],
      ['a result without value', ok({ context: { slot: 9 } })],
      ['a value without range', ok({ value: { byIdentity: {} } })],
      [
        'a value without byIdentity',
        ok({ value: { range: { firstSlot: 0, lastSlot: 9 } } }),
      ],
      [
        'a range with non-numeric slots',
        ok({
          value: { byIdentity: {}, range: { firstSlot: '0', lastSlot: 9 } },
        }),
      ],
    ],
  },
  {
    name: 'slotLeaders',
    rpcMethod: 'getSlotLeaders',
    call: (rpc) => rpc.slotLeaders(10, 2),
    good: ok(['n1', 'n2']),
    expected: ['n1', 'n2'],
    malformed: [
      ['a result that is not an array', ok({ leaders: ['n1'] })],
      ['a string result', ok('n1')],
      ['leaders that are not strings', ok(['n1', 7])],
    ],
  },
  {
    name: 'accountData',
    rpcMethod: 'getAccountInfo',
    call: (rpc) => rpc.accountData('addr'),
    good: ok({ context: { slot: 1 }, value: { data: ['AQID', 'base64'] } }),
    expected: Uint8Array.from([1, 2, 3]),
    malformed: [
      ['a result that is not an object', ok('oops')],
      ['a result without value', ok({ context: { slot: 1 } })],
      ['a value without data', ok({ value: {} })],
      ['data that is not an array', ok({ value: { data: 'AQID' } })],
      ['data whose payload is not a string', ok({ value: { data: [7, 'x'] } })],
    ],
  },
  {
    name: 'clusterClients',
    rpcMethod: 'getClusterNodes',
    call: (rpc) => rpc.clusterClients(),
    // A node without clientId (older versions) is left out.
    good: ok([
      { pubkey: 'n1', clientId: 'JitoLabs', version: '4.3.2' },
      { pubkey: 'n2', version: '2.0.0' },
      { pubkey: 'n3', clientId: 'Firedancer' },
    ]),
    expected: new Map([
      ['n1', 'JitoLabs'],
      ['n3', 'Firedancer'],
    ]),
    malformed: [['a result that is not an array', ok({ value: [] })]],
  },
];

describe('SolanaRpc', () => {
  it('reads block production for a slot range', async () => {
    const { fetch, calls } = fakeFetch(
      ok({
        context: { slot: 9 },
        value: { byIdentity: { n1: [4, 3] }, range: { firstSlot: 0, lastSlot: 9 } },
      })
    );
    const rpc = new SolanaRpc(['https://rpc.example'], 1_000, fetch);

    await expect(rpc.blockProduction(0, 9)).resolves.toEqual({
      firstSlot: 0,
      lastSlot: 9,
      byIdentity: { n1: [4, 3] },
    });
    expect(calls[0].url).toBe('https://rpc.example');
    expect(calls[0].body.method).toBe('getBlockProduction');
    expect(calls[0].body.params).toEqual([
      { commitment: 'confirmed', range: { firstSlot: 0, lastSlot: 9 } },
    ]);
  });

  it('falls back to the next URL on errors', async () => {
    const { fetch, calls } = fakeFetch(
      new Error('down'),
      { jsonrpc: '2.0', id: 1, error: { code: -32005, message: 'busy' } },
      ok(['n1', 'n2'])
    );
    const rpc = new SolanaRpc(['https://a', 'https://b', 'https://c'], 1_000, fetch);

    await expect(rpc.slotLeaders(10, 2)).resolves.toEqual(['n1', 'n2']);
    expect(calls.map((c) => c.url)).toEqual([
      'https://a',
      'https://b',
      'https://c',
    ]);
    expect(calls[2].body.params).toEqual([10, 2]);
  });

  it('throws the last error when every URL fails', async () => {
    const { fetch } = fakeFetch({
      jsonrpc: '2.0',
      id: 1,
      error: { code: 403, message: 'forbidden' },
    });
    await expect(
      new SolanaRpc(['https://a'], 1_000, fetch).slotLeaders(1, 1)
    ).rejects.toThrow('getSlotLeaders: 403 forbidden');
  });

  it('decodes base64 account data', async () => {
    const { fetch } = fakeFetch(
      ok({ context: { slot: 1 }, value: { data: ['AQID', 'base64'] } }),
      ok({ context: { slot: 1 }, value: null })
    );
    const rpc = new SolanaRpc(['https://a'], 1_000, fetch);

    await expect(rpc.accountData('addr')).resolves.toEqual(
      Uint8Array.from([1, 2, 3])
    );
    await expect(rpc.accountData('addr')).resolves.toBeNull();
  });

  it('accepts the CLI monikers in RPC_URLS', async () => {
    const { fetch, calls } = fakeFetch(ok([]));
    await new SolanaRpc(['mainnet-beta'], 1_000, fetch).slotLeaders(1, 1);
    expect(calls[0].url).toBe('https://api.mainnet-beta.solana.com');
  });

  describe.each(METHODS)(
    '$name with an unusable reply',
    ({ call, good, expected, malformed, rpcMethod }) => {
      it.each<[string, unknown]>([...NO_RESULT, ...malformed])(
        'falls back to the next URL past %s',
        async (_label, bad) => {
          const { fetch, calls } = fakeFetch(bad, good);
          const rpc = new SolanaRpc(['https://a', 'https://b'], 1_000, fetch);

          await expect(call(rpc)).resolves.toEqual(expected);
          expect(calls.map((c) => c.url)).toEqual(['https://a', 'https://b']);
        }
      );

      it('rejects when a single URL replies without a result', async () => {
        const { fetch } = fakeFetch(ok(null));
        const rpc = new SolanaRpc(['https://a'], 1_000, fetch);

        await expect(call(rpc)).rejects.toThrow(`${rpcMethod}: no result`);
      });

      it('rejects with the last error when no URL replies usably', async () => {
        const { fetch, calls } = fakeFetch(ok(null), ok('oops'));
        const rpc = new SolanaRpc(['https://a', 'https://b'], 1_000, fetch);

        await expect(call(rpc)).rejects.toThrow(
          `${rpcMethod}: unexpected result shape`
        );
        expect(calls).toHaveLength(2);
      });
    }
  );
});
