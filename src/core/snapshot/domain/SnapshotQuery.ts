import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';
import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import { Snapshot, ValidatorInfo } from '@/types/snapshot.ts';
import { SnapshotReducer } from '@/core/snapshot/domain/reducer/SnapshotReducer.ts';
import { ValidatorInfoParser } from '@/core/snapshot/domain/ValidatorInfoParser.ts';

export class SnapshotQuery {
  constructor(
    private readonly _snapshotParser: SnapshotParser,
    private readonly _validatorInfoParser: ValidatorInfoParser,
    private readonly _reducer: SnapshotReducer
  ) {}

  async query(query: SnapshotQueryArgs): Promise<{
    totalItems: number;
    snapshot: Snapshot;
    itemsPerPage: number;
  }> {
    const fullSnapshot: Snapshot = await this._snapshotParser.parse();
    const validatorsInfo = await this._validatorInfoParser.parse();

    const infoByIdentity = new Map<string, ValidatorInfo>(
      validatorsInfo.map((vi) => [vi.identityPubkey, vi])
    );

    const fullSnapshotWithInfo: Snapshot = {
      ...fullSnapshot,
      validators: fullSnapshot.validators.map((v) => ({
        ...v,
        info: infoByIdentity.get(v.identityPubkey),
      })),
    };

    const reducedSnapshot = this._reducer.reduce(fullSnapshotWithInfo, query);

    return {
      ...reducedSnapshot,
      snapshot: reducedSnapshot.snapshot,
      itemsPerPage: query.size,
    };
  }
}
