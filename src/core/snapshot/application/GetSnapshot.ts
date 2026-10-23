import { ApplicationService } from '@/core/arch';
import { SnapshotQuery } from '@/core/snapshot/domain/SnapshotQuery.ts';
import { GetSnapshotArgs, GetSnapshotResponse } from '@/types/snapshot.ts';
import { SnapshotExtras } from '@/types/measure.ts';
import {
  SnapshotQueryArgs,
  SnapshotQueryFilter,
  SnapshotQueryOrder,
} from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import { ValidatorSnapshotFreshener } from '@/core/snapshot/domain/ValidatorSnapshotFreshener.ts';
import { ValidatorInfoFreshener } from '@/core/snapshot/domain/ValidatorInfoFreshener.ts';

export interface SnapshotExtrasProvider {
  tableExtras(): SnapshotExtras;
}

export class GetSnapshot extends ApplicationService {
  constructor(
    private readonly _query: SnapshotQuery,
    private readonly _freshener: ValidatorSnapshotFreshener,
    private readonly _infoFreshener: ValidatorInfoFreshener,
    private readonly _extras?: SnapshotExtrasProvider
  ) {
    super();
  }

  protected async _doExec(args: GetSnapshotArgs): Promise<GetSnapshotResponse> {
    Promise.all([
      this._freshener.ensureFresh(),
      this._infoFreshener.ensureFresh(),
    ]).catch((error) => console.error('snapshot refresh failed', error));

    const extras = this._extras?.tableExtras();
    const ranksByInclusion =
      !!extras &&
      extras.meta.measuring &&
      !extras.meta.migrationEpoch &&
      extras.meta.measurement === 'ok';

    const order: SnapshotQueryOrder = {
      criteria: args.orderCriteria ?? (ranksByInclusion ? 'inclusion' : 'stake'),
      direction: args.orderDirection ?? 'desc',
    };

    // 0 and NaN (a non-numeric query parameter) fall back to the defaults.
    const page: number = args.page || 1;
    const size: number = args.size || 10;

    let filter: SnapshotQueryFilter | undefined = undefined;
    if (args.publicKey) {
      filter = { validatorKey: args.publicKey };
    }

    const query = new SnapshotQueryArgs(order, size, page, filter);
    return this._query.query(query, extras);
  }
}
