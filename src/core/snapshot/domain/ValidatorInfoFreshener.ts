import path from 'node:path';
import { SolanaCli } from '@/core/solana/SolanaCli.ts';
import { FileManager } from '@/core/file/FileManager.ts';

// Keeps public/validator_info.json fresh. One refresh at a time: a caller
// that arrives while the CLI runs joins it, instead of starting another
// `solana validator-info get` (seconds, and 1 MB of output). Never rejects:
// on a failed refresh the table keeps serving the last file, and the next
// call tries again.
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
    // Set before the first await, so every concurrent caller finds it.
    if (!this._refreshing) {
      this._refreshing = this._refresh().finally(() => {
        this._refreshing = null;
      });
    }

    await this._refreshing;
  }

  private async _refresh(): Promise<void> {
    try {
      if (await FileManager.isFresh(this._snapshotPath, this._ttlMs)) {
        return;
      }
      const stdout = await this._solanaCli.validatorInfo();
      await FileManager.refresh(this._publicDir, this._snapshotPath, stdout);
    } catch (error) {
      console.error('validator info refresh failed', error);
    }
  }
}
