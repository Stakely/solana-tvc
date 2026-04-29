import { ApplicationService } from '@/core/arch';
import { SnapshotQuery } from '@/core/snapshot/domain/SnapshotQuery.ts';
import { GetSnapshotArgs, GetSnapshotResponse } from '@/types/snapshot.ts';
import {
  SnapshotQueryArgs,
  SnapshotQueryFilter,
  SnapshotQueryOrder,
} from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import { ValidatorSnapshotFreshener } from '@/core/snapshot/domain/ValidatorSnapshotFreshener.ts';
import { ValidatorInfoFreshener } from '@/core/snapshot/domain/ValidatorInfoFreshener.ts';

export class GetSnapshot extends ApplicationService {
  constructor(
    private readonly _query: SnapshotQuery,
    private readonly _freshener: ValidatorSnapshotFreshener,
    private readonly _infoFreshener: ValidatorInfoFreshener
  ) {
    super();
  }

  protected async _doExec(args: GetSnapshotArgs): Promise<GetSnapshotResponse> {
    Promise.all([
      this._freshener.ensureFresh(),
      this._infoFreshener.ensureFresh(),
    ]);

    const order: SnapshotQueryOrder = {
      criteria: 'credits',
      direction: 'desc',
    };

    if (args.orderDirection) {
      order.direction = args.orderDirection;
    }

    if (args.orderCriteria) {
      order.criteria = args.orderCriteria;
    }

    let page: number = 1;
    if (args.page) {
      page = args.page;
    }

    let size: number = 10;
    if (args.size) {
      size = args.size;
    }

    let filter: SnapshotQueryFilter | undefined = undefined;
    if (args.publicKey) {
      filter = { validatorKey: args.publicKey };
    }

    const query = new SnapshotQueryArgs(order, size, page, filter);
    return this._query.query(query);
  }
}
