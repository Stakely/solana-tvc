/**
 * @jest-environment node
 */
import { ClientDirectory } from '@/core/snapshot/domain/ClientDirectory.ts';

describe('ClientDirectory', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('knows the client of each identity once read', async () => {
    const rpc = {
      clusterClients: jest.fn(async () => new Map([['id1', 'JitoLabs']])),
    };
    const directory = new ClientDirectory(rpc, 600_000, () => 0);
    expect(directory.clientOf('id1')).toBeUndefined();
    await directory.refresh();
    expect(directory.clientOf('id1')).toBe('JitoLabs');
    expect(directory.clientOf('id2')).toBeUndefined();
  });

  it('reads at most once per interval, one read at a time', async () => {
    const clock = { t: 0 };
    const rpc = { clusterClients: jest.fn(async () => new Map<string, string>()) };
    const directory = new ClientDirectory(rpc, 600_000, () => clock.t);
    await Promise.all([directory.refresh(), directory.refresh()]);
    clock.t = 599_999;
    await directory.refresh();
    expect(rpc.clusterClients).toHaveBeenCalledTimes(1);
    clock.t = 600_000;
    await directory.refresh();
    expect(rpc.clusterClients).toHaveBeenCalledTimes(2);
  });

  it('keeps the previous table and waits the interval after a failed read', async () => {
    const clock = { t: 0 };
    const rpc = {
      clusterClients: jest
        .fn<Promise<Map<string, string>>, []>()
        .mockResolvedValueOnce(new Map([['id1', 'Agave']]))
        .mockRejectedValueOnce(new Error('rpc down')),
    };
    const directory = new ClientDirectory(rpc, 600_000, () => clock.t);
    await directory.refresh();
    clock.t = 600_000;
    await expect(directory.refresh()).resolves.toBeUndefined();
    expect(directory.clientOf('id1')).toBe('Agave');
    clock.t = 900_000;
    await directory.refresh();
    expect(rpc.clusterClients).toHaveBeenCalledTimes(2);
  });
});
