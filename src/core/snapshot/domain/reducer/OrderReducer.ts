import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import { Snapshot, ValidatorSnapshot } from '@/types/snapshot.ts';
import { Reducer } from '@/core/snapshot/domain/reducer/Reducer.ts';

export class OrderReducer implements Reducer {
  apply(query: SnapshotQueryArgs, snapshot: Snapshot): Snapshot {
    const { criteria, direction } = query.order;

    const dir = direction === 'asc' ? 1 : -1;

    const sorted = [...snapshot.validators].sort((a, b) => {
      switch (criteria) {
        case 'credits':
          return (a.epochCredits - b.epochCredits) * dir;

        case 'commission':
          return (a.commission - b.commission) * dir;

        case 'version':
        default:
          return a.version.localeCompare(b.version) * dir;
      }
    });

    const indexedSorted = sorted.map((v, i): ValidatorSnapshot => {
      return { ...v, ranking: i + 1 };
    });

    return { ...snapshot, validators: indexedSorted };
  }
}
