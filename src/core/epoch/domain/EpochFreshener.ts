import path from 'node:path';
import { SolanaCli } from '@/core/solana/SolanaCli.ts';
import { FileManager } from '@/core/file/FileManager.ts';

export class EpochFreshener {
  private readonly _solanaCli: SolanaCli;
  private readonly _publicDir: string;
  private readonly _epochFilePath: string;
  private readonly _ttlMs: number;

  private _refreshing: boolean = false;

  constructor(_solanaCli: SolanaCli, _publicDir: string, _ttlMs: number) {
    this._solanaCli = _solanaCli;
    this._publicDir = _publicDir;
    this._epochFilePath = path.join(_publicDir, 'epoch.json');
    this._ttlMs = _ttlMs;
  }

  async ensureFresh(): Promise<void> {
    const fresh = await FileManager.isFresh(this._epochFilePath, this._ttlMs);

    if (fresh) {
      return;
    }

    if (!this._refreshing) {
      this._refreshing = true;
      const stdout = await this._solanaCli.epochInfo();
      FileManager.refresh(this._publicDir, this._epochFilePath, stdout).finally(
        () => {
          this._refreshing = false;
        }
      );
    }
  }
}
