import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import { Snapshot } from '@/types/snapshot.ts';

export interface Reducer {
  apply(query: SnapshotQueryArgs, snapshot: Snapshot): Snapshot;
}
