/**
 * @jest-environment node
 */
import { Network } from '@/core/snapshot/domain/Network.ts';

describe('Network', () => {
  it('maps mainnet slots to epochs and back', () => {
    const mainnet = Network.mainnet();
    expect(mainnet.epochOf(459_960_774)).toBe(1064);
    expect(mainnet.firstSlot(1064)).toBe(459_648_000);
    expect(mainnet.epochOf(459_648_000)).toBe(1064);
    expect(mainnet.epochOf(459_647_999)).toBe(1063);
  });

  it('maps testnet slots with its warmup offset', () => {
    const testnet = Network.testnet();
    expect(testnet.epochOf(455_424_230)).toBe(1067);
    expect(testnet.firstSlot(1067)).toBe(455_420_256);
  });

  it('knows the migration epoch, and can drop it for replays', () => {
    expect(Network.mainnet().isMigrationEpoch(1064)).toBe(true);
    expect(Network.mainnet().isMigrationEpoch(1065)).toBe(false);
    expect(Network.testnet().isMigrationEpoch(1042)).toBe(true);
    expect(Network.mainnet().withoutMigration().isMigrationEpoch(1064)).toBe(
      false
    );
  });

  it('reads SOLANA_NETWORK, mainnet by default', () => {
    expect(Network.fromEnv('testnet').name).toBe('testnet');
    expect(Network.fromEnv('mainnet').name).toBe('mainnet');
    expect(Network.fromEnv(undefined).name).toBe('mainnet');
  });
});
