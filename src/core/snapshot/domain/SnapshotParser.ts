import { Snapshot } from '@/types/snapshot.ts';
import { readFile } from 'fs/promises';

export class SnapshotParser {
  constructor(private readonly _filePath: string) {}

  async parse(): Promise<Snapshot> {
    const text = await readFile(this._filePath, 'utf-8');
    const safeText = this._quoteBigIntFields(text);
    const data = JSON.parse(safeText) as Snapshot;

    if (
      typeof data !== 'object' ||
      data === null ||
      typeof data.averageSkipRate !== 'number' ||
      typeof data.averageStakeWeightedSkipRate !== 'number' ||
      typeof data.totalActiveStake !== 'string' ||
      typeof data.totalCurrentStake !== 'string' ||
      typeof data.totalDelinquentStake !== 'string' ||
      typeof data.stakeByVersion !== 'object' ||
      data.stakeByVersion === null ||
      !Array.isArray(data.validators)
    ) {
      throw new Error('unexpected snapshot.json format');
    }

    return data;
  }

  private _quoteBigIntFields(jsonText: string): string {
    const BIG_INT_KEYS = [
      'totalActiveStake',
      'totalCurrentStake',
      'totalDelinquentStake',
      'currentActiveStake',
      'delinquentActiveStake',
      'activatedStake',
    ] as const;

    const pattern = new RegExp(
      `"(${BIG_INT_KEYS.join('|')})"\\s*:\\s*(\\d+)`,
      'g'
    );
    return jsonText.replace(pattern, `"$1":"$2"`);
  }
}
