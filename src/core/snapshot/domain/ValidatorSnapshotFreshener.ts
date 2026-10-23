import { SnapshotSource } from '@/core/snapshot/domain/SnapshotSource.ts';

// Keeps public/snapshot.json fresh through the shared source. Never rejects:
// on a failed refresh the table keeps serving the last file.
export class ValidatorSnapshotFreshener {
  constructor(
    private readonly _source: SnapshotSource,
    private readonly _ttlMs: number
  ) {}

  async ensureFresh(): Promise<void> {
    try {
      await this._source.get(this._ttlMs);
    } catch (error) {
      console.error('validators snapshot refresh failed', error);
    }
  }
}
