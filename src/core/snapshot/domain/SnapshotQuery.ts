import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';
import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import {
  GetSnapshotResponse,
  Snapshot,
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
