import { ValidatorInfo } from '@/types/snapshot.ts';
import { readFile } from 'fs/promises';

export class ValidatorInfoParser {
  constructor(private readonly _filePath: string) {}

  async parse(): Promise<ValidatorInfo[]> {
    const text = await readFile(this._filePath, 'utf-8');
    const data = JSON.parse(text) as unknown;

    if (!Array.isArray(data)) {
      throw new Error('unexpected validator_info.json format: expected array');
    }

    for (const item of data) {
      if (typeof item !== 'object' || item === null) {
        throw new Error(
          'unexpected validator_info.json format: entry is not object'
        );
      }

      const entry = item as Record<string, unknown>;

      if (
        typeof entry.identityPubkey !== 'string' ||
        entry.identityPubkey.length === 0
      ) {
        throw new Error(
          'unexpected validator_info.json format: identityPubkey'
        );
      }

      if (
        typeof entry.infoPubkey !== 'string' ||
        entry.infoPubkey.length === 0
      ) {
        throw new Error('unexpected validator_info.json format: infoPubkey');
      }

      if (typeof entry.info !== 'object' || entry.info === null) {
        throw new Error('unexpected validator_info.json format: info');
      }

      const info = entry.info as Record<string, unknown>;

      const optionalStringKeys = [
        'name',
        'website',
        'iconUrl',
        'details',
        'keybaseUsername',
      ] as const;
      for (const k of optionalStringKeys) {
        const v = info[k];
        if (v !== undefined && typeof v !== 'string') {
          throw new Error(`unexpected validator_info.json format: info.${k}`);
        }
      }
    }

    return data as ValidatorInfo[];
  }
}
