import path from 'node:path';
import { Snapshot } from '@/types/snapshot.ts';
import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';
import { FileManager } from '@/core/file/FileManager.ts';

export type TakenSnapshot = {
  seq: number;
  takenAt: number;
  snapshot: Snapshot;
};

export interface ValidatorsCli {
  validators(): Promise<string>;
}

// Highest lastVote and rootSlot of any validator: how far the RPC behind
// the CLI has got.
const progressOf = (snapshot: Snapshot) =>
  snapshot.validators.reduce(
    (p, v) => ({
      lastVote: Math.max(p.lastVote, v.lastVote),
      rootSlot: Math.max(p.rootSlot, v.rootSlot),
    }),
    { lastVote: 0, rootSlot: 0 }
  );

const advances = (next: Snapshot, current: Snapshot) => {
  const n = progressOf(next);
  const c = progressOf(current);
  return n.lastVote >= c.lastVote && n.rootSlot >= c.rootSlot;
};

// One `solana validators` call at a time per process, shared by the table
// and the measure service (spec §4.1). Each refresh also rewrites
// public/snapshot.json, which the table query reads.
//
// Progress guard: with RPC_URLS in fallback a lagging backup RPC can answer
// with an older view. Such a snapshot is dropped: the previous one stays
// published (same seq, file untouched), and the attempt counts for maxAge so
// the CLI is not called again on every request. A failed call (CLI or parse)
// also counts: until maxAge passes, callers get the previous snapshot, or the
// same error if there is none yet.
export class SnapshotSource {
  private _latest: TakenSnapshot | null = null;
  private _inFlight: Promise<TakenSnapshot> | null = null;
  private _seq = 0;
  private _lastAttemptAt = -Infinity;
  private _lastError: unknown = null;

  constructor(
    private readonly _cli: ValidatorsCli,
    private readonly _publicDir: string | null,
    private readonly _now: () => number = Date.now
  ) {}

  latest(): TakenSnapshot | null {
    return this._latest;
  }

  async get(maxAgeMs: number): Promise<TakenSnapshot> {
    const checkedAt = Math.max(
      this._latest?.takenAt ?? -Infinity,
      this._lastAttemptAt
    );
    if (this._now() - checkedAt < maxAgeMs) {
      if (this._latest) {
        return this._latest;
      }
      if (this._lastError !== null) {
        throw this._lastError;
      }
    }
    if (!this._inFlight) {
      this._inFlight = this._refresh().finally(() => {
        this._inFlight = null;
      });
    }
    return this._inFlight;
  }

  private async _refresh(): Promise<TakenSnapshot> {
    let text: string;
    let snapshot: Snapshot;
    try {
      text = await this._cli.validators();
      snapshot = SnapshotParser.parseText(text);
    } catch (error) {
      this._lastAttemptAt = this._now();
      this._lastError = error;
      throw error;
    }
    this._lastError = null;
    if (this._latest && !advances(snapshot, this._latest.snapshot)) {
      this._lastAttemptAt = this._now();
      return this._latest;
    }
    const taken: TakenSnapshot = {
      seq: this._seq + 1,
      takenAt: this._now(),
      snapshot,
    };
    this._seq = taken.seq;
    this._latest = taken;

    if (this._publicDir) {
      await FileManager.refresh(
        this._publicDir,
        path.join(this._publicDir, 'snapshot.json'),
        text
      ).catch((error) =>
        console.error('snapshot.json could not be written', error)
      );
    }
    return taken;
  }
}
