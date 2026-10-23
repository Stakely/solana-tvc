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

// One `solana validators` call at a time per process, shared by the table
// and the measure service (spec §4.1). Each refresh also rewrites
// public/snapshot.json, which the table query reads.
export class SnapshotSource {
  private _latest: TakenSnapshot | null = null;
  private _inFlight: Promise<TakenSnapshot> | null = null;
  private _seq = 0;

  constructor(
    private readonly _cli: ValidatorsCli,
    private readonly _publicDir: string | null,
    private readonly _now: () => number = Date.now
  ) {}

  latest(): TakenSnapshot | null {
    return this._latest;
  }

  async get(maxAgeMs: number): Promise<TakenSnapshot> {
    if (this._latest && this._now() - this._latest.takenAt < maxAgeMs) {
      return this._latest;
    }
    if (!this._inFlight) {
      this._inFlight = this._refresh().finally(() => {
        this._inFlight = null;
      });
    }
    return this._inFlight;
  }

  private async _refresh(): Promise<TakenSnapshot> {
    const text = await this._cli.validators();
    const taken: TakenSnapshot = {
      seq: this._seq + 1,
      takenAt: this._now(),
      snapshot: SnapshotParser.parseText(text),
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
