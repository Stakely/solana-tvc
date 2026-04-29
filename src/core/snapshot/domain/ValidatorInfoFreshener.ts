import path from 'node:path';
import { SolanaCli } from '@/core/solana/SolanaCli.ts';
import { FileManager } from '@/core/file/FileManager.ts';

export class ValidatorInfoFreshener {
  private readonly _solanaCli: SolanaCli;
  private readonly _publicDir: string;
  private readonly _snapshotPath: string;
  private readonly _ttlMs: number;

  private _refreshing: Promise<void> | null = null;

  constructor(_solanaCli: SolanaCli, _publicDir: string, _ttlMs: number) {
    this._solanaCli = _solanaCli;
    this._publicDir = _publicDir;
    this._snapshotPath = path.join(_publicDir, 'validator_info.json');
    this._ttlMs = _ttlMs;
  }

  async ensureFresh(): Promise<void> {
    const fresh = await FileManager.isFresh(this._snapshotPath, this._ttlMs);

    if (fresh) {
      return;
    }

    if (!this._refreshing) {
      const stdout = await this._solanaCli.validatorInfo();
      this._refreshing = FileManager.refresh(
        this._publicDir,
        this._snapshotPath,
        stdout
      ).finally(() => {
        this._refreshing = null;
      });
    }

    await this._refreshing;
  }
}
