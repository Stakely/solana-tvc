import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';
import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import {
  ClientStats,
  GetSnapshotResponse,
  Snapshot,
  StakeByVersionStats,
  ValidatorInfo,
} from '@/types/snapshot.ts';
import { SnapshotExtras, SnapshotMeta } from '@/types/measure.ts';
import { SnapshotReducer } from '@/core/snapshot/domain/reducer/SnapshotReducer.ts';
import { ValidatorInfoParser } from '@/core/snapshot/domain/ValidatorInfoParser.ts';

const NO_MEASUREMENT: SnapshotMeta = {
  instance: '',
  epoch: null,
  migrationEpoch: false,
  measurement: 'ok',
  measuring: false,
  minMeasurableStake: null,
};

// Per version, the current validators and stake of each client, most stake
// first. Stakes are lamports above 2^53: summed as bigint.
export function withClients(
  snapshot: Snapshot,
  clientOf: (identity: string) => string | undefined
): Record<string, StakeByVersionStats> {
  const byVersion = new Map<string, Map<string, { n: number; stake: bigint }>>();
  for (const v of snapshot.validators) {
    if (v.delinquent) continue;
    const client = clientOf(v.identityPubkey) ?? '';
    const clients = byVersion.get(v.version) ?? new Map();
    byVersion.set(v.version, clients);
    const entry = clients.get(client) ?? { n: 0, stake: 0n };
    entry.n += 1;
    entry.stake += BigInt(v.activatedStake);
    clients.set(client, entry);
  }
  const result: Record<string, StakeByVersionStats> = {};
  for (const [version, stats] of Object.entries(snapshot.stakeByVersion)) {
    const clients: ClientStats[] = [...(byVersion.get(version) ?? new Map())]
      .sort(([, a], [, b]) => (a.stake === b.stake ? 0 : a.stake > b.stake ? -1 : 1))
      .map(([client, { n, stake }]) => ({
        client,
        validators: n,
        activeStake: stake.toString(),
      }));
    result[version] = { ...stats, clients };
  }
  return result;
}

export class SnapshotQuery {
  constructor(
    private readonly _snapshotParser: SnapshotParser,
    private readonly _validatorInfoParser: ValidatorInfoParser,
    private readonly _reducer: SnapshotReducer
  ) {}

  async query(
    query: SnapshotQueryArgs,
    extras?: SnapshotExtras,
    clientOf?: (identity: string) => string | undefined
  ): Promise<GetSnapshotResponse> {
    const fullSnapshot: Snapshot = await this._snapshotParser.parse();
    const validatorsInfo = await this._validatorInfoParser.parse();

    const infoByIdentity = new Map<string, ValidatorInfo>(
      validatorsInfo.map((vi) => [vi.identityPubkey, vi])
    );

    // Measurement fields go on every validator before ordering, so the
    // table can rank by them.
    const fullSnapshotWithInfo: Snapshot = {
      ...fullSnapshot,
      ...(clientOf
        ? { stakeByVersion: withClients(fullSnapshot, clientOf) }
        : {}),
      validators: fullSnapshot.validators.map((v) => ({
        ...v,
        info: infoByIdentity.get(v.identityPubkey),
        client: clientOf?.(v.identityPubkey),
        ...extras?.byVote(v.voteAccountPubkey),
      })),
    };

    const reducedSnapshot = this._reducer.reduce(fullSnapshotWithInfo, query);

    return {
      ...reducedSnapshot,
      itemsPerPage: query.size,
      ...(extras?.meta ?? NO_MEASUREMENT),
    };
  }
}
