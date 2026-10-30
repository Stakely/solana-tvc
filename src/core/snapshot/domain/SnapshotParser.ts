import { Snapshot, ValidatorSnapshot } from '@/types/snapshot.ts';
import { readFile } from 'fs/promises';

export class SnapshotParser {
  constructor(private readonly _filePath: string) {}

  async parse(): Promise<Snapshot> {
    return SnapshotParser.parseText(await readFile(this._filePath, 'utf-8'));
  }

  // Parses `solana validators --output json`: quotes the stake fields (they
  // exceed 2^53), checks the shape and fills `commission` from
  // `commissionBps` on CLI versions that only print the latter, then drops
  // `commissionBps` so the API serves a single field.
  //
  // A validator with neither field gets commission 0 instead of a throw. A
  // throw would drop the whole snapshot, and with it the table refresh and the
  // measurement for everyone.
  static parseText(text: string): Snapshot {
    const data = JSON.parse(
      SnapshotParser._quoteBigIntFields(text)
    ) as Snapshot;

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

    for (const validator of data.validators) {
      const raw = validator as ValidatorSnapshot & { commissionBps?: number };
      if (typeof raw.commission !== 'number') {
        raw.commission =
          typeof raw.commissionBps === 'number' ? raw.commissionBps / 100 : 0;
      }
      delete raw.commissionBps;
    }

    return data;
  }

  private static _quoteBigIntFields(jsonText: string): string {
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
