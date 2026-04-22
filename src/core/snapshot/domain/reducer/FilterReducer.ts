import { Snapshot } from '@/types/snapshot.ts';
import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';

export class FilterReducer {
  apply(snapshotQuery: SnapshotQueryArgs, snapshot: Snapshot): Snapshot {
    if (!snapshotQuery.filter) {
      return snapshot;
    }

    const publicKey = snapshotQuery.filter.validatorKey;
    const validator = snapshot.validators.filter((v) => {
      let found = v.identityPubkey
        .toLowerCase()
        .includes(publicKey.toLowerCase());
      if (found) {
        return true;
      }

      if (v.info?.info.name) {
        found = v.info.info.name
          .toLowerCase()
          .includes(publicKey.toLowerCase());
      }

      return found;
    });

    return { ...snapshot, validators: validator };
  }
}
