// [leaderSlots, blocksProduced] per identity, as getBlockProduction returns.
export type BlockProduction = {
  firstSlot: number;
  lastSlot: number;
  byIdentity: Record<string, [number, number]>;
};

const MONIKERS: Record<string, string> = {
  m: 'https://api.mainnet-beta.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  t: 'https://api.testnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  d: 'https://api.devnet.solana.com',
  devnet: 'https://api.devnet.solana.com',
};

// A null body, a missing result and a null result are all "no reply" here.
type RpcReply = {
  result?: unknown;
  error?: { code: number; message: string };
} | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Each reader checks the shape of one method's result and throws when it is
// not the expected one, so that _call moves on to the next URL as it does for
// any other failed reply.
function readBlockProduction(result: unknown): BlockProduction {
  const value = isRecord(result) ? result.value : undefined;
  if (isRecord(value)) {
    const { byIdentity, range } = value;
    if (isRecord(byIdentity) && isRecord(range)) {
      const { firstSlot, lastSlot } = range;
      if (typeof firstSlot === 'number' && typeof lastSlot === 'number') {
        return {
          firstSlot,
          lastSlot,
          byIdentity: byIdentity as Record<string, [number, number]>,
        };
      }
    }
  }
  throw new Error('getBlockProduction: unexpected result shape');
}

function readSlotLeaders(result: unknown): string[] {
  if (
    Array.isArray(result) &&
    result.every((leader) => typeof leader === 'string')
  ) {
    return result as string[];
  }
  throw new Error('getSlotLeaders: unexpected result shape');
}

function readAccountData(result: unknown): Uint8Array | null {
  const value = isRecord(result) ? result.value : undefined;
  if (value === null) {
    return null;
  }
  if (isRecord(value)) {
    const { data } = value;
    if (Array.isArray(data) && typeof data[0] === 'string') {
      return Uint8Array.from(Buffer.from(data[0], 'base64'));
    }
  }
  throw new Error('getAccountInfo: unexpected result shape');
}

// JSON-RPC calls the CLI does not offer cheaply, sent to the same RPC_URLS
// with the same fallback order (spec §3).
export class SolanaRpc {
  private readonly _urls: string[];

  constructor(
    rpcUrls: string[],
    private readonly _timeoutMs: number = 15_000,
    private readonly _fetch: typeof fetch = (input, init) =>
      fetch(input, init)
  ) {
    this._urls = rpcUrls.map((url) => MONIKERS[url.trim()] ?? url.trim());
  }

  async blockProduction(
    firstSlot: number,
    lastSlot: number
  ): Promise<BlockProduction> {
    return this._call(
      'getBlockProduction',
      [{ commitment: 'confirmed', range: { firstSlot, lastSlot } }],
      readBlockProduction
    );
  }

  async slotLeaders(startSlot: number, limit: number): Promise<string[]> {
    return this._call('getSlotLeaders', [startSlot, limit], readSlotLeaders);
  }

  async accountData(address: string): Promise<Uint8Array | null> {
    return this._call(
      'getAccountInfo',
      [address, { encoding: 'base64', commitment: 'confirmed' }],
      readAccountData
    );
  }

  // Reading the result happens inside the fallback loop: a reply that cannot
  // be read is a failed URL, not a result to hand back to the caller.
  private async _call<T>(
    method: string,
    params: unknown[],
    read: (result: unknown) => T
  ): Promise<T> {
    let lastError: unknown;

    for (const url of this._urls) {
      try {
        const response = await this._fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(this._timeoutMs),
        });
        if (!response.ok) {
          throw new Error(`${method}: HTTP ${response.status}`);
        }
        const reply = (await response.json()) as RpcReply;
        if (reply?.error) {
          throw new Error(
            `${method}: ${reply.error.code} ${reply.error.message}`
          );
        }
        const result = reply?.result;
        if (result === undefined || result === null) {
          throw new Error(`${method}: no result`);
        }
        return read(result);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }
}
