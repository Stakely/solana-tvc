import type { Snapshot } from '@/types/snapshot';
import type { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs';
import { Reducer } from '@/core/snapshot/domain/reducer/Reducer.ts';

export class PaginatorReducer implements Reducer {
  apply(query: SnapshotQueryArgs, snapshot: Snapshot): Snapshot {
    const page = query.page;
    const size = query.size;

    if (size > snapshot.validators.length) {
      return snapshot;
    }

    const start = (page - 1) * size;
    const end = start + size;

    const paginated = snapshot.validators.slice(start, end);
    return { ...snapshot, validators: paginated };
  }
}
