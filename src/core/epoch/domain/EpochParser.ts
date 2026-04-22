import { Epoch } from '@/types/epoch.ts';
import { readFile } from 'node:fs/promises';

export class EpochParser {
  constructor(private readonly _filePath: string) {}

  async parse(): Promise<Epoch> {
    const text = await readFile(this._filePath, 'utf-8');
    const safeText = this._quoteBigIntFields(text);
    const data = JSON.parse(safeText) as Epoch;

    if (
      typeof data !== 'object' ||
      data === null ||
      typeof data.epoch !== 'number' ||
      typeof data.slotIndex !== 'number' ||
      typeof data.slotsInEpoch !== 'number' ||
      typeof data.absoluteSlot !== 'string' ||
      typeof data.blockHeight !== 'string' ||
      typeof data.transactionCount !== 'string' ||
      typeof data.epochCompletedPercent !== 'number'
    ) {
      throw new Error('unexpected epoch json format');
    }

    return data;
  }

  private _quoteBigIntFields(jsonText: string): string {
    const BIG_INT_KEYS = [
      'absoluteSlot',
      'blockHeight',
      'transactionCount',
    ] as const;

    const pattern = new RegExp(
      `"(${BIG_INT_KEYS.join('|')})"\\s*:\\s*(\\d+)`,
      'g'
    );

    return jsonText.replace(pattern, `"$1":"$2"`);
  }
}
