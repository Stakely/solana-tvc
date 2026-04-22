import { Snapshot } from '@/types/snapshot.ts';
import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import { OrderReducer } from '@/core/snapshot/domain/reducer/OrderReducer.ts';
import { FilterReducer } from '@/core/snapshot/domain/reducer/FilterReducer.ts';
import { PaginatorReducer } from '@/core/snapshot/domain/reducer/PaginatorReducer.ts';

export class SnapshotReducer {
  constructor(
    private readonly _byOrder: OrderReducer,
    private readonly _filter: FilterReducer,
    private readonly _paginator: PaginatorReducer
  ) {}
  reduce(
    snapshot: Snapshot,
    query: SnapshotQueryArgs
  ): { totalItems: number; snapshot: Snapshot } {
    const orderedSnapshot = this._byOrder.apply(query, snapshot);
    const filteredSnapshot = this._filter.apply(query, orderedSnapshot);
    const paginatedSnapshot = this._paginator.apply(query, filteredSnapshot);

    return {
      totalItems: filteredSnapshot.validators.length,
      snapshot: paginatedSnapshot,
    };
  }
}
