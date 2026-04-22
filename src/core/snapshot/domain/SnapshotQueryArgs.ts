import { DomainError } from '@/core/arch';

export type SnapshotQueryOrder = {
  criteria: 'credits' | 'commission' | 'version';
  direction: 'asc' | 'desc';
};
export type SnapshotQueryFilter = {
  validatorKey: string;
};
export class SnapshotQueryArgs {
  constructor(
    private readonly _order: SnapshotQueryOrder = {
      criteria: 'credits',
      direction: 'asc',
    },
    private readonly _size: number = 15,
    private readonly _page: number = 1,
    private readonly _filter: SnapshotQueryFilter | undefined = undefined
  ) {
    if (
      _order.criteria !== 'credits' &&
      _order.criteria !== 'version' &&
      _order.criteria !== 'commission'
    ) {
      throw new DomainError('Invalid order criteria', {
        order: _order.criteria,
      });
    }

    if (_order.direction !== 'asc' && _order.direction !== 'desc') {
      throw new DomainError('Invalid order direction', {
        order: _order.direction,
      });
    }

    if (_size < 1 || _size > 50) {
      throw new DomainError('Invalid size', { size: _size });
    }

    if (_page < 1) {
      throw new DomainError('Invalid page', { page: _page });
    }
  }

  get filter(): SnapshotQueryFilter | undefined {
    return this._filter;
  }

  get order(): SnapshotQueryOrder {
    return this._order;
  }

  get size(): number {
    return this._size;
  }

  get page(): number {
    return this._page;
  }
}
