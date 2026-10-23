import { Snapshot } from '@/types/snapshot.ts';
import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';

// Matches identity, vote account (the monitor follows it across identity
// switches) or validator name.
export class FilterReducer {
  apply(snapshotQuery: SnapshotQueryArgs, snapshot: Snapshot): Snapshot {
    if (!snapshotQuery.filter) {
      return snapshot;
    }

    const key = snapshotQuery.filter.validatorKey.toLowerCase();
    const validators = snapshot.validators.filter(
      (v) =>
        v.identityPubkey.toLowerCase().includes(key) ||
        v.voteAccountPubkey.toLowerCase().includes(key) ||
        !!v.info?.info.name?.toLowerCase().includes(key)
    );

    return { ...snapshot, validators };
  }
}
