export type NetworkName = 'mainnet' | 'testnet';

// Epoch schedule of each network after warmup, and its Alpenglow migration
// epoch (spec §4.2, §6.5).
export class Network {
  private constructor(
    readonly name: NetworkName,
    private readonly _firstNormalEpoch: number,
    private readonly _firstNormalSlot: number,
    readonly slotsPerEpoch: number,
    readonly migrationEpoch: number | null
  ) {}

  static mainnet(): Network {
    return new Network('mainnet', 0, 0, 432_000, 1064);
  }

  static testnet(): Network {
    return new Network('testnet', 14, 524_256, 432_000, 1042);
  }

  static fromEnv(value: string | undefined): Network {
    return value === 'testnet' ? Network.testnet() : Network.mainnet();
  }

  // Same schedule without a migration epoch, to replay recordings of it.
  withoutMigration(): Network {
    return new Network(
      this.name,
      this._firstNormalEpoch,
      this._firstNormalSlot,
      this.slotsPerEpoch,
      null
    );
  }

  epochOf(slot: number): number {
    return (
      this._firstNormalEpoch +
      Math.floor((slot - this._firstNormalSlot) / this.slotsPerEpoch)
    );
  }

  firstSlot(epoch: number): number {
    return (
      this._firstNormalSlot +
      (epoch - this._firstNormalEpoch) * this.slotsPerEpoch
    );
  }

  isMigrationEpoch(epoch: number): boolean {
    return this.migrationEpoch === epoch;
  }
}
